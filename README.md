# Dotfiles

Personal dotfiles for bootstrapping AI coding agents on any machine — local or devcontainer.

One `install.sh` configures Claude Code, Codex CLI, and Copilot CLI with identical rules.

## Prerequisites

- `git`
- `node` and `npm` (for all three CLI installs)
- `bash` or `zsh`
- Write access for global npm bin (`npm install -g`)
- Network access (for npm install)

## What's included

```
dotfiles/
├── claude/
│   ├── settings.json              # Deny rules + effortLevel + autoMemory (deterministic)
│   ├── CLAUDE.md                  # Global contract + common commands
│   ├── managed-settings.json      # System-level: disables --dangerously-skip-permissions
│   ├── MEMORY.md                  # Memory index
│   ├── memory/
│   │   └── user_role.md           # User context
│   └── agents/
│       └── reviewer.md            # Read-only code review subagent
├── codex/
│   ├── config.toml                # Deny rules + tui + history + agents (deterministic)
│   ├── AGENTS.md                  # Global contract + common commands
│   ├── MEMORY.md                  # Memory index (same content as Claude/Copilot)
│   ├── memory/
│   │   └── user_role.md           # Shared user context
│   └── agents/
│       └── reviewer.toml          # Read-only code review subagent
├── copilot/
│   ├── copilot-instructions.md    # CLI: global contract + common commands
│   ├── AGENTS.md                  # CLI: global contract (AGENTS.md format)
│   ├── MEMORY.md                  # Memory index (same content as Claude/Codex)
│   ├── memory/
│   │   └── user_role.md           # Shared user context
│   └── instructions/
│       └── global-contract.instructions.md  # VS Code extension (applyTo: "**")
├── skills/                        # Shared skills (deployed to all three tools)
│   ├── web-search-rag-deep/       # Exhaustive multi-pass web search (5-10+ searches)
│   ├── web-search-rag-quick/      # Fast lean web search (1-3 searches)
│   ├── web-search-rag-official-deep/   # Multi-pass targeting official sources
│   ├── web-search-rag-official-quick/  # Fast targeting official sources
│   ├── php-cakephp/               # PHP/CakePHP conventions
│   ├── python/                    # Python conventions
│   └── typescript-react/          # TypeScript/React conventions
├── prompts/
│   └── workflow.md                # Multi-tool workflow prompt templates
├── gitconfig                      # Global git config (Cardiff email default)
├── gitconfig-github               # Conditional include (GitHub noreply email)
├── codex-safe                     # Wrapper enforcing secure-global profile
├── install.sh                     # Installs everything + runs verification
├── uninstall.sh                   # Removes all installed files
└── README.md
```

## Setup

### New laptop

> **Warning:** `install.sh` backs up existing config to `~/.dotfiles-backup/` before overwriting.

```bash
git clone git@github.com:derricka-lau/dotfiles.git ~/dotfiles
cd ~/dotfiles
./install.sh
```

`install.sh` will:
1. Check prerequisites (git, node, npm)
2. **Overwrite** existing config files (not merge) — intentional for reproducibility
3. Install all three CLIs via npm if missing (Claude Code, Codex, Copilot)
4. Deploy config, instructions, subagents, shared memory, shared workflow prompts, and shared skills to all three tools
5. Configure git with conditional email (GitHub noreply / GitLab Cardiff)
6. Set `COPILOT_CUSTOM_INSTRUCTIONS_DIRS` env var for Copilot CLI
7. Optionally install system-level managed settings (requires sudo on macOS)
8. Run 11 verification checks and report results

### VSCode devcontainers (automatic)

Add to your **host machine's** VSCode user settings:

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

## What gets installed where

| Step | Target | Overwrite policy |
|---|---|---|
| Claude Code settings + instructions + memory + subagents | `~/.claude/` | Full overwrite |
| Claude Code managed settings (optional, requires sudo) | `/Library/Application Support/ClaudeCode/` | Full overwrite |
| Claude Code CLI (if missing) | `npm install -g @anthropic-ai/claude-code` | Skip if present |
| Codex config + AGENTS.md + tui/history/agents | `~/.codex/` | Full overwrite |
| Codex memory + workflow prompts | `~/.codex/MEMORY.md`, `~/.codex/memory/`, `~/.codex/prompts/workflow.md` | Full overwrite |
| Codex CLI (if missing) | `npm install -g @openai/codex` | Skip if present |
| `codex-safe` wrapper | `~/.local/bin/` | Full overwrite |
| Copilot VS Code extension instructions | `~/.copilot/instructions/` | Full overwrite |
| Copilot CLI global instructions + AGENTS.md | `~/.copilot/copilot-instructions.md`, `~/.copilot/AGENTS.md` | Full overwrite |
| Copilot memory + workflow prompts | `~/.copilot/MEMORY.md`, `~/.copilot/memory/`, `~/.copilot/prompts/workflow.md` | Full overwrite |
| Copilot CLI (if missing) | `npm install -g @github/copilot` | Skip if present |
| Skills (all three tools) | `~/.claude/skills/`, `~/.agents/skills/`, `~/.copilot/skills/` | Full overwrite |
| Git config + GitHub conditional include | `~/.gitconfig`, `~/.gitconfig-github` | Full overwrite |
| Add `~/.local/bin` to PATH | `~/.zshrc` or `~/.bashrc` | Append if missing |
| Set `COPILOT_CUSTOM_INSTRUCTIONS_DIRS` | `~/.zshrc` or `~/.bashrc` | Append if missing |

## Sensitive file protection

| Tool | Mechanism | Deterministic? | How to verify |
|---|---|---|---|
| **Claude Code** | `permissions.deny` in settings.json | Yes — CLI runtime gate | `grep "Read.*env" ~/.claude/settings.json` |
| **Claude Code** | `disableBypassPermissionsMode` in managed-settings.json | Yes — system-level gate (requires sudo) | `cat "/Library/Application Support/ClaudeCode/managed-settings.json"` |
| **Codex CLI** | `default_permissions = "global_lockdown"` + `filesystem "none"` in config.toml | Yes — sandbox gate | `grep "global_lockdown" ~/.codex/config.toml` |
| **Codex CLI** | `codex-safe` wrapper blocks `--profile` overrides | Yes — shell gate | `codex-safe --profile foo --help` (should exit 64) |
| **Copilot** | Instructions in `.instructions.md` (extension) + `copilot-instructions.md` (CLI) | No — LLM guidance only | `ls ~/.copilot/instructions/ ~/.copilot/copilot-instructions.md` |

Blocked files:
- Environment: `.env`, `.env.*`, `.envrc`
- App config: `settings.local.php`, `app.local.php`
- Keys/certs: `*.pem`, `*.key`, `id_rsa`, `id_ed25519`
- Credentials: `.npmrc`, `.pypirc`, `.netrc`, `~/.aws/credentials`, `~/.azure/*`

## Verification

`install.sh` runs these checks automatically:

| # | Check | What it verifies |
|---|---|---|
| 1 | Claude Code deny rules | `Read(**/.env)` in `~/.claude/settings.json` |
| 2 | Codex global_lockdown profile | `default_permissions = "global_lockdown"` in `~/.codex/config.toml` |
| 3 | codex-safe wrapper | Executable at `~/.local/bin/codex-safe` |
| 4 | codex-safe blocks override | `codex-safe --profile foo` exits 64 |
| 5 | Copilot instructions | Extension + CLI instructions both present in `~/.copilot/` |
| 6 | Shared memory + prompts | Memory index, user role, and `prompts/workflow.md` present for Claude, Codex, Copilot |
| 7 | Git conditional email | `hasconfig:remote` in `~/.gitconfig` |
| 8 | Skills (all tools) | 7 skills in each of `~/.claude/skills/`, `~/.agents/skills/`, `~/.copilot/skills/` |
| 9 | Subagents (Claude + Codex) | `reviewer.md` in `~/.claude/agents/`, `reviewer.toml` in `~/.codex/agents/` |
| 10 | Copilot AGENTS.md | `~/.copilot/AGENTS.md` present |
| 11 | Claude managed settings (optional) | `disableBypassPermissionsMode` in managed-settings.json |

## Global contract (all three tools)

The same global contract is deployed to all three CLI tools:

- Common commands for test, lint, type-check across PHP, Python, TS
- Strict types, concrete assertion examples, framework-native patterns
- SOLID / Clean Architecture, dependency direction, version-compatibility checks
- Dependency management: lock-file imports, pinned versions, audit on changes
- Git discipline: no force-push, imperative commit messages
- Concise output: no trailing summaries, no unnecessary docstrings
- Decision gate: 3 options with trade-offs before implementation
- Definition of Done: tests + lint + type-check + static analysis must all pass
- Security code patterns: parameterised queries, deny-by-default auth, input validation, XSS prevention, no swallowed exceptions
- Pre-completion checks: no debug statements, no secrets in diff, no commented-out code, DB migration rollback plan
- Breach protocol with stop phrase

## Memory and prompts alignment

`install.sh` deploys the same memory context and workflow prompt templates to all three CLIs:

- Memory index: `~/.claude/MEMORY.md`, `~/.codex/MEMORY.md`, `~/.copilot/MEMORY.md`
- User role context: `~/.claude/memory/user_role.md`, `~/.codex/memory/user_role.md`, `~/.copilot/memory/user_role.md`
- Workflow templates: `~/.claude/prompts/workflow.md`, `~/.codex/prompts/workflow.md`, `~/.copilot/prompts/workflow.md`

These files keep planning/handoff context consistent across tools.

## Skills (shared across all tools)

Skills are deployed to `~/.claude/skills/`, `~/.agents/skills/`, and `~/.copilot/skills/`. All three CLIs auto-discover them via `SKILL.md` files.

| Skill | Purpose |
|---|---|
| `php-cakephp` | PHP/CakePHP conventions, testing patterns, PSR-12, strict types |
| `python` | Type hints, f-strings, pytest, pathlib |
| `typescript-react` | Strict TS, functional components, named exports |
| `web-search-rag-deep` | Exhaustive multi-pass web search (5-10+ searches), aggressive page reads |
| `web-search-rag-quick` | Fast lean search (1-3 searches), concise responses |
| `web-search-rag-official-deep` | Multi-pass targeting official/primary sources (4-10+ searches) |
| `web-search-rag-official-quick` | Fast search targeting official sources (1-3 queries) |

## Deterministic vs guidance

- Deterministic runtime guards: Claude `permissions.deny` and managed settings, Codex filesystem permission profile + `codex-safe`.
- Guidance-only behaviour: Copilot instructions, memory files, and prompt templates (no runtime deny gate).

## Git conditional email

Uses `includeIf hasconfig:remote` (requires Git 2.36+):

| Remote | Email used |
|---|---|
| `github.com` (HTTPS or SSH) | `151698873+derricka-lau@users.noreply.github.com` |
| Everything else (GitLab, Cardiff) | `lauf@cardiff.ac.uk` |

## Rollback

```bash
cd ~/dotfiles
./uninstall.sh
```

Removes only files managed by `install.sh`. Does not uninstall CLI npm packages.

## Updating

Edit files in this repo, push, then re-run `install.sh` on each machine (or rebuild devcontainers).
