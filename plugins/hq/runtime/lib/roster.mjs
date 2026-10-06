// Everything The Agency offers: plugins, and inside each one its agents, skills, commands and MCP servers.
// Read-only: reads Claude Code's plugin registry, the marketplace clone and installed plugin folders.
import path from 'node:path';
import { department } from './departments.mjs';
import { configDir, projectsDir } from './paths.mjs';
import { Transcripts } from './transcripts.mjs';
import { basename, globDir, isDir, isFile, isPlainObj, readJson, readText, trim } from './util.mjs';

export const MARKETPLACE = () => process.env.HQ_MARKETPLACE || 'the-agency';

// Minimal frontmatter reader for the single-line "key: value" style every file in this repo uses.
export function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(String(text || ''));
  const out = {};
  if (!m) return out;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    let v = trim(kv[2]);
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[kv[1]] = v;
  }
  return out;
}

// Split "Use when X. Not for Y." into its parts for display and routing.
export function splitDescription(desc) {
  const d = String(desc || '');
  const i = d.search(/\bNot for\b/i);
  return i >= 0 ? { use: trim(d.slice(0, i)), notFor: trim(d.slice(i)) } : { use: trim(d), notFor: '' };
}

function marketplaceDir() {
  const known = readJson(path.join(configDir(), 'plugins', 'known_marketplaces.json'), {});
  const mk = isPlainObj(known) ? known[MARKETPLACE()] : null;
  if (mk && typeof mk.installLocation === 'string' && isDir(mk.installLocation)) return mk.installLocation;
  const guess = path.join(configDir(), 'plugins', 'marketplaces', MARKETPLACE());
  return isDir(guess) ? guess : null;
}

function readItems(dir, plugin) {
  const agents = globDir(path.join(dir, 'agents'), '.md').map((f) => {
    const fm = frontmatter(readText(f));
    const name = fm.name || basename(f, '.md');
    return { kind: 'agent', name, id: `${plugin}:${name}`, description: fm.description || '', ...splitDescription(fm.description), model: fm.model || 'inherit', tools: fm.tools || 'all', invoke: `Use the ${plugin}:${name} agent to ` };
  });
  const skills = globDir(path.join(dir, 'skills'), '').filter((d) => isFile(path.join(d, 'SKILL.md'))).map((d) => {
    const fm = frontmatter(readText(path.join(d, 'SKILL.md')));
    const name = fm.name || basename(d);
    return { kind: 'skill', name, id: `${plugin}:${name}`, description: fm.description || '', ...splitDescription(fm.description), invoke: `/${plugin}:${name}` };
  });
  const commands = globDir(path.join(dir, 'commands'), '.md').map((f) => {
    const fm = frontmatter(readText(f));
    const name = basename(f, '.md');
    return { kind: 'command', name, id: `${plugin}:${name}`, description: fm.description || '', use: fm.description || '', notFor: '', hint: fm['argument-hint'] || '', invoke: `/${name}${fm['argument-hint'] ? ' ' : ''}` };
  });
  const mcpCfg = readJson(path.join(dir, '.mcp.json'), {});
  const servers = isPlainObj(mcpCfg) ? (isPlainObj(mcpCfg.mcpServers) ? mcpCfg.mcpServers : mcpCfg) : {};
  const mcp = Object.entries(servers).filter(([, v]) => isPlainObj(v)).map(([name, v]) => ({
    kind: 'mcp', name, id: `${plugin}:${name}`,
    description: v.url ? `Remote server at ${v.url}` : `Runs ${[v.command, ...(Array.isArray(v.args) ? v.args : [])].filter(Boolean).join(' ').slice(0, 140)}`,
    use: '', notFor: '', invoke: `mcp__plugin_${plugin}_${name}`,
  }));
  return { agents, skills, commands, mcp };
}

// Plugins of the marketplace with install state and contents.
export function readRoster() {
  const cfg = configDir();
  const mdir = marketplaceDir();
  const manifest = mdir ? readJson(path.join(mdir, '.claude-plugin', 'marketplace.json'), {}) : {};
  const listed = Array.isArray(manifest?.plugins) ? manifest.plugins : [];
  const installed = readJson(path.join(cfg, 'plugins', 'installed_plugins.json'), {});
  const instMap = isPlainObj(installed?.plugins) ? installed.plugins : {};
  const settings = readJson(path.join(cfg, 'settings.json'), {});
  const enabledMap = isPlainObj(settings?.enabledPlugins) ? settings.enabledPlugins : {};
  const names = new Set(listed.map((p) => p.name));
  for (const key of Object.keys(instMap)) if (key.endsWith(`@${MARKETPLACE()}`)) names.add(key.slice(0, key.lastIndexOf('@')));

  const plugins = [];
  for (const name of [...names].sort()) {
    if (typeof name !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(name)) continue;
    const entry = listed.find((p) => p.name === name) || {};
    const key = `${name}@${MARKETPLACE()}`;
    const inst = Array.isArray(instMap[key]) ? instMap[key][0] : null;
    const installPath = inst && typeof inst.installPath === 'string' && isDir(inst.installPath) ? inst.installPath : null;
    const srcDir = installPath || (mdir && typeof entry.source === 'string' ? path.join(mdir, entry.source) : null);
    const defaultEnabled = entry.defaultEnabled !== false;
    const enabled = !!installPath && (typeof enabledMap[key] === 'boolean' ? enabledMap[key] : defaultEnabled);
    const items = srcDir && isDir(srcDir) ? readItems(srcDir, name) : { agents: [], skills: [], commands: [], mcp: [] };
    const dep = department(name);
    const own = srcDir ? readJson(path.join(srcDir, '.claude-plugin', 'plugin.json'), {}) : {};
    plugins.push({
      name, key, description: entry.description || own?.description || '', category: entry.category || '', version: inst?.version || entry.version || '',
      installed: !!installPath, enabled, defaultEnabled, color: dep.color, department: dep.label,
      install: `claude plugin install ${key}`, ...items,
    });
  }
  return { marketplace: MARKETPLACE(), found: !!mdir || plugins.length > 0, plugins };
}

// How often each agent, skill and MCP server was used, from transcripts of the last `days` days.
let usageMemo = { at: 0, data: null };
export function readUsage({ days = 30, cacheDir = null, ttlMs = 60000 } = {}) {
  if (usageMemo.data && Date.now() - usageMemo.at < ttlMs) return usageMemo.data;
  const agents = {};
  const skills = {};
  const mcp = {};
  const cfg = { window_days: days, cooldown: 60, mains_max: 400 };
  for (const dir of globDir(projectsDir(), '')) {
    if (!isDir(dir)) continue;
    const scan = new Transcripts({ root: dir, cacheDir, cfg }).scan(Math.floor(Date.now() / 1000), days);
    for (const r of scan.runs) agents[r.agentType] = (agents[r.agentType] || 0) + 1;
    for (const s of [...scan.mains, ...scan.runs]) {
      for (const [k, v] of Object.entries(s.skills || {})) skills[k] = (skills[k] || 0) + v;
      for (const [k, v] of Object.entries(s.mcp || {})) mcp[k] = (mcp[k] || 0) + v;
    }
  }
  usageMemo = { at: Date.now(), data: { agents, skills, mcp, days } };
  return usageMemo.data;
}

export function rosterWithUsage(opts = {}) {
  const roster = readRoster();
  const usage = readUsage(opts);
  for (const p of roster.plugins) {
    for (const a of p.agents) a.used = usage.agents[a.id] || 0;
    for (const s of p.skills) s.used = (usage.skills[s.id] || 0) + (usage.skills[s.name] || 0);
    for (const m of p.mcp) m.used = usage.mcp[`plugin_${p.name}_${m.name}`] || 0;
    for (const c of p.commands) c.used = 0;
  }
  return { ...roster, usageDays: usage.days };
}
