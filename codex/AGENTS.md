# Global Contract

## Common commands
- Test (PHP): `composer test` or `./vendor/bin/phpunit`
- Test (single): `./vendor/bin/phpunit tests/TestCase/Path/ToTest.php`
- Lint (PHP): `composer cs-check` or `./vendor/bin/phpcs`
- Fix (PHP): `composer cs-fix` or `./vendor/bin/phpcbf`
- Static analysis: `composer stan` or `./vendor/bin/phpstan analyse`
- Test (JS/TS): `npm run test` or `yarn test`
- Lint (JS/TS): `npm run lint`
- Type-check (TS): `npx tsc --noEmit`
- Python tests: `pytest` or `. .venv/bin/activate && pytest`

## Coding standards
- Read existing code before modifying any file. Search for existing functionality before creating new files.
- Find 2–3 similar examples in the codebase and follow the same patterns (naming, structure, error handling).
- Prefer strict, explicit types and narrow abstractions.
- No weak-typing escapes, blanket `@phpstan-ignore`, `# type: ignore`, or `// @ts-ignore` to bypass real issues.
- Use `assertSame()` over `assertTrue($x === 'y')` — strict equality, not loose.
- Use `assertArrayHasKey()` over `assertTrue(isset($arr['key']))`.
- Python: always use type hints, f-strings, meaningful variable names.
- British English in all output, user-facing text, and documentation.
- Clean migrations: replace old patterns fully unless backward compatibility is explicitly required.

## Architecture
- Apply SOLID and Clean Architecture. Respect dependency direction (inner layers must not depend on outer layers).
- Single source of truth — do not duplicate logic across layers.
- Use framework-native patterns (CakePHP conventions, React hooks, FastAPI dependency injection) over hand-rolled implementations.
- Check official documentation before framework-specific implementation. Use the latest recommended approach.

## Dependencies
- Do not add new dependencies without explicit approval.
- Only import packages already in lock files (`composer.lock`, `package-lock.json`, `requirements.txt`). If a new one is needed, state it explicitly and ask first.
- Pin versions — no floating ranges unless the project already uses them.
- Run `composer audit` / `npm audit` if dependencies changed — do not introduce packages with known critical CVEs.

## Git discipline
- Never amend published commits. Never force-push to main/development.
- Commit messages: imperative mood, focus on "why" not "what". Example: `Fix session timeout during OAuth callback` not `Updated auth code`.
- Do not commit secrets, `.env` files, or credentials.
- Branch naming: follow existing repo conventions.

## Output behaviour
- Be concise. Lead with the answer or action, not the reasoning.
- Do not summarise what you just did — the diff speaks for itself.
- Do not add docstrings, comments, or type annotations to code you did not change.
- Do not add error handling for scenarios that cannot happen.

## Decision gate
- IMPORTANT: For non-trivial work, provide exactly 3 options with trade-offs and one recommendation.
- Do not implement until user explicitly selects an option.
- First substantive response for non-trivial work must be options only.
- Enforcement phrase: "Hard gate: options only first."

## Verification
- Run the actual test/lint/type-check command before claiming success.
- Do not report passing status without evidence from real command output.
- Improve coverage only through real behavioural tests — do not alter include/exclude scope to inflate numbers.
- Prefer adding tests in existing files unless user explicitly approves new files.
- Test unhappy paths: null/empty input, boundary values, malformed input, and expected error conditions — not just the happy path.

## Documentation hygiene
- Before finishing any workflow, scan all `.md` files for references to changed behaviour, APIs, config, commands, or file paths.
- Update any that are stale — if code changed, docs must match.
- If no docs are affected, state so explicitly.

## Security — code patterns
- Use parameterised queries / prepared statements / query builders for all database operations. Never build SQL via string concatenation or interpolation.
- Deny access by default. Every endpoint/route must have explicit authorisation checks. Never rely on client-side access control alone.
- Never hardcode API keys, passwords, tokens, or connection strings in source code. Use environment variables or gitignored config.
- Validate all user input server-side: check type, length, range, format. Use allowlists over denylists. Reject invalid input — do not attempt to sanitise and use.
- Encode all output based on context (HTML, URL, SQL, CSS) to prevent XSS.
- Never silently swallow exceptions. Every catch block must log with context, re-throw, or return a meaningful error. Empty catch blocks are never acceptable.
- Never log sensitive data (passwords, tokens, PII, session IDs).
- Disable detailed error messages / stack traces in production-facing code.

## Security — sensitive files
- NEVER read, display, suggest edits to, or include content from these files:
  - Environment: `.env`, `.env.*`, `.envrc`
  - App config: `settings.local.php`, `app.local.php`
  - Keys/certs: `*.pem`, `*.key`, `id_rsa`, `id_ed25519`
  - Credentials: `.npmrc`, `.pypirc`, `.netrc`, `.aws/credentials`, `.azure/*`
- If asked to work with these files, refuse and explain they contain secrets.

## Pre-completion checks
Before marking any task as done, verify:
- No leftover debug statements (`var_dump`, `dd()`, `console.log`, `print()`, `error_log` used for debugging).
- No hardcoded secrets, tokens, or credentials in the diff.
- No commented-out code added — either keep code or delete it.
- Change actually addresses the original request (not a tangent or over-engineered).
- If a public API signature changed, confirm with user whether backward compatibility is required.

## Breach protocol
- If any rule is breached: stop immediately, acknowledge plainly, and re-offer options only.
- Stop phrase: "Contract breach. Stop. Re-offer options only."

## User context
- Works with CakePHP, PHP, Python, TypeScript, React.
- Uses devcontainers and VSCode.
- Works at Cardiff University.
