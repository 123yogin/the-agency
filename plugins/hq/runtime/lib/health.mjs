// Health: prerequisites on PATH, MCP server status (from `claude mcp list`), and plugin on/off toggles.
import { execFile, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { homeDir } from './paths.mjs';
import { clip, redact } from './util.mjs';

const EXTRA_PATH = ['/usr/local/bin', '/opt/homebrew/bin', path.join(homeDir(), '.local', 'bin'), path.join(homeDir(), '.cargo', 'bin'), '/usr/bin', '/bin'];

export function which(cmd, envPath = process.env.PATH || '') {
  const dirs = [...envPath.split(path.delimiter), ...EXTRA_PATH].filter(Boolean);
  for (const d of dirs) {
    const f = path.join(d, cmd);
    try {
      fs.accessSync(f, fs.constants.X_OK);
      if (fs.statSync(f).isFile()) return f;
    } catch {
      /* not here */
    }
  }
  return null;
}

const mac = process.platform === 'darwin';
export const PREREQS = [
  { id: 'node', name: 'Node.js', why: 'Runs HQ and most MCP servers.', required: true, fix: mac ? 'brew install node' : 'Install Node.js 20+ from https://nodejs.org' },
  { id: 'claude', name: 'Claude Code', why: 'Runs dispatched tasks and plugin toggles.', required: true, fix: 'npm install -g @anthropic-ai/claude-code' },
  { id: 'git', name: 'git', why: 'Used by worktree and review skills.', required: false, fix: mac ? 'xcode-select --install' : 'sudo apt install git' },
  { id: 'uv', name: 'uv', why: 'Installs Python-based MCP servers.', required: false, fix: 'curl -LsSf https://astral.sh/uv/install.sh | sh' },
  { id: 'uvx', name: 'uvx', why: 'Starts Python-based MCP servers (MarkItDown, Excel, YouTube).', required: false, fix: 'curl -LsSf https://astral.sh/uv/install.sh | sh' },
  { id: 'ast-grep', name: 'ast-grep', why: 'Needed by the ast-grep MCP server.', required: false, fix: 'npm install -g @ast-grep/cli' },
  { id: 'docker', name: 'Docker', why: 'Only for container-based MCP servers (Terraform, Crawl4AI).', required: false, fix: mac ? 'brew install --cask docker' : 'https://docs.docker.com/engine/install/' },
];

export function prereqs({ whichFn = which } = {}) {
  return PREREQS.map((p) => {
    const at = whichFn(p.id);
    let version = null;
    if (at) {
      try {
        const r = spawnSync(at, ['--version'], { timeout: 4000, encoding: 'utf8' });
        version = clip(String(r.stdout || r.stderr || '').trim().split('\n')[0], 60) || null;
      } catch {
        version = null;
      }
    }
    return { ...p, found: !!at, path: at, version };
  });
}

// "plugin:mcp-core:playwright: npx -y @playwright/mcp@latest - ✔ Connected"
export function parseMcpList(text) {
  const out = [];
  for (const raw of String(text || '').split('\n')) {
    const line = raw.trim();
    const m = /^(.+?):\s+(.+)\s+-\s+(✔|✓|✘|✗|⏸|!|⚠)\s*(.*)$/.exec(line);
    if (!m) continue;
    const name = m[1];
    const sym = m[3];
    const status = sym === '✔' || sym === '✓' ? 'connected' : sym === '⏸' ? 'pending' : /auth/i.test(m[4]) ? 'needs-auth' : 'failed';
    const parts = name.split(':');
    const plugin = parts[0] === 'plugin' && parts.length >= 3 ? parts[1] : null;
    out.push({ name, server: plugin ? parts.slice(2).join(':') : name, plugin, command: clip(redact(m[2]), 140), status, detail: clip(redact(m[4]), 200) });
  }
  return out;
}

export class McpStatus {
  constructor({ claudeBin = 'claude', exec = execFile, timeoutMs = 150000 }) {
    this.bin = claudeBin;
    this.exec = exec;
    this.timeoutMs = timeoutMs;
    this.state = { at: null, running: false, servers: [], error: null };
  }

  refresh() {
    if (this.state.running) return this.state;
    this.state = { ...this.state, running: true, error: null };
    this.exec(this.bin, ['mcp', 'list'], { timeout: this.timeoutMs, maxBuffer: 4 << 20, env: process.env }, (err, stdout, stderr) => {
      const servers = parseMcpList(stdout);
      this.state = {
        at: new Date().toISOString(),
        running: false,
        servers,
        error: err && !servers.length ? clip(redact(String(stderr || err.message || 'claude mcp list failed')), 300) : null,
      };
    });
    return this.state;
  }
}

// Enable or disable one plugin of the marketplace through the Claude Code CLI.
export function togglePlugin({ claudeBin = 'claude', exec = execFile, key, enable }) {
  return new Promise((resolve) => {
    exec(claudeBin, ['plugin', enable ? 'enable' : 'disable', key], { timeout: 60000, env: process.env }, (err, stdout, stderr) => {
      const out = clip(redact(String(stdout || stderr || '').trim()), 400);
      resolve({ ok: !err, output: out || (err ? err.message : 'Done.') });
    });
  });
}
