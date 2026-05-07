#!/usr/bin/env python3
"""
Classify a project directory as greenfield, mature, or ambiguous.

Usage:
    python3 detect-mode.py [--path <dir>]

Exit codes / stdout:
    greenfield   — new project, use interactive wizard
    mature       — existing codebase, use scan mode
    ambiguous    — unclear, skill will ask user
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path


SOURCE_EXTENSIONS = {".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".rs", ".gd", ".cs", ".php"}
EXCLUDE_DIRS = {"node_modules", ".git", ".project", "vendor", "dist", "build", ".next", "__pycache__", ".godot"}


def count_source_files(root: Path) -> int:
    count = 0
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]
        for f in filenames:
            if Path(f).suffix in SOURCE_EXTENSIONS:
                count += 1
    return count


def count_non_self_commits(root: Path) -> int:
    try:
        git_user = subprocess.check_output(
            ["git", "config", "user.name"], cwd=root, stderr=subprocess.DEVNULL
        ).decode().strip()
        log = subprocess.check_output(
            ["git", "log", "--format=%an", "--no-merges"],
            cwd=root, stderr=subprocess.DEVNULL
        ).decode().strip()
        if not log:
            return 0
        authors = log.splitlines()
        return sum(1 for a in authors if a != git_user)
    except subprocess.CalledProcessError:
        return 0


def has_readme(root: Path) -> bool:
    for name in ("README.md", "README.rst", "README.txt", "readme.md"):
        p = root / name
        if p.exists() and p.stat().st_size > 100:
            return True
    return False


def count_dependencies(root: Path) -> int:
    package_json = root / "package.json"
    if package_json.exists():
        try:
            data = json.loads(package_json.read_text())
            return len(data.get("dependencies", {})) + len(data.get("devDependencies", {}))
        except (json.JSONDecodeError, OSError):
            pass

    requirements = root / "requirements.txt"
    if requirements.exists():
        try:
            lines = [l.strip() for l in requirements.read_text().splitlines() if l.strip() and not l.startswith("#")]
            return len(lines)
        except OSError:
            pass

    cargo = root / "Cargo.toml"
    if cargo.exists():
        try:
            content = cargo.read_text()
            return content.count("\n[dependencies]") + content.count("\n[dev-dependencies]")
        except OSError:
            pass

    return 0


def has_project_json(root: Path) -> bool:
    return (root / ".project" / "project.json").exists()


def classify(root: Path) -> str:
    if has_project_json(root):
        return "mature"

    signals = 0

    source_count = count_source_files(root)
    if source_count > 20:
        signals += 1

    non_self = count_non_self_commits(root)
    if non_self > 10:
        signals += 1

    if has_readme(root):
        signals += 1

    dep_count = count_dependencies(root)
    if dep_count >= 3:
        signals += 1

    if signals >= 2:
        return "mature"
    elif signals == 1:
        return "ambiguous"
    else:
        return "greenfield"


def main() -> None:
    parser = argparse.ArgumentParser(description="Classify project as greenfield/mature/ambiguous")
    parser.add_argument("--path", default=".", help="Project root directory (default: current dir)")
    args = parser.parse_args()

    root = Path(args.path).resolve()
    if not root.is_dir():
        print(f"error: {root} is not a directory", file=sys.stderr)
        sys.exit(1)

    print(classify(root))


if __name__ == "__main__":
    main()
