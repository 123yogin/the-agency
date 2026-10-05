---
name: copywriting
description: Use when writing or rewriting marketing copy for a homepage, landing page, pricing page, feature page or about page — headlines, subheads, CTAs, section copy. Delivers annotated copy with alternatives and refuses to fabricate proof.
---

# Copywriting

Clear, specific copy that makes the reader's next step obvious. Read
`.claude/product-marketing-context.md` first if it exists; only ask for what it
doesn't cover.

## Hard rules

- **Never fabricate** statistics, testimonials, logos, ratings or results. Where
  proof would go and none is supplied, write `[PROOF NEEDED: e.g. customer quote
  about <X>]`.
- **Clarity over cleverness.** If a line has to be explained, rewrite it.
- **Customer language over company language.** Mirror words from reviews,
  tickets and interviews.
- **One page, one primary action.**
- Always give alternatives for the headline and the primary CTA.

## Gather first

1. Page type and the ONE action the visitor should take.
2. Who arrives, from where (ad, search, email, referral), and what they already know.
3. The problem in their words, their objections, the alternatives they consider.
4. What's genuinely different, and the outcome it produces.
5. Proof available (real numbers, quotes with permission, logos allowed).

## Principles

- **Benefits over features:** feature → "which means" → outcome.
- **Specific over vague:** "Cut weekly reporting from 4 hours to 15 minutes"
  beats "save time" — but only if true.
- **Simple words:** use not utilise, help not facilitate. Active voice. No
  exclamation marks. Cut "very", "really", "almost".
- **Lead with them, not you.** Copy that opens with "We…" or the company name
  gets reframed around the reader's problem or outcome.
- **One idea per section;** each section advances the argument.

## Headline formulas

| Angle | Formula | Example |
|---|---|---|
| Outcome | {Outcome} without {pain} | Build your website without writing code |
| Outcome | Turn {input} into {outcome} | Turn one-off buyers into repeat customers |
| Problem | Never {bad event} again | Never miss a renewal again |
| Problem | Stop {pain}. Start {gain}. | Stop chasing invoices. Start getting paid on time. |
| Audience | {Category} for {audience} | Analytics for Shopify stores |
| Audience | You don't have to {skill} to {outcome} | You don't have to be an SEO expert to rank |
| Difference | The {category} that {differentiator} | The CRM that updates itself |
| Question | {Pain as a question} | Hate returning stuff? |
| Proof (only if true) | {Number} {people} use {product} to {outcome} | — |

Write 5–10 candidates across angles; present the best 2–3 with one-line
rationales. Self-score each 1–5 on: specific, clear in five seconds, in
customer language, believable. Don't lead with anything under 4 on clarity.

## Page structure

**Above the fold:** headline (core promise) · subhead (1–2 sentences of
specifics) · primary CTA · visual of the real product · optional proof bar.

**Narrative page (stronger than a feature list):**
1. Hero
2. Proof bar (logos/rating — only if real)
3. Problem: describe their situation better than they would
4. How it works (3–4 steps, each an action + outcome)
5. Key benefits (3, not 10) — headline + how + proof
6. Testimonial (specific, attributed)
7. Use cases / who it's for (and who it's not for)
8. Comparison with alternatives, including the status quo
9. FAQ answering real objections
10. Final CTA with risk reversal (trial terms, cancel anytime, guarantee — only what's true)

**Compact ad landing page:** hero · proof · 3 benefits · testimonial · how it
works · final CTA. Match the headline to the ad's promise.

**Page-specific:**
- Homepage: broadest value prop, clear paths for each visitor intent.
- Pricing: help them choose; make the recommended plan obvious; answer "which is right for me?".
- Feature: feature → benefit → use case → try it.
- About: why you exist, tied to what it means for the customer; still has a CTA.

## CTAs

Formula: action verb + what they get (+ qualifier). "Start my free trial",
"Create your first board", "See pricing for my team". Avoid Submit, Sign up,
Learn more, Click here, Get started on their own.

## Output format

```
## Copy
### Hero
Headline: …
Subhead: …
CTA: …

### <Section>
…

## Alternatives
- Headline B: … — <rationale>
- Headline C: … — <rationale>
- CTA B: … — <rationale>

## Notes
- <why key choices were made>
- Proof placeholders to fill: …

## Meta (if a web page)
Title (≤60): …   Description (≤160): …
```

After drafting, run the `avoid-ai-writing` skill over body copy if it reads generic.

<!-- Adapted from alirezarezvani/claude-skills marketing-skill/skills/copywriting and references/copy-frameworks.md (MIT). Script dependency replaced with a self-score. -->
