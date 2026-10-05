#!/usr/bin/env node
// Lints every plugin against CONVENTIONS.md. No dependencies.
// Usage: node scripts/lint.mjs [plugin-name ...]   (exits 1 on any error)

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pluginsDir = path.join(root, "plugins");
const only = new Set(process.argv.slice(2));

const errors = [];
const counts = { plugins: 0, agents: 0, skills: 0, commands: 0, hooks: 0 };
const err = (file, msg) => errors.push(`${path.relative(root, file)}: ${msg}`);

// Extended_Pictographic catches emoji; below U+2300 it also matches ©, ®, ™
// and a few arrows, which are legitimate in prose, so those are allowed.
const emoji = /\p{Extended_Pictographic}/gu;
const foreignRef = /\b(superpowers|ecc):[a-z]/i;

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

function frontmatter(file, text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  const fields = {};
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const kv = lines[i].match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (!kv) continue;
    let [, key, value] = kv;
    if (/^[>|][-+]?$/.test(value)) {
      const block = [];
      while (i + 1 < lines.length && /^\s+/.test(lines[i + 1])) block.push(lines[++i].trim());
      value = block.join(" ");
    }
    fields[key] = value.replace(/^["']|["']$/g, "").trim();
  }
  return fields;
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    err(file, `invalid JSON (${e.message})`);
    return null;
  }
}

function checkDescription(file, fm) {
  if (!fm.description) return err(file, "missing description");
  if (!/\bUse (when|after|before|at|to|for|this when|this skill when)\b/i.test(fm.description)) err(file, 'description must state its trigger ("Use when/after/before ...")');
}

function lintPlugin(name) {
  const dir = path.join(pluginsDir, name);
  counts.plugins++;

  const manifest = path.join(dir, ".claude-plugin", "plugin.json");
  if (!fs.existsSync(manifest)) err(dir, "missing .claude-plugin/plugin.json");
  else {
    const json = readJson(manifest);
    if (json) {
      for (const k of ["name", "version", "description", "license"]) if (!json[k]) err(manifest, `missing "${k}"`);
      if (json.name && json.name !== name) err(manifest, `name "${json.name}" does not match directory "${name}"`);
    }
  }
  if (!fs.existsSync(path.join(dir, "README.md"))) err(dir, "missing README.md");

  const agentsDir = path.join(dir, "agents");
  if (fs.existsSync(agentsDir)) {
    for (const f of fs.readdirSync(agentsDir).filter((f) => f.endsWith(".md"))) {
      const file = path.join(agentsDir, f);
      counts.agents++;
      const fm = frontmatter(file, fs.readFileSync(file, "utf8"));
      if (!fm) { err(file, "missing frontmatter"); continue; }
      if (fm.name !== f.replace(/\.md$/, "")) err(file, `name "${fm.name}" does not match filename`);
      checkDescription(file, fm);
      if (!fm.tools) err(file, "missing tools");
      if (!fm.model) err(file, "missing model");
      for (const k of ["color", "emoji", "vibe"]) if (k in fm) err(file, `banned frontmatter field "${k}"`);
    }
  }

  const skillsDir = path.join(dir, "skills");
  if (fs.existsSync(skillsDir)) {
    for (const s of fs.readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
      const file = path.join(skillsDir, s.name, "SKILL.md");
      counts.skills++;
      if (!fs.existsSync(file)) { err(path.join(skillsDir, s.name), "missing SKILL.md"); continue; }
      const fm = frontmatter(file, fs.readFileSync(file, "utf8"));
      if (!fm) { err(file, "missing frontmatter"); continue; }
      if (fm.name !== s.name) err(file, `name "${fm.name}" does not match directory "${s.name}"`);
      checkDescription(file, fm);
    }
  }

  const commandsDir = path.join(dir, "commands");
  if (fs.existsSync(commandsDir)) {
    for (const f of fs.readdirSync(commandsDir).filter((f) => f.endsWith(".md"))) {
      const file = path.join(commandsDir, f);
      counts.commands++;
      const fm = frontmatter(file, fs.readFileSync(file, "utf8"));
      if (!fm || !fm.description) err(file, "missing frontmatter description");
    }
  }

  const hooks = path.join(dir, "hooks", "hooks.json");
  if (fs.existsSync(hooks)) {
    counts.hooks++;
    const json = readJson(hooks);
    if (json && typeof json.hooks !== "object") err(hooks, 'missing top-level "hooks" object');
  }

  for (const file of walk(dir).filter((f) => f.endsWith(".md"))) {
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      const bad = [...line.matchAll(emoji)].map((m) => m[0]).filter((c) => c.codePointAt(0) >= 0x2300);
      if (bad.length) err(file, `line ${i + 1}: emoji ${[...new Set(bad)].join(" ")}`);
      if (foreignRef.test(line)) err(file, `line ${i + 1}: foreign skill prefix "${line.match(foreignRef)[0]}"`);
    });
  }
}

function lintMarketplace() {
  const file = path.join(root, ".claude-plugin", "marketplace.json");
  if (!fs.existsSync(file)) return;
  const json = readJson(file);
  if (!json) return;
  for (const p of json.plugins ?? []) {
    const src = path.join(root, p.source ?? "");
    if (!fs.existsSync(src)) err(file, `plugin "${p.name}" source ${p.source} does not exist`);
    else if (path.basename(src) !== p.name) err(file, `plugin "${p.name}" source dir is "${path.basename(src)}"`);
  }
  const listed = new Set((json.plugins ?? []).map((p) => p.name));
  for (const d of fs.readdirSync(pluginsDir)) if (!listed.has(d)) err(file, `plugin "${d}" is not listed`);
}

const plugins = fs.existsSync(pluginsDir)
  ? fs.readdirSync(pluginsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name)
  : [];
for (const p of plugins) if (!only.size || only.has(p)) lintPlugin(p);
if (!only.size) lintMarketplace();

console.log(
  `Checked ${counts.plugins} plugins: ${counts.agents} agents, ${counts.skills} skills, ` +
    `${counts.commands} commands, ${counts.hooks} hook files.`
);
if (errors.length) {
  console.log(`\n${errors.length} error(s):`);
  for (const e of errors) console.log(`  ${e}`);
  process.exit(1);
}
console.log("OK");
