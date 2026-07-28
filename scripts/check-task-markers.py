#!/usr/bin/env python3
"""Validate the Task Tracking marker pattern in skill files.

Convention: skills/shared/SKILL-PATTERNS.md § Task Tracking. A file that seeds
a task list (a line like "call `TaskCreate` with these N items" followed by a
numbered phase list) is a *tracking unit*. For every seeded phase this script
checks, across the unit's file and its sibling .md files in the same skill:

  1. a phase header exists (## / ### / #### containing "WORD ID"),
  2. the phase is marked `in_progress` somewhere (bootstrap or transition), OR
     explicitly waives it ("skips `in_progress`" — a synchronous phase with no
     meaningful in-progress duration, e.g. dev-manual's MANUAL 0),
  3. the phase is marked `completed` somewhere (transition or completion marker).

Whitespace is normalized before matching (markers wrap across quoted lines) and
fenced code blocks are stripped (SKILL-PATTERNS.md documents the pattern inside
fences without being a tracking unit). Negated mentions ("must NOT call
`TaskCreate`", non-interactive contracts) are not seeds.

Heuristic, deliberately permissive: an unparsable candidate gets a non-fatal
PARSE-SKIP line, never a WARN — odd-but-valid structures must not hard-block.

Usage:
  python3 scripts/check-task-markers.py                 # scan all of skills/
  python3 scripts/check-task-markers.py --skill dev-ship
  python3 scripts/check-task-markers.py path/to/file.md ...   # explicit files/dirs

Exit code: 0 = no WARN, 1 = at least one WARN (PARSE-SKIP is never fatal).
"""

import argparse
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILLS_DIR = REPO_ROOT / "skills"

# Seed line: an affirmative "call `TaskCreate`" outside a blockquote. Bootstrap
# markers live in "> **Todo**" quotes; negated mentions are contract rules.
SEED_RE = re.compile(r"call\s+`TaskCreate`", re.IGNORECASE)
NEGATED_RE = re.compile(r"\b(not|never|don'?t)\b[^.]{0,40}call\s+`TaskCreate`", re.IGNORECASE)

# Seed item: "1. PHASE 0: ..." — capture the phase word and identifier (0, 2b, 3A).
SEED_ITEM_RE = re.compile(r"^\s*\d+\.\s+([A-Z][A-Za-z]*)\s+(\d+[A-Za-z]?)\b")

FENCE_RE = re.compile(r"^\s*(```|~~~)")


def strip_fences(text: str) -> tuple[str, bool]:
    """Blank out fenced code blocks, preserving line count.

    Returns (stripped_text, balanced). On an unbalanced fence the stripped text
    is unusable (everything after the stray fence gets blanked) — callers must
    fall back to the raw text and surface the defect.
    """
    out, in_fence = [], False
    for line in text.splitlines():
        if FENCE_RE.match(line):
            in_fence = not in_fence
            out.append("")
            continue
        out.append("" if in_fence else line)
    return "\n".join(out), not in_fence


def safe_text(raw: str) -> str:
    """Fence-stripped text when fences balance, raw text otherwise."""
    stripped, balanced = strip_fences(raw)
    return stripped if balanced else raw


def normalize(text: str) -> str:
    """Collapse whitespace and blockquote continuations so wrapped markers match."""
    text = re.sub(r"^\s*>\s?", " ", text, flags=re.MULTILINE)
    return re.sub(r"\s+", " ", text)


def find_seeds(text: str) -> list[tuple[int, list[tuple[str, str]]]]:
    """Return (seed_lineno, [(word, id), ...]) per seed; empty items = candidate only."""
    lines = text.splitlines()
    seeds = []
    for i, line in enumerate(lines):
        if line.lstrip().startswith(">"):
            continue  # bootstrap markers quote `TaskCreate`, they are not seeds
        if not SEED_RE.search(line) or NEGATED_RE.search(line):
            continue
        items: list[tuple[str, str]] = []
        # Numbered phase items follow within a short window (prose may intervene,
        # e.g. dev-ship's durable-checkpoint paragraph sits between seed and list).
        for follow in lines[i + 1 : i + 25]:
            m = SEED_ITEM_RE.match(follow)
            if m:
                items.append((m.group(1), m.group(2)))
            elif items and follow.strip() and not follow.lstrip()[0].isdigit():
                break  # numbered list ended
        seeds.append((i + 1, items))
    return seeds


def phase_header_exists(word: str, pid: str, texts: list[str]) -> bool:
    pat = re.compile(rf"^#{{2,4}}\s+.*\b{re.escape(word)}\s+{re.escape(pid)}\b", re.MULTILINE)
    return any(pat.search(t) for t in texts)


def status_marked(word: str, pid: str, status: str, norm_texts: list[str]) -> bool:
    # Matches "PHASE 2b → `completed`" and "PHASE 2b -> `completed`" after
    # normalization; the arrow may carry surrounding prose on the same line.
    pat = re.compile(
        rf"\b{re.escape(word)}\s+{re.escape(pid)}\b[^`]{{0,40}}(→|->)\s*`{status}`"
    )
    return any(pat.search(t) for t in norm_texts)


def in_progress_waived(word: str, pid: str, norm_texts: list[str]) -> bool:
    # SKILL-PATTERNS.md § Task Tracking → Skip-`in_progress` marker: a phase whose
    # entire work is a synchronous routing/resolution check (no meaningful
    # in-progress duration) may say so explicitly instead of ever marking
    # `in_progress` — e.g. dev-manual's MANUAL 0.
    pat = re.compile(
        rf"\b{re.escape(word)}\s+{re.escape(pid)}\b[^.]{{0,80}}skips\s*`in_progress`"
    )
    return any(pat.search(t) for t in norm_texts)


def sibling_mds(path: Path, scope_root: Path) -> list[Path]:
    """All .md files in the tracking unit's skill dir (or parent dir for loose files)."""
    base = path.parent
    for parent in [path.parent, *path.parents]:
        if parent.parent == scope_root:
            base = parent
            break
    return sorted(p for p in base.rglob("*.md") if p.is_file())


def check_file(path: Path, scope_root: Path, warns: list[str], skips: list[str]) -> int:
    """Validate one file; returns the number of tracking units found."""
    raw = path.read_text(encoding="utf-8")
    text, balanced = strip_fences(raw)
    if not balanced:
        text = raw
    seeds = find_seeds(text)
    if not seeds:
        return 0

    rel = path.relative_to(REPO_ROOT) if path.is_relative_to(REPO_ROOT) else path
    if not balanced:
        warns.append(
            f"WARN: {rel} — unbalanced code fence (odd number of ``` lines); "
            f"fix the stray fence — tooling and renderers misparse everything after it"
        )
    siblings = sibling_mds(path, scope_root)
    sib_texts = [safe_text(p.read_text(encoding="utf-8")) for p in siblings]
    sib_norms = [normalize(t) for t in sib_texts]

    units = 0
    for lineno, items in seeds:
        if not items:
            skips.append(
                f"PARSE-SKIP: {rel}:{lineno} — `TaskCreate` seed without parsable "
                f"numbered phase items (checked the next 24 lines)"
            )
            continue
        units += 1
        for word, pid in items:
            where = f"{rel}:{lineno}"
            if not phase_header_exists(word, pid, sib_texts):
                warns.append(f"WARN: {where} — seeded {word} {pid} has no matching header in the skill")
            if not status_marked(word, pid, "in_progress", sib_norms) and not in_progress_waived(
                word, pid, sib_norms
            ):
                warns.append(f"WARN: {where} — {word} {pid} is never marked `in_progress`")
            if not status_marked(word, pid, "completed", sib_norms):
                warns.append(f"WARN: {where} — {word} {pid} is never marked `completed`")
    return units


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("paths", nargs="*", help="files or dirs to scan (default: skills/)")
    ap.add_argument("--skill", help="restrict to skills/<name>/")
    args = ap.parse_args()

    if args.skill:
        target = SKILLS_DIR / args.skill
        if not target.is_dir():
            print(f"ERROR: no such skill dir: {target}")
            return 1
        files = sorted(target.rglob("*.md"))
        scope_root = SKILLS_DIR
    elif args.paths:
        files, roots = [], set()
        for p in (Path(p).resolve() for p in args.paths):
            if p.is_dir():
                files += sorted(p.rglob("*.md"))
                roots.add(p.parent)
            else:
                files.append(p)
                roots.add(p.parent.parent)
        scope_root = min(roots, key=lambda r: len(r.parts)) if roots else SKILLS_DIR
    else:
        files = sorted(SKILLS_DIR.rglob("*.md"))
        scope_root = SKILLS_DIR

    warns: list[str] = []
    skips: list[str] = []
    units = sum(check_file(f, scope_root, warns, skips) for f in files)

    print(f"Task-tracked units: {units} (files scanned: {len(files)})")
    for line in warns + skips:
        print(line)
    if not warns:
        print("OK: all seeded phases have a header and are marked `in_progress` and `completed`.")
    return 1 if warns else 0


if __name__ == "__main__":
    sys.exit(main())
