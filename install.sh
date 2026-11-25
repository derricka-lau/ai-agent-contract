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

verify_prompt_installed() {
  local git_hooks="$1"
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
  log "=== Prompt verification ==="
  check "Install ledger written" test -f "$HOME/.local/share/ai-agent-contract/install-state.json"
  check "Copilot instructions installed" test -f "$HOME/.copilot/instructions/global-contract.instructions.md"
  check "Claude instructions installed" test -f "$HOME/.claude/CLAUDE.md"
  check "Codex instructions installed" test -f "$HOME/.codex/AGENTS.md"
  check "Antigravity plugin manifest installed" test -f "$HOME/.gemini/config/plugins/ai-agent-contract/plugin.json"
  check "Antigravity contract rules installed" test -f "$HOME/.gemini/config/plugins/ai-agent-contract/rules/AGENTS.md"
  check "Shared skills installed" test -f "$HOME/.agents/skills/php-cakephp/SKILL.md"
  check "Coach mode skill installed" test -f "$HOME/.agents/skills/coach-mode/SKILL.md"
  if [[ "$git_hooks" == true ]]; then
    check "Git commit-msg hook installed" test -x "$HOME/.git-hooks/commit-msg"
  fi

  log ""
  log "Results: $pass passed, $fail failed"
  if [[ "$fail" -gt 0 ]]; then
    exit 1
  fi
}

verify_installed() {
  local git_hooks="$1"
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
  check "Codex sensitive-file hook installed" test -f "$HOME/.codex/hooks.json"
  check "Antigravity plugin manifest installed" test -f "$HOME/.gemini/config/plugins/ai-agent-contract/plugin.json"
  check "Antigravity contract rules installed" test -f "$HOME/.gemini/config/plugins/ai-agent-contract/rules/AGENTS.md"
  check "Antigravity hooks.json installed" test -f "$HOME/.gemini/config/plugins/ai-agent-contract/hooks.json"
  check "Antigravity deterministic hook installed" test -x "$HOME/.gemini/config/plugins/ai-agent-contract/hooks/pre-tool-guard.sh"
  check "Shared guard installed" test -x "$HOME/.local/share/ai-agent-contract/guard.js"
  check "Shared skills installed" test -f "$HOME/.agents/skills/php-cakephp/SKILL.md"
  check "Coach mode skill installed" test -f "$HOME/.agents/skills/coach-mode/SKILL.md"
  if [[ "$git_hooks" == true ]]; then
    check "Git commit-msg hook installed" test -x "$HOME/.git-hooks/commit-msg"
  fi

  local hook_output
  hook_output="$(printf '%s' '{"tool_name":"readFile","tool_input":{"path":".env.local"}}' | "$HOME/.copilot/hooks/pre-tool-guard.sh")"
  if [[ "$hook_output" == *'"permissionDecision":"deny"'* ]]; then
    log "  [PASS] Copilot hook denies .env.local"
    pass=$((pass + 1))
  else
    log "  [FAIL] Copilot hook denies .env.local"
    fail=$((fail + 1))
  fi

  local agy_output
  agy_output="$(printf '%s' '{"toolCall":{"name":"read_file","args":{"Path":".env.local"}}}' | "$HOME/.gemini/config/plugins/ai-agent-contract/hooks/pre-tool-guard.sh")"
  if [[ "$agy_output" == *'"decision":"deny"'* ]]; then
    log "  [PASS] Antigravity hook denies .env.local"
    pass=$((pass + 1))
  else
    log "  [FAIL] Antigravity hook denies .env.local"
    fail=$((fail + 1))
  fi

  log ""
  log "Results: $pass passed, $fail failed"
  if [ "$fail" -gt 0 ]; then
    exit 1
  fi
}

main() {
  local profile="prompt"
  local git_hooks="false"
  while [[ "$#" -gt 0 ]]; do
    case "$1" in
      --profile)
        if [[ "$#" -lt 2 ]]; then
          log "ERROR: --profile requires prompt or hardened"
          exit 1
        fi
        profile="$2"
        shift 2
        ;;
      --git-hooks)
        git_hooks="true"
        shift
        ;;
      *)
        log "ERROR: unknown option: $1"
        log "Usage: ./install.sh [--profile prompt|hardened] [--git-hooks]"
        exit 1
        ;;
    esac
  done

  if [[ "$profile" != prompt && "$profile" != hardened ]]; then
    log "ERROR: invalid profile: $profile"
    log "Usage: ./install.sh [--profile prompt|hardened] [--git-hooks]"
    exit 1
  fi

  log "=== Selected install profile: $profile (git-hooks: $git_hooks) ==="
  log "=== Preflight checks ==="
  need_command git
  need_command node
  need_command npm
  need_command mktemp

  npm ci --ignore-scripts --no-audit --no-fund
  node "$SCRIPT_DIR/scripts/generate.js" --profile "$profile" --check
  if [[ "$profile" == hardened ]]; then
    node "$SCRIPT_DIR/scripts/doctor.js"
  else
    log "Skipping sensitive-file guard doctor for prompt profile"
  fi

  local generated_dir
  generated_dir="$(mktemp -d)"
  trap 'rm -rf "${generated_dir:-}"' EXIT
  node "$SCRIPT_DIR/scripts/generate.js" --profile "$profile" --out "$generated_dir"

  log ""
  log "=== Installing ai-agent-contract ==="
  node "$SCRIPT_DIR/scripts/managed-files.js" install \
    --repo-root "$SCRIPT_DIR" \
    --generated-root "$generated_dir" \
    --home "$HOME" \
    --shell-rc "$(shell_rc_path)" \
    --profile "$profile" \
    --git-hooks "$git_hooks"

  if [[ "$profile" == prompt ]]; then
    verify_prompt_installed "$git_hooks"
  else
    verify_installed "$git_hooks"
  fi

  log ""
  log "=== Done. Configuration is installed and verified. ==="
  log "Tool CLIs are intentionally not installed or upgraded; manage their versions separately."
}

main "$@"
