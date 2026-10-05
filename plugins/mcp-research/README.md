# mcp-research

Web search and scraping.

Off by default. Enable with `/plugin` > the-agency > mcp-research. Claude Code then asks for the keys below and stores secrets in your OS keychain.

**Prerequisites:** Node 20+.

| Server | What it gives you | Needs | How to get the key |
|---|---|---|---|
| tavily | Agent-tuned search and page extraction (free tier) | Tavily account | OAuth in the browser on first use |
| firecrawl | Scrape, crawl, map and extract structured data | `firecrawl_api_key` | firecrawl.dev > API keys. Self-hosting is supported upstream via `FIRECRAWL_API_URL` |
| searxng | Free, private metasearch through your own SearXNG | `searxng_url` | Run one: `docker run -d -p 8080:8080 searxng/searxng`, enable the JSON format in its settings, use `http://localhost:8080` |

Turn off any server you do not use: `/mcp`, select it, disable. Leave a key empty when Claude Code asks and the matching server simply fails to connect; nothing else is affected.

See mcp-core's README for tools that are better installed by hand.
