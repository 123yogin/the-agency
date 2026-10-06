// Incremental summaries of Claude Code transcripts (JSONL). Only tool_use metadata and short assistant-text
// snippets are kept; tool_result contents are never read.
//   <root>/<session>.jsonl                                    main session (the Lead)
//   <root>/<session>/subagents/agent-<id>.jsonl + .meta.json  subagent runs (also subagents/workflows/<wf>/…)
// Adapted from humaedihume/kantor-agent runtime/lib/node/transcripts.mjs (MIT, Copyright (c) 2026 humaedihume).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  basename, clip, cpLen, globDir, isDir, isFile, isObj, isPlainObj, ltrim, mtimeSec, oneLine, readText, redact,
  safeLine, strcmp, trim, tsMs, values,
} from './util.mjs';

const CACHE_V = 4;
const HEAD_MAX = 1024; // fingerprint of the file head: a replaced (not appended) file is summarised again
const EVENTS_KEEP = 40;
const SEGS_KEEP = 20;
const STOPS_KEEP = 80;
const FILES_KEEP = 12;
const TODOS_KEEP = 40;
const utf8 = new TextDecoder('utf-8', { fatal: true });

const memo = new Map(); // file → {size, mtimeMs, s, head}

export class Transcripts {
  // root: the project's transcript folder; cwd: the project path (to shorten file paths); cacheDir: optional
  constructor({ root, cwd = null, cacheDir = null, cfg }) {
    this.root = root;
    this.cwd = cwd;
    this.cacheDir = cacheDir;
    this.cfg = cfg;
  }

  scan(nowSec, windowDays = this.cfg.window_days) {
    const root = this.root;
    if (!isDir(root)) return { exists: false, runs: [], mains: [] };
    const cutoff = nowSec - windowDays * 86400;
    let mainFiles = globDir(root, '.jsonl').map((f) => [f, mtimeSec(f)]).filter(([, mt]) => mt >= cutoff);
    mainFiles.sort((a, b) => b[1] - a[1] || strcmp(a[0], b[0]));
    mainFiles = mainFiles.slice(0, this.cfg.mains_max);
    const mains = mainFiles.map(([f]) => ({ ...this.summarize(f), session: basename(f, '.jsonl') }));

    const metas = [];
    for (const d of globDir(root, '')) {
      if (!isDir(d)) continue;
      for (const m of globDir(path.join(d, 'subagents'), '.meta.json')) metas.push([m, basename(d)]);
      for (const wf of globDir(path.join(d, 'subagents', 'workflows'), '')) {
        for (const m of globDir(wf, '.meta.json')) metas.push([m, basename(d)]);
      }
    }
    metas.sort((a, b) => strcmp(a[0], b[0]));
    const runs = [];
    for (const [metaFile, session] of metas) {
      const jsonl = `${metaFile.slice(0, -'.meta.json'.length)}.jsonl`;
      const name = basename(jsonl, '.jsonl');
      if (!name.startsWith('agent-') || !isFile(jsonl) || mtimeSec(jsonl) < cutoff) continue;
      let meta;
      try {
        meta = JSON.parse(readText(metaFile) ?? '');
      } catch {
        meta = null;
      }
      meta = isPlainObj(meta) ? meta : {};
      const type = typeof meta.agentType === 'string' && trim(meta.agentType) !== '' ? clip(trim(meta.agentType), 80) : 'general-purpose';
      const desc = typeof meta.description === 'string' ? safeLine(meta.description, 140) : '';
      const sum = this.summarize(jsonl);
      if (sum.started === null) continue; // no timestamped row yet
      runs.push({
        ...sum,
        id: name.slice(6),
        session,
        agentType: type,
        description: desc,
        parentAgent: typeof meta.parentAgentId === 'string' ? meta.parentAgentId : null,
      });
    }
    return { exists: true, runs, mains };
  }

  summarize(file) {
    let st;
    try {
      st = fs.statSync(file);
    } catch {
      st = { size: 0, mtimeMs: 0 };
    }
    const size = st.size;
    const m = memo.get(file);
    let s = m && m.size === size && m.mtimeMs === st.mtimeMs && m.head === headOf(file, m.s.headLen) ? m.s : null;
    const cacheFile = this.cacheDir ? path.join(this.cacheDir, `t-${crypto.createHash('md5').update(file).digest('hex')}.json`) : null;
    if (s === null && cacheFile && isFile(cacheFile)) {
      try {
        s = JSON.parse(readText(cacheFile) ?? '');
      } catch {
        s = null;
      }
    }
    if (!isPlainObj(s) || s.v !== CACHE_V || !(s.offset >= 0) || s.offset > size || !(s.headLen >= 0) || s.headLen > size
      || headOf(file, s.headLen) !== s.head) s = fresh();
    if (s.offset < size) {
      let fd = null;
      try {
        fd = fs.openSync(file, 'r');
        let pos = s.offset;
        let carry = Buffer.alloc(0);
        const buf = Buffer.alloc(1 << 20);
        let read;
        let readAt = pos;
        while ((read = fs.readSync(fd, buf, 0, buf.length, readAt)) > 0) {
          readAt += read;
          const chunk = carry.length ? Buffer.concat([carry, buf.subarray(0, read)]) : Buffer.from(buf.subarray(0, read));
          let start = 0;
          let nl;
          while ((nl = chunk.indexOf(10, start)) !== -1) {
            const lineBuf = chunk.subarray(start, nl + 1);
            pos += lineBuf.length;
            start = nl + 1;
            let row = null;
            try {
              row = JSON.parse(utf8.decode(lineBuf));
            } catch {
              row = null;
            }
            if (isPlainObj(row)) this.consume(s, row);
          }
          carry = chunk.subarray(start);
        }
        s.offset = pos; // a last line without '\n' is incomplete and read again later
        s.headLen = Math.min(size, HEAD_MAX);
        s.head = headOf(file, s.headLen);
      } catch {
        /* file vanished or locked: keep the summary we have */
      } finally {
        if (fd !== null) fs.closeSync(fd);
      }
      if (cacheFile) {
        try {
          fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
          fs.writeFileSync(cacheFile, JSON.stringify(s));
        } catch {
          /* cache is optional */
        }
      }
    }
    memo.set(file, { size, mtimeMs: st.mtimeMs, s, head: s.head });
    return {
      started: s.started, updated: s.updated, tools: s.tools, tokens: s.tokens.in + s.tokens.out + s.tokens.cache,
      events: s.events, lastKind: s.lastKind, lastTool: s.lastTool, limit: s.limit, files: s.files, todos: s.todos,
      todosAt: s.todosAt, todoSource: s.todoSource, segs: s.segs, stops: s.stops, skills: s.skills, mcp: s.mcp,
      agents: s.agents, cwd: s.cwd,
    };
  }

  consume(s, row) {
    const type = row.type ?? '';
    if (s.cwd === null && typeof row.cwd === 'string' && row.cwd.startsWith('/')) s.cwd = row.cwd;
    const t = typeof row.timestamp === 'string' && tsMs(row.timestamp) !== null ? row.timestamp : '';
    const msg = row.message;
    if (type !== 'user' && type !== 'assistant') return;
    if (t !== '') {
      if (s.started === null) s.started = t;
      s.updated = t;
    }
    if (!isObj(msg)) return;
    const content = msg.content ?? '';
    // work segments: opened by the first row, closed by a final answer (end_turn), reopened by a new message
    if (t !== '') {
      const last = s.segs.length ? s.segs[s.segs.length - 1] : null;
      if (last === null) s.segs.push([t, null]);
      else if (last[1] !== null && (type === 'assistant' || typeof content === 'string')) {
        if (tsMs(t) - tsMs(last[1]) <= this.cfg.cooldown * 1000) last[1] = null;
        else {
          s.segs.push([t, null]);
          if (s.segs.length > SEGS_KEEP) s.segs.shift();
        }
      }
    }
    if (type === 'user') {
      if (typeof content === 'string') {
        if (empty(row.isMeta) && !ltrim(content).startsWith('<') && (row.isSidechain ?? false) === false) {
          this.push(s, t, 'user', 'New instruction from you', null);
        }
        s.lastKind = 'user';
      } else if (isObj(content) && s.lastKind !== 'handback') {
        s.lastKind = 'result';
      }
      return;
    }
    const id = typeof msg.id === 'string' ? msg.id : '';
    if (id !== '' && id !== s.lastMsgId && isObj(msg.usage)) {
      const u = msg.usage;
      s.tokens.in += int(u.input_tokens);
      s.tokens.out += int(u.output_tokens);
      s.tokens.cache += int(u.cache_read_input_tokens) + int(u.cache_creation_input_tokens);
      s.lastMsgId = id;
    }
    let hasTool = false;
    let hasText = false;
    let handback = false;
    for (const b of isObj(content) ? values(content) : []) {
      if (!isObj(b)) continue;
      const bt = b.type ?? '';
      if (bt === 'tool_use') {
        hasTool = true;
        const name = typeof b.name === 'string' ? b.name : '?';
        const inp = isPlainObj(b.input) ? b.input : {};
        s.tools++;
        s.lastTool = clip(name, 80);
        const [text, p] = this.describeTool(name, inp);
        if (p !== null && ['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(name)) {
          s.files = s.files.filter((f) => f !== p);
          s.files.push(p);
          if (s.files.length > FILES_KEEP) s.files.shift();
        }
        if (name === 'TaskStop' && t !== '') {
          const tid = typeof inp.task_id === 'string' ? inp.task_id : typeof inp.shell_id === 'string' ? inp.shell_id : '';
          if (/^[A-Za-z0-9_-]{1,64}$/.test(tid)) {
            s.stops.push([tid, t]);
            if (s.stops.length > STOPS_KEEP) s.stops.shift();
          }
        }
        if (name === 'Skill' && typeof inp.skill === 'string') bump(s.skills, clip(inp.skill, 80));
        if ((name === 'Agent' || name === 'Task') && typeof inp.subagent_type === 'string') bump(s.agents, clip(inp.subagent_type, 80));
        if (name.startsWith('mcp__')) bump(s.mcp, clip(name.split('__')[1] || name, 80));
        this.todo(s, name, inp, t);
        if (name === 'SubagentHandback') handback = true;
        this.push(s, t, 'tool', text, name);
      } else if (bt === 'text') {
        const txt = typeof b.text === 'string' ? trim(b.text) : '';
        if (txt === '') continue;
        hasText = true;
        if (/(usage limit|rate limit|limit reached|resets? (at|in))/i.test(txt) && cpLen(txt) < 400) s.limit = clip(redact(txt), 200);
        this.push(s, t, 'text', safeLine(txt, 180), null);
      }
    }
    const stop = typeof msg.stop_reason === 'string' ? msg.stop_reason : '';
    if (handback) s.lastKind = 'handback';
    else if (hasTool) s.lastKind = 'tool';
    else if (hasText) s.lastKind = stop === 'end_turn' ? 'final' : 'text';
    else if (s.lastKind === null) s.lastKind = 'thinking';
    if (hasTool) s.limit = null;
    if (stop === 'end_turn' && t !== '' && s.segs.length && s.segs[s.segs.length - 1][1] === null) s.segs[s.segs.length - 1][1] = t;
  }

  todo(s, name, inp, t) {
    if (name === 'TodoWrite' && isObj(inp.todos)) {
      const items = [];
      for (const td of values(inp.todos)) {
        if (!isObj(td)) continue;
        const text = typeof td.content === 'string' ? td.content : typeof td.subject === 'string' ? td.subject : '';
        if (trim(text) === '') continue;
        items.push({ text: safeLine(text, 120), status: todoStatus(td.status) });
        if (items.length >= TODOS_KEEP) break;
      }
      s.todos = items;
      s.todosAt = t;
      s.todoSource = 'TodoWrite';
      return;
    }
    if (name === 'TaskCreate') {
      const subject = typeof inp.subject === 'string' ? inp.subject : typeof inp.description === 'string' ? inp.description : '';
      s.taskSeq++;
      if (trim(subject) === '') return;
      s.tasks[`#${s.taskSeq}`] = { text: safeLine(subject, 120), status: 'pending' };
      const keys = Object.keys(s.tasks);
      if (keys.length > TODOS_KEEP) delete s.tasks[keys[0]];
    } else if (name === 'TaskUpdate') {
      let tid = inp.taskId ?? inp.id ?? null;
      tid = typeof tid === 'string' || Number.isInteger(tid) ? `#${tid}` : '';
      if (!Object.hasOwn(s.tasks, tid)) return;
      if (inp.status === 'deleted') delete s.tasks[tid];
      else {
        if (typeof inp.status === 'string') s.tasks[tid].status = todoStatus(inp.status);
        if (typeof inp.subject === 'string' && trim(inp.subject) !== '') s.tasks[tid].text = safeLine(inp.subject, 120);
      }
    } else return;
    s.todos = Object.values(s.tasks);
    s.todosAt = t;
    s.todoSource = 'Task';
  }

  push(s, t, kind, text, tool) {
    if (t === '') return;
    s.events.push({ t, kind, text, tool });
    if (s.events.length > EVENTS_KEEP) s.events.splice(0, s.events.length - EVENTS_KEEP);
  }

  describeTool(name, inp) {
    return describeTool(name, inp, this.cwd);
  }
}

// Plain-English line for one tool call. Shows the file path or a command summary, never file contents.
export function describeTool(name, inp, cwd = null) {
  const str = (v) => (typeof v === 'string' ? v : typeof v === 'number' && Number.isInteger(v) ? String(v) : '');
  let p = null;
  for (const k of ['file_path', 'notebook_path']) {
    if (typeof inp[k] === 'string' && inp[k] !== '') {
      const v = inp[k];
      p = cwd && v.startsWith(`${cwd}/`) ? v.slice(cwd.length + 1) : basename(v);
      break;
    }
  }
  let text;
  switch (name) {
    case 'Read': text = `Reading ${p ?? ''}`; break;
    case 'Write': text = `Writing ${p ?? ''}`; break;
    case 'Edit': case 'MultiEdit': case 'NotebookEdit': text = `Editing ${p ?? ''}`; break;
    case 'Bash': text = `Running: ${str(inp.description) !== '' ? str(inp.description) : clip(str(inp.command), 60)}`; break;
    case 'Grep': text = `Searching for '${clip(str(inp.pattern), 50)}'`; break;
    case 'Glob': text = `Finding files ${clip(str(inp.pattern), 60)}`; break;
    case 'Agent': case 'Task': text = `Delegating: ${str(inp.description) !== '' ? str(inp.description) : 'subagent'}`; break;
    case 'SendMessage': text = 'Messaging an agent'; break;
    case 'AskUserQuestion': text = 'Asking you a question'; break;
    case 'WebFetch': text = 'Reading a web page'; break;
    case 'WebSearch': text = 'Searching the web'; break;
    case 'Skill': text = `Using skill ${str(inp.skill)}`; break;
    case 'TodoWrite': text = 'Updating the task list'; break;
    case 'TaskCreate': text = `Adding task: ${str(inp.subject)}`; break;
    case 'TaskUpdate': text = `Updating a task${str(inp.status) !== '' ? ` to ${str(inp.status)}` : ''}`; break;
    case 'TaskStop': text = 'Stopping a subagent'; break;
    case 'SubagentHandback': text = 'Handing back a report'; break;
    case 'ToolSearch': text = 'Looking up tools'; break;
    default:
      if (name.startsWith('mcp__')) {
        const parts = name.split('__');
        const server = (parts[1] || 'MCP').startsWith('plugin_') ? parts[1].split('_').slice(2).join('_') || parts[1] : parts[1] || 'MCP';
        text = `Using ${clip(server, 40)}: ${clip((parts.slice(2).join(' ') || 'tool').replace(/_/g, ' '), 40)}`;
      } else text = clip(name, 60);
  }
  return [oneLine(text, 160), p];
}

function bump(map, key) {
  map[key] = (map[key] || 0) + 1;
}
function headOf(file, n) {
  if (!(n > 0)) return '';
  let fd = null;
  try {
    fd = fs.openSync(file, 'r');
    const b = Buffer.alloc(n);
    const got = fs.readSync(fd, b, 0, n, 0);
    return got === n ? crypto.createHash('md5').update(b).digest('hex') : '';
  } catch {
    return '';
  } finally {
    if (fd !== null) fs.closeSync(fd);
  }
}
function fresh() {
  return {
    v: CACHE_V, offset: 0, headLen: 0, head: '', started: null, updated: null, tools: 0, tokens: { in: 0, out: 0, cache: 0 }, lastMsgId: null,
    events: [], lastKind: null, lastTool: null, limit: null, files: [], todos: null, todosAt: null, todoSource: null, tasks: {}, taskSeq: 0,
    segs: [], stops: [], skills: {}, mcp: {}, agents: {}, cwd: null,
  };
}
function todoStatus(v) {
  return ['pending', 'in_progress', 'completed'].includes(v) ? v : 'pending';
}
function int(v) {
  return typeof v === 'number' && Number.isFinite(v) ? Math.trunc(v) : 0;
}
function empty(v) {
  return v === undefined || v === null || v === false || v === 0 || v === '' || v === '0' || (Array.isArray(v) && !v.length) || (isPlainObj(v) && !Object.keys(v).length);
}
