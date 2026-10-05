# guards

PreToolUse hooks that stop the most common destructive or check-dodging moves an
agent makes. Each block prints the reason to the agent, which should then fix the
underlying problem or ask you.

| Hook | Matcher | Blocks |
|------|---------|--------|
| `block-no-verify.sh` | Bash | `git ... --no-verify`, `--no-gpg-sign`, `git commit -n` (quoted text ignored) |
| `destructive-guard.js` | Bash | `rm -r` on `/`, `~`, `$HOME`, the project or its parents, unexpanded variables, or paths outside the project (temp dirs allowed); force-push to main/master; `git reset --hard`; `git clean -fd/-fx`; `DROP DATABASE/SCHEMA/TABLE`; `TRUNCATE` sent to a DB client |
| `config-protection.js` | Write, Edit, MultiEdit | Editing an existing lint/format config or ignore file (ESLint, Prettier, Biome, Ruff, Flake8, Pylint, mypy, golangci, rustfmt, Stylelint, markdownlint, ...); turning off any TypeScript strictness flag in `tsconfig*.json`. Creating a new config is allowed. |

## Overrides

When you really do want the action, set the variable before starting Claude Code:

- `AGENCY_ALLOW_DESTRUCTIVE=1` disables `destructive-guard`
- `AGENCY_ALLOW_CONFIG_EDIT=1` disables `config-protection`

Or disable the plugin with `/plugin`.

## Requirements and tests

Needs `node` and `bash` on PATH. Run `bash tests/run.sh` (45 cases).

These hooks are a seatbelt, not a sandbox. They parse common command shapes;
an obfuscated command can get past them.
