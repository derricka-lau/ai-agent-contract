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
echo "--- GitHub Copilot ---"
mkdir -p ~/.copilot/instructions ~/.copilot/memory ~/.copilot/prompts ~/.copilot/skills
cp "$SCRIPT_DIR"/copilot/instructions/*.instructions.md ~/.copilot/instructions/
cp "$SCRIPT_DIR/copilot/copilot-instructions.md" ~/.copilot/copilot-instructions.md
cp "$SCRIPT_DIR/copilot/AGENTS.md" ~/.copilot/AGENTS.md
cp "$SCRIPT_DIR/copilot/MEMORY.md" ~/.copilot/MEMORY.md
cp "$SCRIPT_DIR/copilot/memory/user_role.md" ~/.copilot/memory/user_role.md
cp "$SCRIPT_DIR/prompts/workflow.md" ~/.copilot/prompts/workflow.md

if [ -d "$SCRIPT_DIR/skills" ]; then
  for skill_dir in "$SCRIPT_DIR"/skills/*/; do
    skill_name="$(basename "$skill_dir")"
    mkdir -p ~/.copilot/skills/"$skill_name"
    cp "$skill_dir"SKILL.md ~/.copilot/skills/"$skill_name"/SKILL.md
  done
fi

echo "Copilot CLI global instructions, AGENTS.md, memory, workflow prompts, and skills installed."

install_npm_cli "@github/copilot" "Copilot" " Run 'copilot' then '/login' to authenticate."