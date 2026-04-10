---
applyTo: "**"
---

# Repository instructions for GitHub Copilot

## Project behaviour
Follow established patterns in this repository before proposing new structures.
Prefer minimal diffs and preserve architecture unless the task explicitly requests redesign.

## Before editing
- Inspect nearby files and call sites.
- Check current tests and validation commands.
- Identify whether the change affects public APIs, schemas, migrations, configuration, or generated files.

## Implementation rules
- Reuse existing utilities and components before introducing new ones.
- Match current naming, module boundaries, and file organisation.
- Avoid hidden side effects and overly clever abstractions.
- Keep comments limited to non-obvious logic.
- Do not add dependencies without explicit justification.
- Verify framework-specific changes against current documentation before using them.

## Validation expectations
Before considering work complete, run or recommend:
- format, lint, typecheck, unit tests, integration tests, build

## Review priorities
1. Correctness
2. Security
3. Backward compatibility
4. Test adequacy
5. Maintainability
6. Performance where relevant

## Parallel work
- Many readers, one writer.
- Use `/fleet` only for naturally parallel tasks.
- Do not let multiple agents write the same file concurrently.
- Consolidate the plan before broad edits.

## Safety and secrets
- Call out risky or destructive actions before taking them.
- Never expose secrets or sensitive data.
- Prefer transparent, reviewable changes over opaque automation.
- If a task is ambiguous or needs a new dependency, stop and confirm.

## Output style
- Explain assumptions briefly.
- Identify touched files.
- Call out risks explicitly.
- Note any unrun checks or uncertainty.
- Use British English.
