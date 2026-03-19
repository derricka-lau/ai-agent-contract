#!/bin/bash
set -euo pipefail

echo "=== Removing dotfiles-managed config ==="
echo "This removes ONLY files installed by install.sh."

# Check for backups
BACKUP_BASE="$HOME/.dotfiles-backup"
if [ -d "$BACKUP_BASE" ]; then
  LATEST_BACKUP=$(ls -td "$BACKUP_BASE"/*/ 2>/dev/null | head -1)
  if [ -n "$LATEST_BACKUP" ]; then
    echo "Backup found at: $LATEST_BACKUP"
    echo "After uninstall, restore with: cp ${LATEST_BACKUP}* to their original locations."
  fi
fi

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
if [ -n "${LATEST_BACKUP:-}" ]; then
  echo "NOTE: Backups still at $LATEST_BACKUP — delete manually when no longer needed."
fi
