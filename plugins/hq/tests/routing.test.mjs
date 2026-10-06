import assert from 'node:assert/strict';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { frontmatter, splitDescription } from '../runtime/lib/roster.mjs';
import { route, stem } from '../runtime/lib/routing.mjs';
import { globDir, readText } from '../runtime/lib/util.mjs';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
// the real agents shipped in this repo
const AGENTS = globDir(path.join(REPO, 'plugins'), '').flatMap((dir) => globDir(path.join(dir, 'agents'), '.md').map((f) => {
  const fm = frontmatter(readText(f));
  const plugin = path.basename(dir);
  return { id: `${plugin}:${fm.name}`, name: fm.name, plugin, description: fm.description, ...splitDescription(fm.description) };
}));

const top = (task) => route(task, AGENTS)[0]?.id;

test('the repo has enough agents to route against', () => {
  assert.ok(AGENTS.length > 50, `only ${AGENTS.length} agents found`);
});

test('routes everyday task descriptions to the right specialist', () => {
  const cases = [
    ['Our Android APK keeps showing the old UI after I install a new build', 'engineering:capacitor-engineer'],
    ['Write a PRD for saved carts', 'product-design:prd-writer'],
    ['Improve our Google ranking and SEO for the product pages', 'growth:seo-specialist'],
    ['Harden our GitHub Actions workflows', 'engineering:github-actions-hardener'],
    ['Review the terraform plan before we apply it', 'engineering:terraform-reviewer'],
  ];
  for (const [task, want] of cases) {
    const got = route(task, AGENTS);
    assert.ok(got.some((g) => g.id === want), `"${task}" → ${got.map((g) => g.id).join(', ')} (wanted ${want})`);
  }
  assert.equal(top('Write a PRD for saved carts'), 'product-design:prd-writer');
  assert.equal(top('our android apk shows the old UI after install'), 'engineering:capacitor-engineer');
  assert.equal(top('Harden our GitHub Actions workflows'), 'engineering:github-actions-hardener');
  assert.equal(top('review my diff before the PR'), 'engineering:code-reviewer');
  assert.equal(top('draft a privacy policy for the app'), 'growth:privacy-officer');
  assert.equal(top('our postgres queries are slow'), 'engineering:postgres-reviewer');
});

test('pointers to other agents inside "Not for" do not penalise the agent', () => {
  const agents = [
    { id: 'x:code-reviewer', name: 'code-reviewer', use: 'Use after changing code to review the diff.', notFor: 'Not for language-deep review (use the go-reviewer).' },
    { id: 'x:go-reviewer', name: 'go-reviewer', use: 'Use when reviewing Go code.', notFor: '' },
  ];
  assert.equal(route('review my diff', agents)[0].id, 'x:code-reviewer');
});

test('one vague word cannot outscore a specific match through its synonyms', () => {
  const got = route('our android apk shows the old UI after install', AGENTS);
  assert.equal(got[0].id, 'engineering:capacitor-engineer');
  assert.ok(got[0].reasons.includes('android') || got[0].reasons.includes('apk'));
});

test('every suggestion explains itself with matched words and a confidence', () => {
  const got = route('review my diff for security holes before the PR', AGENTS);
  assert.ok(got.length > 0 && got.length <= 3);
  for (const g of got) {
    assert.ok(g.reasons.length > 0);
    assert.ok(['strong', 'possible', 'weak'].includes(g.confidence));
  }
  assert.ok(got[0].score >= got[got.length - 1].score);
});

test('"Not for" text pushes an agent down', () => {
  const agents = [
    { id: 'x:a', name: 'alpha', use: 'Use when reviewing a diff.', notFor: 'Not for security audits.' },
    { id: 'x:b', name: 'beta', use: 'Use when auditing security of a diff.', notFor: '' },
  ];
  assert.equal(route('security audit of this diff', agents)[0].id, 'x:b');
});

test('empty or stop-word-only tasks return nothing', () => {
  assert.deepEqual(route('', AGENTS), []);
  assert.deepEqual(route('please help me with this', AGENTS), []);
});

test('stemming folds common endings', () => {
  assert.equal(stem('reviewing'), 'review');
  assert.equal(stem('tests'), 'test');
  assert.equal(stem('class'), 'class');
});
