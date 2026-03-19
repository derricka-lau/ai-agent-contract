# Dotfiles

Personal dotfiles for bootstrapping AI coding agents on any machine — local or devcontainer.

One `install.sh` configures both Claude Code and Codex CLI with identical rules.

## What's included

```
dotfiles/
├── claude/
│   ├── settings.json          # Deny rules (Read/Edit/Bash blocked for sensitive files)
│   ├── CLAUDE.md              # Global contract (instructions loaded every session)
│   ├── MEMORY.md              # Memory index
│   └── memory/
│       └── user_role.md       # User context (tech stack, workplace)
├── codex/
│   ├── config.toml            # Permissions profile with filesystem deny rules
│   └── AGENTS.md              # Global contract (instructions loaded every session)
├── codex-safe                 # Wrapper enforcing secure-global profile
├── install.sh                 # Installs everything to correct locations
└── README.md
```

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

## What `install.sh` does

| Step | Target |
|---|---|
| Copy `claude/settings.json` | `~/.claude/settings.json` |
| Copy `claude/CLAUDE.md` | `~/.claude/CLAUDE.md` |
| Copy `claude/MEMORY.md` + memory files | `~/.claude/MEMORY.md` + `~/.claude/memory/` |
| Install Claude Code CLI (if missing) | `npm install -g @anthropic-ai/claude-code` |
| Copy `codex/config.toml` | `~/.codex/config.toml` |
| Copy `codex/AGENTS.md` | `~/.codex/AGENTS.md` |
| Copy `codex-safe` | `~/.local/bin/codex-safe` |
| Add `~/.local/bin` to PATH | `~/.zshrc` or `~/.bashrc` |

## Blocked files

Both tools are deterministically blocked from reading or editing:

- `.env` / `.env.*` (any depth)
- `settings.local.php` (any depth)
- `app.local.php` (any depth)

### Claude Code
Deny rules in `~/.claude/settings.json` block `Read`, `Edit`, and `Bash cat` at CLI runtime level.

### Codex CLI
Filesystem permissions profile `global_lockdown` in `~/.codex/config.toml` sets sensitive paths to `"none"`. The `codex-safe` wrapper enforces the `secure-global` profile and blocks `--profile` overrides.

## Global contract

Both tools load the same contract (from `CLAUDE.md` / `AGENTS.md`):

- SOLID and Clean Architecture by default
- TDD-first, strict types, no shortcuts
- Decision gate: 3 options with trade-offs before implementation
- British English in all output
- Breach protocol with stop phrase

## Updating

Edit files in this repo, push, then re-run `install.sh` on each machine (or rebuild devcontainers).
