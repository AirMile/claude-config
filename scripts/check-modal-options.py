#!/usr/bin/env python3
"""Report AskUserQuestion option sets with more than 4 options.

`AskUserQuestion` enforces `maxItems: 4` on `options` — a 5th option makes
the call fail outright (skills/shared/SKILL-PATTERNS.md § Modal Option Cap).
Deterministic evidence for core-audit dimension 7: unlike the other checkers
a WARN here is a runtime failure, not a style judgement — `maxItems: 4` is a
hard API constant, not a heuristic with authoring slack.

Two shapes are scanned:

  1. Block form — a YAML-ish `options:` key followed by indented `- label:`
     entries (the literal shape most SKILL.md files prescribe).
  2. Prose form — a single line like `- Options: A, B, C, D, E` (some skills
     describe the modal inline instead of as a block).

Both require an `AskUserQuestion`/`header:`/`question:`/`multiSelect:` token
nearby, so ordinary enumerations ("Styling/UI: Tailwind, shadcn/ui, ...")
and non-modal `options:` keys (CLI flags, JSON schemas) are not flagged. A
block or line carrying an `option-cap: exempt` marker is skipped — for text
that deliberately documents the anti-pattern instead of calling the tool.

Locate-only: this script never judges why a modal is over cap and never
proposes the split — core-audit dimension 7 does. It also cannot see options
generated at runtime from a scan/feature list (the exact case § Modal Option
Cap exists for) — those never appear as a literal `options:` block, so a
clean run is not proof the skill has none.

Usage:
  python3 scripts/check-modal-options.py                 # scan all of skills/
  python3 scripts/check-modal-options.py --skill dev-ship

Exit code: currently always 0 (non-gating while known violations exist — see
the core-audit plan doc). Flips to "1 = at least one WARN" once the repo is
clean, in the same commit that clears the last violation.
"""
import argparse
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILLS_DIR = REPO_ROOT / "skills"
MAX = 4
FENCE = chr(96) * 3  # ``` without a literal backtick in source
EXEMPT = "option-cap: exempt"
CONTEXT_WINDOW = 8

OPTIONS_RE = re.compile(r"^(\s*)(?:[-*]\s*)?\*{0,2}options\*{0,2}\s*:\s*$")
LABEL_RE = re.compile(r"^\s*-\s*\*{0,2}label\*{0,2}\s*:")
STOP_RE = re.compile(r"^\s*(?:[-*]\s*)?\*{0,2}(multiSelect|header|question)\*{0,2}\s*:")
CONTEXT_RE = re.compile(
    r"AskUserQuestion|^\s*(?:[-*]\s*)?\*{0,2}(header|question|multiSelect)\*{0,2}\s*:",
    re.MULTILINE,
)
PROSE_RE = re.compile(r"^(\s*)(?:[-*]\s*)?\*{0,2}Options?\*{0,2}\s*:\s+(\S.*)$")


def _has_context(lines, start, end):
    near = "\n".join(lines[max(0, start - CONTEXT_WINDOW) : end])
    return bool(CONTEXT_RE.search(near))


def scan_blocks(lines):
    """Yield (lineno, count) for over-cap YAML-ish `options:` blocks."""
    i = 0
    while i < len(lines):
        m = OPTIONS_RE.match(lines[i])
        if not m:
            i += 1
            continue
        base = len(m.group(1))
        count, exempt, j = 0, EXEMPT in lines[i], i + 1
        while j < len(lines):
            line = lines[j]
            if not line.strip() or line.lstrip().startswith((FENCE, "~~~")):
                break
            if EXEMPT in line:
                exempt = True
            if LABEL_RE.match(line):  # checked before the dedent rule below
                count += 1
                j += 1
                continue
            indent = len(line) - len(line.lstrip())
            if STOP_RE.match(line) or indent <= base:
                break
            j += 1
        if count > MAX and not exempt and _has_context(lines, i, j):
            yield (i + 1, count)
        i = max(j, i + 1)


def scan_prose(lines):
    """Yield (lineno, count) for over-cap `Options: a, b, c` lines."""
    for i, line in enumerate(lines):
        m = PROSE_RE.match(line)
        if not m:
            continue
        if EXEMPT in line:
            continue
        values = [v for v in m.group(2).split(",") if v.strip()]
        if len(values) > MAX and _has_context(lines, i, i + 1):
            yield (i + 1, len(values))


def scan(path):
    lines = path.read_text(encoding="utf-8").splitlines()
    hits = list(scan_blocks(lines)) + list(scan_prose(lines))
    return sorted(hits)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--skill", help="restrict to skills/<name>/")
    args = ap.parse_args()
    root = SKILLS_DIR / args.skill if args.skill else SKILLS_DIR
    if not root.is_dir():
        print(f"ERROR: no such skill dir: {root}")
        return 1
    files = sorted(root.rglob("*.md"))
    warns = 0
    for md in files:
        for lineno, count in scan(md):
            rel = md.relative_to(REPO_ROOT)
            print(
                f"WARN {rel}:{lineno} modal has {count} options "
                f"(max {MAX}) — split per § Modal Option Cap"
            )
            warns += 1
    print(f"{warns} over-cap modal(s) (files scanned: {len(files)})")
    # Non-gating for now — see docstring. Flip to `return 1 if warns else 0`
    # once the repo is clean.
    return 0


if __name__ == "__main__":
    sys.exit(main())
