---
name: codebase-onboarding
description: Use when joining or first opening an unfamiliar repo and the user wants a written onboarding guide and/or a starter or updated CLAUDE.md. Runs parallel reconnaissance, verifies every detected command, and never overwrites an existing CLAUDE.md without merging. For answering questions about the code in conversation, use the codebase-explainer agent instead.
---

# Codebase Onboarding

Produce two artefacts from evidence in the repo: an onboarding guide a new
developer can scan in two minutes, and a short CLAUDE.md that tells future
sessions how this project actually works.

## Phase 1: Reconnaissance (in parallel, with Glob/Grep, not Read-everything)

1. Manifests: `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`,
   `pom.xml`, `build.gradle`, `Gemfile`, `composer.json`, `pubspec.yaml`,
   `mix.exs`, lockfiles.
2. Framework markers: `next.config.*`, `vite.config.*`, `angular.json`,
   `capacitor.config.*`, Django `settings.py`, FastAPI/Flask app factories,
   Rails `config/`.
3. Entry points: `main.*`, `index.*`, `app.*`, `server.*`, `cmd/`, `src/main/`,
   package `exports`/`bin`.
4. Structure: top two levels, ignoring `node_modules`, `vendor`, `.git`, `dist`,
   `build`, `__pycache__`, `.next`.
5. Tooling: lint/format configs, `tsconfig.json`, `Makefile`, `Dockerfile`,
   compose files, `.github/workflows/`, `.env.example`.
6. Tests: test dirs and naming, runner configs.
7. Git: recent commit messages and branch names. If history is missing or
   shallow, say "git history unavailable" and skip this.

## Phase 2: Map

- Stack: languages and versions, frameworks, datastores and ORM, build tool, CI.
- Shape: monolith / monorepo / services / serverless; API style.
- Directory → purpose map (skip obvious ones like `src/`).
- One request (or command) traced from entry to response, as file paths.

## Phase 3: Conventions

File naming, error-handling style, dependency injection vs imports, state
management, async patterns, test naming, commit style. If a convention cannot be
determined confidently, write "could not determine" — never guess.

## Phase 4: Verify commands

Run the detected install/dev/test/lint/build commands that are safe to run
(no deploys, no migrations against shared databases, no network side effects).
Record which ran, which failed (with the error) and which were skipped and why.
A command that was never run is labelled as unverified in both artefacts.

## Phase 5: Write

### Onboarding guide (`docs/ONBOARDING.md` or print to chat, as the user prefers)

```markdown
# Onboarding: <project>

<2–3 sentences: what it does and for whom>

## Stack
| Layer | Technology | Version |

## Architecture
<how the parts connect; one diagram or short list>

## Start here
- `<path>` — <why>

## Request lifecycle
1. `<file>` — <step>

## Common tasks
| Task | Command | Verified |

## Where to look
| I want to… | Look at… |

## Conventions
- …

## Unknowns
- <what could not be determined>
```

### CLAUDE.md

- If one exists: read it first, keep every project-specific instruction, and
  add only what is missing. Tell the user exactly what you added or changed.
- Keep it under ~100 lines. Commands, conventions, gotchas and rules that are
  not obvious from the code. No dependency lists, no restating the README.

```markdown
# <project>

## Commands
- Dev: `<cmd>`   Test: `<cmd>`   Lint: `<cmd>`   Build: `<cmd>`

## Structure
- `<dir>/` — <purpose>

## Conventions
- …

## Gotchas
- <things that bite: env vars, generated files, ordering constraints>
```

## Anti-patterns

- Reading every file instead of reconnaissance plus targeted reads.
- Trusting config over code: if the config names one framework and the code
  uses another, the code wins.
- Replacing an existing CLAUDE.md.
- Listing commands that were never run as if they work.

<!-- Adapted from affaan-m/ECC skills/codebase-onboarding (MIT). -->
