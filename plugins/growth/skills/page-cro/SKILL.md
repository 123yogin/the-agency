---
name: page-cro
description: Use when a marketing page, signup flow, onboarding/activation flow or paywall/upgrade screen isn't converting and the user wants a diagnosis and fixes. Works through value prop → headline → CTA → hierarchy → trust → objections → friction in impact order, then outputs quick wins, high-impact changes and test ideas.
---

# Conversion Optimisation (pages, signup, onboarding, paywalls)

Read `.claude/product-marketing-context.md` first if it exists. Look at the real
thing — fetch the page, open the app, or read the component code — before
diagnosing. If you can't see it, say what you'd need.

## Hard rules

- **Evidence over taste.** Each finding cites what you saw (a line of copy, a
  field, a screenshot region, a funnel number).
- **Don't present opinions as certainties.** Things that could go either way are
  test ideas, not fixes.
- **No dark patterns:** no hidden close buttons, pre-ticked consent, confirm-
  shaming copy, fake urgency/scarcity, or roach-motel cancellation. They are
  also legal risks (FTC, EU consumer and DSA rules).
- If funnel numbers exist, start where the biggest drop-off is.

## Gather first

1. Page/flow type and the ONE conversion that matters.
2. Traffic source and what visitors already know (ad promise, search query, email).
3. Current numbers if known: conversion rate, step-by-step counts, device split.
4. Research available: heatmaps, recordings, surveys, support tickets.
5. What's been tried.

## 1. Marketing pages — analyse in this order

1. **Value proposition (biggest lever).** Five-second test: can a cold visitor
   say what this is, who it's for and why it's better? Look for feature-speak,
   cleverness over clarity, trying to say everything.
2. **Headline.** Communicates the core promise, specific, matches the traffic
   source's message.
3. **CTA.** One clear primary action visible without scrolling; button copy says
   what they get ("Start my free trial", not "Submit"); clear primary vs
   secondary; repeated at decision points.
4. **Visual hierarchy.** A scanner gets the message from headings alone; most
   important element most prominent; images show the real product.
5. **Trust.** Logos, specific attributed testimonials, ratings, security/
   compliance where relevant — placed near CTAs and after claims. Only real ones.
6. **Objections.** Price, "will it work for me", effort to switch, "what if it
   doesn't work" — answered by FAQ, comparison, guarantee, transparency.
7. **Friction.** Form fields, confusing navigation, slow load, mobile layout,
   surprise requirements.

Page specifics — homepage: serve "ready" and "researching" visitors; landing
page: message match, single CTA, consider removing nav; pricing: recommended
plan obvious, "which plan?" answered; blog: contextual CTA at natural stops.

## 2. Signup flows

- **Every field must justify itself before first use.** Essential: email (or
  phone) and password, or social/passkey auth. Usually deferrable: company,
  role, team size, phone, address — collect later, or infer (company from email domain).
- **Value before commitment.** Can they try something before an account exists?
- Single step when ≤3 fields; multi-step with progress for more, easy questions first, progress saved.
- Field UX: one email field (no "confirm email"), typo suggestions
  (gmial.com), password rules shown up front with live feedback, paste
  allowed, show-password toggle, clear inline errors.
- Social auth prominent and audience-appropriate (B2C: Google/Apple; B2B:
  Google/Microsoft/SSO).
- Remove uncertainty: what happens next, "no credit card required" only if true.
- Post-submit: straight into the product where possible; verify email later
  unless security requires it.

## 3. Onboarding and activation

- **Define activation:** the earliest action that distinguishes retained users
  from churned ones (compare cohorts if data exists; otherwise state a hypothesis).
- **Time-to-value is the metric.** Remove every step between signup and that action.
- One goal for the first session. Do, don't show — interactive beats a tour.
- First screen: product-first (simple apps), guided setup (needs
  personalisation), or value-first with sample data. Always one clear next action, no dead ends.
- Checklists: 3–7 items, most valuable first, quick win first, visible progress, dismissible.
- Empty states explain the area, show what it looks like full, and offer the
  first action (optionally sample data).
- Tours: ≤5 steps, dismissible, never repeated for returning users.
- Email/push supports in-app progress (welcome, nudge if setup incomplete,
  celebrate activation, next step) — triggered by behaviour, not just the calendar.
- Measure activation rate, time to activation, and D1/D7/D30 retention by cohort.

## 4. Paywalls and upgrade screens

- **Value before the ask:** after the aha moment, at a natural limit or a
  paid-feature click — never during onboarding or mid-task.
- Components: headline about what they get · preview of the paid feature ·
  comparison with current plan marked · clear price (monthly/annual) · real
  proof · specific CTA · an obvious "Not now / continue free".
- Usage limits: show the limit and what upgrading provides; offer the free path
  (e.g. delete an item) too.
- Trial ending: warn ahead, say exactly what happens to their data, summarise value received.
- Frequency: cap per session; cool-down of days after a dismissal.
- Upgrade path: minimal steps, in context, immediate access afterwards.

## Output format

```
# CRO review: <page/flow>

## Biggest problem
<one paragraph: the single change most likely to matter, and why>

## Findings
| # | Area | Issue | Evidence | Fix | Priority (H/M/L) |

## Quick wins (hours)
- …

## High-impact changes (days–weeks)
- …

## Test ideas
| Hypothesis (If… then… because…) | Metric | Guardrail |

## Copy alternatives
- Headline A/B/C …   - CTA A/B/C …
```

Use the `experimentation` agent to size any test before running it.

<!-- Adapted from alirezarezvani/claude-skills marketing-skill/skills/page-cro, signup-flow-cro, onboarding-cro, paywall-upgrade-cro (MIT). Script dependencies removed. -->
