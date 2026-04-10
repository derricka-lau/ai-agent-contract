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
echo "--- Codex CLI ---"
mkdir -p ~/.codex/memory ~/.codex/prompts ~/.codex/agents ~/.codex/hooks ~/.codex/skills ~/.agents/skills ~/.local/bin
cp "$SCRIPT_DIR/codex/config.toml" ~/.codex/config.toml
cp "$SCRIPT_DIR/codex/AGENTS.md" ~/.codex/AGENTS.md
cp "$SCRIPT_DIR/codex/MEMORY.md" ~/.codex/MEMORY.md
cp "$SCRIPT_DIR/codex/hooks.json" ~/.codex/hooks.json
cp "$SCRIPT_DIR/codex/memory/user_role.md" ~/.codex/memory/user_role.md
cp "$SCRIPT_DIR/prompts/workflow.md" ~/.codex/prompts/workflow.md

for agent_file in "$SCRIPT_DIR"/codex/agents/*.toml; do
  [ -f "$agent_file" ] && cp "$agent_file" ~/.codex/agents/
done

for hook_file in "$SCRIPT_DIR"/codex/hooks/*.sh; do
  if [ -f "$hook_file" ]; then
    cp "$hook_file" ~/.codex/hooks/
    chmod +x ~/.codex/hooks/"$(basename "$hook_file")"
  fi
done

if [ -d "$SCRIPT_DIR/skills" ]; then
  for skill_dir in "$SCRIPT_DIR"/skills/*/; do
    skill_name="$(basename "$skill_dir")"
    mkdir -p ~/.codex/skills/"$skill_name"
    cp "$skill_dir"SKILL.md ~/.codex/skills/"$skill_name"/SKILL.md
    mkdir -p ~/.agents/skills/"$skill_name"
    cp "$skill_dir"SKILL.md ~/.agents/skills/"$skill_name"/SKILL.md
  done
fi

cp "$SCRIPT_DIR/codex-safe" ~/.local/bin/codex-safe
chmod +x ~/.local/bin/codex-safe

echo "Codex config, instructions, hooks, memory, workflow prompts, subagents, wrapper, and skills installed."

install_npm_cli "@openai/codex" "Codex"