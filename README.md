# Dotfiles

Personal dotfiles for bootstrapping AI coding agents on any machine — local or devcontainer.

One `install.sh` configures Claude Code, Codex CLI, and GitHub Copilot with identical rules.

## Prerequisites

- `git`
- `node` and `npm` (for Claude Code CLI install)
- `bash` or `zsh`
- Write access for global npm bin (`npm install -g`)
- Network access (for npm install)

## What's included

```
dotfiles/
├── claude/
│   ├── settings.json              # Deny rules (deterministic, runtime-enforced)
│   ├── CLAUDE.md                  # Global contract + common commands
│   ├── MEMORY.md                  # Memory index
│   └── memory/
│       └── user_role.md           # User context
├── codex/
│   ├── config.toml                # Deny rules (deterministic, filesystem "none")
│   └── AGENTS.md                  # Global contract + common commands
├── copilot/
│   └── instructions/
│       ├── global-contract.instructions.md   # Universal rules (applyTo: "**")
│       ├── php.instructions.md               # PHP/CakePHP (applyTo: "*.php")
│       ├── python.instructions.md            # Python (applyTo: "*.py")
│       └── typescript.instructions.md        # TS/React (applyTo: "*.{ts,tsx}")
├── codex-safe                     # Wrapper enforcing secure-global profile
├── install.sh                     # Installs everything + runs verification
├── uninstall.sh                   # Removes all installed files
└── README.md
```

## Setup

### New laptop

> **Warning:** `install.sh` backs up existing config to `~/.dotfiles-backup/` before overwriting. Existing `~/.claude/settings.json`, `~/.codex/config.toml`, etc. will be replaced.

```bash
# SSH (if GitHub SSH key is already configured)
git clone git@github.com:derricka-lau/dotfiles.git ~/dotfiles

# HTTPS fallback (works without SSH key setup)
git clone https://github.com/derricka-lau/dotfiles.git ~/dotfiles

cd ~/dotfiles
./install.sh
```

`install.sh` will:
1. Check prerequisites (git, node, npm)
2. **Overwrite** existing config files (not merge) — this is intentional for reproducibility
3. Install CLIs if missing
4. Run 5 verification checks and report results

### VSCode devcontainers (automatic)

Add to your **host machine's** VSCode user settings (`Cmd+Shift+P` → "Preferences: Open User Settings (JSON)"). These must be on the **host**, not inside the container:

```json
"dotfiles.repository": "derricka-lau/dotfiles",
"dotfiles.installCommand": "install.sh",
"dotfiles.targetPath": "~/dotfiles"
```

Also ensure Copilot picks up the global instructions (host-side setting):

```json
"chat.instructionsFilesLocations": {
  "~/.copilot/instructions": true
}
```

Every devcontainer will automatically clone this repo and run `install.sh` on creation.

## What `install.sh` does

| Step | Target | Overwrite policy |
|---|---|---|
| Copy Claude Code settings + instructions + memory | `~/.claude/` | Full overwrite |
| Install Claude Code CLI (if missing) | npm global | Skip if present |
| Copy Codex config + AGENTS.md | `~/.codex/` | Full overwrite |
| Install `codex-safe` wrapper | `~/.local/bin/` | Full overwrite |
| Copy all Copilot instruction files | `~/.copilot/instructions/` | Full overwrite |
| Add `~/.local/bin` to PATH | `~/.zshrc` or `~/.bashrc` | Append if missing |

## Sensitive file protection

| Tool | Mechanism | Deterministic? | How to verify |
|---|---|---|---|
| **Claude Code** | `permissions.deny` in settings.json | Yes — CLI runtime gate | `grep "Read.*env" ~/.claude/settings.json` |
| **Codex CLI** | `default_permissions = "global_lockdown"` + `filesystem "none"` in config.toml | Yes — sandbox gate | `grep "global_lockdown" ~/.codex/config.toml` |
| **Codex CLI** | `codex-safe` wrapper blocks `--profile` overrides | Yes — shell gate | `codex-safe --profile foo --help` (should exit 64) |
| **Copilot** | Instructions in `.instructions.md` | No — LLM guidance only | `ls ~/.copilot/instructions/` |

Blocked files: `.env`, `.env.*`, `settings.local.php`, `app.local.php`

## Verification

`install.sh` runs these checks automatically after install:

| Check | What it verifies |
|---|---|
| Claude Code deny rules | `Read(**/.env)` present in `~/.claude/settings.json` |
| Codex global_lockdown profile | `default_permissions = "global_lockdown"` in `~/.codex/config.toml` |
| codex-safe wrapper | Executable at `~/.local/bin/codex-safe` |
| codex-safe blocks override | `codex-safe --profile foo` exits with code 64 |
| Copilot instructions | `global-contract.instructions.md` exists in `~/.copilot/instructions/` |

Re-run verification at any time: `./install.sh` (idempotent — safe to re-run).

## Global contract (all three tools)

- Common commands for test, lint, type-check across PHP, Python, TS
- Strict types, concrete assertion examples, framework-native patterns
- SOLID / Clean Architecture, dependency direction
- Git discipline: no force-push, imperative commit messages
- Concise output: no trailing summaries, no unnecessary docstrings
- Decision gate: 3 options with trade-offs before implementation
- Verification: real command output before claiming success
- Breach protocol with stop phrase

## Copilot language-specific instructions

Copilot supports `applyTo` globs, so language rules only load when relevant:

| File | Applies to | Key rules |
|---|---|---|
| `php.instructions.md` | `*.php` | CakePHP conventions, `assertSame()`, PSR-12, strict types |
| `python.instructions.md` | `*.py` | Type hints, f-strings, pytest, pathlib |
| `typescript.instructions.md` | `*.{ts,tsx}` | Strict TS, functional components, named exports |

## Rollback

To remove all installed config files:

```bash
cd ~/dotfiles
./uninstall.sh
```

This removes only files managed by `install.sh`. It does not uninstall the Claude Code CLI npm package.

## Updating

Edit files in this repo, push, then re-run `install.sh` on each machine (or rebuild devcontainers).
