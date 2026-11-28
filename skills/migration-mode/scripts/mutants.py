"""Prove each pin detects its rule: apply one mutant at a time to a disposable copy and run the tests.

Usage: python3 mutants.py --tree <copy> --spec mutants.json --package pkg [--python PY] [--timeout S] -- <test command...>

mutants.json is a list of {"id": "...", "file": "relative/path.py", "old": "exact anchor", "new": "replacement"}.
Write one or more mutants per inventory row: a limit off by one, a text changed, a branch inverted, a call removed.

Safeguards:
  - refuses a tree containing .git (use `git archive <commit> | tar -x -C <copy>`);
  - checks that <package> imports from inside the copy (an installed package would make mutants look killed or alive
    for the wrong reason);
  - requires the unmutated suite to pass first;
  - requires each anchor to occur exactly once;
  - restores every file after its run;
  - disables and clears Python's bytecode cache, so a mutant can never run stale code.
A mutant is KILLED (the tests failed), SURVIVED (the tests passed: the rule is unpinned) or ERROR (exit codes from
--error-codes, default the pytest usage, collection and no-tests codes 2,3,4,5; a broken run is not a catch).
Exit status 1 if any mutant survived or errored.
"""

from __future__ import annotations

import argparse
import json
import os
import pathlib
import shutil
import subprocess
import sys


def _run(command: list[str], cwd: pathlib.Path, timeout: float) -> tuple[int, str]:
    # No bytecode cache: a same-length mutant written within the same second would otherwise reuse a stale .pyc.
    env = {**os.environ, "PYTHONDONTWRITEBYTECODE": "1"}
    try:
        process = subprocess.run(command, cwd=cwd, capture_output=True, text=True, timeout=timeout, env=env)
    except subprocess.TimeoutExpired:
        return -1, "timeout"
    tail = (process.stdout.strip().splitlines() or process.stderr.strip().splitlines() or [""])[-1]
    return process.returncode, tail


def main() -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").split("\n\n")[0])
    parser.add_argument("--tree", type=pathlib.Path, required=True)
    parser.add_argument("--spec", type=pathlib.Path, required=True)
    parser.add_argument("--package", required=True)
    parser.add_argument("--python", default=sys.executable)
    parser.add_argument("--timeout", type=float, default=900)
    parser.add_argument("--error-codes", default="2,3,4,5")
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = args.command[1:] if args.command[:1] == ["--"] else args.command
    if not command:
        parser.error("give the test command after --")
    tree = args.tree.resolve()
    if (tree / ".git").exists():
        raise SystemExit(f"{tree} contains .git; mutate a disposable copy (git archive <commit> | tar -x -C <copy>)")
    error_codes = {int(code) for code in args.error_codes.split(",") if code}
    for cache in list(tree.rglob("__pycache__")):
        shutil.rmtree(cache)

    probe = (
        "import importlib, pathlib, sys; sys.path.insert(0, '.'); "
        f"m = importlib.import_module({args.package!r}); "
        "p = pathlib.Path(getattr(m, '__file__', None) or list(m.__path__)[0]).resolve(); "
        "assert p.is_relative_to(pathlib.Path.cwd().resolve()), p; print(p)"
    )
    code, tail = _run([args.python, "-c", probe], tree, 60)
    if code != 0:
        raise SystemExit(f"{args.package} does not import from inside {tree}: {tail}")
    code, tail = _run(command, tree, args.timeout)
    if code != 0:
        raise SystemExit(f"the unmutated suite is not green (exit {code}): {tail}")

    mutants = json.loads(args.spec.read_text())
    results: list[tuple[str, str, str]] = []
    for mutant in mutants:
        path = tree / mutant["file"]
        original = path.read_text()
        occurrences = original.count(mutant["old"])
        if occurrences != 1:
            results.append((mutant["id"], "ERROR", f"anchor found {occurrences} times"))
            continue
        path.write_text(original.replace(mutant["old"], mutant["new"]))
        try:
            code, tail = _run(command, tree, args.timeout)
        finally:
            path.write_text(original)
        verdict = "SURVIVED" if code == 0 else ("ERROR" if code in error_codes or code == -1 else "KILLED")
        results.append((mutant["id"], verdict, tail))

    for mutant_id, verdict, tail in results:
        print(f"{verdict:8} {mutant_id} :: {tail[:140]}")
    killed = sum(verdict == "KILLED" for _, verdict, _ in results)
    print(f"mutants: {len(results)} | killed: {killed} | survived: {sum(v == 'SURVIVED' for _, v, _ in results)} | errors: {sum(v == 'ERROR' for _, v, _ in results)}")
    return 0 if killed == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
