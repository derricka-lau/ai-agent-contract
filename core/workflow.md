# Workflow

## Execution And Delegation Policy

- Keep dependent planning, implementation, and verification in one main agent loop so shared context stays coherent.
- Delegate to subagents only for independent parallel work (e.g. parallel read-only exploration) or justified context isolation (e.g. an independent diff or risk review).
- Delegated subagents must return concise findings and verification evidence, not speculative rewrites.

## Standard Flow

For two-session work, use `plan-mode` (with `web-research`) to produce a verified commit-by-commit plan under `.git/agent-plans/`, then use `implement-mode` in a fresh session to execute one commit at a time with sign-off before each commit.

1. Restate the task and constraints.
2. Inspect only the relevant files, commands, and existing tests.
3. Present a Decision Ledger entry for material choices required by the active mode (`D1`/`D2`/`D3`), reusing decisions already approved within scope.
4. Identify the smallest relevant automated test and present the test case or no-test rationale for human review before editing implementation. If coverage is missing, add or update a test that fails for the requested behaviour before editing implementation.
5. Implement the selected option with minimal diffs until the focused test passes.
6. Run validations in order where available: targeted failing test -> focused re-run -> format -> lint -> type-check -> broader tests -> build.
7. Report changed files, validations, risks, and unrun checks.

## Review Flow

1. Read the diff and nearby context (use isolated context or the `review-risk` skill for higher-risk changes).
   Prove claims mechanically: never truncate evidence that a completeness claim rests on, use word-boundary search patterns, and verify uncommitted work against a snapshot commit of the working tree.
2. Prioritise correctness, security, regression risk, and missing tests.
3. Report findings first, ordered by severity.
4. If no findings exist, say so and mention residual risks.

## Implementer And Verifier Split

When a separate agent or tool makes the repository edits:

1. The verifier keeps all analysis: inventories, behaviour mappings, research, probes and verification. The implementer receives only edit tasks.
2. Each implementer prompt opens with a precondition gate (the expected `HEAD` and a clean tree), names the exact files in scope, says when to stop and report, and lists what to paste back.
3. The implementer's report is a claim. The verifier re-runs every check independently on a snapshot of the working tree.
4. When the user commits, give exact commit commands with explicit paths, then confirm the committed tree equals the verified snapshot.
5. For behaviour-preserving migrations, load `migration-mode`.

## Security Flow

1. Identify trust boundaries, auth/permission checks, data exposure, injection risk, secret handling, and unsafe command/file access.
2. Verify sensitive-file guardrails remain deterministic.
3. Report concrete findings with severity and mitigation.
