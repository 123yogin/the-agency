---
description: Stage and commit the current changes with a Conventional Commits message
argument-hint: "[optional message hint]"
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*)
---

Commit the current work.

1. Run `git status --short` and `git diff HEAD --stat`. If there is nothing to
   commit, say so and stop.
2. Read the diff (`git diff HEAD`). If it mixes unrelated changes, propose
   splitting it into separate commits and ask before continuing.
3. Never stage files that look like secrets or local config (`.env*`,
   `*.pem`, `*.key`, credentials files). If they are modified, warn and leave
   them out.
4. Check `git log --oneline -10` and match the repo's existing message style.
   If it has none, use Conventional Commits:
   `<type>(<optional scope>): <imperative summary under 72 chars>`
   with type one of feat, fix, refactor, perf, test, docs, build, ci, chore.
5. Add a body only when the why is not obvious from the summary: what
   changed and why, wrapped at 72 columns.
6. Stage the specific files (`git add <paths>`, not `git add -A`) and commit.
   Never use `--no-verify`. If a hook fails, fix the cause and commit again.
7. Print the resulting `git log --oneline -1`.

User hint for the message: $ARGUMENTS
