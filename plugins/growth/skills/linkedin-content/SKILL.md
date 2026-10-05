---
name: linkedin-content
description: Use when drafting, editing or repurposing a LinkedIn post, carousel, poll, article or substantive comment. Interviews for the specific detail first, writes to the ~140-character mobile fold, and blocks fabricated numbers, engagement bait and Unicode pseudo-bold.
---

# LinkedIn Content

The post isn't the deliverable; the specific thing only this person can say
is. That detail — the number, the mistake, the sentence someone said, what it
cost — comes from the user and cannot be generated. Read
`.claude/product-marketing-context.md` (for company posts) first if it exists.

## Hard rules (blocking)

- **Never fabricate** a number, client, result or quote — not even as a placeholder
  that might ship. Use `[ASK: …]` and stop until the user fills it.
- **A sentence completes before character ~140** (mobile fold; desktop ~210).
- **Hard cap 3,000 characters** for a post (1,250 for a comment).
- **No Unicode pseudo-bold/italic** ("𝗯𝗼𝗹𝗱" generators): screen readers read it
  as maths symbols and search doesn't index it.
- **No engagement bait** ("Comment YES", "Agree?", tag-a-friend, "like if…").
  LinkedIn's Professional Community Policies name it as demoted content.
- **Links go in the first comment**, and the post says so.
- **Alt text on every image; captions on every video.**
- The author reads every line before it ships; they are the author of record.

## Workflow

1. **Interview before writing.** Ask for: what happened, the number, the
   mistake or surprise, what someone said, what it cost, what they'd do
   differently. One or two questions at a time.
2. **Pick the format from the material:**
   | Format | Good for | Constraint |
   |---|---|---|
   | Text | Stories, opinions, one idea | One idea per post |
   | Document (PDF carousel) | Steps, comparisons, structured data | Each slide stands alone; payload early; real PDF with selectable text |
   | Native video | Demonstration, personality | Captions; point in first 5 seconds |
   | Image + text | One chart, artifact or announcement | Alt text |
   | Poll | A real decision you'll report back on | No follow-up planned → don't run it |
   | Article | Durable reference | Lower reach; mine it for posts |
   | Substantive comment | Visibility from a standing start | Must add what the original missed |
   | Repost with take | Entering a conversation | Take longer than "this" |
3. **Write the hook** (one of the shapes below), then the body in blocks of 2–4
   lines. Avoid wall-of-one-liners "broetry" (six or more consecutive single-line paragraphs).
4. **End with a question the post earned** — specific, aimed at people who
   did the same work.
5. **Lint** with the checklist and report results.

## Hook shapes

| Shape | Example opening |
|---|---|
| Number + reversal | "Our onboarding took 6 weeks. We got it to 4 days without hiring anyone." |
| The mistake | "I spent five weeks automating the wrong step." |
| The measurement | "Work time was 6 days. Waiting between owners was 35." |
| The quote | "'Nobody believes the dashboard.' That was the actual problem." |
| The refusal | "We deleted the kickoff call. Most accounts never needed it." |

Delete on sight: "I'm excited/thrilled/humbled to announce", "In today's
fast-paced world", "Quick thought:", any first eight words that would fit any post.

## Post shapes

**Measurement that changed our mind:** the number nobody believed → the
instinct everyone had → what we measured → what we changed (with
consequences) → the part I got wrong → question.

**Decision with the cost:** we stopped doing X + consequence → strongest
argument for keeping it → why it lost → what it cost us → where does this break for you?

**Teardown:** one artifact (with permission or anonymised) → what it gets
right → three changes, each with the mechanism → the one I'm least sure about → question.

**Field note (500–900 chars):** what I did this week → what surprised me →
what I'll do differently → optional question.

**Transition:** the thing I did in the new field → what transferred → what I
learned from zero → direction → question.

## Repurposing

Split long sources (talks, articles, threads) into standalone units; each unit
needs the line only the author can add. Keep a reuse ledger (date, idea,
link) in the repo so the same idea doesn't ship three times.

## Lint checklist

```
- [ ] sentence completes before char 140      - [ ] ≤3,000 chars (count: ___)
- [ ] no fabricated or placeholder facts       - [ ] no pseudo-bold/italic
- [ ] no engagement bait                       - [ ] links in first comment
- [ ] alt text / captions                      - [ ] not ≥6 one-line paragraphs in a row
- [ ] ends with an earned question             - [ ] ran avoid-ai-writing if it reads generic
```

## Output format

```
## Draft (<n> chars)
<post>

## First comment
<link + one line>

## Lint
<checklist with ticks>

## Alternatives
Hook B: …   Hook C: …
```

<!-- Adapted from alirezarezvani/claude-skills marketing/linkedin/skills/linkedin-content and its references/assets (MIT). Works without the bundled scripts. -->
