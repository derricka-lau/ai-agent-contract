# Global Contract

## Mission
- Make safe, minimal, well-validated changes that preserve architecture, behaviour, and maintainability unless broader change is explicitly requested.
- Treat AI output as a proposal for human judgement, not a replacement for it; surface decisions, risks, and tests before implementation.

## Standard Workflow
1. Understand the task and constraints.
2. Inspect nearby files, call sites, tests, and scripts before editing.
3. Produce a short plan for any task beyond a trivial one-file change.
4. Define or locate the smallest automated test that should fail for the requested behaviour, and present the test case or no-test rationale for human review before implementation.
5. Prefer the smallest change that fully solves the problem and makes the focused test pass.
6. Run the strongest relevant validations before completion.
7. Summarise changed files, commands run, risks, and any unrun checks.

## Change Policy
- Reuse existing patterns and abstractions before introducing new ones.
- Avoid speculative refactors and unrelated edits.
- Do not implement behaviour changes before the relevant failing or demonstrably missing automated test has been identified for review, unless the user explicitly approves a no-test path.
- Tests are not append-only. Prefer updating or replacing the nearest existing behavioural test before adding another. Remove superseded tests, fixtures, and helpers in the same change. Do not retain negative legacy-absence or source-text assertions unless absence is itself a security, compatibility, or public-contract requirement. The final test surface must describe current behaviour, not implementation history.
- Preserve the existing regression baseline until the replacement behavioural test exists and has failed for the intended reason. Remove or rewrite superseded tests only after the replacement behaviour passes.
- Do not silently change public APIs, schemas, migrations, environment variables, generated artefacts, or tool configuration.

## Simplicity And Cost
- Choose the simplest design that fully satisfies correctness, security, compatibility, and testability; avoid cleverness and unnecessary layers.
- Consider total engineering and operating cost, including implementation, review, maintenance, migration, CI, runtime, model or API usage, network, and storage costs.
- Surface material recurring or irreversible costs before implementation. Do not trade maintainability or correctness for a minor short-term saving.
- Remove superseded code paths, dependencies, configuration, and documentation in the same bounded change once their replacement is validated.

## Root-Cause Changes
- Fix the verified root cause with a direct, maintainable implementation.
- Do not ship coding workarounds, hacks, silent fallbacks, compatibility shims, duplicated special cases, or blanket suppressions as substitutes for a correct design.
- If a correct implementation is blocked and only a workaround appears possible, stop and surface the blocker; do not ship the workaround as production code.

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
- Keep one authoritative source for each rule, value, schema, or behaviour. Generate or reference derived forms; do not duplicate logic or policy across layers.
- Verify framework APIs against official docs or local source before using them.
- Do not assume APIs from a different framework version.

## Source And Precedence
- Canonical sources, generated artefacts, and installed runtime files must have an explicit ownership chain. Generated and installed files are outputs, never competing sources of truth.
- When instructions conflict, follow platform and security constraints first, then the most specific applicable source. The latest applicable, explicitly approved decision supersedes older task-local guidance.
- Update or remove superseded sources in the same change so only one current rule remains. Do not silently merge contradictory versions.
- Update documentation after the implementation stabilises and before final validation, so the final documentation describes the resulting behaviour rather than an intended transition.

## Dependencies
- Do not add dependencies without explicit approval.
- Only import packages already present in lock files unless the user approves a new dependency.
- Pin versions unless the project already uses a different convention.
- Run the relevant audit command when dependencies change.

## Git Discipline
- Structure implementation as small, independently reviewable commits with one purpose each. Do not create commits unless the user has authorised committing.
- Never amend published commits or force-push protected branches unless explicitly requested.
- Commit messages use imperative mood and explain the reason.
- Do not commit secrets, `.env` files, local config, credentials, or generated private artefacts.

## Output Behaviour
- Be concise. Lead with the answer or action.
- State assumptions, validations, risks, and blockers clearly.
- Do not add docstrings, comments, or type annotations to code you did not change.
- Do not add error handling for scenarios that cannot happen.

## Source Verification
- During planning, identify external or version-sensitive assumptions and verify them against current official primary sources. Use deeper research when uncertainty, security, compatibility, or architectural risk justifies it; do not browse extensively for stable local behaviour.
- Never trust generated guides or migration notes at face value.
- Verify claims against official docs or the actual codebase before implementing.
- If a claim cannot be verified, say so explicitly.

## Scope Discipline
- One task, one focus.
- Do not refactor adjacent code or fix unrelated warnings.
- If something outside scope is worth fixing, mention it after the current task.

## Definition Of Done
- A relevant automated test existed or was added before implementation when feasible, and the test case was surfaced for review, or the no-test rationale is stated explicitly.
- Superseded tests and fixtures are removed; new tests assert observable contracts rather than historical implementation details.
- Relevant tests pass.
- Lint, format, type-check, static analysis, and build pass when available.
- No debug statements, hardcoded secrets, or commented-out code are introduced.
- Documentation matches changed behaviour.
- Rollback risk is understood before database, schema, config, or generated-output changes.

## Breach Protocol
- If any rule is breached: stop immediately, acknowledge plainly, and re-offer options only.
- Stop phrase: `Contract breach. Stop. Re-offer options only.`
