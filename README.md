# Dotfiles

Source-driven, deterministic AI coding tool setup for new laptops and devcontainers, with mandatory Decision Ledger review and Test-Driven Development (TDD) guardrails.

The repo has one source of truth under `core/`. Tool-specific files for Claude, Codex, and Copilot are generated during install because each tool reads a different format and location.

## Source Of Truth

Edit these files first:

- `core/global-contract.md` - shared behaviour contract, including Decision Ledger and TDD workflow requirements.
- `core/decision-ledger.md` - mandatory material-decision protocol.
- `core/sensitive-files.md` - human-readable sensitive-file policy.
- `core/guardrails.json` - machine-enforced sensitive-file and dangerous-command policy.
- `core/roles.json` - canonical architect, implementer, reviewer, and security-reviewer agents.
- `core/area-instructions.json` - Copilot area-specific instruction files.
- `core/memory.md`, `core/user-context.md`, `core/workflow.md` - shared memory and workflow prompts, including TDD execution flow.
- `skills/*/SKILL.md` - canonical shared skills copied to all supported tools, including test strategy and validation rules.

After changing `core/*`, run:

```bash
node scripts/generate.js --check
node scripts/doctor.js
```

## Generated Runtime Targets

Generated files are not committed. To inspect them locally, render them into a disposable directory:

```bash
node scripts/generate.js --out /tmp/dotfiles-runtime
```

Runtime files include:

- `claude/CLAUDE.md`, `claude/settings.json`, `claude/agents/*.md`.
- `codex/AGENTS.md`, `codex/config.toml`, `codex/hooks/*`, `codex/agents/*.toml`.
- `copilot/AGENTS.md`, `copilot/copilot-instructions.md`, `copilot/instructions/*.instructions.md`, `copilot/hooks/*`, `copilot/agents/*.agent.md`.

Do not edit generated files by hand. Edit `core/*`, then re-run the installer or render to a disposable directory.

## Guardrails

The most important guardrails are:

- Decision Ledger before every material architecture, config, security, data, testing, performance, workflow, or rollback choice.
- Test-Driven Development (TDD) for behaviour changes: define or add the smallest failing automated test before implementation, or state the no-test rationale explicitly.
- Deterministic denial of `.env*`, local app config, key/cert, and credential files.
- Generated Claude deny rules.
- Generated Codex filesystem deny profile.
- Shared `scripts/guard.js` installed to `~/.local/share/dotfiles/guard.js` and used by Codex/Copilot hooks.
- `codex-safe` and `copilot-safe` wrappers for safer CLI entry points.

## Install

```bash
git clone git@github.com:derricka-lau/dotfiles.git ~/dotfiles
cd ~/dotfiles
./install.sh
```

The installer:

1. Verifies canonical sources and guardrails, including Decision Ledger and TDD policy sources.
2. Backs up managed targets to `~/.dotfiles-backup/<timestamp>/`.
3. Generates runtime files into a temporary directory.
4. Copies generated runtime files into `~/.claude`, `~/.codex`, and `~/.copilot`.
5. Copies shared skills to each tool.
6. Installs the shared guard runtime to `~/.local/share/dotfiles`.
7. Installs CLI wrappers to `~/.local/bin`.
8. Installs or updates Claude Code, Codex, and Copilot CLIs.
9. Installs git config and global git hooks.
10. Writes `~/.dotfiles-manifest`.

## Devcontainers

Use this VS Code host setting:

```json
{
  "dotfiles.repository": "derricka-lau/dotfiles",
  "dotfiles.installCommand": "install-devcontainer.sh",
  "dotfiles.targetPath": "~/dotfiles"
}
```

`install-devcontainer.sh` delegates to `install.sh`, installs distro `bubblewrap` when root and `apt-get` are available, and links `~/.local/bin/codex` to `codex-safe` so devcontainer installs can keep working when the container runtime blocks Codex's inner Linux sandbox.

For VS Code Copilot extension user-level customisation, configure the host-side VS Code settings to point at the installed locations you want loaded. The installer creates the files; VS Code decides which user/workspace locations to load.

## Validate

```bash
node scripts/generate.js --check
rm -rf /tmp/dotfiles-runtime
node scripts/generate.js --out /tmp/dotfiles-runtime
node scripts/generate.js --out /tmp/dotfiles-runtime --check
node scripts/doctor.js
bash -n install.sh install-devcontainer.sh uninstall.sh
```

For a safe install rehearsal:

```bash
HOME="$(mktemp -d)" PATH="$HOME/bin:$PATH" SHELL=/bin/bash bash install.sh
```

Use an npm stub in fake-home rehearsals if you do not want global package installs.
