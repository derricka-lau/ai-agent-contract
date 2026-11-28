# Failure Modes The Gates Prevent

Use this as a checklist when planning each commit and when reviewing the implementer's result.

## Behaviour Drift

- Failing expectations are edited until CI is green, and rules disappear without a decision. Guarded by G2, G3 and G5.
- An old plan, document or earlier attempt is treated as the specification. Guarded by the baseline rule.
- A framework primitive is adopted for its happy path. Its feedback wording, retries, batching, limits or failure semantics differ, and a business budget is enforced only between requests instead of per call. Guarded by G4: probe every pinned edge case, and enforce budgets inside your own tool code.
- A provider or SDK switch changes how errors are shaped. A safety or security classifier that parses those errors silently misroutes cases. Guarded by G4: probe classifiers with realistic fixtures under every provider change.
- A framework's error taxonomy disagrees with the old classification on edge cases (quota against rate limit, uncommon status codes, your own timeouts). Guarded by G4: map every case through the real client with a mock transport, and keep old decisions as explicit extras unless a change is approved.

## False Proofs

- A text filter checks "only imports changed" and hides lines that look like imports. Guarded by `ast_move_check.py`.
- A rewritten import binds a different object with the same name. Guarded by `import_bindings.py`.
- Evidence is truncated (`head`), or a pattern without word boundaries matches unrelated names, and the implementer "fixes" those too. Guarded by the evidence rule.
- Mutants import an installed copy of the package instead of the mutated one. Guarded by `mutants.py`'s import check.
- An error-path test passes because an unscripted dependency also fails. Guarded by asserting attempt or call counts.
- A broken test run is counted as a killed mutant. Guarded by `mutants.py`'s `ERROR` verdict.
- A probe or proof script is itself wrong, or vacuous. Sanity-check every proof on a case with a known answer, and show at least one success path and one failure path.
- Local results differ from CI: a newer local dependency, or a failure line printed with exit status 0. Guarded by `ci_in_image.sh` and by parsing the output.

## Process Breakdowns

- Analysis is handed to the implementer, or the implementer's report is accepted as proof. Guarded by the roles section.
- Prompts run out of order, or on a dirty tree. Guarded by the precondition gate in every prompt.
- What the user commits differs from what you verified. Guarded by comparing `HEAD^{tree}` with the snapshot tree.
- Evidence is destroyed before analysis: containers removed, logs rotated. Guarded by the evidence rule.
- The user has to point out an outdated pattern, a native framework feature, a messy layout or an unused dependency. Guarded by G4's audit and the proactive rule.

## Structure And Dependencies

- After a move, CI trigger paths, Dockerfiles or docs still point at the old files. Guarded by G6's configuration grep.
- A package-root re-export creates an import cycle once shared types move under it. Guarded by G6's cycle check.
- Supporting code stays in the old framework's folders after the steps move, so each feature is spread across many places. Guarded by G6's layout rules.
- A helper becomes dead only on the branch, because an approved change replaced its caller. Guarded by G7 against the baseline.
- A dead wrapper's tests were the only pins for a real rule. Guarded by G7: re-target the pins before deleting.
- A direct import is undeclared and only arrives through another package, or a declared extra is unused. Guarded by G8.

## Live Comparison

- An end-to-end flake is reported as a regression, or a regression is dismissed as noise. Guarded by G9: capture and diff the API-facing inputs on both sides, report rates with sample sizes, and allow for having picked the worst scenario.
