---
name: growth-loops
description: Use when designing compounding acquisition — viral/invite loops, user-generated content and SEO loops, referral programmes, network effects, paid loops funded by LTV — or asking "how do we grow without just buying traffic?". Maps the loop with a metric at every step and finds the constraint.
---

# Growth Loops

Funnels stop when you stop paying. Loops turn the output of one user's usage
into the input that brings the next user. Read
`.claude/product-marketing-context.md` first if it exists.

## Hard rules

- **Every step in a loop has a metric** — measured, or explicitly marked unknown.
- **Invest at the constraint** (the weakest step), not wherever is most fun.
- **No dark-pattern virality:** no contact-list scraping or sending invites on
  a user's behalf without explicit, informed action; no fake scarcity; referral
  rewards disclosed. Spammy invite flows also break email and platform rules.
- **Fit the product.** Not every product has a viral loop; if sharing doesn't
  serve the user, don't force it — say so and pick another loop.

## Loop types

| Loop | Mechanism | Fits when |
|---|---|---|
| Invite / collaboration | Value rises when others join (shared docs, teams) | Product is better with others |
| Artifact / creation | Users create things others see (public pages, exported reports, "made with" badges) | Outputs are naturally shared |
| Content / SEO | Usage or programmatic pages rank and bring searchers | Many long-tail queries map to your data or templates |
| Referral | Explicit reward for bringing someone | Clear value to both sides; healthy margins |
| Network effects | More users → more value (direct, two-sided, data) | Marketplaces, communication, data products |
| Paid | Revenue from one cohort funds the next | Payback short enough for your cash |
| Sales-led | Revenue funds sales capacity | Deal sizes support the cost of selling |

## Design process

1. **Find the output.** What does usage produce that someone else could see or
   receive? (A shared link, an invite, a public page, an email sent via the
   product, a printed or exported artifact.)
2. **Map the loop:**
   ```
   New user → activation → creates/shares output → exposure to non-user
   → visit → signup → activation → …
   ```
   Put a metric on every arrow: % of users who share, outputs per user,
   views per output, visit→signup rate, signup→activation rate, cycle time.
3. **Compute the loop:** viral coefficient K = (outputs or invites per user) ×
   (conversion per output). K > 1 grows on its own; most products have K < 1, which
   still multiplies paid and organic acquisition by 1 ÷ (1 − K). Shorter cycle
   time compounds faster.
4. **Find the constraint:** low share rate → make sharing serve the user (a
   reason to share); low conversion → improve the shared page and the first-run
   experience for visitors; low activation → onboarding (`page-cro`).
5. **Pick 2–3 experiments** at the constraint (`experimentation`).

## Referral programme checklist

- Reward both sides with something tied to the product (credit, extended plan).
- Ask after a success moment, not at signup.
- Make the share effortless: one link, pre-written (editable) message.
- Track: share rate, invite→signup, referred-user retention vs others.
- Fraud controls: self-referral checks, caps, delayed rewards.
- Disclose terms clearly; follow app-store rules on incentivised actions.

## Output format

```
## Loop(s) identified
<type, and why it fits this product>

## Loop map
<step → metric (current / unknown)>

## Loop math
K = … × … = …   Cycle time: …   Amplification on other channels: 1/(1−K) = …

## Constraint
<weakest step and evidence>

## Experiments
| Hypothesis | Change | Metric | Guardrail |
```

<!-- Adapted from VoltAgent/awesome-claude-code-subagents categories/08-business-product/growth-loops.md (MIT). Loop maths, referral checklist and ethics rules added. -->
