# hq: Agency HQ

A visual headquarters for The Agency. Give the Lead a goal and it plans the
work and runs the right agents for you. Watch every agent work in a 3D office,
browse everything the agency can do, send single tasks to agents, and check
that plugins and MCP servers are healthy, from a desktop or a phone.

```text
/plugin install hq@the-agency
/hq
```

`/hq` starts a small local server (Node 18 or newer, nothing to install) and
opens your browser. Run it again any time; it reuses the running server.

| View | What you can do |
|---|---|
| Ask the Lead | Type a goal in plain words. The Lead reads the project and proposes a plan of tasks, each with the agent best suited to it. Edit the plan, then approve it and the agents run on their own. See the steps below. |
| Office | See the Lead (your main Claude session) and every subagent at a desk, named after the agent it runs as and coloured by plugin. A live feed of what each one reads, edits and runs, run history, and the Lead's to-do list. A red beacon and banner mean something needs you. Switch projects from the top bar. |
| Roster | Every agent, skill, command and MCP server in the agency, with when to use it, when not to, how often you used it in the last 30 days, and a copy button for how to call it. Search and filter. |
| Dispatch | Describe a task, pick a project, and HQ suggests the best agents and says why. Review the exact `claude -p` command before anything runs. Read-only by default. Watch progress live, cancel, and read the result with its time and cost. |
| Health | Switch plugins on and off, check every MCP server, and see which tools are missing on this computer with the command that fixes each one. |

## How Ask the Lead works

1. **You set the goal.** Pick the project, whether agents may only read or may
   also edit files, and how many agents can work at once (1 to 4).
2. **The Lead plans.** A Claude session reads the project (read-only) and
   writes a plan: tasks, the agent for each, and which tasks must wait for
   others. It only picks agents you have installed.
3. **You check the plan.** Change any task's agent, rewrite its instructions,
   reorder, add or remove tasks, and choose which tasks wait for which. Nothing
   runs until you press **Approve plan**. If any task can edit files, you tick a
   box that names those tasks and the folder first.
4. **Agents do the work.** Tasks run in order of their dependencies, up to your
   limit at once. A task that waits for another gets a short summary of what
   that task found. Watch the board (Waiting, Running, Needs you, Done, Failed)
   or the agents at their desks in the Office. Cancel, retry or skip any task.
   If a task fails, the tasks that depend on it pause and HQ tells you, instead
   of carrying on without it.
5. **The Lead reports back.** When everything has finished, the same Lead
   session writes a summary: what was done, what was not, and next steps.
6. **Talk to the Lead.** Ask for more on the same job ("also add a privacy
   policy"). The Lead remembers the job, proposes extra tasks, and you approve
   them the same way.

Jobs are saved. If HQ stops while a job is running, the job comes back as
interrupted with **Pick up again**. **Stop everything** in the top bar stops all
jobs and runs that HQ started (never your own Claude Code sessions).

Each task, the plan and the summary is one `claude -p` run on your Claude plan,
so a job of three tasks costs about as much as five sessions. HQ shows the
number of runs before you approve and the real tokens and cost afterwards.

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
- Dispatch runs nothing until you press **Run it** on the Review step. Ask the
  Lead runs nothing but the read-only plan until you approve the plan. Read-only
  runs cannot edit files or run shell commands. At most four runs at once
  (`HQ_MAX_RUNS`).
- The Lead plans, summarises and answers follow-ups with read-only tools only.
- No network requests leave your computer. three.js and the QR generator are
  bundled.

## Tests

```bash
node --test tests/*.test.mjs
```

Covers transcript parsing (tool results never read), desk assignment, agent
routing, secret masking, the action token and cross-origin rejection, LAN keys,
roster discovery, usage counts, the dispatch lifecycle, and Ask the Lead: plan
parsing and repair, dependency scheduling, failure pausing, edit confirmation,
follow-ups, and recovery after a restart.
