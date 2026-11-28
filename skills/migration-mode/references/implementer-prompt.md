# Implementer Prompt Template

Give the implementer one prompt at a time. Fill every placeholder. The implementer edits files; the verifier does all the analysis.

```text
Read <plan path> (item <id> and the rules it cites) first.
Precondition: HEAD is "<exact subject of the previous commit>" and `git status --porcelain` is clean (allowed untracked: <list>).
Otherwise stop and report. Do not continue if the precondition fails.

<Item id>: <one-sentence purpose>. Behaviour: <identical | only the approved change: ...>.

Scope: only these files: <exact paths>. Use `git mv` for moves.
Steps:
1. <concrete step; quote anchors verbatim>
2. ...
Rules:
- No compatibility re-exports or aliases at old paths, no `Any`, no `# type: ignore` or other blanket suppressions.
- Do not change any other file, test expectation or behaviour.
- If a test fails for any reason other than <the expected one>, stop and report. Do not edit the expectation.
- Self-check: `git grep -n -E "<\b-bounded patterns>"` must return nothing.

Don't commit. Run once:
<lint> && <format check> && <type check> && <tests>

Paste back: 1. git status --short  2. <specific evidence: named diffs, grep output, the failing case of a fail-first stage>  3. the result line
```

## Fail-First Pattern For An Approved Change

Use three stages in one prompt, so the test proves the change:

1. **Stage A, pin today's behaviour:** write the parametrised pin with today's expected values and run it on today's code. Every case must pass. If one fails, the pin does not describe today; stop and report.
2. **Stage B, flip only the approved expectation:** run it again. Exactly the flipped case must fail; report which one.
3. **Stage C, implement:** everything must now pass.

## Verifier Checklist After Each Paste-Back

- The precondition really held: check `git log -1` and `git status`.
- Only the scoped files changed. Unexpected files are explained or reverted, and the cause is often an over-broad pattern in the prompt.
- Re-run the proofs this gate needs on a fresh `scripts/snapshot.sh` commit: the AST check, bindings, reachability, mutants, CI in CI's image, and the live run where relevant.
- Hand the user the commit command with explicit paths. Afterwards, confirm the committed tree equals the verified snapshot tree.
