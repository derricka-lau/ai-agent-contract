# ai-agent-contract

A source-driven contract and deterministic local guardrail setup for GitHub Copilot CLI, OpenAI Codex, Claude Code, and Google Antigravity.

The contract keeps human judgement in charge. It requires test-first behaviour changes, root-cause fixes, one source of truth, simple designs, Conventional Commits without AI attribution, and consideration of total engineering and operating cost.

## What Is Authoritative

The repository separates canonical sources from generated and installed outputs:

- `core/global-contract.md` defines shared engineering behaviour and Git commit standards.
- `core/decision-ledger.md` defines concise `D1`/`D2`/`D3` review rules (with `D3` as default); `skills/decision-ledger/SKILL.md` provides the full on-demand template and `Scope Anchors` reference.
- `core/guardrails.json` is the single machine-readable source for sensitive paths.
- `core/sensitive-files.md` explains the policy. Its pattern list is generated from `core/guardrails.json`; the Markdown file is not the enforcement mechanism.
- `core/area-instructions.json`, `core/coach.md`, `core/user-context.md`, and `core/workflow.md` define their named contract surfaces.
- `skills/*/SKILL.md` contains canonical shared skills (`decision-ledger`, `plan-mode`, `implement-mode`, `web-research`, `review-risk`, `php-cakephp`, `python`, `typescript-react`).
- `hooks/commit-msg` provides optional deterministic enforcement of Conventional Commits and bans `Co-authored-by:` trailers and AI/tool attribution.

Generated runtime files are disposable outputs. Do not edit them by hand. Update the relevant canonical source and regenerate.

When guidance conflicts, platform and security constraints come first, followed by the most specific applicable source. The latest applicable, explicitly approved decision replaces older task-local guidance, and superseded documentation or configuration must be removed in the same change.

## Deterministic Sensitive-File Enforcement

The deterministic enforcement layer is installed only by the `hardened` profile. The default `prompt` profile provides portable guidance and does not claim to enforce sensitive-file policy.

Sensitive-file protection is implemented in code and runtime configuration:

- Copilot CLI runs the shared guard from a user-level `preToolUse` hook using the [current Copilot hook schema](https://docs.github.com/en/copilot/reference/hooks-reference).
- Codex installs only a standalone `hooks.json` and the shared sensitive-file guard. The contract leaves native sandbox, permission, model, approval, and feature settings to Codex and the host or administrator policy. Codex requires trust review before a non-managed hook runs, and some tool paths are outside hook coverage.
- Claude Code installs native `permissions.deny` rules and an all-tool `PreToolUse` hook backed by the shared guard.
- Antigravity installs a native global plugin at `~/.gemini/config/plugins/ai-agent-contract/` with a root `hooks.json` `PreToolUse` hook backed by the shared guard.
- Generated instructions also require refusal, but instructions are not treated as the deterministic control.

The machine patterns live only in `core/guardrails.json`. `scripts/generate.js` derives the tool-specific guard integration and human-readable list from that source, while `scripts/doctor.js` checks for drift and exercises denial cases without opening protected files.

## Quality And Cost Defaults

The shared contract explicitly requires:

- The simplest correct, secure, compatible, and testable design.
- Root-cause fixes instead of hacks, coding workarounds, silent fallbacks, compatibility shims, duplicated special cases, or blanket suppressions.
- One authoritative source for every rule, value, schema, and behaviour.
- Material implementation, review, maintenance, CI, runtime, model/API, network, and storage costs to be considered and surfaced.
- Final documentation to describe the resulting implementation, not a planned transition.

The contract does not select models or reasoning effort for any tool. `web-research` is a single explicit opt-in skill supporting quick, deep, and primary-source-led research scoped strictly to the requested task.

## Generated Runtime Targets

Generation is split into two explicit profiles. `prompt` is the default and contains portable instructions, workflow prompts, area instructions, Antigravity plugin rules, and the unified `coach-mode` skill. `hardened` adds only the tool-specific sensitive-file hooks and Claude deny rules needed to use the shared guard.

Render the current outputs into a disposable directory:

```bash
runtime_dir="$(mktemp -d)"
node scripts/generate.js --profile prompt --out "$runtime_dir"
node scripts/generate.js --profile prompt --out "$runtime_dir" --check
node scripts/generate.js --profile hardened --out "$runtime_dir"
printf 'Generated runtime: %s\n' "$runtime_dir"
```

The prompt output contains:

- Claude, Codex, Copilot, and Antigravity (`~/.gemini/config/plugins/ai-agent-contract/`) instructions and prompts.
- Shared area instructions and the unified `coach-mode` skill (installed to `~/.claude`, `~/.codex`, `~/.copilot`, and `~/.agents` for Antigravity without plugin duplication).

The hardened output adds sensitive-file controls for each tool. It does not select or configure a sandbox, model, approval policy, feature, agent, or editor setting.

## Install

Prerequisites are Git, Node.js, and npm. Node.js 22 is the tested version.

```bash
git clone git@github.com:derricka-lau/ai-agent-contract.git ~/ai-agent-contract
cd ~/ai-agent-contract
./install.sh
```

Options:

- `./install.sh` — installs the default `prompt` profile without touching tool hooks or global Git config.
- `./install.sh --profile hardened` — adds deterministic sensitive-file hooks for Claude Code, Codex, Copilot CLI, and Antigravity. Review and trust the Codex hook when prompted; an untrusted hook is skipped.
- `./install.sh --git-hooks` (combinable with either profile, e.g. `./install.sh --profile hardened --git-hooks`) — also installs `~/.git-hooks/commit-msg` and manages global `core.hooksPath` to enforce Conventional Commits and block any `Co-authored-by:` or AI attribution trailers.

The installer intentionally does not install or upgrade Claude Code, Codex, Copilot CLI, or Antigravity. Manage those tools separately using their official installation methods.

`install.sh`:

1. Installs the single pinned project dependency with lifecycle scripts, install-time audit, and funding output disabled.
2. Runs the generator before changing user configuration; the `hardened` profile also runs the compatibility doctor.
3. Generates runtime files in a temporary directory.
4. Acquires an atomic operation lock.
5. Preflights every previously managed value and aborts before mutation if a managed file, field, shell line, or Git value has changed.
6. Applies exact-file changes through a rollback journal.
7. Restores previously owned editor, shell, Git, or tool settings during an update when they still match the ownership ledger.
8. Writes the versioned ownership ledger to `~/.local/share/ai-agent-contract/install-state.json`.

The installer never copies or deletes whole runtime directories, never overwrites Git identity files, and never writes the legacy timestamp backup or checksum manifest. Previous content for an overwritten managed file is stored by checksum with mode `0600` and pruned when no ledger entry needs it.

## Update Conflicts

Run `./install.sh` again after changing or pulling canonical sources. An update stops before mutation if a previously managed value no longer matches the ledger. Resolve that conflict explicitly rather than silently overwriting the user change.

Unrelated files inside `~/.claude`, `~/.codex`, `~/.copilot`, `~/.agents`, `~/.gemini/config`, and other target directories are not owned and are left untouched.

## Uninstall

```bash
cd ~/ai-agent-contract
./uninstall.sh
```

Uninstall restores or removes only ledger-owned values:

- An unchanged managed file is restored to its pre-install content or removed if it did not exist before installation.
- A user-modified managed file is preserved.
- Owned JSON/JSONC settings fields (such as Claude `permissions.deny` and `hooks.PreToolUse`) are restored only when their current values still match the installed values; unrelated fields and comments remain.
- The installed shell line and Git hook path are restored only when still owned.
- Unrelated files and settings are never removed.

If no valid ledger exists, uninstall is a safe no-op.

## Interrupted Operations

Install and uninstall use an atomic lock directory with PID and token metadata. A live lock is never removed automatically.

If a process was terminated, first remove only a verified stale lock:

```bash
node scripts/managed-files.js unlock --home "$HOME"
```

Then recover any journalled partial transaction:

```bash
node scripts/managed-files.js recover --home "$HOME"
```

Recovery restores the exact pre-transaction file contents, modes, and Git value before another install or uninstall proceeds.

## Coach Mode

A single opt-in `coach-mode` skill is generated from `core/coach.md` with three depths:

- `guide`: guidance only; the user writes test, scaffolding, and logic.
- `scaffolding` (default): the agent writes the failing test and scaffolding; the user writes the decision-bearing logic.
- `tutor`: scaffolding plus line-by-line teaching while the user writes the logic.

## Validate

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run check
for file in scripts/*.js; do node --check "$file"; done
bash -n install.sh install-devcontainer.sh uninstall.sh hooks/commit-msg
git diff --check
npm audit --omit=dev
```

CI runs the lockfile install, complete Node test suite, generator, doctor, JavaScript syntax checks, shell syntax checks, and diff hygiene on Node.js 22.
