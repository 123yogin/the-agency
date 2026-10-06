import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { makeFixture } from './fixture.mjs';

let tmp;
before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hq-roster-'));
  const fx = makeFixture(tmp);
  process.env.CLAUDE_CONFIG_DIR = fx.config;
});
after(() => fs.rmSync(tmp, { recursive: true, force: true }));

test('discovers the marketplace plugins with install and enabled state', async () => {
  const { readRoster } = await import('../runtime/lib/roster.mjs');
  const r = readRoster();
  assert.equal(r.found, true);
  const by = Object.fromEntries(r.plugins.map((p) => [p.name, p]));
  assert.ok(by.engineering.installed && by.engineering.enabled);
  assert.ok(by.growth.installed && !by.growth.enabled, 'growth is switched off in settings');
  assert.ok(!by['mcp-creative'].installed && !by['mcp-creative'].enabled);
  assert.equal(by['mcp-creative'].defaultEnabled, false);
  assert.equal(by['mcp-creative'].install, 'claude plugin install mcp-creative@the-agency');
  assert.ok(by.hq, 'installed plugins missing from the manifest still show up');
});

test('reads agents, skills, commands and MCP servers with their trigger text', async () => {
  const { readRoster } = await import('../runtime/lib/roster.mjs');
  const eng = readRoster().plugins.find((p) => p.name === 'engineering');
  const cap = eng.agents.find((a) => a.name === 'capacitor-engineer');
  assert.ok(cap);
  assert.match(cap.use, /^Use when/);
  assert.match(cap.notFor, /^Not for/);
  assert.equal(cap.id, 'engineering:capacitor-engineer');
  const core = readRoster().plugins.find((p) => p.name === 'core-workflow');
  assert.ok(core.skills.some((s) => s.name === 'systematic-debugging' && s.invoke === '/core-workflow:systematic-debugging'));
  assert.ok(core.commands.some((c) => c.name === 'commit'));
  const mcp = readRoster().plugins.find((p) => p.name === 'mcp-core');
  assert.ok(mcp.mcp.some((m) => m.name === 'playwright'));
});

test('counts usage from transcripts', async () => {
  const { rosterWithUsage } = await import('../runtime/lib/roster.mjs');
  const r = rosterWithUsage({ ttlMs: 0 });
  const eng = r.plugins.find((p) => p.name === 'engineering');
  assert.equal(eng.agents.find((a) => a.name === 'code-reviewer').used, 1);
  const core = r.plugins.find((p) => p.name === 'core-workflow');
  assert.equal(core.skills.find((s) => s.name === 'systematic-debugging').used, 1);
  const mcp = r.plugins.find((p) => p.name === 'mcp-core');
  assert.equal(mcp.mcp.find((m) => m.name === 'playwright').used, 1);
});

test('an empty config dir gives an empty roster, not an error', async () => {
  const { readRoster } = await import('../runtime/lib/roster.mjs');
  const prev = process.env.CLAUDE_CONFIG_DIR;
  process.env.CLAUDE_CONFIG_DIR = path.join(tmp, 'nothing-here');
  try {
    const r = readRoster();
    assert.equal(r.found, false);
    assert.deepEqual(r.plugins, []);
  } finally {
    process.env.CLAUDE_CONFIG_DIR = prev;
  }
});
