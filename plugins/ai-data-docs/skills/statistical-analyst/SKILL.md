---
name: statistical-analyst
description: Use when deciding whether an observed difference is real — reading A/B test results, sizing an experiment before launch, putting a confidence interval on a metric, or answering "is this significant?". Answers statistical and practical significance separately and flags peeking, multiple comparisons and underpowered tests. Stdlib-only scripts; no scipy needed.
---

# Statistical Analyst

Decisions from evidence, not from a chart that looks good. "Statistically
significant" and "worth acting on" are two different questions; answer both,
every time.

## Modes

**1. Analyse a finished experiment**
1. Confirm: metric type (rate, mean, counts), n per arm, observed values, the
   planned sample size and end date, and the decision that depends on it.
2. Pick the test (table below) and run it.
3. Report p-value, confidence interval for the difference, and effect size.
4. Check the validity threats list before deciding.

**2. Size an experiment before launch**
1. Get baseline, minimum detectable effect (MDE — the smallest change worth
   acting on), α (default 0.05), power (default 0.80).
2. Run `sample_size_calculator.py`; divide by daily traffic per arm for duration.
3. If the duration is unacceptable, raise the MDE or accept lower power — say
   which, explicitly.
4. Write down the stopping rule (fixed n or end date) before launch.

**3. Interpret a number someone shared**
Ask for n, observed values and baseline; run the matching test; answer in the
communication format below.

## Tools (run from this skill's directory)

```bash
# Two proportions (conversion A/B)
python3 scripts/hypothesis_tester.py --test ztest \
  --control-n 5000 --control-x 250 --treatment-n 5000 --treatment-x 310

# Two means, Welch's t-test (revenue per user, latency)
python3 scripts/hypothesis_tester.py --test ttest \
  --control-mean 42.3 --control-std 18.1 --control-n 800 \
  --treatment-mean 46.1 --treatment-std 19.4 --treatment-n 820

# Chi-square goodness of fit (category counts)
python3 scripts/hypothesis_tester.py --test chi2 --observed "120,80,50" --expected "100,100,50"

# Sample size per variant (MDE is relative: 0.20 = +20%)
python3 scripts/sample_size_calculator.py --test proportion --baseline 0.05 --mde 0.20
python3 scripts/sample_size_calculator.py --test mean --baseline-mean 42.3 --baseline-std 18.1 --mde 0.10
python3 scripts/sample_size_calculator.py --test proportion --baseline 0.05 --mde 0.20 --table

# Confidence interval (Wilson for proportions)
python3 scripts/confidence_interval.py --type proportion --n 1200 --x 96
python3 scripts/confidence_interval.py --type mean --n 800 --mean 42.3 --std 18.1
```

Every script accepts `--format json`. Scripts take summary statistics; compute
n, counts, means and standard deviations from the raw data first (and say how).

## Test selection

| Situation | Test |
|---|---|
| Conversion / any yes-no rate, two arms | two-proportion z-test |
| Continuous metric, two arms | Welch's t-test |
| Counts across categories vs expected | chi-square |
| Small n, heavy tails or clearly non-normal | Mann–Whitney U or bootstrap — not in these scripts; say so |
| Ratio metrics (revenue per session) | delta method or bootstrap — not in these scripts |
| Users clustered (teams, regions, devices) | cluster-robust methods — standard tests assume independence |

Heavy-tailed metrics (revenue with a few whales): consider a log transform,
winsorising or a trimmed mean, and say which you used.

## Decision rule

| Result | Effect relative to MDE | Decision |
|---|---|---|
| significant | ≥ MDE | ship |
| significant | well below MDE | hold — real but probably not worth it |
| not significant, test reached planned n | — | no detectable effect at this MDE; stop |
| not significant, underpowered | — | inconclusive; extend to planned n or accept |
| any | guardrail metric worsened | do not ship |

Judge practical size against the MDE and business value, not against Cohen's
generic small/medium/large labels; the scripts print those labels for
reference only. A 1.2-point lift on a 5% conversion rate is a "negligible"
Cohen's h and can still be very valuable.

## Validity threats — raise these unprompted

- **Peeking**: results checked repeatedly and stopped when significant inflates
  false positives. Ask whether the planned end date was respected; if not, use
  sequential methods or treat the result as exploratory.
- **Multiple comparisons**: 10 metrics at α = 0.05 give ~40% chance of at least
  one false positive. Name a primary metric; correct the others (Bonferroni or
  Holm) when more than ~3 are tested.
- **Underpowered**: a non-significant result below the planned n says little.
- **Sample ratio mismatch**: if the split differs from the design (e.g. 50/50
  intended, 52/48 observed on large n), run a chi-square on the counts — a
  mismatch points to a broken assignment and invalidates the test.
- **Interference** (SUTVA): users in different arms affect each other — social
  features, shared inventory, marketplaces.
- **Simpson's paradox**: aggregate and segment results disagree; check key
  segments before concluding.
- **Novelty effects**: early UX lifts often decay; re-measure later.

## Communication format

```
Bottom line: <one sentence — direction, size with CI, significance, recommendation>
Numbers: control <x>, treatment <y>, difference <d> (95% CI <lo> to <hi>), p = <p>, n = <a>/<b>
Practical: <what the effect means in users, revenue or time; vs the MDE>
Threats checked: peeking <ok/issue>, SRM <ok/issue>, multiple metrics <ok/issue>, power <ok/issue>
Decision: ship | hold | extend | stop — <why>
Confidence: verified | likely | inconclusive
```

Theory, formulas and error types: `references/statistical-testing-concepts.md`.

<!-- Adapted from alirezarezvani/claude-skills engineering/statistical-analyst (MIT). -->
