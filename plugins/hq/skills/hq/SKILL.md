---
name: hq
description: Use when the user wants to see, visualise, monitor or operate their agents, hand a goal to a Lead that assigns agents automatically, have the Lead plan their day with a daily standup, open the agency dashboard or 3D office, check what agents are doing, browse what the agency can do, or open HQ on their phone. Starts Agency HQ and gives them the link.
---

# Agency HQ

Agency HQ is a local web dashboard for The Agency. It reads Claude Code's own
transcripts (read-only) and shows:

- **Ask the Lead**: the user types a goal; a read-only Lead session plans tasks
  and picks agents; the user edits and approves the plan; HQ runs the agents in
  dependency order and the Lead writes a summary. Failed tasks pause their
  dependents and wait for the user.
- **Daily plan**: per project, the Lead holds a read-only standup each morning
  and proposes the day's plan; nothing runs until the user approves it. Code
  changes land on local `daily/…` branches; pushing and opening a PR happen
  only when the user clicks Open PR. A read-only evening report updates the
  backlog. Runs only while HQ runs; no autostart.
- **Office**: a 3D office where the Lead (main session) and every running
  subagent sit at desks named after the agent they run as, coloured by plugin.
  A red beacon and banner mean something needs the user.
- **Roster**: every agent, skill, command and MCP server in the agency, with
  when to use it and how often it was used.
- **Dispatch**: send a task to an agent in any project. The user reviews the
  exact `claude -p` command before anything runs. Read-only by default.
- **Health**: plugin on/off switches, MCP server status, missing tools with fixes.

## Start it

Run `node "${CLAUDE_PLUGIN_ROOT}/runtime/bin/hq.mjs" start --open`, then give
the user the `Open:` URL from the output. It is idempotent: if HQ is already
running it prints the existing URL.

- Phone on the same Wi-Fi: only when the user asks, run `start --lan --open`
  and tell them HQ shows a QR code under the phone button. Say that anyone
  with the link can see and dispatch agents.
- Stop: `node "${CLAUDE_PLUGIN_ROOT}/runtime/bin/hq.mjs" stop`.
- Status: `... status`.

## Rules

- HQ only listens on 127.0.0.1 unless the user asks for LAN mode.
- Do not copy transcript contents into replies; HQ shows file paths and
  command summaries, never file contents.
- Dispatch never runs anything without the user pressing "Run it" in HQ.
- Never describe the daily plan as autonomous: only the read-only standup and
  report run by themselves; the user approves the day's work.
- Needs Node 18 or newer. If the launcher says Node is missing, pass that on.
