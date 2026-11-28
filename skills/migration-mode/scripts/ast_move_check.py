"""Prove a commit range changed only imports (and listed __all__ or docstring edits) in Python code.

Usage: python3 ast_move_check.py <repo> <base> <head> [--path PATHSPEC]

Every changed .py file is parsed at <base> and <head>. All import statements are removed, nested ones included.
The top-level definitions of all changed files are then compared as one multiset, so definitions may move
between files. Exit status 0 means the code is identical; 1 means it differs (each differing definition is printed).
"""

from __future__ import annotations

import argparse
import ast
import collections
import subprocess
import sys


class _StripImports(ast.NodeTransformer):
    def visit_Import(self, node: ast.Import) -> None:
        del node

    def visit_ImportFrom(self, node: ast.ImportFrom) -> None:
        del node


def _git(repo: str, *args: str) -> str:
    return subprocess.run(["git", "-C", repo, *args], capture_output=True, text=True, check=True).stdout


def _name(node: ast.stmt) -> str:
    name = getattr(node, "name", None)
    if isinstance(name, ast.Name):
        return name.id
    if isinstance(name, str):
        return name
    if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
        return node.targets[0].id
    if isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
        return node.target.id
    return ast.unparse(node)[:60]


def _definitions(source: str) -> list[tuple[str, str]]:
    tree = _StripImports().visit(ast.parse(source))
    out: list[tuple[str, str]] = []
    for index, node in enumerate(tree.body):
        if index == 0 and isinstance(node, ast.Expr) and isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
            out.append(("<module docstring>", ast.dump(node)))
        else:
            out.append((_name(node), ast.dump(node)))
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").split("\n\n")[0])
    parser.add_argument("repo")
    parser.add_argument("base")
    parser.add_argument("head")
    parser.add_argument("--path", default=".", help="pathspec limiting the compared files")
    args = parser.parse_args()

    rows = [line.split("\t") for line in _git(args.repo, "diff", "-M", "--name-status", args.base, args.head, "--", args.path).splitlines()]
    old_code: collections.Counter[tuple[str, str]] = collections.Counter()
    new_code: collections.Counter[tuple[str, str]] = collections.Counter()
    edits: set[str] = set()
    special = {"__all__", "<module docstring>"}
    python_files = 0
    for row in rows:
        status, old_path, new_path = row[0][0], row[1], row[-1]
        if not (old_path.endswith(".py") or new_path.endswith(".py")):
            continue
        python_files += 1
        old = _definitions(_git(args.repo, "show", f"{args.base}:{old_path}")) if status != "A" else []
        new = _definitions(_git(args.repo, "show", f"{args.head}:{new_path}")) if status != "D" else []
        for name, dump in old:
            if name in special:
                if (name, dump) not in new:
                    edits.add(f"{status} {new_path}: {name} changed")
            else:
                old_code[(name, dump)] += 1
        for name, dump in new:
            if name in special:
                if (name, dump) not in old:
                    edits.add(f"{status} {new_path}: {name} changed")
            else:
                new_code[(name, dump)] += 1

    lost, gained = old_code - new_code, new_code - old_code
    print(f"python files: {python_files} | definitions compared: {sum(old_code.values())}")
    print("CODE IDENTICAL (imports stripped, cross-file moves allowed)" if not lost and not gained else "CODE DIFFERS")
    for name, _ in sorted(lost):
        print(f"  only in base: {name}")
    for name, _ in sorted(gained):
        print(f"  only in head: {name}")
    for edit in sorted(edits):
        print(f"  listed edit: {edit}")
    return 0 if not lost and not gained else 1


if __name__ == "__main__":
    sys.exit(main())
