# mcp-workspace

Notion, Google Workspace and Slack.

Off by default. Enable with `/plugin` > the-agency > mcp-workspace. Claude Code then asks for the keys below and stores secrets in your OS keychain.

**Prerequisites:** Node 20+, uv.

| Server | What it gives you | Needs | How to get the key |
|---|---|---|---|
| notion | Search, read and edit pages and databases | `notion_token` | notion.so/profile/integrations > New internal integration; share the pages with it |
| google-workspace | Gmail, Calendar, Drive, Docs, Sheets (core tool tier) | `google_oauth_client_id`, `google_oauth_client_secret` | Google Cloud Console > enable the APIs > Credentials > OAuth client ID (Desktop app). A browser sign-in follows on first use |
| slack | Channels, DMs, threads, search | `slack_token` | api.slack.com/apps > create app > add user scopes > install > copy User OAuth Token (`xoxp-`). The server exits at start-up if the token is invalid |

Claude drafts; it does not send email or post messages without your explicit go-ahead.

Turn off any server you do not use: `/mcp`, select it, disable. Leave a key empty when Claude Code asks and the matching server simply fails to connect; nothing else is affected.

See mcp-core's README for tools that are better installed by hand.
