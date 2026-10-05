---
name: parallel-debugging
description: Use when a bug has several plausible root causes, one line of debugging has stalled, or the issue spans multiple components and you are about to split the investigation across parallel agents.
---

# Parallel Debugging (Competing Hypotheses)

Debugging alone tends to anchor on the first plausible cause. Testing several
distinct hypotheses in parallel, each by an investigator who only cares about
theirs, removes the anchor. The `/team-debug` command runs this workflow. This
skill holds the standards it relies on.

If one cause is obvious, use the systematic-debugging skill instead.

## Hypotheses must be

- **Falsifiable:** state what observation would prove it wrong.
- **Distinct:** each from a different category. Two in the same category
  usually means one is redundant.
- **Specific:** "the cache returns stale data after a role change, because
  `invalidate()` keys on the user id but not the role" is a hypothesis.
  "Caching issue" is not.

Categories: logic error, data issue, state or concurrency, integration or
contract, resource exhaustion, environment or version.

## Evidence strength

| Type | Strength | Example |
|---|---|---|
| Reproduction | Strongest | A test that fails exactly as the hypothesis predicts |
| Direct | Strong | `file.ts:42` uses `>` where the spec requires `>=` |
| Correlational | Medium | The error rate rose after commit `abc123` |
| Absence | Variable | No null check anywhere on the path |
| Testimonial | Weak | "Works on my machine" |

Confidence: **High** means direct evidence plus a complete causal chain, with
nothing contradicting it. **Medium** means some direct evidence and a plausible
chain. **Low** means mostly correlational evidence, or gaps in the chain.

## Arbitration

1. Sort the reports into Confirmed, Plausible, Falsified and Inconclusive.
2. One Confirmed hypothesis: that is the root cause. Several: decide between a
   compound cause and one report overclaiming. Rank by reproduction, then direct
   evidence, then completeness of the causal chain.
3. None Confirmed: write new hypotheses from what was ruled out and from the
   out-of-scope observations, and run one more round. Two empty rounds means
   stop and report what is known.

## Before declaring it fixed

- [ ] The fix targets the confirmed cause, not the symptom.
- [ ] The original reproduction now passes. You ran it.
- [ ] A regression test exists that failed before the fix.
- [ ] The full test suite still passes.

Templates for the hypothesis task and the evidence report are in
`references/hypothesis-testing.md`.

<!-- Adapted from wshobson/agents plugins/agent-teams/skills/parallel-debugging (MIT, Copyright (c) 2024 Seth Hobson). -->
