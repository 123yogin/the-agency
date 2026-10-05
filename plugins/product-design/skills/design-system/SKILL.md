---
name: design-system
description: Use when creating design tokens or a design system, extracting one from an existing codebase, implementing theming (light/dark, multi-brand), structuring a component library, or auditing UI for visual consistency. Enforces the primitive → semantic → component token tiers and evidence (file:line) for every audit finding.
---

# Design System

A design system is a set of decisions encoded as tokens and components, so that
consistency is the default and every exception is visible. Start from what the
codebase already does; do not invent a parallel system.

## Hard rules

- **Three token tiers.** Primitives hold raw values (`gray-900`, `space-4`).
  Semantic tokens name purpose and reference primitives (`text-primary`,
  `surface-elevated`, `border-default`, `interactive-primary`). Component tokens
  are optional and reference semantic ones (`button-bg`). Components consume
  semantic or component tokens, never primitives or raw values.
- **Name by purpose, not appearance:** `text-secondary`, not `dark-gray`.
- **One naming convention** (kebab-case CSS custom properties, for example).
- **Every semantic token has a value in every theme.** A token that does not
  change in dark mode is either correct by design or a bug; check which.
- **Token changes are API changes.** Version them; deprecate with a migration
  path rather than deleting.
- **Accessibility is a token property:** text/background pairs meet 4.5:1 (3:1
  for large text and UI components) in every theme; focus-ring tokens exist;
  motion tokens honour `prefers-reduced-motion`.

## Mode 1: Extract from an existing codebase

1. Scan CSS, Tailwind config, CSS-in-JS and component files for colours,
   font families/sizes/weights/line-heights, spacing, radii, shadows,
   breakpoints, z-indices and durations. Count occurrences.
2. Cluster near-duplicates (`#111`, `#121212`, `#0f0f0f`) and propose one value
   per cluster, listing the files that would change.
3. Propose primitives, then the semantic layer mapped onto real usage.
4. Write `design-tokens.json` (or the project's existing format) and the CSS
   custom properties, plus a `DESIGN.md` explaining each decision.
5. Optionally generate a self-contained HTML preview page showing every token
   and core component in each theme.

## Mode 2: Visual consistency audit

Score each dimension 0–10 with specific examples and a fix at `file:line`:

1. Colour — palette tokens or stray hex values?
2. Typography — clear hierarchy, or arbitrary sizes?
3. Spacing — a consistent scale, or arbitrary values?
4. Components — do similar elements look and behave alike?
5. Responsive — fluid, or broken at breakpoints?
6. Theming — dark mode complete or half-done?
7. Motion — purposeful, and reduced-motion aware?
8. Accessibility — contrast, focus states, target sizes.
9. Density — appropriate for the job, or cluttered/sparse?
10. States — hover, focus, loading, empty, error, disabled present?

Flag generic generated patterns while auditing: gradients and glass as
decoration, one radius and one shadow on everything, equal-weight card grids,
hero-over-gradient layouts on product screens. (See the frontend-design skill
for the full list.)

## Mode 3: Build or extend

- **Theming:** CSS custom properties on `:root`, overridden per theme
  (`[data-theme="dark"]`) and per `prefers-color-scheme`; persist the user's choice;
  avoid a flash of the wrong theme on server-rendered pages.
- **Components:** consistent variant and size APIs (a variant helper such as CVA
  is one option), compound components for related parts, slots for composition,
  headless primitives where behaviour is shared and styling differs.
- **Pipeline:** if tokens must reach iOS/Android or come from a design tool, use
  a transformer such as Style Dictionary and run it in CI.

## Output

```markdown
# Design system: {product}

## Token summary
| Tier | Count | Notes |
|---|---|---|
Duplicates collapsed: {n} values → {n} tokens

## Decisions
- {decision} — because {reason}

## Audit (if run)
| Dimension | Score | Example | Fix (file:line) |
|---|---|---|---|

## Files written
- design-tokens.json, tokens.css, DESIGN.md{, design-preview.html}
```

## Common problems

Token sprawl without hierarchy; mixed naming conventions; tokens that ignore
theme; hard-coded values bypassing tokens; circular references; tokens present
on web but missing on mobile.

Depth: `references/design-tokens.md` (categories, naming, governance, validation),
`references/theming-architecture.md` (CSS variables, React provider, multi-brand,
SSR), `references/component-architecture.md` (compound, polymorphic, slots,
headless, variants), `references/worked-examples.md`.

<!-- Adapted from wshobson/agents plugins/ui-design/skills/design-system-patterns (MIT), with extraction and audit modes from affaan-m/ECC skills/design-system (MIT). -->
