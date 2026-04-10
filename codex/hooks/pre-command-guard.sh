#!/usr/bin/env bash
set -euo pipefail

input="$(cat)"
cmd="$({
  printf '%s' "$input"
} | node -e 'let data = ""; process.stdin.on("data", (chunk) => data += chunk); process.stdin.on("end", () => { try { const parsed = JSON.parse(data); process.stdout.write((parsed.tool_input && parsed.tool_input.command) || ""); } catch { process.exit(0); } });')"

case "$cmd" in
  *"rm -rf /"*|*"sudo rm -rf"*|*"chmod -R 777 "*|*"git reset --hard"*|*"git checkout -- "*)
    echo "Blocked dangerous command" >&2
    exit 2
    ;;
esac

exit 0