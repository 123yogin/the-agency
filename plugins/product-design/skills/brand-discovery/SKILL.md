---
name: brand-discovery
description: Use when creating or repositioning a brand, briefing designers or writers, capturing a voice from real writing, or making implicit founder knowledge explicit. Runs a resumable one-question-at-a-time interview across eight modules, saved to disk, ending in a brandbook and a reusable voice profile.
---

# Brand Discovery

The goal is a complete `90_SYNTHESIS.md`: a brandbook the organisation can use
to brief designers, writers and partners. The interview spans several sessions,
so answers are written to disk as you go and a later session resumes where the
last one stopped.

## Session start (every time, before any question)

1. **Check for prior progress:** look for module files and `state.json` in the
   brand-identity directory. If none, confirm the brand name, the participants
   and where to save files, then start at module 10.
2. **Read the module in progress** and its Raw section.
3. **Report in two or three sentences** which module is active, its status and
   what remains, then ask: "Continue here, or switch module?"

## Interview discipline

1. **One question at a time.** Never present a list.
2. **After each answer:** a short paraphrase, then either one deepening probe or
   close the thread. Never move on silently.
3. **Laddering:** after every "what", ask "why does that matter?" until a core
   value surfaces (usually two to four rounds).
4. **Five whys** for beliefs and positioning claims, until the root reason is on
   the table.
5. **Thin answers** (generic, jargon, vague) get a request for one concrete
   example, customer story or number.
6. **Projective techniques**, once per module, to break a plateau:
   - "If the brand were a person, how would they walk into a room?"
   - Brand obituary: "If you closed in five years, what would customers miss?"
   - Contrast: "Name a peer you admire but would never want to become. Why?"
7. **Saturation:** two consecutive probes with no new information → summarise
   and close the module.
8. **End of module:** write the module file with `## Raw` (verbatim quotes and
   examples) and `## Synthesis` (interpretation, three candidate formulations,
   open questions, contradictions between participants), then update `state.json`.

## Modules

Templates are in `references/`. Complete them in order; if the user jumps,
note the skip in `state.json`.

| File | Topic | Frameworks |
|---|---|---|
| `10_purpose-why.md` | Purpose | Sinek's Golden Circle, Lencioni |
| `20_positioning.md` | Positioning | Dunford's *Obviously Awesome*, Moore's template |
| `30_audience-niche.md` | Audience and niche | Baker's *Business of Expertise*, ICP |
| `40_personality-archetype.md` | Personality | Mark & Pearson archetypes, J. Aaker's dimensions |
| `50_voice-tone.md` | Voice and tone | Voice guidelines, plus the voice profile below |
| `60_narrative-story.md` | Narrative | Neumeier's trueline, story arc |
| `70_founder-tension.md` | Founder brands vs company brand | Enns's *Win Without Pitching* |
| `90_SYNTHESIS.md` | Brandbook | Kapferer's prism, Aaker's brand system |

## State file

```json
{
  "session": "{brand}-brand-{YYYY-MM}",
  "outputPath": "{absolute path inside the project}",
  "completedModules": [],
  "inProgressModule": "10_purpose-why.md",
  "nextModule": "20_positioning.md",
  "participants": ["founder-a"],
  "lastUpdated": "{ISO-8601}"
}
```

After each write, confirm: "Module X saved. State updated. Next: Y." When
`90_SYNTHESIS.md` is complete, add it to `completedModules` and set both
`inProgressModule` and `nextModule` to `null`.

## Multiple founders

Interview each founder separately into `founders/{participant}.md` before any
group discussion (joint sessions anchor everyone on the loudest voice). Accept
participant names of letters, digits and hyphens only; reject path separators
and `..`. Only write module files from the list above, under the agreed output
path. After all founders finish a module, write a reconciliation section:
convergences, divergences and productive tensions for a group workshop.

## Voice profile (module 50, or on its own)

When real writing exists (posts, essays, launch notes, emails that worked, docs,
site copy), derive the voice from it rather than from the interview alone:

1. Gather 5–20 recent, representative samples. Separate public voice from
   private working voice if they clearly differ.
2. Extract: rhythm and sentence length, compression vs explanation,
   capitalisation, parentheticals, question use, how sharply claims are made,
   how often numbers or mechanisms appear, transitions, and what the author
   never does.
3. Write a `VOICE PROFILE` using `references/voice-profile-schema.md`. Every
   banned move must be observable in the sources or requested by the user. If
   sources conflict, report the split instead of averaging it.

Do not store a personal voice profile in a tracked repository file unless the
user asks for that.

## Anti-patterns

- Asking questions before reading the saved state.
- Several questions in one message.
- Writing the synthesis before saturation.
- Group discussion before individual founder interviews.
- Rushing to `90_SYNTHESIS.md` in one sitting.

<!-- Adapted from affaan-m/ECC skills/brand-discovery and skills/brand-voice (MIT). -->
