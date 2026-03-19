# Dotfiles

Personal dotfiles for bootstrapping development environments — local machines and devcontainers.

## What's included

| File | Purpose |
|---|---|
| `claude-settings.json` | Claude Code global deny rules — blocks reading/editing `.env`, `.env.*`, `settings.local.php`, `app.local.php` |
| `install.sh` | Copies settings into place and installs Claude Code CLI if missing |

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

Claude Code is deterministically blocked from reading or editing:

- `.env` / `.env.*` (any depth)
- `settings.local.php` (any depth)
- `app.local.php` (any depth)

Bash `cat` commands targeting these files are also blocked.

These rules are enforced at the CLI runtime level, not by the LLM — they cannot be bypassed by prompt injection or context compaction.
