# meta

Tools for building on Claude Code itself, plus multi-agent patterns.

## Skills

| Skill | Use when |
|---|---|
| `skill-creator` | Creating or improving a skill with real evals, benchmarks and description tuning (Anthropic, Apache-2.0) |
| `writing-skills` | Writing a skill test-first: watch an agent fail without it, then write the minimum that fixes it |
| `agent-authoring` | Writing or fixing a subagent: trigger description, least-privilege tools, model choice, trigger tests |
| `parallel-debugging` | Evidence standards and arbitration for competing-hypothesis debugging |
| `multi-reviewer-patterns` | Dimension choice, merge rules and severity calibration for multi-reviewer reviews |
| `strategic-compact` | Compacting at phase boundaries and re-anchoring on written rules afterwards |
| `council` | A four-voice decision council for ambiguous go/no-go calls |

## Commands

| Command | What it does |
|---|---|
| `/team-debug <bug>` | One investigator per root-cause hypothesis, in parallel, then evidence-based arbitration |
| `/team-review <target>` | One reviewer per quality dimension, in parallel, then a deduplicated report with a verdict |

## Agents

| Agent | Role |
|---|---|
| `team-debugger` | Tests one hypothesis and reports Confirmed / Falsified / Inconclusive with file:line evidence |
| `team-reviewer` | Reviews one dimension and reports findings with severity |

## Experimental: agent teams

`/team-debug` and `/team-review` use Claude Code agent teams when
`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` is set. Without it they fall back to
ordinary parallel subagents with the same workflow. Agent teams are an
experimental Claude Code feature and may change.

See `NOTICE.md` for sources and licences.
