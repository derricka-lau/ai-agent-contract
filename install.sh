#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# --- Preflight checks ---
echo "=== Preflight checks ==="
MISSING=""
command -v git &> /dev/null || MISSING="$MISSING git"
command -v node &> /dev/null || MISSING="$MISSING node"
command -v npm &> /dev/null || MISSING="$MISSING npm"
if [ -n "$MISSING" ]; then
  echo "ERROR: Missing required tools:$MISSING"
  echo "Install them before running this script."
  exit 1
fi
echo "All prerequisites found."

echo ""
echo "=== Installing dotfiles ==="
echo "NOTE: All existing config files will be overwritten (not merged)."

# --- Backup existing config ---
BACKUP_DIR="$HOME/.dotfiles-backup/$(date +%Y%m%d-%H%M%S)"
BACKED_UP=false
for f in ~/.claude/settings.json ~/.claude/CLAUDE.md ~/.codex/config.toml ~/.codex/AGENTS.md ~/.gitconfig ~/.gitconfig-github; do
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
mkdir -p ~/.claude/memory
cp "$SCRIPT_DIR/claude/settings.json" ~/.claude/settings.json
cp "$SCRIPT_DIR/claude/CLAUDE.md" ~/.claude/CLAUDE.md
cp "$SCRIPT_DIR/claude/MEMORY.md" ~/.claude/MEMORY.md
cp "$SCRIPT_DIR/claude/memory/user_role.md" ~/.claude/memory/user_role.md
echo "Claude Code settings, instructions, and memory installed."

if ! command -v claude &> /dev/null; then
  echo "Installing Claude Code CLI..."
  npm install -g @anthropic-ai/claude-code
  echo "Claude Code CLI installed."
else
  echo "Claude Code CLI already installed."
fi

# --- Codex CLI ---
echo ""
echo "--- Codex CLI ---"
mkdir -p ~/.codex
cp "$SCRIPT_DIR/codex/config.toml" ~/.codex/config.toml
cp "$SCRIPT_DIR/codex/AGENTS.md" ~/.codex/AGENTS.md
echo "Codex config and instructions installed."

mkdir -p ~/.local/bin
cp "$SCRIPT_DIR/codex-safe" ~/.local/bin/codex-safe
chmod +x ~/.local/bin/codex-safe
echo "codex-safe wrapper installed."

# --- GitHub Copilot ---
echo ""
echo "--- GitHub Copilot ---"
mkdir -p ~/.copilot/instructions
cp "$SCRIPT_DIR"/copilot/instructions/*.instructions.md ~/.copilot/instructions/
echo "Copilot global and language-specific instructions installed."

# --- Git config ---
echo ""
echo "--- Git ---"
cp "$SCRIPT_DIR/gitconfig" ~/.gitconfig
cp "$SCRIPT_DIR/gitconfig-github" ~/.gitconfig-github
echo "Git config installed (Cardiff email default, GitHub noreply for github.com remotes)."

# Ensure ~/.local/bin is on PATH
if ! echo "$PATH" | grep -q "$HOME/.local/bin"; then
  SHELL_RC="$HOME/.bashrc"
  [ -f "$HOME/.zshrc" ] && SHELL_RC="$HOME/.zshrc"
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> "$SHELL_RC"
  echo "Added ~/.local/bin to PATH in $SHELL_RC"
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

# 5. Copilot instructions present
if [ -f ~/.copilot/instructions/global-contract.instructions.md ]; then
  echo "  [PASS] Copilot global instructions present"
  PASS=$((PASS+1))
else
  echo "  [FAIL] Copilot global instructions missing"
  FAIL=$((FAIL+1))
fi

# 6. Git conditional email
if grep -q 'hasconfig:remote' ~/.gitconfig 2>/dev/null; then
  echo "  [PASS] Git conditional include for GitHub noreply active"
  PASS=$((PASS+1))
else
  echo "  [FAIL] Git conditional include missing"
  FAIL=$((FAIL+1))
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
  ~/.codex/config.toml \
  ~/.codex/AGENTS.md \
  ~/.local/bin/codex-safe \
  ~/.copilot/instructions/global-contract.instructions.md \
  ~/.copilot/instructions/php.instructions.md \
  ~/.copilot/instructions/python.instructions.md \
  ~/.copilot/instructions/typescript.instructions.md \
  ~/.gitconfig \
  ~/.gitconfig-github; do
  if [ -f "$f" ]; then
    shasum -a 256 "$f" >> "$MANIFEST"
  fi
done
echo "Manifest written to $MANIFEST"

echo ""
echo "=== Done. Claude Code, Codex CLI, and Copilot are configured. ==="
