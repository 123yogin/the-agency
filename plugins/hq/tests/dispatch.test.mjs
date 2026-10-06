import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { after, before, test } from 'node:test';
import { Dispatcher, buildArgs } from '../runtime/lib/dispatch.mjs';
import { parseMcpList } from '../runtime/lib/health.mjs';

let tmp;
let project;
before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hq-dispatch-'));
  fs.mkdirSync(path.join(tmp, 'proj'));
  project = { id: '-tmp-proj', name: 'proj', cwd: path.join(tmp, 'proj') };
});
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

// A fake `claude` child process we can drive line by line.
function fakeSpawn(log) {
  return (bin, args, opts) => {
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.killed = false;
    child.kill = (sig) => {
      child.killed = sig;
      setImmediate(() => child.emit('close', null));
    };
    log.push({ bin, args, opts, child });
    return child;
  };
}
const line = (child, obj) => child.stdout.write(`${JSON.stringify(obj)}\n`);
const tick = () => new Promise((r) => setTimeout(r, 20));

test('read-only runs cannot edit files or run shell commands', () => {
  const args = buildArgs({ task: 'hi', agent: 'engineering:code-reviewer', mode: 'read' });
  assert.deepEqual(args.slice(0, 2), ['-p', 'hi']);
  assert.ok(args.includes('--agent') && args.includes('engineering:code-reviewer'));
  const dis = args[args.indexOf('--disallowedTools') + 1];
  for (const t of ['Edit', 'Write', 'NotebookEdit', 'Bash']) assert.ok(dis.split(',').includes(t));
  assert.ok(!buildArgs({ task: 'hi', agent: 'auto', mode: 'read' }).includes('--agent'));
  assert.ok(buildArgs({ task: 'hi', agent: 'x:y', mode: 'edit' }).includes('acceptEdits'));
});

test('nothing runs until approved; then progress streams and the result lands', async () => {
  const log = [];
  const d = new Dispatcher({ dataDir: tmp, claudeBin: 'claude', spawn: fakeSpawn(log) });
  const r = d.create({ task: 'List the files', agent: 'general-purpose', project, mode: 'read' });
  assert.equal(r.status, 'review');
  assert.match(r.command, /^claude -p 'List the files'/);
  assert.equal(log.length, 0);
  d.approve(r.id);
  assert.equal(log.length, 1);
  assert.equal(log[0].opts.cwd, project.cwd);
  assert.equal(d.get(r.id).status, 'running');
  const c = log[0].child;
  line(c, { type: 'system', subtype: 'init', session_id: 'sess-1' });
  line(c, { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Glob', input: { pattern: '*' } }], usage: { output_tokens: 5 } } });
  line(c, { type: 'assistant', message: { content: [{ type: 'text', text: 'Two files: README and cart.js' }] } });
  line(c, { type: 'result', subtype: 'success', is_error: false, result: 'README.md and cart.js. Key sk-abcdefghijklmnop', duration_ms: 4200, total_cost_usd: 0.012, usage: { input_tokens: 100, output_tokens: 20 } });
  await tick();
  c.emit('close', 0);
  await tick();
  const done = d.get(r.id);
  assert.equal(done.status, 'done');
  assert.equal(done.sessionId, 'sess-1');
  assert.equal(done.tools, 1);
  assert.equal(done.events[0].text, 'Finding files *');
  assert.equal(done.costUsd, 0.012);
  assert.ok(!done.result.includes('sk-abcdefghijklmnop'), 'result not redacted');
});

test('cancel stops a running child and records it', async () => {
  const log = [];
  const d = new Dispatcher({ dataDir: tmp, spawn: fakeSpawn(log) });
  const r = d.create({ task: 'Long task', agent: 'general-purpose', project, mode: 'read' });
  d.approve(r.id);
  d.cancel(r.id);
  assert.equal(log[0].child.killed, 'SIGTERM');
  await tick();
  assert.equal(d.get(r.id).status, 'cancelled');
});

test('runs past the concurrency limit wait in the queue', async () => {
  const log = [];
  const d = new Dispatcher({ dataDir: tmp, maxConcurrent: 1, spawn: fakeSpawn(log) });
  const a = d.create({ task: 'A', agent: 'general-purpose', project, mode: 'read' });
  const b = d.create({ task: 'B', agent: 'general-purpose', project, mode: 'read' });
  d.approve(a.id);
  d.approve(b.id);
  assert.equal(d.get(b.id).status, 'queued');
  line(log[0].child, { type: 'result', subtype: 'success', is_error: false, result: 'ok' });
  await tick();
  log[0].child.emit('close', 0);
  await tick();
  assert.equal(d.get(a.id).status, 'done');
  assert.equal(d.get(b.id).status, 'running');
  assert.equal(log.length, 2);
});

test('a missing claude binary fails cleanly', async () => {
  const d = new Dispatcher({ dataDir: tmp, claudeBin: path.join(tmp, 'no-such-claude') });
  const r = d.create({ task: 'x', agent: 'general-purpose', project, mode: 'read' });
  d.approve(r.id);
  await new Promise((res) => setTimeout(res, 200));
  assert.equal(d.get(r.id).status, 'failed');
  assert.match(d.get(r.id).error, /not found/);
});

test('bad input is refused with a plain message', () => {
  const d = new Dispatcher({ dataDir: tmp, spawn: fakeSpawn([]) });
  assert.throws(() => d.create({ task: '', agent: 'x', project, mode: 'read' }), /Describe the task/);
  assert.throws(() => d.create({ task: 'x', agent: '$(rm -rf /)', project, mode: 'read' }), /not valid/);
  assert.throws(() => d.create({ task: 'x', agent: 'a:b', project, mode: 'yolo' }), /Read-only/);
  assert.throws(() => d.create({ task: 'x', agent: 'a:b', project: { ...project, cwd: '/no/such/dir' }, mode: 'read' }), /no longer exists/);
});

test('runs still marked running after a restart are reported as interrupted', () => {
  fs.writeFileSync(path.join(tmp, 'dispatch.json'), JSON.stringify([{ id: 'aaaaaaaaaaaa', status: 'running', task: 't' }]));
  const d = new Dispatcher({ dataDir: tmp, spawn: fakeSpawn([]) });
  assert.equal(d.get('aaaaaaaaaaaa').status, 'failed');
});

test('parses claude mcp list output', () => {
  const out = parseMcpList([
    'Checking MCP server health…',
    '',
    'plugin:mcp-core:playwright: npx -y @playwright/mcp@latest - ✔ Connected',
    'plugin:mcp-core:ast-grep: uvx --from git+https://x ast-grep-server - ✘ Failed to connect',
    'github: https://api.githubcopilot.com/mcp/ (HTTP) - ! Needs authentication',
  ].join('\n'));
  assert.equal(out.length, 3);
  assert.deepEqual(out.map((s) => s.status), ['connected', 'failed', 'needs-auth']);
  assert.equal(out[0].plugin, 'mcp-core');
  assert.equal(out[0].server, 'playwright');
  assert.equal(out[2].plugin, null);
});
