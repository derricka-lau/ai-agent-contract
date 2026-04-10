---
name: test-strategy
description: Plan and execute the strongest relevant test strategy for a change. Use when you need targeted tests first and broader validation only where scope warrants it.
---

# Test Strategy

1. Detect available test commands from package.json, Makefile, or CI config.
2. Run targeted tests for changed areas first.
3. Escalate to broader suites if scope warrants.
4. Report failures with likely root causes.
5. Report any checks that could not run.