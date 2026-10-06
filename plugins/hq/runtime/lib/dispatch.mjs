// Dispatch: review → approve → run `claude -p` headless in a project folder, stream progress, cancel.
// Nothing runs until the person approves the exact command on the Review step.
import { spawn as nodeSpawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describeTool } from './transcripts.mjs';
import { isDir, isPlainObj, readJson, redact, safeLine, values } from './util.mjs';

const KEEP = 50;
const EVENTS_KEEP = 60;
export const MODES = {
  read: {
    label: 'Read-only',
    explain: 'Can read and search files. Cannot edit files or run shell commands.',
    args: ['--permission-mode', 'default', '--disallowedTools', 'Edit,Write,NotebookEdit,MultiEdit,Bash'],
  },
  edit: {
    label: 'Can edit files',
    explain: 'Can create and change files in the project without asking. Shell commands still need your allow-list.',
    args: ['--permission-mode', 'acceptEdits'],
  },
};

export function buildArgs({ task, agent, mode }) {
  const args = ['-p', task, '--output-format', 'stream-json', '--verbose'];
  if (agent && agent !== 'auto' && agent !== 'general-purpose') args.push('--agent', agent);
  args.push(...MODES[mode].args);
  return args;
}

// Shell-quoted command line, for showing on the Review step.
export function displayCommand(bin, args) {
  const q = (s) => (/^[A-Za-z0-9_./:=,@%+-]+$/.test(s) ? s : `'${String(s).replace(/'/g, "'\\''")}'`);
  return [bin, ...args].map(q).join(' ');
}

export class Dispatcher {
  constructor({ dataDir, claudeBin = 'claude', maxConcurrent = 2, spawn = nodeSpawn, onChange = () => {} }) {
    this.file = path.join(dataDir, 'dispatch.json');
    this.bin = claudeBin;
    this.max = Math.max(1, maxConcurrent);
    this.spawn = spawn;
    this.onChange = onChange;
    this.children = new Map();
    this.runs = [];
    const saved = readJson(this.file, []);
    for (const r of Array.isArray(saved) ? saved : []) {
      if (!isPlainObj(r) || typeof r.id !== 'string') continue;
      if (r.status === 'running' || r.status === 'queued') {
        r.status = 'failed';
        r.error = 'HQ stopped while this run was in progress.';
        r.ended = r.ended || new Date().toISOString();
      }
      this.runs.push(r);
    }
  }

  list() {
    return this.runs.map(({ args, ...r }) => r);
  }

  get(id) {
    return this.runs.find((r) => r.id === id) || null;
  }

  save() {
    try {
      const keep = this.runs.slice(0, KEEP);
      fs.writeFileSync(this.file, JSON.stringify(keep));
    } catch {
      /* best effort */
    }
    this.onChange();
  }

  // Creates a run in "review". Throws an Error with a user-facing message on bad input.
  create({ task, agent, project, mode }) {
    task = String(task || '').trim();
    if (!task) throw new Error('Describe the task first.');
    if (task.length > 4000) throw new Error('Keep the task under 4,000 characters.');
    agent = String(agent || 'general-purpose');
    if (!/^[A-Za-z0-9][A-Za-z0-9:_.-]{0,100}$/.test(agent)) throw new Error('That agent name is not valid.');
    if (!MODES[mode]) throw new Error('Pick Read-only or Can edit files.');
    if (!project || typeof project.cwd !== 'string' || !isDir(project.cwd)) throw new Error('That project folder no longer exists on this computer.');
    const args = buildArgs({ task, agent, mode });
    const run = {
      id: crypto.randomBytes(6).toString('hex'),
      task, agent, mode, modeLabel: MODES[mode].label, modeExplain: MODES[mode].explain,
      project: project.id, projectName: project.name, cwd: project.cwd,
      status: 'review', created: new Date().toISOString(), started: null, updated: null, ended: null,
      command: displayCommand(this.bin, args), args,
      events: [], tools: 0, tokens: 0, result: null, error: null, costUsd: null, durationMs: null, sessionId: null,
    };
    this.runs.unshift(run);
    this.save();
    return run;
  }

  approve(id) {
    const r = this.get(id);
    if (!r) throw new Error('That run no longer exists.');
    if (r.status !== 'review') throw new Error('This run was already approved or closed.');
    r.status = 'queued';
    r.updated = new Date().toISOString();
    this.save();
    this.pump();
    return r;
  }

  cancel(id) {
    const r = this.get(id);
    if (!r) throw new Error('That run no longer exists.');
    if (r.status === 'review' || r.status === 'queued') {
      r.status = 'cancelled';
      r.ended = new Date().toISOString();
      this.save();
      this.pump();
      return r;
    }
    if (r.status !== 'running') throw new Error('This run has already finished.');
    r.cancelRequested = true;
    const child = this.children.get(id);
    if (child) {
      child.kill('SIGTERM');
      const t = setTimeout(() => {
        if (this.children.has(id)) child.kill('SIGKILL');
      }, 3000);
      t.unref?.();
    }
    return r;
  }

  discard(id) {
    const r = this.get(id);
    if (!r) return null;
    if (r.status === 'running' || r.status === 'queued') throw new Error('Cancel the run before removing it.');
    this.runs = this.runs.filter((x) => x.id !== id);
    this.save();
    return r;
  }

  running() {
    return this.runs.filter((r) => r.status === 'running').length;
  }

  pump() {
    const queued = this.runs.filter((r) => r.status === 'queued').reverse(); // oldest first
    for (const r of queued) {
      if (this.running() >= this.max) break;
      this.start(r);
    }
  }

  start(r) {
    const now = new Date().toISOString();
    r.status = 'running';
    r.started = now;
    r.updated = now;
    let child;
    try {
      child = this.spawn(this.bin, r.args || buildArgs(r), { cwd: r.cwd, env: { ...process.env, HQ_DISPATCH: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) {
      this.finish(r, null, `Could not start Claude Code: ${e.message}`);
      return;
    }
    this.children.set(r.id, child);
    let buf = '';
    let errTail = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      buf += chunk;
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 1);
        if (line.trim()) this.consume(r, line);
      }
    });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk) => {
      errTail = (errTail + chunk).slice(-2000);
    });
    child.on('error', (e) => {
      this.children.delete(r.id);
      this.finish(r, null, e.code === 'ENOENT' ? 'Claude Code (the claude command) was not found on this computer.' : e.message);
    });
    child.on('close', (code) => {
      if (buf.trim()) this.consume(r, buf);
      this.children.delete(r.id);
      if (r.status !== 'running') return;
      this.finish(r, code, errTail);
    });
    this.save();
  }

  finish(r, code, errText) {
    r.ended = new Date().toISOString();
    r.updated = r.ended;
    if (r.cancelRequested) {
      r.status = 'cancelled';
    } else if (r.result !== null && !r.isError && (code === 0 || code === null)) {
      r.status = 'done';
    } else {
      r.status = 'failed';
      if (!r.error) r.error = safeLine(errText || (r.result ?? '') || `Claude Code exited with code ${code}.`, 300) || `Claude Code exited with code ${code}.`;
    }
    delete r.cancelRequested;
    this.save();
    this.pump();
  }

  consume(r, line) {
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if (!isPlainObj(msg)) return;
    const t = new Date().toISOString();
    r.updated = t;
    if (msg.type === 'system' && msg.subtype === 'init' && typeof msg.session_id === 'string') {
      r.sessionId = msg.session_id;
    } else if (msg.type === 'assistant' && isPlainObj(msg.message)) {
      for (const b of values(msg.message.content)) {
        if (!isPlainObj(b)) continue;
        if (b.type === 'tool_use') {
          r.tools++;
          const [text] = describeTool(String(b.name || '?'), isPlainObj(b.input) ? b.input : {}, r.cwd);
          this.event(r, { t, kind: 'tool', text, tool: String(b.name || '') });
        } else if (b.type === 'text' && typeof b.text === 'string' && b.text.trim()) {
          this.event(r, { t, kind: 'text', text: safeLine(b.text, 180), tool: null });
        }
      }
      const u = msg.message.usage;
      if (isPlainObj(u)) r.tokens += (u.output_tokens || 0);
    } else if (msg.type === 'result') {
      r.result = typeof msg.result === 'string' ? redact(msg.result).slice(0, 8000) : '';
      r.isError = !!msg.is_error || (typeof msg.subtype === 'string' && msg.subtype !== 'success');
      if (r.isError && !r.error) r.error = safeLine(r.result || msg.subtype || 'The run ended with an error.', 300);
      if (typeof msg.duration_ms === 'number') r.durationMs = msg.duration_ms;
      if (typeof msg.total_cost_usd === 'number') r.costUsd = msg.total_cost_usd;
      const u = msg.usage;
      if (isPlainObj(u)) r.tokens = (u.input_tokens || 0) + (u.output_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
      if (typeof msg.session_id === 'string') r.sessionId = msg.session_id;
    }
    this.onChange();
  }

  event(r, e) {
    r.events.push(e);
    if (r.events.length > EVENTS_KEEP) r.events.splice(0, r.events.length - EVENTS_KEEP);
  }

  // Stop every child this process started (on shutdown).
  stopAll() {
    for (const [id, child] of this.children) {
      const r = this.get(id);
      if (r) r.cancelRequested = true;
      child.kill('SIGTERM');
    }
  }
}
