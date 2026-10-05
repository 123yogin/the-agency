---
description: Debug a hard bug by investigating competing root-cause hypotheses in parallel, then arbitrate on the evidence
argument-hint: "<error description or file> [--hypotheses N]"
---

# Team Debug

Use the Analysis of Competing Hypotheses: generate several distinct root-cause
hypotheses, have one investigator test each in parallel, and pick the cause the
evidence supports. This prevents anchoring on the first plausible explanation.

Use this when a bug has several plausible causes, or one person's debugging
attempt has already stalled. For a bug with an obvious lead, use the
systematic-debugging skill instead. It is cheaper.

**Experimental mode:** if `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set, run
the investigators as an agent team (TeamCreate, TaskCreate, teammates). If it is
not set, run the same workflow with ordinary parallel subagents: one message,
one Agent call per hypothesis. The investigators and the arbitration are the
same either way.

Input: `$ARGUMENTS`. Default to 3 hypotheses and at most 5.

## 1. Triage (you, before spawning anyone)

1. Pin down the symptom: what fails, the exact error, when it started, and how
   to reproduce it. Run the reproduction yourself if one exists.
2. Collect context: `git log --oneline -20` on the affected area, related tests,
   config that differs between the working and failing environments.

## 2. Hypotheses

Write N hypotheses that are falsifiable and come from different categories.
Two hypotheses in the same category usually means one is redundant.

Categories: logic error, data issue, state or concurrency problem, integration
or contract failure, resource exhaustion, environment or version difference.

For each one, state what would confirm it and what would falsify it. Use the
task template in the parallel-debugging skill's `references/hypothesis-testing.md`.
Show the list to the user before spawning.

## 3. Investigate

Spawn one `meta:team-debugger` per hypothesis, all in a single message. Each
prompt contains: the hypothesis, its confirm and falsify criteria, the
reproduction, the files in scope, and the triage context. Don't make
investigators rediscover what you already know.

## 4. Arbitrate

Sort the reports into Confirmed, Plausible, Falsified and Inconclusive.

- One Confirmed hypothesis with a reproduction: that is the root cause.
- Several Confirmed: check whether this is a compound cause (both contribute)
  or whether one report's evidence is weaker than it claims. Rank by direct
  evidence, then by completeness of the causal chain.
- None Confirmed: write a new set of hypotheses from what the investigators
  ruled out and their out-of-scope observations, then run one more round. After
  two empty rounds, stop and report what is known.

## 5. Report

```
## Debug report: <symptom>

Root cause: <hypothesis>  (confidence: High | Medium | Low)
Evidence: <the 2-3 strongest items, with file:line>
Causal chain: <cause> → ... → <symptom>
Reproduction: <command that fails now>

Recommended fix: <specific change>
How to verify the fix: <the reproduction should pass; tests to add>

Ruled out:
- <hypothesis>: Falsified — <one-line reason>
```

Do not apply the fix as part of this command unless the user asks. If they do,
follow the verification-before-completion skill.

## 6. Clean up

In team mode, send each teammate a shutdown request, then call TeamDelete.

<!-- Adapted from wshobson/agents plugins/agent-teams/commands/team-debug.md (MIT, Copyright (c) 2024 Seth Hobson). -->
