# Sensitive File Policy

This policy is a deterministic guardrail requirement, not just behavioural guidance.

## Protected Files

Agents must not read, display, edit, diff, summarise, copy, or log content matching the protected rules below, in any letter case. Template copies marked as safe (a protected name followed by a safe marker) may be read when needed.

<!-- GENERATED: sensitive-file-patterns -->

## Enforcement Expectations

- GitHub Copilot must deny protected paths through a hook or equivalent deterministic tool gate when available.
- Compatible Codex installations must apply the sensitive-file guard through a trusted `PreToolUse` hook where that hook can observe the tool call.
- Compatible Claude Code settings must deny protected paths through `permissions.deny` in settings or managed settings.
- Compatible Antigravity installations must deny protected paths through the generated plugin `PreToolUse` hook backed by the shared guard.
- All tools must also include instruction-level refusal language, because deterministic gates are defence-in-depth rather than a replacement for policy.

## Known Limits

The guard reads tool inputs before they run. It resolves quoting, brace expansion and globs that could match a protected name, but it cannot see values built at run time (shell variables, command substitution, scripts that compute a path). Instruction-level refusal remains required.

## Refusal Behaviour

If a user asks to read, display, edit, or include content from a protected file, refuse briefly and offer a safe alternative such as environment-variable overrides, redacted examples, or a safe example configuration.
