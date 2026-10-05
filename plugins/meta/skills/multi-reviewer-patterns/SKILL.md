---
name: multi-reviewer-patterns
description: Use when splitting a code review across several reviewers or dimensions, merging findings from more than one reviewer, or calibrating severity so different reviewers' ratings mean the same thing.
---

# Multi-Reviewer Patterns

A review with several reviewers adds value only if each goes deep on its own
dimension and the merge removes duplicates and inconsistent severities. Without
that, you get three shallow reviews stapled together. The `/team-review`
command runs this workflow.

## Picking dimensions

| Change touches | Dimensions |
|---|---|
| API endpoints, auth, user input | security, performance, architecture |
| UI components | architecture, testing, accessibility |
| Database or migrations | performance, architecture |
| Authentication | security, testing |
| A new feature end to end | security, performance, architecture, testing |

More than four reviewers rarely adds anything. Each extra one mostly adds
duplicates.

## Merge rules

1. Same `file:line`, same issue: merge into one finding, credit every
   dimension, keep the higher severity and the more detailed description.
2. Same `file:line`, different issues: keep both and mark them co-located.
3. Same issue in several places: keep one finding and list the locations.
4. Conflicting recommendations: keep both, attributed to their reviewers, and
   say which you would pick and why.
5. Verify every Critical and High yourself against the code before it goes in
   the report. A reviewer's claim is not evidence.

## Severity calibration

| Severity | Impact | Likelihood | Examples |
|---|---|---|---|
| Critical | Data loss, security breach, total failure | Certain or very likely | SQL injection, auth bypass, data corruption |
| High | Major functionality broken or degraded | Likely | Memory leak, missing validation, broken flow |
| Medium | Partial impact, workaround exists | Possible | N+1 query, missing edge case, unclear error |
| Low | Cosmetic, minimal | Unlikely | Naming, minor optimization |

Floors: a vulnerability an external user can exploit is at least High. A
performance problem in a hot path, a missing test on a critical path, or an
accessibility failure in core functionality is at least Medium.

## Verdict

- **BLOCK:** any confirmed Critical.
- **APPROVE WITH FIXES:** any High.
- **APPROVE:** Medium and Low only.

The per-dimension checklists are in `references/review-dimensions.md`.

<!-- Adapted from wshobson/agents plugins/agent-teams/skills/multi-reviewer-patterns (MIT, Copyright (c) 2024 Seth Hobson). -->
