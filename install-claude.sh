#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

install_npm_cli() {
  local package="$1"
  local label="$2"
  local post_message="${3:-}"

  echo "Installing/updating ${label} CLI to latest..."
  npm install -g "${package}@latest"
  echo "${label} CLI installed (latest).${post_message}"
}

echo ""
echo "--- Claude Code ---"
mkdir -p ~/.claude/memory ~/.claude/prompts ~/.claude/agents ~/.claude/skills
cp "$SCRIPT_DIR/claude/settings.json" ~/.claude/settings.json
cp "$SCRIPT_DIR/claude/CLAUDE.md" ~/.claude/CLAUDE.md
cp "$SCRIPT_DIR/claude/MEMORY.md" ~/.claude/MEMORY.md
cp "$SCRIPT_DIR/claude/memory/user_role.md" ~/.claude/memory/user_role.md
cp "$SCRIPT_DIR/prompts/workflow.md" ~/.claude/prompts/workflow.md

for agent_file in "$SCRIPT_DIR"/claude/agents/*.md; do
  [ -f "$agent_file" ] && cp "$agent_file" ~/.claude/agents/
done

if [ -d "$SCRIPT_DIR/skills" ]; then
  for skill_dir in "$SCRIPT_DIR"/skills/*/; do
    skill_name="$(basename "$skill_dir")"
    mkdir -p ~/.claude/skills/"$skill_name"
    cp "$skill_dir"SKILL.md ~/.claude/skills/"$skill_name"/SKILL.md
  done
fi

echo "Claude Code settings, instructions, memory, subagents, and skills installed."

MANAGED_DIR="/Library/Application Support/ClaudeCode"
MANAGED_FILE="$MANAGED_DIR/managed-settings.json"
if [ "$(uname)" = "Darwin" ]; then
  if [ -w "$MANAGED_DIR" ] 2>/dev/null || [ -w "$(dirname "$MANAGED_DIR")" ]; then
    mkdir -p "$MANAGED_DIR"
    cp "$SCRIPT_DIR/claude/managed-settings.json" "$MANAGED_FILE"
    echo "Claude Code managed settings installed (bypass permissions disabled)."
  else
    echo "NOTE: Installing managed settings requires sudo."
    echo "  Run: sudo mkdir -p \"$MANAGED_DIR\" && sudo cp \"$SCRIPT_DIR/claude/managed-settings.json\" \"$MANAGED_FILE\""
    echo "  This disables --dangerously-skip-permissions at the system level."
  fi
fi

install_npm_cli "@anthropic-ai/claude-code" "Claude Code"