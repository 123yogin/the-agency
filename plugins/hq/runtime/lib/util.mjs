// Shared helpers: trimming, clipping, file probes, timestamps, redaction.
// Adapted from humaedihume/kantor-agent runtime/lib/node/util.mjs (MIT, Copyright (c) 2026 humaedihume).
import fs from 'node:fs';
import path from 'node:path';

const WS = ' \t\n\r\0\x0B';

export function trim(s, chars = WS) {
  s = String(s);
  let a = 0;
  let b = s.length;
  while (a < b && chars.includes(s[a])) a++;
  while (b > a && chars.includes(s[b - 1])) b--;
  return s.slice(a, b);
}
export function ltrim(s, chars = WS) {
  s = String(s);
  let a = 0;
  while (a < s.length && chars.includes(s[a])) a++;
  return s.slice(a);
}
// length in code points, not UTF-16 units
export function cpLen(s) {
  let n = 0;
  for (const _ of String(s)) n++;
  return n;
}
export function clip(s, n) {
  s = String(s);
  if (cpLen(s) <= n) return s;
  return `${Array.from(s).slice(0, n - 1).join('')}…`;
}
// byte-order compare (stable across locales)
export function strcmp(a, b) {
  a = String(a ?? '');
  b = String(b ?? '');
  if (a === b) return 0;
  return Buffer.compare(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8')) < 0 ? -1 : 1;
}
export const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
export const isObj = (v) => v !== null && typeof v === 'object';
export const isPlainObj = (v) => isObj(v) && !Array.isArray(v);
export const values = (v) => (Array.isArray(v) ? v : isPlainObj(v) ? Object.values(v) : []);

export function mtimeSec(f) {
  try {
    return Math.floor(fs.statSync(f).mtimeMs / 1000);
  } catch {
    return 0;
  }
}
export function isFile(f) {
  try {
    return fs.statSync(f).isFile();
  } catch {
    return false;
  }
}
export function isDir(f) {
  try {
    return fs.statSync(f).isDirectory();
  } catch {
    return false;
  }
}
export function readText(f) {
  try {
    return fs.readFileSync(f, 'utf8');
  } catch {
    return null;
  }
}
export function readJson(f, fallback = null) {
  const t = readText(f);
  if (t === null) return fallback;
  try {
    return JSON.parse(t);
  } catch {
    return fallback;
  }
}
// '<dir>/*<suffix>' without hidden entries, byte-sorted
export function globDir(dir, suffix) {
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch {
    return [];
  }
  return names.filter((n) => !n.startsWith('.') && n.endsWith(suffix) && n.length > suffix.length)
    .sort(strcmp).map((n) => path.join(dir, n));
}
export const splitLines = (s) => String(s).split(/\r\n|[\n\x0b\x0c\r\x85\u2028\u2029]/);
export const basename = (p, ext = '') => {
  const b = path.basename(p);
  return ext && b.endsWith(ext) && b !== ext ? b.slice(0, -ext.length) : b;
};

// transcript timestamp ("2026-09-29T03:04:05.678Z") → epoch ms, or null
const TS = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,9}))?(Z|[+-]\d{2}:\d{2})$/;
export function tsMs(s) {
  if (typeof s !== 'string') return null;
  const m = TS.exec(s);
  if (!m) return null;
  const ms = m[7] ? Number(m[7].slice(0, 3).padEnd(3, '0')) : 0;
  let off = 0;
  if (m[8] !== 'Z') off = (m[8][0] === '-' ? -1 : 1) * (Number(m[8].slice(1, 3)) * 60 + Number(m[8].slice(4, 6))) * 60000;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6])) + ms - off;
}
export const isoMs = (ms) => new Date(ms).toISOString();

// Remove anything that looks like a credential before it can reach the page.
export function redact(s) {
  s = String(s);
  s = s.replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, '$1 •••');
  s = s.replace(/(pass(word|wd)?|secret|token|api[_-]?key|auth)(["'\t\n\x0b\f\r ]*[:=][\t\n\x0b\f\r ]*)([^\t\n\x0b\f\r ]+)/gi, '$1$3•••');
  s = s.replace(/--login=['"]?[^'"\t\n\x0b\f\r ]+/g, '--login=•••');
  s = s.replace(/\bsk-[A-Za-z0-9_-]{8,}/g, 'sk-•••');
  s = s.replace(/\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[abpr]-[A-Za-z0-9-]{10,}|AKIA[0-9A-Z]{16})\b/g, '•••');
  s = s.replace(/\b[a-f0-9]{40,}\b/gi, '•••');
  s = s.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '•••@•••');
  return s.replace(/(\b[a-z][a-z0-9+.-]*:\/\/)[^/\t\n\x0b\f\r :@]+:[^/\t\n\x0b\f\r @]+@/gi, '$1•••@');
}

export function firstLine(s) {
  for (let l of splitLines(s)) {
    l = trim(l.replace(/[#*`>|_]+/g, ' '));
    if (l !== '') return l.replace(/[ \t\n\x0b\f\r]+/g, ' ');
  }
  return '';
}
// one safe display line: first line, redacted before and after clipping
export const safeLine = (s, n) => clip(redact(firstLine(redact(String(s)))), n);
// tool text kept as one line (markdown characters kept)
export const oneLine = (s, n) => clip(redact(trim(redact(String(s)).replace(/[\t\n\x0b\f\r]+/g, ' '))), n);

// deterministic 32-bit hash
export function hash(s) {
  let h = 7;
  for (const b of Buffer.from(String(s), 'utf8')) h = (h * 31 + b) % 4294967296;
  return h;
}
