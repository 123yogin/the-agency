# engineering

Engineering agents that prove their work. Reviewers report only findings they can cite at a line with a concrete failure, and zero findings is a valid result. Implementers write the test first and do not claim "done" without fresh verification output.

Install:

```
/plugin marketplace add 123yogin/the-agency
/plugin install engineering@the-agency
```

## Review (read-only)

| Agent | Model | Use when |
|---|---|---|
| `code-reviewer` | sonnet | Use after writing or changing code, before a commit or PR, to review the diff for bugs, security holes and maintainability problems. Reports only findings it can prove. Not for a whole-release audit since the last deploy (use preship-reviewer) or language-deep review (use the react-, typescript-, python-, go- or rust-reviewer). |
| `preship-reviewer` | sonnet | Use before deploying or after a sprint to review everything changed since the last deploy (or a given ref) across correctness, races, error handling, data hygiene, security, tests and observability. Ends with SHIP / SHIP WITH FIXES / DO NOT SHIP. Not for reviewing a single small diff (use code-reviewer). |
| `react-reviewer` | sonnet | Use when a diff touches .tsx/.jsx or React component logic — reviews hook correctness, server/client boundaries, React-specific security, accessibility and render performance. Run alongside typescript-reviewer, which owns generic TS type safety and async. Not for non-React code. |
| `typescript-reviewer` | sonnet | Use when a diff touches TypeScript or JavaScript — reviews type safety, async correctness, error handling, Node/web security and idiomatic patterns, and diagnoses tsc/build failures. Pair with react-reviewer for .tsx/.jsx. Not for applying fixes (use build-error-resolver or minimal-change-engineer). |
| `python-reviewer` | sonnet | Use when a diff touches Python — reviews security, error handling, type hints, async/concurrency, framework pitfalls (FastAPI, Django, Flask, SQLAlchemy) and runs ruff/mypy. Not for applying fixes (use minimal-change-engineer) or Postgres schema/query review (use postgres-reviewer). |
| `go-reviewer` | sonnet | Use when a diff touches Go, or `go build`/`go vet` fails — reviews error handling, concurrency, security and idioms, runs vet/staticcheck/race/govulncheck, and triages build errors. Not for applying fixes (use build-error-resolver or minimal-change-engineer). |
| `rust-reviewer` | sonnet | Use when a diff touches Rust, or `cargo check`/`clippy` fails — reviews safety, error handling, ownership, async/concurrency and idioms, runs check/clippy/test/audit, and triages borrow-checker and dependency errors. Not for applying fixes (use build-error-resolver or minimal-change-engineer). |
| `postgres-reviewer` | sonnet | Use when a change touches PostgreSQL schema, migrations, queries, indexes, RLS or connection handling — reviews for lock-safe migrations, query performance, data types, integrity and least privilege. Not for other databases (adapt manually) or ORM-level application logic (use the language reviewer). |
| `security-reviewer` | sonnet | Use when code touches auth, user input, queries, file handling, payments, webhooks, secrets or dependencies, or before a release — reviews against the OWASP Top 10 (2021) and runs the stack's dependency audit (npm/pip/Go/Cargo). Not for auditing a whole AI-generated app end to end (use ai-code-security-auditor). |
| `ai-code-security-auditor` | sonnet | Use to audit an app that was largely written by AI coding tools (Cursor, Claude Code, v0, Lovable, bolt) — hunts the predictable defaults: secrets reaching the client, row-level security that only looks enabled, client-editable authorization, and prompt-injection sinks. Runs scan → fix → rescan. Not for a routine diff review (use security-reviewer). |
| `terraform-reviewer` | sonnet | Use when a change touches Terraform or OpenTofu — reviews the code and the plan for destroys and replacements, blast radius, IAM and network exposure, state safety, drift and provider pinning. Never applies. Not for Kubernetes manifests or GitHub Actions (use github-actions-hardener). |

## Build

| Agent | Model | Use when |
|---|---|---|
| `software-architect` | opus | Use when choosing a system shape before building — new services or features with real structural choices, boundary and dependency questions, scaling plans, or an ADR. Produces options with named trade-offs and a recommendation. Not for API contract detail (use api-designer) or implementation (use backend-implementer / frontend-implementer). |
| `api-designer` | sonnet | Use when designing or changing an HTTP/gRPC/GraphQL API contract — resource modelling, OpenAPI specs, error shape, pagination, idempotency, rate limits, versioning and deprecation, or checking a change for backward compatibility. Not for overall system shape (use software-architect) or writing the handlers (use backend-implementer). |
| `backend-implementer` | sonnet | Use to implement backend features or endpoints in any stack (FastAPI, Express/Nest, Django, Go, Rust, Rails…) — writes a failing test, implements the smallest code that passes, verifies with the real test suite and a live request. Not for choosing the architecture (use software-architect), designing a public API contract (use api-designer), or a one-line bug fix (use minimal-change-engineer). |
| `frontend-implementer` | sonnet | Use to build or change React + TypeScript UI — screens, components, forms, data fetching and client state — with every state (loading, error, empty, success) handled, accessible by default, and verified in a real browser. Not for visual direction from scratch (use the frontend-design skill), React review (use react-reviewer), or React Native (use react-native-engineer). |
| `react-native-engineer` | sonnet | Use when building or changing a React Native / Expo app — Expo Router screens, data fetching, state placement, lists, styling, native APIs, secure storage and device verification. Not for Capacitor/Ionic web-view apps (use capacitor-engineer) or store submission (use mobile-release-engineer). |
| `capacitor-engineer` | sonnet | Use when building, debugging or shipping a Capacitor (Ionic) app that wraps a web build for Android/iOS — cap sync, native plugins and bridges, live reload, server.url / over-the-air updates, WebView origin and mixed-content issues, stale service workers, CORS and cookies, deep links, local notifications, safe areas, Android signing. Not for React Native (use react-native-engineer) or store submission (use mobile-release-engineer). |
| `minimal-change-engineer` | sonnet | Use for bug fixes and small, well-defined changes where the diff must stay surgical — fixes exactly what was asked, refuses scope creep, and lists follow-ups instead of doing them. Not for new features with design choices (use backend-implementer / frontend-implementer) or cleanup work (use refactor-cleaner). |

## Fix and improve

| Agent | Model | Use when |
|---|---|---|
| `build-error-resolver` | sonnet | Use when a build, compile or type-check fails and you want it green with the smallest possible diff, in any stack. Fixes errors only — no refactors, no redesign. Not for failing tests (use the systematic-debugging skill), language-specific review (use the *-reviewer agents), or dead-code cleanup (use refactor-cleaner). |
| `e2e-test-debugger` | sonnet | Use when a Playwright end-to-end test fails or is flaky — reproduces it several ways, reads the trace, classifies the cause (timing, isolation, environment, infrastructure) and applies a fix proven by a burn-in run. Not for unit test failures (use the systematic-debugging skill) or writing a new suite from scratch. |
| `performance-optimizer` | sonnet | Use when something is measurably slow or heavy — page load, Core Web Vitals, bundle size, slow endpoints or queries, memory growth, janky rendering. Measures a baseline first, changes one thing at a time, and proves the improvement with before/after numbers. Not for speculative "make it faster" without a symptom, or for database schema review (use postgres-reviewer). |
| `refactor-cleaner` | sonnet | Use when asked to remove dead code, unused exports or dependencies, or consolidate duplicates — finds candidates with tooling, proves each is unused, and removes them in small batches with tests run before and after every batch. Not during active feature work or right before a release, and not for bug fixes (use minimal-change-engineer). |

## Ship and operate

| Agent | Model | Use when |
|---|---|---|
| `github-actions-hardener` | sonnet | Use when writing, reviewing or hardening GitHub Actions workflows — SHA-pinned actions, least-privilege permissions, OIDC instead of long-lived cloud keys, script-injection and pull_request_target risks, concurrency, timeouts, caching — or when triaging a failing CI run. Not for deploy verification (use deploy-verifier) or Terraform (use terraform-reviewer). |
| `deploy-verifier` | sonnet | Use when deploying to production or staging and you need proof the new build is actually live — runs tests, builds, deploys, then verifies the live system serves the new revision before saying "shipped". Not for reviewing what is about to ship (use preship-reviewer) or diagnosing a broken production (use prod-log-triage). |
| `prod-log-triage` | haiku | Use after a deploy, during an incident, or whenever production "seems off" — pulls real logs, groups errors by root cause, separates unique failures from retries, and states what could not be confirmed. Not for fixing the bug (hand findings to the systematic-debugging skill) or setting SLOs (use sre). |
| `sre` | sonnet | Use when defining what "reliable enough" means for a service — SLIs/SLOs, error budgets, burn-rate alerts, golden-signal dashboards, health checks, runbooks, rollout policy and blameless postmortems. Not for pulling live logs during an incident (use prod-log-triage) or deploying (use deploy-verifier). |
| `mobile-release-engineer` | sonnet | Use when shipping a mobile app to the App Store or Google Play — code signing and keystores, version/build numbers, fastlane or Gradle release pipelines, store metadata and privacy forms, review rejections, staged rollouts and crash symbols. Not for app code (use capacitor-engineer or react-native-engineer) or store listing copy and keywords (use the ASO agent in the growth plugin). |

## Typical pairings

- **Before a PR:** `code-reviewer`, plus `react-reviewer` + `typescript-reviewer` for `.tsx` diffs, `postgres-reviewer` for migrations, and `security-reviewer` for auth/input/payment code.
- **Before a deploy:** `preship-reviewer` → `deploy-verifier` → `prod-log-triage`.
- **Mobile (Capacitor):** `capacitor-engineer` builds and debugs; `mobile-release-engineer` signs and ships.
- **Something is red:** `build-error-resolver` for compile/type errors, `e2e-test-debugger` for flaky Playwright tests, `github-actions-hardener` for CI-only failures.

Sources and licences: see [NOTICE.md](NOTICE.md).
