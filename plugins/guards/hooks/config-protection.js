#!/usr/bin/env node
// PreToolUse (Write|Edit|MultiEdit): stop an agent from weakening lint, format
// or TypeScript strictness config to make checks pass instead of fixing code.
//
// - Linter/formatter configs and their ignore files: any modification of an
//   existing file is blocked. Creating one where none exists is allowed.
// - tsconfig*.json: ordinary edits (paths, includes, targets) are allowed;
//   only turning a strictness flag off is blocked.
//
// Exit 0 = allow, exit 2 = block (reason on stderr).
// Escape hatch: AGENCY_ALLOW_CONFIG_EDIT=1 in the environment.
'use strict';

const fs = require('fs');
const path = require('path');

const PROTECTED = new Set([
  '.eslintrc', '.eslintrc.js', '.eslintrc.cjs', '.eslintrc.json', '.eslintrc.yml', '.eslintrc.yaml',
  'eslint.config.js', 'eslint.config.mjs', 'eslint.config.cjs', 'eslint.config.ts', 'eslint.config.mts', 'eslint.config.cts',
  '.prettierrc', '.prettierrc.js', '.prettierrc.cjs', '.prettierrc.json', '.prettierrc.yml', '.prettierrc.yaml',
  'prettier.config.js', 'prettier.config.cjs', 'prettier.config.mjs',
  'biome.json', 'biome.jsonc', '.biome.json', '.biome.jsonc',
  '.ruff.toml', 'ruff.toml', '.flake8', '.pylintrc', 'mypy.ini', '.mypy.ini',
  '.golangci.yml', '.golangci.yaml', '.golangci.toml', 'clippy.toml', '.clippy.toml', 'rustfmt.toml', '.rustfmt.toml',
  '.shellcheckrc', '.oxlintrc.json',
  '.stylelintrc', '.stylelintrc.json', '.stylelintrc.yml', '.stylelintrc.yaml', '.stylelintrc.js', '.stylelintrc.cjs', '.stylelintrc.mjs',
  'stylelint.config.js', 'stylelint.config.cjs', 'stylelint.config.mjs', 'stylelint.config.ts',
  '.markdownlint.json', '.markdownlint.jsonc', '.markdownlint.yaml', '.markdownlint.yml', '.markdownlintrc',
  '.markdownlint-cli2.jsonc', '.markdownlint-cli2.yaml',
  '.eslintignore', '.prettierignore', '.stylelintignore', '.markdownlintignore',
]);

// Shared/split configs: eslint.config.base.mjs, .eslintrc.shared.json, ...
const PATTERNS = [
  /^(eslint|prettier|stylelint|commitlint|oxlint)\.config(\.[\w-]+)*\.(js|mjs|cjs|ts|mts|cts)$/i,
  /^\.(eslintrc|prettierrc|stylelintrc|markdownlintrc)(\.[\w-]+)*\.(js|cjs|mjs|json|jsonc|yml|yaml|toml)$/i,
];

const TS_FLAGS = [
  'strict', 'noImplicitAny', 'strictNullChecks', 'strictFunctionTypes', 'strictBindCallApply',
  'strictPropertyInitialization', 'noImplicitThis', 'alwaysStrict', 'useUnknownInCatchVariables',
  'noUncheckedIndexedAccess', 'noImplicitReturns', 'noFallthroughCasesInSwitch', 'exactOptionalPropertyTypes',
];

function block(reason) {
  process.stderr.write(`BLOCKED by config-protection: ${reason}\n`);
  process.exit(2);
}

function exists(p) {
  try { fs.lstatSync(p); return true; } catch (e) { return !(e && e.code === 'ENOENT'); }
}

function flagsOn(text) {
  const on = new Set();
  for (const f of TS_FLAGS) if (new RegExp(`"${f}"\\s*:\\s*true`).test(text)) on.add(f);
  return on;
}

function weakenedFlags(before, after) {
  const was = flagsOn(before);
  const now = flagsOn(after);
  const off = TS_FLAGS.filter((f) => new RegExp(`"${f}"\\s*:\\s*false`).test(after) && !new RegExp(`"${f}"\\s*:\\s*false`).test(before));
  return [...new Set([...[...was].filter((f) => !now.has(f)), ...off])];
}

let raw = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => {
  if (/^(1|true|yes)$/i.test(process.env.AGENCY_ALLOW_CONFIG_EDIT || '')) process.exit(0);

  let input;
  try { input = JSON.parse(raw || '{}'); } catch { process.exit(0); }
  const ti = input.tool_input || {};
  const file = ti.file_path || '';
  if (!file) process.exit(0);

  const abs = path.isAbsolute(file) ? file : path.resolve(input.cwd || process.cwd(), file);
  const base = path.basename(abs);

  if (PROTECTED.has(base) || PROTECTED.has(base.toLowerCase()) || PATTERNS.some((re) => re.test(base))) {
    if (!exists(abs)) process.exit(0);
    block(`${base} is a lint/format config. Fix the code so it passes the existing rules instead of loosening them. ` +
      'If the user explicitly asked for this config change, ask them to set AGENCY_ALLOW_CONFIG_EDIT=1 or disable the guards plugin.');
  }

  if (/^tsconfig(\.[\w-]+)*\.json$/i.test(base)) {
    let before = '';
    let after = '';
    if (input.tool_name === 'Write') {
      if (!exists(abs)) process.exit(0);
      try { before = fs.readFileSync(abs, 'utf8'); } catch { process.exit(0); }
      after = ti.content || '';
    } else {
      const edits = Array.isArray(ti.edits) ? ti.edits : [ti];
      before = edits.map((e) => e.old_string || '').join('\n');
      after = edits.map((e) => e.new_string || '').join('\n');
    }
    const weakened = weakenedFlags(before, after);
    if (weakened.length) {
      block(`this edit turns off TypeScript strictness (${weakened.join(', ')}) in ${base}. Fix the type errors instead. ` +
        'If the user explicitly asked for this, ask them to set AGENCY_ALLOW_CONFIG_EDIT=1.');
    }
  }
  process.exit(0);
});
