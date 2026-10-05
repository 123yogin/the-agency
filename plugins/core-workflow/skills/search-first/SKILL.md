---
name: search-first
description: Use before writing a new utility, helper, integration or feature that may already exist in the repo or as a maintained package. Forces a search-then-decide step (adopt, extend, compose, build) and a readiness check before implementation.
---

# Search First

Most "new" code already exists, either in this repo or as a maintained
package. Look before you build.

## The Order

1. **This repo.** Search for the function, the concept, and its synonyms
   (`rg -n "<term>"`, `rg --files | rg <term>`). Check the project's
   `CLAUDE.md` / docs for the patterns it expects.
2. **The installed dependencies.** The thing you need is often already a
   dependency (`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`).
3. **The package registry.** npm, PyPI, crates.io, pkg.go.dev.
4. **Available tools.** An MCP server or skill that already does it.
5. **Reference implementations.** GitHub code search or official docs for
   how others solved it.

Say which channels you actually checked. "Nothing found" on a channel you
could not reach is a false claim; write "not checked" instead.

## Decide

| Finding | Action |
|---------|--------|
| Exact match, maintained, compatible licence | **Adopt**: use it directly |
| Close match, solid base | **Extend**: thin wrapper around it |
| Several partial matches | **Compose**: combine 2-3 small pieces |
| Nothing suitable | **Build**: write it, informed by what you saw |

Judge a package on: does it do the job, last release and open-issue health,
licence, size and transitive dependencies. Do not add a large dependency for
one small function.

## Readiness Check (before writing code)

Answer each in one line. Any "no" means do that first.

1. **No duplicate?** You searched and nothing in the repo already does this.
2. **Fits the architecture?** It uses the stack and patterns the project
   already has, with no new dependency unless it earns its place.
3. **Docs checked?** You read the official docs for any API you are about to
   call, rather than recalling them.
4. **Reference seen?** For anything non-trivial, you looked at one working
   implementation.
5. **Root cause known?** For a fix, you know why it broke (see
   systematic-debugging), not just where.

## Report

```
Need: <one line>
Checked: repo [yes], deps [yes], registry [yes], MCP/skills [not checked: no access]
Found: <candidate> — <why it fits or not>
Decision: ADOPT | EXTEND | COMPOSE | BUILD — <one-line reason>
```

<!-- Adapted from affaan-m/ECC skills/search-first (MIT); readiness check adapted from SuperClaude-Org/SuperClaude_Framework skills/confidence-check (MIT). -->
