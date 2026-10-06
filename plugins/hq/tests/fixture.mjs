// Builds a fake Claude Code config dir (transcripts, plugin registry, settings) with timestamps relative to `now`.
// Usage from the shell: node tests/fixture.mjs <dir>   (prints the config dir path)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const iso = (ms) => new Date(ms).toISOString();
const dirName = (cwd) => cwd.replace(/[^a-zA-Z0-9]/g, '-');

function jsonl(file, rows) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
}
const user = (t, text, cwd) => ({ type: 'user', timestamp: iso(t), cwd, message: { role: 'user', content: text } });
let msgN = 0;
const tool = (t, name, input, cwd) => ({ type: 'assistant', timestamp: iso(t), cwd, message: { id: `m${++msgN}`, role: 'assistant', content: [{ type: 'tool_use', id: `tu${msgN}`, name, input }], usage: { input_tokens: 1200, output_tokens: 300 } } });
const result = (t, cwd) => ({ type: 'user', timestamp: iso(t), cwd, message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'x', content: 'SECRET CONTENT THAT MUST NEVER BE SHOWN' }] } });
const say = (t, text, cwd, final = false) => ({ type: 'assistant', timestamp: iso(t), cwd, message: { id: `m${++msgN}`, role: 'assistant', content: [{ type: 'text', text }], stop_reason: final ? 'end_turn' : null, usage: { input_tokens: 900, output_tokens: 150 } } });

export function makeFixture(root, { now = Date.now(), withPlugins = true } = {}) {
  const config = path.join(root, 'claude');
  const work = path.join(root, 'work');
  const shop = path.join(work, 'demo-shop');
  const notes = path.join(work, 'field-notes');
  for (const d of [shop, notes]) {
    fs.mkdirSync(d, { recursive: true });
    fs.writeFileSync(path.join(d, 'README.md'), `# ${path.basename(d)}\n\nA small demo project used by Agency HQ tests.\n`);
  }
  fs.writeFileSync(path.join(shop, 'cart.js'), 'export const total = (items) => items.reduce((s, i) => s + i.price * i.qty, 0);\n');

  const M = 60000;
  // --- project 1: demo-shop — Lead working, two subagents working, one finished
  const p1 = path.join(config, 'projects', dirName(shop));
  const s1 = 'aaaaaaaa-1111-4111-8111-111111111111';
  jsonl(path.join(p1, `${s1}.jsonl`), [
    user(now - 30 * M, 'Fix the cart total rounding and review the checkout flow', shop),
    tool(now - 29 * M, 'Read', { file_path: `${shop}/cart.js` }, shop),
    result(now - 29 * M + 2000, shop),
    tool(now - 28 * M, 'Skill', { skill: 'core-workflow:systematic-debugging' }, shop),
    tool(now - 27 * M, 'TodoWrite', { todos: [{ content: 'Reproduce the rounding bug', status: 'completed' }, { content: 'Fix cart total', status: 'in_progress' }, { content: 'Review checkout flow', status: 'pending' }] }, shop),
    tool(now - 26 * M, 'Agent', { description: 'Review checkout diff', subagent_type: 'engineering:code-reviewer' }, shop),
    tool(now - 3 * M, 'mcp__plugin_mcp-core_playwright__browser_navigate', { url: 'http://localhost:5173' }, shop),
    tool(now - 20000, 'Bash', { command: 'npm test -- --run cart', description: 'Run cart tests', env: 'API_KEY=sk-live-abcdefghijklmnop' }, shop),
  ]);
  const sub = (id, type, desc, rows) => {
    jsonl(path.join(p1, s1, 'subagents', `agent-${id}.jsonl`), rows);
    fs.writeFileSync(path.join(p1, s1, 'subagents', `agent-${id}.meta.json`), JSON.stringify({ agentType: type, description: desc }));
  };
  sub('a1', 'engineering:code-reviewer', 'Review checkout diff', [
    user(now - 26 * M, 'Review the checkout diff', shop),
    tool(now - 25 * M, 'Read', { file_path: `${shop}/checkout.js` }, shop),
    tool(now - 40000, 'Grep', { pattern: 'toFixed' }, shop),
  ]);
  sub('a2', 'product-design:prd-writer', 'Draft a PRD for saved carts', [
    user(now - 8 * M, 'Write a PRD for saved carts', shop),
    tool(now - 7 * M, 'Read', { file_path: `${shop}/README.md` }, shop),
    tool(now - 30000, 'Write', { file_path: `${shop}/docs/prd-saved-carts.md`, content: 'secret draft body' }, shop),
  ]);
  sub('a3', 'general-purpose', 'Find unused exports', [
    user(now - 50 * M, 'Find unused exports', shop),
    tool(now - 49 * M, 'Glob', { pattern: '**/*.js' }, shop),
    say(now - 47 * M, 'Found two unused exports.', shop, true),
  ]);
  sub('a4', 'growth:seo-specialist', 'Audit product page titles', [
    user(now - 6 * M, 'Audit product page titles', shop),
    tool(now - 50000, 'WebSearch', { query: 'demo shop' }, shop),
  ]);

  // --- project 2: field-notes — Lead asked a question and is waiting
  const p2 = path.join(config, 'projects', dirName(notes));
  jsonl(path.join(p2, 'bbbbbbbb-2222-4222-8222-222222222222.jsonl'), [
    user(now - 20 * M, 'Organise my notes', notes),
    tool(now - 19 * M, 'Glob', { pattern: '*.md' }, notes),
    tool(now - 12 * M, 'AskUserQuestion', { questions: [{ question: 'Group by date or topic?' }] }, notes),
  ]);

  if (withPlugins) {
    const plugins = path.join(config, 'plugins');
    fs.mkdirSync(plugins, { recursive: true });
    fs.writeFileSync(path.join(plugins, 'known_marketplaces.json'), JSON.stringify({ 'the-agency': { source: { source: 'github', repo: '123yogin/the-agency' }, installLocation: REPO } }));
    const inst = {};
    for (const n of ['core-workflow', 'engineering', 'product-design', 'growth', 'mcp-core', 'hq']) {
      inst[`${n}@the-agency`] = [{ scope: 'user', installPath: path.join(REPO, 'plugins', n), version: '1.0.0' }];
    }
    fs.writeFileSync(path.join(plugins, 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: inst }));
    fs.writeFileSync(path.join(config, 'settings.json'), JSON.stringify({ enabledPlugins: { 'core-workflow@the-agency': true, 'engineering@the-agency': true, 'product-design@the-agency': true, 'growth@the-agency': false, 'mcp-core@the-agency': true, 'hq@the-agency': true } }));
  }
  return { config, shop, notes, projects: { shop: dirName(shop), notes: dirName(notes) } };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] || 'hq-fixture');
  fs.rmSync(root, { recursive: true, force: true });
  console.log(makeFixture(root).config);
}
