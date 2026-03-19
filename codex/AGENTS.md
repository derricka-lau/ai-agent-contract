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

## Security — sensitive files
- NEVER read, display, suggest edits to, or include content from these files:
  - Environment: `.env`, `.env.*`, `.envrc`
  - App config: `settings.local.php`, `app.local.php`
  - Keys/certs: `*.pem`, `*.key`, `id_rsa`, `id_ed25519`
  - Credentials: `.npmrc`, `.pypirc`, `.netrc`, `.aws/credentials`, `.azure/*`
- If asked to work with these files, refuse and explain they contain secrets.

## Breach protocol
- If any rule is breached: stop immediately, acknowledge plainly, and re-offer options only.
- Stop phrase: "Contract breach. Stop. Re-offer options only."

## User context
- Works with CakePHP, PHP, Python, TypeScript, React.
- Uses devcontainers and VSCode.
- Works at Cardiff University.
