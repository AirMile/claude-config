#!/usr/bin/env python3
"""Report lines >76 chars inside fenced code blocks of a skill's surface.

Locate-only evidence for core-audit dimension 11 (shared/OUTPUT.md
S Report Block: 72-char runtime target + 4 chars authoring slack).
Always exits 0 when the skill exists; findings are WARNs, not failures.

Usage: python3 scripts/check-report-width.py --skill dev-ship
"""
import argparse
import pathlib
import sys

FENCE = chr(96) * 3  # ``` without a literal backtick in source
MAX = 76


def scan(path):
    hits = []
    in_fence = False
    for i, line in enumerate(
        path.read_text(encoding="utf-8").splitlines(), 1
    ):
        if line.lstrip().startswith(FENCE):
            in_fence = not in_fence
            continue
        if in_fence and len(line) > MAX:
            hits.append((i, len(line)))
    return hits


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--skill", required=True)
    args = ap.parse_args()
    repo = pathlib.Path(__file__).resolve().parent.parent
    root = repo / "skills" / args.skill
    if not root.is_dir():
        print(f"unknown skill: {args.skill}", file=sys.stderr)
        return 1
    total = 0
    for md in sorted(root.rglob("*.md")):
        for lineno, length in scan(md):
            rel = md.relative_to(repo)
            print(f"WARN {rel}:{lineno} fenced line {length} chars (>{MAX})")
            total += 1
    print(f"{total} long fenced line(s) in {args.skill}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
