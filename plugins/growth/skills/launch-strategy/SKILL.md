---
name: launch-strategy
description: Use when planning a product, feature or pricing launch — phases, channel plan, launch-day runbook, Product Hunt, Show HN, BetaList, post-launch momentum. A plan is incomplete until it covers owned, rented and borrowed channels and both launch-day and the 30 days after.
---

# Launch Strategy

A launch is a momentum system, not a day. Read
`.claude/product-marketing-context.md` first if it exists.

## Hard rules

- **Every action maps to owned, rented or borrowed reach** (below), and the
  plan covers all three.
- **Every line has an owner and a date.** "Post on social" is not a plan.
- **Platform rules are followed literally.** No vote rings, no asking for
  upvotes on Product Hunt or Hacker News, no sockpuppets. Getting caught
  costs more than a quiet launch.
- **Gate the date on readiness** (checklist below), not on hope. If the owned
  channels or core assets aren't ready a week out, move the date.

## Channel model (ORB)

| Type | Examples | Role |
|---|---|---|
| **Owned** | Email list, blog, in-app, your community, docs | Activate first; everything else should funnel back here |
| **Rented** | X, LinkedIn, Reddit, YouTube, TikTok, app stores | Speed and reach on someone else's rules — use 1–2 where the audience actually is |
| **Borrowed** | Newsletters, podcasts, creators, partners, Product Hunt, Hacker News, BetaList | Other people's audiences; needs relationships built weeks ahead |

## Phases

1. **Internal / friends:** a handful of users one-on-one; fix the obvious.
2. **Alpha:** landing page + waitlist; invite individually; first outside feedback.
3. **Beta / early access:** work through the waitlist in batches; share
   screenshots and demos; recruit supporters; gather testimonials (with permission).
4. **Full launch:** open signups, start charging if planned, announce
   everywhere at once.
5. **Post-launch (30 days):** keep momentum (below).

Small updates don't need all five: major release → full campaign; medium
(integration, notable UI) → targeted email + in-app; minor → changelog.

## Pre-launch (2–6 weeks out)

- [ ] Positioning and one-sentence pitch tested on real target users
- [ ] Landing page with clear value prop, real screenshots, working signup
- [ ] Onboarding works end to end on a fresh account (web and mobile)
- [ ] Analytics events for signup → activation verified (`analytics-tracking`)
- [ ] Email list warmed with at least one useful pre-launch message
- [ ] Borrowed outreach sent: newsletters, podcasts, creators, partners
      (personal pitches, why it's relevant to *their* audience)
- [ ] Assets: 60–90s demo video, GIFs, screenshots, logo, press kit page
- [ ] Launch-day posts drafted per platform (`linkedin-content`, `x-growth`,
      `reddit-marketing`, `hacker-news-launch`)
- [ ] FAQ and support macros ready; status page/monitoring in place
- [ ] Team calendar blocked for launch day

## Product Hunt

- Create the listing in advance: name, tagline (≤60 chars, says what it does,
  no hype), description, gallery (first image is the hook), demo video,
  maker comment, topics, pricing tag.
- Launches run on a 24-hour day starting 12:01am Pacific; schedule accordingly.
- First comment from the maker: who you are, why you built it, what's
  different, an honest limitation, what feedback you want.
- **Ask your audience to check it out and leave feedback — never to upvote.**
  Product Hunt penalises vote solicitation and coordinated voting.
- Reply to every comment, all day, with substance.
- Afterwards: thank people, convert visitors to email signups, share results honestly.

## Show HN (summary — use `hacker-news-launch` for the full playbook)

- Only for something people can try now (no signups-only landing pages, no waitlists).
- Title: `Show HN: <Name> – <what it does, plainly>`; no superlatives.
- A first comment with the backstory and technical detail.
- Never ask for upvotes; HN detects and penalises voting rings.

## Launch-day runbook

| Time (local to audience) | Action | Owner |
|---|---|---|
| T-1 day | Final QA on signup, payments, onboarding; queue emails | |
| T0 | Listing live (PH/HN); announcement email; blog post; in-app banner | |
| T0 + 1h | Platform posts (each native, not cross-posted copies) | |
| All day | Respond to every comment and email; log bugs and feature requests | |
| End of day | Note what drove signups (UTMs), fix urgent bugs | |

## Post-launch (30 days)

- [ ] Onboarding emails active for launch signups
- [ ] Personal follow-up with engaged commenters and early users
- [ ] Roundup email for people who missed it
- [ ] Comparison / alternatives pages; case study from an early user
- [ ] Interactive demo or video for visitors not ready to sign up
- [ ] Retrospective: channel → signups → activated users (not just traffic)
- [ ] Next "launch moment" scheduled (feature, integration, milestone)

## Output format

```
# Launch plan: <what> — target date <date>

## Goal
<primary metric, e.g. activated signups in 30 days, with baseline>

## Channel map
| Type | Channel | Action | Asset needed | Owner | Date |

## Timeline
| Week | Milestones |

## Launch-day runbook
<table>

## Readiness check (one week out)
- [ ] … (blockers in bold)

## Post-launch
<checklist with owners>
```

<!-- Adapted from alirezarezvani/claude-skills marketing-skill/skills/launch-strategy and references/launch-frameworks-and-checklists.md (MIT). Platform-rule checks added; script dependency removed. -->
