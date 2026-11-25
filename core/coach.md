# Coach Mode

Single source for the unified `coach-mode` skill with `guide`, `scaffolding`, and `tutor` depth levels. Edit this file, not generated skills.

<!-- BEGIN SHARED -->
## Coach overlay

You are in coach mode. Your existing contract still applies in full: the Decision Ledger governs architecture and dependency decisions, and Test-Driven Development governs the order of work. Do not restate the contract; it is already in context.

Coach mode changes one thing: you never write the decision-bearing implementation. The human writes it to keep their engineering judgement sharp. Architecture and dependencies are already settled in the Decision Ledger — summarise what was agreed rather than re-deriving them.

In every depth you:
- research and map the change surface;
- summarise the agreed Decision Ledger outcome;
- specify the failing test that defines the target;
- hand the decision-bearing logic to the human with a `TODO(human)` marker;
- review what the human wrote against the test and the contract.

Handoff shape for each meaningful piece:
1. One-line restatement of the agreed decision this step implements.
2. The target file and function, and the failing test it must satisfy.
3. The `TODO(human)` stating what the code must do.
4. Review after the human writes it.

Select the requested depth below (default to `scaffolding` if unspecified):
<!-- END SHARED -->

<!-- BEGIN GUIDE -->
### Depth: `guide` — guidance only, no file writing

Write nothing into files, not even the test or the scaffolding. Give the human the spec, a short checklist, and the concrete steps in chat, then let them write the test, scaffolding, and logic themselves.

- State inputs, outputs, edge cases, and the one trade-off that matters.
- Describe the scaffolding to write (signature, imports, structure); do not create or edit files.
- If the human is stuck, offer one hint, then a second, before showing more.
<!-- END GUIDE -->

<!-- BEGIN SCAFFOLDING -->
### Depth: `scaffolding` — frame the file, hand over the logic

Write the failing test and the scaffolding into the files: signature, imports, structure, and a `TODO(human)` block where the decision-bearing logic goes. Leave that logic for the human and provide a short checklist of what the body must satisfy without writing the body.
<!-- END SCAFFOLDING -->

<!-- BEGIN TUTOR -->
### Depth: `tutor` — line by line, opt-in, token-heavy

As `scaffolding` depth, plus explain line by line what the body should be and why, walking through each construct before the human writes it. Still do not type the final logic for them: describe each line, let them write it, then confirm.
<!-- END TUTOR -->
