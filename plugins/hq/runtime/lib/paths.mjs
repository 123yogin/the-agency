// Where Claude Code keeps its data, and where HQ keeps its own.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function homeDir() {
  if (process.env.HOME) return process.env.HOME.replace(/\/+$/, '');
  try {
    return os.userInfo().homedir;
  } catch {
    return '/';
  }
}

// ~/.claude, or CLAUDE_CONFIG_DIR when set. Read-only for HQ.
export function configDir() {
  const c = process.env.CLAUDE_CONFIG_DIR;
  return (c && c.trim() !== '' ? c : path.join(homeDir(), '.claude')).replace(/\/+$/, '');
}

export const projectsDir = () => path.join(configDir(), 'projects');

// HQ's only writable location: the plugin data dir, else ~/.claude/hq.
export function dataDir() {
  const d = process.env.HQ_DATA_DIR || process.env.CLAUDE_PLUGIN_DATA || path.join(configDir(), 'hq');
  fs.mkdirSync(d, { recursive: true });
  return d;
}

// Claude Code names a project's transcript folder after its path with every non-alphanumeric replaced by '-'.
export const projectDirName = (cwd) => cwd.replace(/[^a-zA-Z0-9]/g, '-');
