// Daily plan: once a day the Lead holds a read-only standup for a project and proposes today's plan.
// Nothing runs until the person approves that plan (it becomes an Ask the Lead job). In the evening, or when
// the job finishes, the Lead writes a read-only report and updates the project's backlog.
//
// Hard limits, enforced here and not left to the model:
// - The only scheduled runs are the read-only standup and the read-only report.
// - Planned tasks that would deploy, push, merge, post, send or spend are never runnable (denyReason).
// - Every daily task runs with git push/merge, gh, Vercel and publish commands blocked (DAILY_BLOCKED_TOOLS).
// - Code changes run in their own git worktree on a local daily/<date>-<slug> branch and are committed locally.
//   Pushing and opening a PR happen only when the person clicks Open PR, after seeing the exact commands.
// - Daily caps on task runs and spend. No autostart: the schedule only runs while HQ runs.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { buildLeadArgs, extractJson } from './plan.mjs';
import { clip, isDir, isPlainObj, readJson, redact, safeLine } from './util.mjs';

const KEEP_DAYS = 30;
const KEEP_BACKLOG = 200;
const HM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const DEFAULTS = { enabled: false, standupAt: '09:00', wrapAt: '18:00', focus: '', maxTasks: 3, maxUsd: 5 };

// Rules added to every daily agent run, read or edit. --disallowedTools beats the user's allow-list.
export const DAILY_BLOCKED_TOOLS = [
  'Bash(git push:*)', 'Bash(git merge:*)', 'Bash(git remote:*)', 'Bash(git rebase:*)', 'Bash(git reset:*)',
  'Bash(gh:*)', 'Bash(vercel:*)', 'Bash(npm publish:*)', 'Bash(pnpm publish:*)', 'Bash(yarn publish:*)',
  'Bash(curl:*)', 'Bash(wget:*)',
  // test scripts that hit live systems (e.g. Cross Off's test:prod:smoke) or deploy
  'Bash(npm run test:prod:*)', 'Bash(npm run deploy:*)', 'Bash(npm run release:*)',
];
const READ_BLOCKED = ['Edit', 'Write', 'NotebookEdit', 'MultiEdit', 'Bash'];
// Code tasks may run the project's tests and look at git, inside their own worktree. Headless runs cannot ask
// for permission, so without this an agent cannot check its own fix (found in the first real run).
export const DAILY_TEST_TOOLS = [
  'Bash(node --test:*)', 'Bash(npm test:*)', 'Bash(npm run test:*)', 'Bash(pnpm test:*)', 'Bash(yarn test:*)', 'Bash(npx vitest run:*)', 'Bash(npx jest:*)',
  'Bash(pytest:*)', 'Bash(python -m pytest:*)', 'Bash(python3 -m pytest:*)', 'Bash(go test:*)', 'Bash(cargo test:*)',
  'Bash(git status:*)', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(git show:*)',
];

export function dailyArgs({ prompt, agent, mode }) {
  const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose'];
  if (agent && agent !== 'auto' && agent !== 'general-purpose') args.push('--agent', agent);
  if (mode === 'edit') args.push('--permission-mode', 'acceptEdits', '--allowedTools', DAILY_TEST_TOOLS.join(','), '--disallowedTools', DAILY_BLOCKED_TOOLS.join(','));
  else args.push('--permission-mode', 'default', '--disallowedTools', [...READ_BLOCKED, ...DAILY_BLOCKED_TOOLS].join(','));
  return args;
}

// ------------------------------------------------------------------ time (local wall clock)
const pad = (n) => String(n).padStart(2, '0');
export function localDay(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const minutesOf = (ms) => {
  const d = new Date(ms);
  return d.getHours() * 60 + d.getMinutes();
};
export function parseHm(s) {
  const m = HM_RE.exec(String(s || ''));
  if (!m) throw new Error('Use a time like 09:00 (24-hour clock).');
  return Number(m[1]) * 60 + Number(m[2]);
}
export function standupDue(p, nowMs) {
  if (!p.enabled) return false;
  if (p.lastStandupDay === localDay(nowMs)) return false;
  return minutesOf(nowMs) >= parseHm(p.standupAt || DEFAULTS.standupAt);
}
export function wrapDue(p, nowMs) {
  const day = localDay(nowMs);
  if (p.lastStandupDay !== day || p.lastWrapDay === day) return false;
  return minutesOf(nowMs) >= parseHm(p.wrapAt || DEFAULTS.wrapAt);
}

// ------------------------------------------------------------------ policy
const DENY = [
  [/\bgit\s+push\b/i, 'it pushes to a remote'],
  [/\bgh\s+pr\s+(merge|create)\b/i, 'it opens or merges a pull request (use Open PR in HQ instead)'],
  [/\bgh\s+release\b/i, 'it publishes a release'],
  [/\bvercel\s+(deploy|--prod|promote|rollback|alias|env|remove|rm)\b|\bvercel\b[^.\n]{0,25}\b(deploy|production|--prod)\b/i, 'it deploys on Vercel'],
  [/--prod(uction)?\b/i, 'it uses a production flag'],
  [/\b(npm|pnpm|yarn)\s+publish\b/i, 'it publishes a package'],
  [/\bgit\s+merge\b|\bmerge\b[^.\n]{0,35}\b(into|to)\s+(the\s+)?(main|master|production|prod)\b/i, 'it merges into the main branch'],
  [/\b(deploy|ship|release|publish|promote|roll\s?back)(s|ed|ing)?\b[^.\n]{0,40}\b(to\s+)?(prod|production|the live site|live|app store|play store|vercel|netlify|heroku|fly\.io)\b/i, 'it deploys or releases'],
  [/\b(post|publish|submit|tweet|share|announce)(s|ed|ing)?\b[^.\n]{0,30}\b(to|on|in)\b[^.\n]{0,20}\b(reddit|twitter|x\.com|linkedin|hacker\s?news|product\s?hunt|slack|discord|facebook|instagram|tiktok|youtube)\b/i, 'it posts publicly'],
  [/\bsend(s|ing)?\b[^.\n]{0,25}\b(e-?mails?|newsletters?|messages?|dms?|sms|texts?|invoices?)\b/i, 'it sends messages to people'],
  [/\b(buy|purchase|pay for|subscribe to|upgrade (the |our )?(plan|subscription))\b/i, 'it spends money'],
  [/\b(change|update|set|rotate|delete|remove)\b[^.\n]{0,30}\b(env(ironment)?\s+var(iable)?s?|secrets?|api\s+keys?|dns|billing|production settings)\b/i, 'it changes secrets or settings'],
];
export function denyReason(task) {
  const text = `${task?.title || ''}\n${task?.prompt || ''}`;
  for (const [re, why] of DENY) if (re.test(text)) return why;
  return null;
}

export function slug(s) {
  const x = String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, '');
  return x || 'task';
}

// ------------------------------------------------------------------ default command runner
function defaultExec(cmd, args, { cwd, timeout = 30000 } = {}) {
  try {
    return { ok: true, out: execFileSync(cmd, args, { cwd, encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GH_PROMPT_DISABLED: '1' } }) };
  } catch (e) {
    return { ok: false, out: String(e.stderr || e.stdout || e.message || '') };
  }
}

const isoNow = () => new Date().toISOString();
const newId = () => crypto.randomBytes(6).toString('hex');

export class Daily {
  constructor({ dataDir, lead, dispatcher, exec = defaultExec, now = () => Date.now(), findProject, getAgents = () => [], onChange = () => {} }) {
    this.dataDir = dataDir;
    this.file = path.join(dataDir, 'daily.json');
    this.worktrees = path.join(dataDir, 'worktrees');
    this.lead = lead;
    this.dispatcher = dispatcher;
    this.exec = exec;
    this.now = now;
    this.findProject = findProject;
    this.getAgents = getAgents;
    this.onChange = onChange;
    const saved = readJson(this.file, null);
    this.state = isPlainObj(saved) ? saved : {};
    this.state.paused = this.state.paused === true;
    if (!isPlainObj(this.state.projects)) this.state.projects = {};
    lead.hooks = this.hooks();
    dispatcher.finishHooks.push((r) => this.onRun(r));
  }

  save() {
    try {
      fs.writeFileSync(this.file, JSON.stringify(this.state));
    } catch {
      /* best effort */
    }
    this.onChange();
  }

  // ------------------------------------------------------------- settings
  cfg(id) {
    const p = this.state.projects[id];
    if (!p) throw new Error('That project has no daily plan yet.');
    return p;
  }

  update(id, patch = {}) {
    const project = this.findProject(id);
    let p = this.state.projects[id];
    if (!p) {
      if (!project) throw new Error('Pick a project from the list.');
      p = this.state.projects[id] = { ...DEFAULTS, id, backlog: [], days: [], branches: [], seeded: false, seedRun: null, lastStandupDay: null, lastWrapDay: null, seedCost: {} };
    }
    if (project) {
      p.name = project.name;
      p.cwd = project.cwd;
    }
    const next = { ...p };
    if (patch.standupAt !== undefined) { parseHm(patch.standupAt); next.standupAt = patch.standupAt; }
    if (patch.wrapAt !== undefined) { parseHm(patch.wrapAt); next.wrapAt = patch.wrapAt; }
    if (patch.focus !== undefined) {
      const f = String(patch.focus).trim();
      if (f.length > 1000) throw new Error('Keep the focus under 1,000 characters.');
      next.focus = f;
    }
    if (patch.maxTasks !== undefined) {
      const n = Number(patch.maxTasks);
      if (!Number.isInteger(n) || n < 1 || n > 8) throw new Error('Tasks per day must be between 1 and 8.');
      next.maxTasks = n;
    }
    if (patch.maxUsd !== undefined) {
      const n = Number(patch.maxUsd);
      if (!Number.isFinite(n) || n < 0.5 || n > 100) throw new Error('The daily spend limit must be between $0.50 and $100.');
      next.maxUsd = Math.round(n * 100) / 100;
    }
    if (patch.enabled !== undefined) next.enabled = patch.enabled === true;
    if (next.enabled && (!next.cwd || !isDir(next.cwd))) throw new Error('That project folder no longer exists on this computer.');
    Object.assign(p, next);
    this.save();
    if (p.enabled && !p.seeded && !p.seedRun && patch.seed !== false && patch.enabled === true) this.seed(p);
    return this.view(id);
  }

  setPaused(on) {
    this.state.paused = !!on;
    this.save();
  }

  setBacklog(id, items) {
    const p = this.cfg(id);
    if (!Array.isArray(items)) throw new Error('The backlog must be a list.');
    const old = new Map(p.backlog.map((b) => [b.id, b]));
    const out = [];
    for (const it of items.slice(0, KEEP_BACKLOG)) {
      if (!isPlainObj(it)) continue;
      const title = clip(String(it.title || '').trim(), 200);
      if (!title) continue;
      const prev = typeof it.id === 'string' ? old.get(it.id) : null;
      const status = it.status === 'done' ? 'done' : 'open';
      out.push({
        id: prev ? prev.id : newId(), title, detail: clip(String(it.detail || '').trim(), 1000), status,
        added: prev?.added || isoNow(), doneAt: status === 'done' ? prev?.doneAt || isoNow() : null, source: prev?.source || 'you',
      });
    }
    p.backlog = out;
    this.save();
    return p.backlog;
  }

  markSeen(id) {
    const p = this.cfg(id);
    for (const d of p.days) d.reportSeen = true;
    this.save();
  }

  // ------------------------------------------------------------- reading
  spentToday(p, day = localDay(this.now())) {
    const d = p.days.find((x) => x.day === day);
    const j = d?.jobId ? this.lead.get(d.jobId) : null;
    return (j?.costUsd || 0) + (p.seedCost?.[day] || 0);
  }

  view(id) {
    const p = this.cfg(id);
    const day = localDay(this.now());
    const days = p.days.map((d) => {
      const j = d.jobId ? this.lead.get(d.jobId) : null;
      return { ...d, status: j ? j.status : d.status || 'gone', costUsd: j ? j.costUsd || 0 : d.costUsd || 0, runs: j?.runs || 0, tasks: j ? j.tasks.length : 0, done: j ? j.tasks.filter((t) => t.status === 'done').length : 0 };
    });
    const seedRun = p.seedRun ? this.dispatcher.get(p.seedRun) : null;
    return {
      id: p.id, name: p.name, cwd: p.cwd, enabled: p.enabled,
      config: { standupAt: p.standupAt, wrapAt: p.wrapAt, focus: p.focus, maxTasks: p.maxTasks, maxUsd: p.maxUsd },
      lastStandupDay: p.lastStandupDay, lastWrapDay: p.lastWrapDay,
      seeding: !!(seedRun && ['queued', 'running'].includes(seedRun.status)), seeded: p.seeded, seedError: p.seedError || null,
      backlog: p.backlog, branches: p.branches.slice(0, 40),
      today: days.find((d) => d.day === day) || null,
      days: days.slice(0, KEEP_DAYS),
      spentToday: this.spentToday(p, day),
    };
  }

  // The day record behind a daily job (standup note, notes for the owner, report), for the job page.
  dayFor(jobId) {
    for (const p of Object.values(this.state.projects)) {
      const d = p.days.find((x) => x.jobId === jobId);
      if (d) return { day: d.day, standup: d.standup, notes: d.notes || [], summary: d.summary, project: p.id };
    }
    return null;
  }

  list() {
    return { paused: this.state.paused, projects: Object.keys(this.state.projects).map((id) => this.view(id)) };
  }

  attention() {
    const out = [];
    for (const p of Object.values(this.state.projects)) {
      for (const d of p.days.slice(0, 3)) {
        if (d.summary && !d.reportSeen) out.push({ kind: 'daily', project: p.id, text: `Daily report for ${p.name} (${d.day}) is ready`, at: d.reportAt || d.started });
      }
      const ready = p.branches.filter((b) => b.status === 'ready').length;
      if (ready) out.push({ kind: 'daily-branch', project: p.id, text: `${ready} branch${ready === 1 ? '' : 'es'} from the daily plan in ${p.name} ${ready === 1 ? 'is' : 'are'} ready for a PR`, at: p.branches.find((b) => b.status === 'ready').created });
    }
    return out;
  }

  // ------------------------------------------------------------- schedule
  tick(nowMs = this.now()) {
    if (this.state.paused) return;
    for (const p of Object.values(this.state.projects)) {
      try {
        if (standupDue(p, nowMs)) this.standup(p, nowMs);
        else if (wrapDue(p, nowMs)) this.wrap(p, nowMs);
      } catch (e) {
        p.lastError = safeLine(e.message, 300);
        this.save();
      }
    }
  }

  runNow(id) {
    const p = this.cfg(id);
    if (!p.enabled) throw new Error('Turn the daily plan on for this project first.');
    const day = localDay(this.now());
    const d = p.days.find((x) => x.day === day);
    const j = d?.jobId ? this.lead.get(d.jobId) : null;
    if (j && ['planning', 'running', 'summarizing', 'following'].includes(j.status)) throw new Error("Today's standup is already under way.");
    if (j && j.status !== 'plan-failed' && j.status !== 'stopped') throw new Error("Today already has a plan. Open it, or remove it to plan the day again.");
    return this.standup(p, this.now());
  }

  // ------------------------------------------------------------- git helpers
  git(cwd, ...args) {
    return this.exec('git', args, { cwd });
  }

  repoState(cwd) {
    const inside = this.git(cwd, 'rev-parse', '--is-inside-work-tree');
    if (!inside.ok || inside.out.trim() !== 'true') return { git: false, why: 'This folder is not a git repository, so code changes cannot be put on a branch.' };
    const st = this.git(cwd, 'status', '--porcelain');
    if (!st.ok) return { git: true, clean: false, why: 'git status failed in this folder.' };
    if (st.out.trim()) return { git: true, clean: false, why: 'The project has uncommitted changes. Commit or stash them, and code tasks can run tomorrow (or plan again).' };
    const head = this.git(cwd, 'rev-parse', '--abbrev-ref', 'HEAD');
    return { git: true, clean: true, branch: head.ok ? head.out.trim() : 'HEAD' };
  }

  context(p, nowMs) {
    const lines = [];
    const rs = this.repoState(p.cwd);
    if (!rs.git) lines.push(`Repository: ${rs.why}`);
    else {
      const since = p.lastStandupAt || new Date(nowMs - 7 * 86400000).toISOString();
      const log = this.git(p.cwd, 'log', `--since=${since}`, '-n', '30', '--date=short', '--pretty=format:%h %ad %s');
      lines.push(`Commits since the last standup:\n${log.ok && log.out.trim() ? log.out.trim().split('\n').map((l) => `- ${clip(redact(l), 160)}`).join('\n') : '- none'}`);
      if (!rs.clean) lines.push(`Note: ${rs.why}`);
      const remote = this.git(p.cwd, 'remote');
      if (remote.ok && remote.out.trim()) {
        const prs = this.exec('gh', ['pr', 'list', '--state', 'open', '--limit', '10', '--json', 'number,title'], { cwd: p.cwd, timeout: 15000 });
        const issues = this.exec('gh', ['issue', 'list', '--state', 'open', '--limit', '10', '--json', 'number,title'], { cwd: p.cwd, timeout: 15000 });
        const fmt = (r, label) => {
          if (!r.ok) return null;
          try {
            const arr = JSON.parse(r.out);
            return `${label}:\n${arr.length ? arr.map((x) => `- #${x.number} ${clip(redact(String(x.title)), 140)}`).join('\n') : '- none'}`;
          } catch {
            return null;
          }
        };
        const a = fmt(prs, 'Open pull requests');
        const b = fmt(issues, 'Open issues');
        if (a) lines.push(a);
        if (b) lines.push(b);
      }
    }
    return lines.join('\n\n');
  }

  // ------------------------------------------------------------- standup
  standupPrompt(p, nowMs) {
    const agents = this.getAgents();
    const roster = agents.map((a) => `- ${a.id} — ${clip(String(a.use || a.description || '').replace(/\s+/g, ' '), 170)}`).join('\n') || '- (no specialist agents are installed; use "general")';
    const open = p.backlog.filter((b) => b.status === 'open');
    const prev = p.days.find((d) => d.day !== localDay(nowMs) && (d.summary || d.standup));
    return `You are the Lead of an AI agency and this is the daily standup for the project in ${p.cwd}. You are read-only: you may read and search files but not change anything.

Focus set by the owner: ${p.focus ? clip(p.focus, 1000) : '(none set; use the backlog and the project docs)'}

Backlog (open items):
${open.length ? open.slice(0, 40).map((b) => `- ${clip(b.title, 160)}${b.detail ? ` — ${clip(b.detail, 200)}` : ''}`).join('\n') : '- (empty)'}

Yesterday's report:
${prev ? clip(redact(String(prev.summary || `Standup only. Today was: ${prev.standup?.today || ''}`)), 2500) : '(no earlier day)'}

${this.context(p, nowMs)}

Agents you can assign:
${roster}

Policy (HQ enforces this; plan within it):
- Agents never deploy, never push, never merge, never open pull requests, never post publicly, never send messages, never spend money, never change secrets or settings. Do not plan tasks that do. If something like that is needed, list it under "yourself" for the owner.
- Code changes are allowed only as "mode": "edit" tasks. Each runs on its own local branch, may edit files and run the project's tests (node --test, npm test, pytest, go test, cargo test) and read-only git, and is committed locally by HQ; the owner decides whether to open a PR. Put the fix and its test in the same edit task.
- "read" tasks can only read and search files (no shell). A read task that depends on an edit task runs inside that task's branch and is given its diff, so reviews of a change should depend on it.
- At most ${p.maxTasks} tasks today. Prefer the few most valuable ones. Each prompt must stand on its own.

Write the standup and today's plan. Reply with ONLY one JSON object inside a \`\`\`json fence:
{
  "standup": { "yesterday": "what happened", "today": "what matters today and why", "blockers": "what is in the way, or None" },
  "summary": "one sentence on today's approach",
  "tasks": [ { "id": "t1", "title": "short title", "prompt": "complete instructions for the agent", "agent": "plugin:agent-name or general", "depends_on": [], "mode": "read" } ],
  "yourself": [ { "title": "something only the owner can do", "why": "one line" } ]
}`;
  }

  standup(p, nowMs) {
    const project = this.findProject(p.id) || { id: p.id, name: p.name, cwd: p.cwd };
    const day = localDay(nowMs);
    p.lastStandupDay = day;
    p.lastStandupAt = new Date(nowMs).toISOString();
    p.lastError = null;
    const job = this.lead.create({
      goal: `Daily plan for ${p.name} (${day})`, project, mode: 'edit', parallel: 2,
      daily: { project: p.id, day }, planPrompt: this.standupPrompt(p, nowMs), maxTasks: p.maxTasks,
    });
    p.days = [{ day, jobId: job.id, started: isoNow(), standup: null, notes: [], summary: null, reportSeen: false }, ...p.days.filter((d) => d.day !== day)].slice(0, KEEP_DAYS);
    this.save();
    return job;
  }

  wrap(p, nowMs) {
    const day = localDay(nowMs);
    const d = p.days.find((x) => x.day === day);
    const j = d?.jobId ? this.lead.get(d.jobId) : null;
    if (!d || !j) {
      p.lastWrapDay = day;
      return this.save();
    }
    if (['planning', 'following', 'running', 'summarizing'].includes(j.status)) return; // the report comes when it finishes
    p.lastWrapDay = day;
    if (j.status === 'done') return this.save();
    if (['paused', 'stopped', 'interrupted'].includes(j.status) && j.tasks.some((t) => t.status === 'done')) {
      this.save();
      this.lead.finishNow(j.id);
      return;
    }
    const why = j.status === 'plan-ready' ? "Today's plan was not approved, so nothing ran." : j.status === 'plan-failed' ? `The Lead could not make today's plan: ${j.planError || 'no usable plan'}.` : 'No task finished today.';
    this.record(p, d, `${why}\n\nThe backlog is unchanged.`, null);
  }

  record(p, d, text, backlog) {
    d.summary = text;
    d.reportAt = isoNow();
    d.reportSeen = false;
    if (backlog) this.applyBacklog(p, backlog);
    this.save();
  }

  applyBacklog(p, b) {
    const norm = (s) => String(s || '').trim().toLowerCase();
    for (const key of Array.isArray(b.done) ? b.done : []) {
      const it = p.backlog.find((x) => x.status === 'open' && (x.id === key || norm(x.title) === norm(key)));
      if (it) {
        it.status = 'done';
        it.doneAt = isoNow();
      }
    }
    for (const a of Array.isArray(b.add) ? b.add.slice(0, 10) : []) {
      const title = clip(String(isPlainObj(a) ? a.title : a || '').trim(), 200);
      if (!title || p.backlog.some((x) => norm(x.title) === norm(title))) continue;
      p.backlog.push({ id: newId(), title, detail: clip(String(isPlainObj(a) ? a.detail || '' : '').trim(), 1000), status: 'open', added: isoNow(), doneAt: null, source: 'lead' });
    }
    p.backlog = p.backlog.slice(-KEEP_BACKLOG);
  }

  // ------------------------------------------------------------- backlog seeding (once, on first enable)
  seed(p) {
    const project = this.findProject(p.id) || { id: p.id, name: p.name, cwd: p.cwd };
    const prompt = `You are the Lead of an AI agency, setting up a backlog for the project in ${p.cwd}. You are read-only.
Read the project's own notes: CLAUDE.md, README (any README*), GROWTH.md and other planning docs at the top level, and search the code for TODO and FIXME comments. From them, list up to 15 concrete, useful work items, most valuable first.
Reply with ONLY one JSON object inside a \`\`\`json fence: {"backlog":[{"title":"short imperative title","detail":"one line: where it came from and why it matters"}]}`;
    const run = this.dispatcher.createQueued({ task: `Build the daily backlog for ${p.name}`, agent: 'hq:lead', project, mode: 'read', args: buildLeadArgs({ prompt }), job: null, kind: 'daily-seed' });
    run.dailyProject = p.id;
    p.seedRun = run.id;
    p.seedError = null;
    this.save();
  }

  onRun(r) {
    if (r.kind !== 'daily-seed') return;
    const p = Object.values(this.state.projects).find((x) => x.seedRun === r.id);
    if (!p) return;
    p.seedRun = null;
    const day = localDay(this.now());
    p.seedCost = { ...(p.seedCost || {}), [day]: ((p.seedCost || {})[day] || 0) + (r.costUsd || 0) };
    if (r.status !== 'done') {
      p.seedError = r.error || 'The Lead could not read the project.';
      return this.save();
    }
    const raw = extractJson(r.result);
    const items = Array.isArray(raw?.backlog) ? raw.backlog : Array.isArray(raw) ? raw : null;
    if (!items) {
      p.seedError = 'The Lead answered without a backlog in the expected format.';
      return this.save();
    }
    p.seeded = true;
    this.applyBacklog(p, { add: items.slice(0, 15) });
    this.save();
  }

  // ------------------------------------------------------------- hooks into the Lead
  hooks() {
    const me = this;
    const proj = (j) => me.state.projects[j.daily?.project];
    const dayOf = (j) => proj(j)?.days.find((d) => d.jobId === j.id);
    return {
      afterPlan(j, plan, raw, followup) {
        const p = proj(j);
        if (!p) return;
        const d = dayOf(j);
        const notes = [];
        if (!followup && isPlainObj(raw)) {
          const st = isPlainObj(raw.standup) ? raw.standup : {};
          if (d) d.standup = { yesterday: clip(String(st.yesterday || ''), 1500), today: clip(String(st.today || ''), 1500), blockers: clip(String(st.blockers || ''), 1000) };
          for (const y of Array.isArray(raw.yourself) ? raw.yourself.slice(0, 10) : []) {
            if (!isPlainObj(y) || !String(y.title || '').trim()) continue;
            notes.push({ kind: 'yourself', title: clip(String(y.title), 160), why: clip(String(y.why || ''), 300) });
          }
        }
        let rs = null;
        plan.tasks = plan.tasks.filter((t) => {
          const why = denyReason(t);
          if (why) {
            notes.push({ kind: 'denied', title: t.title, why: `Not run by an agent because ${why}. Do it yourself if you want it.`, prompt: clip(t.prompt, 600) });
            return false;
          }
          if (t.mode === 'edit') {
            rs ||= me.repoState(j.cwd);
            if (!rs.git || !rs.clean) {
              notes.push({ kind: 'blocked', title: t.title, why: `Code change not planned: ${rs.why}` });
              return false;
            }
          }
          return true;
        });
        const room = Math.max(0, p.maxTasks - (followup ? j.tasks.length : 0));
        if (plan.tasks.length > room) {
          plan.warnings.unshift(`The Lead proposed ${plan.tasks.length} tasks that agents may run; today's limit is ${p.maxTasks}, so only the first ${room} are in the plan.`);
          plan.tasks = plan.tasks.slice(0, room);
        }
        const ids = new Set(plan.tasks.map((t) => t.id));
        for (const t of plan.tasks) t.depends_on = t.depends_on.filter((x) => ids.has(x) || j.tasks.some((o) => o.id === x));
        if (d) d.notes = [...(followup ? d.notes || [] : []), ...notes];
        me.save();
      },
      canStart(j) {
        const p = proj(j);
        if (!p) return null;
        const used = j.tasks.reduce((n, t) => n + (t.attempts || 0), 0);
        if (used >= p.maxTasks) return `Skipped: today's limit of ${p.maxTasks} task run${p.maxTasks === 1 ? '' : 's'} is used up.`;
        const spent = me.spentToday(p, j.daily.day);
        if (spent >= p.maxUsd) return `Skipped: today's spend limit of $${p.maxUsd.toFixed(2)} is reached ($${spent.toFixed(2)} so far).`;
        return null;
      },
      prepareTask(j, t, prompt) {
        const p = proj(j);
        if (!p) return null;
        if (t.mode !== 'edit') {
          // a review of a code task runs in that task's branch and sees its diff
          const deps = (t.depends_on || []).map((id) => j.tasks.find((o) => o.id === id)).filter((o) => o?.branch && o.worktree && isDir(o.worktree));
          if (!deps.length) return { args: dailyArgs({ prompt, agent: t.agent, mode: 'read' }) };
          const parts = deps.map((o) => {
            const d = me.git(o.worktree, 'diff', `${o.base || 'HEAD'}...HEAD`);
            const body = d.ok && d.out.trim() ? clip(redact(d.out), Math.floor(12000 / deps.length)) : '(no changes)';
            return `Branch ${o.branch} (from "${o.title}"):\n\`\`\`diff\n${body}\n\`\`\``;
          });
          const full = `${prompt}\n\n---\nYou are working in the branch ${deps[0].branch}. The changes made earlier today:\n${parts.join('\n\n')}`;
          return { project: { id: j.project, name: j.projectName, cwd: deps[0].worktree }, args: dailyArgs({ prompt: full, agent: t.agent, mode: 'read' }) };
        }
        const rs = me.repoState(j.cwd);
        if (!rs.git || !rs.clean) throw new Error(rs.why);
        let name = `daily/${j.daily.day}-${slug(t.title)}`;
        for (let n = 2; me.git(j.cwd, 'rev-parse', '--verify', '--quiet', `refs/heads/${name}`).ok; n++) name = `daily/${j.daily.day}-${slug(t.title)}-${n}`;
        const dir = path.join(me.worktrees, p.id.replace(/[^A-Za-z0-9._-]/g, '-'), name.slice('daily/'.length));
        fs.mkdirSync(path.dirname(dir), { recursive: true });
        const add = me.git(j.cwd, 'worktree', 'add', '-q', '-b', name, dir, 'HEAD');
        if (!add.ok) throw new Error(`Could not create a branch for this task: ${safeLine(add.out, 200)}`);
        t.branch = name;
        t.worktree = dir;
        t.base = rs.branch;
        const note = `\n\n---\nYou are working in your own git worktree on the local branch ${name}. Edit files and run the project's tests here. Do not commit, push or merge: HQ commits your changes when you finish, so leave only changes you stand behind, and say plainly in your answer if the work is unfinished.`;
        return { project: { id: j.project, name: j.projectName, cwd: dir }, args: dailyArgs({ prompt: prompt + note, agent: t.agent, mode: 'edit' }) };
      },
      afterTask(j, t) {
        const p = proj(j);
        if (!p || !t.worktree) return;
        const status = me.git(t.worktree, 'status', '--porcelain');
        const changed = status.ok && status.out.trim() !== '';
        if (t.status !== 'done' || !changed) {
          // nothing worth keeping: remove the worktree and its branch
          me.git(j.cwd, 'worktree', 'remove', '--force', t.worktree);
          if (t.branch?.startsWith('daily/')) me.git(j.cwd, 'branch', '-D', t.branch);
          t.note = t.status === 'done' ? 'No files changed, so no branch was kept.' : 'The branch was removed because the task did not finish.';
          t.worktree = null;
          return;
        }
        me.git(t.worktree, 'add', '-A');
        const who = me.git(t.worktree, 'config', 'user.email');
        const id = who.ok && who.out.trim() ? [] : ['-c', 'user.name=Agency HQ', '-c', 'user.email=hq@localhost'];
        const msg = `${clip(t.title, 72)}\n\nDaily plan ${j.daily.day}, ${t.agent === 'general-purpose' ? 'general' : t.agent}. Made by Agency HQ; not pushed.`;
        const c = me.git(t.worktree, ...id, 'commit', '-q', '--no-verify', '-m', msg);
        if (!c.ok) throw new Error(`The changes could not be committed on ${t.branch}: ${safeLine(c.out, 200)}`);
        const sha = me.git(t.worktree, 'rev-parse', '--short', 'HEAD');
        p.branches.unshift({
          id: newId(), branch: t.branch, worktree: t.worktree, base: t.base || 'main', title: t.title, taskId: t.id, jobId: j.id, day: j.daily.day,
          commit: sha.ok ? sha.out.trim() : '', body: clip(redact(String(t.result || '')), 1500), status: 'ready', created: isoNow(), prUrl: null,
        });
        p.branches = p.branches.slice(0, 60);
        me.save();
      },
      localSummary(j) {
        const p = proj(j);
        if (!p) return undefined;
        const spent = me.spentToday(p, j.daily.day);
        const capped = j.tasks.some((t) => t.status === 'skipped' && /limit/.test(t.error || ''));
        if (spent < p.maxUsd && !capped) return undefined;
        const done = j.tasks.filter((t) => t.status === 'done').map((t) => `- ${t.title}`);
        const skipped = j.tasks.filter((t) => t.status === 'skipped').map((t) => `- ${t.title}: ${t.error || 'skipped'}`);
        return `Today's ${capped && spent < p.maxUsd ? 'task limit' : 'spend limit'} was reached, so HQ wrote this report itself instead of asking the Lead.\n\nWhat was done:\n${done.join('\n') || '- nothing'}\n\nWhat did not get done:\n${skipped.join('\n') || '- nothing'}\n\nThe backlog is unchanged. Raise the limits in Daily plan if you want more each day.`;
      },
      summaryPrompt(j) {
        const p = proj(j);
        if (!p) return null;
        const parts = j.tasks.map((t) => `### ${t.title} (${t.agent}): ${t.status}${t.branch && t.status === 'done' ? ` — committed on local branch ${t.branch}` : ''}\n${t.status === 'done' ? clip(redact(String(t.result || '')), 1200) : t.error ? `Problem: ${clip(t.error, 300)}` : ''}`);
        const notes = (dayOf(j)?.notes || []).map((n) => `- ${n.title}: ${n.why}`);
        const open = p.backlog.filter((b) => b.status === 'open').map((b) => `- ${b.title}`);
        return `Today's work on ${p.name} has finished. You are read-only.

What each task reported:
${parts.join('\n\n')}

Things the owner has to do (not run by agents):
${notes.join('\n') || '- none'}

Open backlog:
${open.join('\n') || '- (empty)'}

Write the daily report for the owner in plain words with four short sections: Done, Not done (and why), Branches ready for a PR, Things only you can do. Then, at the very end, a \`\`\`json fence with backlog updates: {"backlog":{"add":[{"title":"new work you discovered","detail":"one line"}],"done":["exact titles of open backlog items that are now finished"]}}`;
      },
      afterSummary(j) {
        const p = proj(j);
        if (!p) return;
        const d = dayOf(j);
        if (!d) return;
        let text = String(j.summary || j.summaryError || '');
        let backlog = null;
        const fence = /```json\s*\n([\s\S]*?)```/i.exec(text);
        if (fence) {
          try {
            const v = JSON.parse(fence[1]);
            if (isPlainObj(v?.backlog)) backlog = v.backlog;
          } catch {
            /* keep the text */
          }
          text = text.replace(fence[0], '').trim();
          j.summary = text;
          me.lead.save();
        }
        p.lastWrapDay = j.daily.day;
        me.record(p, d, text, backlog);
      },
    };
  }

  // ------------------------------------------------------------- branches: Open PR and Delete (only on click)
  branch(id) {
    for (const p of Object.values(this.state.projects)) {
      const b = p.branches.find((x) => x.id === id);
      if (b) return { p, b };
    }
    throw new Error('That branch is no longer listed.');
  }

  prCommands(p, b) {
    const title = clip(b.title, 120);
    const body = `${b.body || ''}\n\nMade by the Agency HQ daily plan on ${b.day}.`.trim();
    return {
      push: ['push', '-u', 'origin', b.branch],
      pr: ['pr', 'create', '--base', b.base || 'main', '--head', b.branch, '--title', title, '--body', body],
    };
  }

  openPr(id, { confirm = false } = {}) {
    const { p, b } = this.branch(id);
    if (b.status !== 'ready') throw new Error(b.status === 'pr-opened' ? 'A pull request is already open for this branch.' : 'This branch was deleted.');
    const c = this.prCommands(p, b);
    const q = (s) => (/^[A-Za-z0-9_./:=,@%+-]+$/.test(s) ? s : `'${String(s).replace(/'/g, "'\\''")}'`);
    const commands = [`git ${c.push.map(q).join(' ')}`, `gh ${c.pr.map(q).join(' ')}`];
    if (!confirm) return { ran: false, cwd: p.cwd, commands };
    const remote = this.git(p.cwd, 'remote');
    if (!remote.ok || !remote.out.split('\n').map((s) => s.trim()).includes('origin')) throw new Error('This project has no "origin" remote, so HQ cannot open a PR. Push the branch yourself.');
    const push = this.exec('git', c.push, { cwd: p.cwd, timeout: 120000 });
    if (!push.ok) throw new Error(`git push failed: ${safeLine(push.out, 300)}`);
    const pr = this.exec('gh', c.pr, { cwd: p.cwd, timeout: 120000 });
    if (!pr.ok) {
      b.pushed = true;
      this.save();
      throw new Error(`The branch was pushed, but gh pr create failed: ${safeLine(pr.out, 300)}`);
    }
    const url = (/(https?:\/\/\S+)/.exec(pr.out) || [])[1] || null;
    b.status = 'pr-opened';
    b.prUrl = url;
    b.pushed = true;
    this.save();
    return { ran: true, url, commands };
  }

  deleteBranch(id) {
    const { p, b } = this.branch(id);
    if (b.status === 'deleted') return b;
    if (!b.branch.startsWith('daily/')) throw new Error('HQ only deletes branches it created.');
    const root = path.resolve(this.worktrees) + path.sep;
    if (b.worktree && path.resolve(b.worktree).startsWith(root) && fs.existsSync(b.worktree)) {
      const rm = this.git(p.cwd, 'worktree', 'remove', '--force', b.worktree);
      if (!rm.ok) fs.rmSync(b.worktree, { recursive: true, force: true });
      this.git(p.cwd, 'worktree', 'prune');
    }
    const del = this.git(p.cwd, 'branch', '-D', b.branch);
    if (!del.ok && !/not found/i.test(del.out)) throw new Error(`Could not delete ${b.branch}: ${safeLine(del.out, 200)}`);
    b.status = 'deleted';
    this.save();
    return b;
  }
}

