# ai-agent-contract

Source-driven setup for popular AI coding tools, including GitHub Copilot, OpenAI Codex, Claude Code, Google Antigravity, and more, with deterministic guardrails for human judgement, Decision Ledger review, and Test-Driven Development (TDD).

Even if AI can draft, search, and implement more of the work, it cannot own the decision, context, risk, or accountability. This repo makes Copilot pause at those points: material decisions go through the Decision Ledger review ladder, and behaviour changes start with the smallest relevant test case before implementation.

The repo has one source of truth under `core/`. Copilot instructions, hooks, agents, and prompts are generated during install, with additional local agent outputs available from the same contract when needed.

## Core Ideas

- Human judgement stays in charge: AI proposes trade-offs, risks, and tests; the human reviews the decision and the first test case before implementation.
- The Decision Ledger is the review ladder for material choices, from broad architecture down to testing, rollback, and workflow decisions.
- TDD is the implementation gate: define or add the smallest failing automated test first, or state the no-test rationale explicitly before editing implementation.
- GitHub Copilot, OpenAI Codex, Claude Code, Google Antigravity, and future agent runtimes can share the same source contract.

## Source Of Truth

Edit these files first:

- `core/global-contract.md` - shared behaviour contract, including human review, Decision Ledger, and TDD workflow requirements.
- `core/decision-ledger.md` - mandatory material-decision protocol.
- `core/sensitive-files.md` - human-readable sensitive-file policy.
- `core/guardrails.json` - machine-enforced sensitive-file and dangerous-command policy.
- `core/roles.json` - canonical architect, implementer, reviewer, and security-reviewer agents.
- `core/area-instructions.json` - Copilot area-specific instruction files.
- `core/user-context.md`, `core/workflow.md` - shared user context and workflow prompts, including TDD execution flow.
- `skills/*/SKILL.md` - canonical shared skills copied to Copilot and compatible tool runtimes, including test strategy and validation rules.

After changing `core/*`, run:

```bash
node scripts/generate.js --check
node scripts/doctor.js
```

## Generated Runtime Targets

Generated files are not committed. To inspect them locally, render them into a disposable directory:

```bash
node scripts/generate.js --out /tmp/ai-agent-contract-runtime
```

Runtime files include the Copilot-first surface and compatible secondary surfaces:

- `copilot/instructions/*.instructions.md`, `copilot/hooks/*`, `copilot/agents/*.agent.md`.
- Additional tool-specific runtime directories for compatible local agent CLIs.

Do not edit generated files by hand. Edit `core/*`, then re-run the installer or render to a disposable directory.

## Guardrails

The most important guardrails are:

- Decision Ledger before every material architecture, config, security, data, testing, performance, workflow, or rollback choice.
- Human review of the chosen decision path and the first relevant test case before implementation.
- Test-Driven Development (TDD) for behaviour changes: define or add the smallest failing automated test before implementation, or state the no-test rationale explicitly.
- Deterministic denial of `.env*`, local app config, key/cert, and credential files.
- Copilot instructions, hooks, and area-specific guidance generated from the same source contract.
- Additional runtime-specific deny rules and filesystem guardrails generated from the same source contract.
- Shared `scripts/guard.js` installed to `~/.local/share/ai-agent-contract/guard.js` and used by Copilot hooks and compatible secondary hooks.
- Safe CLI wrappers for Copilot and compatible secondary runtimes.

## Install

```bash
git clone git@github.com:derricka-lau/ai-agent-contract.git ~/ai-agent-contract
cd ~/ai-agent-contract
./install.sh
```

The installer:

1. Verifies canonical sources and guardrails, including Decision Ledger and TDD policy sources.
2. Backs up managed targets to `~/.ai-agent-contract-backup/<timestamp>/`.
3. Generates runtime files into a temporary directory.
4. Copies generated Copilot runtime files into `~/.copilot`, plus compatible secondary runtime files when available.
5. Copies shared skills to each supported runtime.
6. Installs the shared guard runtime to `~/.local/share/ai-agent-contract`.
7. Installs CLI wrappers to `~/.local/bin`.
8. Installs or updates the Copilot CLI and compatible secondary CLIs.
9. Installs git config and global git hooks.
10. Writes `~/.ai-agent-contract-manifest`.

## Devcontainers

Use this VS Code host setting:

```json
{
  "dotfiles.repository": "derricka-lau/ai-agent-contract",
  "dotfiles.installCommand": "install-devcontainer.sh",
  "dotfiles.targetPath": "~/ai-agent-contract"
}
```

`install-devcontainer.sh` delegates to `install.sh`, installs distro `bubblewrap` when root and `apt-get` are available, and keeps the optional secondary CLI routed through its safe wrapper so devcontainer installs can keep working if the container runtime blocks that CLI's inner Linux sandbox.

For VS Code Copilot extension user-level customisation, configure the host-side VS Code settings to point at the installed locations you want loaded. The installer creates the files; VS Code decides which user/workspace locations to load.

The VS Code Copilot extension can read both Copilot instruction files and other generated instruction files, which can load the shared contract twice. The installer keeps Copilot focused on its generated instruction files by merging the setting from `core/vscode-settings.json` into your desktop VS Code user `settings.json`:

- macOS: `~/Library/Application Support/Code/User/settings.json`
- Linux: `~/.config/Code/User/settings.json`

The merge is idempotent, backs up the existing file first, and preserves your other settings; it is skipped if VS Code is not installed or the file contains comments. This loads the contract once in Copilot (from `~/.copilot/instructions/`) while preserving the area-specific `applyTo` rules. Other local agent CLIs can still read their own generated instruction files if you use them; this setting only affects the VS Code Copilot extension. VS Code Insiders, VSCodium, and devcontainer/remote settings are not covered automatically — apply the setting there yourself if needed.

## Coach Modes

Three opt-in coaching modes let the AI do everything except write the
decision-bearing implementation, so you keep your engineering judgement sharp.
They inherit the full contract; the Decision Ledger still settles architecture
and dependencies first. The modes differ only in how much the AI writes into the
files; in all three it researches, summarises the agreed decisions, specifies the
failing test, hands the logic to you with a `TODO(human)` marker, and reviews what
you write.

- `guide`: guidance only, no file writing. The AI gives the spec, checklist, and
  steps in chat; you write the test, the scaffolding, and the logic. Maximum
  practice for keeping an already-known skill warm.
- `scaffolding`: the AI writes the failing test and the scaffolding (signature,
  imports, structure) into the files; you write the logic. Skips boilerplate
  typing.
- `tutor` (token-heavy): as scaffolding, plus a line-by-line explanation while you
  write the logic, for learning a new area from scratch.

All three render from one source, `core/coach.md`, into one composed `SKILL.md` per mode, installed to each tool's skills directory.Re-invoke if the mode drifts in a long session.


## Validate

```bash
node scripts/generate.js --check
rm -rf /tmp/ai-agent-contract-runtime
node scripts/generate.js --out /tmp/ai-agent-contract-runtime
node scripts/generate.js --out /tmp/ai-agent-contract-runtime --check
node scripts/doctor.js
bash -n install.sh install-devcontainer.sh uninstall.sh
```

For a safe install rehearsal:

```bash
HOME="$(mktemp -d)" PATH="$HOME/bin:$PATH" SHELL=/bin/bash bash install.sh
```

Use an npm stub in fake-home rehearsals if you do not want global package installs.
