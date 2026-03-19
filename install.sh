#!/bin/bash

# Install Claude Code deny rules
mkdir -p ~/.claude
cp "$(dirname "$0")/claude-settings.json" ~/.claude/settings.json
echo "Claude Code settings installed."

# Install Claude Code CLI
if ! command -v claude &> /dev/null; then
  echo "Installing Claude Code CLI..."
  npm install -g @anthropic-ai/claude-code
  echo "Claude Code CLI installed."
else
  echo "Claude Code CLI already installed."
fi
