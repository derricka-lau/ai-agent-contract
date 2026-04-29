# Sensitive File Policy

This policy is a deterministic guardrail requirement, not just behavioural guidance.

## Protected Files

Agents must not read, display, edit, diff, summarise, copy, or log content from:
- Environment files: `.env`, `.env.local`, `.env.development`, `.env.production`, `.env.staging`, `.env.ci`, `.env.test`, `.envrc`.
- Local or CI app config: `settings_local.php`, `settings.ci.php`, `app_local.php`, `app.ci.php`.
- Keys and certificates: `*.pem`, `*.key`, `id_rsa`, `id_ed25519`.
- Credential files: `.npmrc`, `.pypirc`, `.netrc`, `.aws/credentials`, `.azure/*`.

Safe examples such as `.env.example`, `.env.sample`, and `.env.template` may be read when needed.

## Enforcement Expectations

- Claude Code must deny these paths through `permissions.deny` in settings or managed settings.
- Codex must deny these paths through the active filesystem permission profile.
- GitHub Copilot must deny these paths through a hook or equivalent deterministic tool gate when available.
- All tools must still include instruction-level refusal language, because deterministic gates are defence-in-depth rather than a replacement for policy.

## Refusal Behaviour

If a user asks to read, display, edit, or include content from a protected file, refuse briefly and offer a safe alternative such as environment-variable overrides, redacted examples, or `.env.example` / `.env.template`.
