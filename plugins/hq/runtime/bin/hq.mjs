#!/usr/bin/env node
// Agency HQ launcher: start | stop | restart | status | url | autostart   [--open] [--lan] [--port N]
// Idempotent: "start" reuses a running server. Only the PID HQ recorded itself is ever stopped.
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

if (Number(process.versions.node.split('.')[0]) < 18) {
  console.error(`Agency HQ needs Node 18 or newer (found ${process.versions.node}). Install it from https://nodejs.org`);
  process.exit(1);
}
const { dataDir } = await import(new URL('../lib/paths.mjs', import.meta.url));

const SERVER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'server.mjs');
const DATA = dataDir();
const STATE = path.join(DATA, 'server.json');
const LOG = path.join(DATA, 'server.log');
const DEFAULT_PORT = 8790;

const argv = process.argv.slice(2);
const cmd = argv.find((a) => !a.startsWith('--')) || 'start';
const flag = (n) => argv.includes(`--${n}`);
const opt = (n) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? argv[i + 1] : undefined;
};

const readState = () => {
  try {
    return JSON.parse(fs.readFileSync(STATE, 'utf8'));
  } catch {
    return null;
  }
};
const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ping(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/api/ping', timeout: 1500 }, (res) => {
      let b = '';
      res.on('data', (c) => { b += c; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(b));
        } catch {
          resolve(null);
        }
      });
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

function portFree(port, host) {
  return new Promise((resolve) => {
    const s = net.createServer();
    s.once('error', () => resolve(false));
    s.listen(port, host, () => s.close(() => resolve(true)));
  });
}

function lanIp() {
  for (const list of Object.values(os.networkInterfaces())) {
    for (const i of list || []) if (i.family === 'IPv4' && !i.internal && !i.address.startsWith('169.254.')) return i.address;
  }
  return null;
}

function openBrowser(url) {
  const [bin, args] = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]] : ['xdg-open', [url]];
  try {
    spawn(bin, args, { stdio: 'ignore', detached: true }).unref();
  } catch {
    /* the URL is printed anyway */
  }
}

async function running() {
  const s = readState();
  if (!s || !s.pid || !alive(s.pid)) return null;
  const p = await ping(s.port);
  return p && p.app === 'agency-hq' && p.pid === s.pid ? s : null;
}

function report(s, note = 'Agency HQ is running.') {
  console.log(note);
  console.log(`Open:    ${s.url}`);
  if (s.lanUrl) {
    console.log(`Phone:   ${s.lanUrl}`);
    console.log('         (or click the phone button in HQ and scan the QR code). Anyone on your network with this link can see and dispatch agents.');
  }
  console.log('Stop:    /hq stop');
}

async function stop(quiet = false) {
  const s = readState();
  if (!s || !s.pid || !alive(s.pid)) {
    try { fs.unlinkSync(STATE); } catch { /* none */ }
    if (!quiet) console.log('Agency HQ is not running.');
    return;
  }
  const p = await ping(s.port);
  if (!p || p.pid !== s.pid) {
    // the recorded PID belongs to something else now; never signal it
    try { fs.unlinkSync(STATE); } catch { /* none */ }
    if (!quiet) console.log('Agency HQ is not running (stale record removed).');
    return;
  }
  process.kill(s.pid, 'SIGTERM');
  for (let i = 0; i < 30 && alive(s.pid); i++) await sleep(100);
  try { fs.unlinkSync(STATE); } catch { /* none */ }
  if (!quiet) console.log('Agency HQ stopped.');
}

async function start() {
  const wantLan = flag('lan');
  const cur = await running();
  if (cur && (!wantLan || cur.lanUrl)) {
    report(cur, 'Agency HQ is already running.');
    if (flag('open')) openBrowser(cur.url);
    return;
  }
  if (cur) await stop(true);
  const bind = wantLan ? '0.0.0.0' : '127.0.0.1';
  let port = Number(opt('port') || process.env.HQ_PORT || DEFAULT_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`Port must be a number between 1 and 65535 (got ${opt('port')}).`);
    process.exit(1);
  }
  let tries = 0;
  while (!(await portFree(port, bind))) {
    if (++tries > 20) {
      console.error('No free port found between 8790 and 8810. Pass one with --port.');
      process.exit(1);
    }
    port++;
  }
  const token = crypto.randomBytes(24).toString('hex');
  let lanKey = null;
  let lanUrl = null;
  if (wantLan) {
    const ip = lanIp();
    if (!ip) {
      console.error('No network address found. Connect to Wi-Fi or Ethernet and try again.');
      process.exit(1);
    }
    lanKey = crypto.randomBytes(16).toString('hex');
    lanUrl = `http://${ip}:${port}/?key=${lanKey}`;
  }
  const out = fs.openSync(LOG, 'a');
  const child = spawn(process.execPath, [SERVER], {
    detached: true,
    stdio: ['ignore', out, out],
    env: { ...process.env, HQ_PORT: String(port), HQ_BIND: bind, HQ_TOKEN: token, HQ_DATA_DIR: DATA, ...(lanKey ? { HQ_LAN_KEY: lanKey, HQ_LAN_URL: lanUrl } : {}) },
  });
  child.unref();
  const s = { pid: child.pid, port, bind, url: `http://127.0.0.1:${port}/`, lanUrl, startedAt: new Date().toISOString() };
  fs.writeFileSync(STATE, JSON.stringify(s), { mode: 0o600 });
  for (let i = 0; i < 80; i++) {
    const p = await ping(port);
    if (p && p.pid === child.pid) {
      report(s);
      if (flag('open')) openBrowser(s.url);
      return;
    }
    if (!alive(child.pid)) break;
    await sleep(100);
  }
  console.error(`Agency HQ did not start. Last log lines (${LOG}):`);
  try {
    console.error(fs.readFileSync(LOG, 'utf8').split('\n').slice(-8).join('\n'));
  } catch { /* no log */ }
  process.exit(1);
}

switch (cmd) {
  case 'start': await start(); break;
  case 'stop': await stop(); break;
  case 'restart': await stop(true); await start(); break;
  case 'status': {
    const s = await running();
    if (s) report(s);
    else console.log('Agency HQ is not running. Start it with /hq');
    break;
  }
  case 'url': {
    const s = await running();
    console.log(s ? s.url : 'Agency HQ is not running.');
    break;
  }
  case 'autostart':
    // SessionStart hook: does nothing unless HQ_AUTOSTART=1, and never prints when it does nothing.
    if (process.env.HQ_AUTOSTART === '1' && !(await running())) {
      await start();
    }
    break;
  default:
    console.error(`Unknown command "${cmd}". Use: start, stop, restart, status, url (options: --open, --lan, --port N).`);
    process.exit(2);
}
