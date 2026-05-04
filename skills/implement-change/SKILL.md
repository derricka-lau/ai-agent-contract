---
name: implement-change
description: Apply a minimal, correct implementation following the approved plan. Use when execution should preserve repo patterns and avoid unrelated cleanup.
---

# Implement Change

1. Re-read the approved plan.
2. Match local patterns in nearby files.
3. Define or add the smallest failing automated test before editing implementation. If no automated test fits the change, state why first.
4. Implement the smallest change that solves the task and makes the focused test pass.
5. Keep diffs focused and avoid unrelated cleanup.
6. Note the broader tests and validations that must still run.