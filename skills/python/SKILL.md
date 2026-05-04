---
name: python
description: Python coding conventions — type hints, testing with pytest, code style. Use when working with Python files, FastAPI endpoints, or pytest tests.
---

# Python Conventions

## Code style
- Always use type hints on function signatures and return types.
- Use f-strings for string formatting, not `.format()` or `%`.
- Use meaningful variable names — no single-letter names outside comprehensions.
- Prefer `pathlib.Path` over `os.path`.
- Use `dataclasses` or `pydantic` models over raw dicts for structured data.

## Testing
- Use `pytest` as the test runner.
- For behaviour changes, write or update the smallest failing pytest first, then implement until it passes.
- Prefer `assert x == y` over `unittest`-style `self.assertEqual`.
- Use fixtures over `setUp`/`tearDown` where possible.

## Commands
- Single test: `pytest path/to/test_file.py::test_name` or `. .venv/bin/activate && pytest path/to/test_file.py::test_name`
- Test: `pytest` or `. .venv/bin/activate && pytest`
- Lint: `ruff check .`
- Format: `ruff format .`
- Type-check: `mypy .`
