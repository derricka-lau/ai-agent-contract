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
  ~/.codex/hooks.json \
  ~/.codex/memory/user_role.md \
  ~/.codex/prompts/workflow.md \
  ~/.codex/agents/*.toml \
  ~/.codex/hooks/*.sh \
  ~/.copilot/instructions/*.instructions.md \
  ~/.copilot/copilot-instructions.md \
  ~/.copilot/AGENTS.md \
  ~/.copilot/MEMORY.md \
  ~/.copilot/memory/user_role.md \
  ~/.copilot/prompts/workflow.md \
  ~/.claude/skills/*/SKILL.md \
  ~/.codex/skills/*/SKILL.md \
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

bash "$SCRIPT_DIR/install-claude.sh"
bash "$SCRIPT_DIR/install-codex.sh"
bash "$SCRIPT_DIR/install-copilot.sh"

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

# 2. Codex baseline config
if grep -q 'model = "gpt-5.4"' ~/.codex/config.toml 2>/dev/null && grep -q 'codex_hooks = true' ~/.codex/config.toml 2>/dev/null; then
  echo "  [PASS] Codex baseline config active"
  PASS=$((PASS+1))
else
  echo "  [FAIL] Codex baseline config missing expected defaults"
  FAIL=$((FAIL+1))
fi

# 3. Codex permissions profile
if grep -q 'default_permissions = "global_lockdown"' ~/.codex/config.toml 2>/dev/null; then
  echo "  [PASS] Codex global_lockdown profile active"
  PASS=$((PASS+1))
else
  echo "  [FAIL] Codex global_lockdown profile missing"
  FAIL=$((FAIL+1))
fi

# 4. codex-safe wrapper
if [ -x ~/.local/bin/codex-safe ]; then
  echo "  [PASS] codex-safe wrapper installed and executable"
  PASS=$((PASS+1))
else
  echo "  [FAIL] codex-safe wrapper missing or not executable"
  FAIL=$((FAIL+1))
fi

# 5. codex-safe blocks unapproved profiles (must exit 64)
EXIT_CODE=0
~/.local/bin/codex-safe --profile foo --help 2>/dev/null || EXIT_CODE=$?
if [ "$EXIT_CODE" -eq 64 ]; then
  echo "  [PASS] codex-safe blocks unapproved profiles (exit 64)"
  PASS=$((PASS+1))
else
  echo "  [FAIL] codex-safe did not exit 64 (got $EXIT_CODE)"
  FAIL=$((FAIL+1))
fi

# 6. Codex hooks installed
if [ -f ~/.codex/hooks.json ] && [ -x ~/.codex/hooks/pre-command-guard.sh ] && [ -x ~/.codex/hooks/stop-reminder.sh ]; then
  echo "  [PASS] Codex hooks installed"
  PASS=$((PASS+1))
else
  echo "  [FAIL] Codex hooks missing"
  FAIL=$((FAIL+1))
fi

# 7. Copilot instructions present (VS Code extension + CLI)
if [ -f ~/.copilot/instructions/global-contract.instructions.md ] && [ -f ~/.copilot/instructions/backend.instructions.md ] && [ -f ~/.copilot/instructions/frontend.instructions.md ] && [ -f ~/.copilot/instructions/tests.instructions.md ] && [ -f ~/.copilot/copilot-instructions.md ]; then
  echo "  [PASS] Copilot instructions present (extension + CLI)"
  PASS=$((PASS+1))
else
  echo "  [FAIL] Copilot instructions missing"
  FAIL=$((FAIL+1))
fi

# 8. Shared memory and workflow prompts installed (all three tools)
if [ -f ~/.claude/MEMORY.md ] && [ -f ~/.claude/memory/user_role.md ] && [ -f ~/.claude/prompts/workflow.md ] && \
   [ -f ~/.codex/MEMORY.md ] && [ -f ~/.codex/memory/user_role.md ] && [ -f ~/.codex/prompts/workflow.md ] && \
   [ -f ~/.copilot/MEMORY.md ] && [ -f ~/.copilot/memory/user_role.md ] && [ -f ~/.copilot/prompts/workflow.md ]; then
  echo "  [PASS] Shared memory and workflow prompts installed (Claude, Codex, Copilot)"
  PASS=$((PASS+1))
else
  echo "  [FAIL] Shared memory/workflow prompts missing for one or more tools"
  FAIL=$((FAIL+1))
fi

# 9. Git conditional email
if grep -q 'hasconfig:remote' ~/.gitconfig 2>/dev/null; then
  echo "  [PASS] Git conditional include for GitHub noreply active"
  PASS=$((PASS+1))
else
  echo "  [FAIL] Git conditional include missing"
  FAIL=$((FAIL+1))
fi

# 10. Skills installed across all three tools
CLAUDE_SKILLS=$(ls -1d ~/.claude/skills/*/SKILL.md 2>/dev/null | wc -l | tr -d ' ')
CODEX_SKILLS=$(ls -1d ~/.codex/skills/*/SKILL.md 2>/dev/null | wc -l | tr -d ' ')
CODEX_COMPAT_SKILLS=$(ls -1d ~/.agents/skills/*/SKILL.md 2>/dev/null | wc -l | tr -d ' ')
COPILOT_SKILLS=$(ls -1d ~/.copilot/skills/*/SKILL.md 2>/dev/null | wc -l | tr -d ' ')
if [ "$CLAUDE_SKILLS" -ge 12 ] && [ "$CODEX_SKILLS" -ge 12 ] && [ "$COPILOT_SKILLS" -ge 12 ]; then
  echo "  [PASS] Skills installed: Claude($CLAUDE_SKILLS) Codex($CODEX_SKILLS) Copilot($COPILOT_SKILLS) CompatibilityMirror($CODEX_COMPAT_SKILLS)"
  PASS=$((PASS+1))
else
  echo "  [FAIL] Skills missing: Claude($CLAUDE_SKILLS) Codex($CODEX_SKILLS) Copilot($COPILOT_SKILLS) — expected at least 12 each"
  FAIL=$((FAIL+1))
fi

# 11. Subagents (Claude Code + Codex)
if [ -f ~/.claude/agents/reviewer.md ] && [ -f ~/.claude/agents/architect.md ] && [ -f ~/.claude/agents/implementer.md ] && [ -f ~/.claude/agents/security-reviewer.md ] && [ -f ~/.codex/agents/explorer.toml ] && [ -f ~/.codex/agents/implementer.toml ] && [ -f ~/.codex/agents/reviewer.toml ] && [ -f ~/.codex/agents/security.toml ]; then
  echo "  [PASS] Subagents installed (Claude architect/implementer/reviewer/security-reviewer + Codex explorer/implementer/reviewer/security)"
  PASS=$((PASS+1))
else
  echo "  [FAIL] Subagents missing (Claude and/or Codex agents)"
  FAIL=$((FAIL+1))
fi

# 12. Copilot AGENTS.md
if [ -f ~/.copilot/AGENTS.md ]; then
  echo "  [PASS] Copilot AGENTS.md installed"
  PASS=$((PASS+1))
else
  echo "  [FAIL] Copilot AGENTS.md missing"
  FAIL=$((FAIL+1))
fi

# 13. Claude Code managed settings (bypass disabled)
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
  ~/.codex/config.toml \
  ~/.codex/AGENTS.md \
  ~/.codex/MEMORY.md \
  ~/.codex/hooks.json \
  ~/.codex/memory/user_role.md \
  ~/.codex/prompts/workflow.md \
  ~/.local/bin/codex-safe \
  ~/.copilot/copilot-instructions.md \
  ~/.copilot/AGENTS.md \
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

for instruction_file in ~/.copilot/instructions/*.instructions.md; do
  if [ -f "$instruction_file" ]; then
    shasum -a 256 "$instruction_file" >> "$MANIFEST"
  fi
done

for agent_file in ~/.claude/agents/*.md ~/.codex/agents/*.toml; do
  if [ -f "$agent_file" ]; then
    shasum -a 256 "$agent_file" >> "$MANIFEST"
  fi
done

for hook_file in ~/.codex/hooks/*.sh; do
  if [ -f "$hook_file" ]; then
    shasum -a 256 "$hook_file" >> "$MANIFEST"
  fi
done

# Add all skill files to manifest
for skill_file in ~/.claude/skills/*/SKILL.md ~/.codex/skills/*/SKILL.md ~/.agents/skills/*/SKILL.md ~/.copilot/skills/*/SKILL.md; do
  if [ -f "$skill_file" ]; then
    shasum -a 256 "$skill_file" >> "$MANIFEST"
  fi
done
echo "Manifest written to $MANIFEST"

echo ""
echo "=== Done. Claude Code, Codex CLI, and Copilot are configured. ==="
