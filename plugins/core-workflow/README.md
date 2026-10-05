# core-workflow

The process layer: how work gets done, regardless of the domain.

## Skills

| Skill | Use when |
|-------|----------|
| `using-the-agency` | Every session (injected by the SessionStart hook): check skills before acting |
| `brainstorming` | Before building anything: shared understanding and an approved design first |
| `writing-plans` | Turning an approved design into bite-sized, file-exact tasks |
| `subagent-driven-development` | Executing a plan with a fresh subagent per task and a review after each |
| `executing-plans` | Executing a plan inline, yourself |
| `dispatching-parallel-agents` | Two or more independent tasks; includes iterative context retrieval |
| `test-driven-development` | Writing any code: red, green, refactor, and watch it fail first |
| `systematic-debugging` | Any bug or failing test: root cause before fixes |
| `verification-before-completion` | Before saying done, fixed or passing; optional pre-PR pass |
| `requesting-code-review` | After a task or before merge |
| `receiving-code-review` | Acting on review feedback: verify it before implementing it |
| `using-git-worktrees` | Isolating feature work |
| `finishing-a-development-branch` | Work complete: merge, PR, keep or discard |
| `search-first` | Before writing a utility or adding a dependency |
| `grill-me` | Stress-testing a plan, one question at a time |
| `handoff` | Handing work to a fresh session |

## Agents

| Agent | Use when |
|-------|----------|
| `spec-reviewer` | Reviewing a git range against its plan or requirements (read-only, opus) |

## Commands

| Command | Does |
|---------|------|
| `/commit` | Stage and commit with a Conventional Commits message, never `--no-verify` |
| `/pr` | Push and open a PR with a summary and test plan |

## Hooks

`SessionStart` injects `using-the-agency` (about 2 KB) on startup, clear and compact.
