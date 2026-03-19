#!/bin/bash
set -euo pipefail

MANIFEST="$HOME/.dotfiles-manifest"

echo "=== Removing dotfiles-managed config ==="
echo "Only files matching the installed manifest will be removed."
echo "Modified files will be skipped (not deleted)."

# Check for backups
BACKUP_BASE="$HOME/.dotfiles-backup"
LATEST_BACKUP=""
if [ -d "$BACKUP_BASE" ]; then
  LATEST_BACKUP=$(ls -td "$BACKUP_BASE"/*/ 2>/dev/null | head -1)
  if [ -n "$LATEST_BACKUP" ]; then
    echo "Backup found at: $LATEST_BACKUP"
  fi
fi

echo ""
read -p "Continue? (y/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

# Safe remove: only delete if hash matches manifest
safe_rm() {
  local file="$1"
  if [ ! -f "$file" ]; then
    return
  fi

  if [ -f "$MANIFEST" ]; then
    INSTALLED_HASH=$(grep "$file" "$MANIFEST" 2>/dev/null | awk '{print $1}')
    CURRENT_HASH=$(shasum -a 256 "$file" 2>/dev/null | awk '{print $1}')
    if [ -n "$INSTALLED_HASH" ] && [ "$INSTALLED_HASH" != "$CURRENT_HASH" ]; then
      echo "  [SKIP] $file — modified since install (not deleted)"
      return
    fi
  fi

  rm -f "$file"
  echo "  [DEL]  $file"
}

echo ""

# Claude Code
safe_rm ~/.claude/settings.json
safe_rm ~/.claude/CLAUDE.md
safe_rm ~/.claude/MEMORY.md
safe_rm ~/.claude/memory/user_role.md
echo "Claude Code done."

# Codex CLI
safe_rm ~/.codex/config.toml
safe_rm ~/.codex/AGENTS.md
safe_rm ~/.local/bin/codex-safe
echo "Codex done."

# Copilot
safe_rm ~/.copilot/instructions/global-contract.instructions.md
safe_rm ~/.copilot/instructions/php.instructions.md
safe_rm ~/.copilot/instructions/python.instructions.md
safe_rm ~/.copilot/instructions/typescript.instructions.md
echo "Copilot done."

# Git
safe_rm ~/.gitconfig-github
echo "Git done (NOTE: ~/.gitconfig NOT removed — only the GitHub include file)."

# Clean up manifest
rm -f "$MANIFEST"

echo ""
echo "=== Done. ==="
echo "NOTE: Claude Code CLI (npm package) was NOT removed. Run 'npm uninstall -g @anthropic-ai/claude-code' to remove it."
if [ -n "$LATEST_BACKUP" ]; then
  echo "NOTE: Backups still at $LATEST_BACKUP — delete manually when no longer needed."
fi
