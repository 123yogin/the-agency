---
description: Review a change with parallel reviewers, one per quality dimension, then merge into one deduplicated report
argument-hint: "<files | dir | diff range | PR number> [--reviewers security,performance,architecture,testing,accessibility]"
---

# Team Review

Each reviewer goes deep on one dimension. You then deduplicate their findings
and calibrate severity across them. Use this for large or risky changes. For an
ordinary diff, one pass with the engineering plugin's `code-reviewer` is faster
and usually enough.

**Experimental mode:** if `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set, run
the reviewers as an agent team. If it is not set, use ordinary parallel
subagents: one message, one Agent call per dimension.

Input: `$ARGUMENTS`.

## 1. Resolve the target

- Files or directory: review them as they are.
- Diff range (`main...HEAD`): run `git diff <range> --stat` and `git diff <range>`.
- PR number: run `gh pr view <n>` and `gh pr diff <n>`.

Say "N files, M dimensions" before starting. If the diff has more than about
2,000 lines, split it by area and say so.

## 2. Pick dimensions

Use the reviewers the user named. Otherwise pick from what the change touches,
using the table in the multi-reviewer-patterns skill:

| Change touches | Dimensions |
|---|---|
| API endpoints, auth, user input | security, performance, architecture |
| UI components | architecture, testing, accessibility |
| Database or migrations | performance, architecture |
| A new feature end to end | security, performance, architecture, testing |

## 3. Review

Spawn one `meta:team-reviewer` per dimension, all in a single message. Each
prompt contains its dimension, the file list, the full diff, and one line on
what the change is meant to do.

## 4. Consolidate

1. Same `file:line` and same issue: merge, credit both dimensions, keep the
   higher severity.
2. Same `file:line` but different issues: keep both.
3. Same issue in several places: keep one finding and list the locations.
4. Spot-check every Critical and High yourself against the code before it goes
   in the report. Drop anything that doesn't hold up.

## 5. Report

```
## Review: <target>
Dimensions: <list>   Files: <n>

Verdict: APPROVE | APPROVE WITH FIXES | BLOCK

### Critical
- [security] `path:line` — <issue>. Fix: <change>
### High
...
### Medium
...
### Low
...

Summary: <n> Critical, <n> High, <n> Medium, <n> Low
```

BLOCK if there is any confirmed Critical. Use APPROVE WITH FIXES if there are
any High findings.

## 6. Clean up

In team mode, send each teammate a shutdown request, then call TeamDelete.

<!-- Adapted from wshobson/agents plugins/agent-teams/commands/team-review.md (MIT, Copyright (c) 2024 Seth Hobson). -->
