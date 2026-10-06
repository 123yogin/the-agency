# hq: Agency HQ

A visual headquarters for The Agency. Watch every agent work in a 3D office,
browse everything the agency can do, send tasks to agents, and check that
plugins and MCP servers are healthy, from a desktop or a phone.

```text
/plugin install hq@the-agency
/hq
```

`/hq` starts a small local server (Node 18 or newer, nothing to install) and
opens your browser. Run it again any time; it reuses the running server.

| View | What you can do |
|---|---|
| Office | See the Lead (your main Claude session) and every subagent at a desk, named after the agent it runs as and coloured by plugin. A live feed of what each one reads, edits and runs, run history, and the Lead's to-do list. A red beacon and banner mean something needs you. Switch projects from the top bar. |
| Roster | Every agent, skill, command and MCP server in the agency, with when to use it, when not to, how often you used it in the last 30 days, and a copy button for how to call it. Search and filter. |
| Dispatch | Describe a task, pick a project, and HQ suggests the best agents and says why. Review the exact `claude -p` command before anything runs. Read-only by default. Watch progress live, cancel, and read the result with its time and cost. |
| Health | Switch plugins on and off, check every MCP server, and see which tools are missing on this computer with the command that fixes each one. |

On a phone (under 760px wide) the office becomes a list with the same data, and
the views move to a bottom tab bar. Light and dark follow your system; press
`T` to switch. Press `?` for keyboard shortcuts.

## Commands

| Command | Does |
|---|---|
| `/hq` | Start (or reuse) HQ and open it |
| `/hq lan` | Open HQ to your Wi-Fi so a phone can use it. HQ shows a QR code behind the phone button. The link carries a private key; anyone with it can see and dispatch agents. |
| `/hq status` | Print the link if HQ is running |
| `/hq stop` | Stop HQ |
| `/hq restart` | Restart (also ends LAN sharing) |

Options: `--port N` (default 8790, next free port if busy).
Autostart with every Claude Code session: set `HQ_AUTOSTART=1` in your environment.

## Safety

- Listens on 127.0.0.1 only, unless you run `/hq lan`.
- Reads Claude Code's transcripts and plugin registry; never writes to them. Its
  own state (runs, cache) lives in the plugin data folder, or `~/.claude/hq`.
- Shows tool names, file paths and command summaries, never file contents or
  tool output. Anything that looks like a key, token or password is masked.
- Every action needs a per-launch token and a same-origin request. Unknown
  `Host` headers are refused, which blocks DNS-rebinding attacks.
- Dispatch runs nothing until you press **Run it** on the Review step. Read-only
  runs cannot edit files or run shell commands. At most two runs at once.
- No network requests leave your computer. three.js and the QR generator are
  bundled.

## Tests

```bash
node --test tests/*.test.mjs
```

Covers transcript parsing (tool results never read), desk assignment, agent
routing, secret masking, the action token and cross-origin rejection, LAN keys,
roster discovery, usage counts, and the dispatch lifecycle.
