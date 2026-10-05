---
name: handoff
description: Use when the user wants to hand the current work to a fresh session or agent, or before a context reset. Writes a short handoff doc that points at existing artifacts instead of copying them.
argument-hint: "What will the next session focus on?"
---

# Handoff

Write a handoff document so a fresh agent can continue this work without
the conversation.

## Rules

- **Reference, never duplicate.** PRDs, specs, plans, ADRs, issues, commits,
  diffs and PRs are linked by path, URL or SHA. Copying them makes the handoff
  long and lets it drift from the source.
- **Tailor it.** If the user said what the next session is for, write for
  that. Otherwise infer it from where the work stopped.
- **Facts, not narrative.** State what is done, what is blocked and what is
  undecided. Leave out how the conversation got there.
- **Verify state before writing it.** Run `git status` and `git log --oneline -10`
  and check that any test result you claim is current.

## Where

Save to a fresh temp file (`mktemp -t handoff-XXXXXX.md`) unless the user names
a path. Print the path at the end.

## Template

```markdown
# Handoff: <short title>

## Goal of the next session
<one or two sentences>

## State of play
- Done: <item> (<commit SHA or path>)
- In progress: <item> — <where it stopped>
- Blocked: <item> — <on what>

## Open decisions
- <decision the next agent must make, with the options>

## Skills to use
- <skill name> — <why>

## Artifacts
- Branch: <name>   PR: <url>
- Spec / plan: <path>
- Other: <path or url>

## Gotchas
- <anything non-obvious that cost time this session>
```

<!-- Adapted from mattpocock/skills handoff (MIT, Matt Pocock), via alirezarezvani/claude-skills (MIT). -->
