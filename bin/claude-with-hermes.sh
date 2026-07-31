#!/usr/bin/env bash
# Run Claude Code with the same trusted local credential/filesystem scope as Hermes.
# This script is intentionally for this user's local machine only.
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
hermes_home="${HERMES_HOME:-$HOME/.hermes}"

if ! command -v claude >/dev/null 2>&1; then
  printf 'Claude Code CLI is not installed or is not on PATH.\n' >&2
  exit 127
fi
if [[ ! -d "$hermes_home" ]]; then
  printf 'Hermes home does not exist: %s\n' "$hermes_home" >&2
  exit 1
fi

# Import Hermes-managed environment secrets for this child process only.
# shellcheck disable=SC1090
if [[ -f "$hermes_home/.env" ]]; then
  set -a
  source "$hermes_home/.env"
  set +a
fi

# Project secrets remain local and are inherited by Claude only at runtime.
# shellcheck disable=SC1091
if [[ -f "$repo_root/.env" ]]; then
  set -a
  source "$repo_root/.env"
  set +a
fi

export HERMES_HOME="$hermes_home"
export AGYM_HERMES_CONTEXT_ROOT="$hermes_home"
export CLAUDE_CODE_HERMES_CONTEXT="$repo_root/CLAUDE.md"

# A local-only portal to Hermes state. It is ignored by Git and never copies data.
mkdir -p "$repo_root/.claude"
ln -sfn "$hermes_home" "$repo_root/.claude/hermes-home"

cd "$repo_root"
exec claude --dangerously-skip-permissions "$@"
