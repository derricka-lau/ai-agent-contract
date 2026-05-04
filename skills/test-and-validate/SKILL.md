---
name: test-and-validate
description: Run the strongest relevant validation sequence. Use when changes need a repeatable format, lint, type-check, test, and build order.
---

# Test And Validate

Order: targeted failing test or new focused test -> focused re-run after implementation -> format -> lint -> typecheck -> broader tests -> build.

Report failures with likely root causes.
Report when no automated test could be used and why.
Report any checks that could not run.