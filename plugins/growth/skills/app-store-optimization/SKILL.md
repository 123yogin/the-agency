---
name: app-store-optimization
description: Use when writing or improving an Apple App Store or Google Play listing — keyword research, title/subtitle/short description, iOS keyword field, full description, screenshots and icon, store A/B tests, ratings and review responses. Enforces platform character limits and store policy before anything is proposed.
---

# App Store Optimization

Goal: get found in store search, then convert the listing view into an
install. Read `.claude/product-marketing-context.md` first if it exists.

## Hard rules

- **Check every field against the limits below** and print the character count
  next to each proposal.
- **Store policy.** Google Play forbids, in the title, icon and developer name:
  performance or ranking claims ("#1", "best"), price or promo text ("free",
  "sale"), emoji and ALL CAPS used for emphasis, and calls to action. Apple
  rejects keyword-stuffed names and other apps' trademarks. Never use a
  competitor's brand as a keyword.
- **No invented numbers.** Search volume comes from a tool the user has (Apple
  Search Ads popularity, AppTweak, Sensor Tower, AppFigures…) or is labelled
  as an estimate from autocomplete.
- **Natural language.** Descriptions are written for people; keyword repetition
  that reads unnaturally is a policy and conversion risk.
- **Verify current limits and policies** in App Store Connect / Play Console
  help if a decision depends on them; they change.

## Field limits

| Field | Apple App Store | Google Play |
|---|---|---|
| App name / title | 30 | 30 |
| Subtitle | 30 | — |
| Short description | — | 80 |
| Keyword field | 100 (comma-separated, not shown) | — (Play indexes title, short and full description) |
| Promotional text | 170 (editable without a release; not indexed) | — |
| Full description | 4,000 (not indexed for search on iOS) | 4,000 (indexed) |
| What's new | 4,000 | 500 |

## Workflow

1. **Understand the app and buyer.** Core job, who searches, what words they
   use (reviews of yours and competitors' are the best source).
2. **Seed keywords** from features, outcomes, the user's language, store
   autocomplete, and competitors' titles and subtitles.
3. **Score each keyword** on relevance (does the app truly do this?), estimated
   volume, competition (how strong are the top 10?), and intent. Relevance is
   a hard gate: an irrelevant keyword that ranks still won't convert.
4. **Map placement.**
   - iOS: strongest terms in name + subtitle; the rest in the keyword field.
     Don't repeat words across name, subtitle and keyword field (Apple combines
     them). Singular forms only; commas, no spaces; no category name or "app".
   - Play: strongest terms in title and short description; supporting terms
     naturally in the full description, especially early.
5. **Write the metadata** (formulas below), with counts.
6. **Plan visuals.** Screenshots sell; most viewers see only the first two or
   three. Each screenshot: one benefit headline (not a feature list) + real UI.
   First screenshot = the core promise. Icon: simple, recognisable at small
   sizes, distinct from competitors in the category grid.
7. **Ratings.** Ask with the native prompt (SKStoreReviewController / Play
   In-App Review) after a success moment, never after an error; never gate or
   incentivise reviews. Reply to negative reviews with specifics and a fix date.
8. **Test.** Apple Product Page Optimization / Play Store Listing Experiments.
   One variable per test, run full weeks (at least 7 days), and don't stop at
   the first significant reading. Use `experimentation` for sample size.

## Formulas

- **Title:** `Brand: Primary keyword & secondary` — e.g. `Habitly: Habit Tracker & Goals` (30).
- **Subtitle (iOS) / short description (Play):** the main benefit in the
  user's words, with a secondary keyword. No CTA in Play's short description
  if it reads as promotional.
- **Full description:**
  1. Hook (2–3 sentences): the problem and the promise.
  2. Five benefit-led bullets (feature → why it matters).
  3. Proof only if real (ratings, press, awards) — never invented.
  4. Plain closing line (what's free, what's paid, privacy stance).

## Output format

```
## Keyword map
| Keyword | Relevance | Volume (source) | Competition | Placement |

## Metadata
| Field | Text | Chars / limit |

## Screenshots
| # | Headline | Shows | Why this order |

## Tests to run
| Element | Hypothesis | Metric | Min duration |

## Policy check
- [ ] all fields within limits     - [ ] no promo/ranking words in title or icon
- [ ] no competitor trademarks     - [ ] no duplicated words across iOS fields
```

<!-- Adapted from alirezarezvani/claude-skills marketing-skill/skills/app-store-optimization (MIT). Google Play title limit corrected to 30; invented lift figures removed; works without the bundled scripts. -->
