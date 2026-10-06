# Agency HQ — spec

A visual headquarters for The Agency: watch every agent work in a 3D office,
browse everything the agency can do, and dispatch work, from a desktop or a phone.
Base: humaedihume/kantor-agent (MIT) Node runtime, forked and rebuilt in English.
Ideas borrowed (not code): Agent Office (control, "needs you" beacons, 2D lite mode),
agents-warehouse (task routing, approve-before-run, status filters).

## Ease-of-use requirements (the point of the product)

1. One install, zero config: `/plugin install hq@the-agency`, then `/hq` starts the
   server if needed and opens the browser. No npm install, no build step, no accounts.
   Node >= 18 only. three.js is vendored (MIT, keep its LICENSE).
2. It shows something useful immediately: if there is no activity yet, the office
   shows the roster seated at idle desks plus a one-line "Run your first task" prompt.
3. Plain English everywhere; desks are labelled with the real agent names
   (e.g. "code-reviewer · engineering"), coloured by plugin (department).
4. Every action is one obvious click; dangerous ones show what will happen first.
5. Works on a phone: below 760px the 3D scene becomes a 2D list ("lite") with the
   same data; bottom tab bar; no horizontal scroll at 390px.
6. Light and dark themes (follow the OS, with a toggle). Keyboard shortcuts with a `?` help sheet.

## Views (tabs)

- **Office** (default): 3D floor. Lead desk = the main Claude session; subagent runs
  sit at desks named after the agent type they ran as. Live activity feed (file reads,
  edits, commands, in plain words), run history, per-agent cards with status pills
  (working / waiting for you / done / failed). Project switcher covering every project
  in ~/.claude/projects (default: most recent). A red beacon + banner when a dispatched
  run is waiting for approval or a session is waiting on the user.
- **Roster**: every agent, skill, command and MCP server installed from the-agency
  (read from the installed plugin cache + ~/.claude settings), grouped by plugin, with
  its "use when" line, enabled state, times used (from transcripts), search and filters,
  and a copy button for how to invoke it.
- **Dispatch**: task box -> agent picker with "Auto" routing (score agents by
  matching the task against their descriptions; show the top 3 with reasons) ->
  project picker -> mode: **Read-only** (default: Edit/Write/NotebookEdit disallowed)
  or **Can edit files** (explicit toggle with a warning line) -> **Review** step that
  shows the exact command -> **Run**. Runs `claude -p` headless in the chosen project
  directory with `--output-format stream-json`; stream progress into the Office (a
  worker walks to a desk) and the run log. Cancel button. Max 2 concurrent runs
  (configurable). Result shows the final answer, duration and cost/tokens if reported.
  Saved runs go to the history.
- **Health**: plugins from the-agency with enable/disable toggles (via
  `claude plugin enable|disable`), MCP servers with connected/failed status (parse
  `claude mcp list`, cached, refresh button), prerequisites check (node, uv, uvx,
  docker, ast-grep) each with the exact fix command and a copy button.

## Safety

- Bind 127.0.0.1 by default. `/hq lan` opts into LAN with a random token; print the
  URL with the token and show it as a QR code in the page (generate QR locally, no CDN).
- Every mutating endpoint (dispatch, cancel, plugin toggle) requires a per-launch
  random token sent as a header; reject cross-origin requests.
- Never read or display file contents from transcripts beyond the tool name and the
  file path / command summary (truncate commands, redact anything that looks like a
  secret: sk-, ghp_, xox, AKIA, Bearer, password=).
- Read-only access to ~/.claude data. The only writes are HQ's own state under
  ${CLAUDE_PLUGIN_DATA} (or ~/.claude/hq if unset).
- No telemetry, no external network requests at runtime.

## Packaging

plugins/hq/
  .claude-plugin/plugin.json   commands/hq.md   skills/hq/SKILL.md (when the user asks to
  see/visualise/operate agents, start HQ)   hooks/hooks.json (optional autostart, off by
  default)   runtime/ (server + public assets)   README.md   NOTICE.md (kantor-agent MIT,
  three.js MIT)   tests/ (node --test for parsing, routing, redaction, auth).

## 1.1: Ask the Lead

The primary tab. A goal becomes a job:
planning (read-only Lead run) → plan-ready (editable cards; nothing runs) → running
(tasks as dispatch runs with `--agent`, in `depends_on` order, within the job's
parallel limit; dependents get a short summary of their dependencies' results) →
summarizing (the Lead resumed with `--resume <session>`) → done.
A failed/cancelled task blocks its dependents and pauses the job (Needs you);
retry, skip or "finish and summarise" resolve it. Follow-ups resume the Lead,
which proposes extra tasks that need approval again. Edit-mode tasks need an
explicit confirmation naming them and the folder. Jobs persist in `jobs.json`;
active ones come back as interrupted after a restart. "Stop everything" stops
all jobs and HQ-started runs. Pure rules live in `lib/plan.mjs`, orchestration
in `lib/lead.mjs`.

## Daily plan (1.2.0)

Per project, off by default. Only the read-only standup (default 09:00) and the
read-only evening report (default 18:00, or when the day's job finishes) run on
a schedule; the schedule lives in the HQ server (minute tick, catch-up once on
start, never twice a day) and there is no login autostart. The standup becomes
an Ask the Lead job; nothing runs until the user approves it. Enforced in code:
deny-list for deploy/push/merge/PR/post/send/spend/secrets (moved to "For you to
do"), blocked tools on every daily run (`git push`, `git merge`, `gh`, `vercel`,
publish, curl/wget), code tasks in a fresh worktree on a local `daily/<date>-<slug>`
branch committed by HQ, dirty or non-git repos refuse code tasks, daily caps on
task runs and spend (then a free local report), global pause. Open PR shows the
exact push and `gh pr create` commands and runs them only on confirm. Backlog
lives in HQ's data dir, seeded read-only on first enable, edited in the
dashboard, updated by the report.
