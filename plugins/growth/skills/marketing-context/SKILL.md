---
name: marketing-context
description: Use when starting any marketing, positioning, copy, SEO, launch or sales task and `.claude/product-marketing-context.md` is missing or stale, or when the user mentions ICP, positioning, brand voice or target audience. Creates and maintains the one context file every growth skill reads first.
---

# Marketing Context

Every growth skill and agent in this plugin reads `.claude/product-marketing-context.md`
before it asks the user anything. This skill creates and maintains that file so
the user never has to explain the product twice.

## Hard rules

- One file, one path: `.claude/product-marketing-context.md`. If an older file
  exists elsewhere (`marketing-context.md`, `.agents/…`), move it here.
- Verbatim beats polish. Customer language goes in as quoted, never paraphrased.
- Never invent proof points, metrics, customers or testimonials. An empty
  section is better than a fabricated one; mark it `TBD — needs <source>`.
- Confirm each section with the user before moving on.

## Modes

1. **Auto-draft (default).** Read the README, landing pages, existing copy,
   `package.json`, docs, pricing pages. Draft every section you can support with
   evidence, cite where each fact came from, then ask: "What needs correcting?
   What's missing?"
2. **Interview.** One section at a time, one or two questions per turn. Ask for
   examples ("Can you give me one?") rather than abstractions.
3. **Update.** Read the file, summarise it in five lines, ask which sections
   changed. Flag any section older than 6 months.

## Sections

Write the file with exactly these headings. Skip a section only if it truly
does not apply, and say so.

```markdown
# Product marketing context
_Last updated: YYYY-MM-DD_

## 1. Product
One line. What it does (2–3 sentences). Category (the shelf buyers search on).
Type (SaaS / app / marketplace / service). Business model and pricing.

## 2. Audience
Company type or consumer segment. Decision-makers and users. Primary use case.
Jobs to be done (2–3).

## 3. Personas
| Role (user/champion/buyer/influencer) | Cares about | Challenge | Value we promise |

## 4. Problems
Core problem before us. Why current options fall short. Cost of the problem
(time/money/risk). Emotional tension.

## 5. Competition
Direct (same solution). Secondary (different solution, same problem).
Indirect (do nothing / spreadsheet / habit). How each falls short.

## 6. Differentiation
What we do that alternatives can't. Why that matters to the buyer (benefit, not feature).

## 7. Objections and anti-personas
Top 3 objections + answers. Who is NOT a fit.

## 8. Switching forces (JTBD)
Push (away from current). Pull (toward us). Habit (keeps them stuck). Anxiety (about switching).

## 9. Customer language (verbatim)
Problem in their words. Solution in their words. Words to use. Words to avoid. Glossary.

## 10. Voice
3–5 adjectives. Tone. Do / Don't list with one example each.

## 11. Style
Capitalisation, product-name spelling, formatting, terminology.

## 12. Proof
Metrics we can cite (with source). Customers/logos we may name. Testimonials (verbatim, with permission status).

## 13. Content and SEO
Keyword clusters. Key pages and anchor text. 3–5 exemplary pieces.

## 14. Goals
Primary business goal. Key conversion action. Current numbers (if known, with date).
```

## Completeness check (no script needed)

Before calling it done, score it yourself and report the score:

- Required (10 points each): sections 1, 2, 4, 5, 6, 9, 10, 14.
- Optional (4 points each): 3, 7, 8, 11, 12, 13 → max 100 with rounding.

Below 70: list the missing sections and offer to interview for them. Other
skills degrade silently on a thin file, so say that plainly.

## Raise without being asked

- No verbatim customer quotes → "Copy will sound generic without them. Can you
  paste 3–5 from reviews, support tickets or interviews?"
- No competitors → "Who are the top 3 alternatives your buyers consider,
  including doing nothing?"
- No proof → "Marketing without proof is opinion. What can we honestly cite?"
- File older than 6 months → recommend a review.

<!-- Adapted from alirezarezvani/claude-skills marketing-skill/skills/marketing-context (MIT). -->
