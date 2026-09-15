# ai-agent-contract

A source-driven contract and deterministic local guardrail setup for GitHub Copilot CLI, OpenAI Codex, and Claude Code.

The contract keeps human judgement in charge. It requires test-first behaviour changes, root-cause fixes, one source of truth, simple designs, and consideration of total engineering and operating cost.

## What Is Authoritative

The repository separates canonical sources from generated and installed outputs:

- `core/global-contract.md` defines shared engineering behaviour.
- `core/decision-ledger.md` defines normal `D1`/`D2`/`D3` review.
- `core/guardrails.json` is the single machine-readable source for sensitive paths.
- `core/sensitive-files.md` explains the policy. Its pattern list is generated from `core/guardrails.json`; the Markdown file is not the enforcement mechanism.
- `core/area-instructions.json`, `core/coach.md`, `core/user-context.md`, and `core/workflow.md` define their named contract surfaces.
- `skills/*/SKILL.md` contains canonical shared skills.

Generated runtime files are disposable outputs. Do not edit them by hand. Update the relevant canonical source and regenerate.

When guidance conflicts, platform and security constraints come first, followed by the most specific applicable source. The latest applicable, explicitly approved decision replaces older task-local guidance, and superseded documentation or configuration must be removed in the same change.

## Deterministic Sensitive-File Enforcement

The deterministic enforcement layer is installed only by the `hardened` profile. The default `prompt` profile provides portable guidance and does not claim to enforce sensitive-file policy.

Sensitive-file protection is implemented in code and runtime configuration:

- Copilot CLI runs the shared guard from a user-level `preToolUse` hook using the [current Copilot hook schema](https://docs.github.com/en/copilot/reference/hooks-reference).
- Codex installs only a standalone `hooks.json` and the shared sensitive-file guard. The contract leaves native sandbox, permission, model, approval, and feature settings to Codex and the host or administrator policy. Codex requires trust review before a non-managed hook runs, and some tool paths are outside hook coverage.
- Claude Code installs native `permissions.deny` rules and an all-tool `PreToolUse` hook backed by the shared guard.
- Generated instructions also require refusal, but instructions are not treated as the deterministic control.

The machine patterns live only in `core/guardrails.json`. `scripts/generate.js` derives the tool-specific guard integration and human-readable list from that source, while `scripts/doctor.js` checks for drift and exercises denial cases without opening protected files.

## Quality And Cost Defaults

The shared contract explicitly requires:

- The simplest correct, secure, compatible, and testable design.
- Root-cause fixes instead of hacks, coding workarounds, silent fallbacks, compatibility shims, duplicated special cases, or blanket suppressions.
- One authoritative source for every rule, value, schema, and behaviour.
- Material implementation, review, maintenance, CI, runtime, model/API, network, and storage costs to be considered and surfaced.
- Final documentation to describe the resulting implementation, not a planned transition.

The contract does not select models or reasoning effort for any tool. The four web-search skills are explicit opt-in modes, so installing the skill catalogue does not trigger contradictory quick/deep searches on every message.

## Generated Runtime Targets

Generation is split into two explicit profiles. `prompt` is the default and contains portable instructions, workflow prompts, area instructions, and coach skills. `hardened` adds only the tool-specific sensitive-file hooks and Claude deny rules needed to use the shared guard.

Render the current outputs into a disposable directory:

```bash
runtime_dir="$(mktemp -d)"
node scripts/generate.js --profile prompt --out "$runtime_dir"
node scripts/generate.js --profile prompt --out "$runtime_dir" --check
node scripts/generate.js --profile hardened --out "$runtime_dir"
printf 'Generated runtime: %s\n' "$runtime_dir"
```

The prompt output contains:

- Claude, Codex, and Copilot instructions and prompts.
- Shared area instructions and coach skills.

The hardened output adds sensitive-file controls for each tool. It does not select or configure a sandbox, model, approval policy, feature, agent, editor, or Git setting.

## Install

Prerequisites are Git, Node.js, and npm. Node.js 22 is the tested version.

```bash
git clone git@github.com:derricka-lau/ai-agent-contract.git ~/ai-agent-contract
cd ~/ai-agent-contract
./install.sh
```

The installer defaults to the `prompt` profile. Use `./install.sh --profile hardened` when you want the sensitive-file controls and have verified that your tool versions support the installed hooks. Review and trust the Codex hook when prompted; an untrusted hook is skipped.

The installer intentionally does not install or upgrade Claude Code, Codex, or Copilot CLI. Manage those tools separately using their official installation methods. This avoids unpinned global upgrades and keeps configuration lifecycle separate from executable lifecycle.

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

Tool CLI installation references:

- [GitHub Copilot CLI](https://docs.github.com/en/copilot/how-tos/copilot-cli/set-up-copilot-cli/install-copilot-cli)
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code/getting-started)
- [OpenAI Codex](https://learn.chatgpt.com/docs/codex)

## Update Conflicts

Run `./install.sh` again after changing or pulling canonical sources. An update stops before mutation if a previously managed value no longer matches the ledger. Resolve that conflict explicitly rather than silently overwriting the user change.

Unrelated files inside `~/.claude`, `~/.codex`, `~/.copilot`, `~/.agents`, and other target directories are not owned and are left untouched.

## Uninstall

```bash
cd ~/ai-agent-contract
./uninstall.sh
```

Uninstall restores or removes only ledger-owned values:

- An unchanged managed file is restored to its pre-install content or removed if it did not exist before installation.
- A user-modified managed file is preserved.
- Owned VS Code fields are restored only when their current values still match the installed values; unrelated fields and comments remain.
- The installed shell line and Git hook path are restored only when still owned.
- Unrelated files and settings are never removed.

If no valid ledger exists, uninstall is a safe no-op. There is no legacy manifest fallback because directory-level ownership cannot be inferred safely.

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

## VS Code

The current installer does not change VS Code settings. If an older installation owned a VS Code setting, an update or uninstall restores that value only when it still matches the ledger; comments and unrelated settings remain intact.

## Devcontainers

The contract installer does not install Bubblewrap, change container namespace permissions, or run a Codex sandbox preflight. Codex's own sandbox may still need host support; follow the current [Codex sandbox prerequisites](https://learn.chatgpt.com/docs/sandboxing#prerequisites) if Codex commands fail.

Use this VS Code host setting:

```json
{
  "dotfiles.repository": "derricka-lau/ai-agent-contract",
  "dotfiles.installCommand": "install-devcontainer.sh",
  "dotfiles.targetPath": "~/ai-agent-contract"
}
```

`install-devcontainer.sh` delegates configuration installation to `install.sh`. Native Windows sandbox setup is likewise owned by Codex, not by this repository. These Bash installers have not been validated as a native Windows installation path.

## Coach Modes

Three opt-in modes are generated from the single `core/coach.md` source:

- `guide-mode`: guidance only; the user writes test, scaffolding, and logic.
- `scaffolding-mode`: the agent writes the failing test and scaffolding; the user writes the decision-bearing logic.
- `tutor-mode`: scaffolding plus line-by-line teaching while the user writes the logic.

## Validate

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run check
for file in scripts/*.js; do node --check "$file"; done
bash -n install.sh install-devcontainer.sh uninstall.sh
git diff --check
npm audit --omit=dev
```

CI runs the lockfile install, complete Node test suite, generator, doctor, JavaScript syntax checks, shell syntax checks, and diff hygiene on Node.js 22.
