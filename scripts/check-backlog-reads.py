#!/usr/bin/env python3
"""Enforce: dev-ship/game-ship read-only PHASE 0 context loads use
scripts/backlog-load.js (or shared/BACKLOG-LOAD.md / GAME-BACKLOG-LOAD.md's
inline `ideation` snippet), not a raw full `Read` of `.project/backlog.json`.

Scoped to skills/dev-ship/ and skills/game-ship/ only — other skills (team-issues,
project-todo, design-content, core-setup, ...) have their own standalone backlog
reads that were never part of this protocol and are out of scope.

A raw read is legitimate when it's part of a Read -> mutate-in-memory -> Write
cycle (status/transition/date/audit writes; see shared/BACKLOG.md -> Lifecycle
Protocol -> Write) -- those are NOT what scripts/backlog-load.js is for. Known
mutation-cycle call sites are hardcoded below (ALLOWLIST) rather than detected
heuristically, since "Read ... Write back" often spans multiple lines/sentences
and a same-line heuristic produces false positives/negatives either way.

Exit code: 0 = clean, 1 = a raw read outside the allowlist was found.

To add a new legitimate mutation-cycle read: add a (file, distinctive substring)
pair to ALLOWLIST below with a one-line reason.
"""

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SCOPE_DIRS = [REPO_ROOT / "skills" / "dev-ship", REPO_ROOT / "skills" / "game-ship"]

# Matches a prose instruction to Read the raw backlog store file, e.g.:
#   "Read `.project/backlog.json`"
#   "read `.project/backlog.json` (if present)"
#   "Re-read `.project/backlog.json`" / "Re-read backlog.json#features[]"
# The literal `.json`/`.html` suffix is required (not optional) so that
# headings like "Read backlog for pipeline status:" (which point at a
# scripts/backlog-load.js call a few lines below) don't false-positive.
RAW_READ_RE = re.compile(
    r"\b(?:re-?)?read\b[^\n.]{0,40}`?\.?/?(\.project/)?backlog(\.json|\.html)\b",
    re.IGNORECASE,
)

# (relative file path, distinctive substring) -- each entry is a verified
# Read -> mutate-in-memory -> Write cycle, not a PHASE 0 read-only context load.
ALLOWLIST = [
    (
        "skills/dev-ship/references/dev-refactor/references/completion-batch.md",
        "Read backlog.json + project.json + project-context.json in parallel",
    ),
    (
        "skills/dev-ship/references/dev-refactor/references/completion-batch.md",
        "Re-read `backlog.json#features[]` — feature must **not** be present",
    ),
    (
        "skills/dev-ship/references/dev-refactor/references/completion-batch.md",
        're-read its `backlog.json` / `backlog-archive.json` entry: it must **not** retain `transition',
    ),
    (
        "skills/dev-ship/references/dev-refactor/references/completion-batch.md",
        "Re-read `backlog-archive.json#archived[]` — feature must be present with `shipped: true`",
    ),
    (
        "skills/game-ship/references/game-build/SKILL.md",
        "Find feature by name → remove `transition` field if present",
    ),
    (
        "skills/game-ship/references/game-define/SKILL.md",
        'Find feature by name → keep `"status": "TODO"`, set `"stage": "defining"`',
    ),
    (
        "skills/game-ship/references/game-verify/SKILL.md",
        'set `"stage": "testing"`, `data.updated` → now (Edit)',
    ),
]


def is_allowlisted(rel_path: str, text: str, match_start: int) -> bool:
    window = text[max(0, match_start - 60) : match_start + 200]
    for allow_path, allow_substr in ALLOWLIST:
        if allow_path == rel_path and allow_substr in window:
            return True
    return False


def main() -> int:
    violations = []
    for scope_dir in SCOPE_DIRS:
        for md_file in sorted(scope_dir.rglob("*.md")):
            text = md_file.read_text(encoding="utf-8")
            rel_path = str(md_file.relative_to(REPO_ROOT))
            for m in RAW_READ_RE.finditer(text):
                if is_allowlisted(rel_path, text, m.start()):
                    continue
                line_no = text.count("\n", 0, m.start()) + 1
                line = text.splitlines()[line_no - 1].strip()
                violations.append((rel_path, line_no, line))

    if violations:
        print("check-backlog-reads: raw backlog.json reads outside the allowlist:\n")
        for rel_path, line_no, line in violations:
            print(f"  {rel_path}:{line_no}: {line}")
        print(
            "\nUse `node scripts/backlog-load.js <repo-root> <profile> ...` for "
            "read-only PHASE 0 loads (shared/BACKLOG-LOAD.md / GAME-BACKLOG-LOAD.md), "
            "or add a (file, substring) pair to ALLOWLIST in this script if this is a "
            "genuine Read -> mutate -> Write cycle."
        )
        return 1

    print(f"check-backlog-reads: scanned {len(SCOPE_DIRS)} dirs, 0 violations")
    print("OK: no raw backlog.json reads outside sanctioned mutation cycles.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
