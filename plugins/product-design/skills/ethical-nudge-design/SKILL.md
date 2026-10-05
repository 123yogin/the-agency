---
name: ethical-nudge-design
description: Use when designing features meant to change user behaviour — onboarding, habit and streak mechanics, reminders and notifications, defaults, pricing and upgrade prompts, cancellation flows. Enforces a COM-B diagnosis before any intervention, a dark-pattern gate every design must pass, and measurement with guardrails for backfire.
---

# Ethical Nudge Design

A nudge is ethical when it helps people do what they already want to do, and
they would endorse it if they saw exactly how it works. Everything else is
manipulation, and it tends to show up later as churn, complaints, refunds and
regulatory risk.

## Hard rules

- **Diagnose before designing.** Name the target behaviour and the barrier
  (COM-B below) before proposing any intervention. Reminders do not fix a
  capability problem; tutorials do not fix a motivation problem.
- **The user's goal, not the metric's.** The behaviour must serve a goal the
  user has stated or would plainly endorse.
- **Every design passes the dark-pattern gate.** A single "fail" sends it back.
- **Reversible and easy to refuse.** Opting out takes no more effort than opting in.
- **Measure guardrails, not only the target metric.** A lift in the target that
  comes with more opt-outs, complaints or later churn is a loss.

## Step 1 — Define the behaviour

Who does what, when, where, how often. "New users log their first entry within
24 hours of sign-up" is a behaviour; "engagement" is not.

## Step 2 — Diagnose with COM-B (Michie et al., 2011)

Behaviour happens when people have the **capability**, the **opportunity** and the
**motivation** to do it.

| Component | Ask | Typical intervention |
|---|---|---|
| Capability — psychological | Do they know how? Do they remember? | Clear instructions, worked example, progressive disclosure |
| Capability — physical | Can they physically do it here (device, accessibility)? | Fewer steps, larger targets, offline support |
| Opportunity — physical | Is it available at the right time and place? | Right trigger at the right moment, sensible defaults |
| Opportunity — social | Do norms or the people around them support it? | Show what similar users do (only if true), invite one chosen person |
| Motivation — reflective | Do they believe it is worth it? Do they plan to? | Explain the payoff, let them set their own goal |
| Motivation — automatic | Is there habit, emotion or impulse pulling either way? | Make it easy and satisfying; tie to an existing routine |

Evidence for the diagnosis comes from research and analytics (where users drop
off, what they say), not from assumption. Label assumptions.

## Step 3 — Design with Fogg (B = M × A × P)

Behaviour happens when motivation, ability and a prompt converge at the same
moment. If motivation is high and ability low, simplify (remove steps). If
ability is high and motivation low, add value or show the payoff. If both are
present, the missing piece is usually a well-timed prompt.

Choice-architecture tools (Thaler and Sunstein): defaults, salience, timing,
feedback, friction (adding it to protect people from mistakes, removing it from
what they want to do), commitment devices chosen by the user.

## Step 4 — Dark-pattern gate

Every proposed design is checked against each item. One fail sends it back.

| Pattern | Fails if… |
|---|---|
| Confirmshaming | The decline option guilt-trips ("No thanks, I don't care about my health") |
| Obstruction / hard to cancel | Leaving, cancelling or deleting takes more steps or channels than joining |
| Forced continuity | A free trial converts to paid without a clear advance reminder and an easy cancel |
| Hidden costs / drip pricing | Fees or conditions appear late in the flow |
| Pre-selection | Paid add-ons, data sharing or marketing consent are ticked by default |
| False urgency or scarcity | Timers, "only 2 left" or "offer ends" that are not true |
| Fake social proof | Invented counts, testimonials or "people are viewing" |
| Nagging | Repeated prompts after a clear "no", with no "don't ask again" |
| Trick wording | Double negatives or a visually dominant option that does the opposite of what it seems |
| Disguised ads or upsells | Promotions styled as content or system messages |
| Privacy by confusion | Settings that make the data-sharing choice hard to find or understand |
| Punishing loss aversion | Mechanics that make a single miss feel catastrophic (e.g. a streak that resets to zero with no recovery) when the user's goal is long-term consistency |

Then three questions:
1. **Publicity test:** would we be comfortable showing users exactly how and why
   this works?
2. **Endorsement test:** would the user, fully informed, choose this design?
3. **Reversibility test:** can they undo it or opt out as easily as they got in?

Regulators increasingly treat many of these patterns as unlawful (for example,
consumer-protection guidance on dark patterns and the EU Digital Services Act's
rules on deceptive interfaces). Check the rules for your market; this skill is
not legal advice.

## Step 5 — Notifications and reminders

- The user chooses whether, when and how often. Defaults are conservative.
- Each notification carries information the user wants, not a reason to open the app.
- Cap frequency; back off automatically when they are ignored.
- One tap to adjust or turn off, from the notification itself where the
  platform allows.

## Step 6 — Measure

```markdown
Target behaviour metric: {e.g. % of new users logging within 24h}
Guardrails: {opt-out / unsubscribe rate, notification disable rate, complaints,
            refunds, cancellation rate, 30/90-day retention, support contacts}
Design: A/B with holdout (see experiment-designer); run long enough to see habituation
Backfire checks: reactance (people doing less), decline in long-term retention,
                 rise in "regret" signals (fast cancellations, refunds)
Decision rule: ship only if target improves AND no guardrail worsens beyond {threshold}
```

## Output

```markdown
# Nudge design: {behaviour}

Behaviour: {who, what, when}
Diagnosis (COM-B): {component(s) blocking, with evidence}
Intervention: {design}, targeting {component}
Dark-pattern gate: PASS — {notes on any item that came close}
Publicity / endorsement / reversibility: {pass, with one line each}
Measurement plan: {target metric, guardrails, decision rule}
```

<!-- Written for the-agency, summarising COM-B (Michie, van Stralen & West, 2011), the Fogg Behavior Model, and Thaler & Sunstein's choice architecture. -->
