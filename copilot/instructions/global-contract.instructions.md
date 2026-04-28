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

## Decision Ledger Protocol

The user wants to steer quality through explicit trade-off decisions, not approve meaningless permissions.

### Core rule

For every material decision, stop and present a Decision Ledger entry before acting.

A material decision is any choice that affects:
- Architecture or dependency direction.
- Public APIs, schemas, migrations, configuration, generated artefacts, or test infrastructure.
- Which files are edited, moved, or deleted.
- Whether to add, remove, or keep an abstraction.
- Test strategy, fixture strategy, validation depth, or rollback strategy.
- Naming, file layout, base class design, trait extraction, or helper creation.
- Performance versus simplicity trade-offs.
- Compatibility versus cleanup trade-offs.
- Broad mechanical changes across multiple files.

Do not ask for empty approval such as "Can I proceed?" Ask for a design choice: "Which trade-off do you want?"

### Required format

For each decision, output exactly:

Decision: [one concrete choice]
Context: [1-3 sentences, with repo or official-doc evidence if relevant]
Options:
1. [Option A] - trade-off.
2. [Option B] - trade-off.
3. [Option C] - trade-off.
Recommendation: [one option] because [technical reason].
Default if you do not choose: [safe fallback].
Impact: [files, behaviour, and tests affected].

Wait for the user's choice before continuing.

### Decision granularity

Use small decisions, but not meaningless ones.

Ask about:
- Whether to use one implementation strategy or another.
- Whether to keep compatibility shims or update call sites directly.
- Whether to apply an infrastructure change globally or file by file.
- Whether to trim, delete, or retain existing test fixtures or helpers.
- Whether generated artefacts should be committed or produced during CI.

Do not ask about:
- Whether to read nearby non-sensitive files.
- Whether to run `rg`, `git diff`, or a targeted test.
- Whether to follow already-approved style rules.
- Exact whitespace or formatter output.
- Tool permission prompts unless the action is risky.

### Work modes

When a task begins, classify it:
- `D1`: major decisions only.
- `D2`: major and medium decisions.
- `D3`: all material small decisions.

Default to `D3` unless the user says otherwise.

In `D3`, implementation proceeds as:
1. Restate the task.
2. Inspect only enough context to frame the first decision.
3. Present one Decision Ledger entry.
4. Wait for the user's choice.
5. Apply only the selected choice.
6. Present the next Decision Ledger entry.
7. Repeat until done.

### Breach rule

If a material decision is made without asking:
"Contract breach. Stop. Re-offer the missed decision as options only."

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
