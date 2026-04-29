# Dotfiles

Personal dotfiles for bootstrapping AI coding agents on any machine — local or devcontainer.

One `install.sh` configures Claude Code, Codex CLI, and Copilot CLI with a shared baseline plus hardened role agents, hooks, wrappers, and skills across all three.

## Prerequisites

- `git`
- `node` and `npm` (for all three CLI installs)
- `bash` or `zsh`
- Write access for global npm bin (`npm install -g`)
- Network access (for npm install)

## What's included

```
dotfiles/
├── core/
│   ├── DECISION_LEDGER.md         # Canonical trade-off decision protocol
│   └── SENSITIVE_FILE_POLICY.md   # Canonical deterministic secret-file policy
├── claude/
│   ├── settings.json              # Deny rules + effortLevel + autoMemory (deterministic)
│   ├── CLAUDE.md                  # Global contract + common commands
│   ├── managed-settings.json      # System-level: disables --dangerously-skip-permissions
│   ├── MEMORY.md                  # Memory index
│   ├── memory/
│   │   └── user_role.md           # User context
│   └── agents/
│       ├── architect.md           # Planning/mapping subagent (opus, read-only)
│       ├── implementer.md         # Focused implementation subagent (sonnet)
│       ├── reviewer.md            # Read-only code review subagent
│       └── security-reviewer.md   # Security audit subagent (opus, read-only)
├── codex/
│   ├── config.toml                # Global defaults + hardened profiles + hooks/features
│   ├── AGENTS.md                  # Global contract + workflow + safety rules
│   ├── hooks.json                 # User-level Codex hooks
│   ├── MEMORY.md                  # Memory index (same content as Claude/Copilot)
│   ├── memory/
│   │   └── user_role.md           # Shared user context
│   ├── hooks/
│   │   ├── pre-command-guard.sh   # Blocks dangerous shell commands
│   │   └── stop-reminder.sh       # Blocks completion until validation runs
│   └── agents/
│       ├── explorer.toml          # Read-only codebase explorer
│       ├── implementer.toml       # Focused implementation agent
│       ├── reviewer.toml          # Read-only code review agent
│       └── security.toml          # Security review agent
├── copilot/
│   ├── copilot-instructions.md    # CLI: global contract + common commands
│   ├── AGENTS.md                  # CLI: global contract (AGENTS.md format)
│   ├── MEMORY.md                  # Memory index (same content as Claude/Codex)
│   ├── memory/
│   │   └── user_role.md           # Shared user context
│   ├── agents/
│   │   ├── architect.agent.md     # Planning/mapping custom agent
│   │   ├── implementer.agent.md   # Focused implementation custom agent
│   │   ├── reviewer.agent.md      # Read-focused review custom agent
│   │   └── security-reviewer.agent.md # Security review custom agent
│   ├── hooks/
│   │   ├── policy.json            # Pre-tool policy hook config
│   │   └── pre-tool-guard.sh      # Blocks dangerous tool commands
│   └── instructions/
│       ├── global-contract.instructions.md  # VS Code extension global defaults
│       ├── backend.instructions.md          # Backend-specific guidance
│       ├── frontend.instructions.md         # Frontend-specific guidance
│       └── tests.instructions.md            # Test-file guidance
├── skills/                        # Shared skills (deployed to all three tools)
│   ├── repo-mapper/               # Repository mapping workflow
│   ├── implement-change/          # Minimal diff implementation workflow
│   ├── test-and-validate/         # Validation order and reporting
│   ├── review-risk/               # Risk review checklist
│   ├── test-strategy/             # Test planning and escalation
│   ├── web-search-rag-deep/       # Exhaustive multi-pass web search (5-10+ searches)
│   ├── web-search-rag-quick/      # Fast lean web search (1-3 searches)
│   ├── web-search-rag-official-deep/   # Multi-pass targeting official sources
│   ├── web-search-rag-official-quick/  # Fast targeting official sources
│   ├── php-cakephp/               # PHP/CakePHP conventions
│   ├── python/                    # Python conventions
│   └── typescript-react/          # TypeScript/React conventions
├── prompts/
│   └── workflow.md                # Multi-tool workflow prompt templates
├── scripts/
│   └── check-core-policy.sh       # Drift and guardrail coverage check
├── gitconfig                      # Global git config (Cardiff email default)
├── gitconfig-github               # Conditional include (GitHub noreply email)
├── codex-safe                     # Wrapper enforcing approved Codex profiles
├── copilot-safe                   # Wrapper enforcing safe Copilot CLI flags
├── install-claude.sh              # Claude-specific install steps
├── install-codex.sh               # Codex-specific install steps
├── install-copilot.sh             # Copilot-specific install steps
├── install-devcontainer.sh        # Devcontainer wrapper around install.sh
├── install.sh                     # Installs everything + runs verification
├── ROBUSTNESS-MATRIX.md           # Cross-tool capability and hardening matrix
├── uninstall.sh                   # Removes all installed files
└── README.md
```

## Scope

This repo manages user-level defaults only.

It does not create project-scoped Claude Code files such as a repo-root `CLAUDE.md`, `CLAUDE.local.md`, `.claude/settings.json` (project-level), `.claude/settings.local.json`, `.claude/rules/`, `.claude/skills/` (project-level), `.mcp.json`, or sandbox/worktree configuration inside individual repositories.

It does not create project-scoped Codex files such as a repo-root `AGENTS.md`, `.codex/config.toml`, `.codex/hooks.json`, or `.agents/skills/` inside individual repositories.

It also does not create project-scoped Copilot files such as repo-root `AGENTS.md`, `.github/copilot-instructions.md`, `.github/instructions/`, `.github/agents/`, `.github/skills/`, or `.github/hooks/` inside individual repositories.

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
3. Run `install-claude.sh`, `install-codex.sh`, and `install-copilot.sh`
4. Configure git with conditional email (GitHub noreply / GitLab Cardiff)
5. Set `COPILOT_CUSTOM_INSTRUCTIONS_DIRS` env var for Copilot CLI (`~/.copilot` and `~/.copilot/instructions`)
6. Optionally install system-level managed settings (requires sudo on macOS)
7. Run 16 verification checks and report results

### VSCode devcontainers (automatic)

Add to your **host machine's** VSCode user settings:

```json
"dotfiles.repository": "derricka-lau/dotfiles",
"dotfiles.installCommand": "install-devcontainer.sh",
"dotfiles.targetPath": "~/dotfiles"
```

`install-devcontainer.sh` is a thin wrapper around `install.sh`, so there is one installation source of truth while still leaving a separate entry point for future devcontainer-only behaviour.

Also ensure Copilot picks up the global instructions (host-side setting):

```json
"chat.instructionsFilesLocations": {
  "~/.copilot/instructions": true
}
```

Every devcontainer will automatically clone this repo and run `install-devcontainer.sh` on creation.

## What gets installed where

| Step | Target | Overwrite policy |
|---|---|---|
| Claude Code settings + instructions + memory + subagents | `~/.claude/` | Full overwrite |
| Claude Code managed settings (optional, requires sudo) | `/Library/Application Support/ClaudeCode/` | Full overwrite |
| Claude Code CLI (if missing) | `npm install -g @anthropic-ai/claude-code` | Skip if present |
| Codex config + AGENTS.md + hooks + agents | `~/.codex/` | Full overwrite |
| Codex memory + workflow prompts | `~/.codex/MEMORY.md`, `~/.codex/memory/`, `~/.codex/prompts/workflow.md` | Full overwrite |
| Codex skills | `~/.codex/skills/` | Full overwrite |
| Codex compatibility skill mirror | `~/.agents/skills/` | Full overwrite |
| Codex CLI (if missing) | `npm install -g @openai/codex` | Skip if present |
| `codex-safe` wrapper | `~/.local/bin/` | Full overwrite |
| Copilot VS Code extension instructions | `~/.copilot/instructions/` | Full overwrite |
| Copilot CLI global instructions + AGENTS.md | `~/.copilot/copilot-instructions.md`, `~/.copilot/AGENTS.md` | Full overwrite |
| Copilot custom agents + hooks | `~/.copilot/agents/`, `~/.copilot/hooks/` | Full overwrite |
| Copilot memory + workflow prompts | `~/.copilot/MEMORY.md`, `~/.copilot/memory/`, `~/.copilot/prompts/workflow.md` | Full overwrite |
| Copilot CLI (if missing) | `npm install -g @github/copilot` | Skip if present |
| `copilot-safe` wrapper | `~/.local/bin/` | Full overwrite |
| Shared skills (all tools) | `~/.claude/skills/`, `~/.codex/skills/`, `~/.copilot/skills/` | Full overwrite |
| Git config + GitHub conditional include | `~/.gitconfig`, `~/.gitconfig-github` | Full overwrite |
| Add `~/.local/bin` to PATH | `~/.zshrc` or `~/.bashrc` | Append if missing |
| Set `COPILOT_CUSTOM_INSTRUCTIONS_DIRS` | `~/.zshrc` or `~/.bashrc` | Append if missing (`$HOME/.copilot,$HOME/.copilot/instructions`) |

## Sensitive file protection

| Tool | Mechanism | Deterministic? | How to verify |
|---|---|---|---|
| **Claude Code** | `permissions.deny` in settings.json | Yes — CLI runtime gate | `grep "Read.*env" ~/.claude/settings.json` |
| **Claude Code** | `disableBypassPermissionsMode` in managed-settings.json | Yes — system-level gate (requires sudo) | `cat "/Library/Application Support/ClaudeCode/managed-settings.json"` |
| **Codex CLI** | `default_permissions = "global_lockdown"` + approved profiles in config.toml | Yes — runtime gate | `grep "global_lockdown" ~/.codex/config.toml` |
| **Codex CLI** | `hooks.json` + shell hooks block dangerous commands and premature completion | Yes — hook gate | `ls ~/.codex/hooks.json ~/.codex/hooks/` |
| **Codex CLI** | `codex-safe` wrapper allows only approved profiles | Yes — shell gate | `codex-safe --profile foo --help` (should exit 64) |
| **Copilot CLI** | `copilot-safe` wrapper denies dangerous shell tools and blocks `--allow-all` / `--yolo` | Yes — shell gate (when using wrapper) | `copilot-safe --allow-all` (should exit 64) |
| **Copilot agents** | `~/.copilot/hooks/policy.json` + `pre-tool-guard.sh` block dangerous commands and sensitive file access in pre-tool hook | Yes — hook gate when hooks are enabled | `ls ~/.copilot/hooks/policy.json ~/.copilot/hooks/pre-tool-guard.sh` |
| **Copilot** | Instructions in `.instructions.md` (extension) + `copilot-instructions.md` (CLI) | Guidance layer | `ls ~/.copilot/instructions/ ~/.copilot/copilot-instructions.md` |

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
| 1b | Core policy and guardrail coverage | `scripts/check-core-policy.sh` passes |
| 2 | Codex baseline config | `model = "gpt-5.4"` and `codex_hooks = true` in `~/.codex/config.toml` |
| 3 | Codex global_lockdown profile | `default_permissions = "global_lockdown"` in `~/.codex/config.toml` |
| 4 | codex-safe wrapper | Executable at `~/.local/bin/codex-safe` |
| 5 | codex-safe blocks unapproved profiles | `codex-safe --profile foo` exits 64 |
| 6 | Codex hooks | `~/.codex/hooks.json` and hook scripts present |
| 7 | Copilot instructions | Global, backend, frontend, tests, and CLI instructions present in `~/.copilot/` |
| 8 | Copilot custom agents | `architect`, `implementer`, `reviewer`, and `security-reviewer` agent profiles present |
| 9 | Copilot safety controls | Hook guard and `copilot-safe` wrapper present and executable |
| 10 | Shared memory + prompts | Memory index, user role, and `prompts/workflow.md` present for Claude, Codex, Copilot |
| 11 | Git conditional email | `hasconfig:remote` in `~/.gitconfig` |
| 12 | Skills (all tools) | At least 12 skills in each of `~/.claude/skills/`, `~/.codex/skills/`, `~/.copilot/skills/` |
| 13 | Role agents across all three | Planning, implementation, review, and security agents installed for Claude, Codex, and Copilot |
| 14 | Copilot AGENTS.md | `~/.copilot/AGENTS.md` present |
| 15 | Claude managed settings (optional) | `disableBypassPermissionsMode` in managed-settings.json |

## Global contract (all three tools)

The same global contract is deployed to all three CLI tools:

- Common commands for test, lint, type-check across PHP, Python, TS
- Strict types, concrete assertion examples, framework-native patterns
- SOLID / Clean Architecture, dependency direction, version-compatibility checks
- Dependency management: lock-file imports, pinned versions, audit on changes
- Git discipline: no force-push, imperative commit messages
- Concise output: no trailing summaries, no unnecessary docstrings
- Decision gate: 3 options with trade-offs before implementation
- Decision Ledger Protocol: meaningful material choices use 3 options, trade-offs, recommendation, default fallback, and impact before action
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

Codex and Copilot also get user-level role agent definitions and hook guardrails under `~/.codex/` and `~/.copilot/`.

## Skills (shared across all tools)

Skills are deployed to `~/.claude/skills/`, `~/.codex/skills/`, and `~/.copilot/skills/`. For compatibility with older Codex setups, the same skills are also mirrored to `~/.agents/skills/`.

| Skill | Purpose |
|---|---|
| `repo-mapper` | Repository mapping workflow before implementation |
| `implement-change` | Minimal-diff implementation workflow |
| `test-and-validate` | Validation order and reporting |
| `review-risk` | High-value risk review before completion |
| `test-strategy` | Test planning and escalation for changed areas |
| `php-cakephp` | PHP/CakePHP conventions, testing patterns, PSR-12, strict types |
| `python` | Type hints, f-strings, pytest, pathlib |
| `typescript-react` | Strict TS, functional components, named exports |
| `web-search-rag-deep` | Exhaustive multi-pass web search (5-10+ searches), aggressive page reads |
| `web-search-rag-quick` | Fast lean search (1-3 searches), concise responses |
| `web-search-rag-official-deep` | Multi-pass targeting official/primary sources (4-10+ searches) |
| `web-search-rag-official-quick` | Fast search targeting official sources (1-3 queries) |

## Deterministic vs guidance

- Deterministic runtime guards: Claude `permissions.deny` and managed settings, Codex filesystem permission profile + hooks + approved-profile `codex-safe` wrapper, Copilot pre-tool policy hook + `copilot-safe` wrapper.
- Guidance layer: Copilot instructions, memory files, prompt templates, and the Decision Ledger Protocol complement deterministic controls by steering design choices before material actions.

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
