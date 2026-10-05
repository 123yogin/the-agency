---
name: customer-interview
description: Use when preparing, running or debriefing customer or user interviews — problem discovery, switch (jobs-to-be-done) interviews, or validating whether a pain is real — and when writing the recruiting screener. Enforces Mom Test rules (past behaviour, not opinions about the future), a non-leading screener, and a debrief that separates facts from compliments.
---

# Customer Interview

Interviews fail in a predictable way: the interviewer pitches, the person is
polite, and everyone leaves with compliments that predict nothing. The rules
below exist to get facts about what people actually did.

## Hard rules (the Mom Test, Rob Fitzpatrick)

1. **Talk about their life, not your idea.** Do not describe the product until the
   end, if at all.
2. **Ask about specific past events, not generalities or the future.**
   "Tell me about the last time you…" beats "Do you usually…?", which beats
   "Would you use…?" (worthless).
3. **Listen more than you talk.** Follow the energy; ask "why?" and "what happened
   next?"

Three kinds of bad data, and what to do with them:

| Bad data | Sounds like | Do this |
|---|---|---|
| Compliments | "That's a great idea", "I'd love that" | Deflect and return to their past behaviour |
| Fluff | "I usually…", "I always…", "I would…", "I might…" | Anchor it: "When did that last happen? Walk me through it" |
| Ideas and feature requests | "You should add…" | Dig underneath: "Why do you want that? What would it let you do? How are you coping without it?" |

The real signals are **commitment and advancement**: they give time (a
follow-up, a trial with their data), reputation (an introduction to their boss
or a colleague) or money (a pre-order, a paid pilot). Praise without commitment
is not validation.

## Question bank

**Problem discovery**
- "Tell me about the last time you {did the job}." Then: "What happened just
  before? What happened after?"
- "What was the hardest part?" → "Why was that hard?"
- "What have you tried to fix it? What did that cost you in time or money?"
- "What are you using right now? What do you like and dislike about it?"
- "If you could wave a wand, what would be different?" (only to open a thread;
  then return to past facts)
- "Who else is involved in this? Who decides? Who pays?"
- "Is there anything I should have asked but didn't?"

Avoid: "Would you use…", "Would you pay…", "Do you think it's a good idea…",
"How much would you pay?", and any question that contains your preferred answer.

**Switch interview (jobs to be done, Bob Moesta / Chris Spiek)** — with someone
who recently started using, or stopped using, a product. Rebuild the timeline:

| Moment | Ask |
|---|---|
| First thought | "When did you first realise the old way wasn't working? What was going on?" |
| Passive looking | "What did you notice or try before you were seriously looking?" |
| Active looking | "When did you start actively searching? What did you compare?" |
| Deciding | "What made you pick this one? What almost stopped you?" |
| First use | "What happened the first time you used it? Did it match what you expected?" |

Map the four forces: **push** of the current situation, **pull** of the new
solution, **anxiety** about the new, **habit** of the present. Switching happens
when push + pull outweigh anxiety + habit.

## Interview script (about 45 minutes)

1. **Open (3 min):** thanks, purpose ("learning how people handle X; there are no
   wrong answers; I'm not selling anything today"), consent to record, how notes
   are stored and deleted.
2. **Context (5 min):** their role and how the job fits into their week.
3. **Core (30 min):** the last specific occurrence, in detail; workarounds; costs;
   who else is involved. Or the switch timeline.
4. **Close (5 min):** "Anything I should have asked?" Ask for a commitment if one
   fits (a follow-up, an introduction, trying a prototype with their real data).
5. **Thank and confirm** any incentive.

## Screener (recruit on behaviour, hide the target)

- Screen on **recent behaviour** ("In the last 30 days, how many times did you
  {job}?"), not on self-description ("Are you a fitness enthusiast?").
- **Hide which answer qualifies.** Use multiple choice with plausible decoys and
  a "none of these" option.
- **Disqualify:** people who work in your industry, in market research, or have
  joined a study in the last few months; your friends; current employees.
- Include one **articulation question** ("Describe the last time you…") to screen
  out people who cannot give specifics.
- Record segment fields you will analyse by.

```markdown
Q1. In the last 30 days, which of these have you done? (select all)
    [ ] {target behaviour}   [ ] {decoy}   [ ] {decoy}   [ ] None of these
Q2. How many times in the last 30 days did you {target behaviour}?
    0 (end) · 1 · 2–4 · 5+
Q3. Which tools do you use for it? (open text)
Q4. Do you or anyone in your household work in {industry} or market research? (yes → end)
Q5. In a sentence or two, describe the last time you {target behaviour}. (articulation check)
```

## How many

Interview until new conversations stop producing new themes for a segment.
Five to eight per distinct segment is a common starting point; plan for more if
segments differ a lot. Do not mix segments and then average them.

## Debrief (within an hour of each interview)

```markdown
# Interview {n} — {segment} — {date}

Facts (things they did, with specifics):
- ...
Pains (in their words):
- "{quote}"
Workarounds and what they cost:
- ...
Commitments offered: {time / reputation / money / none}
Compliments and fluff (do not count as evidence):
- ...
Surprises:
- ...
Questions to add or drop next time:
- ...
```

Feed debriefs into the feedback-synthesis skill once you have several.

<!-- Written for the-agency, summarising methods from Rob Fitzpatrick's The Mom Test and Bob Moesta / Chris Spiek's switch interview. -->
