---
name: saas-metrics
description: Use when the user shares subscription business numbers (MRR, customers, churn, spend, margin) and wants health metrics, unit economics, a benchmark read, or what to fix first. Computes every metric from stated formulas, labels benchmarks as indicative, and caps priorities at three.
---

# SaaS Metrics

Take raw numbers, compute the metrics, compare with *indicative* ranges for
the right segment, and say plainly what to fix first.

## Hard rules

- **Compute with `python3`, show inputs and formulas.** No mental arithmetic.
- **Work with partial data;** list exactly what's missing and every assumption.
- **Benchmarks are indicative.** Show them as ranges from
  `references/benchmarks.md`, labelled "indicative", matched to segment and
  stage — and confirm the segment before judging. 5% monthly churn is alarming
  for enterprise, ordinary for many consumer apps.
- **At most three priority issues.**
- **Be direct.** If a number is bad, say so.

## Step 1: Collect (one grouped request)

- Revenue: MRR now, MRR last month, new MRR, expansion MRR, contraction MRR, churned MRR
- Customers: active at start, new, churned
- Costs: sales and marketing spend (same period as new customers), gross margin %
- Context: segment (enterprise / mid-market / SMB / consumer), ARR stage, billing (monthly/annual), app-store fees if mobile

## Step 2: Formulas

| Metric | Formula | Notes |
|---|---|---|
| ARR | MRR × 12 | Run rate, not recognised revenue |
| MoM growth | (MRR_now − MRR_last) ÷ MRR_last | |
| Logo churn (monthly) | Customers lost ÷ customers at start | Annual ≈ 1 − (1 − m)^12 (5%/mo ≈ 46%/yr) |
| Revenue churn (gross) | (Churned + contraction MRR) ÷ MRR at start | |
| ARPA | MRR ÷ active customers | |
| CAC | S&M spend ÷ new customers | Use blended and paid-only if possible |
| LTV | ARPA × gross margin ÷ monthly revenue churn | Cap lifetime (e.g. 3–5 years) when churn is tiny |
| LTV:CAC | LTV ÷ CAC | |
| CAC payback (months) | CAC ÷ (ARPA × gross margin) | |
| NRR | (Start MRR + expansion − contraction − churn) ÷ start MRR | Same cohort only |
| GRR | (Start MRR − contraction − churn) ÷ start MRR | ≤ 100% by definition |
| Quick ratio | (New + expansion MRR) ÷ (churned + contraction MRR) | |
| Rule of 40 | YoY revenue growth % + profit (or FCF) margin % | Meaningful at scale, not for pre-revenue |
| Burn multiple | Net burn ÷ net new ARR | For funded companies |

Mobile apps: use net revenue after store fees in ARPA, and separate trial
starts, trial conversion and renewal rates.

## Step 3: Read against indicative ranges

For each metric: value · indicative range for this segment/stage · status
(HEALTHY / WATCH / CRITICAL) · confidence (data quality).

## Step 4: Prioritise

Top 1–3 metrics at WATCH or CRITICAL, most damaging first. Common orders of
operations:
- High churn → fix retention before buying more growth (spend leaks out).
- LTV:CAC < ~1 → stop scaling paid acquisition; fix pricing, conversion or churn.
- Long payback with little cash → shorten (annual prepay, cheaper channels,
  higher entry price).

## Output format

```
# SaaS health report — <month year>

## Metrics at a glance
| Metric | Value | Indicative range (<segment>, <stage>) | Status |

## Overall picture
<2–3 plain sentences>

## Priority issues
### 1. <metric>
What's happening: …
Why it matters: …
Fix this month: 1) … 2) … 3) …

## What's working
<1–2 real strengths>

## 90-day focus
<one metric, current → target>

## Missing data and assumptions
- …
```

<!-- Adapted from alirezarezvani/claude-skills finance/skills/saas-metrics-coach (MIT). Formulas inlined; Rule of 40 corrected to YoY growth; benchmarks relabelled as indicative; works without the bundled scripts. -->
