---
name: agent-authoring
description: Use when creating, editing or reviewing a Claude Code subagent (a .claude/agents/*.md or plugin agents/*.md file), choosing its tools or model, or when an agent fires too often, never fires, or does work outside its role.
---

# Agent Authoring

A subagent is a system prompt plus a tool allowlist, running in a fresh
context. Three things decide whether it helps: **when it fires** (the
description), **what it can touch** (tools), and **what it hands back** (the
output contract). A long persona contributes almost nothing.

For skills rather than agents, use writing-skills and skill-creator.

## Agent or skill?

| Need | Use |
|---|---|
| Work in an isolated context, returning only a conclusion (search, review, audit) | Agent |
| Hard tool limits (a reviewer that cannot edit) | Agent |
| Work in parallel with other workers | Agent |
| A procedure the main agent should follow in its own context (TDD, debugging gate) | Skill |
| Reference material loaded on demand | Skill |

## File format

Location: `.claude/agents/<name>.md` (project), `~/.claude/agents/<name>.md`
(personal), or `plugins/<plugin>/agents/<name>.md`. Plugin agents are invoked
as `<plugin>:<name>`.

```yaml
---
name: dependency-auditor          # kebab-case, must match the filename
description: Use when <trigger>. Not for <adjacent case>; use <other agent>.
tools: Read, Grep, Glob, Bash     # comma-separated allowlist
model: sonnet                     # sonnet | opus | haiku | inherit
---
<system prompt>
```

If you omit `tools`, the agent inherits every tool, including MCP tools. Always
set it.

## Description: the trigger

The main agent reads only the description when deciding whether to delegate.

- Start with **"Use when"** and name concrete situations, artifacts or
  symptoms: "Use when a migration file changes", not "database expert".
- Add **"Not for X; use Y"** for the nearest neighbour. That one clause
  prevents most mis-routing between similar agents.
- Do not summarise the workflow. The main agent may follow the summary and
  skip the agent.
- Never write "MUST BE USED for all…" or "use PROACTIVELY for any…". Agents
  written that way fire on everything and drown out the others.

## Tools: least privilege

| Role | Tools |
|---|---|
| Reviewer, auditor, critic | Read, Grep, Glob (+ Bash for running linters/tests) |
| Researcher | Read, Grep, Glob, WebSearch, WebFetch |
| Implementer, fixer | Read, Grep, Glob, Edit, Write, Bash |
| Log or triage reader | Read, Bash (+ Grep) |

A reviewer with Edit will "just fix it" and you lose the independent check. If
Bash is the risky part, say in the prompt which commands are allowed, for
example "read-only git commands and the test runner; never push, deploy or run
migrations".

## Model choice

- **haiku:** high-volume, low-judgement work (log scanning, lookups,
  classification).
- **sonnet:** the default for implementation and most reviews.
- **opus:** architecture, hard debugging, security reasoning, arbitrating
  conflicting evidence.
- **inherit:** when the agent should match whatever the user picked.

## The system prompt

Write it in this order, and cut anything that doesn't change behaviour:

1. **Mission:** one paragraph on what the agent does and what it never does.
2. **Hard rules:** the few constraints that matter, each phrased so a
   violation is observable ("every finding cites file:line").
3. **Workflow:** numbered steps, including what to read before acting.
4. **Output format:** a literal template. The caller parses this, so fix its
   shape: verdict first, then evidence.
5. **Verification:** what to run or check before reporting done, plus
   "report what you could not verify".

Leave these out: persona names, "world-class expert", invented success
metrics, long capability lists, code samples for stacks the agent will not
touch, and references to tools, MCP servers or skills that aren't installed.

The agent does not see your conversation. Anything it needs (paths,
constraints, what the caller already knows) has to arrive in the delegation
prompt, so write it to expect that.

## Testing an agent

An agent works when it fires on the right requests, stays silent on the wrong
ones, and returns the contracted output.

1. **Trigger set:** write 5 prompts that should route to it, and 5 near misses
   that should route to its neighbour or to nothing. Phrase them the way a real
   user would, with typos and partial context.
2. **Run them** in a fresh session with the agent installed, and note which
   agent actually got used. Fix the description (not the body) until the
   should/shouldn't split is clean.
3. **Output check:** for 2–3 realistic tasks, check that the output matches the
   template, the claims are backed, and the agent stayed inside its tools and
   role.
4. **Over-fire check:** install it alongside the rest of the plugin and confirm
   it doesn't take requests meant for other agents.
5. Run `node scripts/lint.mjs` from the repo root.

## Checklist

- [ ] `name` matches the filename and is kebab-case
- [ ] Description starts "Use when", names concrete triggers, has a "Not for" clause
- [ ] `tools` is set and minimal; reviewers have no Edit or Write
- [ ] `model` chosen on purpose
- [ ] Prompt order: mission, rules, workflow, output template, verification
- [ ] No persona fluff, emoji, invented numbers, or references to missing tools
- [ ] Fires on the trigger set and stays silent on near misses
