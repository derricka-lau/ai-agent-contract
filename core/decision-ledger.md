# Decision Ledger Protocol

Surface explicit engineering trade-offs before material changes rather than asking `Can I proceed?`. Ask the concrete design choice: `Which trade-off do you want?`

## Core Rule

Apply the active review mode (`D1`, `D2`, or `D3`) to decide when to stop and present a Decision Ledger entry before acting:
- `D1`: **major** material decisions only (architecture, public API/schema/security changes, new dependencies, irreversible migrations).
- `D2`: **major and medium** material decisions (adding implementation strategy, multi-file scope, test/rollback strategy).
- `D3` (**default** unless specified otherwise): **all material small decisions**, one at a time.

An explicitly approved decision remains approved within its agreed scope; do not re-ask unless scope, constraints, or new evidence change.

Material choices cover architecture/dependencies, public APIs/schemas/configs/generated artefacts, file ownership/deletions, abstractions/skills/hooks, test/validation/rollback strategy, security/trust boundaries, observability, performance vs simplicity, and broad multi-file edits. Do not stop for reading non-sensitive files, running `rg`/`git diff`/targeted checks, or applying approved style rules.

## Entry Requirements

Include: `Decision`, `Decision type`, `Context`, `Affected surface`, `Options` (benefit, cost, risk), `Risk check` (architecture, security, maintainability, testing, observability, performance, rollback), `Recommendation`, `Default if you do not choose`, `Validation`, and `Impact`.

Wait for the user's choice before continuing.

Load the `decision-ledger` skill for the full template, `Scope Anchors` archetypes, and granularity examples.

In `D3`: restate task -> inspect minimal context -> present one entry -> wait for choice -> apply only that choice -> repeat.

## Breach Rule

If a material decision required by the active mode is made without asking:
`Contract breach. Stop. Re-offer the missed decision as options only.`
