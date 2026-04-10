---
name: test-and-validate
description: Run the strongest relevant validation sequence. Use when changes need a repeatable format, lint, type-check, test, and build order.
---

# Test And Validate

Order: format -> lint -> typecheck -> targeted tests -> broader tests -> build.

Report failures with likely root causes.
Report any checks that could not run.