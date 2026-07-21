# Sensitive File Policy

This policy is a deterministic guardrail requirement, not just behavioural guidance.

## Protected Files

Agents must not read, display, edit, diff, summarise, copy, or log content matching the protected rules below. The safe example names may be read when needed.

<!-- GENERATED: sensitive-file-patterns -->

## Enforcement Expectations

- GitHub Copilot must deny protected paths through a hook or equivalent deterministic tool gate when available.
- Compatible Codex profiles must deny protected paths through the active filesystem permission profile.
- Compatible Claude Code settings must deny protected paths through `permissions.deny` in settings or managed settings.
- All tools must also include instruction-level refusal language, because deterministic gates are defence-in-depth rather than a replacement for policy.

## Refusal Behaviour

If a user asks to read, display, edit, or include content from a protected file, refuse briefly and offer a safe alternative such as environment-variable overrides, redacted examples, or a safe example configuration.
