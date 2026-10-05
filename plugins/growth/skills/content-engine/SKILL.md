---
name: content-engine
description: Use when turning source material (articles, demos, changelogs, transcripts, notes) into platform-native content across X, LinkedIn, short video, YouTube and newsletters, or when building a reusable voice profile so every output sounds like the real author. Bans generic hype and one-size-fits-all cross-posting.
---

# Content Engine

Platform-native content that keeps the author's real voice. Start from source
material, not from post formulas. Read `.claude/product-marketing-context.md`
first if it exists.

## Hard rules

1. **Source first.** No draft without source material (articles, notes,
   demos, docs, changelogs, transcripts, screenshots, prior posts).
2. **One post, one real claim.** Specifics beat adjectives.
3. **Adapt the format, not the persona.** The author sounds like themselves
   everywhere; only structure changes per platform.
4. **No invented facts, proof or engagement padding.** Missing proof → flag a gap.
5. **No identical copy across platforms** unless the user asks.
6. **CTAs are earned and user-approved.**

## Step 1: Voice profile (do this first when voice matters)

Collect 5–20 real samples, recent first: original posts and threads, essays,
newsletters, emails or DMs that worked, docs/README/site copy. Never use generic
platform examples as source material. If public and private voices differ,
profile them separately.

```
VOICE PROFILE
Author / goal / confidence (low|medium|high, given the sample size)
Sources: …
Rhythm: sentence length, pacing
Compression: dense vs explanatory
Capitalisation: conventional / mixed / situational
Parentheticals: how used
Questions: rare / frequent / rhetorical / direct
Claim style: how claims are framed and backed (numbers, mechanisms, receipts)
Preferred moves: …
Banned moves: … (observed absent in sources or requested by the user)
CTA rules: …
Channel notes: X … / LinkedIn … / Email …
```

Reuse the latest confirmed profile across the session. Don't commit personal
voice profiles to a repo unless the user asks.

## Step 2: Repurposing flow

1. Pick the anchor asset.
2. Extract 3–7 atomic claims or scenes.
3. Rank them by sharpness, novelty and proof.
4. Assign one idea per output.
5. Adapt the structure per platform (below).
6. Strip platform-shaped filler.
7. Run the quality gate.

## Platform rules

- **X:** lead with the strongest claim, artifact or tension; keep compression;
  each thread post advances the argument. (Depth: `x-growth`.)
- **LinkedIn:** expand just enough for people outside the niche; no fake lesson
  posts, praise-stacking or "journey" filler; sentence completes before the fold.
  (Depth: `linkedin-content`.)
- **Short video (TikTok/Reels/Shorts):** script around what's on screen; the
  first 1–2 seconds show the result, problem or punchline; captions always;
  narration that sounds natural spoken, not written.
- **YouTube:** result or tension early; structure by argument, not filler
  sections; chapters only when they help.
- **Newsletter:** open with the point, conflict or artifact; every section adds
  something new; no warm-up paragraph.

## Hard bans (rewrite on sight)

"In today's rapidly evolving landscape" · game-changer / revolutionary /
cutting-edge · "here's why this matters" not followed immediately by something
concrete · reply-farming questions · forced casualness · "Excited to share" ·
"not X, just Y" · "no fluff" · founder-journey filler. Run `avoid-ai-writing`
on anything that still reads generic.

## Quality gate

- [ ] Sounds like the author's profile, not the platform stereotype
- [ ] Every draft contains a real claim, proof point or concrete observation
- [ ] No hype words, no bait
- [ ] No duplicated copy across platforms
- [ ] Gaps listed rather than filled with invention

## Output format

```
## Voice profile (if built)
…

## Core angle
<one sentence>

## Drafts
### X
…
### LinkedIn
…
### <other>
…

## Gaps to fill before publishing
- …
```

<!-- Adapted from affaan-m/ECC skills/content-engine and skills/brand-voice (+references/voice-profile-schema.md) (MIT). Author-specific defaults removed. -->
