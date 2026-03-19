# Dotfiles

Personal dotfiles for bootstrapping development environments — local machines and devcontainers.

## What's included

| File | Purpose |
|---|---|
| `claude-settings.json` | Claude Code global deny rules |
| `codex-config.toml` | Codex CLI global permissions profile with filesystem deny rules |
| `codex-safe` | Wrapper that enforces `secure-global` profile and blocks `--profile` overrides |
| `install.sh` | Copies all settings into place and installs CLIs if missing |

## Setup

### New laptop

```bash
git clone git@github.com:derricka-lau/dotfiles.git ~/dotfiles
cd ~/dotfiles
./install.sh
```

### VSCode devcontainers (automatic)

Add to your VSCode user settings (`Cmd+Shift+P` → "Preferences: Open User Settings (JSON)"):

```json
"dotfiles.repository": "derricka-lau/dotfiles",
"dotfiles.installCommand": "install.sh",
"dotfiles.targetPath": "~/dotfiles"
```

Every devcontainer will automatically clone this repo and run `install.sh` on creation.

## Blocked files

Both Claude Code and Codex CLI are deterministically blocked from reading or editing:

- `.env` / `.env.*` (any depth)
- `settings.local.php` (any depth)
- `app.local.php` (any depth)

### Claude Code

Deny rules in `~/.claude/settings.json` block `Read`, `Edit`, and `Bash cat` at CLI runtime level. Cannot be bypassed by prompt injection or context compaction.

### Codex CLI

Filesystem permissions profile `global_lockdown` in `~/.codex/config.toml` sets sensitive paths to `"none"`. The `codex-safe` wrapper enforces the `secure-global` profile and prevents `--profile` overrides.

## What `install.sh` does

1. Copies `claude-settings.json` → `~/.claude/settings.json`
2. Installs Claude Code CLI via npm (if missing)
3. Copies `codex-config.toml` → `~/.codex/config.toml`
4. Copies `codex-safe` → `~/.local/bin/codex-safe`
5. Adds `~/.local/bin` to `PATH` if not present
