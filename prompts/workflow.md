# Workflow Prompt Templates

Copy-paste these when needed. Not loaded automatically by any tool.

## 1. Triage — which tool should handle this?

```
I need to: [task]

Given my workflow:
- Claude Code Opus = planning, diagnosis, review
- Codex = short focused execution
- Copilot = long autonomous runs

Decide which tool should handle this and why.

Rules:
- If this is a short, bounded change, write a Codex prompt.
- If this is a long multi-step task, write a Copilot prompt.
- If this needs planning or diagnosis first, do that first.
- If you can solve it directly better than either tool, say so.

Return:
1. Best tool
2. Why
3. Ready-to-use prompt
4. Verification commands
```

## 2. Claude Code — planning / diagnosis

```
You are helping me plan this task before implementation.

Task:
[describe the feature / bug / goal in 1-3 sentences]

Repo context:
- Tech stack: [stack]
- Relevant files / folders: [paths]
- Existing behavior: [what it does now]
- Desired behavior: [what it should do]

Constraints:
- Do not change: [public APIs / schema / deps / etc.]
- Follow existing patterns from: [reference files]
- Performance / security / UX constraints: [list]

What I want from you:
1. Ask only the minimum important questions needed to remove ambiguity.
2. Then produce:
   - likely root cause or implementation approach
   - step-by-step plan
   - risks / edge cases
   - acceptance criteria
   - exact tests to run
3. Finally, write a self-contained execution prompt for Copilot.

If this task is simple enough for Codex to handle in one shot, say so and skip the Copilot prompt.

Keep it concrete and opinionated.
```

## 3. Handoff — transfer context to another tool

Use when Opus finishes planning and you need to hand off to Codex or Copilot.

```
Summarise this plan as a self-contained prompt I can paste into
[Codex / Copilot]. Include all context needed — the recipient
has no memory of this conversation.

Include:
- exact task description
- relevant file paths
- constraints and things not to change
- acceptance criteria
- verification commands to run

Format it as a ready-to-paste prompt, not a summary.
```

## 4. Copilot — long autonomous task

```
## Task
[exact task]

## Goal / stop condition
Complete the task only when ALL of these are true:
- [ ] [primary success condition]
- [ ] [tests pass]
- [ ] [coverage / lint / typecheck target]
- [ ] [no regressions / constraints met]

## Context
- Codebase / module: [brief context]
- Relevant files: [paths]
- Current problem: [what is broken / missing]
- Known clues: [failing tests / logs / stack trace]

## Constraints
- Do not modify: [files / APIs / schema / deps]
- Follow patterns from: [reference file]
- Prefer the smallest correct diff
- Do not stop at partial progress

## Required workflow
1. Inspect the relevant code and identify the likely root cause.
2. Make the minimum correct change.
3. Run verification after each meaningful change.
4. If verification fails, keep iterating until the stop condition is met.
5. If blocked, explain the blocker and the next best attempt.

## Verification
Run:
- [test command]
- [lint command]
- [typecheck command]
- [coverage command]

## Output
Return:
- root cause
- files changed
- commands run
- final results
- remaining risks
```

## 5. Codex — short focused task

```
Make this focused change:

Task:
[one precise change]

Scope:
- File(s): [paths]
- Change only what is needed for this task
- Preserve existing behavior except for the requested change

Requirements:
- [requirement 1]
- [requirement 2]
- [edge case / constraint]

Verification:
- Run: [test / lint / typecheck command]

Return:
- what changed
- why
- verification result
```

## 6. Claude Code — review

```
Review the changes on this branch against [main / target branch].

Focus on:
- correctness
- edge cases
- regression risk
- typing / runtime issues
- test coverage gaps
- unnecessary complexity
- anything fragile or suspicious

Output:
1. Critical issues
2. Important issues
3. Nice-to-have improvements
4. Missing tests
5. Final verdict: safe to merge or not

Be direct. Quote specific files and lines where possible.
```

## 7. Copilot failed — send back to Claude

```
Copilot failed this task.

Original task:
[paste]

Prompt used:
[paste]

What happened:
[paste output / errors / failed tests]

Your job:
1. Diagnose why it failed.
2. Decide whether the issue was prompt quality, wrong strategy, or task complexity.
3. Rewrite the prompt for the next attempt.
4. If Copilot is the wrong tool, tell me which tool should handle it instead and why.
```

## 8. Copilot — `/fleet` parallel task

```
/fleet Read AGENTS.md and all Copilot instruction files first.

Task:
[describe the multi-file task]

Requirements:
- Use parallel workers only where the work is naturally separable
- Many readers, one writer
- Do not let multiple agents write the same file concurrently
- Return a consolidated plan before broad edits
- Preserve architecture unless explicitly requested
- Prefer minimal diffs
- Run or recommend strongest validations

Use:
- planning / architecture lane for impact mapping
- implementation lane for code changes
- verification lane for regressions and missing tests
- security lane for trust-boundary and secrets review

Return:
- consolidated plan
- files likely to change
- validation commands
- risks and assumptions
```

## Quick reference

| Need | Tool |
|------|------|
| Plan, diagnose, review | Claude Code (#2, #6) |
| Hand off context | Claude Code (#3) |
| Long "keep going until done" | Copilot agent mode (#4) |
| Parallel multi-file task | Copilot `/fleet` (#8) |
| Short bounded edit | Codex CLI (#5) |
| Copilot failed | Back to Claude Code (#7) |
