# mcp-business

Payments, automation and analytics.

Off by default. Enable with `/plugin` > the-agency > mcp-business. Claude Code then asks for the keys below and stores secrets in your OS keychain.

**Prerequisites:** Node 20+, uv.

| Server | What it gives you | Needs | How to get the key |
|---|---|---|---|
| stripe | Customers, payments, subscriptions, docs search (official remote server) | Stripe account | OAuth in the browser on first use. Prefer a test-mode account |
| n8n | n8n node docs and validation; with a key, build and deploy workflows | `n8n_api_url`, `n8n_api_key` (both optional) | n8n > Settings > n8n API > Create API key |
| posthog | Product analytics, insights, feature flags | `posthog_api_key` | PostHog > Settings > Personal API keys |
| google-analytics | GA4 reports, real-time data, property details | `ga_credentials_file`, `ga_project_id` | `gcloud auth application-default login --scopes https://www.googleapis.com/auth/analytics.readonly,https://www.googleapis.com/auth/cloud-platform`, then pick the generated JSON |

Turn off any server you do not use: `/mcp`, select it, disable. Leave a key empty when Claude Code asks and the matching server simply fails to connect; nothing else is affected.

See mcp-core's README for tools that are better installed by hand.
