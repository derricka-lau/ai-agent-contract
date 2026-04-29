#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FAILURES=0

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  FAILURES=$((FAILURES + 1))
}

require_file() {
  local file="$1"

  if [ ! -f "$ROOT/$file" ]; then
    fail "$file is missing"
  fi
}

require_pattern() {
  local file="$1"
  local pattern="$2"

  if ! grep -Fq -- "$pattern" "$ROOT/$file"; then
    fail "$file missing required policy text: $pattern"
  fi
}

require_hook_denies() {
  local label="$1"
  local payload="$2"
  local output

  output="$(printf '%s' "$payload" | bash "$ROOT/copilot/hooks/pre-tool-guard.sh")"
  if [[ "$output" != *'"permissionDecision":"deny"'* ]]; then
    fail "Copilot hook did not deny $label"
  fi
}

require_hook_allows() {
  local label="$1"
  local payload="$2"
  local output

  output="$(printf '%s' "$payload" | bash "$ROOT/copilot/hooks/pre-tool-guard.sh")"
  if [[ -n "$output" ]]; then
    fail "Copilot hook unexpectedly blocked $label"
  fi
}

policy_files=(
  core/DECISION_LEDGER.md
  core/SENSITIVE_FILE_POLICY.md
  claude/CLAUDE.md
  codex/AGENTS.md
  copilot/AGENTS.md
  copilot/copilot-instructions.md
  copilot/instructions/global-contract.instructions.md
)

for file in "${policy_files[@]}"; do
  require_file "$file"
done

decision_files=(
  core/DECISION_LEDGER.md
  claude/CLAUDE.md
  codex/AGENTS.md
  copilot/AGENTS.md
  copilot/copilot-instructions.md
  copilot/instructions/global-contract.instructions.md
)

decision_patterns=(
  'Decision type:'
  'Affected surface:'
  'Risk check:'
  '- Security:'
  '- Observability:'
  '- Rollback:'
  'Validation:'
)

for file in "${decision_files[@]}"; do
  for pattern in "${decision_patterns[@]}"; do
    require_pattern "$file" "$pattern"
  done
done

sensitive_instruction_files=(
  core/SENSITIVE_FILE_POLICY.md
  claude/CLAUDE.md
  codex/AGENTS.md
  copilot/AGENTS.md
  copilot/copilot-instructions.md
  copilot/instructions/global-contract.instructions.md
)

sensitive_patterns=(
  '.env.local'
  '.env.test'
  '.envrc'
  'settings_local.php'
  'app_local.php'
  '*.pem'
  'id_ed25519'
  '.aws/credentials'
  '.azure/*'
)

for file in "${sensitive_instruction_files[@]}"; do
  for pattern in "${sensitive_patterns[@]}"; do
    require_pattern "$file" "$pattern"
  done
done

require_pattern claude/settings.json 'Read(**/.env.test)'
require_pattern claude/settings.json 'Edit(**/.env.test)'
require_pattern claude/settings.json 'Read(**/app_local.php)'
require_pattern claude/settings.json 'Edit(**/app_local.php)'

require_pattern codex/config.toml '"**/.env.test" = "none"'
require_pattern codex/config.toml '"**/app_local.php" = "none"'
require_pattern codex/config.toml '"**/*.pem" = "none"'
require_pattern codex/config.toml '"~/.aws/credentials" = "none"'

require_pattern copilot/hooks/policy.json '"PreToolUse"'
require_pattern copilot/hooks/policy.json '"command"'
require_pattern copilot/hooks/pre-tool-guard.sh 'Blocked sensitive file access by local policy hook'

require_hook_denies '.env.local read' '{"tool_name":"readFile","tool_input":{"path":".env.local"}}'
require_hook_denies 'app_local.php edit' '{"tool_name":"editFiles","tool_input":{"files":["config/app_local.php"]}}'
require_hook_denies 'dangerous shell command' '{"tool_name":"runTerminalCommand","tool_input":{"command":"git reset --hard HEAD"}}'
require_hook_allows '.env.example read' '{"tool_name":"readFile","tool_input":{"path":".env.example"}}'
require_hook_allows 'safe source file read' '{"tool_name":"readFile","tool_input":{"path":"src/Controller/AppController.php"}}'

if [ "$FAILURES" -gt 0 ]; then
  printf '\nCore policy check failed with %s failure(s).\n' "$FAILURES" >&2
  exit 1
fi

printf 'Core policy check passed.\n'
