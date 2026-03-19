#!/bin/bash

SCRIPT_DIR="$(dirname "$0")"

# --- Claude Code ---
mkdir -p ~/.claude
cp "$SCRIPT_DIR/claude-settings.json" ~/.claude/settings.json
echo "Claude Code settings installed."

if ! command -v claude &> /dev/null; then
  echo "Installing Claude Code CLI..."
  npm install -g @anthropic-ai/claude-code
  echo "Claude Code CLI installed."
else
  echo "Claude Code CLI already installed."
fi

# --- Codex CLI ---
mkdir -p ~/.codex
cp "$SCRIPT_DIR/codex-config.toml" ~/.codex/config.toml
echo "Codex config installed."

mkdir -p ~/.local/bin
cp "$SCRIPT_DIR/codex-safe" ~/.local/bin/codex-safe
chmod +x ~/.local/bin/codex-safe
echo "codex-safe wrapper installed to ~/.local/bin/codex-safe"

# Ensure ~/.local/bin is on PATH
if ! echo "$PATH" | grep -q "$HOME/.local/bin"; then
  echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
  echo "Added ~/.local/bin to PATH in ~/.bashrc"
fi
