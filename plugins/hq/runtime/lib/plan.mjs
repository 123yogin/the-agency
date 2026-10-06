// Ask the Lead: the pure parts. Prompts for the Lead, parsing and repairing its JSON plan, and the
// dependency rules that decide which task may start. No I/O here, so every rule is unit-tested.
import { MODES } from './dispatch.mjs';
import { clip, isPlainObj, redact } from './util.mjs';

export const MAX_TASKS = 8;
const ID_RE = /^[A-Za-z0-9_-]{1,24}$/;
const SESSION_RE = /^[A-Za-z0-9][A-Za-z0-9-]{7,63}$/;
const FINISHED = new Set(['done', 'skipped']);
const STOPPED = new Set(['failed', 'cancelled', 'interrupted']);

// Finds the plan in the Lead's answer: a ```json fence first, then the outermost {...} or [...].
export function extractJson(text) {
  const s = String(text ?? '');
  const tries = [];
  const fence = /```(?:json)?\s*\n([\s\S]*?)```/i.exec(s);
  if (fence) tries.push(fence[1]);
  const pairs = [['{', '}'], ['[', ']']].map(([o, c]) => [s.indexOf(o), s.lastIndexOf(c)]).filter(([a, b]) => a >= 0 && b > a);
  pairs.sort((x, y) => x[0] - y[0]); // whichever bracket opens first is the outer value
  for (const [a, b] of pairs) tries.push(s.slice(a, b + 1));
  for (const t of tries) {
    try {
      return JSON.parse(t);
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

// Returns the first dependency loop as a list of ids (first id repeated at the end), or null.
export function findCycle(tasks) {
  const deps = new Map(tasks.map((t) => [t.id, t.depends_on || []]));
  const state = new Map();
  const stack = [];
  const visit = (id) => {
    state.set(id, 1);
    stack.push(id);
    for (const d of deps.get(id) || []) {
      if (!deps.has(d)) continue;
      if (state.get(d) === 1) return [...stack.slice(stack.indexOf(d)), d];
      if (!state.has(d)) {
        const c = visit(d);
        if (c) return c;
      }
    }
    stack.pop();
    state.set(id, 2);
    return null;
  };
  for (const t of tasks) {
    if (!state.has(t.id)) {
      const c = visit(t.id);
      if (c) return c;
    }
  }
  return null;
}

const str = (v, n) => clip(String(v ?? '').replace(/\s+$/g, '').replace(/^\s+/, ''), n);

// Strict schema with repairs. Throws an Error with a plain-English message when the plan is unusable.
// `existing` holds tasks already in the job (follow-ups may depend on them; new ids must not collide).
export function validatePlan(raw, { agents = new Set(), allowEdit = false, maxTasks = MAX_TASKS, existing = [] } = {}) {
  const list = Array.isArray(raw) ? raw : isPlainObj(raw) && Array.isArray(raw.tasks) ? raw.tasks : null;
  if (!list || !list.length) throw new Error('The plan has no tasks.');
  if (list.length > maxTasks) throw new Error(`The plan has more than ${maxTasks} tasks. Ask for a smaller goal or split it.`);
  const warnings = [];
  const taken = new Set(existing.map((t) => t.id));
  const rename = new Map();
  const out = [];
  let n = existing.length;
  for (const item of list) {
    const t = isPlainObj(item) ? item : {};
    const prompt = str(t.prompt ?? t.instructions ?? t.description, 4000);
    let title = str(t.title ?? t.name, 120);
    if (!title && prompt) title = clip(prompt.split('\n')[0], 120);
    if (!prompt) {
      warnings.push(`Dropped "${title || 'a task'}" because it had no instructions.`);
      continue;
    }
    const want = typeof t.id === 'string' && ID_RE.test(t.id) ? t.id : null;
    let id = want;
    if (!id || taken.has(id)) {
      do id = `t${++n}`; while (taken.has(id));
      if (want) rename.set(want, id);
    }
    taken.add(id);
    let agent = typeof t.agent === 'string' ? t.agent.trim() : '';
    let note = '';
    if (!agents.has(agent)) {
      if (agent && !/^(general|general-purpose|none|auto)$/i.test(agent)) {
        note = `${clip(agent, 60)} is not installed, so a general agent does this.`;
        warnings.push(note);
      }
      agent = 'general-purpose';
    }
    let mode = t.mode === 'edit' ? 'edit' : 'read';
    if (t.mode !== undefined && t.mode !== 'edit' && t.mode !== 'read') warnings.push(`"${title}" asked for an unknown mode, so it is read-only.`);
    if (mode === 'edit' && !allowEdit) mode = 'read';
    out.push({ id, title, prompt, agent, note, mode, depends_on: Array.isArray(t.depends_on) ? t.depends_on.filter((d) => typeof d === 'string') : [], _raw: want });
  }
  if (!out.length) throw new Error('The plan has tasks but no instructions for any of them.');
  const known = new Set([...existing.map((t) => t.id), ...out.map((t) => t.id)]);
  // A reference means the task in this plan that kept that id; failing that, the one renamed away from it
  // (a follow-up reusing an existing id); failing that, an existing task.
  const kept = new Set(out.filter((o) => o._raw && o._raw === o.id).map((o) => o.id));
  for (const t of out) {
    const deps = [];
    for (const d of t.depends_on) {
      const mapped = kept.has(d) ? d : rename.has(d) ? rename.get(d) : d;
      if (mapped === t.id) continue;
      if (!known.has(mapped)) {
        warnings.push(`"${t.title}" depended on an unknown task (${clip(d, 24)}), so that link was dropped.`);
        continue;
      }
      if (!deps.includes(mapped)) deps.push(mapped);
    }
    t.depends_on = deps;
    delete t._raw;
  }
  const cycle = findCycle([...existing.map((t) => ({ id: t.id, depends_on: t.depends_on || [] })), ...out]);
  if (cycle) throw new Error(`The plan has a loop: ${cycle.join(' → ')}. A task cannot wait for itself.`);
  const summary = isPlainObj(raw) ? str(raw.summary ?? raw.approach, 400) : '';
  return { summary, tasks: out, warnings };
}

// Tasks that may start now, in plan order, without going over the parallel limit.
export function runnable(tasks, parallel) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  let free = Math.max(1, parallel) - tasks.filter((t) => t.status === 'running').length;
  const out = [];
  for (const t of tasks) {
    if (free <= 0) break;
    if (t.status !== 'waiting') continue;
    if ((t.depends_on || []).every((d) => !byId.has(d) || FINISHED.has(byId.get(d).status))) {
      out.push(t);
      free--;
    }
  }
  return out;
}

// Waiting tasks behind a stopped (failed/cancelled/interrupted) or blocked dependency become blocked, and
// blocked tasks whose dependencies recovered go back to waiting. Mutates and returns the list.
export function recomputeBlocked(tasks) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  let changed = true;
  while (changed) {
    changed = false;
    for (const t of tasks) {
      if (t.status !== 'waiting' && t.status !== 'blocked') continue;
      const stuck = (t.depends_on || []).some((d) => byId.has(d) && (STOPPED.has(byId.get(d).status) || byId.get(d).status === 'blocked'));
      const next = stuck ? 'blocked' : 'waiting';
      if (next !== t.status) {
        t.status = next;
        changed = true;
      }
    }
  }
  return tasks;
}

// The prompt a task actually runs with: its own instructions plus what its dependencies produced.
export function composeTaskPrompt(task, tasks, goal) {
  const deps = (task.depends_on || []).map((d) => tasks.find((t) => t.id === d)).filter(Boolean);
  if (!deps.length) return task.prompt;
  const each = Math.max(300, Math.floor(2400 / deps.length));
  const lines = deps.map((d) => (d.status === 'skipped'
    ? `- ${d.title}: skipped by the user.`
    : `- ${d.title} (${d.agent}): ${clip(redact(String(d.result || 'finished without a written result')).replace(/\s+/g, ' ').trim(), each)}`));
  return `${task.prompt}\n\n---\nContext from earlier steps of this job (overall goal: ${clip(goal, 300)}):\n${lines.join('\n')}`;
}

// Arguments for a Lead run. Planning and summaries never edit files or run shell commands.
export function buildLeadArgs({ prompt, session = null }) {
  const args = ['-p', prompt];
  if (session !== null && session !== undefined) {
    if (!SESSION_RE.test(String(session))) throw new Error('That Lead session id is not valid.');
    args.push('--resume', String(session));
  }
  args.push('--output-format', 'stream-json', '--verbose', ...MODES.read.args);
  return args;
}

const FORMAT = (allowEdit) => `Reply with ONLY one JSON object inside a \`\`\`json fence, in this shape:
{
  "summary": "one sentence on how you will approach the goal",
  "tasks": [
    { "id": "t1", "title": "short title", "prompt": "complete, self-contained instructions for the agent", "agent": "plugin:agent-name or general", "depends_on": [], "mode": "read" }
  ]
}
Rules:
- Use agents from the roster when one fits; otherwise "general".
- Each prompt must stand on its own: the agent sees only its prompt plus short results of the tasks it depends on.
- Add an id to "depends_on" only when a task truly needs that task's result. Independent tasks run in parallel.
- ${allowEdit ? 'Use "mode": "edit" only for tasks that must create or change files; everything else is "read".' : 'This job is read-only: every task uses "mode": "read" and must not try to change files.'}`;

export function buildPlanPrompt({ goal, cwd, agents, allowEdit, maxTasks = MAX_TASKS }) {
  const roster = agents.map((a) => `- ${a.id} — ${clip(String(a.use || a.description || '').replace(/\s+/g, ' '), 170)}`).join('\n') || '- (no specialist agents are installed; use "general")';
  return `You are the Lead of an AI agency. You plan; other agents do the work. The project is the folder ${cwd}.

The user's goal:
${clip(goal, 4000)}

First look at the project as much as you need to plan well (you are read-only). Then break the goal into at most ${maxTasks} tasks for the agents below. Prefer fewer, meaningful tasks over many tiny ones.

Agents you can assign:
${roster}

${FORMAT(allowEdit)}`;
}

export function buildFollowupPrompt({ text, tasks, allowEdit, maxTasks = MAX_TASKS }) {
  const list = tasks.map((t) => `- ${t.id} (${t.status}): ${clip(t.title, 100)}`).join('\n');
  return `The user has more to add to this job:
${clip(text, 4000)}

Tasks already in the job (you may list their ids in "depends_on"):
${list}

Propose ONLY the additional tasks needed (at most ${maxTasks}), using new ids. Same agents and rules as before.

${FORMAT(allowEdit)}`;
}

export function buildSummaryPrompt({ goal, tasks }) {
  const parts = tasks.map((t) => {
    const head = `### ${t.id} ${t.title} (${t.agent}): ${t.status}`;
    const body = t.status === 'done' ? clip(redact(String(t.result || '')), 1500) : t.error ? `Problem: ${clip(t.error, 300)}` : '';
    return body ? `${head}\n${body}` : head;
  });
  return `The work on this goal has finished:
${clip(goal, 1000)}

What each task reported:
${parts.join('\n\n')}

Write the final summary for the user in plain words, with three short sections: What was done, What did not get done (failed or skipped, and why), and Next steps. No JSON, no preamble.`;
}
