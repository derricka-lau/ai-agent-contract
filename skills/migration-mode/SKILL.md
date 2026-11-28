---
name: migration-mode
description: Run a behaviour-preserving migration (framework, SDK, runtime or large structural refactor) commit by commit, with a pinned baseline, mutation-proven tests, framework-semantics probes and mechanical proofs for every move and deletion. Use only when the user explicitly invokes migration-mode or asks for a migration that must preserve behaviour.
---

# Migration Mode

Change how the system is built without changing what it does, except for changes the user approves one at a time. Use it alongside `plan-mode` (the plan) and `implement-mode`, or an external implementer (the edits). This skill adds the gates and the proofs.

## Non-Negotiables

- **The baseline decides behaviour.** The source of truth is the baseline commit's code and tests. An old plan, a doc or notes from an earlier attempt are not. Record the baseline SHA in the plan.
- **Never bend a pin.** Never edit a pinned expectation to make new code pass. An expectation changes only in its own commit, after an approved Decision Ledger entry, and the flipped test must first fail for the intended reason.
- **One purpose per commit:** pins, cutover, each intentional change, each move, each deletion, each dependency change.
- **Evidence or it did not happen.** Every "identical", "only imports", "unused" or "passes" claim names the tool output that proves it. Never truncate evidence (no `head` on completeness checks), and use word-boundary (`\b`) patterns in every grep.
- **CI's image, not your machine.** Run CI's own jobs in CI's container image, on an exact snapshot, before claiming a pass. Parse the results, not just exit codes.
- **Keep evidence until it has been analysed:** containers, logs, dumps.
- **Raise improvements proactively.** Finding outdated patterns, native framework features that replace custom code, a scattered layout, unused or undeclared dependencies and dead code is your job. Surface each one as a Decision Ledger entry before the user has to ask.

## Roles When Another Agent Or Tool Implements

- **Verifier (you):** inventories, behaviour mappings, framework research, probes, mutation runs, proofs, CI and live comparisons. Never hand analysis-only work to the implementer.
- **Implementer:** repository edits only, one prompt at a time, using `references/implementer-prompt.md`. Every prompt has a precondition gate: the expected HEAD and a clean tree.
- **User:** approves decisions and commits. Give exact commit commands with explicit paths. Afterwards, confirm that `git rev-parse HEAD^{tree}` equals the tree of the snapshot you verified.
- **Treat the implementer's report as a claim.** Re-run every check yourself on `scripts/snapshot.sh` output.

## Gates

Each gate's exit condition must hold before the next gate starts.

1. **G0 Baseline:** baseline SHA, CI image name, a rollback artefact (for example a tagged image of the baseline), the entry points, and a working live-comparison harness.
2. **G1 Inventory:** a table row for every business rule, limit (each max, cap, threshold, timeout and retry count), user-facing text, telemetry or audit record, wire contract, config or environment variable, and trust boundary in the code being replaced. Each row names the test that pins it, or says "unpinned".
3. **G2 Pin first, on the baseline:** add pins for every unpinned row against the old code. Prove each pin with a mutant (`scripts/mutants.py`, one or more per row, in CI's image), with zero survivors and zero errors. Error-path pins must assert attempt or call counts, so an unscripted failure cannot satisfy them.
4. **G3 Like-for-like cutover:** the pins stay unchanged, apart from envelope assertions the user approved. Re-apply the G2 mutants to the new code (cross-mutants) to prove the suite still detects every rule.
5. **G4 Framework-native audit, then adoption:**
   - **Audit.** After cutover, check every custom module, helper and setting the migration kept against the framework's installed source and its current official documentation. Record keep or replace for each, with evidence: the file and line in the installed package, the documentation URL and the version.
   - **Probe before adopting.** Before replacing hand-written logic with a framework primitive (an agent loop, a fallback model, a provider class, an error taxonomy), probe it offline with fakes (a fake model, a mock HTTP transport, the repo's own fixtures) for every pinned edge case. Produce a difference table; each difference is a Decision Ledger entry. Any business rule the framework does not enforce stays enforced in your code, with a pin. Probe safety and security classifiers under every provider or framework change.
6. **G5 Intentional changes:** one per commit. Flip the pin first (it must fail), then implement (it must pass).
7. **G6 Structural moves:** pure moves only, proven by `scripts/ast_move_check.py` (all changed files, imports stripped, cross-file moves allowed) and `scripts/import_bindings.py` (every import binds the same object as before, tests included). Record the layout rules in the plan. Grep non-code configuration (CI trigger paths, Dockerfiles, docs) for the moved paths. Check package `__init__` re-exports for import cycles before moving shared types.
8. **G7 Dead code:** run `scripts/reachability.py` with `--baseline`.
   - Dead on both trees means pre-existing; deleting it is a separate decision.
   - Dead only on the candidate means a caller was lost. Prove its behaviour moved before you delete it.
   - Delete tests of dead code. Re-target any pin that exercised a real rule through dead code to the production function.
9. **G8 Dependencies:** declared dependencies equal direct imports (declare what you import, drop unused extras). Lock versions stay unchanged unless the user approves otherwise. Run the dependency audit.
10. **G9 Live comparison:** run the end-to-end suite on the baseline and candidate builds side by side. When results differ, capture the model- or API-facing inputs on both sides (prompts, payloads, schemas, HTTP parameters) and diff them before calling it noise. Report rates with sample sizes, and allow for having picked the worst scenario out of many.
11. **G10 Finish:** docs describe the result, the MR states breaking changes and data resets, and the rollback steps are tested.

## Proof Toolkit

The scripts live in this skill's `scripts/` folder and use only the standard library. Run the Python ones with the project's interpreter, so project imports resolve.

| Script | Proves |
| --- | --- |
| `snapshot.sh <repo> <path>...` | Records the working tree as a commit object without touching HEAD, the index or the files. Verify uncommitted work against this. |
| `ci_in_image.sh <repo> <commit> <image> <command>` | Runs a CI job's command inside CI's image, on exactly that commit. |
| `ast_move_check.py <repo> <base> <head> [--path P]` | That code is identical once imports are stripped, allowing definitions to move between files. Lists `__all__` and docstring edits separately. |
| `import_bindings.py dump` / `compare` | That every import statement still binds the same object (source hash for functions and classes, value for constants), through the rename map. |
| `reachability.py <tree> --package P [--baseline <tree>]` | Which definitions are unreachable from the entry points, and which became unreachable only on the candidate. |
| `mutants.py --tree <copy> --spec mutants.json [--package P] -- <test command>` | That each pin detects its rule, in any stack (the test command is yours). It refuses git work trees, requires a green unmutated run first, and with `--package` checks that Python tests import the copy. |

## Plan Bookkeeping

Keep the plan under `.git/agent-plans/` (see `plan-mode`). It holds:
- the commit list, with each commit's status and SHA;
- a decisions table (date, option chosen, evidence);
- the architecture and layout rules;
- the inventory and test map;
- open investigations, with their results.

Update it as soon as anything changes; the next agent starts from it.

## References

- `references/implementer-prompt.md`: the implementer prompt template and the fail-first pattern for intentional changes.
- `references/failure-modes.md`: the failure modes each gate prevents, as a planning and review checklist.
