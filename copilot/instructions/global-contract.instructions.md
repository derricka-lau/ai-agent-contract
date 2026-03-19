---
applyTo: "**"
---

# Global Contract

## Coding standards
- Read existing code before modifying any file. Search for existing functionality before creating new files.
- Find 2–3 similar examples in the codebase and follow the same patterns (naming, structure, error handling).
- Prefer strict, explicit types and narrow abstractions.
- No blanket suppression comments (`@phpstan-ignore`, `# type: ignore`, `// @ts-ignore`) to bypass real issues.
- British English in all output, user-facing text, and documentation.
- Clean migrations: replace old patterns fully unless backward compatibility is explicitly required.

## Architecture
- Apply SOLID and Clean Architecture. Respect dependency direction.
- Single source of truth — do not duplicate logic across layers.
- Use framework-native patterns over hand-rolled implementations.
- Check official documentation before framework-specific implementation.
- Verify any API/method exists in the project's framework/library version before using it.

## Dependencies
- Do not add new dependencies without explicit approval.
- Only import packages already in lock files. If a new one is needed, state it explicitly and ask first.
- Pin versions — no floating ranges unless the project already uses them.
- Run dependency audit (`composer audit` / `npm audit`) if dependencies changed.

## Git discipline
- Never amend published commits. Never force-push to main/development.
- Commit messages: imperative mood, focus on "why" not "what".
- Do not commit secrets, `.env` files, or credentials.

## Output behaviour
- Be concise. Lead with the answer, not the reasoning.
- Do not summarise what you just did — the diff speaks for itself.
- Do not add docstrings, comments, or type annotations to code you did not change.
- Do not add error handling for scenarios that cannot happen.

## Decision gate
- For non-trivial work, provide exactly 3 options with trade-offs and one recommendation.
- Do not implement until user explicitly selects an option.

## Verification
- Definition of Done: tests + lint + type-check + static analysis must all pass before claiming success. If any fail, report the exact blocker.
- Do not report passing status without evidence from real command output.
- Improve coverage only through real behavioural tests — do not alter include/exclude scope to inflate numbers.
- Prefer adding tests in existing files unless user explicitly approves new files.
- Test unhappy paths: null/empty input, boundary values, malformed input, and expected error conditions — not just the happy path.

## Documentation hygiene
- Before finishing any workflow, scan all `.md` files for references to changed behaviour, APIs, config, commands, or file paths.
- Update any that are stale — if code changed, docs must match.
- If no docs are affected, state so explicitly.

## Instruction precedence
- Repo-level `.github/copilot-instructions.md` and project `.instructions.md` files can override these globals.
- Avoid conflicting rules between global and repo-level instructions.

## Security — code patterns
- Use parameterised queries / prepared statements / query builders. Never build SQL via string concatenation.
- Deny access by default. Every endpoint must have explicit authorisation checks.
- Never hardcode API keys, passwords, tokens, or connection strings in source code.
- Validate all user input server-side: type, length, range, format. Allowlists over denylists.
- Encode output based on context (HTML, URL, SQL, CSS) to prevent XSS.
- Never silently swallow exceptions. Every catch block must log, re-throw, or return a meaningful error.
- Never log sensitive data (passwords, tokens, PII, session IDs).

## Pre-completion checks
Before marking any task as done, verify:
- No leftover debug statements (`var_dump`, `dd()`, `console.log`, `print()`).
- No hardcoded secrets, tokens, or credentials in the diff.
- No commented-out code added — either keep code or delete it.
- Change actually addresses the original request.
- If a public API signature changed, confirm whether backward compatibility is required.
- For database/schema changes: confirm migration is reversible, state rollback plan, and flag data-loss risk.

## Security — sensitive files
- NEVER read, display, suggest edits to, or include content from these files:
  - Environment: `.env`, `.env.*`, `.envrc`
  - App config: `settings.local.php`, `app.local.php`
  - Keys/certs: `*.pem`, `*.key`, `id_rsa`, `id_ed25519`
  - Credentials: `.npmrc`, `.pypirc`, `.netrc`, `.aws/credentials`, `.azure/*`
- If asked to work with these files, refuse and explain they contain secrets.
