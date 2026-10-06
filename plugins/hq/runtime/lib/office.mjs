// Who works on which subagent run, decided from transcript data alone (deterministic across reloads).
//
// Desk assignment (a time-ordered simulation over every "job" = a work segment of a subagent run):
//   1. Jobs sort by start time (then run id, then segment number).
//   2. A staff desk is free if never used or its last job ended >= cooldown before this job starts.
//      The job goes to the FIRST free staff desk in fixed order.
//   3. All staff busy → an extra: lowest free extra slot (spare desks 1–4; slot >= 4 shows as a "+N" card).
//   4. A follow-up segment of the same run keeps the same desk when it is still free.
//   A job ends on: final answer (end_turn), TaskStop from any session, a usage limit, or no activity for
//   running_window (end = last activity + running_window, so other assignments never change retroactively).
// Adapted from humaedihume/kantor-agent runtime/lib/node/office.mjs (MIT, Copyright (c) 2026 humaedihume).
import path from 'node:path';
import { identify } from './departments.mjs';
import { projectsDir } from './paths.mjs';
import { Transcripts } from './transcripts.mjs';
import { cmp, hash, isoMs, strcmp, tsMs } from './util.mjs';

export const DEFAULTS = {
  window_days: 7,
  running_window: 900,
  main_active: 90,
  cooldown: 60,
  spare_desks: 4,
  mains_max: 40,
  staff: 4,
  attention_window: 1800,
  colors: {
    lead: '#1c6e8c',
    staff: ['#3f6fd1', '#2f9a6d', '#d9772f', '#c2417a'],
    extras: ['#0f8fa3', '#9a7418', '#4f7d3a', '#8a4fa8', '#3d7f9e', '#b8452f'],
  },
};

// Dispatched runs (from HQ's own Dispatch tab) join the simulation as if they were subagent runs.
function dispatchAsRuns(dispatchRuns) {
  return (dispatchRuns || []).filter((d) => d.started && ['running', 'done', 'failed', 'cancelled'].includes(d.status)).map((d) => ({
    id: `hq-${d.id}`,
    session: null,
    agentType: d.agent && d.agent !== 'auto' ? d.agent : 'general-purpose',
    description: d.task,
    segs: [[d.started, d.status === 'running' ? null : d.ended || d.updated || d.started]],
    events: d.events || [],
    tools: d.tools || 0,
    tokens: d.tokens || 0,
    lastKind: d.status === 'running' ? 'tool' : 'final',
    limit: null,
    files: [],
    stops: [],
    started: d.started,
    updated: d.updated || d.started,
    parentAgent: null,
    dispatched: true,
    dispatchStatus: d.status,
    fromJob: !!d.job || String(d.kind || '').startsWith('daily'), // the daily backlog run belongs to the Lead too
  }));
}

export function buildState({ project, cacheDir = null, cfg = DEFAULTS, now, dispatchRuns = [] }) {
  const nowSec = Math.floor(now / 1000);
  const root = path.join(projectsDir(), project.id);
  const scan = new Transcripts({ root, cwd: project.cwd, cacheDir, cfg }).scan(nowSec);
  const RW = cfg.running_window * 1000;
  const CD = cfg.cooldown * 1000;
  const MA = cfg.main_active * 1000;

  const mine = (dispatchRuns || []).filter((d) => d.project === project.id);
  const dispatchSessions = new Set(mine.map((d) => d.sessionId).filter(Boolean));
  const mainsAll = scan.mains.filter((m) => !dispatchSessions.has(m.session));

  // TaskStop from any transcript: agent id → stop times (ms)
  const stops = new Map();
  for (const src of [...mainsAll, ...scan.runs]) {
    for (const [id, t] of src.stops) {
      if (!stops.has(id)) stops.set(id, []);
      stops.get(id).push(tsMs(t));
    }
  }

  const runs = [...scan.runs, ...dispatchAsRuns(mine)].sort((a, b) => cmp(tsMs(a.started), tsMs(b.started)) || strcmp(a.id, b.id));
  const byId = new Map();
  for (const r of runs) {
    const segs = r.segs.map(([a, b]) => ({ start: tsMs(a), startIso: a, end: b === null ? null : tsMs(b), endIso: b }));
    let status = r.limit ? 'limit' : 'done';
    let reason = null;
    const last = segs[segs.length - 1];
    if (r.dispatched) {
      status = r.dispatchStatus === 'running' ? 'working' : r.dispatchStatus === 'done' ? 'done' : 'stopped';
      if (r.dispatchStatus === 'cancelled') reason = 'cancelled';
      if (r.dispatchStatus === 'failed') reason = 'failed';
    } else if (last.end === null) {
      const st = (stops.get(r.id) ?? []).filter((ms) => ms >= last.start);
      const upd = tsMs(r.updated);
      if (st.length) {
        last.end = Math.min(...st);
        status = 'stopped';
        reason = 'stopped';
      } else if (r.lastKind === 'handback' || r.limit) {
        last.end = upd;
        status = r.limit ? 'limit' : 'done';
      } else if (now - upd <= RW) {
        status = 'working';
      } else {
        last.end = upd + RW;
        status = 'stopped';
        reason = 'inactive';
      }
      if (last.end !== null) last.endIso = isoMs(last.end);
    }
    r.effSegs = segs;
    r.status = status;
    r.reason = reason;
    r.who = identify(r.agentType);
    byId.set(r.id, r);
  }

  // ---- desk simulation
  const jobs = [];
  for (const r of runs) r.effSegs.forEach((sg, k) => jobs.push({ run: r, k, ...sg, who: null }));
  jobs.sort((a, b) => cmp(a.start, b.start) || strcmp(a.run.id, b.run.id) || cmp(a.k, b.k));
  const pool = Array.from({ length: cfg.staff }, () => ({ job: null }));
  const fl = [];
  const charOf = new Map();
  const free = (slot, start) => slot.job === null || (slot.job.end !== null && slot.job.end + CD <= start);
  for (const job of jobs) {
    const prev = charOf.get(job.run.id) ?? null;
    let pick = null;
    if (job.k > 0 && prev !== null) {
      const slot = prev.kind === 'pool' ? pool[prev.idx] : fl[prev.idx];
      if ((slot.job !== null && slot.job.run === job.run) || free(slot, job.start)) pick = prev;
    }
    if (pick === null) {
      const i = pool.findIndex((s) => free(s, job.start));
      if (i >= 0) pick = { kind: 'pool', idx: i };
    }
    if (pick === null) {
      let j = fl.findIndex((s) => free(s, job.start));
      if (j < 0) {
        j = fl.length;
        fl.push({ job: null });
      }
      pick = { kind: 'fl', idx: j };
    }
    if (pick.kind === 'pool') pool[pick.idx].job = job;
    else fl[pick.idx].job = job;
    job.who = pick;
    charOf.set(job.run.id, pick);
  }

  const leadColor = cfg.colors.lead;
  const extraColor = (runId) => cfg.colors.extras[hash(runId) % cfg.colors.extras.length];
  // who = desk slot; label = the agent it is working as
  const charInfo = (slot, run) => {
    const key = slot.kind === 'pool' ? `staff-${slot.idx}` : `extra-${run.id}`;
    const look = slot.kind === 'pool' ? cfg.colors.staff[slot.idx % cfg.colors.staff.length] : extraColor(run.id);
    return { key, name: run.who.agent, label: run.who.agent, department: run.who.department, plugin: run.who.plugin, color: run.who.color, look };
  };
  const jobState = (job) => (job.end === null ? 'working' : now - job.end < CD ? 'done' : 'idle');
  const task = (r) => (r.description !== '' ? r.description : r.who.agent);
  const runOut = (job) => {
    const r = job.run;
    const lastJob = r.effSegs.length - 1 === job.k;
    return {
      id: r.id,
      agent_type: r.agentType,
      agent: r.who.agent,
      plugin: r.who.plugin,
      department: r.who.department,
      color: r.who.color,
      dispatched: !!r.dispatched,
      fromJob: !!r.fromJob,
      task: task(r),
      status: lastJob ? r.status : 'done',
      reason: lastJob ? r.reason : null,
      segment: job.k + 1,
      started: job.startIso,
      ended: job.end === null ? null : job.endIso,
      updated: r.updated,
      last: [...r.events].reverse().slice(0, 8),
      files: r.files.slice(-6),
      tools: r.tools,
      tokens: r.tokens,
    };
  };

  const staff = pool.map((slot, i) => {
    const look = cfg.colors.staff[i % cfg.colors.staff.length];
    if (!slot.job) return { key: `staff-${i}`, kind: 'staff', slot: i, desk: i, state: 'idle', name: 'Free', label: 'Free', department: '', plugin: '', color: look, look, run: null };
    const info = charInfo({ kind: 'pool', idx: i }, slot.job.run);
    const st = jobState(slot.job);
    return { ...info, kind: 'staff', slot: i, desk: i, state: st, run: runOut(slot.job) };
  });
  const extras = [];
  fl.forEach((slot, j) => {
    if (slot.job === null) return;
    const st = jobState(slot.job);
    if (st === 'idle') return;
    const info = charInfo({ kind: 'fl', idx: j }, slot.job.run);
    extras.push({ ...info, kind: 'extra', slot: j, desk: j < cfg.spare_desks ? j : null, state: st, run: runOut(slot.job) });
  });

  // ---- the Lead (main session). Its answer text is never shown, only tool actions and "new instruction" markers.
  const kids = new Map();
  for (const r of runs) if (r.status === 'working' && r.session) kids.set(r.session, (kids.get(r.session) ?? 0) + 1);
  const mains = mainsAll.filter((m) => m.updated !== null)
    .sort((a, b) => cmp(tsMs(b.updated), tsMs(a.updated)) || strcmp(a.session, b.session));
  const mainState = (m) => {
    const age = now - tsMs(m.updated);
    const k = kids.get(m.session) ?? 0;
    if (m.lastKind !== 'final' && !(m.lastKind === 'tool' && m.lastTool === 'AskUserQuestion') && age <= MA) return ['working', 'active'];
    if (m.lastKind === 'tool' && m.lastTool !== 'AskUserQuestion' && age <= RW) return ['working', 'tool'];
    if (k > 0) return ['working', 'waiting-team'];
    if (m.lastKind === 'final' && age < CD) return ['done', null];
    return ['idle', null];
  };
  const states = mains.map(mainState);
  let di = states.findIndex((s) => s[0] === 'working');
  if (di < 0) di = mains.length ? 0 : -1;
  const dm = di >= 0 ? mains[di] : null;
  const activeMains = states.filter((s) => s[0] === 'working').length;
  const lead = {
    key: 'lead', name: 'Lead', label: 'Lead', role: 'Main session', kind: 'lead', color: leadColor,
    state: dm ? states[di][0] : 'idle',
    activity: dm ? states[di][1] : null,
    session: dm ? dm.session.slice(0, 8) : null,
    updated: dm ? dm.updated : null,
    last: dm ? [...dm.events].reverse().filter((e) => e.kind !== 'text' && e.tool !== 'Agent' && e.tool !== 'Task').slice(0, 8) : [],
    tools: dm ? dm.tools : 0,
    tokens: dm ? dm.tokens : 0,
    waiting_on: dm ? kids.get(dm.session) ?? 0 : 0,
    other_sessions: Math.max(0, activeMains - (dm && states[di][0] === 'working' ? 1 : 0)),
    sessions: mains.length,
    todos: dm && dm.todos !== null ? { items: dm.todos, at: dm.todosAt, source: dm.todoSource } : null,
  };

  // ---- needs-you signals for this project
  const attention = [];
  if (dm && !dm.headless && lead.state !== 'working') {
    const age = now - tsMs(dm.updated);
    if (dm.lastKind === 'tool' && dm.lastTool === 'AskUserQuestion' && age <= cfg.attention_window * 4000) {
      attention.push({ kind: 'question', project: project.id, text: `Claude asked you a question in ${project.name}`, at: dm.updated });
    } else if (dm.lastKind === 'final' && age <= cfg.attention_window * 1000) {
      attention.push({ kind: 'your-turn', project: project.id, text: `Claude finished in ${project.name} and is waiting for you`, at: dm.updated });
    }
  }

  // ---- activity feed
  const L = { key: 'lead', label: 'Lead', color: leadColor };
  const feed = [];
  const add = (t, ms, who, kind, text, tool) => feed.push({ ms, e: { t, who: who.key, name: who.label, color: who.color, kind, text, tool } });
  for (const m of mains) {
    for (const e of m.events) {
      if (e.kind === 'text' || e.tool === 'Agent' || e.tool === 'Task') continue;
      add(e.t, tsMs(e.t), L, e.kind, e.text, e.tool);
    }
  }
  for (const job of jobs) {
    const r = job.run;
    const who = charInfo(job.who, r);
    if (job.k === 0) {
      const parent = r.parentAgent !== null && byId.has(r.parentAgent) ? byId.get(r.parentAgent) : null;
      const req = r.fromJob ? { key: 'hq', label: 'Lead (HQ)', color: leadColor } : r.dispatched ? { key: 'hq', label: 'You (HQ)', color: leadColor } : parent !== null ? charInfo(charOf.get(parent.id), parent) : L;
      add(job.startIso, job.start, req, 'assign', `${req.label} asked ${who.label}: ${task(r)}`, null);
    } else {
      add(job.startIso, job.start, who, 'resume', `${who.label} picked up again: ${task(r)}`, null);
    }
    if (job.end !== null && job.end <= now) {
      const lastJob = r.effSegs.length - 1 === job.k;
      let text = `${who.label} finished: ${task(r)}`;
      if (lastJob && r.status === 'limit') text = `${who.label} paused at a usage limit`;
      else if (lastJob && (r.reason === 'stopped' || r.reason === 'cancelled')) text = `${who.label} was stopped: ${task(r)}`;
      else if (lastJob && r.reason === 'failed') text = `${who.label} failed: ${task(r)}`;
      else if (lastJob && r.reason === 'inactive') text = `${who.label} stopped after ${Math.round(cfg.running_window / 60)} minutes without activity`;
      add(job.endIso, job.end, who, 'done', text, null);
    }
  }
  const jobsOf = new Map();
  for (const job of jobs) {
    if (!jobsOf.has(job.run.id)) jobsOf.set(job.run.id, []);
    jobsOf.get(job.run.id).push(job);
  }
  for (const r of runs) {
    const js = jobsOf.get(r.id) ?? [];
    for (const e of r.events) {
      const ms = tsMs(e.t);
      let job = js[0];
      for (const j of js) if (j.start <= ms) job = j;
      if (job) add(e.t, ms, charInfo(job.who, r), e.kind, e.text, e.tool);
    }
  }
  // newest first; lifecycle events get their own quota so tool actions cannot push them out
  const order = feed.map((f, i) => [f, i]);
  order.sort((a, b) => cmp(b[0].ms, a[0].ms) || cmp(a[1], b[1]));
  const LIFE = new Set(['assign', 'resume', 'done']);
  const life = order.filter((x) => LIFE.has(x[0].e.kind)).slice(0, 60);
  const acts = order.filter((x) => !LIFE.has(x[0].e.kind)).slice(0, 120);
  const merged = [...life, ...acts].sort((a, b) => cmp(b[0].ms, a[0].ms) || cmp(a[1], b[1]));

  // ---- history and stats
  const hist = [...runs].sort((a, b) => cmp(tsMs(b.started), tsMs(a.started)) || strcmp(a.id, b.id)).slice(0, 40).map((r) => {
    const js = jobsOf.get(r.id);
    const job = js[js.length - 1];
    const who = charInfo(job.who, r);
    return {
      id: r.id, who: who.key, name: who.name, label: who.label, color: who.color, department: r.who.department, plugin: r.who.plugin,
      dispatched: !!r.dispatched, fromJob: !!r.fromJob, agent_type: r.agentType, task: task(r), status: r.status, started: r.started,
      ended: job.end === null ? null : job.endIso, tools: r.tools,
    };
  });
  const recent = runs.filter((r) => now - tsMs(r.started) <= 48 * 3600 * 1000).map((r) => r.started);

  return {
    app: 'agency-hq',
    now: isoMs(now),
    project: { id: project.id, name: project.name, cwd: project.cwd },
    transcripts: scan.exists,
    lead,
    staff,
    extras,
    feed: merged.map((x) => x[0].e),
    runs: hist,
    attention,
    stats: {
      active: runs.filter((r) => r.status === 'working').length,
      extras: extras.filter((f) => f.state === 'working').length,
      total: runs.length,
      recent_starts: recent,
      sessions_active: activeMains,
    },
    spare_desks: cfg.spare_desks,
  };
}
