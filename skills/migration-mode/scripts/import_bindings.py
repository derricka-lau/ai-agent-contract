"""Prove that rewritten imports still bind the same objects (no import silently points somewhere else).

Run "dump" with each tree's project interpreter, so project imports resolve:
  python import_bindings.py dump <tree-root> <out.json> --package pkg [--package tests ...]
Then compare the two dumps (any interpreter):
  python3 import_bindings.py compare <old.json> <new.json> [--git REPO BASE HEAD --strip PREFIX/]

dump imports every module under each --package directory of <tree-root>, and asserts the first package resolves inside
the tree. For every `from X import Y` (nested ones included), it records a fingerprint of the bound object:
  - the source hash for functions and classes (the `__wrapped__` source for caches and decorators);
  - the repr for values, unless the repr holds a memory address.
compare maps old module names to new ones through git's renames. It exits 1 if any binding now resolves to a
different object. Bindings that were removed or added are listed for review: re-export edits in __init__ files are
legitimate, a missing import elsewhere is not.
"""

from __future__ import annotations

import argparse
import ast
import hashlib
import importlib
import inspect
import json
import pathlib
import subprocess
import sys
import typing


def _fingerprint(obj: object) -> str:
    if inspect.ismodule(obj):
        return "module"
    if inspect.isclass(obj) or inspect.isfunction(obj):
        try:
            return "src:" + hashlib.sha256(inspect.getsource(obj).encode()).hexdigest()[:16]
        except (OSError, TypeError):
            return "obj:" + getattr(obj, "__qualname__", type(obj).__name__)
    wrapped = getattr(obj, "__wrapped__", None)
    if wrapped is not None and (inspect.isfunction(wrapped) or inspect.isclass(wrapped)):
        return "wrapped:" + _fingerprint(wrapped)
    alias_type = getattr(typing, "TypeAliasType", None)
    if alias_type is not None and isinstance(obj, alias_type):
        return f"alias:{getattr(obj, '__name__', '')}={getattr(obj, '__value__', None)!r}"
    text = repr(obj)
    if " at 0x" in text:
        return f"obj:{type(obj).__module__}.{type(obj).__qualname__}"
    return f"val:{type(obj).__name__}:{text[:300]}"


def _module_name(root: pathlib.Path, path: pathlib.Path) -> str:
    name = ".".join(path.relative_to(root).with_suffix("").parts)
    return name.removesuffix(".__init__")


def dump(root: pathlib.Path, out: pathlib.Path, packages: list[str]) -> int:
    root = root.resolve()
    sys.path.insert(0, str(root))
    first = importlib.import_module(packages[0])
    location = pathlib.Path(getattr(first, "__file__", "") or next(iter(getattr(first, "__path__", [""])))).resolve()
    if not location.is_relative_to(root):
        raise SystemExit(f"{packages[0]} resolves to {location}, outside {root}; fix the interpreter or path first")
    modules: dict[str, dict[str, dict[str, str]]] = {}
    failures: list[str] = []
    files = sorted(p for package in packages for p in (root / package).rglob("*.py") if "__pycache__" not in p.parts)
    for path in files:
        name = _module_name(root, path)
        try:
            module = importlib.import_module(name)
        except Exception as exc:  # report every import failure; a dump with failures is not a proof
            failures.append(f"{name}: {type(exc).__name__}: {exc}"[:200])
            continue
        package = name if path.name == "__init__.py" else name.rpartition(".")[0]
        binds: dict[str, str] = {}
        for node in ast.walk(ast.parse(path.read_text())):
            if not isinstance(node, ast.ImportFrom):
                continue
            if node.level:
                parts = package.split(".")
                parts = parts[: len(parts) - (node.level - 1)] if node.level > 1 else parts
                source = ".".join(parts + ([node.module] if node.module else []))
            else:
                source = node.module or ""
            if not source.split(".")[0] in packages:
                continue
            for alias in node.names:
                try:
                    target = importlib.import_module(source)
                    obj = getattr(target, alias.name) if hasattr(target, alias.name) else importlib.import_module(f"{source}.{alias.name}")
                    binds[alias.asname or alias.name] = _fingerprint(obj)
                except Exception as exc:
                    binds[alias.asname or alias.name] = f"ERROR {type(exc).__name__}"
        defs = {
            attr: _fingerprint(value)
            for attr, value in vars(module).items()
            if not attr.startswith("__") and (inspect.isclass(value) or inspect.isfunction(value)) and getattr(value, "__module__", None) == name
        }
        modules[name] = {"binds": binds, "defs": defs}
    out.write_text(json.dumps({"modules": modules, "failures": failures}, indent=1, sort_keys=True))
    print(f"modules: {len(modules)} | import failures: {len(failures)}")
    for failure in failures:
        print(f"  FAIL {failure}")
    return 1 if failures else 0


def _renames(repo: str, base: str, head: str, strip: str) -> dict[str, str]:
    output = subprocess.run(["git", "-C", repo, "diff", "-M", "--name-status", base, head], capture_output=True, text=True, check=True).stdout
    def module(path: str) -> str:
        return path.removeprefix(strip).removesuffix(".py").replace("/", ".").removesuffix(".__init__")
    return {module(row[1]): module(row[2]) for row in (line.split("\t") for line in output.splitlines()) if row[0].startswith("R")}


def compare(old_path: pathlib.Path, new_path: pathlib.Path, renames: dict[str, str]) -> int:
    old = json.loads(old_path.read_text())["modules"]
    new = json.loads(new_path.read_text())["modules"]
    def normalise(text: str) -> str:
        for before, after in sorted(renames.items(), key=lambda item: -len(item[0])):
            text = text.replace(before, after)
        return text
    different, removed, added, checked = [], [], [], 0
    for old_module, data in old.items():
        new_module = renames.get(old_module, old_module)
        if new_module not in new:
            continue
        for name, fingerprint in data["binds"].items():
            checked += 1
            current = new[new_module]["binds"].get(name)
            if current is None:
                if new[new_module]["defs"].get(name) != fingerprint:
                    removed.append(f"{new_module}: '{name}' no longer imported")
            elif normalise(fingerprint) != normalise(current):
                different.append(f"{new_module}: '{name}' binds a DIFFERENT object: {fingerprint[:60]} -> {current[:60]}")
    reverse = {after: before for before, after in renames.items()}
    for new_module, data in new.items():
        old_module = reverse.get(new_module, new_module)
        if old_module not in old:
            continue
        for name, fingerprint in data["binds"].items():
            if name not in old[old_module]["binds"] and old[old_module]["defs"].get(name) != fingerprint:
                added.append(f"{new_module}: new import '{name}'")
    print(f"bindings compared: {checked} | different objects: {len(different)} | removed: {len(removed)} | added: {len(added)}")
    for line in different:
        print(f"  DIFFERENT {line}")
    for line in removed:
        print(f"  review    {line}")
    for line in added:
        print(f"  review    {line}")
    return 1 if different else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=(__doc__ or "").split("\n\n")[0])
    commands = parser.add_subparsers(dest="command", required=True)
    dump_parser = commands.add_parser("dump")
    dump_parser.add_argument("root", type=pathlib.Path)
    dump_parser.add_argument("out", type=pathlib.Path)
    dump_parser.add_argument("--package", action="append", required=True)
    compare_parser = commands.add_parser("compare")
    compare_parser.add_argument("old", type=pathlib.Path)
    compare_parser.add_argument("new", type=pathlib.Path)
    compare_parser.add_argument("--git", nargs=3, metavar=("REPO", "BASE", "HEAD"))
    compare_parser.add_argument("--strip", default="", help="path prefix to strip before mapping files to modules")
    args = parser.parse_args()
    if args.command == "dump":
        return dump(args.root, args.out, args.package)
    renames: dict[str, str] = {}
    if args.git:
        repo, base, head = args.git
        renames = _renames(repo, base, head, args.strip)
    return compare(args.old, args.new, renames)


if __name__ == "__main__":
    sys.exit(main())
