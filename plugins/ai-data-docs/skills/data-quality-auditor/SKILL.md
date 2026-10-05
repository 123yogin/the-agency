---
name: data-quality-auditor
description: Use before trusting a dataset for analysis, a dashboard or model training, or when a metric suddenly looks wrong — profiles completeness, validity, uniqueness and outliers, classifies missingness, and produces a ranked remediation plan. Stdlib-only scripts for CSV; never auto-fixes data without confirmation.
---

# Data Quality Auditor

Find what will silently corrupt the analysis before anyone builds on it. The
score is a summary; the findings and their evidence are the deliverable.

## Modes

**Full audit (a dataset you have not assessed)**
1. Profile → 2. Missing values → 3. Outliers → 4. Cross-column and key checks →
5. Ranked findings and remediation plan.

**Targeted scan (something broke)**
Ask what broke, when it started and what changed upstream. Run the relevant
script on the suspect columns, compare against a known-good period, and trace
to the source system, transform or ingestion step.

**Monitoring setup**
Pick the 5–8 columns that drive key metrics; define acceptable null %, outlier
rate and value domain for each; generate thresholds with
`data_profiler.py --monitor`; schedule at ingestion cadence.

## Tools (run from this skill's directory; CSV input)

```bash
python3 scripts/data_profiler.py --file data.csv               # profile + score
python3 scripts/data_profiler.py --file data.csv --columns a,b
python3 scripts/data_profiler.py --file data.csv --monitor     # alert thresholds
python3 scripts/missing_value_analyzer.py --file data.csv --threshold 0.05
python3 scripts/outlier_detector.py --file data.csv --method mzscore   # iqr | zscore | mzscore
```

All accept `--format json`. For a database table or Parquet file, export a
representative sample to CSV first and say how it was sampled, or run the
equivalent checks in SQL.

## Checks the scripts do not do — do them yourself

- **Disguised nulls**: `0`, `""`, `"N/A"`, `"null"`, `-1`, `1970-01-01`,
  sentinel values like `99999`. Completeness numbers are wrong until these are
  counted as missing.
- **Key uniqueness**: duplicates in the primary key (and in natural keys like
  email) — they break joins and double-count.
- **Referential integrity**: foreign keys with no matching parent.
- **Logical constraints**: end before start, negative quantities, age outside a
  plausible range, totals that do not equal the sum of parts.
- **Time**: future timestamps, dates before the system existed, timezone
  mix-ups, gaps or spikes in daily row counts.
- **Cardinality**: free text pretending to be a category.
- **Correlated missingness**: nulls concentrated in a date range, segment or
  source — evidence the data is not missing at random, whatever the heuristic
  says.
- **Drift**: compare distributions with the previous period.

## Score

The profiler's Data Quality Score weights completeness 30%, consistency 25%,
validity 20%, uniqueness 15%, timeliness 10%. Treat ≥ 85 as usable, 65–84 as
usable with documented caveats, < 65 as needing remediation — but a single
critical finding (duplicate primary keys, a broken join key, a sentinel value
inflating a revenue mean) overrides a passing score.

## Remediation guide

| Issue | Default action |
|---|---|
| < 1% missing, large data | drop rows or impute median/mode |
| 1–10% missing | impute and add `<col>_was_null` |
| 10–30% missing | impute cautiously, find the cause, document it |
| > 30% missing | escalate to the data owner; consider dropping the column |
| Impossible value | correct at source, cap or drop — with confirmation |
| Rare but valid extreme | keep; document; consider log transform for modelling |
| Unknown outlier | flag; never silently remove |
| Duplicate rows | confirm the uniqueness key with the owner first; latest wins for event data, first wins for slowly changing dimensions |

Identifiers and contact fields (IDs, emails) are never imputed.

## Report format

```
Bottom line: DQS <n>/100 — <usable | usable with caveats | remediation required>; <the one finding that matters most>

Findings (ranked by severity × breadth)
1. [critical|high|medium|low] <column(s)> — <issue>
   Evidence: <counts, example values, script output>
   Impact: <what analysis or model it corrupts>
   Fix: <specific transform or upstream fix>
   Confidence: verified | likely | assumed

Monitoring thresholds (if requested)
| column | max null % | max outlier % | domain |
```

Never apply a fix to "assumed" findings without the data owner's confirmation.
Background on missingness mechanisms and outlier methods:
`references/data-quality-concepts.md`.

<!-- Adapted from alirezarezvani/claude-skills engineering/data-quality-auditor (MIT). -->
