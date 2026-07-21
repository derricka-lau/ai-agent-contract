#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

log() {
  printf '%s\n' "$1"
}

need_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    log "ERROR: missing required command: $1"
    exit 1
  fi
}

shell_rc_path() {
  case "${SHELL:-}" in
    */zsh) printf '%s\n' "$HOME/.zshrc" ;;
    */bash) printf '%s\n' "$HOME/.bashrc" ;;
    *) printf '%s\n' "$HOME/.profile" ;;
  esac
}

verify_installed() {
  local pass=0
  local fail=0

  check() {
    local label="$1"
    shift

    if "$@" >/dev/null 2>&1; then
      log "  [PASS] $label"
      pass=$((pass + 1))
    else
      log "  [FAIL] $label"
      fail=$((fail + 1))
    fi
  }

  log ""
  log "=== Verification ==="
  check "Install ledger written" test -f "$HOME/.local/share/ai-agent-contract/install-state.json"
  check "Copilot instructions installed" test -f "$HOME/.copilot/instructions/global-contract.instructions.md"
  check "Copilot hook installed" test -x "$HOME/.copilot/hooks/pre-tool-guard.sh"
  check "Claude instructions installed" test -f "$HOME/.claude/CLAUDE.md"
  check "Claude deny rules installed" grep -Fq 'Read(**/.env.local)' "$HOME/.claude/settings.json"
  check "Claude deterministic hook installed" test -x "$HOME/.claude/hooks/pre-tool-guard.sh"
  check "Codex config installed" test -f "$HOME/.codex/config.toml"
  check "Codex permission profile installed" grep -Fq 'default_permissions = "contract-workspace"' "$HOME/.codex/config.toml"
  check "Codex sensitive-file deny installed" grep -Fq '"**/.env" = "deny"' "$HOME/.codex/config.toml"
  check "Shared guard installed" test -x "$HOME/.local/share/ai-agent-contract/guard.js"
  check "Runtime profile metadata installed" test -f "$HOME/.local/share/ai-agent-contract/runtime-profiles.json"
  check "Role agents installed" test -f "$HOME/.copilot/agents/security-reviewer.agent.md"
  check "Skills installed" test -f "$HOME/.copilot/skills/php-cakephp/SKILL.md"
  check "Git hooks installed" test -x "$HOME/.git-hooks/pre-commit"
  check "copilot-safe wrapper installed" test -x "$HOME/.local/bin/copilot-safe"
  check "codex-safe wrapper installed" test -x "$HOME/.local/bin/codex-safe"

  local hook_output
  hook_output="$(printf '%s' '{"tool_name":"readFile","tool_input":{"path":".env.local"}}' | "$HOME/.copilot/hooks/pre-tool-guard.sh")"
  if [[ "$hook_output" == *'"permissionDecision":"deny"'* ]]; then
    log "  [PASS] Copilot hook denies .env.local"
    pass=$((pass + 1))
  else
    log "  [FAIL] Copilot hook denies .env.local"
    fail=$((fail + 1))
  fi

  log ""
  log "Results: $pass passed, $fail failed"
  if [ "$fail" -gt 0 ]; then
    exit 1
  fi
}

main() {
  log "=== Preflight checks ==="
  need_command git
  need_command node
  need_command npm
  need_command mktemp

  npm ci --ignore-scripts --no-audit --no-fund
  node "$SCRIPT_DIR/scripts/generate.js" --check
  node "$SCRIPT_DIR/scripts/doctor.js"

  local generated_dir
  generated_dir="$(mktemp -d)"
  trap 'rm -rf "${generated_dir:-}"' EXIT
  node "$SCRIPT_DIR/scripts/generate.js" --out "$generated_dir"

  log ""
  log "=== Installing ai-agent-contract ==="
  node "$SCRIPT_DIR/scripts/managed-files.js" install \
    --repo-root "$SCRIPT_DIR" \
    --generated-root "$generated_dir" \
    --home "$HOME" \
    --shell-rc "$(shell_rc_path)"

  verify_installed

  log ""
  log "=== Done. Configuration is installed and verified. ==="
  log "Tool CLIs are intentionally not installed or upgraded; manage their versions separately."
}

main "$@"
