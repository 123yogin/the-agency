import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { after, before, test } from 'node:test';
import { Dispatcher } from '../runtime/lib/dispatch.mjs';
import { Lead } from '../runtime/lib/lead.mjs';

let tmp;
let project;
before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hq-lead-'));
  fs.mkdirSync(path.join(tmp, 'proj'));
  project = { id: '-tmp-proj', name: 'proj', cwd: path.join(tmp, 'proj') };
});
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const AGENTS = [
  { id: 'engineering:code-reviewer', use: 'Use after writing code, to review the diff.' },
  { id: 'ai-data-docs:technical-writer', use: 'Use to write or fix documentation.' },
];

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
const send = (child, obj) => child.stdout.write(`${JSON.stringify(obj)}\n`);
const tick = () => new Promise((r) => setTimeout(r, 25));
async function answer(child, text, { session = null, error = false } = {}) {
  if (session) send(child, { type: 'system', subtype: 'init', session_id: session });
  send(child, { type: 'result', subtype: error ? 'error_during_execution' : 'success', is_error: error, result: text, total_cost_usd: 0.01, usage: { input_tokens: 10, output_tokens: 5 } });
  child.stdout.end();
  await tick();
  child.emit('close', error ? 1 : 0);
  await tick();
}
const PLAN = `Here is my plan:
\`\`\`json
{"summary":"Review, then document","tasks":[
 {"id":"a","title":"Review cart.js","prompt":"Review cart.js for bugs","agent":"engineering:code-reviewer","depends_on":[],"mode":"read"},
 {"id":"b","title":"Summarise README","prompt":"Summarise the README","agent":"ai-data-docs:technical-writer","depends_on":[],"mode":"read"},
 {"id":"c","title":"Write fix notes","prompt":"Write notes on how to fix the bugs","agent":"general","depends_on":["a"],"mode":"read"}
]}
\`\`\``;

function setup(dir) {
  fs.mkdirSync(dir, { recursive: true });
  const log = [];
  const d = new Dispatcher({ dataDir: dir, claudeBin: 'claude', maxConcurrent: 4, spawn: fakeSpawn(log) });
  const lead = new Lead({ dataDir: dir, dispatcher: d, getAgents: () => AGENTS });
  return { log, d, lead };
}

test('a goal becomes a plan, an approved plan runs in dependency order, and the Lead writes the summary', async () => {
  const { log, d, lead } = setup(path.join(tmp, 'flow'));
  const job = lead.create({ goal: 'Make checkout safe', project, mode: 'read', parallel: 2 });
  assert.equal(job.status, 'planning');
  assert.equal(log.length, 1, 'the Lead starts planning straight away');
  const planArgs = log[0].args;
  assert.match(planArgs[1], /engineering:code-reviewer — Use after writing code/);
  assert.ok(!planArgs.includes('--resume'));
  assert.ok(planArgs[planArgs.indexOf('--disallowedTools') + 1].includes('Edit'), 'the Lead plans read-only');
  assert.equal(d.get(job.leadRun).agent, 'hq:lead');
  await answer(log[0].child, PLAN, { session: '11111111-aaaa-4aaa-8aaa-111111111111' });

  assert.equal(lead.get(job.id).status, 'plan-ready');
  assert.equal(lead.get(job.id).tasks.length, 3);
  assert.equal(log.length, 1, 'nothing runs before approval');
  assert.ok(lead.attention().some((a) => a.job === job.id && /ready for your approval/.test(a.text)));

  lead.approve(job.id);
  assert.equal(log.length, 3, 'a and b start; c waits for a; limit is 2');
  const [ra, rb] = [log[1], log[2]];
  assert.ok(ra.args.includes('--agent') && ra.args.includes('engineering:code-reviewer'));
  assert.equal(ra.opts.cwd, project.cwd);
  await answer(ra.child, 'Found an off-by-one in total().');
  assert.equal(log.length, 4, 'c starts once a is done');
  assert.match(log[3].args[1], /Found an off-by-one in total\(\)/, 'c sees what a found');
  await answer(rb.child, 'The README describes the demo shop.');
  await answer(log[3].child, 'Change < to <= in total().');

  assert.equal(lead.get(job.id).status, 'summarizing');
  const sum = log[4];
  assert.equal(sum.args[sum.args.indexOf('--resume') + 1], '11111111-aaaa-4aaa-8aaa-111111111111', 'the same Lead session writes the summary');
  assert.match(sum.args[1], /Found an off-by-one/);
  await answer(sum.child, 'What was done: reviewed and documented.');
  const done = lead.get(job.id);
  assert.equal(done.status, 'done');
  assert.match(done.summary, /reviewed and documented/);
  assert.equal(done.runs, 5);
  assert.ok(Math.abs(done.costUsd - 0.05) < 1e-9);
});

test('a failed task pauses its dependents and asks for you; retry carries on', async () => {
  const { log, lead } = setup(path.join(tmp, 'fail'));
  const job = lead.create({ goal: 'g', project, parallel: 2 });
  await answer(log[0].child, PLAN, { session: '22222222-aaaa-4aaa-8aaa-222222222222' });
  lead.approve(job.id);
  await answer(log[1].child, 'Agent crashed', { error: true });
  let j = lead.get(job.id);
  assert.equal(j.tasks.find((t) => t.id === 'a').status, 'failed');
  assert.equal(j.tasks.find((t) => t.id === 'c').status, 'blocked');
  assert.equal(j.status, 'running', 'b is still running');
  await answer(log[2].child, 'README summary');
  j = lead.get(job.id);
  assert.equal(j.status, 'paused');
  assert.ok(lead.attention().some((a) => a.job === job.id && /failed/.test(a.text)));
  assert.equal(log.length, 3, 'c never ran blindly');

  lead.taskAction(job.id, 'a', 'retry');
  assert.equal(lead.get(job.id).status, 'running');
  assert.equal(log.length, 4);
  await answer(log[3].child, 'Reviewed fine');
  assert.equal(log.length, 5, 'c released');
  lead.taskAction(job.id, 'c', 'cancel');
  await tick();
  await tick();
  assert.equal(lead.get(job.id).tasks.find((t) => t.id === 'c').status, 'cancelled');
  assert.equal(lead.get(job.id).status, 'paused');
  lead.taskAction(job.id, 'c', 'skip');
  assert.equal(lead.get(job.id).status, 'summarizing', 'all resolved, so the Lead summarises');
});

test('edit mode needs an explicit confirmation naming the tasks that can change files', async () => {
  const { log, lead } = setup(path.join(tmp, 'edit'));
  const job = lead.create({ goal: 'fix it', project, mode: 'edit', parallel: 1 });
  await answer(log[0].child, '```json\n{"tasks":[{"id":"x","title":"Fix","prompt":"Fix total()","agent":"general","mode":"edit"},{"id":"y","title":"Check","prompt":"Check","agent":"engineering:code-reviewer","mode":"read","depends_on":["x"]}]}\n```');
  assert.throws(() => lead.approve(job.id), /Confirm first: one task can change files/);
  lead.approve(job.id, { confirmEdit: true });
  assert.equal(log.length, 2);
  assert.ok(log[1].args.includes('acceptEdits'), 'only the edit task gets edit permission');
});

test('the plan can be edited before approval; started tasks are locked', async () => {
  const { log, lead } = setup(path.join(tmp, 'editplan'));
  const job = lead.create({ goal: 'g', project, parallel: 1 });
  await answer(log[0].child, PLAN);
  const tasks = lead.get(job.id).tasks.map(({ id, title, prompt, agent, mode, depends_on }) => ({ id, title, prompt, agent, mode, depends_on }));
  tasks.reverse();
  tasks[0].agent = 'ai-data-docs:technical-writer';
  tasks.push({ title: 'Extra', prompt: 'One more thing', agent: 'nope:nope', depends_on: [] });
  lead.savePlan(job.id, tasks.filter((t) => t.id !== 'b'));
  const j = lead.get(job.id);
  assert.deepEqual(j.tasks.map((t) => t.title), ['Write fix notes', 'Review cart.js', 'Extra']);
  assert.equal(j.tasks[0].agent, 'ai-data-docs:technical-writer');
  assert.equal(j.tasks[2].agent, 'general-purpose');
  assert.throws(() => lead.savePlan(job.id, [{ id: 'p', title: 'p', prompt: 'p', depends_on: ['q'] }, { id: 'q', title: 'q', prompt: 'q', depends_on: ['p'] }]), /loop/);
  lead.approve(job.id);
  assert.equal(log[1].args[1], 'Review cart.js for bugs', 'c depends on a, so a runs first despite the order');
});

test('follow-ups resume the Lead, propose more tasks, and need approval again', async () => {
  const { log, lead } = setup(path.join(tmp, 'follow'));
  const job = lead.create({ goal: 'g', project, parallel: 4 });
  await answer(log[0].child, '```json\n{"tasks":[{"id":"t1","title":"Only","prompt":"Do it","agent":"general"}]}\n```', { session: '33333333-aaaa-4aaa-8aaa-333333333333' });
  lead.approve(job.id);
  await answer(log[1].child, 'done it');
  await answer(log[2].child, 'Summary one', { session: '33333333-aaaa-4aaa-8aaa-333333333333' });
  assert.equal(lead.get(job.id).status, 'done');
  assert.throws(() => lead.followup(job.id, '  '), /what else/);
  lead.followup(job.id, 'also add a privacy policy');
  const f = log[3];
  assert.equal(f.args[f.args.indexOf('--resume') + 1], '33333333-aaaa-4aaa-8aaa-333333333333');
  assert.match(f.args[1], /also add a privacy policy/);
  assert.match(f.args[1], /t1 \(done\): Only/);
  await answer(f.child, '```json\n{"tasks":[{"id":"t1","title":"Privacy policy","prompt":"Draft a privacy policy","agent":"general","depends_on":[]}]}\n```');
  const j = lead.get(job.id);
  assert.equal(j.status, 'plan-ready');
  assert.equal(j.tasks.length, 2);
  assert.equal(j.tasks[1].isNew, true);
  assert.notEqual(j.tasks[1].id, 't1');
  lead.approve(job.id);
  assert.equal(log.length, 5, 'only the new task runs');
  assert.match(log[4].args[1], /Draft a privacy policy/);
});

test('a Lead answer without a usable plan fails clearly and can be planned again', async () => {
  const { log, lead } = setup(path.join(tmp, 'noplan'));
  const job = lead.create({ goal: 'g', project });
  await answer(log[0].child, 'I would rather just chat about it.');
  const j = lead.get(job.id);
  assert.equal(j.status, 'plan-failed');
  assert.match(j.planError, /without a plan/);
  lead.replan(job.id);
  assert.equal(lead.get(job.id).status, 'planning');
  assert.equal(log.length, 2);
});

test('jobs survive a restart: running ones come back interrupted and pick up where they left off', async () => {
  const dir = path.join(tmp, 'restart');
  const one = setup(dir);
  const job = one.lead.create({ goal: 'g', project, parallel: 2 });
  await answer(one.log[0].child, PLAN, { session: '44444444-aaaa-4aaa-8aaa-444444444444' });
  one.lead.approve(job.id);
  await answer(one.log[1].child, 'a done');
  // HQ stops here with b and c running.
  const two = setup(dir);
  const j = two.lead.get(job.id);
  assert.equal(j.status, 'interrupted');
  assert.deepEqual(j.tasks.map((t) => t.status), ['done', 'interrupted', 'interrupted']);
  assert.ok(two.lead.attention().some((a) => /interrupted/.test(a.text)));
  two.lead.resume(job.id);
  assert.equal(two.lead.get(job.id).status, 'running');
  assert.equal(two.log.length, 2, 'b and c run again, a is not repeated');
});

test('stop cancels the Lead and every running agent of the job', async () => {
  const { log, d, lead } = setup(path.join(tmp, 'stop'));
  const job = lead.create({ goal: 'g', project, parallel: 2 });
  await answer(log[0].child, PLAN);
  lead.approve(job.id);
  assert.equal(lead.stopAll(), 1);
  await tick();
  await tick();
  const j = lead.get(job.id);
  assert.equal(j.status, 'stopped');
  assert.ok(j.tasks.filter((t) => t.id !== 'c').every((t) => t.status === 'cancelled'));
  assert.equal(log.length, 3, 'nothing new started after stop');
  assert.throws(() => d.approve(j.tasks[0].runId), /Lead job/);
});
