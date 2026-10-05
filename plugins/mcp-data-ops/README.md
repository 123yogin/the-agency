# mcp-data-ops

Postgres performance work and Grafana observability.

Off by default. Enable with `/plugin` > the-agency > mcp-data-ops. Claude Code then asks for the keys below and stores secrets in your OS keychain.

**Prerequisites:** uv.

| Server | What it gives you | Needs | How to get the key |
|---|---|---|---|
| postgres-pro | Schema, EXPLAIN plans, index advice, health checks in restricted (read-only) mode | `postgres_uri` | A connection string for a read-only role: `postgresql://user:pass@host:5432/db` |
| grafana | Prometheus and Loki queries, dashboards, alerts, incidents | `grafana_url`, `grafana_token` | Grafana > Administration > Service accounts > Add token (Viewer) |

postgres-pro is pinned to Python 3.12 and `mcp<2` because the current release does not start under Python 3.14 or the MCP 2.x SDK.

Turn off any server you do not use: `/mcp`, select it, disable. Leave a key empty when Claude Code asks and the matching server simply fails to connect; nothing else is affected.

See mcp-core's README for tools that are better installed by hand.
