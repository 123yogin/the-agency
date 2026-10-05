---
name: hacker-news-launch
description: Use when launching or sharing something on Hacker News — deciding whether it qualifies for Show HN, writing the title and first comment, timing, and handling the comment thread. Follows HN's guidelines and Show HN rules literally; never solicits upvotes.
---

# Hacker News Launch

Hacker News rewards things that are genuinely interesting to curious,
technical readers and punishes anything that smells like marketing. Read the
current [guidelines](https://news.ycombinator.com/newsguidelines.html) and
[Show HN rules](https://news.ycombinator.com/showhn.html) before posting —
they change rarely but they're enforced.

## Hard rules

- **Never ask for upvotes**, share the direct link to friends asking for votes,
  or coordinate voting. HN detects voting rings and penalises or kills the
  post (and can ban the domain).
- **No fake accounts or planted comments.** Team members commenting should say who they are.
- **Show HN is for things people can try:** something you made that others
  can use or play with now. Not for landing pages, waitlists, signup walls before
  any value, fundraising announcements, or blog posts.
- **No marketing language** in the title or text.

## Is it Show HN?

| Yes | No (post as a normal submission, or don't) |
|---|---|
| Working app, tool, library, game, hardware project people can try | Waitlist or "coming soon" page |
| Open-source project with a README and a demo | A blog post (submit it normally) |
| Free tier or demo with no signup, or a quick signup | A press release or funding news |

Reduce friction: a demo without an account, or a guest mode, makes a big difference to how people respond.

## Title

`Show HN: <Name> – <what it does, plainly>`
- Say what it is, not how great it is. No "revolutionary", "the best",
  exclamation marks, or ALL CAPS.
- Specific beats clever: `Show HN: Cross Off – a habit calendar you can only fill in once`.
- Stay within HN's title length limit (80 characters at the time of writing).

## First comment (post it immediately)

```
Hi HN, I'm <name>. I built <thing> because <the specific problem you had>.

What it does: <2–3 sentences>.

How it works: <the technically interesting part — stack, a hard problem you
solved, a design decision and its trade-off>.

What it doesn't do yet / known limitations: <honest list>.

It's <free / open source / $X — what's free>. <Privacy stance if relevant.>

I'd love feedback on <specific question>.
```

## Timing (weak signal — don't over-optimise)

Many people post on weekday mornings US time, but there's no reliable best
time; a good post can do well any day. What matters more: be available for
several hours after posting to reply. If a good post sinks unnoticed, HN
moderators occasionally re-up posts via the second-chance pool; you may email
hn@ycombinator.com once, politely — don't repost repeatedly.

## In the thread

- Reply quickly and substantively to every real question.
- Treat criticism as free user research: thank, ask a follow-up, say what
  you'll change. Never get defensive or argue about votes.
- Admit mistakes and limitations plainly; HN respects it.
- Don't ask commenters to upvote, and don't post the same thing elsewhere
  asking for HN votes.

## Before posting checklist

- [ ] Qualifies for Show HN (people can try it now)
- [ ] Site handles a traffic spike (static assets cached, DB connections, rate limits)
- [ ] Demo / guest access works on a fresh browser and on mobile
- [ ] Title plain and specific; first comment ready
- [ ] Analytics with `ref=` or referrer tracking (no UTMs needed in the HN link itself)
- [ ] A few hours blocked to stay in the thread

## Output format

```
## Verdict
Show HN / regular submission / not ready — why

## Title
Show HN: …   (<n> chars)

## First comment
…

## Readiness checklist
- [ ] …
```

<!-- Original to the-agency. -->
