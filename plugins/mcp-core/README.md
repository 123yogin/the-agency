# mcp-core

Keyless MCP servers, on by default. Install and they work. The `using-mcp-servers`
skill tells Claude which one to reach for.

**Prerequisites:** Node 20+ (`npx`), [uv](https://docs.astral.sh/uv/) (`uvx`),
Chrome for chrome-devtools, `ast-grep` binary for ast-grep (`brew install ast-grep`),
Android SDK / Xcode for mobile.

| Server | What it gives you | Needs | Key |
|---|---|---|---|
| chrome-devtools | Console, network, performance traces, Lighthouse, heap snapshots of a live page | Chrome | none |
| playwright | Deterministic browser automation and E2E flows (Chromium, Firefox, WebKit) | none | none |
| context7 | Current, version-specific library docs | none (optional free key raises limits) | none |
| codebase-memory | Tree-sitter knowledge graph of the repo: callers, call paths, outlines | none | none |
| ast-grep | Structural code search and rule testing | `ast-grep` binary | none |
| repomix | Pack a local or remote repo into compressed context | none | none |
| dbhub | Read-only SQL across Postgres, MySQL, MariaDB, SQL Server, SQLite | `DATABASE_URL` in your environment (else empty in-memory SQLite) | none |
| mobile | Android emulator/device and iOS simulator control: tap, swipe, screenshot, a11y tree | Android SDK or Xcode | none |
| markitdown | PDF, DOCX, PPTX, XLSX, HTML to Markdown | uv | none |
| excel | Create and edit .xlsx without Office | uv | none |
| youtube-transcript | Transcripts and metadata for any video | uv | none |
| excalidraw | Live whiteboard: create, group and export diagrams | none | none |
| chart | 25+ chart and map types rendered as images | none | none |
| shadcn-ui | Real shadcn/ui component and block source | none | none |
| icons | Search 200k+ Iconify SVG icons | none | none |

DBHub is read-only through `config/dbhub.toml`. It reads `DATABASE_URL` from your
shell, so point that at a read-only role.

Turn off any server you do not use: `/mcp`, select it, disable. Leave a key empty when Claude Code asks and the matching server simply fails to connect; nothing else is affected.

## Not bundled, install yourself

These are excellent but should not be auto-installed by a marketplace plugin:

| Tool | Why not bundled | Install |
|---|---|---|
| Serena (oraios/serena, GPL-3.0) | Its README warns against marketplace installs; LSP-backed symbol search and edits | `uv tool install -p 3.13 serena-agent` then `claude mcp add --scope user serena -- serena start-mcp-server --context claude-code --project-from-cwd` |
| claude-mem (thedotmack/claude-mem, Apache-2.0) | A plugin of its own, not an MCP server; automatic memory across sessions | `/plugin marketplace add thedotmack/claude-mem` then `/plugin install claude-mem` |
| Snyk Agent Scan (snyk/agent-scan, Apache-2.0) | A scanner you run, not a server; checks MCP configs and skills for tool poisoning and prompt injection | `uvx snyk-agent-scan ~/.claude` |
| Slidev / Marp (MIT) | CLIs, not servers; better slide decks than any slides MCP | `npm i -g @slidev/cli` or `npm i -g @marp-team/marp-cli` |
| Crawl4AI (unclecode/crawl4ai, Apache-2.0) | Needs Docker running | `docker run -d -p 11235:11235 unclecode/crawl4ai` then `claude mcp add --transport sse crawl4ai http://localhost:11235/mcp/sse` |
| Docling (docling-project/docling-mcp, MIT) | Pulls in PyTorch (GBs); use when MarkItDown is not accurate enough on complex PDFs | `claude mcp add docling -- uvx --from docling-mcp docling-mcp-server` |
