#!/usr/bin/env bash
# SessionStart: inject the using-the-agency skill so skills are checked before acting.
set -eu

root="${CLAUDE_PLUGIN_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
skill="$root/skills/using-the-agency/SKILL.md"
[ -f "$skill" ] || exit 0

# Drop the frontmatter block (between the first two '---' lines).
body=$(awk 'f>=2{print} /^---$/{f++}' "$skill")

esc() {
  s=$1
  s=${s//\\/\\\\}
  s=${s//\"/\\\"}
  s=${s//$'\n'/\\n}
  s=${s//$'\r'/}
  s=${s//$'\t'/\\t}
  printf '%s' "$s"
}

printf '{"hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$(esc "$body")"
