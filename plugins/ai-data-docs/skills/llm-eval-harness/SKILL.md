---
name: llm-eval-harness
description: Use when building or fixing evaluation for an LLM feature, agent, prompt change, RAG pipeline or fine-tune — before shipping a prompt/model change, when "it seems better" is the only evidence, or when an LLM judge's verdicts need to be trusted. Enforces error analysis first, one grader per failure mode, deterministic checks before judges, and a calibrated judge.
---

# LLM Eval Harness

No harness, no change. A prompt edit, model swap, retrieval tweak or fine-tune
without a fixed measuring stick is a guess. The harness also becomes the
regression suite and, for fine-tuning, the labelled data source.

**Input:** real traces if any exist (production logs, agent transcripts), or a
task spec if not; someone willing to label ≥100 examples.
**Output:** the `eval/` directory below plus a baseline score for the current
system.

## The loop

1. **Collect traces** — real inputs and outputs. Synthetic only if none exist.
2. **Error analysis** — read ≥100 traces. Open coding: tag every failure in your
   own words, no fixed taxonomy. Then axial coding: collapse the tags into 4–8
   named failure buckets.
3. **One grader per bucket** — deterministic first; a calibrated LLM judge only
   for criteria no code can check.
4. **Prioritise** buckets by frequency × severity × business value.
5. **Baseline** — run the full harness on the current system and save the result.
6. **Change one thing** (prompt, model, retrieval, fine-tune).
7. **Re-run the same harness** — never a looser one — and compare per bucket.
8. **New production failures re-open step 2.**

## Building goldens

- **From traces:** fewer than 4 buckets means the coding pass was too shallow;
  more than 8 means buckets should be merged. Exception: a single-surface task
  (strict schema extraction) can have 1–2 buckets with per-field sub-metrics —
  do not invent splits with no evidence behind them.
- **Synthetic, when no traces exist:** enumerate the axes that matter (task type,
  difficulty, edge case, user type, language) and sample their cross-product.
  Free-form generation clusters around whatever is easiest to write.
- **Version goldens like code.** Commit `eval/goldens.jsonl`, review diffs, tag
  per release. If the goldens also feed training data, exclude every golden ID
  from training explicitly.

## Graders

- **One grader per failure bucket**, not one blended score — a blend hides which
  bucket regressed.
- **Deterministic first:** regex, JSON-schema validation, exact match, executing
  generated code, checking a cited ID exists. Cheap, reproducible, nothing to
  calibrate.
- **LLM judge only for genuinely subjective criteria** — tone, faithfulness,
  pairwise preference.
- **Binary pass/fail beats Likert.** 1–5 scales are noisier and drift between
  graders; define the bar and collapse to pass/fail.
- For multiple-choice style checks with logit access, score by answer-token
  logprob rather than generate-and-parse (see `references/grader-templates.md`).

Templates for each grader shape: `references/grader-templates.md`.

## Judge Calibration Is a Prerequisite

A judge's verdicts count only after calibration. If no bucket uses a judge, write
"Judge calibration: N/A — all graders deterministic" and move on.

- Label ≥100 items; split train / dev / sealed test. Report the sealed test once.
- Report **TPR and TNR**, not accuracy — a judge that always says "pass" scores
  90% on a 90%-pass set.
- Pin the judge to a fixed model snapshot. Recalibrate when the judge model
  changes, and at least quarterly.
- Use a different model family for the judge than the system under test, to
  avoid self-preference.
- A judge below the agreed TPR/TNR bar is **advisory only**: it flags items for
  human review and never gates a release.

Full protocol, bias correction and recalibration checklist:
`references/judge-calibration.md`.

## Directory contract

```
eval/
  goldens.jsonl            # labelled cases, versioned
  graders/                 # one module per failure bucket
  baseline-<system>.json   # scores for the current system — the comparison point
  drift-suite.yaml         # fine-tuning only: frozen general benchmarks + domain-adjacent
                           # items that catch capability loss (see references/grader-templates.md)
runs/
  <run-id>/results.json    # one per candidate; disposable
```

`eval/` is the fixed measuring stick; run scripts never write into it.

## Reading results

- Compare per bucket against the baseline, with sample sizes. On n=50, a 4-point
  move is noise; compute a confidence interval (the `statistical-analyst` skill
  has the scripts) before calling a win.
- Any bucket that regresses beyond its agreed threshold blocks the change, even if
  the average improves.
- Re-run nondeterministic systems at least 3 times, or fix the seed and
  temperature, and report the spread.

## Exit checklist

1. ≥100 traces coded into 4–8 buckets (or the single-surface exception, stated).
2. `eval/goldens.jsonl` committed.
3. One grader per bucket, deterministic where possible.
4. Judges calibrated with TPR/TNR reported, or N/A stated.
5. Baseline written for the current system.
6. Per-bucket regression thresholds agreed.

Missing any item means the harness is not ready to gate a change.

<!-- Adapted from wshobson/agents plugins/llm-finetuning/skills/eval-harness-first (MIT), generalised beyond fine-tuning. -->
