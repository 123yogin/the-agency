---
name: mle-workflow
description: Use when building, refreshing or hardening a production ML model (classifier, ranker, recommender, forecaster, embedding model) beyond a one-off notebook — framing the decision, data contract and leakage checks, reproducible training, promotion gates, serving, monitoring and rollback. Scale it to the system; do not bolt heavyweight MLOps onto a small model.
---

# ML Engineering Workflow

Turn model work into a system someone else can reproduce, evaluate, ship and
roll back. Use only the parts that fit: not every model has labels, online
serving, a feature store or A/B tests. When something is missing (no labels,
no traffic, no monitoring owner), say so explicitly instead of assuming it.

## 1. Iteration compact (before any model code)

Short enough for a PR description, precise enough to argue with:

```text
Goal / decision changed by the model:
Who cares, and decision owner:
Success metric:            Guardrail metrics:
Unacceptable mistakes:     Acceptable mistakes:
Labels and data snapshot:
Baseline to beat:
Candidate signals (and why they should separate outcomes):
Threshold / config plan:
Eval slices:
Known risks:
Next experiment:
Rollback / fallback:
```

Start from the decision, not the architecture. Prefer the simplest change that
reduces the most important mistake.

## 2. Metrics from mistake costs

- Look at the confusion matrix with the people who pay for each error type.
- Precision when wrong positives are expensive; recall when misses are; F1
  only when the trade-off is genuinely balanced; AUC/ranking metrics when order
  matters more than one threshold; calibration when scores are read as
  probabilities.
- Latency, throughput, memory and cost are first-class metrics.
- Always compare against a simple baseline and the current production model.
- Feedback signals (clicks, reports) are delayed, biased labels — analyse
  their lag and coverage before treating them as ground truth.
- Thresholds are product decisions; record the trade-off each one makes.

## 3. Data contract and leakage

Write down: entity grain and key; label definition, timestamp and arrival
delay; feature timestamps and freshness; point-in-time join rules; split
policy; allowed ranges, nulls, units and categories; excluded PII; dataset
snapshot/version.

Leakage checks, before training:
- Every feature is available at prediction time, computed only from data before
  the prediction timestamp.
- No post-outcome fields, future labels or mutable aggregates recomputed later.
- Splits respect time and entity (user, account, device) boundaries — no random
  split on time- or user-dependent data.
- Preprocessing (scalers, encoders, vocabularies) is fit on training data only.

## 4. Reproducible training

- Runnable from code + config + dataset version + seed, with no notebook state.
- Config in typed files; dependencies pinned; seeds set; GPU nondeterminism
  documented.
- Record code SHA, config hash, dataset version, metrics and artifact URI per
  run.
- Preprocessing is saved with the model artifact.
- Retries are idempotent and cannot overwrite a known-good artifact.

## 5. Evaluate and promote

Declare gates before seeing results, and make them fail closed:

```python
GATES = {"auc": ("min", 0.82), "calibration_error": ("max", 0.04), "p95_latency_ms": ("max", 80)}
# example thresholds — set yours from the mistake budget

def assert_promotable(metrics: dict[str, float]) -> None:
    missing = [k for k in GATES if k not in metrics]
    if missing:
        raise ValueError(f"missing gate metrics: {missing}")
    failed = {k: metrics[k] for k, (d, t) in GATES.items()
              if (d == "min" and metrics[k] < t) or (d == "max" and metrics[k] > t)}
    if failed:
        raise ValueError(f"failed gates: {failed}")
```

- Slice metrics for important cohorts; a model that improves overall while a key
  slice regresses does not ship.
- Confidence intervals or repeated-run variance where metrics are noisy.
- The test set is touched once per decision, not tuned against.
- Offline gates are necessary, not sufficient: plan shadow traffic, canary or an
  A/B test when the model changes user-facing behaviour.

## 6. Error analysis loop (after every run or threshold change)

1. Split errors: false positives, false negatives, abstentions, low confidence,
   system failures.
2. Cluster by shared traits: source, language, segment, recency, sparsity,
   feature freshness, label source, model version.
3. Separate model mistakes from data bugs, label ambiguity, product ambiguity
   and serving mismatches.
4. Map each big cluster to one move: better labels, better features, better
   threshold/config, or a product fallback.
5. Keep every important mistake as a regression test or eval slice.
6. Write the next iteration as a falsifiable experiment.

## 7. Package and serve

- Artifact carries version, config, dataset reference and preprocessing.
- Training and serving transforms are shared code, or tested for equivalence.
- Input validation rejects missing, stale, mistyped and out-of-range features.
- Output includes model version (and confidence where useful).
- Timeouts, batching, resource limits and a fallback path.
- Prediction logs join to delayed labels by ID and exclude PII.
- Never load untrusted pickle/joblib artefacts.

## 8. Operate

Monitor service health (errors, timeouts, p50/p95/p99), feature null rates and
drift, prediction and confidence drift, label arrival, delayed quality, and
business guardrails — per model version. Every alert has an owner. Rollback
switches to a named previous artifact and config; it never requires retraining.

## Checklist

- [ ] Iteration compact written; baseline defined
- [ ] Data contract with label/feature timing and snapshot
- [ ] Leakage checks done against prediction-time availability
- [ ] Training reproducible from code, config, data version, seed
- [ ] Gates declared up front, automated, fail closed; slices included
- [ ] Train/serve transform parity tested
- [ ] Serving validates inputs, has timeout, fallback and rollback
- [ ] Monitoring covers data and prediction quality, not just uptime
- [ ] No sensitive data in artifacts, logs or examples

The `mle-reviewer` agent reviews against this checklist.

<!-- Adapted from affaan-m/ECC skills/mle-workflow (MIT). -->
