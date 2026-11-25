---
name: python
description: Opinionated Python conventions — strict typing, dataclasses/pydantic models, and pytest-first testing. Use when working with Python files, FastAPI endpoints, or pytest tests.
---

# Python Conventions

## Preferences
- Annotate function signatures and return types strictly; avoid raw dicts for structured domain data where `dataclass` or `pydantic` models fit.
- Prefer `pathlib.Path` over `os.path` and f-strings over `.format()` or `%`.
- Avoid single-letter variable names outside comprehensions.

## Testing
- Use `pytest` with fixtures over `unittest`-style `TestCase` / `setUp` / `tearDown` unless the repo already uses `unittest`.
- For behaviour changes, add or update the smallest failing `pytest` test first (`pytest path/to/test_file.py::test_name`), then implement until it passes.

## Validation
- Prefer the repository's configured virtual environment and commands from `pyproject.toml`, `Makefile`, or CI (typically `pytest`, linter/formatter, and type-checker).
