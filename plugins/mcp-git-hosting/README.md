# mcp-git-hosting

GitHub and GitLab: PRs, issues, CI logs, code review.

Off by default. Enable with `/plugin` > the-agency > mcp-git-hosting. Claude Code then asks for the keys below and stores secrets in your OS keychain.

**Prerequisites:** Node 20+ for GitLab.

| Server | What it gives you | Needs | How to get the key |
|---|---|---|---|
| github | PRs, issues, Actions logs, code scanning, reviews (official remote server) | `github_token` | github.com/settings/personal-access-tokens: fine-grained, only the repos you need |
| gitlab | Merge requests, pipelines, issues, wiki | `gitlab_token`, `gitlab_api_url` | GitLab > Preferences > Access tokens, `api` scope (`read_api` for read-only) |

Turn off any server you do not use: `/mcp`, select it, disable. Leave a key empty when Claude Code asks and the matching server simply fails to connect; nothing else is affected.

See mcp-core's README for tools that are better installed by hand.
