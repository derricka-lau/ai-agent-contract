#!/bin/bash
mkdir -p ~/.claude
cp "$(dirname "$0")/claude-settings.json" ~/.claude/settings.json
echo "Claude Code settings installed."
