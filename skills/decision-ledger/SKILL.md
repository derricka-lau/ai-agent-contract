---
name: decision-ledger
description: Full Decision Ledger entry template, Scope Anchors archetypes, and granularity guide. Load when formatting a Decision Ledger entry under D1, D2, or D3.
---

# Decision Ledger Reference

Use this template when stopping for a material decision required by the active mode (`D1`, `D2`, or `D3`).

## Required Format

Output exactly:

```text
Decision: [one concrete choice]
Decision type: [architecture | config | security | data | testing | performance | UX | workflow | rollback]
Context: [1-3 sentences with repo evidence and official/source evidence where relevant]
Affected surface: [files, commands, configs, APIs, schemas, generated artefacts, user behaviour]
Options: (for scope-shaped decisions, anchor to Scope Anchors below)
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
```

Wait for the user's choice before continuing.

## Scope Anchors

Apply **only when the decision is about how much to change** (change-surface, effort, or refactor breadth):

1. **Minimal** — the smallest diff that fully solves the stated problem; touch nothing else.
2. **Best practice (bounded)** — solve it properly to current best practice within the task boundary (`One task, one focus`).
3. **Targeted middle** — minimal plus named adjacent fixes that directly de-risk the change; nothing speculative.

Do not force these archetypes onto non-scope choices (such as fixture choice, commit-vs-CI artefacts, or rollback strategy).

## Granularity

Ask about:
- Implementation strategy when real trade-offs exist.
- Whether a change is global, per-workflow, or file-by-file.
- Adding, removing, retaining, or generating shared rules, helpers, hooks, skills, or configs.
- Which first failing test case, fixture strategy, or no-test rationale applies before implementation.

Do not ask about:
- Reading nearby non-sensitive files, running `rg`/`git diff`, or running targeted checks.
- Following already-approved style rules, formatter output, or decisions already approved within scope.
