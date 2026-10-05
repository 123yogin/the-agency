---
name: strategic-compact
description: Use when a long session reaches a phase boundary (research done, plan written, bug fixed), when context is getting large, when earlier rules or decisions start drifting, or immediately after a compaction has happened.
---

# Strategic Compact

Auto-compaction fires wherever the context limit happens to fall, often in the
middle of a task. Compacting by hand at a phase boundary keeps what matters.
After any compaction, re-anchor on the rules written in files, because rules
that were only said in conversation are the first thing lost.

## Iron law

```
WRITE IT DOWN BEFORE YOU COMPACT. RE-READ IT AFTER.
```

Anything that only exists in the conversation (the plan, a decision, a
preference the user stated, the next step) may not survive compaction. Files
always do.

## When to compact

| Transition | Compact? | Why |
|---|---|---|
| Research → planning | Yes | Research is bulky; the plan is its distilled output |
| Planning → implementation | Yes, once the plan is in a file | Free the space for code |
| Implementation → testing | Maybe | Keep if tests depend on recent edits; compact if focus shifts |
| Debugging → next feature | Yes | Debug traces pollute unrelated work |
| After a failed approach | Yes | Clear the dead-end reasoning before retrying |
| Mid-implementation | No | Losing file paths, names and partial state is costly |

## Before compacting

1. Write state to a file: the goal, decisions with their reasons, what is done,
   what is next, open questions, and the exact commands to verify. The handoff
   skill (core-workflow plugin) has a format for this.
2. Put durable rules in CLAUDE.md or memory, not in the summary.
3. Compact with a focus line, for example
   `/compact Next: implement the auth middleware per docs/plan.md`.

## After compacting (or when you notice drift)

Warning signs: you contradict an earlier decision, naming or style conventions
drift, the scope keeps growing, or you can't remember why a choice was made.

1. **Re-read** CLAUDE.md, the plan file, and the handoff file. Don't trust your
   memory of them.
2. **Recite** the 3–5 rules that govern the next action in one short line, for
   example "Active rules: no derived data stored; migrations via Alembic only;
   run pytest before claiming done".
3. **Verify** the next action against those rules before taking it.
4. If you are unsure about a past decision, re-read its source (file, commit,
   issue). Don't guess.

## Health checkpoints

You don't need to count tool calls precisely. At roughly every 40 tool calls in
one task, or whenever a warning sign appears:

- Summarize progress in one paragraph.
- Recite the active rules.
- Decide: finish now, compact at the next boundary, or write a handoff and
  start a fresh session. Split before quality drops, not after.

## Common mistakes

- Compacting with the plan only in conversation, so it is gone.
- Re-reading everything "to be safe" after a compaction. Read only the
  rules, the plan and the files the next step touches.
- Assuming you are fine because you feel fine. Compaction loses things
  silently.

<!-- Adapted from affaan-m/ECC skills/strategic-compact (MIT, Copyright (c) 2026 Affaan Mustafa) and wshobson/agents plugins/skill-forge-essentials/skills/session-guard by Adit Jain (MIT). -->
