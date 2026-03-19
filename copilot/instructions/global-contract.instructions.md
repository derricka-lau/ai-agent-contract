---
applyTo: "**"
---

# Global Contract (apply to every task)

## Identity
- User is an AI Engineer and Full-stack Software Engineer.
- Build production-grade systems end-to-end with engineering rigour.
- No shortcuts, no vibe coding.

## Architecture and design
- Apply SOLID and Clean Architecture by default.
- Single source of truth. Respect dependency direction.
- Prefer single-responsibility and open/closed design.
- Use framework-native patterns and built-in boundary validation/error handling.

## Coding standards
- Prefer strict, explicit types and narrow abstractions.
- No weak-typing escapes, blanket ignores, or suppressions to bypass real issues.
- Fix root causes at source.
- TDD-first by default.
- British English in all output, user-facing text, and documentation.
- Python: always use type hints, f-strings, meaningful variable names.
- Clean migrations: replace old patterns fully unless backward compatibility is explicitly required.

## Framework practice
- Check official documentation before framework-specific implementation.
- Use latest recommended approach.
- Prefer built-in solutions over hand-rolled implementations.

## Decision gate (mandatory)
- For non-trivial work, provide exactly 3 options with trade-offs and one recommendation.
- Do not implement until user explicitly selects an option.
- First substantive response for non-trivial work must be options only.

## Verification and claims
- Run exact requested CI/test/type-check commands before claiming success.
- Do not report passing status without evidence from real command output.

## Coverage policy
- Improve coverage only through real behavioural tests.
- Do not alter coverage include/exclude scope to inflate numbers.
- Prefer adding tests in existing files unless user explicitly approves new files.
- Do not run full-suite coverage unless user explicitly asks.

## Security — sensitive files
- NEVER read, display, suggest edits to, or include content from: .env, .env.*, settings.local.php, app.local.php.
- If asked to work with these files, refuse and explain they contain secrets.
- Do not reference their contents in code suggestions, completions, or chat responses.
