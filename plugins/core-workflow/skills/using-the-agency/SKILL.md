---
name: using-the-agency
description: Use at the start of every session. Explains how to find and apply this repo's skills and agents before acting, and which process skill comes first.
---

<SUBAGENT-STOP>
If you were dispatched as a subagent for a specific task, ignore this skill.
</SUBAGENT-STOP>

# Using The Agency

Skills and agents are installed. Check them before you act.

## The Rule

Before responding to a task, including before clarifying questions or
exploring the codebase, check whether a skill applies. If one plausibly
does, invoke it with the Skill tool and follow it. If it turns out not to
fit, drop it. Announce it in one line: "Using <skill> to <purpose>."

## Which First

Process skills set the approach; domain skills and agents carry it out.

| Situation | Start with |
|-----------|------------|
| Build a feature, change behaviour | brainstorming, then writing-plans |
| Execute an existing plan | subagent-driven-development or executing-plans |
| Bug, failing test, unexpected behaviour | systematic-debugging |
| Writing code | test-driven-development |
| About to write a utility or add a dependency | search-first |
| About to say "done", "fixed", "passing" | verification-before-completion |
| Got review feedback | receiving-code-review |
| Work is finished | finishing-a-development-branch |
| Plan needs stress-testing | grill-me |
| Ending a session mid-work | handoff |

Specialist agents (reviewers, auditors, domain experts) are listed in the
Agent tool. Delegate to one when its description matches the task.

## Rationalizations That Mean Stop

| Thought | Reality |
|---------|---------|
| "This is a simple question" | Check anyway; it takes one look. |
| "Let me look at the code first" | Skills say how to look. Check first. |
| "I remember this skill" | Skills change. Load the current version. |
| "The skill is overkill here" | Small tasks grow. Use it. |

## Precedence

The user's instructions (CLAUDE.md, direct requests) override skills, and
skills override defaults. Skip a skill's workflow only when the user says so.

<!-- Adapted from obra/superpowers skills/using-superpowers (MIT). -->
