#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# --- Preflight checks ---
echo "=== Preflight checks ==="
if ! command -v git &> /dev/null; then
  echo "ERROR: Missing required tool: git"
  echo "Install git before running this script."
  exit 1
fi
echo "Git found."

run_with_privilege() {
  if [ "$(id -u)" -eq 0 ]; then
    "$@"
  elif command -v sudo &> /dev/null; then
    sudo "$@"
  else
    echo "ERROR: This script needs root/sudo privileges to install missing packages."
    exit 1
  fi
}

ensure_node_npm() {
  if command -v node &> /dev/null && command -v npm &> /dev/null; then
    echo "Node/npm found."
    return
  fi

  echo "Node/npm not found. Installing via apt-get..."
  if ! command -v apt-get &> /dev/null; then
    echo "ERROR: node/npm are missing and apt-get is unavailable in this environment."
    exit 1
  fi

  run_with_privilege apt-get update
  run_with_privilege apt-get install -y nodejs npm

  if ! command -v node &> /dev/null || ! command -v npm &> /dev/null; then
    echo "ERROR: node/npm installation failed."
    exit 1
  fi

  echo "Node/npm installed."
}

ensure_node_npm

install_npm_cli() {
  local package="$1"
  local label="$2"
  local post_message="${3:-}"

  echo "Installing/updating ${label} CLI to latest..."
  npm install -g "${package}@latest"
  echo "${label} CLI installed (latest).${post_message}"
}

echo ""
echo "=== Installing dotfiles ==="
echo "NOTE: All existing config files will be overwritten (not merged)."

# --- Backup existing config ---
BACKUP_DIR="$HOME/.dotfiles-backup/$(date +%Y%m%d-%H%M%S)"
BACKED_UP=false
for f in \
  ~/.claude/settings.json \
  ~/.claude/CLAUDE.md \
  ~/.claude/MEMORY.md \
  ~/.claude/memory/user_role.md \
  ~/.claude/prompts/workflow.md \
  ~/.claude/agents/*.md \
  ~/.codex/config.toml \
  ~/.codex/AGENTS.md \
  ~/.codex/MEMORY.md \
  ~/.codex/memory/user_role.md \
  ~/.codex/prompts/workflow.md \
  ~/.codex/agents/*.toml \
  ~/.copilot/instructions/*.instructions.md \
  ~/.copilot/copilot-instructions.md \
  ~/.copilot/AGENTS.md \
  ~/.copilot/MEMORY.md \
  ~/.copilot/memory/user_role.md \
  ~/.copilot/prompts/workflow.md \
  ~/.claude/skills/*/SKILL.md \
  ~/.agents/skills/*/SKILL.md \
  ~/.copilot/skills/*/SKILL.md \
  ~/.gitconfig \
  ~/.gitconfig-github; do
  if [ -f "$f" ]; then
    if [ "$BACKED_UP" = false ]; then
      mkdir -p "$BACKUP_DIR"
      echo "Backing up existing config to $BACKUP_DIR"
      BACKED_UP=true
    fi
    cp "$f" "$BACKUP_DIR/"
  fi
done
if [ "$BACKED_UP" = true ]; then
  echo "Backup complete. Restore with: cp $BACKUP_DIR/* to their original locations."
fi

# --- Claude Code ---
echo ""
echo "--- Claude Code ---"
mkdir -p ~/.claude/memory ~/.claude/prompts ~/.claude/agents
cp "$SCRIPT_DIR/claude/settings.json" ~/.claude/settings.json
cp "$SCRIPT_DIR/claude/CLAUDE.md" ~/.claude/CLAUDE.md
cp "$SCRIPT_DIR/claude/MEMORY.md" ~/.claude/MEMORY.md
cp "$SCRIPT_DIR/claude/memory/user_role.md" ~/.claude/memory/user_role.md
cp "$SCRIPT_DIR/prompts/workflow.md" ~/.claude/prompts/workflow.md
# Subagents
for agent_file in "$SCRIPT_DIR"/claude/agents/*.md; do
  [ -f "$agent_file" ] && cp "$agent_file" ~/.claude/agents/
done
echo "Claude Code settings, instructions, memory, and subagents installed."

# Skills are installed per-tool after all tool sections (see below)

# Managed settings (system-level, disables --dangerously-skip-permissions)
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

# --- Codex CLI ---
echo ""
echo "--- Codex CLI ---"
mkdir -p ~/.codex/memory ~/.codex/prompts ~/.codex/agents
cp "$SCRIPT_DIR/codex/config.toml" ~/.codex/config.toml
cp "$SCRIPT_DIR/codex/AGENTS.md" ~/.codex/AGENTS.md
cp "$SCRIPT_DIR/codex/MEMORY.md" ~/.codex/MEMORY.md
cp "$SCRIPT_DIR/codex/memory/user_role.md" ~/.codex/memory/user_role.md
cp "$SCRIPT_DIR/prompts/workflow.md" ~/.codex/prompts/workflow.md
# Subagents
for agent_file in "$SCRIPT_DIR"/codex/agents/*.toml; do
  [ -f "$agent_file" ] && cp "$agent_file" ~/.codex/agents/
done
echo "Codex config, instructions, memory, workflow prompts, and subagents installed."

mkdir -p ~/.local/bin
cp "$SCRIPT_DIR/codex-safe" ~/.local/bin/codex-safe
chmod +x ~/.local/bin/codex-safe
echo "codex-safe wrapper installed."

install_npm_cli "@openai/codex" "Codex"

# --- GitHub Copilot (VS Code extension + CLI) ---
echo ""
echo "--- GitHub Copilot ---"
# VS Code extension instructions
mkdir -p ~/.copilot/instructions ~/.copilot/memory ~/.copilot/prompts
cp "$SCRIPT_DIR"/copilot/instructions/*.instructions.md ~/.copilot/instructions/
echo "Copilot VS Code extension instructions installed."
# CLI global instructions + AGENTS.md
cp "$SCRIPT_DIR/copilot/copilot-instructions.md" ~/.copilot/copilot-instructions.md
cp "$SCRIPT_DIR/copilot/AGENTS.md" ~/.copilot/AGENTS.md
cp "$SCRIPT_DIR/copilot/MEMORY.md" ~/.copilot/MEMORY.md
cp "$SCRIPT_DIR/copilot/memory/user_role.md" ~/.copilot/memory/user_role.md
cp "$SCRIPT_DIR/prompts/workflow.md" ~/.copilot/prompts/workflow.md
echo "Copilot CLI global instructions, AGENTS.md, memory, and workflow prompts installed."

install_npm_cli "@github/copilot" "Copilot" " Run 'copilot' then '/login' to authenticate."

# --- Skills (shared across all three tools) ---
echo ""
echo "--- Skills ---"
if [ -d "$SCRIPT_DIR/skills" ]; then
  SKILL_NAMES=""
  for skill_dir in "$SCRIPT_DIR"/skills/*/; do
    skill_name="$(basename "$skill_dir")"
    SKILL_NAMES="$SKILL_NAMES $skill_name"

    # Claude Code: ~/.claude/skills/<name>/SKILL.md
    mkdir -p ~/.claude/skills/"$skill_name"
    cp "$skill_dir"SKILL.md ~/.claude/skills/"$skill_name"/SKILL.md

    # Codex CLI: ~/.agents/skills/<name>/SKILL.md
    mkdir -p ~/.agents/skills/"$skill_name"
    cp "$skill_dir"SKILL.md ~/.agents/skills/"$skill_name"/SKILL.md

    # GitHub Copilot: ~/.copilot/skills/<name>/SKILL.md
    mkdir -p ~/.copilot/skills/"$skill_name"
    cp "$skill_dir"SKILL.md ~/.copilot/skills/"$skill_name"/SKILL.md
  done
  echo "Skills installed to Claude Code, Codex CLI, and Copilot:$SKILL_NAMES"
fi

# --- Git config ---
echo ""
echo "--- Git ---"
cp "$SCRIPT_DIR/gitconfig" ~/.gitconfig
cp "$SCRIPT_DIR/gitconfig-github" ~/.gitconfig-github
echo "Git config installed (Cardiff email default, GitHub noreply for github.com remotes)."

# Detect the user's actual shell rc file
case "$SHELL" in
  */zsh)  SHELL_RC="$HOME/.zshrc" ;;
  */bash) SHELL_RC="$HOME/.bashrc" ;;
  *)      SHELL_RC="$HOME/.profile" ;;
esac
touch "$SHELL_RC"

# Ensure ~/.local/bin is on PATH
if ! echo "$PATH" | grep -q "$HOME/.local/bin"; then
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$SHELL_RC"
  echo "Added ~/.local/bin to PATH in $SHELL_RC"
fi

# Ensure COPILOT_CUSTOM_INSTRUCTIONS_DIRS is set
if ! grep -q 'COPILOT_CUSTOM_INSTRUCTIONS_DIRS' "$SHELL_RC" 2>/dev/null; then
  echo 'export COPILOT_CUSTOM_INSTRUCTIONS_DIRS="$HOME/.copilot/instructions"' >> "$SHELL_RC"
  echo "Added COPILOT_CUSTOM_INSTRUCTIONS_DIRS to $SHELL_RC"
fi

# --- Verification ---
echo ""
echo "=== Verification ==="
PASS=0
FAIL=0

# 1. Claude Code deny rules
if grep -q 'Read(\*\*/.env)' ~/.claude/settings.json 2>/dev/null; then
  echo "  [PASS] Claude Code deny rules active"
  PASS=$((PASS+1))
else
  echo "  [FAIL] Claude Code deny rules missing"
  FAIL=$((FAIL+1))
fi

# 2. Codex permissions profile
if grep -q 'default_permissions = "global_lockdown"' ~/.codex/config.toml 2>/dev/null; then
  echo "  [PASS] Codex global_lockdown profile active"
  PASS=$((PASS+1))
else
  echo "  [FAIL] Codex global_lockdown profile missing"
  FAIL=$((FAIL+1))
fi

# 3. codex-safe wrapper
if [ -x ~/.local/bin/codex-safe ]; then
  echo "  [PASS] codex-safe wrapper installed and executable"
  PASS=$((PASS+1))
else
  echo "  [FAIL] codex-safe wrapper missing or not executable"
  FAIL=$((FAIL+1))
fi

# 4. codex-safe blocks --profile override (must exit 64)
EXIT_CODE=0
~/.local/bin/codex-safe --profile foo --help 2>/dev/null || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 64 ]; then
  echo "  [PASS] codex-safe blocks --profile override (exit 64)"
  PASS=$((PASS+1))
else
  echo "  [FAIL] codex-safe did not exit 64 (got $EXIT_CODE)"
  FAIL=$((FAIL+1))
fi

# 5. Copilot instructions present (VS Code extension + CLI)
if [ -f ~/.copilot/instructions/global-contract.instructions.md ] && [ -f ~/.copilot/copilot-instructions.md ]; then
  echo "  [PASS] Copilot instructions present (extension + CLI)"
  PASS=$((PASS+1))
else
  echo "  [FAIL] Copilot instructions missing"
  FAIL=$((FAIL+1))
fi

# 6. Shared memory and workflow prompts installed (all three tools)
if [ -f ~/.claude/MEMORY.md ] && [ -f ~/.claude/memory/user_role.md ] && [ -f ~/.claude/prompts/workflow.md ] && \
   [ -f ~/.codex/MEMORY.md ] && [ -f ~/.codex/memory/user_role.md ] && [ -f ~/.codex/prompts/workflow.md ] && \
   [ -f ~/.copilot/MEMORY.md ] && [ -f ~/.copilot/memory/user_role.md ] && [ -f ~/.copilot/prompts/workflow.md ]; then
  echo "  [PASS] Shared memory and workflow prompts installed (Claude, Codex, Copilot)"
  PASS=$((PASS+1))
else
  echo "  [FAIL] Shared memory/workflow prompts missing for one or more tools"
  FAIL=$((FAIL+1))
fi

# 7. Git conditional email
if grep -q 'hasconfig:remote' ~/.gitconfig 2>/dev/null; then
  echo "  [PASS] Git conditional include for GitHub noreply active"
  PASS=$((PASS+1))
else
  echo "  [FAIL] Git conditional include missing"
  FAIL=$((FAIL+1))
fi

# 8. Skills installed across all three tools
CLAUDE_SKILLS=$(ls -1d ~/.claude/skills/*/SKILL.md 2>/dev/null | wc -l | tr -d ' ')
CODEX_SKILLS=$(ls -1d ~/.agents/skills/*/SKILL.md 2>/dev/null | wc -l | tr -d ' ')
COPILOT_SKILLS=$(ls -1d ~/.copilot/skills/*/SKILL.md 2>/dev/null | wc -l | tr -d ' ')
if [ "$CLAUDE_SKILLS" -ge 7 ] && [ "$CODEX_SKILLS" -ge 7 ] && [ "$COPILOT_SKILLS" -ge 7 ]; then
  echo "  [PASS] Skills installed: Claude($CLAUDE_SKILLS) Codex($CODEX_SKILLS) Copilot($COPILOT_SKILLS)"
  PASS=$((PASS+1))
else
  echo "  [FAIL] Skills missing: Claude($CLAUDE_SKILLS) Codex($CODEX_SKILLS) Copilot($COPILOT_SKILLS) — expected 7 each"
  FAIL=$((FAIL+1))
fi

# 9. Subagents (Claude Code + Codex)
if [ -f ~/.claude/agents/reviewer.md ] && [ -f ~/.codex/agents/reviewer.toml ]; then
  echo "  [PASS] Subagents installed (Claude + Codex)"
  PASS=$((PASS+1))
else
  echo "  [FAIL] Subagents missing (Claude and/or Codex)"
  FAIL=$((FAIL+1))
fi

# 10. Copilot AGENTS.md
if [ -f ~/.copilot/AGENTS.md ]; then
  echo "  [PASS] Copilot AGENTS.md installed"
  PASS=$((PASS+1))
else
  echo "  [FAIL] Copilot AGENTS.md missing"
  FAIL=$((FAIL+1))
fi

# 11. Claude Code managed settings (bypass disabled)
if [ -f "/Library/Application Support/ClaudeCode/managed-settings.json" ] && grep -q 'disableBypassPermissionsMode' "/Library/Application Support/ClaudeCode/managed-settings.json" 2>/dev/null; then
  echo "  [PASS] Claude Code bypass permissions disabled (managed settings)"
  PASS=$((PASS+1))
else
  echo "  [WARN] Claude Code managed settings not installed (optional — requires sudo)"
fi

echo ""
echo "Results: $PASS passed, $FAIL failed"

if [ "$FAIL" -gt 0 ]; then
  echo "WARNING: Some checks failed. Review output above."
fi

# --- Write manifest of installed file hashes ---
MANIFEST="$HOME/.dotfiles-manifest"
: > "$MANIFEST"
for f in \
  ~/.claude/settings.json \
  ~/.claude/CLAUDE.md \
  ~/.claude/MEMORY.md \
  ~/.claude/memory/user_role.md \
  ~/.claude/prompts/workflow.md \
  ~/.claude/agents/reviewer.md \
  ~/.codex/config.toml \
  ~/.codex/AGENTS.md \
  ~/.codex/MEMORY.md \
  ~/.codex/memory/user_role.md \
  ~/.codex/prompts/workflow.md \
  ~/.codex/agents/reviewer.toml \
  ~/.local/bin/codex-safe \
  ~/.copilot/copilot-instructions.md \
  ~/.copilot/AGENTS.md \
  ~/.copilot/instructions/global-contract.instructions.md \
  ~/.copilot/MEMORY.md \
  ~/.copilot/memory/user_role.md \
  ~/.copilot/prompts/workflow.md \
  ~/.gitconfig \
  ~/.gitconfig-github \
  "/Library/Application Support/ClaudeCode/managed-settings.json"; do
  if [ -f "$f" ]; then
    shasum -a 256 "$f" >> "$MANIFEST"
  fi
done
# Add all skill files to manifest
for skill_file in ~/.claude/skills/*/SKILL.md ~/.agents/skills/*/SKILL.md ~/.copilot/skills/*/SKILL.md; do
  if [ -f "$skill_file" ]; then
    shasum -a 256 "$skill_file" >> "$MANIFEST"
  fi
done
echo "Manifest written to $MANIFEST"

echo ""
echo "=== Done. Claude Code, Codex CLI, and Copilot are configured. ==="
