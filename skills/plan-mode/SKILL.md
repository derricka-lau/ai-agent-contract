---
name: plan-mode
description: Research and produce a verified, commit-by-commit implementation plan saved under .git/agent-plans/ for execution in a separate session. Use only when the user explicitly invokes plan-mode or asks to enter plan mode.
---

# Plan Mode

Use this mode to design and verify a task before implementation, producing a self-contained handoff plan for `implement-mode` in a separate session.

## Rules

- **Read-only on repository source files.** Do not modify application code, tests, or tracked configuration during `plan-mode`. Only write the plan file.
- **Verify external assumptions with `web-research`.** Load and follow the `web-research` skill whenever the task touches external libraries, framework versions, CLI/tool schemas, security controls, or architecture trade-offs. Keep research lean for stable local code; go deeper when uncertainty or risk justifies it.
- **Settle material choices now.** Surface material engineering decisions through the active Decision Ledger mode (`D1`/`D2`/`D3`) during planning so `implement-mode` can execute without re-asking settled choices.

## Plan Storage

1. Resolve the plan path safely (works in normal repos, worktrees, and submodules):
   - Run `git rev-parse --git-path agent-plans/<slug>.md` (use a short kebab-case `<slug>`).
   - Also maintain or note the exact resolved path at the end of your reply so the next session can open it directly.
2. If the active tool's sandbox blocks writing inside `.git/`, stop and ask the user to either approve writing to that `.git/` path or confirm a local untracked fallback (such as `.agent-plans/<slug>.md` excluded in `.git/info/exclude`). Never leave an untracked plan file exposed to `git status`.

## Plan Structure

Write the plan file with these exact sections:

```markdown
# Plan: <Task Title>

- **Branch / Base commit:** `<branch>` @ `<short-sha>`
- **Decision Ledger mode:** `D1` | `D2` | `D3`
- **Plan file:** `<resolved-path>`

## Goal & Constraints
- Concise problem statement, non-goals, and hard constraints.

## Verified Sources
- External/official claims verified via `web-research` with URLs and publication/access dates (or `None required — local-only change`).

## Approved Decisions
- Record every Decision Ledger choice settled during planning so `implement-mode` treats them as approved within scope.

## Commit-By-Commit Plan

### Commit 1: `<type>(<scope>): <concise imperative summary>`
- **Status:** [ ] Pending
- **Purpose:** One sentence explaining why this commit exists.
- **Files:** Exact paths to create, edit, or delete.
- **First failing test (or no-test rationale):** Exact test file/case to add or update before editing implementation.
- **Implementation steps:** Minimal concrete changes.
- **Validation:** Exact targeted + broader commands to pass before commit sign-off.

(Repeat for each commit; every commit must be small, single-purpose, independently reviewable, and use Conventional Commits with no `Co-authored-by:` or AI attribution.)

## Final Verification & Rollback
- End-to-end checks to run after the final commit (and whether `review-risk` should run in isolated context).
- Concrete rollback strategy for schema, config, or generated-output changes.
```

## Exit Criteria

Before ending the planning session, confirm:
1. All material decisions for the plan are settled and recorded under `Approved Decisions`.
2. Every planned commit has a valid Conventional Commit subject (≤72 chars, no trailing period), a first failing test (or approved no-test rationale), and a verification command.
3. The plan file is written and its exact path is shared with the user for the `implement-mode` session.
