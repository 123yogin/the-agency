# Conventions

Every file in this repo follows these rules. They are what separates it from the
collections it was distilled from.

## Layout

```
plugins/<plugin>/
  .claude-plugin/plugin.json      name, version, description, author, license
  agents/<name>.md                subagents (auto-discovered)
  skills/<name>/SKILL.md          skills, with references/ and scripts/ beside them
  commands/<name>.md              slash commands
  hooks/hooks.json                hooks; scripts referenced via ${CLAUDE_PLUGIN_ROOT}
  README.md                       what is in the plugin, one line per item
```

## Agents

```yaml
---
name: kebab-case-name            # matches the filename
description: Use when <trigger>. Not for <adjacent case → other agent>.
tools: Read, Grep, Glob, Bash    # least privilege; reviewers and auditors never get Write/Edit
model: sonnet                    # opus for architecture/hard reasoning, haiku for log/lookup work
---
```

Body order: one-paragraph mission → hard rules → workflow (numbered steps) →
output format (a literal template) → verification before reporting done.

## Skills

```yaml
---
name: kebab-case-name            # matches the directory
description: Use when <trigger>. <What it enforces, in one clause.>
---
```

A skill must change behaviour: a gate, a checklist, a template, a hard rule.
If it only describes a topic, it does not ship.

## Banned

- Emoji in headings or bodies, `vibe:`, `color:`, `emoji:` frontmatter.
- Persona fluff: names ("You are Alex"), "world-class", "Learning & Memory",
  "Success Metrics" with invented numbers.
- Invented statistics, benchmarks or outcomes. A number either cites a source or
  is labelled as an assumption/placeholder.
- "MUST BE USED for all…" style triggers that make an agent fire on everything.
- References to tools, MCP servers, scripts or skills that are not shipped here.
- Fake protocols (e.g. "query the context manager" JSON).
- Cross-references using another repo's prefix (`superpowers:`, `ecc:`) — use
  the bare skill name.
- Project-specific paths, placeholders left unfilled, promo blocks.

## Size

Agents: aim for 60–200 lines. Skills: SKILL.md under ~300 lines; push depth into
`references/`. Cut anything that does not change what Claude does.

## Attribution

Every adapted file ends with an HTML comment naming its source:

```
<!-- Adapted from <owner>/<repo> <path> (MIT). -->
```

Apache-2.0 sources keep their `LICENSE.txt` in the skill directory and the file
notes "Modified by the-agency". All sources are listed in `NOTICE.md`.
Never copy from: anthropics/skills docx, pdf, pptx, xlsx (proprietary), or any
repo without an MIT/Apache licence.
