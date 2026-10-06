// Every project Claude Code has a transcript folder for, newest activity first.
import fs from 'node:fs';
import path from 'node:path';
import { projectsDir } from './paths.mjs';
import { basename, globDir, isDir, mtimeSec } from './util.mjs';

const cache = new Map(); // dirName → {stamp, cwd}

// The real project path is not recoverable from the folder name ('-' replaces every symbol),
// so read the "cwd" field from the first rows of the newest transcript.
export function readCwd(file, maxBytes = 65536) {
  let fd = null;
  try {
    fd = fs.openSync(file, 'r');
    const b = Buffer.alloc(maxBytes);
    const n = fs.readSync(fd, b, 0, maxBytes, 0);
    for (const line of b.subarray(0, n).toString('utf8').split('\n')) {
      if (!line.includes('"cwd"')) continue;
      try {
        const row = JSON.parse(line);
        if (typeof row.cwd === 'string' && row.cwd.startsWith('/')) return row.cwd;
      } catch {
        /* partial last line */
      }
    }
  } catch {
    /* unreadable */
  } finally {
    if (fd !== null) fs.closeSync(fd);
  }
  return null;
}

function newestActivity(dir) {
  let newest = 0;
  let newestMain = null;
  let newestMainAt = 0;
  for (const f of globDir(dir, '.jsonl')) {
    const m = mtimeSec(f);
    if (m > newest) newest = m;
    if (m > newestMainAt) {
      newestMainAt = m;
      newestMain = f;
    }
  }
  for (const d of globDir(dir, '')) {
    if (!isDir(d)) continue;
    const sub = path.join(d, 'subagents');
    for (const f of globDir(sub, '.jsonl')) newest = Math.max(newest, mtimeSec(f));
  }
  return { newest, newestMain, sessions: globDir(dir, '.jsonl').length };
}

export function listProjects() {
  const root = projectsDir();
  const out = [];
  for (const dir of globDir(root, '')) {
    if (!isDir(dir)) continue;
    const id = basename(dir);
    const { newest, newestMain, sessions } = newestActivity(dir);
    if (!newest) continue;
    let c = cache.get(id);
    if (!c || c.stamp !== newest) {
      let cwd = newestMain ? readCwd(newestMain) : null;
      if (!cwd) {
        // fall back to any transcript, including subagent ones
        for (const d of globDir(dir, '')) {
          for (const f of globDir(path.join(d, 'subagents'), '.jsonl')) {
            cwd = readCwd(f);
            if (cwd) break;
          }
          if (cwd) break;
        }
      }
      c = { stamp: newest, cwd };
      cache.set(id, c);
    }
    out.push({
      id,
      cwd: c.cwd,
      name: c.cwd ? basename(c.cwd) || c.cwd : id.replace(/^-+/, ''),
      lastActive: newest * 1000,
      sessions,
      exists: c.cwd ? isDir(c.cwd) : false,
    });
  }
  out.sort((a, b) => b.lastActive - a.lastActive || (a.id < b.id ? -1 : 1));
  return out;
}

export function findProject(id) {
  if (typeof id !== 'string' || !/^[A-Za-z0-9._-]{1,255}$/.test(id)) return null;
  return listProjects().find((p) => p.id === id) || null;
}
