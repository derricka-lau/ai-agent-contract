#!/usr/bin/env bash
set -euo pipefail

remove_path() {
  local target="$1"

  if [ -e "$target" ]; then
    rm -rf "$target"
    printf 'Removed %s\n' "$target"
  fi
}

remove_path "$HOME/.claude"
remove_path "$HOME/.codex"
remove_path "$HOME/.copilot"
remove_path "$HOME/.agents/skills"
remove_path "$HOME/.local/share/ai-agent-contract"
remove_path "$HOME/.local/bin/codex-safe"
remove_path "$HOME/.local/bin/copilot-safe"
remove_path "$HOME/.git-hooks"
remove_path "$HOME/.ai-agent-contract-manifest"

if git config --global --get core.hooksPath >/dev/null 2>&1; then
  git config --global --unset core.hooksPath
  printf 'Unset global core.hooksPath\n'
fi

printf 'Uninstall complete. Shell rc exports and git identity files are left for manual review.\n'
