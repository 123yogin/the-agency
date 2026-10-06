import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { makeFixture } from './fixture.mjs';

let fx;
let tmp;
const NOW = Date.UTC(2026, 9, 6, 12, 0, 0);
before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hq-office-'));
  fx = makeFixture(tmp, { now: NOW });
  process.env.CLAUDE_CONFIG_DIR = fx.config;
  process.env.HQ_DATA_DIR = path.join(tmp, 'data');
});
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test('lists every project with its real path, newest first', async () => {
  const { listProjects } = await import('../runtime/lib/projects.mjs');
  const ps = listProjects();
  assert.equal(ps.length, 2);
  assert.equal(ps[0].cwd, fx.shop);
  assert.equal(ps[0].name, 'demo-shop');
  assert.equal(ps[1].cwd, fx.notes);
  assert.ok(ps.every((p) => p.exists));
});

test('summarises a transcript without ever reading tool results', async () => {
  const { Transcripts } = await import('../runtime/lib/transcripts.mjs');
  const { DEFAULTS } = await import('../runtime/lib/office.mjs');
  const t = new Transcripts({ root: path.join(fx.config, 'projects', fx.projects.shop), cwd: fx.shop, cfg: DEFAULTS });
  const scan = t.scan(Math.floor(NOW / 1000));
  assert.equal(scan.mains.length, 1);
  const m = scan.mains[0];
  assert.equal(m.cwd, fx.shop);
  assert.equal(m.skills['core-workflow:systematic-debugging'], 1);
  assert.equal(m.agents['engineering:code-reviewer'], 1);
  assert.equal(m.mcp['plugin_mcp-core_playwright'], 1);
  assert.deepEqual(m.todos.map((x) => x.status), ['completed', 'in_progress', 'pending']);
  assert.equal(scan.runs.length, 4);
  const blob = JSON.stringify(scan);
  assert.ok(!blob.includes('SECRET CONTENT'), 'tool_result content leaked');
  assert.ok(!blob.includes('secret draft body'), 'Write content leaked');
  assert.ok(!blob.includes('sk-live-abcdefghijklmnop'), 'secret leaked');
  assert.ok(m.events.some((e) => e.text === 'Reading cart.js'));
  assert.ok(m.events.some((e) => e.text === 'Running: Run cart tests'));
});

test('seats running subagents at desks under their real agent names and plugin colours', async () => {
  const { buildState } = await import('../runtime/lib/office.mjs');
  const { DEPARTMENTS } = await import('../runtime/lib/departments.mjs');
  const { findProject } = await import('../runtime/lib/projects.mjs');
  const s = buildState({ project: findProject(fx.projects.shop), now: NOW });
  assert.equal(s.lead.state, 'working');
  const working = s.staff.filter((m) => m.state === 'working');
  assert.deepEqual(working.map((m) => m.name).sort(), ['code-reviewer', 'prd-writer', 'seo-specialist']);
  const cr = s.staff.find((m) => m.name === 'code-reviewer');
  assert.equal(cr.plugin, 'engineering');
  assert.equal(cr.color, DEPARTMENTS.engineering.color);
  assert.equal(cr.run.task, 'Review checkout diff');
  assert.equal(s.runs.find((r) => r.agent_type === 'general-purpose').status, 'done');
  assert.ok(s.feed.some((e) => e.kind === 'assign' && e.text.includes('code-reviewer')));
  assert.equal(s.attention.length, 0);
});

test('flags a pending question as needing you', async () => {
  const { buildState } = await import('../runtime/lib/office.mjs');
  const { findProject } = await import('../runtime/lib/projects.mjs');
  const s = buildState({ project: findProject(fx.projects.notes), now: NOW });
  assert.equal(s.lead.state, 'idle');
  assert.equal(s.attention.length, 1);
  assert.equal(s.attention[0].kind, 'question');
});

test('dispatched runs sit at a desk and their own session is not shown as the Lead', async () => {
  const { buildState } = await import('../runtime/lib/office.mjs');
  const { findProject } = await import('../runtime/lib/projects.mjs');
  const s = buildState({
    project: findProject(fx.projects.notes),
    now: NOW,
    dispatchRuns: [{ id: 'abc123abc123', project: fx.projects.notes, agent: 'engineering:code-reviewer', task: 'Review notes', status: 'running', started: new Date(NOW - 5000).toISOString(), updated: new Date(NOW - 1000).toISOString(), events: [{ t: new Date(NOW - 1000).toISOString(), kind: 'tool', text: 'Reading README.md', tool: 'Read' }], tools: 1, tokens: 10, sessionId: 'bbbbbbbb-2222-4222-8222-222222222222' }],
  });
  const w = s.staff.find((m) => m.state === 'working');
  assert.equal(w.name, 'code-reviewer');
  assert.equal(w.run.dispatched, true);
  assert.equal(s.lead.sessions, 0);
});

test('a finished background run (claude -p) is not flagged as waiting for you; a finished terminal session is', async () => {
  const { buildState } = await import('../runtime/lib/office.mjs');
  const { findProject } = await import('../runtime/lib/projects.mjs');
  const make = (name, entrypoint) => {
    const cwd = path.join(tmp, name);
    fs.mkdirSync(cwd, { recursive: true });
    const dir = path.join(fx.config, 'projects', cwd.replace(/[^a-zA-Z0-9]/g, '-'));
    fs.mkdirSync(dir, { recursive: true });
    const at = (s) => new Date(NOW - s * 1000).toISOString();
    const rows = [
      { type: 'user', entrypoint, timestamp: at(120), cwd, message: { role: 'user', content: 'List the files' } },
      { type: 'assistant', entrypoint, timestamp: at(60), cwd, message: { id: `x-${name}`, role: 'assistant', content: [{ type: 'text', text: 'Done.' }], stop_reason: 'end_turn', usage: { input_tokens: 10, output_tokens: 5 } } },
    ];
    fs.writeFileSync(path.join(dir, `${name}.jsonl`), rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
    return findProject(cwd.replace(/[^a-zA-Z0-9]/g, '-'));
  };
  const bg = buildState({ project: make('bg-run', 'sdk-cli'), now: NOW });
  assert.equal(bg.attention.length, 0, 'headless run flagged as needing you');
  const term = buildState({ project: make('term-run', 'cli'), now: NOW });
  assert.equal(term.attention.length, 1);
  assert.equal(term.attention[0].kind, 'your-turn');
});

test('agents working for a Lead job sit at desks, labelled as the Lead\'s, and the Lead planner has a readable name', async () => {
  const { buildState } = await import('../runtime/lib/office.mjs');
  const { findProject } = await import('../runtime/lib/projects.mjs');
  const at = (s) => new Date(NOW - s * 1000).toISOString();
  const s = buildState({
    project: findProject(fx.projects.notes),
    now: NOW,
    dispatchRuns: [
      { id: 'aaa111aaa111', project: fx.projects.notes, job: 'job000job000', kind: 'task', agent: 'engineering:code-reviewer', task: 'Review notes', status: 'running', started: at(5), updated: at(1), events: [], tools: 0, tokens: 0 },
      { id: 'bbb222bbb222', project: fx.projects.notes, job: 'job000job000', kind: 'lead-plan', agent: 'hq:lead', task: 'Plan: tidy notes', status: 'done', started: at(40), ended: at(20), updated: at(20), events: [], tools: 0, tokens: 0 },
    ],
  });
  const w = s.staff.find((m) => m.state === 'working');
  assert.equal(w.run.fromJob, true);
  assert.ok(s.runs.some((r) => r.fromJob && r.label === 'Lead (HQ)'), 'the planner shows as Lead (HQ)');
  assert.ok(s.feed.some((e) => e.kind === 'assign' && e.text.startsWith('Lead (HQ) asked code-reviewer')));
});
