---
name: support-knowledge-base
description: Use when setting up or improving support operations — a ticket triage taxonomy with priorities and SLAs, tags and routing, turning repeated tickets into help-centre articles, writing or auditing help articles, and reporting top contact reasons back to product. Not for drafting a single reply (use customer-support).
---

# Support Knowledge Base and Triage

Every repeated question is either a product problem or a missing article.
This skill builds the system that turns tickets into fixes and self-serve answers.

## Hard rules

- **Write articles from real tickets,** in customers' words, not from the
  feature list.
- **Every article is verified against the current product** (click through the
  steps, check screenshots and labels) before publishing; record the date.
- **One article answers one question.**
- **Priority reflects impact, not volume of shouting.**
- **Route privacy, security and legal issues** to their owners immediately.

## 1. Triage taxonomy

**Categories (pick one primary):**
| Category | Examples | Routes to |
|---|---|---|
| How-to | "How do I…", setup, settings | Support / KB |
| Bug | Error, wrong result, crash | Engineering (with repro) |
| Account & access | Login, password, 2FA, email change | Support (verified identity) |
| Billing | Charges, refunds, invoices, plan changes | Support / finance |
| Cancellation | Cancel, pause, delete account | Support (never obstruct) |
| Feature request | "Can it…", "I wish…" | Product (logged, tagged) |
| Data & privacy | Export, deletion, access requests | Privacy owner (statutory clocks) |
| Security | Vulnerability report, suspicious access | Security owner, same day |
| Abuse / trust & safety | Spam, harassment, fraud | T&S owner |
| Feedback / praise | Compliments, general opinions | Product + marketing (with permission) |

**Priority:**
| Priority | Definition | First response target (set your own) |
|---|---|---|
| P1 | Many users blocked, data loss, security, payments failing | Within hours |
| P2 | One user blocked from core use; billing error | Same/next business day |
| P3 | Degraded but workaround exists; how-to | Within a few business days |
| P4 | Feature request, feedback | Acknowledge; no fix promised |

**Tags:** feature area (`area:billing`, `area:sync`), platform
(`platform:android`), version, customer segment, and `kb:missing` when no
article answered it.

## 2. Weekly loop

1. Export the week's tickets; count by category and feature area.
2. Top 5 contact reasons → for each: is it a bug (file it with repro and
   ticket count), a UX problem (send to product with quotes), or a missing/
   unclear article (write or fix it)?
3. Review `kb:missing` tags → new articles.
4. Report: top reasons, trend vs last week, what shipped to reduce them.

## 3. Help article template

```markdown
# <The question, as customers ask it>   (e.g. "How do I change the start date of a challenge?")

<One-sentence answer.>

## Steps
1. Open **<exact UI label>**.
2. Tap **<exact label>**.
3. …
<Screenshot with alt text, cropped to the relevant area.>

## If it doesn't work
- <Most common reason> → <fix>
- <Second reason> → <fix>

## Related
- <Linked article>

_Applies to: <web / iOS / Android, version>. Last verified: YYYY-MM-DD._
```

**Writing rules:** exact UI labels in bold; one action per step; platform
differences called out explicitly; no internal jargon; titles are questions or
tasks people search for; short paragraphs; no marketing.

## 4. Help-centre audit

| Article | Views | "Helpful" ratio | Tickets after viewing | Last verified | Action |
Fix first: high-view low-helpfulness articles, and articles older than the
last UI change in their area. Merge duplicates; redirect old URLs.

## 5. Macros

Turn the most common replies into macros (see `customer-support` macro format)
and link the relevant article in each.

## Output format

Deliver the requested artefact — taxonomy table, weekly report, article
drafts, or audit table — plus "product signals": the top issues that should be
fixed in the product, with ticket counts and representative quotes.

<!-- Original to the-agency. -->
