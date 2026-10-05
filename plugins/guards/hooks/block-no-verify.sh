#!/usr/bin/env bash
# PreToolUse (Bash): block git commands that skip hooks or signing.
# Exit 0 = allow, exit 2 = block (reason on stderr).
input=$(cat)
cmd=$(printf '%s' "$input" | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{try{process.stdout.write(JSON.parse(s).tool_input.command||"")}catch{}})' 2>/dev/null)
[ -z "$cmd" ] && exit 0
# Ignore quoted text (commit messages) so "-n" or "--no-verify" inside a message is not a match.
cmd=$(printf '%s' "$cmd" | sed -E "s/'[^']*'//g; s/\"[^\"]*\"//g")

# Only inspect commands that invoke git.
printf '%s' "$cmd" | grep -Eq '(^|[;&|(` ])git[[:space:]]' || exit 0

if printf '%s' "$cmd" | grep -Eq -- '(^|[[:space:]])(--no-verify|--no-gpg-sign)([[:space:]=]|$)'; then
  echo "BLOCKED by block-no-verify: --no-verify/--no-gpg-sign skips the repo's hooks or signing. Fix whatever the hook is rejecting and run the command again without the flag." >&2
  exit 2
fi
# git commit -n is the short form of --no-verify.
if printf '%s' "$cmd" | grep -Eq -- 'git([[:space:]]+-[^[:space:]]+)*[[:space:]]+commit([[:space:]]+[^[:space:]]+)*[[:space:]]+-[a-zA-Z]*n[a-zA-Z]*([[:space:]]|$)'; then
  echo "BLOCKED by block-no-verify: 'git commit -n' skips pre-commit hooks. Fix whatever the hook is rejecting and commit without -n." >&2
  exit 2
fi
exit 0
