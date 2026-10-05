---
name: prompt-engineering
description: Use when writing, fixing or reviewing a production prompt, system prompt, tool description or structured-output contract for an LLM feature — especially when output is inconsistent, malformed, too long, or wrong on edge cases. Enforces an eval set and baseline before any edit, one change at a time, and platform features (structured outputs, tool schemas, caching) over prompt incantations.
---

# Prompt Engineering

A prompt is a spec. When the model does the wrong thing, the spec was
ambiguous, missing context, or contradicted itself — find which, fix that, and
prove the fix on cases you did not tune against.

## Rules

1. **Eval set before edits.** At least 10–20 representative cases with expected
   behaviour: common inputs, edge cases, and inputs that should be refused or
   redirected. No eval set → build one with the user first. For anything beyond a
   small prompt, use the `llm-eval-harness` skill.
2. **Baseline first.** Run the current prompt over the set and record pass/fail
   per case, with model, snapshot, temperature and max tokens.
3. **One change at a time**, re-running the whole set after each. Keep a change
   only if no previously passing case regresses.
4. **Platform features beat prompt text.** Native structured outputs / JSON
   schema, tool parameters, stop sequences, prompt caching and extended
   thinking guarantee or optimise what prompt wording can only request.
5. **Add scaffolding only when the eval shows it helps.** Current models often
   do worse with reflexive role framing, chain-of-thought boilerplate and
   examples. Start minimal.
6. **Explain the why.** "Keep replies under 3 sentences because they are shown
   in a mobile notification" generalises better than "BE CONCISE".
7. **Test on the production model and settings.** Behaviour changes across
   models, snapshots and temperatures. Re-run the eval when any of them change.
8. **Version prompts as files**, with a changelog line per change and the
   measured effect.

## Diagnose → fix

| Symptom | Likely cause | Fix, in order of preference |
|---|---|---|
| Output fails to parse | format only described in prose | native structured output / tool schema → schema in prompt plus one valid example |
| Inconsistent across runs | underspecified decision rule | state the rule and the tie-breaker; add 2–3 contrastive examples incl. a near-miss |
| Misses edge cases | edge cases never named | list them with the expected behaviour; add "if unsure, do X" |
| Hallucinated facts | no grounding, no permission to abstain | provide the source material; require citing it; allow "not in the provided material" |
| Too long / padded | no length or audience defined | define length in units and the reader; remove "be thorough" style words |
| Ignores an instruction | buried, contradicted, or outweighed by examples | move it up, remove the contradiction, check examples do not model the opposite |
| Follows instructions in user content | data and instructions not separated | delimit untrusted input (tags), say it is data, never grant it tool authority |
| Slow / expensive | long dynamic prefix | stable content first (system, tools, examples) so caching applies; trim |
| Wrong on hard reasoning | no room to think | extended thinking, or a scratch field the consumer ignores |

## Structure that works

```
<context>   who the output is for, why the task exists, what good looks like
<task>      the specific job, in one or two sentences
<rules>     constraints with reasons; the decision rule for ambiguous cases
<format>    exact output shape (prefer a schema enforced by the API)
<examples>  only if the eval shows they help: simple → edge → near-miss
<input>     the untrusted data, clearly delimited
```

Use consistent tag names and refer to them by name in the instructions.

## Few-shot examples

- Start with zero; add examples only for a failure cluster the eval revealed.
- 3–5 at most, formatted exactly like the real output.
- Include a negative or near-miss example to mark the boundary.
- Vary them. Models copy surface features — length, phrasing, field order.
- If a case passes only because it resembles an example, add a held-out
  variant to the eval set.

## Tool descriptions and agent prompts

- Each tool description says when to use it, when not to, and what it returns.
- Fewer, well-separated tools beat many overlapping ones.
- Give agents an explicit stop condition and an iteration cap.
- Say what to do on tool errors (retry? report? ask?).

## Deliverable

```
## Prompt v<N>  (model <id>, temperature <t>, max_tokens <m>)
<prompt file path>

## Eval
| case | v<N-1> | v<N> |
pass rate: <a>/<n> → <b>/<n>; regressions: <none | list>

## Changelog
v<N>: <change> — <measured effect>

## Known limitations
- <inputs that still fail and why>
```

<!-- Adapted from alirezarezvani/claude-skills engineering-team/skills/senior-prompt-engineer (MIT) and msitarzewski/agency-agents engineering/engineering-prompt-engineer.md (MIT). -->
