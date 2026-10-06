import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import { hostAllowed, lanAccess } from '../runtime/lib/auth.mjs';
import { makeFixture } from './fixture.mjs';

let tmp;
let server;
let port;
const TOKEN = 'a'.repeat(48);

before(async () => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hq-auth-'));
  const fx = makeFixture(tmp);
  process.env.CLAUDE_CONFIG_DIR = fx.config;
  const { createApp } = await import('../runtime/lib/app.mjs');
  server = http.createServer(createApp({ token: TOKEN, dataDir: path.join(tmp, 'data'), claudeBin: '/bin/false' }));
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  port = server.address().port;
});
after(async () => {
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  fs.rmSync(tmp, { recursive: true, force: true });
});

function call(method, p, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: p, headers: { host: `127.0.0.1:${port}`, ...headers } }, (res) => {
      let b = '';
      res.on('data', (c) => { b += c; });
      res.on('end', () => resolve({ status: res.statusCode, body: b, headers: res.headers }));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}
const JSONH = { 'content-type': 'application/json' };
const task = JSON.stringify({ task: 'review my diff' });

test('reads work without a token; the page carries the token', async () => {
  const r = await call('GET', '/api/ping');
  assert.equal(r.status, 200);
  assert.equal(JSON.parse(r.body).app, 'agency-hq');
  const page = await call('GET', '/');
  assert.equal(page.status, 200);
  assert.ok(page.body.includes(TOKEN));
  assert.match(page.headers['content-security-policy'], /frame-ancestors 'none'/);
});

test('actions without the token are rejected', async () => {
  const r = await call('POST', '/api/route', { headers: JSONH, body: task });
  assert.equal(r.status, 403);
  assert.match(JSON.parse(r.body).error, /token/i);
});

test('actions with a wrong token are rejected', async () => {
  const r = await call('POST', '/api/route', { headers: { ...JSONH, 'x-hq-token': 'b'.repeat(48) }, body: task });
  assert.equal(r.status, 403);
});

test('cross-origin actions are rejected even with the token', async () => {
  const a = await call('POST', '/api/route', { headers: { ...JSONH, 'x-hq-token': TOKEN, origin: 'https://evil.example' }, body: task });
  assert.equal(a.status, 403);
  const b = await call('POST', '/api/route', { headers: { ...JSONH, 'x-hq-token': TOKEN, 'sec-fetch-site': 'cross-site' }, body: task });
  assert.equal(b.status, 403);
  const c = await call('POST', '/api/route', { headers: { 'content-type': 'text/plain', 'x-hq-token': TOKEN }, body: task });
  assert.equal(c.status, 403);
});

test('same-origin actions with the token succeed', async () => {
  const r = await call('POST', '/api/route', { headers: { ...JSONH, 'x-hq-token': TOKEN, origin: `http://127.0.0.1:${port}`, 'sec-fetch-site': 'same-origin' }, body: task });
  assert.equal(r.status, 200);
  const j = JSON.parse(r.body);
  assert.ok(j.ok);
  assert.ok(Array.isArray(j.suggestions) && j.suggestions.length > 0);
});

test('unknown Host headers are refused (DNS rebinding)', async () => {
  const r = await call('GET', '/api/ping', { headers: { host: 'evil.example' } });
  assert.equal(r.status, 421);
  assert.equal(hostAllowed('localhost:8790'), true);
  assert.equal(hostAllowed('192.168.1.4:8790'), true);
  assert.equal(hostAllowed('attacker.com'), false);
  assert.equal(hostAllowed(''), false);
});

test('asset paths cannot escape the public folder', async () => {
  const r = await call('GET', '/assets/..%2f..%2flib%2fauth.mjs');
  assert.equal(r.status, 404);
  const ok = await call('GET', '/assets/app.js');
  assert.equal(ok.status, 200);
});

test('LAN access needs the key from anything but loopback', () => {
  const remote = (headers = {}) => ({ socket: { remoteAddress: '192.168.1.20' }, headers });
  const u = (q = '') => new URL(`http://x/${q}`);
  assert.equal(lanAccess({ socket: { remoteAddress: '127.0.0.1' }, headers: {} }, u(), null).ok, true);
  assert.equal(lanAccess(remote(), u(), null).ok, false);
  assert.equal(lanAccess(remote(), u(), 'k'.repeat(32)).ok, false);
  const first = lanAccess(remote(), u(`?key=${'k'.repeat(32)}`), 'k'.repeat(32));
  assert.equal(first.ok, true);
  assert.match(first.setCookie, /HttpOnly; SameSite=Strict/);
  assert.equal(lanAccess(remote({ cookie: `hq_key=${'k'.repeat(32)}` }), u(), 'k'.repeat(32)).ok, true);
  assert.equal(lanAccess(remote({ cookie: 'hq_key=wrong' }), u(), 'k'.repeat(32)).ok, false);
});
