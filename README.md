# ai-agent-contract

A source-driven contract and deterministic local guardrail setup for GitHub Copilot CLI, OpenAI Codex, and Claude Code.

The contract keeps human judgement in charge. It requires test-first behaviour changes, root-cause fixes, one source of truth, simple designs, and consideration of total engineering and operating cost.

## What Is Authoritative

The repository separates canonical sources from generated and installed outputs:

- `core/global-contract.md` defines shared engineering behaviour.
- `core/decision-ledger.md` defines normal `D1`/`D2`/`D3` review.
- `core/guardrails.json` is the single machine-readable source for sensitive paths and dangerous command patterns.
- `core/sensitive-files.md` explains the policy. Its pattern list is generated from `core/guardrails.json`; the Markdown file is not the enforcement mechanism.
- `core/runtime-profiles.json` defines Codex runtime profiles and the default profile.
- `core/roles.json`, `core/area-instructions.json`, `core/coach.md`, `core/user-context.md`, and `core/workflow.md` define their named contract surfaces.
- `skills/*/SKILL.md` contains canonical shared skills.

Generated runtime files are disposable outputs. Do not edit them by hand. Update the relevant canonical source and regenerate.

When guidance conflicts, platform and security constraints come first, followed by the most specific applicable source. The latest applicable, explicitly approved decision replaces older task-local guidance, and superseded documentation or configuration must be removed in the same change.

## Deterministic Sensitive-File Enforcement

Sensitive-file protection is implemented in code and runtime configuration:

- Copilot CLI runs the shared guard from a user-level `preToolUse` hook using the [current Copilot hook schema](https://docs.github.com/en/copilot/reference/hooks-reference).
- Codex uses OS-enforced named permission profiles with deny-read globs, plus an all-tool `PreToolUse` hook as defence in depth. Permission profiles require Codex 0.138.0 or later and replace the older `sandbox_mode` configuration; see [Codex permissions](https://learn.chatgpt.com/docs/permissions).
- Claude Code installs native `permissions.deny` rules and an all-tool `PreToolUse` hook backed by the shared guard.
- Generated instructions also require refusal, but instructions are not treated as the deterministic control.

The machine patterns live only in `core/guardrails.json`. `scripts/generate.js` derives runtime permission rules and the human-readable list from that source, while `scripts/doctor.js` checks for drift and exercises denial cases without opening protected files.

## Quality And Cost Defaults

The shared contract explicitly requires:

- The simplest correct, secure, compatible, and testable design.
- Root-cause fixes instead of hacks, coding workarounds, silent fallbacks, compatibility shims, duplicated special cases, or blanket suppressions.
- One authoritative source for every rule, value, schema, and behaviour.
- Material implementation, review, maintenance, CI, runtime, model/API, network, and storage costs to be considered and surfaced.
- Final documentation to describe the resulting implementation, not a planned transition.

Codex profiles are generated from `core/runtime-profiles.json`. The default does not force Fast mode, because Fast mode consumes extra credits. The `quick` profile is the lower-cost path for lighter work; deeper profiles retain stronger reasoning. Current model and effort selections remain centralised in that JSON file.

Claude agents inherit the active session's model and effort instead of forcing Opus/max. The four web-search skills are explicit opt-in modes, so installing the skill catalogue does not trigger contradictory quick/deep searches on every message.

## Generated Runtime Targets

Render the current outputs into a disposable directory:

```bash
runtime_dir="$(mktemp -d)"
node scripts/generate.js --out "$runtime_dir"
node scripts/generate.js --out "$runtime_dir" --check
printf 'Generated runtime: %s\n' "$runtime_dir"
```

The output contains:

- Claude instructions, settings, hooks, agents, prompts, and coach skills.
- Codex instructions, permission configuration, hooks, agents, profiles, prompts, and coach skills.
- Copilot instructions, hooks, agents, prompts, and coach skills.
- The VS Code settings fragment used to avoid loading the shared contract twice.

## Install

Prerequisites are Git, Node.js, and npm. Node.js 22 is the tested version.

```bash
git clone git@github.com:derricka-lau/ai-agent-contract.git ~/ai-agent-contract
cd ~/ai-agent-contract
./install.sh
```

The installer intentionally does not install or upgrade Claude Code, Codex, or Copilot CLI. Manage those tools separately using their official installation methods. This avoids unpinned global upgrades and keeps configuration lifecycle separate from executable lifecycle.

`install.sh`:

1. Installs the single pinned project dependency with lifecycle scripts, install-time audit, and funding output disabled.
2. Runs the generator and doctor before changing user configuration.
3. Generates runtime files in a temporary directory.
4. Acquires an atomic operation lock.
5. Preflights every previously managed value and aborts before mutation if a managed file, field, shell line, or Git value has changed.
6. Applies exact-file changes through a rollback journal.
7. Merges only the owned VS Code JSONC fields while preserving comments and unrelated settings.
8. Adds only the exact `~/.local/bin` shell line when needed.
9. Sets only Git's global `core.hooksPath`, retaining its previous value for uninstall.
10. Writes the versioned ownership ledger to `~/.local/share/ai-agent-contract/install-state.json`.

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

When desktop VS Code's user settings directory exists, installation merges the fields from `core/vscode-settings.json` into:

- macOS: `~/Library/Application Support/Code/User/settings.json`
- Linux: `${XDG_CONFIG_HOME:-~/.config}/Code/User/settings.json`

The JSONC-aware merge preserves comments, trailing commas, and unrelated settings. VS Code Insiders, VSCodium, Windows, and remote/container settings are not changed automatically.

## Devcontainers

Use this VS Code host setting:

```json
{
  "dotfiles.repository": "derricka-lau/ai-agent-contract",
  "dotfiles.installCommand": "install-devcontainer.sh",
  "dotfiles.targetPath": "~/ai-agent-contract"
}
```

`install-devcontainer.sh` delegates configuration installation to `install.sh`, installs the distribution `bubblewrap` package when running as root with `apt-get` available, and verifies that Bubblewrap can create the namespaces required by Codex. Installing the package alone is insufficient when the outer container's security policy blocks namespace creation.

If the preflight fails, add the following settings to the project's `devcontainer.json` and rebuild the devcontainer:

```json
{
  "runArgs": [
    "--cap-add=SYS_ADMIN",
    "--security-opt=seccomp=unconfined",
    "--security-opt=apparmor=unconfined"
  ]
}
```

These settings relax the outer Docker sandbox so that Codex can construct its own inner Bubblewrap sandbox. Use them only for a trusted development container. The installer does not create an unmanaged `codex` symlink, make Bubblewrap setuid, or replace a failed sandbox with unrestricted execution. Do not use Codex dangerous-access flags as a workaround. If the preflight still fails after rebuilding, follow the current [Codex sandbox prerequisites](https://learn.chatgpt.com/docs/sandboxing#prerequisites) for the host platform.

Use `codex-safe` or `copilot-safe` explicitly when you want the repository's wrapper behaviour.

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
bash -n install.sh install-devcontainer.sh uninstall.sh codex-safe copilot-safe hooks/pre-commit hooks/pre-push
git diff --check
npm audit --omit=dev
```

CI runs the lockfile install, complete Node test suite, generator, doctor, JavaScript syntax checks, shell syntax checks, and diff hygiene on Node.js 22.
