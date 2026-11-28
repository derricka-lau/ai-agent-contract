"""List top-level definitions unreachable from a tree's entry points; with --baseline, show what became dead.

Usage: python3 reachability.py <tree-root> --package pkg [--package other] [--entry-dir evals] [--entry-name main]
                               [--baseline <baseline-tree-root>]

Roots are:
  - module-level statements that are not definitions, imports or __all__;
  - decorated definitions (routes, tools, validators register themselves);
  - every definition in an --entry-dir;
  - any --entry-name.
References follow names and attribute names, so the result is conservative: a name collision can keep dead code
"alive", but live code is never reported dead because of how it is called. Decorators, string dispatch and
reflection count as references only when the name appears.

With --baseline:
  - dead on both trees means pre-existing;
  - dead only on the candidate means a caller was lost, so prove its behaviour moved before deleting it;
  - dead only on the baseline means it was already removed.
"""

from __future__ import annotations

import argparse
import ast
import collections
import pathlib
import sys


def _identifiers(node: ast.AST) -> set[str]:
    found: set[str] = set()
    for child in ast.walk(node):
        if isinstance(child, ast.Name):
            found.add(child.id)
        elif isinstance(child, ast.Attribute):
            found.add(child.attr)
        elif isinstance(child, ast.Constant) and isinstance(child.value, str) and child.value.isidentifier():
            found.add(child.value)
    return found


def unreachable(root: pathlib.Path, packages: list[str], entry_dirs: list[str], entry_names: list[str]) -> set[tuple[str, str]]:
    files = [p for d in packages + entry_dirs for p in (root / d).rglob("*.py") if "__pycache__" not in p.parts]
    definitions: dict[str, list[tuple[str, set[str]]]] = collections.defaultdict(list)
    roots: set[str] = set(entry_names)
    for path in files:
        relative = path.relative_to(root)
        is_entry = relative.parts[0] in entry_dirs
        for node in ast.parse(path.read_text()).body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                ids = _identifiers(node) - {node.name}
                definitions[node.name].append((str(relative), ids))
                if node.decorator_list or is_entry:
                    roots |= ids | {node.name}
            elif isinstance(node, (ast.Import, ast.ImportFrom)):
                continue
            elif isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == "__all__" for t in node.targets):
                continue
            else:
                roots |= _identifiers(node)
    live: set[str] = set()
    frontier = set(roots)
    while frontier:
        name = frontier.pop()
        if name in live:
            continue
        live.add(name)
        for _, ids in definitions.get(name, []):
            frontier |= ids - live
    return {(path, name) for name, entries in definitions.items() if name not in live for path, _ in entries}


def main() -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").split("\n\n")[0])
    parser.add_argument("root", type=pathlib.Path)
    parser.add_argument("--package", action="append", required=True)
    parser.add_argument("--entry-dir", action="append", default=[])
    parser.add_argument("--entry-name", action="append", default=["main", "lifespan"])
    parser.add_argument("--baseline", type=pathlib.Path)
    args = parser.parse_args()
    candidate = unreachable(args.root, args.package, args.entry_dir, args.entry_name)
    if args.baseline is None:
        print(f"unreachable definitions: {len(candidate)}")
        for path, name in sorted(candidate):
            print(f"  {path}\t{name}")
        return 0
    baseline = unreachable(args.baseline, args.package, args.entry_dir, args.entry_name)
    candidate_names, baseline_names = {n for _, n in candidate}, {n for _, n in baseline}
    groups = (
        ("dead ONLY on the candidate (caller lost; prove the behaviour moved before deleting)", candidate_names - baseline_names),
        ("dead on both (pre-existing; deleting is a separate decision)", candidate_names & baseline_names),
        ("dead only on the baseline (already removed)", baseline_names - candidate_names),
    )
    for title, names in groups:
        print(f"{title}: {len(names)}")
        for path, name in sorted((p, n) for p, n in candidate | baseline if n in names):
            print(f"  {path}\t{name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
