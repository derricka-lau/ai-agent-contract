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
safe_rm ~/.claude/prompts/workflow.md
for agent_file in ~/.claude/agents/*.md; do
  [ -f "$agent_file" ] && safe_rm "$agent_file"
done
echo "Claude Code done."

# Codex CLI
safe_rm ~/.codex/config.toml
safe_rm ~/.codex/AGENTS.md
safe_rm ~/.codex/MEMORY.md
safe_rm ~/.codex/hooks.json
safe_rm ~/.codex/memory/user_role.md
safe_rm ~/.codex/prompts/workflow.md
for agent_file in ~/.codex/agents/*.toml; do
  [ -f "$agent_file" ] && safe_rm "$agent_file"
done
for hook_file in ~/.codex/hooks/*.sh; do
  [ -f "$hook_file" ] && safe_rm "$hook_file"
done
safe_rm ~/.local/bin/codex-safe
echo "Codex done."

# Copilot (extension + CLI)
for instruction_file in ~/.copilot/instructions/*.instructions.md; do
  [ -f "$instruction_file" ] && safe_rm "$instruction_file"
done
safe_rm ~/.copilot/copilot-instructions.md
safe_rm ~/.copilot/AGENTS.md
safe_rm ~/.copilot/MEMORY.md
safe_rm ~/.copilot/memory/user_role.md
safe_rm ~/.copilot/prompts/workflow.md
echo "Copilot done."

# Skills (all three tools)
for skill_file in ~/.claude/skills/*/SKILL.md ~/.codex/skills/*/SKILL.md ~/.agents/skills/*/SKILL.md ~/.copilot/skills/*/SKILL.md; do
  [ -f "$skill_file" ] && safe_rm "$skill_file"
done
echo "Skills done."

# Git
safe_rm ~/.gitconfig-github
echo "Git done (NOTE: ~/.gitconfig NOT removed — only the GitHub include file)."

# Clean up manifest
rm -f "$MANIFEST"

echo ""
echo "=== Done. ==="
echo "NOTE: Claude Code CLI (npm package) was NOT removed. Run 'npm uninstall -g @anthropic-ai/claude-code' to remove it."
if [ -f "/Library/Application Support/ClaudeCode/managed-settings.json" ]; then
  echo "NOTE: System-level managed settings not removed (requires sudo). Run:"
  echo "  sudo rm \"/Library/Application Support/ClaudeCode/managed-settings.json\""
fi
if [ -n "$LATEST_BACKUP" ]; then
  echo "NOTE: Backups still at $LATEST_BACKUP — delete manually when no longer needed."
fi
