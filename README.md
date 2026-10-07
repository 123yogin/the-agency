# The Agency

A curated set of Claude Code agents, skills, guard hooks and MCP servers, built
by reviewing the most popular open-source collections and keeping only the best
version of each role. Every file was then rewritten to one standard
([CONVENTIONS.md](CONVENTIONS.md)).

**63 agents · 74 skills · 5 commands · 3 guard hooks · 42 MCP servers · a 3D dashboard, in 17 plugins.**

Sources reviewed (about 8,000 files): msitarzewski/agency-agents,
wshobson/agents, VoltAgent/awesome-claude-code-subagents, obra/superpowers,
affaan-m/ECC, alirezarezvani/claude-skills, anthropics/skills (Apache-2.0
skills only), SuperClaude, 0xfurai, lst97, iannuttall and vijaythecoder. Most
of those files were cut. Whatever survived was rewritten.

## Install

```text
/plugin marketplace add 123yogin/the-agency
/plugin install core-workflow@the-agency
/plugin install engineering@the-agency
/plugin install mcp-core@the-agency
/plugin install hq@the-agency      # then type /hq
```

Install only the plugins you need. Each one is independent.

## Plugins

| Plugin | What you get | On by default |
|---|---|---|
| [core-workflow](plugins/core-workflow) | Brainstorm → plan → TDD → systematic debugging → verify before claiming done → code review → finish the branch. Also `/commit`, `/pr`, and a session-start bootstrap | yes |
| [guards](plugins/guards) | Hooks that block `--no-verify`, weakened lint/type configs, `rm -rf` outside the project, force-push to main, `reset --hard`, `DROP TABLE` | yes |
| [engineering](plugins/engineering) | 27 agents. Evidence-gated reviewers (general, TS, React, Python, Go, Rust, Postgres, security, Terraform), minimal-diff fixers, backend/frontend implementers, Capacitor, React Native, mobile release, deploy verification, SRE | yes |
| [product-design](plugins/product-design) | PRDs, discovery, prioritisation, UX research, research synthesis, market sizing, competitor teardowns, an idea "roast" panel, UI finish gate, accessibility, design systems, brand | yes |
| [growth](plugins/growth) | SEO, AEO (AI citations), ASO, copy, CRO, experiments, pricing, launches, Reddit, Hacker News, LinkedIn, X, lifecycle email, outbound, support, success, SaaS metrics, fundraising, privacy and legal first drafts | yes |
| [ai-data-docs](plugins/ai-data-docs) | MCP server building, LLM evals, RAG, prompt engineering, multi-agent design, fine-tuning, deep research, SQL and notebook analysis, statistics, data quality, docs, office files | yes |
| [meta](plugins/meta) | Write and test your own skills and agents, agent teams (experimental), context management, decision council | yes |
| [hq](plugins/hq) | **Agency HQ**: **Ask the Lead** (type a goal; the Lead plans tasks, picks agents, runs them after you approve the plan, pauses on failures and writes a summary), a **Daily plan** (every morning the Lead holds a read-only standup and proposes the day; you approve it in one tap; code changes land on local branches and nothing is pushed until you click Open PR), a 3D office where you watch every agent work, a searchable roster, a Dispatch tab where you review a task before it runs (read-only by default), and plugin/MCP health with one-click fixes. Works on a phone. Type `/hq` | yes |
| [mcp-core](plugins/mcp-core) | 15 keyless MCP servers: Chrome DevTools, Playwright, Context7, code graph, ast-grep, Repomix, read-only SQL, mobile device control, MarkItDown, Excel, YouTube transcripts, Excalidraw, charts, shadcn/ui, icons | yes |
| [mcp-git-hosting](plugins/mcp-git-hosting) | GitHub, GitLab | no |
| [mcp-cloud](plugins/mcp-cloud) | Supabase, Kubernetes, AWS, Terraform (read-only by default) | no |
| [mcp-data-ops](plugins/mcp-data-ops) | Postgres tuning, Grafana | no |
| [mcp-workspace](plugins/mcp-workspace) | Notion, Google Workspace, Slack | no |
| [mcp-business](plugins/mcp-business) | Stripe, n8n, PostHog, Google Analytics | no |
| [mcp-research](plugins/mcp-research) | Tavily, Firecrawl, SearXNG | no |
| [mcp-creative](plugins/mcp-creative) | Penpot (open-source Figma), ComfyUI (local image/video/audio), Blender, optional Figma and fal | no |
| [media](plugins/media) | RAW→web image pipeline: develop RAW (darktable), retouch with local AI (rembg, IOPaint, Real-ESRGAN, GFPGAN), emit responsive WebP/AVIF (libvips/Sharp). A `raw-to-web` skill + keyless MCP servers. Commercial-safe licenses only | no |

The off-by-default plugins ask for a key only when you enable them. Keys you
enter are kept in your OS keychain, never in a file. Each plugin's README lists
what it needs and where to get it.

## What makes this different

- **One best version of each role.** Where five collections each had a code
  reviewer, the strongest one was kept and the other four were dropped.
- **Agents prove their findings.** Reviewers report only issues they can point
  to and explain, and they are allowed to report nothing. Implementers must
  show fresh test output before they say "done".
- **Least privilege.** Reviewers and auditors cannot edit files. Every agent
  states when to use it and when not to, so they don't fire on everything.
- **No filler.** No personas, no emoji, no invented statistics, no references
  to tools that don't exist here.
- **Tested.** All bundled scripts were run. The guard hooks have 45 test
  cases. 32 MCP servers passed a live startup handshake, and the rest need an
  account or a local app to test. `node scripts/lint.mjs` enforces the
  conventions.

## Prerequisites

Node 20+ and [uv](https://docs.astral.sh/uv/) (for Python-based MCP servers).
Some servers also need Docker or a local app (Penpot, ComfyUI, Blender). See
each plugin's README.

## Contributing

Read [CONVENTIONS.md](CONVENTIONS.md), then run `node scripts/lint.mjs` and
`claude plugin validate .` before you open a PR.

## Licence

MIT. Parts are adapted from MIT and Apache-2.0 projects. See
[NOTICE.md](NOTICE.md) and each plugin's `NOTICE.md`.
