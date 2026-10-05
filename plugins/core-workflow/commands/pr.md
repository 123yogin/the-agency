---
description: Push the current branch and open a GitHub pull request with a summary and test plan
argument-hint: "[optional base branch]"
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git branch:*), Bash(git push:*), Bash(git rev-parse:*), Bash(gh pr:*), Bash(gh repo view:*)
---

Open a pull request for the current branch.

1. Base branch: `$ARGUMENTS` if given, else the repo default
   (`gh repo view --json defaultBranchRef -q .defaultBranchRef.name`).
2. Refuse if the current branch is the base branch. Suggest creating a branch.
3. If `git status --short` shows uncommitted changes, stop and ask whether to
   commit them first.
4. If `gh pr view` shows a PR already exists for this branch, print its URL
   and stop.
5. Read `git log --oneline <base>..HEAD` and `git diff <base>...HEAD --stat`,
   then the diff itself. The PR describes all commits on the branch, not just
   the last one.
6. Push with `git push -u origin HEAD`. Never force-push.
7. Create the PR with `gh pr create --base <base> --title "<title>" --body-file -`
   using this body:

   ```
   ## Summary
   - <what changed and why, 1-4 bullets>

   ## Test plan
   - [ ] <command run or manual step, with its result>

   ## Notes
   <risks, follow-ups, screenshots; delete if empty>
   ```

   Title: under 70 characters, imperative, matching the repo's style. Use a
   PR template from `.github/` instead if the repo has one.
8. Print the PR URL.
