import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildFollowupPrompt, buildLeadArgs, buildPlanPrompt, composeTaskPrompt, extractJson, findCycle, recomputeBlocked,
  runnable, validatePlan,
} from '../runtime/lib/plan.mjs';

const AGENTS = new Set(['engineering:code-reviewer', 'growth:seo-specialist', 'product-design:prd-writer']);

test('extracts the JSON plan from a fenced block, a bare object or a bare array', () => {
  assert.deepEqual(extractJson('Here is the plan:\n```json\n{"tasks":[{"title":"a"}]}\n```\nDone.'), { tasks: [{ title: 'a' }] });
  assert.deepEqual(extractJson('Sure. {"tasks": []} hope that helps'), { tasks: [] });
  assert.deepEqual(extractJson('[{"title":"x"}]'), [{ title: 'x' }]);
  assert.equal(extractJson('no json here'), null);
  assert.equal(extractJson('{"broken": '), null);
});

test('validates and repairs a plan: unknown agents become general, bad modes become read-only, ids are fixed', () => {
  const p = validatePlan({
    summary: 'Review then document',
    tasks: [
      { id: 't1', title: 'Review cart', prompt: 'Review cart.js', agent: 'engineering:code-reviewer', depends_on: [], mode: 'read' },
      { id: 't1', title: 'Write docs', prompt: 'Document it', agent: 'docs:wizard', depends_on: ['t1', 'ghost'], mode: 'edit' },
      { title: '', prompt: 'Summarise the README in one line', agent: 'general', mode: 'nonsense' },
    ],
  }, { agents: AGENTS, allowEdit: false });
  assert.equal(p.summary, 'Review then document');
  assert.equal(p.tasks.length, 3);
  const ids = p.tasks.map((t) => t.id);
  assert.equal(new Set(ids).size, 3, 'ids must be unique');
  assert.equal(p.tasks[1].agent, 'general-purpose');
  assert.match(p.tasks[1].note, /docs:wizard/);
  assert.deepEqual(p.tasks[1].depends_on, ['t1'], 'unknown dependency dropped');
  assert.equal(p.tasks[1].mode, 'read', 'edit is not allowed in a read-only job');
  assert.equal(p.tasks[2].title, 'Summarise the README in one line', 'title falls back to the prompt');
  assert.equal(p.tasks[2].mode, 'read');
  assert.ok(p.warnings.length >= 2);
  const e = validatePlan({ tasks: [{ title: 'x', prompt: 'y', agent: 'engineering:code-reviewer', mode: 'edit' }] }, { agents: AGENTS, allowEdit: true });
  assert.equal(e.tasks[0].mode, 'edit');
});

test('rejects plans that are empty, too long, missing prompts everywhere, or circular', () => {
  assert.throws(() => validatePlan({ tasks: [] }, { agents: AGENTS }), /no tasks/i);
  assert.throws(() => validatePlan({ nope: 1 }, { agents: AGENTS }), /no tasks/i);
  assert.throws(() => validatePlan({ tasks: Array.from({ length: 13 }, (_, i) => ({ title: `t${i}`, prompt: 'p' })) }, { agents: AGENTS, maxTasks: 12 }), /more than 12/);
  assert.throws(() => validatePlan({ tasks: [{ title: 'only a title' }] }, { agents: AGENTS }), /no instructions/i);
  assert.throws(() => validatePlan({
    tasks: [
      { id: 'a', title: 'A', prompt: 'a', depends_on: ['b'] },
      { id: 'b', title: 'B', prompt: 'b', depends_on: ['a'] },
    ],
  }, { agents: AGENTS }), /loop: a → b → a|loop: b → a → b/);
  assert.deepEqual(findCycle([{ id: 'x', depends_on: ['x'] }]), ['x', 'x']);
});

test('follow-up tasks get fresh ids and may depend on existing tasks', () => {
  const existing = [{ id: 't1', status: 'done' }, { id: 't2', status: 'done' }];
  const p = validatePlan({ tasks: [{ id: 't1', title: 'Privacy policy', prompt: 'Draft it', depends_on: ['t2'] }, { id: 't3', title: 'Link it', prompt: 'Link', depends_on: ['t1'] }] }, { agents: AGENTS, existing });
  assert.equal(p.tasks.length, 2);
  assert.notEqual(p.tasks[0].id, 't1', 'collision renamed');
  assert.deepEqual(p.tasks[0].depends_on, ['t2']);
  assert.deepEqual(p.tasks[1].depends_on, [p.tasks[0].id], 'internal reference follows the rename');
});

test('scheduling honours dependencies and the parallel limit', () => {
  const tasks = [
    { id: 'a', status: 'waiting', depends_on: [] },
    { id: 'b', status: 'waiting', depends_on: [] },
    { id: 'c', status: 'waiting', depends_on: [] },
    { id: 'd', status: 'waiting', depends_on: ['a'] },
  ];
  assert.deepEqual(runnable(tasks, 2).map((t) => t.id), ['a', 'b']);
  tasks[0].status = 'running';
  assert.deepEqual(runnable(tasks, 2).map((t) => t.id), ['b']);
  tasks[0].status = 'done';
  tasks[1].status = 'running';
  assert.deepEqual(runnable(tasks, 2).map((t) => t.id), ['c'], 'order of the plan is kept');
  tasks[2].status = 'done';
  assert.deepEqual(runnable(tasks, 2).map((t) => t.id), ['d'], 'd starts once a is done');
  tasks[0].status = 'skipped';
  assert.deepEqual(runnable(tasks, 2).map((t) => t.id), ['d'], 'a skipped dependency does not block');
});

test('a failed task pauses its dependents (transitively) and retrying it releases them', () => {
  const tasks = [
    { id: 'a', status: 'failed', depends_on: [] },
    { id: 'b', status: 'waiting', depends_on: ['a'] },
    { id: 'c', status: 'waiting', depends_on: ['b'] },
    { id: 'd', status: 'waiting', depends_on: [] },
  ];
  recomputeBlocked(tasks);
  assert.deepEqual(tasks.map((t) => t.status), ['failed', 'blocked', 'blocked', 'waiting']);
  assert.deepEqual(runnable(tasks, 4).map((t) => t.id), ['d'], 'independent work continues');
  tasks[0].status = 'waiting';
  recomputeBlocked(tasks);
  assert.deepEqual(tasks.map((t) => t.status), ['waiting', 'waiting', 'waiting', 'waiting']);
});

test('dependent tasks receive a short summary of what their dependencies produced', () => {
  const tasks = [
    { id: 'a', title: 'Review cart', agent: 'engineering:code-reviewer', status: 'done', result: 'Found an off-by-one in total(). '.repeat(100) },
    { id: 'b', title: 'Skip me', agent: 'general-purpose', status: 'skipped', result: null },
    { id: 'c', title: 'Fix it', agent: 'general-purpose', prompt: 'Fix the bugs found', depends_on: ['a', 'b'] },
  ];
  const p = composeTaskPrompt(tasks[2], tasks, 'Make checkout safe');
  assert.match(p, /^Fix the bugs found/);
  assert.match(p, /Make checkout safe/);
  assert.match(p, /Review cart \(engineering:code-reviewer\): Found an off-by-one/);
  assert.match(p, /Skip me: skipped by the user/);
  assert.ok(p.length < 4000, 'context is clipped');
  assert.equal(composeTaskPrompt({ prompt: 'Solo', depends_on: [] }, tasks, 'g'), 'Solo');
});

test('the Lead plans read-only and is resumed by session id for summaries and follow-ups', () => {
  const plan = buildLeadArgs({ prompt: 'plan this' });
  assert.deepEqual(plan.slice(0, 2), ['-p', 'plan this']);
  assert.ok(!plan.includes('--resume'));
  const dis = plan[plan.indexOf('--disallowedTools') + 1].split(',');
  for (const t of ['Edit', 'Write', 'Bash']) assert.ok(dis.includes(t));
  const res = buildLeadArgs({ prompt: 'summarise', session: '3f1c2a9e-0000-4000-8000-000000000001' });
  assert.equal(res[res.indexOf('--resume') + 1], '3f1c2a9e-0000-4000-8000-000000000001');
  assert.ok(res.includes('stream-json'));
  assert.throws(() => buildLeadArgs({ prompt: 'x', session: '--dangerously-skip-permissions' }), /session/i);
});

test('the planning prompt lists the roster and the rules; the follow-up prompt names existing tasks', () => {
  const p = buildPlanPrompt({
    goal: 'Ship it', cwd: '/w/app', allowEdit: false, maxTasks: 6,
    agents: [{ id: 'engineering:code-reviewer', use: 'Use after writing code, to review the diff.' }],
  });
  assert.match(p, /Ship it/);
  assert.match(p, /engineering:code-reviewer — Use after writing code/);
  assert.match(p, /at most 6 tasks/);
  assert.match(p, /"mode": "read"/);
  assert.match(p, /read-only/i);
  const f = buildFollowupPrompt({ text: 'also add a privacy policy', tasks: [{ id: 't1', title: 'Review', status: 'done' }], allowEdit: true, maxTasks: 4 });
  assert.match(f, /also add a privacy policy/);
  assert.match(f, /t1 \(done\): Review/);
});
