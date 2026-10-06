// HTTP routes for Agency HQ. Exported as a request handler so tests can mount it on a random port.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SECURITY_HEADERS, checkAction, hostAllowed, isLoopback, lanAccess } from './auth.mjs';
import { Dispatcher, MODES } from './dispatch.mjs';
import { Daily } from './daily.mjs';
import { McpStatus, prereqs, togglePlugin } from './health.mjs';
import { Lead } from './lead.mjs';
import { DEFAULTS, buildState } from './office.mjs';
import { dataDir as defaultDataDir } from './paths.mjs';
import { findProject, listProjects } from './projects.mjs';
import { qrSvg } from './qr.mjs';
import { readRoster, rosterWithUsage } from './roster.mjs';
import { route } from './routing.mjs';

const RUNTIME = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(RUNTIME, 'public');
export const VERSION = '1.2.0';
const TYPES = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' };

const scriptJson = (v) => JSON.stringify(v).replace(/[<>&'\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);

export function createApp({
  token, lanKey = null, lanUrl = null, claudeBin = process.env.HQ_CLAUDE_BIN || 'claude', dataDir = defaultDataDir(),
  maxRuns = Number(process.env.HQ_MAX_RUNS) || 4, extraHosts = process.env.HQ_ALLOWED_HOSTS || '', spawn, exec, dailyExec, schedule = false,
} = {}) {
  if (!token) throw new Error('createApp needs a token');
  const cacheDir = path.join(dataDir, 'cache');
  fs.mkdirSync(cacheDir, { recursive: true });
  const dispatcher = new Dispatcher({ dataDir, claudeBin, maxConcurrent: maxRuns, ...(spawn ? { spawn } : {}) });
  const mcp = new McpStatus({ claudeBin, ...(exec ? { exec } : {}) });
  const lead = new Lead({ dataDir, dispatcher, getAgents: () => enabledAgents() });
  const daily = new Daily({ dataDir, lead, dispatcher, findProject, getAgents: () => enabledAgents(), ...(dailyExec ? { exec: dailyExec } : {}) });
  // The daily schedule only runs while HQ runs: a minute tick, plus one shortly after start to catch up.
  let timers = [];
  if (schedule) {
    const tick = () => {
      try {
        daily.tick();
      } catch (e) {
        console.error(`[hq] daily: ${e && e.stack ? e.stack : e}`);
      }
    };
    timers = [setTimeout(tick, 4000), setInterval(tick, 60000)];
    for (const t of timers) t.unref?.();
  }

  // Job view for the page; daily jobs carry their standup and notes.
  const jv = (j) => {
    const v = lead.view(j);
    if (j.daily) v.day = daily.dayFor(j.id);
    return v;
  };

  function send(res, status, headers, body) {
    res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
    res.end(body);
  }
  const json = (res, status, obj, extra = {}) => send(res, status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra }, JSON.stringify(obj));
  const fail = (res, status, error) => json(res, status, { ok: false, error });

  function readBody(req) {
    return new Promise((resolve, reject) => {
      let size = 0;
      const chunks = [];
      req.on('data', (c) => {
        size += c.length;
        if (size > 65536) {
          reject(new Error('Request body is too large.'));
          req.destroy();
        } else chunks.push(c);
      });
      req.on('end', () => {
        try {
          resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
        } catch {
          reject(new Error('Request body is not valid JSON.'));
        }
      });
      req.on('error', reject);
    });
  }

  function enabledAgents() {
    const roster = readRoster();
    const list = [];
    for (const p of roster.plugins) {
      if (!p.enabled) continue;
      for (const a of p.agents) list.push({ id: a.id, name: a.name, plugin: p.name, use: a.use, notFor: a.notFor, description: a.description });
    }
    return list;
  }

  function attentionAll(currentId) {
    const out = [...lead.attention(), ...daily.attention()];
    for (const r of dispatcher.list()) {
      if (r.status === 'review') out.push({ kind: 'review', run: r.id, project: r.project, text: `A task for ${r.agent} is waiting for your approval`, at: r.created });
    }
    const now = Date.now();
    for (const p of listProjects().filter((x) => now - x.lastActive <= DEFAULTS.attention_window * 4000).slice(0, 6)) {
      if (p.id === currentId) continue;
      try {
        out.push(...buildState({ project: p, cacheDir, now, dispatchRuns: dispatcher.list() }).attention);
      } catch {
        /* skip unreadable project */
      }
    }
    return out;
  }

  function page() {
    const html = fs.readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
    const cfg = { token, version: VERSION, lan: !!lanKey, modes: Object.fromEntries(Object.entries(MODES).map(([k, v]) => [k, { label: v.label, explain: v.explain }])) };
    return html.replace('<!--HQ_CONFIG-->', `<script>window.HQ = ${scriptJson(cfg)};</script>`);
  }

  async function handle(req, res) {
    if (!hostAllowed(req.headers.host, extraHosts)) return send(res, 421, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Unknown host.');
    let url;
    try {
      url = new URL(req.url, 'http://localhost');
    } catch {
      return send(res, 400, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Bad request.');
    }
    const lan = lanAccess(req, url, lanKey);
    if (!lan.ok) return send(res, lan.status, { 'Content-Type': 'text/plain; charset=utf-8' }, lan.error);
    const extra = lan.setCookie ? { 'Set-Cookie': lan.setCookie } : {};
    const p = url.pathname.replace(/\/+$/, '') || '/';

    if (req.method === 'GET' || req.method === 'HEAD') {
      if (p === '/') return send(res, 200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...extra }, page());
      if (p === '/api/ping') return json(res, 200, { app: 'agency-hq', version: VERSION, pid: process.pid });
      if (p === '/api/projects') return json(res, 200, { projects: listProjects() });
      if (p === '/api/state') {
        const projects = listProjects();
        const proj = (url.searchParams.get('project') && projects.find((x) => x.id === url.searchParams.get('project'))) || projects[0];
        if (!proj) return json(res, 200, { app: 'agency-hq', empty: true, projects: [], attention: attentionAll(null), dispatch: dispatcher.list().filter((r) => !r.job), jobs: [], busy: 0 });
        const state = buildState({ project: proj, cacheDir, now: Date.now(), dispatchRuns: dispatcher.list() });
        const jobs = lead.jobs.filter((j) => j.project === proj.id).slice(0, 10).map((j) => ({
          id: j.id, goal: j.goal, status: j.status, created: j.created, started: j.started, ended: j.ended,
          summary: j.summary ? j.summary.slice(0, 400) : null, tasks: j.tasks.length, done: j.tasks.filter((t) => t.status === 'done').length,
        }));
        const active = lead.jobs.filter((j) => ['planning', 'following', 'running', 'summarizing'].includes(j.status)).length;
        return json(res, 200, { ...state, jobs, activeJobs: active, attention: [...state.attention, ...attentionAll(proj.id)], dispatch: dispatcher.list().filter((r) => !r.job).slice(0, 20), busy: dispatcher.list().filter((r) => ['running', 'queued'].includes(r.status)).length });
      }
      if (p === '/api/roster') return json(res, 200, rosterWithUsage({ cacheDir }));
      if (p === '/api/dispatch') return json(res, 200, { runs: dispatcher.list().filter((r) => !r.job), max: dispatcher.max });
      if (p === '/api/jobs') return json(res, 200, { jobs: lead.jobs.map(jv), max: dispatcher.max });
      if (p === '/api/daily') return json(res, 200, { ...daily.list(), now: new Date().toISOString(), available: listProjects().filter((x) => x.exists).map((x) => ({ id: x.id, name: x.name, cwd: x.cwd })) });
      const bp = /^\/api\/daily\/branches\/([a-f0-9]{12})\/pr$/.exec(p);
      if (bp) return json(res, 200, daily.openPr(bp[1], { confirm: false }));
      const jm = /^\/api\/jobs\/([a-f0-9]{12})$/.exec(p);
      if (jm) {
        const j = lead.get(jm[1]);
        return j ? json(res, 200, { job: jv(j) }) : fail(res, 404, 'That job no longer exists.');
      }
      if (p === '/api/health') {
        const roster = readRoster();
        return json(res, 200, {
          plugins: roster.plugins.map(({ agents, skills, commands, mcp: m, ...rest }) => ({ ...rest, counts: { agents: agents.length, skills: skills.length, commands: commands.length, mcp: m.length } })),
          marketplace: roster.marketplace, found: roster.found, prereqs: prereqs(), mcp: mcp.state,
        });
      }
      if (p === '/api/lan') {
        if (!isLoopback(req.socket?.remoteAddress)) return fail(res, 403, 'The share link is only shown on the computer running HQ.');
        return json(res, 200, lanKey && lanUrl ? { enabled: true, url: lanUrl, qr: qrSvg(lanUrl) } : { enabled: false });
      }
      if (p.startsWith('/assets/')) return asset(req, res, p.slice('/assets/'.length));
      return send(res, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not found.');
    }

    const bad = checkAction(req, token);
    if (bad) return fail(res, 403, bad);
    let body;
    try {
      body = await readBody(req);
    } catch (e) {
      return fail(res, 400, e.message);
    }
    try {
      if (p === '/api/route') {
        return json(res, 200, { ok: true, suggestions: route(String(body.task || ''), enabledAgents()) });
      }
      if (p === '/api/dispatch') {
        const project = findProject(body.project);
        if (!project) return fail(res, 400, 'Pick a project from the list.');
        const agent = String(body.agent || 'general-purpose');
        if (agent !== 'general-purpose' && !enabledAgents().some((a) => a.id === agent)) return fail(res, 400, `${agent} is not an enabled agent. Turn its plugin on in Health first.`);
        const run = dispatcher.create({ task: body.task, agent, project, mode: body.mode });
        return json(res, 200, { ok: true, run: dispatcher.list().find((r) => r.id === run.id) });
      }
      const m = /^\/api\/dispatch\/([a-f0-9]{12})\/(approve|cancel|discard)$/.exec(p);
      if (m) {
        const r = dispatcher[m[2]](m[1]);
        return json(res, 200, { ok: true, run: r ? dispatcher.list().find((x) => x.id === r.id) || null : null });
      }
      if (p === '/api/jobs') {
        const project = findProject(body.project);
        if (!project) return fail(res, 400, 'Pick a project from the list.');
        const j = lead.create({ goal: body.goal, project, mode: body.mode, parallel: body.parallel ?? 2 });
        return json(res, 200, { ok: true, job: jv(j) });
      }
      const ja = /^\/api\/jobs\/([a-f0-9]{12})\/(plan|approve|replan|followup|stop|resume|finish|discard)$/.exec(p);
      if (ja) {
        const [, id, what] = ja;
        if (what === 'plan') lead.savePlan(id, body.tasks);
        else if (what === 'approve') lead.approve(id, { tasks: body.tasks, confirmEdit: body.confirmEdit === true });
        else if (what === 'replan') lead.replan(id);
        else if (what === 'followup') lead.followup(id, body.text);
        else if (what === 'stop') lead.stop(id);
        else if (what === 'resume') lead.resume(id);
        else if (what === 'finish') lead.finishNow(id);
        else lead.discard(id);
        const j = lead.get(id);
        return json(res, 200, { ok: true, job: j ? jv(j) : null });
      }
      const jt = /^\/api\/jobs\/([a-f0-9]{12})\/tasks\/([A-Za-z0-9_-]{1,24})\/(cancel|retry|skip)$/.exec(p);
      if (jt) {
        lead.taskAction(jt[1], jt[2], jt[3]);
        return json(res, 200, { ok: true, job: jv(lead.get(jt[1])) });
      }
      if (p === '/api/daily/pause') {
        daily.setPaused(body.paused === true);
        return json(res, 200, { ok: true, paused: daily.state.paused });
      }
      const dp = /^\/api\/daily\/projects\/([A-Za-z0-9._-]{1,255})(?:\/(standup|backlog|seen))?$/.exec(p);
      if (dp) {
        const [, id, what] = dp;
        if (!what) {
          const patch = {};
          for (const k of ['enabled', 'standupAt', 'wrapAt', 'focus', 'maxTasks', 'maxUsd']) if (body[k] !== undefined) patch[k] = body[k];
          return json(res, 200, { ok: true, project: daily.update(id, patch) });
        }
        if (what === 'standup') {
          const j = daily.runNow(id);
          return json(res, 200, { ok: true, job: jv(j), project: daily.view(id) });
        }
        if (what === 'backlog') {
          daily.setBacklog(id, body.items);
          return json(res, 200, { ok: true, project: daily.view(id) });
        }
        daily.markSeen(id);
        return json(res, 200, { ok: true, project: daily.view(id) });
      }
      const db = /^\/api\/daily\/branches\/([a-f0-9]{12})\/(pr|delete)$/.exec(p);
      if (db) {
        if (db[2] === 'delete') return json(res, 200, { ok: true, branch: daily.deleteBranch(db[1]) });
        if (body.confirm !== true) return fail(res, 400, 'Confirm first: HQ shows the exact commands before it pushes the branch and opens the PR.');
        return json(res, 200, { ok: true, ...daily.openPr(db[1], { confirm: true }) });
      }
      if (p === '/api/stop-all') {
        const jobs = lead.stopAll();
        let runs = 0;
        for (const r of dispatcher.list()) {
          if (!r.job && ['running', 'queued'].includes(r.status)) {
            dispatcher.cancel(r.id);
            runs++;
          }
        }
        return json(res, 200, { ok: true, jobs, runs });
      }
      if (p === '/api/health/mcp') return json(res, 200, { ok: true, mcp: mcp.refresh() });
      if (p === '/api/plugins/toggle') {
        const roster = readRoster();
        const plug = roster.plugins.find((x) => x.name === body.name);
        if (!plug) return fail(res, 400, 'That plugin is not part of this marketplace.');
        if (!plug.installed) return fail(res, 400, `${plug.name} is not installed yet. Run: ${plug.install}`);
        if (plug.name === 'hq' && !body.enabled) return fail(res, 400, 'HQ cannot switch itself off from here. Use /plugin in Claude Code.');
        const r = await togglePlugin({ claudeBin, key: plug.key, enable: !!body.enabled, ...(exec ? { exec } : {}) });
        return json(res, r.ok ? 200 : 500, { ok: r.ok, output: r.output, error: r.ok ? null : r.output });
      }
      return fail(res, 404, 'Unknown action.');
    } catch (e) {
      return fail(res, 400, e.message);
    }
  }

  function asset(req, res, rel) {
    let decoded;
    try {
      decoded = decodeURIComponent(rel);
    } catch {
      return send(res, 404, {}, '');
    }
    if (decoded.includes('\0')) return send(res, 404, {}, '');
    let base;
    let f;
    let st;
    try {
      base = fs.realpathSync(PUBLIC);
      f = fs.realpathSync(path.join(PUBLIC, decoded));
      st = fs.statSync(f);
    } catch {
      return send(res, 404, {}, '');
    }
    const type = TYPES[path.extname(f).toLowerCase()];
    if (!f.startsWith(base + path.sep) || !st.isFile() || !type) return send(res, 404, {}, '');
    const etag = `"${Math.floor(st.mtimeMs / 1000).toString(16)}-${st.size.toString(16)}"`;
    const h = { 'Content-Type': type, 'Cache-Control': 'no-cache', ETag: etag };
    if (req.headers['if-none-match'] === etag) return send(res, 304, h, '');
    return send(res, 200, { ...h, 'Content-Length': String(st.size) }, req.method === 'HEAD' ? '' : fs.readFileSync(f));
  }

  const handler = (req, res) => {
    handle(req, res).catch((e) => {
      console.error(`[hq] ${req.method} ${req.url}: ${e && e.stack ? e.stack : e}`);
      if (!res.headersSent) send(res, 500, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Server error.');
      else res.end();
    });
  };
  handler.dispatcher = dispatcher;
  handler.lead = lead;
  handler.daily = daily;
  handler.close = () => timers.forEach((t) => clearTimeout(t));
  handler.mcp = mcp;
  return handler;
}
