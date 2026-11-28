---
name: implement-mode
description: Execute a saved commit-by-commit plan from .git/agent-plans/ one commit at a time with TDD validation and explicit user sign-off before each git commit. Use only when the user explicitly invokes implement-mode or asks to implement a saved plan.
---

# Implement Mode

Use this mode in a fresh session to execute a plan created by `plan-mode`, one commit at a time.

## Startup

1. Locate the plan file:
   - Use the path provided by the user, or inspect `$(git rev-parse --git-path agent-plans)` to find the active plan file (or the confirmed fallback path if `.git/` was sandbox-blocked).
   - If multiple plans exist and the user did not specify one, list them and ask which plan to execute.
2. Read the plan completely and verify current `git status` and `HEAD` against the plan's base branch/commit.
3. Treat every entry under `Approved Decisions` as already approved within its agreed scope — do not re-ask settled decisions.

## Commit-By-Commit Loop

Execute **strictly one pending (`[ ]`) commit at a time** in order:

1. **Restate the current commit** (number, Conventional Commit subject, files, and first failing test).
2. **Test first:** Add or update the planned failing automated test and run it to confirm it fails for the intended reason (unless the plan records an explicitly approved no-test rationale).
3. **Implement minimally:** Apply only the changes scoped to this commit. Do not work ahead into later commits or perform unrelated cleanup.
4. **Validate:** Run the commit's targeted test, then the repository's relevant format, lint, type-check, and broader tests.
5. **Request commit sign-off (mandatory):**
   - **Do not run `git commit` until the user explicitly confirms sign-off for this commit.**
   - Present: changed files, concise diff summary, validation commands and results, any risks, and the exact proposed Conventional Commit message (≤72 chars, no trailing period, no `Co-authored-by:` trailer, no AI/tool attribution).
   - Wait for the user's explicit sign-off.
6. **Commit & advance:**
   - Only after sign-off is confirmed, stage only the files for this commit and run `git commit`.
   - Update the commit's status in the plan file from `[ ] Pending` to `[x] Committed (<short-sha>)`.
   - Proceed to the next pending commit.

## When The User Commits

If the user prefers to run commits themselves, replace step 6's `git commit` with the exact command (explicit paths, the approved message). After they run it, confirm `git rev-parse HEAD^{tree}` equals the tree you validated, then update the plan status.

## Handling Plan Divergence

- If codebase reality contradicts the plan, a test reveals an unexpected constraint, or a new material decision arises outside `Approved Decisions`, **stop immediately** and present a Decision Ledger entry before modifying scope or deviating from the plan.
- Update the plan file once the user chooses the updated direction.

## Completion

After the final commit is signed off and committed:
1. Run the plan's `Final Verification` checks (and `review-risk` if specified or warranted).
2. Report all created commits (`git log` summary), validations run, residual risks, and ask whether to remove or retain the plan file under `agent-plans/`.
