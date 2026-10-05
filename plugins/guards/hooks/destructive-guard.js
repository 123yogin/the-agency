#!/usr/bin/env node
// PreToolUse (Bash): block commands that destroy work or data and cannot be
// undone. The agent gets the reason and should ask the user instead.
//
// Blocked:
//   rm -r/-rf on /, ~, $HOME, a parent of the project, or a path outside it
//   git push --force / -f / --force-with-lease to main or master
//   git reset --hard
//   git clean -f with -x or -d outside a worktree-local scratch dir (any -fdx/-fd)
//   SQL DROP DATABASE / DROP SCHEMA / DROP TABLE / TRUNCATE
//
// Exit 0 = allow, exit 2 = block. Escape hatch: AGENCY_ALLOW_DESTRUCTIVE=1.
'use strict';

const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

function block(reason) {
  process.stderr.write(`BLOCKED by destructive-guard: ${reason} ` +
    'This cannot be undone. Stop and ask the user to confirm and run it themselves, ' +
    'or to set AGENCY_ALLOW_DESTRUCTIVE=1 for this session.\n');
  process.exit(2);
}

// Split a shell command into simple commands and their words. Quoted strings
// stay one word; good enough for guarding, not a full shell parser.
function commands(cmd) {
  const out = [];
  let words = [];
  let cur = '';
  let q = null;
  const push = () => { if (cur !== '') { words.push(cur); cur = ''; } };
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i];
    if (q) { if (c === q) q = null; else cur += c; continue; }
    if (c === '"' || c === "'") { q = c; continue; }
    if (c === '\\' && i + 1 < cmd.length) { cur += cmd[++i]; continue; }
    if (/\s/.test(c)) { push(); continue; }
    if (';&|()\n`'.includes(c)) { push(); if (words.length) out.push(words); words = []; continue; }
    cur += c;
  }
  push();
  if (words.length) out.push(words);
  return out;
}

function strip(words) {
  // Drop leading env assignments and wrappers: FOO=1 sudo command ...
  let i = 0;
  while (i < words.length && (/^\w+=/.test(words[i]) || ['sudo', 'command', 'exec', 'nohup', 'time', 'env'].includes(words[i]))) i++;
  return words.slice(i);
}

function expandHome(p) {
  const home = os.homedir();
  return p.replace(/^~(?=\/|$)/, home).replace(/^\$HOME(?=\/|$)/, home).replace(/^\$\{HOME\}(?=\/|$)/, home);
}

function checkRm(args, cwd) {
  const flags = args.filter((a) => a.startsWith('-'));
  const recursive = flags.some((f) => /^-[a-zA-Z]*[rR]/.test(f) || f === '--recursive');
  if (!recursive) return;
  const targets = args.filter((a) => !a.startsWith('-'));
  const home = os.homedir();
  for (const t of targets) {
    if (t.includes('$') && !/^\$\{?HOME\}?(\/|$)/.test(t)) block(`rm -r on an unexpanded variable (${t}) could resolve to anything.`);
    const abs = path.resolve(cwd, expandHome(t.replace(/\/\*$/, '')));
    if (abs === '/' || abs === home) block(`rm -r targets ${t}.`);
    const rel = path.relative(cwd, abs);
    if (rel === '') block(`rm -r targets the whole project directory (${t}).`);
    if (cwd.startsWith(abs + path.sep)) block(`rm -r targets ${abs}, which contains the project.`);
    if (rel.startsWith('..') || path.isAbsolute(rel)) {
      const tmp = [os.tmpdir(), '/tmp', '/private/tmp', '/var/folders'].some((d) => abs.startsWith(path.resolve(d) + path.sep));
      if (!tmp) block(`rm -r targets ${abs}, which is outside the project (${cwd}).`);
    }
  }
}

function currentBranch(cwd) {
  try {
    return execFileSync('git', ['symbolic-ref', '--short', 'HEAD'], { cwd, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch { return ''; }
}

function checkGit(args, cwd) {
  // Skip global options: git -C dir --no-pager push ...
  let i = 0;
  while (i < args.length && args[i].startsWith('-')) { if (args[i] === '-C' || args[i] === '-c') i++; i++; }
  const sub = args[i];
  const rest = args.slice(i + 1);
  if (sub === 'push') {
    const force = rest.some((a) => a === '-f' || a === '--force' || a.startsWith('--force-with-lease') || a === '--force-if-includes' || /^-[a-zA-Z]*f/.test(a) && !a.startsWith('--'));
    const plusRef = rest.some((a) => a.startsWith('+'));
    if (!force && !plusRef) return;
    const refs = rest.filter((a) => !a.startsWith('-'));
    const protectedRef = /(^|[:/+])(main|master)$/;
    if (refs.slice(1).some((r) => protectedRef.test(r))) block('force-push to main/master rewrites shared history.');
    if (refs.length <= 1 && ['main', 'master'].includes(currentBranch(cwd))) block('force-push from main/master rewrites shared history.');
  }
  if (sub === 'reset' && rest.includes('--hard')) block('git reset --hard discards uncommitted work.');
  if (sub === 'clean') {
    const f = rest.filter((a) => a.startsWith('-')).join('');
    if (/f/.test(f) && /[xd]/.test(f)) block('git clean -fd/-fx deletes untracked files, including ones never committed.');
  }
}

function checkSql(cmd) {
  if (/\bdrop\s+(database|schema|table)\b/i.test(cmd)) block('this drops a database, schema or table.');
  if (/\btruncate\s+(table\s+)?[\w."]+/i.test(cmd) && /\b(psql|mysql|sqlite3|sqlcmd|mongosh|duckdb|clickhouse|supabase|prisma|knex)\b|<<|-c\s|-e\s/i.test(cmd)) block('this truncates a table.');
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => {
  if (/^(1|true|yes)$/i.test(process.env.AGENCY_ALLOW_DESTRUCTIVE || '')) process.exit(0);
  let input;
  try { input = JSON.parse(raw || '{}'); } catch { process.exit(0); }
  const cmd = (input.tool_input && input.tool_input.command) || '';
  if (!cmd) process.exit(0);
  const cwd = input.cwd || process.cwd();

  checkSql(cmd);
  for (const words of commands(cmd)) {
    const w = strip(words);
    if (!w.length) continue;
    const prog = path.basename(w[0]);
    if (prog === 'rm') checkRm(w.slice(1), cwd);
    if (prog === 'git') checkGit(w.slice(1), cwd);
  }
  process.exit(0);
});
