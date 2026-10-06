// Each plugin is a department with its own colour. Agent types arrive as "plugin:agent" or a bare built-in name.
import { hash } from './util.mjs';

export const DEPARTMENTS = {
  'core-workflow': { label: 'Core workflow', color: '#6a55c9' },
  guards: { label: 'Guards', color: '#5b6b73' },
  engineering: { label: 'Engineering', color: '#2f6fd1' },
  'product-design': { label: 'Product & design', color: '#c2417a' },
  growth: { label: 'Growth', color: '#d9772f' },
  'ai-data-docs': { label: 'AI, data & docs', color: '#0f8fa3' },
  meta: { label: 'Meta', color: '#9a7418' },
  hq: { label: 'HQ', color: '#1c6e8c' },
  mcp: { label: 'MCP servers', color: '#4f7d3a' },
  'built-in': { label: 'Built in', color: '#7b8790' },
};
const OTHER = ['#8a4fa8', '#3d7f9e', '#b8452f', '#4f7d3a', '#9a7418', '#0f8fa3'];
const BUILT_IN = new Set(['general-purpose', 'explore', 'plan', 'fork', 'claude-code-guide', 'statusline-setup', 'claude', 'auto']);

export function department(plugin) {
  if (!plugin) return { id: 'built-in', ...DEPARTMENTS['built-in'] };
  if (DEPARTMENTS[plugin]) return { id: plugin, ...DEPARTMENTS[plugin] };
  if (plugin.startsWith('mcp-')) return { id: plugin, label: plugin, color: DEPARTMENTS.mcp.color };
  return { id: plugin, label: plugin, color: OTHER[hash(plugin) % OTHER.length] };
}

// "engineering:code-reviewer" → {agent:'code-reviewer', plugin:'engineering', ...}
export function identify(agentType) {
  const t = String(agentType || 'general-purpose');
  if (t === 'hq:lead') return { agent: 'Lead (HQ)', plugin: 'hq', builtIn: false, department: DEPARTMENTS.hq.label, color: DEPARTMENTS.hq.color };
  const i = t.indexOf(':');
  const plugin = i > 0 ? t.slice(0, i) : null;
  const agent = i > 0 ? t.slice(i + 1) : t;
  const dep = department(plugin);
  return { agent, plugin: plugin || 'built-in', builtIn: !plugin && BUILT_IN.has(agent.toLowerCase()), department: dep.label, color: dep.color };
}
