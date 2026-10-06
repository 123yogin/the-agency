import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { after, before, test } from 'node:test';
import { Daily, DAILY_BLOCKED_TOOLS, dailyArgs, denyReason, localDay, slug, standupDue, wrapDue } from '../runtime/lib/daily.mjs';
import { Dispatcher } from '../runtime/lib/dispatch.mjs';
import { Lead } from '../runtime/lib/lead.mjs';

let tmp;
before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hq-daily-'));
});
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

// Local wall-clock time → epoch ms in the process time zone.
const at = (y, mo, d, h, mi = 0) => new Date(y, mo - 1, d, h, mi, 0, 0).getTime();

// ------------------------------------------------------------------ schedule

test('standup is due once per day, at or after its time, and catches up later that day', () => {
  const p = { enabled: true, standupAt: '09:00', lastStandupDay: null };
  assert.equal(standupDue(p, at(2026, 10, 6, 8, 59)), false, 'not before 09:00');
  assert.equal(standupDue(p, at(2026, 10, 6, 9, 0)), true);
  assert.equal(standupDue(p, at(2026, 10, 6, 15, 30)), true, 'HQ was off at 09:00: catch up when it starts');
  p.lastStandupDay = localDay(at(2026, 10, 6, 9, 0));
  assert.equal(standupDue(p, at(2026, 10, 6, 9, 1)), false, 'never twice a day');
  assert.equal(standupDue(p, at(2026, 10, 6, 23, 59)), false);
  assert.equal(standupDue(p, at(2026, 10, 7, 9, 0)), true, 'next day');
  assert.equal(standupDue({ ...p, lastStandupDay: '2026-10-01' }, at(2026, 10, 7, 9, 5)), true, 'missed days run once for today, not once per missed day');
  assert.equal(standupDue({ ...p, enabled: false }, at(2026, 10, 7, 9, 5)), false, 'off means off');
});

test('standup timing survives daylight-saving changes', () => {
  const saved = process.env.TZ;
  process.env.TZ = 'America/New_York';
  try {
    // 2026-03-08: clocks jump from 02:00 to 03:00. A 02:30 standup still runs once that morning.
    const p = { enabled: true, standupAt: '02:30', lastStandupDay: null };
    const before = new Date(2026, 2, 8, 1, 59).getTime();
    assert.equal(standupDue(p, before), false);
    const after = before + 60 * 1000; // 03:00 local, an hour "skipped"
    assert.equal(new Date(after).getHours(), 3);
    assert.equal(standupDue(p, after), true);
    // 2026-11-01: 01:00–02:00 happens twice. A 01:30 standup runs on the first pass only.
    const q = { enabled: true, standupAt: '01:30', lastStandupDay: null };
    const first = new Date(2026, 10, 1, 1, 30).getTime();
    assert.equal(standupDue(q, first), true);
    q.lastStandupDay = localDay(first);
    assert.equal(standupDue(q, first + 3600 * 1000), false, 'the repeated hour does not run it again');
    assert.equal(new Date(first + 3600 * 1000).getHours(), 1);
  } finally {
    if (saved === undefined) delete process.env.TZ;
    else process.env.TZ = saved;
  }
});

test('the evening report is due at wrap-up time, only after a standup that day, once', () => {
  const day = localDay(at(2026, 10, 6, 9));
  const p = { enabled: true, wrapAt: '18:00', lastStandupDay: day, lastWrapDay: null };
  assert.equal(wrapDue(p, at(2026, 10, 6, 17, 59)), false);
  assert.equal(wrapDue(p, at(2026, 10, 6, 18, 0)), true);
  assert.equal(wrapDue({ ...p, lastWrapDay: day }, at(2026, 10, 6, 19)), false);
  assert.equal(wrapDue({ ...p, lastStandupDay: '2026-10-05' }, at(2026, 10, 6, 19)), false, 'no standup today, no report');
});

// ------------------------------------------------------------------ policy

test('deploying, pushing, merging, posting, sending and spending are never runnable', () => {
  const no = [
    { title: 'Ship it', prompt: 'Run vercel deploy --prod for the web app' },
    { title: 'Push', prompt: 'Commit and git push origin main' },
    { title: 'Merge', prompt: 'Merge the PR with gh pr merge 12' },
    { title: 'Open a PR', prompt: 'Use gh pr create for the fix' },
    { title: 'Deploy', prompt: 'Deploy the API to production' },
    { title: 'Launch', prompt: 'Post the launch announcement on Reddit' },
    { title: 'Email', prompt: 'Send an email to all subscribers about the update' },
    { title: 'Publish', prompt: 'npm publish the package' },
    { title: 'Buy', prompt: 'Buy a domain for the landing page' },
    { title: 'Secrets', prompt: 'Rotate the API keys in the environment variables' },
    { title: 'Merge to main', prompt: 'Merge the feature branch into main' },
  ];
  for (const t of no) assert.ok(denyReason(t), `should be denied: ${t.prompt}`);
  const yes = [
    { title: 'Review', prompt: 'Review cart.js for bugs and list them' },
    { title: 'Reddit draft', prompt: 'Draft a Reddit post for the 75 Hard community, do not post it' },
    { title: 'Config', prompt: 'Check that vercel.json has the right rewrites' },
    { title: 'Release notes', prompt: 'Write release notes for the next version' },
    { title: 'Fix', prompt: 'Fix the off-by-one error in total() and add a test' },
  ];
  for (const t of yes) assert.equal(denyReason(t), null, `should be allowed: ${t.prompt}`);
});

test('daily runs cannot push, merge, call gh or Vercel even if the user allow-list would let them', () => {
  const read = dailyArgs({ prompt: 'p', agent: 'engineering:code-reviewer', mode: 'read' });
  const r = read[read.indexOf('--disallowedTools') + 1];
  for (const tool of ['Edit', 'Write', 'NotebookEdit', 'Bash']) assert.ok(r.split(',').includes(tool), `read tasks block ${tool}`);
  assert.ok(!read.includes('acceptEdits'));
  const edit = dailyArgs({ prompt: 'p', agent: 'general-purpose', mode: 'edit' });
  assert.ok(edit.includes('acceptEdits'));
  const e = edit[edit.indexOf('--disallowedTools') + 1];
  for (const rule of ['Bash(git push:*)', 'Bash(git merge:*)', 'Bash(gh:*)', 'Bash(vercel:*)', 'Bash(npm publish:*)']) assert.ok(e.split(',').includes(rule), `edit tasks block ${rule}`);
  assert.equal(DAILY_BLOCKED_TOOLS.includes('Bash(git push:*)'), true);
});

test('branch names are safe slugs', () => {
  assert.equal(slug('Fix the off-by-one in total()!'), 'fix-the-off-by-one-in-total');
  assert.equal(slug('   '), 'task');
  assert.ok(slug('x'.repeat(200)).length <= 40);
});

// ------------------------------------------------------------------ the whole day with fake claude, real git, fake gh

function fakeSpawn(log) {
  return (bin, args, opts) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.kill = () => setImmediate(() => child.emit('close', null));
    log.push({ bin, args, opts, child });
    return child;
  };
}
const tick = () => new Promise((r) => setTimeout(r, 25));
async function answer(child, text, { session = null, cost = 0.01, error = false } = {}) {
  if (session) child.stdout.write(`${JSON.stringify({ type: 'system', subtype: 'init', session_id: session })}\n`);
  child.stdout.write(`${JSON.stringify({ type: 'result', subtype: error ? 'error_during_execution' : 'success', is_error: error, result: text, total_cost_usd: cost, usage: { input_tokens: 10, output_tokens: 5 } })}\n`);
  child.stdout.end();
  await tick();
  child.emit('close', error ? 1 : 0);
  await tick();
}
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

function makeRepo(name, { remote = false } = {}) {
  const dir = path.join(tmp, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'cart.js'), 'export const total = (xs) => xs.reduce((a, x) => a + x, 1);\n');
  fs.writeFileSync(path.join(dir, 'CLAUDE.md'), '# Demo\nTODO: add tests\n');
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, '-c', 'user.name=T', '-c', 'user.email=t@t', 'add', '-A');
  git(dir, '-c', 'user.name=T', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'init');
  if (remote) {
    const bare = path.join(tmp, `${name}-remote.git`);
    execFileSync('git', ['init', '-q', '--bare', bare]);
    git(dir, 'remote', 'add', 'origin', bare);
  }
  return { id: `-${name}`, name, cwd: dir };
}

function setup(name, opts = {}) {
  const dir = path.join(tmp, `${name}-data`);
  fs.mkdirSync(dir, { recursive: true });
  const log = [];
  const ghCalls = [];
  const runs = []; // every non-claude command HQ ran
  const d = new Dispatcher({ dataDir: dir, claudeBin: 'claude', maxConcurrent: 4, spawn: fakeSpawn(log) });
  const lead = new Lead({ dataDir: dir, dispatcher: d, getAgents: () => [{ id: 'engineering:code-reviewer', use: 'Use after writing code.' }] });
  let clock = opts.now ?? at(2026, 10, 6, 9, 0);
  const project = opts.project;
  const exec = (cmd, args, { cwd } = {}) => {
    runs.push({ cmd, args, cwd });
    if (cmd === 'gh') {
      ghCalls.push(args);
      if (args[0] === 'pr' && args[1] === 'create') return { ok: true, out: 'https://github.com/demo/demo/pull/7\n' };
      return { ok: true, out: '[]' };
    }
    try {
      return { ok: true, out: execFileSync(cmd, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) };
    } catch (e) {
      return { ok: false, out: String(e.stderr || e.message) };
    }
  };
  const daily = new Daily({ dataDir: dir, lead, dispatcher: d, exec, now: () => clock, findProject: (id) => (id === project.id ? project : null), getAgents: () => [{ id: 'engineering:code-reviewer', use: 'Use after writing code.' }] });
  return { dir, log, d, lead, daily, ghCalls, runs, setNow: (ms) => { clock = ms; }, project };
}

const STANDUP = (tasks, extra = {}) => `\`\`\`json\n${JSON.stringify({ standup: { yesterday: 'Nothing yet.', today: 'Fix cart.js.', blockers: 'None.' }, summary: 'Fix the cart', tasks, yourself: [{ title: 'Renew the domain', why: 'Only you can pay for it.' }], ...extra })}\n\`\`\``;

test('enabling seeds the backlog read-only; the standup is read-only and nothing runs before approval', async () => {
  const project = makeRepo('flow');
  const s = setup('flow', { project });
  s.daily.update(project.id, { enabled: true, focus: 'Find and fix bugs in cart.js', maxTasks: 2, maxUsd: 3 });
  assert.equal(s.log.length, 1, 'seeding starts once');
  const seed = s.log[0];
  assert.ok(seed.args[seed.args.indexOf('--disallowedTools') + 1].includes('Edit'), 'seeding is read-only');
  assert.match(seed.args[1], /CLAUDE\.md/);
  await answer(seed.child, '```json\n{"backlog":[{"title":"Add tests for cart.js","detail":"From CLAUDE.md TODO"}]}\n```');
  assert.deepEqual(s.daily.view(project.id).backlog.map((b) => b.title), ['Add tests for cart.js']);

  s.daily.tick(at(2026, 10, 6, 8, 0));
  assert.equal(s.log.length, 1, 'too early');
  s.daily.tick(at(2026, 10, 6, 9, 0));
  assert.equal(s.log.length, 2, 'standup starts at 09:00');
  s.daily.tick(at(2026, 10, 6, 9, 1));
  assert.equal(s.log.length, 2, 'and only once');
  const st = s.log[1];
  const dis = st.args[st.args.indexOf('--disallowedTools') + 1].split(',');
  for (const tool of ['Edit', 'Write', 'NotebookEdit', 'Bash']) assert.ok(dis.includes(tool), `standup blocks ${tool}`);
  assert.ok(!st.args.includes('acceptEdits'));
  assert.match(st.args[1], /Find and fix bugs in cart\.js/, 'focus is in the prompt');
  assert.match(st.args[1], /Add tests for cart\.js/, 'backlog is in the prompt');
  assert.match(st.args[1], /init/, 'git log is in the prompt');
  assert.match(st.args[1], /never (deploy|push)/i, 'policy is in the prompt');

  await answer(st.child, STANDUP([
    { id: 'r1', title: 'Review cart.js', prompt: 'Review cart.js for bugs', agent: 'engineering:code-reviewer', mode: 'read' },
    { id: 'f1', title: 'Fix total()', prompt: 'Fix the starting value in total()', agent: 'general', mode: 'edit', depends_on: ['r1'] },
    { id: 'd1', title: 'Deploy', prompt: 'Deploy to production with vercel deploy --prod', agent: 'general', mode: 'read' },
  ]), { session: '55555555-aaaa-4aaa-8aaa-555555555555', cost: 0.2 });

  const v = s.daily.view(project.id);
  const job = s.lead.get(v.today.jobId);
  assert.equal(job.status, 'plan-ready');
  assert.deepEqual(job.tasks.map((t) => t.id), ['r1', 'f1'], 'the deploy task never made it into the runnable plan');
  assert.ok(v.today.notes.some((n) => n.kind === 'denied' && /Deploy/.test(n.title)), 'it shows as something you do yourself');
  assert.ok(v.today.notes.some((n) => n.kind === 'yourself' && /domain/.test(n.title)));
  assert.equal(v.today.standup.today, 'Fix cart.js.');
  assert.ok(s.lead.attention().some((a) => a.job === job.id && /Today's plan for flow/.test(a.text)));
  assert.equal(s.log.length, 2, 'nothing ran before approval');
  assert.throws(() => s.d.approve(job.leadRun || 'x'), /no longer exists|Lead job/);

  // Approve (code task needs the confirmation like any edit task).
  s.lead.approve(job.id, { confirmEdit: true });
  assert.equal(s.log.length, 3, 'r1 starts; f1 waits for it');
  await answer(s.log[2].child, 'The reduce starts at 1 instead of 0.');
  assert.equal(s.log.length, 4, 'f1 starts after r1');
  const f1 = s.log[3];
  assert.ok(f1.args.includes('acceptEdits'));
  assert.ok(f1.args[f1.args.indexOf('--disallowedTools') + 1].includes('Bash(git push:*)'));
  const t = s.lead.get(job.id).tasks.find((x) => x.id === 'f1');
  assert.match(t.branch, /^daily\/2026-10-06-fix-total$/);
  assert.equal(f1.opts.cwd, t.worktree, 'the code task runs in its own worktree');
  assert.notEqual(t.worktree, project.cwd);
  assert.equal(git(project.cwd, 'rev-parse', '--abbrev-ref', 'HEAD'), 'main', 'the user checkout is untouched');
  // The agent edits the worktree.
  fs.writeFileSync(path.join(t.worktree, 'cart.js'), 'export const total = (xs) => xs.reduce((a, x) => a + x, 0);\n');
  await answer(f1.child, 'Changed the start value to 0.');

  const b = s.daily.view(project.id).branches.find((x) => x.branch === t.branch);
  assert.ok(b, 'the branch is listed as ready for a PR');
  assert.equal(b.status, 'ready');
  assert.match(git(project.cwd, 'log', '-1', '--pretty=%s', t.branch), /Fix total\(\)/);
  assert.equal(git(project.cwd, 'rev-list', '--count', `main..${t.branch}`), '1', 'one local commit on the branch');
  assert.equal(fs.readFileSync(path.join(project.cwd, 'cart.js'), 'utf8').includes('1);'), true, 'main is unchanged');
  assert.ok(!s.runs.some((r) => r.cmd === 'git' && r.args.includes('push')), 'nothing was pushed');
  assert.equal(s.ghCalls.filter((a) => a[0] === 'pr' && a[1] === 'create').length, 0, 'no PR was opened');

  // The job is done, so the Lead writes the report (read-only) and updates the backlog.
  const sum = s.log[4];
  assert.ok(sum.args[sum.args.indexOf('--disallowedTools') + 1].includes('Edit'), 'the report is read-only');
  assert.match(sum.args[1], /backlog/i);
  await answer(sum.child, 'What was done: fixed total().\n\n```json\n{"backlog":{"add":[{"title":"Add a test for total()"}],"done":["Add tests for cart.js"]}}\n```');
  const after = s.daily.view(project.id);
  assert.match(after.today.summary, /fixed total\(\)/);
  assert.ok(!after.today.summary.includes('```'), 'the JSON is not shown as the summary');
  assert.deepEqual(after.backlog.filter((x) => x.status === 'open').map((x) => x.title), ['Add a test for total()']);
  assert.ok(s.daily.attention().some((a) => a.kind === 'daily' && /Daily report for flow/.test(a.text)));
  s.daily.markSeen(project.id);
  assert.ok(!s.daily.attention().some((a) => a.kind === 'daily'));
  assert.ok(Math.abs(after.today.costUsd - (0.2 + 0.01 + 0.01 + 0.01)) < 1e-9, 'cost includes standup, tasks and report');
});

test('code tasks are refused on a dirty or non-git project and become notes', async () => {
  const project = makeRepo('dirty');
  fs.writeFileSync(path.join(project.cwd, 'wip.txt'), 'uncommitted');
  const s = setup('dirty', { project });
  s.daily.update(project.id, { enabled: true, seed: false });
  s.daily.runNow(project.id);
  await answer(s.log[0].child, STANDUP([
    { id: 'a', title: 'Review', prompt: 'Review cart.js', agent: 'general', mode: 'read' },
    { id: 'b', title: 'Fix', prompt: 'Fix cart.js', agent: 'general', mode: 'edit' },
  ]));
  const v = s.daily.view(project.id);
  const job = s.lead.get(v.today.jobId);
  assert.deepEqual(job.tasks.map((t) => t.id), ['a']);
  assert.ok(v.today.notes.some((n) => n.kind === 'blocked' && /uncommitted/.test(n.why)));

  const plain = path.join(tmp, 'notgit');
  fs.mkdirSync(plain);
  const p2 = { id: '-notgit', name: 'notgit', cwd: plain };
  const s2 = setup('notgit', { project: p2 });
  s2.daily.update(p2.id, { enabled: true, seed: false });
  s2.daily.runNow(p2.id);
  assert.match(s2.log[0].args[1], /not a git repository/i);
  await answer(s2.log[0].child, STANDUP([{ id: 'b', title: 'Fix', prompt: 'Fix it', agent: 'general', mode: 'edit' }, { id: 'c', title: 'Read', prompt: 'Read it', agent: 'general' }]));
  const v2 = s2.daily.view(p2.id);
  assert.deepEqual(s2.lead.get(v2.today.jobId).tasks.map((t) => t.id), ['c']);
  assert.ok(v2.today.notes.some((n) => /not a git repository/i.test(n.why)));
});

test('caps: at most N tasks per day and no new runs once the spend cap is reached', async () => {
  const project = makeRepo('caps');
  const s = setup('caps', { project });
  s.daily.update(project.id, { enabled: true, seed: false, maxTasks: 2, maxUsd: 1 });
  s.daily.runNow(project.id);
  await answer(s.log[0].child, STANDUP([
    { id: 'a', title: 'A', prompt: 'a', agent: 'general' },
    { id: 'b', title: 'B', prompt: 'b', agent: 'general', depends_on: ['a'] },
    { id: 'c', title: 'C', prompt: 'c', agent: 'general' },
  ]), { cost: 0.5 });
  const v = s.daily.view(project.id);
  const job = s.lead.get(v.today.jobId);
  assert.equal(job.tasks.length, 2, 'the plan is trimmed to the daily task cap');
  s.lead.approve(job.id);
  assert.equal(s.log.length, 2);
  await answer(s.log[1].child, 'a done', { cost: 0.6 }); // spend now 1.1 > 1
  const j = s.lead.get(job.id);
  assert.equal(j.tasks.find((t) => t.id === 'b').status, 'skipped');
  assert.match(j.tasks.find((t) => t.id === 'b').error, /spend limit/i);
  assert.equal(s.log.length, 2, 'no further agent ran, and no paid report either');
  assert.equal(j.status, 'done');
  assert.match(s.daily.view(project.id).today.summary, /spend limit/i, 'the report is written locally, for free');
});

test('Open PR only runs when you click it, after showing the exact commands; Delete removes the branch', async () => {
  const project = makeRepo('pr', { remote: true });
  const s = setup('pr', { project });
  s.daily.update(project.id, { enabled: true, seed: false });
  s.daily.runNow(project.id);
  await answer(s.log[0].child, STANDUP([{ id: 'f', title: 'Fix total', prompt: 'Fix total()', agent: 'general', mode: 'edit' }, { id: 'g', title: 'Docs', prompt: 'Improve the docs', agent: 'general', mode: 'edit' }]));
  const job = s.lead.get(s.daily.view(project.id).today.jobId);
  s.lead.approve(job.id, { confirmEdit: true });
  const [tf, tg] = s.lead.get(job.id).tasks;
  fs.writeFileSync(path.join(tf.worktree, 'cart.js'), 'fixed\n');
  await answer(s.log[1].child, 'fixed');
  fs.writeFileSync(path.join(tg.worktree, 'README.md'), 'docs\n');
  await answer(s.log[2].child, 'docs');
  const [b1, b2] = s.daily.view(project.id).branches;
  assert.ok(!s.runs.some((r) => r.cmd === 'git' && r.args.includes('push')), 'nothing pushed yet');

  const preview = s.daily.openPr(b1.id, { confirm: false });
  assert.equal(preview.ran, false);
  assert.ok(preview.commands.some((c) => c.startsWith(`git push -u origin ${b1.branch}`)));
  assert.ok(preview.commands.some((c) => c.startsWith('gh pr create')));
  assert.equal(s.ghCalls.filter((a) => a[1] === 'create').length, 0, 'previewing runs nothing');

  const res = s.daily.openPr(b1.id, { confirm: true });
  assert.equal(res.ran, true);
  assert.equal(res.url, 'https://github.com/demo/demo/pull/7');
  assert.equal(s.daily.view(project.id).branches.find((b) => b.id === b1.id).status, 'pr-opened');
  assert.ok(s.runs.some((r) => r.cmd === 'git' && r.args.includes('push') && r.args.includes(b1.branch)));

  s.daily.deleteBranch(b2.id);
  assert.equal(s.daily.view(project.id).branches.find((b) => b.id === b2.id).status, 'deleted');
  assert.throws(() => git(project.cwd, 'rev-parse', '--verify', b2.branch));
  assert.equal(fs.existsSync(b2.worktree), false);
  assert.ok(fs.existsSync(b1.worktree), "the other branch is untouched");
});

test('backlog edits persist; settings are validated; global pause stops the schedule', async () => {
  const project = makeRepo('backlog');
  const s = setup('backlog', { project });
  s.daily.update(project.id, { enabled: true, seed: false });
  s.daily.setBacklog(project.id, [{ title: 'One' }, { title: 'Two', status: 'done' }, { title: '  ' }]);
  assert.throws(() => s.daily.update(project.id, { standupAt: '25:00' }), /time/i);
  assert.throws(() => s.daily.update(project.id, { maxTasks: 99 }), /tasks/i);
  assert.throws(() => s.daily.update(project.id, { maxUsd: -1 }), /spend/i);
  // A fresh Daily on the same data dir sees the same backlog.
  const again = new Daily({ dataDir: s.dir, lead: s.lead, dispatcher: s.d, exec: () => ({ ok: true, out: '' }), now: () => at(2026, 10, 6, 10), findProject: () => project, getAgents: () => [] });
  assert.deepEqual(again.view(project.id).backlog.map((b) => [b.title, b.status]), [['One', 'open'], ['Two', 'done']]);
  again.setPaused(true);
  again.tick(at(2026, 10, 6, 10));
  assert.equal(s.log.length, 0, 'paused: no standup');
  again.setPaused(false);
  again.tick(at(2026, 10, 6, 10));
  assert.equal(s.log.length, 1, 'unpaused: catch-up standup');
});

test('an unapproved plan gets a free local report at wrap-up time', async () => {
  const project = makeRepo('unapproved');
  const s = setup('unapproved', { project });
  s.daily.update(project.id, { enabled: true, seed: false });
  s.daily.tick(at(2026, 10, 6, 9, 0));
  await answer(s.log[0].child, STANDUP([{ id: 'a', title: 'A', prompt: 'a', agent: 'general' }]));
  s.daily.tick(at(2026, 10, 6, 18, 0));
  assert.equal(s.log.length, 1, 'no Lead run for the report');
  assert.match(s.daily.view(project.id).today.summary, /not approved/i);
  s.daily.tick(at(2026, 10, 6, 18, 5));
  assert.equal(s.daily.attention().filter((a) => a.kind === 'daily').length, 1, 'one report, not one per tick');
});

test('a code task that changed nothing, or failed, leaves no branch or worktree behind', async () => {
  const project = makeRepo('nochange');
  const s = setup('nochange', { project });
  s.daily.update(project.id, { enabled: true, seed: false });
  s.daily.runNow(project.id);
  await answer(s.log[0].child, STANDUP([{ id: 'a', title: 'Tidy', prompt: 'Tidy cart.js', agent: 'general', mode: 'edit' }, { id: 'b', title: 'Break', prompt: 'Change cart.js', agent: 'general', mode: 'edit' }]));
  const job = s.lead.get(s.daily.view(project.id).today.jobId);
  s.lead.approve(job.id, { confirmEdit: true });
  const [ta, tb] = s.lead.get(job.id).tasks.map((t) => ({ ...t }));
  await answer(s.log[1].child, 'Nothing needed changing.');
  fs.writeFileSync(path.join(tb.worktree, 'cart.js'), 'half done\n');
  await answer(s.log[2].child, 'crashed', { error: true });
  assert.deepEqual(s.daily.view(project.id).branches, []);
  for (const t of [ta, tb]) {
    assert.equal(fs.existsSync(t.worktree), false, `${t.id} worktree removed`);
    assert.throws(() => git(project.cwd, 'rev-parse', '--verify', t.branch), `${t.id} branch removed`);
  }
  assert.match(s.lead.get(job.id).tasks.find((t) => t.id === 'a').note, /No files changed/);
});

test('code tasks may run the project tests and read-only git; a review that depends on them sees the branch and its diff', async () => {
  const edit = dailyArgs({ prompt: 'p', agent: 'general-purpose', mode: 'edit' });
  const allowed = edit[edit.indexOf('--allowedTools') + 1].split(',');
  for (const rule of ['Bash(node --test:*)', 'Bash(npm test:*)', 'Bash(pytest:*)', 'Bash(git diff:*)']) assert.ok(allowed.includes(rule), `edit tasks may run ${rule}`);
  assert.ok(!allowed.some((r) => /push|merge|gh|vercel/.test(r)));
  const read = dailyArgs({ prompt: 'p', agent: 'general-purpose', mode: 'read' });
  assert.ok(!read.includes('--allowedTools'), 'read tasks get no shell at all');

  const project = makeRepo('review');
  const s = setup('review', { project });
  s.daily.update(project.id, { enabled: true, seed: false });
  s.daily.runNow(project.id);
  assert.match(s.log[0].args[1], /run the project's tests/i, 'the standup knows what code tasks can do');
  await answer(s.log[0].child, STANDUP([
    { id: 'f', title: 'Fix total', prompt: 'Fix total() and run the tests', agent: 'general', mode: 'edit' },
    { id: 'r', title: 'Review the fix', prompt: 'Review the change', agent: 'engineering:code-reviewer', mode: 'read', depends_on: ['f'] },
  ]));
  const job = s.lead.get(s.daily.view(project.id).today.jobId);
  s.lead.approve(job.id, { confirmEdit: true });
  assert.match(s.log[1].args[1], /HQ commits your changes/, 'the code task is told how its work is kept');
  const tf = s.lead.get(job.id).tasks.find((t) => t.id === 'f');
  fs.writeFileSync(path.join(tf.worktree, 'cart.js'), 'export const total = (xs) => xs.reduce((a, x) => a + x, 0);\n');
  await answer(s.log[1].child, 'Fixed the start value.');
  const rev = s.log[2];
  assert.equal(rev.opts.cwd, tf.worktree, 'the review runs in the branch it reviews');
  assert.match(rev.args[1], /\+export const total = \(xs\) => xs.reduce\(\(a, x\) => a \+ x, 0\)/, 'and gets the diff in its prompt');
  assert.match(rev.args[1], new RegExp(tf.branch.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')));
});

test('daily runs block test scripts that hit production and deploy scripts', async () => {
  const { DAILY_BLOCKED_TOOLS } = await import('../runtime/lib/daily.mjs');
  for (const rule of ['Bash(npm run test:prod:*)', 'Bash(npm run deploy:*)', 'Bash(git push:*)', 'Bash(vercel:*)']) {
    assert.ok(DAILY_BLOCKED_TOOLS.includes(rule), `missing ${rule}`);
  }
});
