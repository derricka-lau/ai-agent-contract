# Robustness And Consistency Matrix

This document defines the hardened baseline and parity map across the three configured stacks in this repository: Claude Code, Codex CLI, and GitHub Copilot.

## Goal

- Keep behaviour consistent across planning, implementation, review, and security workflows.
- Provide deterministic safety controls where each platform supports them.
- Keep setup reproducible through install and verification scripts.

## Persona Parity

| Workflow role | Claude Code | Codex CLI | GitHub Copilot |
|---|---|---|---|
| Plan and map impact | `claude/agents/architect.md` | `codex/agents/explorer.toml` | `copilot/agents/architect.agent.md` |
| Implement minimal diff | `claude/agents/implementer.md` | `codex/agents/implementer.toml` | `copilot/agents/implementer.agent.md` |
| Read-only code review | `claude/agents/reviewer.md` | `codex/agents/reviewer.toml` | `copilot/agents/reviewer.agent.md` |
| Security review | `claude/agents/security-reviewer.md` | `codex/agents/security.toml` | `copilot/agents/security-reviewer.agent.md` |

## Safety Parity

| Control layer | Claude Code | Codex CLI | GitHub Copilot |
|---|---|---|---|
| Contract guidance | `claude/CLAUDE.md` | `codex/AGENTS.md` | `copilot/AGENTS.md` and `copilot/copilot-instructions.md` |
| Sensitive file protection | `claude/settings.json` deny rules | `codex/config.toml` global_lockdown filesystem denies | Instruction guidance plus command/tool deny gates |
| Deterministic command guard | Managed permission model | `codex/hooks/pre-command-guard.sh` | `copilot/hooks/policy.json` + `copilot/hooks/pre-tool-guard.sh` |
| Completion gate | Stop notification hook | `codex/hooks/stop-reminder.sh` | Review-first workflow via agent handoffs and validation contract |
| Runtime wrapper | N/A | `codex-safe` | `copilot-safe` |

## Shared Assets

| Capability | Source path |
|---|---|
| Global behaviour contract | `claude/CLAUDE.md`, `codex/AGENTS.md`, `copilot/AGENTS.md` |
| Memory context | `claude/MEMORY.md`, `codex/MEMORY.md`, `copilot/MEMORY.md` |
| Shared skills | `skills/*/SKILL.md` |
| Workflow prompts | `prompts/workflow.md` |

## Install Targets

| Stack | Target path |
|---|---|
| Claude Code | `~/.claude/` |
| Codex CLI | `~/.codex/` and `~/.local/bin/codex-safe` |
| GitHub Copilot | `~/.copilot/` and `~/.local/bin/copilot-safe` |

## Operational Defaults

- Prefer plan-first for non-trivial tasks.
- Keep diffs minimal and validate with lint, type-check, and tests.
- Use read-only reviewer and security personas before merge when risk is non-trivial.
- Prefer wrappers (`codex-safe`, `copilot-safe`) when running autonomous flows.

## Verification Expectations

`install.sh` should verify the following at minimum:

- Instructions and contracts are installed for all three.
- Persona files are present for all three.
- Guardrails (hooks and wrappers) are present and executable where applicable.
- Shared skills, memory, and prompts are present for all three.

