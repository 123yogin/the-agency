#!/usr/bin/env bash
# Feeds sample PreToolUse payloads to each guard and checks the exit code.
# Usage: bash plugins/guards/tests/run.sh
set -u
H="$(cd "$(dirname "$0")/../hooks" && pwd)"
T="$(mktemp -d)"
trap 'rm -rf "$T"' EXIT
P="$T/proj"
mkdir -p "$P" && cd "$P" || exit 1
git init -q -b main
echo '{"rules":{}}' > .eslintrc.json
printf '{\n "compilerOptions": {\n  "strict": true,\n  "target": "es2022"\n }\n}\n' > tsconfig.json

pass=0; fail=0
t() {
  local exp=$1 h=$2 json=$3 rc
  case $h in
    *.js) printf '%s' "$json" | node "$H/$h" >/dev/null 2>&1; rc=$? ;;
    *)    printf '%s' "$json" | bash "$H/$h" >/dev/null 2>&1; rc=$? ;;
  esac
  if [ "$rc" = "$exp" ]; then pass=$((pass + 1)); else fail=$((fail + 1)); echo "FAIL want=$exp got=$rc $h :: $json"; fi
}
q() { python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$1"; }
B() { printf '{"tool_name":"Bash","cwd":"%s","tool_input":{"command":%s}}' "$P" "$(q "$1")"; }
W() { printf '{"tool_name":"%s","cwd":"%s","tool_input":%s}' "$1" "$P" "$2"; }

# block-no-verify
t 2 block-no-verify.sh "$(B 'git commit --no-verify -m wip')"
t 2 block-no-verify.sh "$(B 'git commit -nm wip')"
t 2 block-no-verify.sh "$(B 'git commit -m wip -n')"
t 2 block-no-verify.sh "$(B 'git push --no-verify')"
t 2 block-no-verify.sh "$(B 'cd x && git commit --no-gpg-sign -m a')"
t 0 block-no-verify.sh "$(B 'git commit -m "explain --no-verify and -n usage"')"
t 0 block-no-verify.sh "$(B 'git commit --amend --no-edit')"
t 0 block-no-verify.sh "$(B 'npm test -- --no-verify')"
t 0 block-no-verify.sh "$(B 'git log -n 5')"
t 0 block-no-verify.sh '{"tool_name":"Bash","tool_input":{}}'

# destructive-guard
t 2 destructive-guard.js "$(B 'rm -rf /')"
t 2 destructive-guard.js "$(B 'rm -rf ~')"
t 2 destructive-guard.js "$(B 'sudo rm -fr $HOME/')"
t 2 destructive-guard.js "$(B 'rm -rf ..')"
t 2 destructive-guard.js "$(B 'rm -rf /Users/someone/other')"
t 2 destructive-guard.js "$(B 'rm -r --force .')"
t 2 destructive-guard.js "$(B 'rm -rf $BUILD_DIR')"
t 0 destructive-guard.js "$(B 'rm -rf node_modules dist')"
t 0 destructive-guard.js "$(B 'rm -rf /tmp/scratch-123')"
t 0 destructive-guard.js "$(B 'rm file.txt')"
t 2 destructive-guard.js "$(B 'git push --force origin main')"
t 2 destructive-guard.js "$(B 'git push -f origin master')"
t 2 destructive-guard.js "$(B 'git push origin +main')"
t 2 destructive-guard.js "$(B 'git push --force-with-lease')"
t 0 destructive-guard.js "$(B 'git push --force-with-lease origin feature/x')"
t 0 destructive-guard.js "$(B 'git push origin main')"
t 2 destructive-guard.js "$(B 'git reset --hard HEAD~1')"
t 0 destructive-guard.js "$(B 'git reset --soft HEAD~1')"
t 2 destructive-guard.js "$(B 'git clean -fdx')"
t 0 destructive-guard.js "$(B 'git clean -n')"
t 2 destructive-guard.js "$(B 'psql $DB -c "DROP TABLE users"')"
t 2 destructive-guard.js "$(B 'echo "drop database prod;" | mysql')"
t 0 destructive-guard.js "$(B 'grep -rn "drop" src/')"
t 0 destructive-guard.js "$(B 'ls -la && echo done')"
AGENCY_ALLOW_DESTRUCTIVE=1 t 0 destructive-guard.js "$(B 'git reset --hard')"
git checkout -q -b feature/x
t 0 destructive-guard.js "$(B 'git push --force-with-lease')"
git checkout -q main 2>/dev/null || git checkout -q -b main

# config-protection
t 2 config-protection.js "$(W Edit "{\"file_path\":\"$P/.eslintrc.json\",\"old_string\":\"{}\",\"new_string\":\"{\\\"no-unused-vars\\\":\\\"off\\\"}\"}")"
t 0 config-protection.js "$(W Write "{\"file_path\":\"$P/.prettierrc\",\"content\":\"{}\"}")"
t 2 config-protection.js "$(W Edit "{\"file_path\":\"$P/tsconfig.json\",\"old_string\":\"\\\"strict\\\": true\",\"new_string\":\"\\\"strict\\\": false\"}")"
t 2 config-protection.js "$(W Write "{\"file_path\":\"$P/tsconfig.json\",\"content\":\"{\\\"compilerOptions\\\":{\\\"target\\\":\\\"es2022\\\"}}\"}")"
t 0 config-protection.js "$(W Edit "{\"file_path\":\"$P/tsconfig.json\",\"old_string\":\"\\\"target\\\": \\\"es2022\\\"\",\"new_string\":\"\\\"target\\\": \\\"es2023\\\"\"}")"
t 2 config-protection.js "$(W MultiEdit "{\"file_path\":\"$P/tsconfig.json\",\"edits\":[{\"old_string\":\"x\",\"new_string\":\"\\\"noImplicitAny\\\": false\"}]}")"
t 0 config-protection.js "$(W Edit "{\"file_path\":\"$P/src/app.ts\",\"old_string\":\"a\",\"new_string\":\"b\"}")"
t 0 config-protection.js "$(W Edit "{\"file_path\":\"$P/vite.config.ts\",\"old_string\":\"a\",\"new_string\":\"b\"}")"
AGENCY_ALLOW_CONFIG_EDIT=1 t 0 config-protection.js "$(W Edit "{\"file_path\":\"$P/.eslintrc.json\",\"old_string\":\"a\",\"new_string\":\"b\"}")"

echo "pass=$pass fail=$fail"
[ "$fail" = 0 ]
