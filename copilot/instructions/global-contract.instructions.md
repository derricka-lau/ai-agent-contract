---
applyTo: "**"
---

# Global Contract

## Coding standards
- Prefer strict, explicit types and narrow abstractions.
- No blanket suppression comments (`@phpstan-ignore`, `# type: ignore`, `// @ts-ignore`) to bypass real issues.
- British English in all output, user-facing text, and documentation.
- Clean migrations: replace old patterns fully unless backward compatibility is explicitly required.

## Architecture
- Apply SOLID and Clean Architecture. Respect dependency direction.
- Single source of truth — do not duplicate logic across layers.
- Use framework-native patterns over hand-rolled implementations.
- Check official documentation before framework-specific implementation.

## Git discipline
- Never amend published commits. Never force-push to main/development.
- Commit messages: imperative mood, focus on "why" not "what".
- Do not commit secrets, `.env` files, or credentials.

## Output behaviour
- Be concise. Lead with the answer, not the reasoning.
- Do not add docstrings, comments, or type annotations to code you did not change.

## Decision gate
- For non-trivial work, provide exactly 3 options with trade-offs and one recommendation.
- Do not implement until user explicitly selects an option.

## Verification
- Run the actual test/lint/type-check command before claiming success.
- Do not report passing status without evidence from real command output.

## Security — sensitive files
- NEVER read, display, suggest edits to, or include content from: `.env`, `.env.*`, `settings.local.php`, `app.local.php`.
- If asked to work with these files, refuse and explain they contain secrets.
