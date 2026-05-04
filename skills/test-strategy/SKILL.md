---
name: test-strategy
description: Plan and execute the strongest relevant test strategy for a change. Use when you need targeted tests first and broader validation only where scope warrants it.
---

# Test Strategy

1. Detect available test commands from package.json, Makefile, or CI config.
2. Identify the smallest relevant automated test, or add one, that should fail for the requested behaviour before implementation.
3. Run that targeted failing test first and keep it as the primary feedback loop.
4. Implement the minimal change that makes the targeted test pass.
5. Escalate to broader suites if scope warrants.
6. Report failures with likely root causes.
7. Report any checks that could not run.