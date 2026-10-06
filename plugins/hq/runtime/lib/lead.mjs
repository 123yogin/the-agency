// Ask the Lead: a job is one goal. The Lead (a headless, read-only Claude session) writes a plan, the person
// edits and approves it, then HQ runs each task as a dispatch run with its agent, in dependency order and
// within the job's parallel limit. When every task has finished, the Lead (resumed) writes the summary.
// Daily plans (daily.mjs) reuse this machinery through `hooks`; every hook only acts on jobs with `daily` set.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { buildArgs } from './dispatch.mjs';
import {
  MAX_TASKS, buildFollowupPrompt, buildLeadArgs, buildPlanPrompt, buildSummaryPrompt, composeTaskPrompt, extractJson,
  recomputeBlocked, runnable, validatePlan,
} from './plan.mjs';
import { clip, isDir, isPlainObj, readJson, safeLine } from './util.mjs';

const KEEP = 40;
const ACTIVE = new Set(['planning', 'following', 'running', 'summarizing']);
const LEAD_AGENT = 'hq:lead';
const now = () => new Date().toISOString();

export class Lead {
  constructor({ dataDir, dispatcher, getAgents = () => [], onChange = () => {} }) {
    this.file = path.join(dataDir, 'jobs.json');
    this.dispatcher = dispatcher;
    this.hooks = {};
    this.getAgents = getAgents;
    this.onChange = onChange;
    this.jobs = [];
    const saved = readJson(this.file, []);
    for (const j of Array.isArray(saved) ? saved : []) {
      if (!isPlainObj(j) || typeof j.id !== 'string' || !Array.isArray(j.tasks)) continue;
      if (ACTIVE.has(j.status)) {
        j.interruptedFrom = j.status;
        j.status = 'interrupted';
        for (const t of j.tasks) {
          if (t.status === 'running') {
            t.status = 'interrupted';
            t.error = 'HQ stopped while this task was running.';
          }
        }
        recomputeBlocked(j.tasks);
      }
      this.jobs.push(j);
    }
    dispatcher.finishHooks.push((r) => this.onRun(r));
  }

  // ------------------------------------------------------------- reading
  get(id) {
    return this.jobs.find((j) => j.id === id) || null;
  }

  must(id) {
    const j = this.get(id);
    if (!j) throw new Error('That job no longer exists.');
    return j;
  }

  // Jobs with live run details merged in, newest first.
  list() {
    return this.jobs.map((j) => this.view(j));
  }

  view(j) {
    const live = (id) => (id ? this.dispatcher.get(id) : null);
    const lead = live(j.leadRun);
    const tasks = j.tasks.map((t) => {
      const r = live(t.runId);
      const running = t.status === 'running' && r;
      return {
        ...t,
        live: running ? { status: r.status, events: (r.events || []).slice(-6), tools: r.tools, started: r.started } : null,
      };
    });
    const counts = {};
    for (const t of j.tasks) counts[t.status] = (counts[t.status] || 0) + 1;
    return {
      ...j,
      tasks,
      counts,
      lead: lead && ['queued', 'running'].includes(lead.status) ? { status: lead.status, events: (lead.events || []).slice(-6), started: lead.started, kind: lead.kind } : null,
    };
  }

  // Needs-you items for the top bar.
  attention() {
    const out = [];
    for (const j of this.jobs) {
      const g = `“${clip(j.goal, 60)}”`;
      if (j.daily && j.status === 'plan-ready') out.push({ kind: 'job', job: j.id, project: j.project, text: `Today's plan for ${j.projectName} is ready for your approval`, at: j.updated });
      else if (j.status === 'plan-ready') out.push({ kind: 'job', job: j.id, project: j.project, text: `The Lead's plan for ${g} is ready for your approval`, at: j.updated });
      else if (j.status === 'paused') out.push({ kind: 'job', job: j.id, project: j.project, text: `A task in ${g} failed. Retry or skip it to carry on`, at: j.updated });
      else if (j.status === 'plan-failed') out.push({ kind: 'job', job: j.id, project: j.project, text: `The Lead could not plan ${g}`, at: j.updated });
      else if (j.status === 'interrupted') out.push({ kind: 'job', job: j.id, project: j.project, text: `${g} was interrupted when HQ stopped`, at: j.updated });
    }
    return out;
  }

  save() {
    try {
      this.jobs = this.jobs.slice(0, KEEP);
      fs.writeFileSync(this.file, JSON.stringify(this.jobs));
    } catch {
      /* best effort */
    }
    this.onChange();
  }

  touch(j) {
    j.updated = now();
  }

  projectOf(j) {
    return { id: j.project, name: j.projectName, cwd: j.cwd };
  }

  agentIds() {
    return new Set(this.getAgents().map((a) => a.id));
  }

  // ------------------------------------------------------------- creating and planning
  create({ goal, project, mode = 'read', parallel = 2, daily = null, planPrompt = null, maxTasks = null }) {
    goal = String(goal || '').trim();
    if (!goal) throw new Error('Tell the Lead what you want done.');
    if (goal.length > 4000) throw new Error('Keep the goal under 4,000 characters.');
    if (mode !== 'read' && mode !== 'edit') throw new Error('Pick Read-only or Can edit files.');
    parallel = Number(parallel);
    if (!Number.isInteger(parallel) || parallel < 1 || parallel > 4) throw new Error('Agents at once must be between 1 and 4.');
    if (!project || typeof project.cwd !== 'string' || !isDir(project.cwd)) throw new Error('That project folder no longer exists on this computer.');
    const j = {
      id: crypto.randomBytes(6).toString('hex'),
      goal, mode, parallel, project: project.id, projectName: project.name, cwd: project.cwd,
      status: 'planning', created: now(), updated: now(), started: null, ended: null,
      leadSession: null, leadRun: null, planSummary: '', planWarnings: [], planError: null, planRaw: null,
      tasks: [], summary: null, summaryError: null, followups: [], followupError: null,
      runs: 0, costUsd: 0, tokens: 0,
    };
    if (daily) {
      j.daily = daily;
      j.planPrompt = clip(String(planPrompt || ''), 60000);
      j.maxTasks = maxTasks;
    }
    this.jobs.unshift(j);
    this.startLead(j, 'lead-plan');
    return j;
  }

  startLead(j, kind) {
    const agents = this.getAgents();
    let prompt;
    let session = j.leadSession;
    if (kind === 'lead-plan') {
      prompt = j.planPrompt || buildPlanPrompt({ goal: j.goal, cwd: j.cwd, agents, allowEdit: j.mode === 'edit', maxTasks: MAX_TASKS });
      session = null;
    } else if (kind === 'lead-followup') {
      const text = j.followups[j.followups.length - 1].text;
      prompt = buildFollowupPrompt({ text, tasks: j.tasks, allowEdit: j.mode === 'edit', maxTasks: MAX_TASKS });
      if (!session) prompt = `${buildPlanPrompt({ goal: j.goal, cwd: j.cwd, agents, allowEdit: j.mode === 'edit' })}\n\n${prompt}`;
    } else {
      prompt = this.hooks.summaryPrompt?.(j) || buildSummaryPrompt({ goal: j.goal, tasks: j.tasks });
    }
    const label = kind === 'lead-plan' ? `Plan: ${j.goal}` : kind === 'lead-followup' ? `Plan more: ${j.followups[j.followups.length - 1].text}` : `Summary: ${j.goal}`;
    this.touch(j);
    try {
      const run = this.dispatcher.createQueued({
        task: clip(label, 300), agent: LEAD_AGENT, project: this.projectOf(j), mode: 'read',
        args: buildLeadArgs({ prompt, session }), job: j.id, kind,
      });
      j.leadRun = run.id;
    } catch (e) {
      j.status = kind === 'lead-summary' ? 'done' : j.tasks.length ? j.prevStatus || 'done' : 'plan-failed';
      if (kind === 'lead-summary') j.summaryError = e.message;
      else j.planError = e.message;
    }
    this.save();
  }

  replan(id) {
    const j = this.must(id);
    if (!['plan-ready', 'plan-failed'].includes(j.status) && !(j.status === 'interrupted' && !j.tasks.some((t) => t.status !== 'waiting'))) {
      throw new Error('The Lead can only re-plan before any task has run.');
    }
    j.tasks = [];
    j.planSummary = '';
    j.planWarnings = [];
    j.planError = null;
    j.planRaw = null;
    j.status = 'planning';
    this.startLead(j, 'lead-plan');
    return j;
  }

  followup(id, text) {
    const j = this.must(id);
    text = String(text || '').trim();
    if (!text) throw new Error('Tell the Lead what else to do.');
    if (text.length > 4000) throw new Error('Keep it under 4,000 characters.');
    if (ACTIVE.has(j.status)) throw new Error('Wait until the Lead and its agents have finished, or stop the job first.');
    if (j.status === 'plan-ready') throw new Error('Approve or discard the current plan first.');
    if (!j.tasks.length) throw new Error('This job has no plan yet. Plan it again instead.');
    j.prevStatus = j.status;
    j.followups.push({ text, at: now() });
    j.followupError = null;
    j.status = 'following';
    this.startLead(j, 'lead-followup');
    return j;
  }

  // ------------------------------------------------------------- editing and approving
  // Replaces the not-yet-started tasks with the person's edited list (order kept). Started tasks are locked.
  applyEdits(j, incoming) {
    if (!Array.isArray(incoming)) throw new Error('The edited plan is not a list of tasks.');
    const locked = j.tasks.filter((t) => t.status !== 'waiting');
    const before = new Map(j.tasks.map((t) => [t.id, t]));
    const plan = validatePlan({ tasks: incoming }, { agents: this.agentIds(), allowEdit: j.mode === 'edit', maxTasks: MAX_TASKS + 4, existing: locked });
    j.tasks = [
      ...locked,
      ...plan.tasks.map((t) => ({ ...this.fresh(t), isNew: before.has(t.id) ? !!before.get(t.id).isNew : true })),
    ];
    j.planWarnings = plan.warnings;
  }

  fresh(t) {
    return { ...t, status: 'waiting', runId: null, result: null, error: null, started: null, ended: null, attempts: 0, costUsd: null, tokens: 0 };
  }

  savePlan(id, tasks) {
    const j = this.must(id);
    if (j.status !== 'plan-ready') throw new Error('Only a plan waiting for approval can be edited.');
    this.applyEdits(j, tasks);
    this.touch(j);
    this.save();
    return j;
  }

  approve(id, { tasks, confirmEdit = false } = {}) {
    const j = this.must(id);
    if (j.status !== 'plan-ready') throw new Error('There is no plan waiting for approval.');
    if (tasks !== undefined) this.applyEdits(j, tasks);
    if (!j.tasks.some((t) => t.status === 'waiting')) throw new Error('The plan has no tasks left to run.');
    const editing = j.tasks.filter((t) => t.status === 'waiting' && t.mode === 'edit');
    if (editing.length && !confirmEdit) {
      throw new Error(`Confirm first: ${editing.length === 1 ? 'one task' : `${editing.length} tasks`} can change files in ${j.cwd}.`);
    }
    for (const t of j.tasks) delete t.isNew;
    j.status = 'running';
    j.started = j.started || now();
    j.ended = null;
    this.touch(j);
    this.advance(j);
    return j;
  }

  // ------------------------------------------------------------- running
  // Starts whatever may start, then settles the job's status.
  advance(j) {
    if (j.status !== 'running' && j.status !== 'paused') {
      this.save();
      return;
    }
    recomputeBlocked(j.tasks);
    const project = this.projectOf(j);
    // Start what may start. A task skipped by a daily cap frees its slot and may release dependents, so go again.
    for (let pass = 0; pass < 50; pass++) {
      const picked = runnable(j.tasks, j.parallel);
      if (!picked.length) break;
      let skipped = false;
      for (const t of picked) {
        const why = this.hooks.canStart?.(j, t);
        if (why) {
          t.status = 'skipped';
          t.error = why;
          t.ended = now();
          skipped = true;
          continue;
        }
        t.status = 'running';
        t.started = now();
        t.ended = null;
        t.error = null;
        t.attempts = (t.attempts || 0) + 1;
        try {
          const prompt = composeTaskPrompt(t, j.tasks, j.goal);
          const prep = this.hooks.prepareTask?.(j, t, prompt) || null;
          const run = this.dispatcher.createQueued({
            task: t.title, agent: t.agent, project: prep?.project || project, mode: t.mode,
            args: prep?.args || buildArgs({ task: prompt, agent: t.agent, mode: t.mode }),
            job: j.id, kind: 'task', taskId: t.id,
          });
          t.runId = run.id;
        } catch (e) {
          t.status = 'failed';
          t.error = e.message;
          t.ended = now();
          recomputeBlocked(j.tasks);
        }
      }
      if (!skipped) break;
      recomputeBlocked(j.tasks);
    }
    const active = j.tasks.some((t) => t.status === 'running');
    const stuck = j.tasks.some((t) => ['blocked', 'failed', 'cancelled', 'interrupted'].includes(t.status));
    const open = j.tasks.some((t) => t.status === 'waiting');
    if (active || open) j.status = 'running';
    else if (stuck) j.status = 'paused';
    else {
      this.summarize(j);
      return;
    }
    this.touch(j);
    this.save();
  }

  // The summary step. A daily hook may write it locally (no Lead run), e.g. when the day's spend cap is used up.
  summarize(j) {
    const local = this.hooks.localSummary?.(j);
    if (typeof local === 'string') {
      j.summary = local;
      j.status = 'done';
      j.ended = now();
      this.touch(j);
      this.save();
      this.hooks.afterSummary?.(j, null);
      return;
    }
    j.status = 'summarizing';
    this.startLead(j, 'lead-summary');
  }

  onRun(r) {
    if (!r.job || this.shuttingDown) return;
    const j = this.get(r.job);
    if (!j) return;
    j.runs = (j.runs || 0) + 1;
    if (typeof r.costUsd === 'number') j.costUsd = (j.costUsd || 0) + r.costUsd;
    j.tokens = (j.tokens || 0) + (r.tokens || 0);
    if (r.kind === 'task') return this.onTask(j, r);
    if (r.sessionId) j.leadSession = r.sessionId;
    if (j.leadRun === r.id) j.leadRun = null;
    this.touch(j);
    if (j.status === 'stopped') return this.save();
    if (r.kind === 'lead-summary') {
      if (r.status === 'done') j.summary = r.result || '';
      else j.summaryError = r.error || 'The Lead could not write the summary.';
      j.status = 'done';
      j.ended = now();
      this.save();
      this.hooks.afterSummary?.(j, r);
      return;
    }
    const followup = r.kind === 'lead-followup';
    const giveUp = (msg) => {
      if (followup) {
        j.status = j.prevStatus || 'done';
        j.followupError = msg;
      } else {
        j.status = 'plan-failed';
        j.planError = msg;
      }
      this.save();
    };
    if (r.status !== 'done') return giveUp(r.status === 'cancelled' ? 'The Lead was cancelled before it finished planning.' : r.error || 'The Lead stopped with an error.');
    let raw = extractJson(r.result);
    if (raw === null) {
      j.planRaw = clip(String(r.result || ''), 2000);
      return giveUp('The Lead answered without a plan in the expected format. Try again, or rephrase the goal.');
    }
    try {
      // Daily plans may come back longer than the daily cap; the daily hook drops what may not run, then trims.
      if (j.daily && Array.isArray(raw?.tasks) && raw.tasks.length > MAX_TASKS) raw = { ...raw, tasks: raw.tasks.slice(0, MAX_TASKS) };
      const plan = validatePlan(raw, { agents: this.agentIds(), allowEdit: j.mode === 'edit', maxTasks: MAX_TASKS, existing: followup ? j.tasks : [] });
      this.hooks.afterPlan?.(j, plan, raw, followup);
      if (!plan.tasks.length) throw new Error('Nothing in the plan can run without you. See the list of things to do yourself.');
      const added = plan.tasks.map((t) => ({ ...this.fresh(t), isNew: true }));
      j.tasks = followup ? [...j.tasks, ...added] : added;
      if (!followup) j.planSummary = plan.summary;
      j.planWarnings = plan.warnings;
      j.planError = null;
      j.planRaw = null;
      j.status = 'plan-ready';
      this.save();
    } catch (e) {
      j.planRaw = clip(String(r.result || ''), 2000);
      giveUp(e.message);
    }
  }

  onTask(j, r) {
    const t = j.tasks.find((x) => x.runId === r.id);
    if (!t) return this.save();
    t.ended = now();
    t.costUsd = typeof r.costUsd === 'number' ? (t.costUsd || 0) + r.costUsd : t.costUsd;
    t.tokens = (t.tokens || 0) + (r.tokens || 0);
    t.durationMs = r.durationMs ?? null;
    if (r.status === 'done') {
      t.status = 'done';
      t.result = r.result || '';
      t.error = null;
    } else if (r.status === 'cancelled') {
      t.status = 'cancelled';
      t.error = 'Cancelled.';
    } else {
      t.status = 'failed';
      t.error = safeLine(r.error || 'The agent stopped with an error.', 300);
    }
    try {
      this.hooks.afterTask?.(j, t, r);
    } catch (e) {
      t.note = safeLine(e.message, 300);
    }
    this.touch(j);
    this.advance(j);
  }

  // ------------------------------------------------------------- per-task and per-job controls
  taskAction(id, taskId, action) {
    const j = this.must(id);
    const t = j.tasks.find((x) => x.id === taskId);
    if (!t) throw new Error('That task is not in this job.');
    if (action === 'cancel') {
      if (t.status === 'running') {
        this.dispatcher.cancel(t.runId);
        return j;
      }
      if (!['waiting', 'blocked'].includes(t.status)) throw new Error('Only a waiting or running task can be cancelled.');
      t.status = 'cancelled';
      t.error = 'Cancelled before it started.';
    } else if (action === 'retry') {
      if (!['failed', 'cancelled', 'interrupted'].includes(t.status)) throw new Error('Only a failed, cancelled or interrupted task can be retried.');
      t.status = 'waiting';
      t.error = null;
      if (['paused', 'stopped', 'interrupted', 'done'].includes(j.status)) j.status = 'running';
    } else if (action === 'skip') {
      if (!['waiting', 'blocked', 'failed', 'cancelled', 'interrupted'].includes(t.status)) throw new Error('This task has already run.');
      t.status = 'skipped';
      t.error = null;
      if (['paused', 'interrupted'].includes(j.status)) j.status = 'running';
    } else {
      throw new Error('Unknown task action.');
    }
    this.touch(j);
    recomputeBlocked(j.tasks);
    this.advance(j);
    return j;
  }

  stop(id) {
    const j = this.must(id);
    if (!ACTIVE.has(j.status) && j.status !== 'paused') throw new Error('This job is not running.');
    const was = j.status;
    j.status = 'stopped';
    if (was === 'planning') j.planError = 'Stopped before the Lead finished planning.';
    this.touch(j);
    this.save();
    const lead = j.leadRun && this.dispatcher.get(j.leadRun);
    if (lead && ['queued', 'running'].includes(lead.status)) this.dispatcher.cancel(lead.id);
    for (const t of j.tasks) {
      const r = t.runId && this.dispatcher.get(t.runId);
      if (t.status === 'running' && r && ['queued', 'running'].includes(r.status)) this.dispatcher.cancel(r.id);
    }
    return j;
  }

  // Picks up an interrupted or stopped job where it left off.
  resume(id) {
    const j = this.must(id);
    if (!['interrupted', 'stopped'].includes(j.status)) throw new Error('Only a stopped or interrupted job can be picked up again.');
    const from = j.interruptedFrom;
    delete j.interruptedFrom;
    if (!j.tasks.length) {
      j.status = 'planning';
      this.startLead(j, 'lead-plan');
      return j;
    }
    if (from === 'following') {
      j.status = 'following';
      this.startLead(j, 'lead-followup');
      return j;
    }
    for (const t of j.tasks) {
      if (['interrupted', 'cancelled'].includes(t.status)) {
        t.status = 'waiting';
        t.error = null;
      }
    }
    if (!j.started) {
      j.status = 'plan-ready';
      this.save();
      return j;
    }
    j.status = 'running';
    this.touch(j);
    this.advance(j);
    return j;
  }

  // Writes the summary now, with failed or skipped tasks reported as such.
  finishNow(id) {
    const j = this.must(id);
    if (!['paused', 'stopped', 'interrupted'].includes(j.status)) throw new Error('Finish is for a job that is paused or stopped.');
    if (!j.tasks.some((t) => t.status === 'done')) throw new Error('No task has finished yet, so there is nothing to summarise.');
    this.summarize(j);
    return j;
  }

  discard(id) {
    const j = this.must(id);
    if (ACTIVE.has(j.status)) throw new Error('Stop the job before removing it.');
    this.jobs = this.jobs.filter((x) => x.id !== id);
    this.save();
    return j;
  }

  stopAll() {
    let n = 0;
    for (const j of this.jobs) {
      if (ACTIVE.has(j.status) || j.status === 'paused') {
        this.stop(j.id);
        n++;
      }
    }
    return n;
  }
}
