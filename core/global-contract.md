# Global Contract

## Mission
- Make safe, minimal, well-validated changes that preserve architecture, behaviour, and maintainability unless broader change is explicitly requested.

## Standard Workflow
1. Understand the task and constraints.
2. Inspect nearby files, call sites, tests, and scripts before editing.
3. Produce a short plan for any task beyond a trivial one-file change.
4. Prefer the smallest change that fully solves the problem.
5. Run the strongest relevant validations before completion.
6. Summarise changed files, commands run, risks, and any unrun checks.

## Change Policy
- Reuse existing patterns and abstractions before introducing new ones.
- Avoid speculative refactors and unrelated edits.
- Do not silently change public APIs, schemas, migrations, environment variables, generated artefacts, or tool configuration.
- Do not add dependencies without explicit justification.

## Quality Order
1. Correctness
2. Security
3. Compatibility
4. Test coverage
5. Maintainability
6. Performance where it matters

## Validation Commands
- Install: use the repo's native install command.
- Format: use the repo formatter if one is defined.
- Lint: use the repo linter if one is defined.
- Type-check: run the strongest type-checking or static analysis command the repo provides.
- Test: run the strongest relevant automated tests.
- Build: run the project build if one exists.

## Coding Standards
- Read existing code before modifying files. Search for existing functionality before creating new files.
- Find 2-3 similar examples and follow the same naming, structure, error handling, and validation patterns.
- Prefer strict, explicit types and narrow abstractions.
- No blanket ignores such as `@phpstan-ignore`, `# type: ignore`, or `// @ts-ignore` to bypass real issues.
- Use framework-native patterns over hand-rolled infrastructure.
- Use British English in user-facing text and documentation.

## Architecture
- Apply SOLID and Clean Architecture where they fit the codebase.
- Respect dependency direction: inner layers must not depend on outer layers.
- Keep one source of truth. Do not duplicate logic across layers.
- Verify framework APIs against official docs or local source before using them.
- Do not assume APIs from a different framework version.

## Dependencies
- Do not add dependencies without explicit approval.
- Only import packages already present in lock files unless the user approves a new dependency.
- Pin versions unless the project already uses a different convention.
- Run the relevant audit command when dependencies change.

## Git Discipline
- Never amend published commits or force-push protected branches unless explicitly requested.
- Commit messages use imperative mood and explain the reason.
- Do not commit secrets, `.env` files, local config, credentials, or generated private artefacts.

## Output Behaviour
- Be concise. Lead with the answer or action.
- State assumptions, validations, risks, and blockers clearly.
- Do not add docstrings, comments, or type annotations to code you did not change.
- Do not add error handling for scenarios that cannot happen.

## Source Verification
- Never trust generated guides or migration notes at face value.
- Verify claims against official docs or the actual codebase before implementing.
- If a claim cannot be verified, say so explicitly.

## Scope Discipline
- One task, one focus.
- Do not refactor adjacent code or fix unrelated warnings.
- If something outside scope is worth fixing, mention it after the current task.

## Definition Of Done
- Relevant tests pass.
- Lint, format, type-check, static analysis, and build pass when available.
- No debug statements, hardcoded secrets, or commented-out code are introduced.
- Documentation matches changed behaviour.
- Rollback risk is understood before database, schema, config, or generated-output changes.

## Breach Protocol
- If any rule is breached: stop immediately, acknowledge plainly, and re-offer options only.
- Stop phrase: `Contract breach. Stop. Re-offer options only.`
