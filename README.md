# Dotfiles

Personal dotfiles for bootstrapping AI coding agents on any machine — local or devcontainer.

One `install.sh` configures Claude Code, Codex CLI, and GitHub Copilot with identical rules.

## What's included

```
dotfiles/
├── claude/
│   ├── settings.json                  # Deny rules (deterministic, runtime-enforced)
│   ├── CLAUDE.md                      # Global contract
│   ├── MEMORY.md                      # Memory index
│   └── memory/
│       └── user_role.md               # User context
├── codex/
│   ├── config.toml                    # Deny rules (deterministic, filesystem "none")
│   └── AGENTS.md                      # Global contract
├── copilot/
│   └── instructions/
│       └── global-contract.instructions.md  # Global contract + .env guidance
├── codex-safe                         # Wrapper enforcing secure-global profile
├── install.sh                         # Installs everything
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

Also ensure Copilot picks up the global instructions:

```json
"chat.instructionsFilesLocations": {
  "~/.copilot/instructions": true
}
```

## What `install.sh` does

| Step | Target |
|---|---|
| Copy Claude Code settings + instructions + memory | `~/.claude/` |
| Install Claude Code CLI (if missing) | npm global |
| Copy Codex config + AGENTS.md | `~/.codex/` |
| Install `codex-safe` wrapper | `~/.local/bin/` |
| Copy Copilot instructions | `~/.copilot/instructions/` |
| Add `~/.local/bin` to PATH | `~/.zshrc` or `~/.bashrc` |

## Sensitive file protection

| Tool | Mechanism | Deterministic? |
|---|---|---|
| **Claude Code** | `permissions.deny` rules in settings.json | Yes — CLI runtime gate |
| **Codex CLI** | `filesystem "none"` in config.toml | Yes — sandbox gate |
| **Copilot** | Instructions in `.instructions.md` | No — LLM guidance only |

Blocked files: `.env`, `.env.*`, `settings.local.php`, `app.local.php`

**Note:** Copilot has no deterministic file deny mechanism. The instructions tell it not to read sensitive files, but this is best-effort guidance, not a hard gate. For true protection from Copilot, rely on OS-level file permissions or exclude secrets from the workspace.

## Global contract (all three tools)

- SOLID and Clean Architecture by default
- TDD-first, strict types, no shortcuts
- Decision gate: 3 options with trade-offs before implementation
- British English in all output
- Breach protocol with stop phrase

## Updating

Edit files in this repo, push, then re-run `install.sh` on each machine (or rebuild devcontainers).
