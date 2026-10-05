---
name: pricing-strategy
description: Use when designing pricing from scratch, auditing existing pricing or packaging, planning a price increase, designing a pricing page, setting discount rules, or researching willingness to pay. Forces value metric → packaging → price point, in that order.
---

# Pricing Strategy

Pricing is positioning: the price sits between what the next-best alternative
costs and the value the customer believes they get. Read
`.claude/product-marketing-context.md` first if it exists.

## Hard rules

- **Order matters:** value metric first, then packaging, then the number.
- **Rules of thumb are labelled as rules of thumb.** Never present an industry
  benchmark as fact without a source; prefer the user's own data.
- **Model before deciding:** any price change gets a revenue scenario table
  (below) computed with `python3`, not mental arithmetic.
- **No deceptive pricing:** no hidden fees, drip pricing, pre-ticked add-ons,
  fake "was" prices, or auto-renewals without clear disclosure and easy
  cancellation (consumer-protection and app-store rules).

## Gather first

- Current plans, prices, billing model; free/trial setup.
- Conversion (visit → trial/free → paid), ARPA, churn, expansion — whatever is known.
- B2B or B2C; self-serve or sales-led; segments (best customers vs casual).
- Alternatives customers compare against and what those cost (including
  "do nothing" or a spreadsheet).
- Cost to serve one customer; constraints (contracts, grandfathering, app-store fees).
- Goal: design, optimise, or raise.

## 1. Value metric

| Metric | Fits | Watch out |
|---|---|---|
| Per seat | Collaboration, tools where value grows with people | One power user does all the work → seats don't track value |
| Usage | APIs, infrastructure, AI | Spiky usage → unpredictable bills → churn |
| Feature/add-on | Platforms with distinct modules | Complexity |
| Flat | Simple SMB/consumer tools | Heavy users subsidised |
| Outcome | Measurable results (commission) | Attribution disputes |
| Hybrid | Mature products | Explainability |

Test: does it rise as the customer gets more value? Is it easy to understand
and predict? Hard to game?

## 2. Packaging (good–better–best)

- **Entry:** for the price-sensitive segment; limited by usage, features or
  support; covers its cost. Free is a separate strategy (freemium), not a tier.
- **Middle (default):** what most customers should buy — mark it "most popular".
- **Top:** enterprise needs: SSO/SAML, SCIM, audit logs, SLA, custom terms,
  dedicated support; may be "Contact us".
- Gate on what scales with value (limits, admin/security, advanced
  reporting), not on basic usability. If almost everyone sits in one tier,
  there's no upgrade path.

## 3. Price point

1. Define the next-best alternative and what it costs the customer.
2. Estimate value delivered: time saved × cost of that time, revenue gained or
   protected, risk avoided. Ask best customers what they'd lose if you vanished.
3. Price between the two. A common rule of thumb is capturing a modest share
   (often cited as 10–20%) of documented value — treat as an assumption.
4. Research:
   - **Van Westendorp** (4 questions: too cheap / bargain / getting expensive /
     too expensive). Plot cumulative curves; the acceptable range lies between
     the "too cheap" and "too expensive" crossings. Needs a reasonable sample of
     real target buyers (30+ is a common floor).
   - **MaxDiff** for which features belong in which tier.
   - **Competitor benchmark:** plans, prices, value metric, what's included.
     Their price reflects their costs and positioning, not yours.
   - **Live tests** on new visitors only, where legal and fair.

## 4. Price increases

| Approach | Use when |
|---|---|
| New customers only | Strong pushback risk |
| Grandfather with a later date | Loyal base, contract risk |
| Tied to new value | Meaningful new capability shipped |
| Restructure plans | Packaging is the real problem |
| Uniform increase | Clearly below market and confident in value |

Checklist: model revenue at several retention outcomes (e.g. 100/90/80/70%) ·
segment by risk · give generous notice (contract terms and local law may set a
minimum; 30–90 days is common) · explain the specific reason · offer a path
(lock current price for annual) · brief support with FAQ and approved offers ·
watch churn, downgrades and tickets for 60 days. Fix churn before raising
prices — increases accelerate it.

## 5. Pricing page

- Above the fold: plan names, prices, monthly/annual toggle with savings shown
  honestly, 3–5 differentiators per plan, CTA per plan, recommended plan highlighted.
- Below: full comparison table; FAQ (cancel anytime? limits? refunds? data
  security? switching plans?); relevant proof; security/compliance badges for B2B.
- Never hide the monthly price or the renewal price.

## 6. Discount governance (sales-led)

| Discount | Approver | Typical justification |
|---|---|---|
| Small (e.g. ≤10%) | Rep | Annual or multi-year commitment |
| Moderate (e.g. 10–20%) | Sales manager | Competitive displacement, strategic logo |
| Large (e.g. 20–30%) | Sales leader | Documented competitive threat, large deal |
| Above that | CEO/CFO | Exceptional, time-boxed |

Every discount: documented reason, expiry date, and a give-get (commitment,
case study, prepayment). Prefer alternatives to price cuts: payment terms,
onboarding credits, extra seats for a term, volume commitments. Track discount
frequency and depth — routine discounting trains buyers to wait.

## Revenue scenario table

```
| Scenario | Price | Customers kept | MRR | Δ vs today |
```

## Output format

```
## Recommendation
<value metric, tiers, prices — one paragraph with reasoning>

## Tiers
| | Entry | Better (recommended) | Best |
| Price | | | |
| Limits | | | |
| Key features | | | |

## Evidence and assumptions
- Evidence: …
- Assumptions (to validate): …

## Scenario model
<table>

## Rollout and tests
1. …
```

<!-- Adapted from alirezarezvani/claude-skills marketing-skill/skills/pricing-strategy (MIT) and msitarzewski/agency-agents specialized/specialized-pricing-analyst.md (MIT). Benchmarks relabelled as assumptions. -->
