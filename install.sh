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

install_npm_cli() {
  local package="$1"
  local label="$2"
  local post_message="${3:-}"

  log "Installing/updating ${label} CLI to latest..."
  npm install -g "${package}@latest"
  log "${label} CLI installed.${post_message}"
}

backup_existing() {


  local backup_dir="$HOME/.ai-agent-contract-backup/$(date +%Y%m%d-%H%M%S)"
  local backed_up=false
  local targets=(
    "$HOME/.claude"
    "$HOME/.codex"
    "$HOME/.copilot"
    "$HOME/.agents/skills"
    "$HOME/.local/bin/codex-safe"
    "$HOME/.local/bin/copilot-safe"
    "$HOME/.local/share/ai-agent-contract"
    "$HOME/.git-hooks"
    "$HOME/.gitconfig"
    "$HOME/.gitconfig-github"
    "$HOME/.ai-agent-contract-manifest"
  )

  for target in "${targets[@]}"; do
    if [ -e "$target" ]; then
      if [ "$backed_up" = false ]; then
        mkdir -p "$backup_dir"
        log "Backing up existing config to $backup_dir"
        backed_up=true
      fi
      cp -a "$target" "$backup_dir/"
    fi
  done

  if [ "$backed_up" = true ]; then
    log "Backup complete: $backup_dir"
  fi
}

copy_tree() {
  local source="$1"
  local target="$2"

  mkdir -p "$target"
  cp -a "$source"/. "$target"/
}

copy_skills() {
  local target="$1"

  mkdir -p "$target"
  for skill_dir in "$SCRIPT_DIR"/skills/*; do
    [ -d "$skill_dir" ] || continue
    mkdir -p "$target/$(basename "$skill_dir")"
    cp "$skill_dir/SKILL.md" "$target/$(basename "$skill_dir")/SKILL.md"
  done
}

write_manifest() {
  local manifest="$HOME/.ai-agent-contract-manifest"

  : > "$manifest"
  for target in \
    "$HOME/.claude" \
    "$HOME/.codex" \
    "$HOME/.copilot" \
    "$HOME/.agents/skills" \
    "$HOME/.local/bin/codex-safe" \
    "$HOME/.local/bin/copilot-safe" \
    "$HOME/.local/share/ai-agent-contract" \
    "$HOME/.git-hooks" \
    "$HOME/.gitconfig" \
    "$HOME/.gitconfig-github"; do
    if [ -f "$target" ]; then
      shasum -a 256 "$target" >> "$manifest"
    elif [ -d "$target" ]; then
      find "$target" -type f -print0 | sort -z | xargs -0 shasum -a 256 >> "$manifest"
    fi
  done
  log "Manifest written to $manifest"
}

ensure_shell_exports() {
  local shell_rc
  case "${SHELL:-}" in
    */zsh) shell_rc="$HOME/.zshrc" ;;
    */bash) shell_rc="$HOME/.bashrc" ;;
    *) shell_rc="$HOME/.profile" ;;
  esac

  touch "$shell_rc"

  if ! printf '%s' "$PATH" | grep -q "$HOME/.local/bin"; then
    printf '%s\n' 'export PATH="$HOME/.local/bin:$PATH"' >> "$shell_rc"
    log "Added ~/.local/bin to PATH in $shell_rc"
  fi

  local prompt_cache='export ENABLE_PROMPT_CACHING_1H=1'
  if ! grep -q 'ENABLE_PROMPT_CACHING_1H' "$shell_rc" 2>/dev/null; then
    printf '%s\n' "$prompt_cache" >> "$shell_rc"
    log "Added ENABLE_PROMPT_CACHING_1H to $shell_rc"
  fi
}

apply_vscode_settings() {
  local fragment="$1"
  local settings_dir

  case "$(uname -s)" in
    Darwin) settings_dir="$HOME/Library/Application Support/Code/User" ;;
    Linux) settings_dir="$HOME/.config/Code/User" ;;
    *) log "Skipping VS Code settings: unsupported OS $(uname -s)."; return 0 ;;
  esac

  if [ ! -d "$settings_dir" ]; then
    log "Skipping VS Code settings: $settings_dir not found (desktop VS Code not installed)."
    return 0
  fi

  local target="$settings_dir/settings.json"
  if [ -f "$target" ]; then
    cp "$target" "$target.ai-agent-contract-backup.$(date +%Y%m%d-%H%M%S)"
  fi

  node "$SCRIPT_DIR/scripts/merge-vscode-settings.js" "$fragment" "$target"
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
  check "Canonical sources render generated outputs" node "$SCRIPT_DIR/scripts/generate.js" --check
  check "Doctor checks pass" node "$SCRIPT_DIR/scripts/doctor.js"
  check "Copilot instructions installed" test -f "$HOME/.copilot/instructions/global-contract.instructions.md"
  check "Copilot hook installed" test -x "$HOME/.copilot/hooks/pre-tool-guard.sh"
  check "Compatible Claude instructions installed" test -f "$HOME/.claude/CLAUDE.md"
  check "Compatible Claude deny rules installed" grep -Fq 'Read(**/.env.local)' "$HOME/.claude/settings.json"
  check "Compatible Codex config installed" test -f "$HOME/.codex/config.toml"
  check "Compatible Codex workspace-write installed" grep -Fq 'sandbox_mode = "workspace-write"' "$HOME/.codex/config.toml"
  check "Compatible Codex network remains disabled" grep -Fq 'network_access = false' "$HOME/.codex/config.toml"
  check "Shared guard installed" test -f "$HOME/.local/share/ai-agent-contract/guard.js"
  check "Role agents installed" test -f "$HOME/.copilot/agents/security-reviewer.agent.md"
  check "Skills installed" test -f "$HOME/.copilot/skills/php-cakephp/SKILL.md"
  check "Git hooks installed" test -x "$HOME/.git-hooks/pre-commit"
  check "copilot-safe wrapper installed" test -x "$HOME/.local/bin/copilot-safe"
  check "Compatible codex-safe wrapper installed" test -x "$HOME/.local/bin/codex-safe"

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
  log "Git, node, and npm found."

  node "$SCRIPT_DIR/scripts/generate.js" --check
  node "$SCRIPT_DIR/scripts/doctor.js"

  local generated_dir
  generated_dir="$(mktemp -d)"
  trap 'rm -rf "${generated_dir:-}"' EXIT
  node "$SCRIPT_DIR/scripts/generate.js" --out "$generated_dir"

  log ""
  log "=== Installing ai-agent-contract ==="
  log "NOTE: Managed targets are backed up, then overwritten from generated outputs."

  backup_existing

  mkdir -p \
    "$HOME/.claude" "$HOME/.claude/memory" "$HOME/.claude/prompts" "$HOME/.claude/agents" "$HOME/.claude/skills" \
    "$HOME/.codex" "$HOME/.codex/memory" "$HOME/.codex/prompts" "$HOME/.codex/agents" "$HOME/.codex/hooks" "$HOME/.codex/skills" \
    "$HOME/.copilot" "$HOME/.copilot/memory" "$HOME/.copilot/prompts" "$HOME/.copilot/agents" "$HOME/.copilot/hooks" "$HOME/.copilot/instructions" "$HOME/.copilot/skills" \
    "$HOME/.agents/skills" "$HOME/.local/bin" "$HOME/.local/share/ai-agent-contract"

  copy_tree "$generated_dir/claude" "$HOME/.claude"
  copy_tree "$generated_dir/codex" "$HOME/.codex"
  copy_tree "$generated_dir/copilot" "$HOME/.copilot"
  rm -f "$HOME/.codex/hooks/stop-reminder.sh"
  copy_skills "$HOME/.claude/skills"
  copy_skills "$HOME/.codex/skills"
  copy_skills "$HOME/.copilot/skills"
  copy_skills "$HOME/.agents/skills"

  cp "$SCRIPT_DIR/scripts/guard.js" "$HOME/.local/share/ai-agent-contract/guard.js"
  cp "$SCRIPT_DIR/core/guardrails.json" "$HOME/.local/share/ai-agent-contract/guardrails.json"
  chmod +x "$HOME/.local/share/ai-agent-contract/guard.js"

  cp "$SCRIPT_DIR/codex-safe" "$HOME/.local/bin/codex-safe"
  cp "$SCRIPT_DIR/copilot-safe" "$HOME/.local/bin/copilot-safe"
  chmod +x "$HOME/.local/bin/codex-safe" "$HOME/.local/bin/copilot-safe"
  chmod +x "$HOME/.codex/hooks/pre-command-guard.sh" "$HOME/.copilot/hooks/pre-tool-guard.sh"

  install_npm_cli "@anthropic-ai/claude-code" "Claude Code"
  install_npm_cli "@openai/codex" "Codex"
  install_npm_cli "@github/copilot" "Copilot" " Run 'copilot' then '/login' to authenticate."

  if [ -f "$SCRIPT_DIR/gitconfig" ]; then
    cp "$SCRIPT_DIR/gitconfig" "$HOME/.gitconfig"
    log "Git identity config installed."
  else
    log "Skipping git identity config: gitconfig not present (create one to customise git identity)."
  fi
  if [ -f "$SCRIPT_DIR/gitconfig-github" ]; then
    cp "$SCRIPT_DIR/gitconfig-github" "$HOME/.gitconfig-github"
  fi
  mkdir -p "$HOME/.git-hooks"
  cp "$SCRIPT_DIR/hooks/pre-commit" "$HOME/.git-hooks/pre-commit"
  cp "$SCRIPT_DIR/hooks/pre-push" "$HOME/.git-hooks/pre-push"
  chmod +x "$HOME/.git-hooks/pre-commit" "$HOME/.git-hooks/pre-push"
  git config --global core.hooksPath "$HOME/.git-hooks"

  ensure_shell_exports
  apply_vscode_settings "$generated_dir/vscode/settings.json"
  verify_installed
  write_manifest

  log ""
  log "=== Done. ai-agent-contract is generated, installed, and verified. ==="
}

main "$@"
