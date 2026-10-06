---
description: Open Agency HQ, the visual dashboard for your agents (start, stop, status, lan, restart)
argument-hint: "[start|stop|status|lan|restart]"
allowed-tools: Bash(node:*)
---

Run Agency HQ's launcher and report what it prints.

Arguments: $ARGUMENTS

1. Pick the command from the arguments. No argument means `start`.
   - `start` (or nothing): `node "${CLAUDE_PLUGIN_ROOT}/runtime/bin/hq.mjs" start --open`
   - `lan`: `node "${CLAUDE_PLUGIN_ROOT}/runtime/bin/hq.mjs" start --lan --open`
   - `stop`, `status`, `restart`: `node "${CLAUDE_PLUGIN_ROOT}/runtime/bin/hq.mjs" <command>`
   Pass `--port N` through if the user gave one.
2. Reply in two or three lines: the `Open:` URL, and how to stop it (`/hq stop`).
   For `lan`, also give the `Phone:` URL and say plainly that anyone on the same
   network who has that link can see the agents and dispatch tasks.
3. If the launcher prints an error (for example Node is missing or older than 18),
   repeat it as written and stop.

Never start LAN mode unless the user asked for `lan`.
