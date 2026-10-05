---
name: paid-ads
description: Use when planning, launching, auditing or scaling paid acquisition — Google Search/Performance Max, Meta, LinkedIn, X, TikTok, Reddit, Apple Search Ads, Google App campaigns — including structure, targeting, creative, bidding, budgets, retargeting and measurement. Refuses to launch without working conversion tracking and a target CPA or ROAS.
---

# Paid Ads

Buy customers at a cost the business can afford, and know that you did. Read
`.claude/product-marketing-context.md` first if it exists.

## Hard rules

- **No launch without verified conversion tracking** (a real test conversion
  recorded end to end) and **a target CPA or ROAS** derived from unit economics
  (LTV, margin, payback — see `saas-metrics`).
- **Platform-reported results are inflated by design;** judge on blended CAC
  and your own analytics (UTMs, server-side events, holdouts where possible).
- **Ad policies and law apply:** no unsubstantiated claims, fake testimonials,
  or misleading "before/after"; special-category rules for health, finance,
  housing, employment and credit ads; respect consent requirements for
  tracking pixels in the EU/UK.
- **One change at a time** during optimisation; let learning phases finish.

## Gather first

Objective (leads, trials, purchases, installs) · target CPA/ROAS and what a
conversion is worth · budget · geography · offer and landing page · audience
and what they search for · existing pixel/conversion data · customer lists for
lookalikes (with lawful basis to upload) · past results.

## Platform choice

| Platform | Strongest when |
|---|---|
| Google Search | People already search for the solution or problem |
| Performance Max / Demand Gen | You have conversion volume and good creative assets |
| Meta (FB/IG) | Creating demand with visual or video creative; B2C; broad audiences |
| LinkedIn | B2B where job title / company targeting matters and deal value is high |
| X | Tech and news-driven audiences active there |
| TikTok | Video-native creative, younger skew, consumer apps |
| Reddit | Niche communities with clear interests; ads must fit the subreddit's culture |
| Apple Search Ads / Google App campaigns | Mobile app installs from store search |

Start with one or two platforms; concentration beats a thin spread.

## Structure

```
Campaign: <objective> – <audience or product>
  Ad set / ad group: <one targeting idea>
    Ads: 3–5 creatives testing distinct angles
```
Naming: `<PLATFORM>_<Objective>_<Audience>_<Offer>_<YYYYMM>`.
Exclude existing customers and recent converters. Avoid overlapping audiences
competing in the same auction.

## Budget

- Test phase: most budget on what's proven, a fixed slice on new
  audiences/creative.
- Scale gradually (e.g. +20–30% at a time, waiting a few days between changes)
  so delivery algorithms don't reset.
- Move to automated bidding once a campaign has meaningful conversion volume
  (platforms recommend roughly 30–50 conversions per period — check current docs).

## Creative

- Test **concept/angle first** (biggest effect), then hook, visual, body, CTA.
- Static: real product UI, one clear message, legible on a phone.
- Video (15–30s): hook in the first seconds → problem → product doing the job →
  CTA. Captions always; vertical for Stories/Reels/TikTok; native-feeling beats glossy.
- Copy frameworks: Problem–Agitate–Solve; Before–After–Bridge; proof-led (only real proof).
- Ad promise must match the landing page headline (`page-cro`).
- Refresh when frequency climbs and CTR falls (fatigue).

## Search specifics

- Separate brand and non-brand campaigns.
- Match the ad to the query intent; use negative keywords from the search-terms report weekly.
- Landing pages per theme, not one homepage for everything.

## Retargeting

| Stage | Audience | Message | Window |
|---|---|---|---|
| Cold | Any visit, video viewers | Education, proof | 30–90 days |
| Warm | Pricing/feature page visitors | Case study, demo, comparison | 7–30 days |
| Hot | Started signup/checkout, trial users | Objection handling, help | 1–7 days |
Cap frequency; exclude converters and bounces.

## Diagnose

- **CPA high:** check the landing page first (problem is often post-click) →
  audience → creative angle → relevance/quality → bid strategy.
- **CTR low:** creative isn't landing, wrong audience, or fatigue.
- **CPM high:** audience too narrow, competitive auction, weak relevance.

## Measurement

- UTMs on every link (`analytics-tracking`); compare platform vs analytics vs backend.
- Watch blended CAC and payback, not just platform CPA.
- For larger budgets, run geo or audience holdouts to estimate incrementality.

## Pre-launch checklist

- [ ] Test conversion recorded in platform *and* analytics
- [ ] Target CPA/ROAS written down with its derivation
- [ ] Landing page fast and mobile-friendly; message matches the ad
- [ ] UTMs working; naming convention applied
- [ ] Exclusions set; budgets and dates correct
- [ ] Ad copy reviewed for policy and substantiated claims

## Output format

```
## Plan
Objective · target CPA/ROAS (derivation) · budget · platforms and why

## Structure
| Campaign | Ad set / targeting | Creatives | Budget |

## Creative briefs
| Angle | Hook | Visual | Copy | CTA |

## Measurement
Tracking checks, UTMs, review cadence, decision rules (pause / scale thresholds)
```

<!-- Adapted from alirezarezvani/claude-skills marketing-skill/skills/paid-ads (MIT). Outdated rules (20% text overlay) and unsourced stats removed; app-install channels added. -->
