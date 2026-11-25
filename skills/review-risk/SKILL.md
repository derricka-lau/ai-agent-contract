---
name: review-risk
description: Structured diff and change risk review covering correctness, compatibility, security, rollback, and test adequacy. Use when reviewing a change before merge or completion, especially in isolated context.
---

# Risk Review

Inspect the effective diff and surrounding callers/tests before reporting. Prefer running this review in isolated context when an independent second look is valuable.

## Checklist

1. **Correctness & edge cases:** Logic errors, off-by-one or null/empty states, concurrency/atomicity bugs, error-handling gaps, and unintended side effects.
2. **Compatibility & contracts:** Breaking changes to public APIs, CLI flags, schemas, config formats, generated outputs, or cross-tool expectations.
3. **Security & trust boundaries:** Auth/permission bypasses, injection, path traversal/symlink handling, secret exposure, weakened sensitive-file guardrails, or fail-open error paths.
4. **Data & rollback safety:** Reversibility of migrations, config/state changes, and partial-failure recovery; confirm no silent data loss.
5. **Test & validation adequacy:** Behavioural coverage for the changed paths, deterministic fixtures, removal of superseded tests, and any checks that did not run.

## Severity Rubric

- **Critical:** Security vulnerability, data loss, broken guardrail, or guaranteed production failure. Must fix before merge.
- **High:** Likely functional regression, compatibility break, or missing test on a risky path. Should fix before merge.
- **Medium:** Edge-case bug, maintainability hazard, or incomplete rollback/error handling.
- **Low:** Minor polish or follow-up improvement (non-blocking).

## Output Format

1. **Findings** ordered by severity (`Critical` -> `Low`), each with `file:line`, concrete impact, and a focused mitigation.
2. **Residual risks & unrun checks** (if no findings exist, state that plainly and still list residual risks and verification gaps).
3. **Verdict:** Ready to proceed or blocked on specific findings.
