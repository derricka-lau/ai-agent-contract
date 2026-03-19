# Dotfiles

Personal dotfiles for bootstrapping AI coding agents on any machine — local or devcontainer.

One `install.sh` configures Claude Code, Codex CLI, and GitHub Copilot with identical rules.

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
│       ├── global-contract.instructions.md   # Universal rules (applyTo: "**/")
│       ├── php.instructions.md               # PHP/CakePHP (applyTo: "*.php")
│       ├── python.instructions.md            # Python (applyTo: "*.py")
│       └── typescript.instructions.md        # TS/React (applyTo: "*.{ts,tsx}")
├── codex-safe                     # Wrapper enforcing secure-global profile
├── install.sh                     # Installs everything
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
| Copy all Copilot instruction files | `~/.copilot/instructions/` |
| Add `~/.local/bin` to PATH | `~/.zshrc` or `~/.bashrc` |

## Sensitive file protection

| Tool | Mechanism | Deterministic? |
|---|---|---|
| **Claude Code** | `permissions.deny` in settings.json | Yes — CLI runtime gate |
| **Codex CLI** | `filesystem "none"` in config.toml | Yes — sandbox gate |
| **Copilot** | Instructions in `.instructions.md` | No — LLM guidance only |

Blocked files: `.env`, `.env.*`, `settings.local.php`, `app.local.php`

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

## Updating

Edit files in this repo, push, then re-run `install.sh` on each machine (or rebuild devcontainers).
