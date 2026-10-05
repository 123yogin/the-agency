---
name: experiment-designer
description: Use when planning an A/B or multivariate test, writing a testable hypothesis, sizing a sample, prioritising a queue of experiments, or deciding what a result means. Enforces pre-registered metrics, stopping rules and effect-size reasoning over p-value worship.
---

# Experiment Designer

An experiment is only worth running if its result will change a decision. Fix
the decision, the metric and the stopping rule before any traffic is assigned.

## Hard rules

- **Hypothesis in If / Then / Because form.**
  *If we {intervention} for {audience}, then {metric} will {direction} by at
  least {MDE}, because {behavioural mechanism}.*
- **One primary metric decides ship / no-ship.** Guardrails protect against
  damage (errors, latency, churn proxy, support contacts). Secondary metrics are
  diagnostic only unless pre-registered as gates.
- **Sample size or duration is fixed in advance.** No repeated peeking with
  fixed-horizon statistics. If early stopping is needed, use a sequential method
  and say so up front.
- **Run at least one full weekly cycle** to cover weekday/weekend behaviour.
- **Nothing changes mid-test:** targeting, implementation, metric definitions.
- **Statistical significance is not business significance.** Decide on the point
  estimate and confidence interval against a practical threshold.

## Workflow

1. **Write the hypothesis** and run it through the checklist below.
2. **Define metrics:** primary, guardrails with breach thresholds, diagnostics.
3. **Size the test.** Choose the MDE from business value (the smallest lift worth
   shipping), not from optimism.

   ```bash
   python3 scripts/sample_size_calculator.py --baseline-rate 0.12 --mde 0.02 --mde-type absolute
   python3 scripts/sample_size_calculator.py --baseline-rate 0.12 --mde 0.10 --mde-type relative --daily-samples 3000
   ```

   It returns per-variant and total sample size for a two-proportion test
   (defaults: alpha 0.05, power 0.8) and, with `--daily-samples`, the runtime in
   days. If the runtime is unacceptable, raise the MDE, pick a higher-traffic
   surface, or do not run the test.
4. **Prioritise** a queue with ICE: Impact × Confidence × Ease, each 1–10,
   divided by 10. Confidence must reflect evidence, not enthusiasm.
5. **Pre-launch checks:** instrumentation fires, assignment is random, the
   sample ratio matches the planned split, rollback is documented.
6. **Read out** with the template below.

## Hypothesis checklist

- [ ] Names the intervention and the audience
- [ ] Names a measurable metric and direction
- [ ] States a plausible causal mechanism
- [ ] States the minimum effect worth detecting
- [ ] Defines what failure looks like

## Pitfalls to check for in every readout

- Underpowered test reported as "no effect" (it is "inconclusive").
- Sample ratio mismatch: the observed split differs from the planned split.
- Several simultaneous changes with no isolation.
- Novelty effects: compare new vs returning users and later cohorts.
- Post-hoc segments presented as findings without correction (they are leads
  for the next test).
- A confidence interval that crosses zero described as a win.

## Readout template

```markdown
# Experiment readout: {name}

Hypothesis: If {…}, then {…}, because {…}
Setup: {variants, split, audience, dates, n per variant}
Quality checks: sample ratio {ok / mismatch}, instrumentation {ok / issue}

Primary metric: {control} vs {variant}, effect {x} (95% CI {lo} to {hi})
Practical threshold: {x} — cleared | not cleared | inconclusive
Guardrails: {each: ok / breached}
Pre-registered segments: {observations}

Decision: ship | iterate | reject — {reason}
Follow-up tests: {list}
```

Depth: `references/experiment-playbook.md` (test types, stopping rules, novelty)
and `references/statistics-reference.md` (p-values, intervals, power, error types).

<!-- Adapted from alirezarezvani/claude-skills product-team/skills/experiment-designer (MIT). -->
