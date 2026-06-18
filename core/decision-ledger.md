# Decision Ledger Protocol

The Decision Ledger is the core human-in-the-loop protocol. It exists because AI cannot replace human judgement: the assistant must surface explicit engineering trade-offs before material changes, not ask for empty approval.

The `D1`/`D2`/`D3` modes form the review ladder. Use the ladder to decide how many material choices need human review before implementation.

## Core Rule

For every material decision, stop and present a Decision Ledger entry before acting.

A material decision is any choice that affects:
- Architecture, dependency direction, or abstraction boundaries.
- Public APIs, schemas, migrations, configuration, generated artefacts, or test infrastructure.
- Which files are edited, moved, deleted, or used as sources of truth.
- Whether to add, remove, retain, or rename an abstraction, helper, trait, base class, agent, hook, skill, or config layer.
- Test strategy, fixture strategy, validation depth, rollback strategy, or release strategy.
- Security posture, permissions, secret handling, data exposure, trust boundaries, or sandbox behaviour.
- Observability, logging, audit trail, debugging signal, or operational visibility.
- Performance versus simplicity, compatibility versus cleanup, or maintainability versus speed.
- Broad mechanical changes across multiple files.

Do not ask `Can I proceed?`. Ask the concrete design choice: `Which trade-off do you want?`

## Required Format

For each decision, output exactly:

Decision: [one concrete choice]
Decision type: [architecture | config | security | data | testing | performance | UX | workflow | rollback]
Context: [1-3 sentences with repo evidence and official/source evidence where relevant]
Affected surface: [files, commands, configs, APIs, schemas, generated artefacts, user behaviour]
Options:
1. [Option A] - benefit, cost, and risk.
2. [Option B] - benefit, cost, and risk.
3. [Option C] - benefit, cost, and risk.
Risk check:
- Architecture: [dependency direction, coupling, source of truth, compatibility]
- Security: [permissions, secrets, auth, injection, data exposure, trust boundaries]
- Maintainability: [complexity, ownership, naming, future change cost]
- Testing: [unit/integration/e2e coverage, fixtures, mocks, determinism]
- Observability: [logs, audit trail, metrics, debuggability]
- Performance: [runtime, CI time, memory, network, cost]
- Rollback: [how to revert safely, data-loss risk, migration reversibility]
Recommendation: [one option] because [concrete technical reason]
Default if you do not choose: [safest fallback]
Validation: [exact checks that prove the selected option works]
Impact: [what changes, what stays unchanged, and who/what is affected]

Wait for the user's choice before continuing.

## Granularity

Use small decisions, but not meaningless ones.

Ask about:
- Which implementation strategy to use.
- Whether compatibility shims stay or call sites are updated directly.
- Whether a change is global, per-workflow, or file-by-file.
- Whether to trim, delete, retain, or generate shared instructions, fixtures, helpers, hooks, agents, skills, or configs.
- Whether generated artefacts should be committed, produced locally, or produced in CI.
- Which first test case, fixture strategy, or no-test rationale should be reviewed before implementation.

Do not ask about:
- Whether to read nearby non-sensitive files.
- Whether to run `rg`, `git diff`, or a targeted validation command.
- Whether to follow already-approved style rules.
- Exact whitespace or formatter output.
- Tool permission prompts unless the action is risky.

## Work Modes

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

## Breach Rule

If a material decision is made without asking:
`Contract breach. Stop. Re-offer the missed decision as options only.`
