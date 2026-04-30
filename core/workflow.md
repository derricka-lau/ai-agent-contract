# Workflow

## Standard Flow

1. Restate the task and constraints.
2. Inspect only the relevant files and commands.
3. Present a Decision Ledger entry for material choices.
4. Implement the selected option with minimal diffs.
5. Run targeted validation first, then broader checks if the scope warrants it.
6. Report changed files, validations, risks, and unrun checks.

## Review Flow

1. Read the diff and nearby context.
2. Prioritise correctness, security, regression risk, and missing tests.
3. Report findings first, ordered by severity.
4. If no findings exist, say so and mention residual risks.

## Security Flow

1. Identify trust boundaries, auth/permission checks, data exposure, injection risk, secret handling, and unsafe command/file access.
2. Verify sensitive-file guardrails remain deterministic.
3. Report concrete findings with severity and mitigation.
