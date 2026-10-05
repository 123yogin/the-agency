---
name: council
description: Use when facing an ambiguous decision with several credible options and no obvious winner (ship now vs hold, build vs buy, monorepo vs polyrepo), or when the user asks for dissent, second opinions or a go/no-go call. Not for code review, planning or factual questions.
---

# Council

Four voices, three of them fresh subagents that see only the question. That is
what prevents anchoring: they never see the conversation that led you to your
favourite answer.

| Voice | Lens |
|---|---|
| Architect (you) | Correctness, maintainability, long-term consequences |
| Skeptic | Challenges the premise; proposes the simplest credible alternative |
| Pragmatist | Shipping speed, user impact, operational reality |
| Critic | Downside risk, edge cases, how this fails |

Don't use it for verifying output (use the review agents), breaking down work
(writing-plans), or anything with a factual answer.

## Workflow

1. **Frame the question.** What is being decided, under which constraints,
   and what counts as success? If the question is vague, ask one clarifying
   question first.
2. **Collect the minimum context:** relevant snippets, numbers, constraints.
   Leave out the conversation history.
3. **Commit to your own position first.** Write your position, your three
   strongest reasons and your option's biggest risk before you read the other
   voices.
4. **Launch three subagents in one message**, each with this prompt:

   ```
   You are the <ROLE> on a four-voice decision council. <role emphasis>

   Question: <decision>
   Context: <only what is needed>

   Respond in under 300 words:
   1. Position (1-2 sentences)
   2. Reasoning (3 bullets)
   3. Biggest risk in your recommendation
   4. One thing the other voices will likely miss
   Be direct. No hedging.
   ```

5. **Synthesize honestly:**
   - Never dismiss a voice without saying why.
   - If a voice changed your mind, say so.
   - If two voices oppose your initial position, treat that as a strong
     signal.
   - Always report the strongest dissent, even when you reject it.

## Output

```
## Council: <decision>

Architect: <position> — <why>
Skeptic: <position> — <why>
Pragmatist: <position> — <why>
Critic: <position> — <why>

Consensus: <where they agree>
Strongest dissent: <the disagreement that matters most>
Premise check: <did the Skeptic reframe the question?>
Recommendation: <the path, and the cheapest way to test it>
```

Run one round by default. In a follow-up round, give the Skeptic the new
question only, without the previous verdict.

<!-- Adapted from affaan-m/ECC skills/council (MIT, Copyright (c) 2026 Affaan Mustafa). -->
