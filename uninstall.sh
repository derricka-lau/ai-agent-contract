#!/bin/bash
set -euo pipefail

echo "=== Removing dotfiles-managed config ==="
echo "This removes ONLY files installed by install.sh."
echo ""

read -p "Continue? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

# Claude Code
rm -f ~/.claude/settings.json
rm -f ~/.claude/CLAUDE.md
rm -f ~/.claude/MEMORY.md
rm -f ~/.claude/memory/user_role.md
echo "Removed Claude Code config."

# Codex CLI
rm -f ~/.codex/config.toml
rm -f ~/.codex/AGENTS.md
rm -f ~/.local/bin/codex-safe
echo "Removed Codex config and codex-safe."

# Copilot
rm -f ~/.copilot/instructions/global-contract.instructions.md
rm -f ~/.copilot/instructions/php.instructions.md
rm -f ~/.copilot/instructions/python.instructions.md
rm -f ~/.copilot/instructions/typescript.instructions.md
echo "Removed Copilot instructions."

echo ""
echo "=== Done. All dotfiles-managed config removed. ==="
echo "NOTE: Claude Code CLI (npm package) was NOT removed. Run 'npm uninstall -g @anthropic-ai/claude-code' to remove it."
