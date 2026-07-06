#!/usr/bin/env python3
"""Enforce Model A: .project/ is never staged or committed.

Scans all skill Markdown files for patterns that would force-add or commit
.project/ paths, which are gitignored developer-local state (see
skills/shared/SCOPED-COMMIT.md and CLAUDE.md § Bootstrap Philosophy).

Exit code: 0 = clean, 1 = one or more violations found.

Allowlist: append  # check-no-project-commit: allow  to a line to skip it.

State-sync exemption: /project-sync commits a durable subset of .project/ to the
orphan branch `claude/state` inside a *detached temp worktree* (skills/shared/
STATE-SYNC.md). Model A stays intact — no working branch ever tracks .project/.
Those git add/commit lines operate on the "$STATE_WT" variable, so no literal
.project/ appears on an add/commit line and this checker does not (and must not)
flag them. Skills keep the .project/ path off add/commit lines via that variable.
"""

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILLS_DIR = REPO_ROOT / "skills"

# ---------------------------------------------------------------------------
# Violation patterns — match real shell commands, not prose.
# Each tuple: (label, compiled regex)
#
# Deliberately NOT matching:
#   git rm --cached -r .project/  ← legitimate untrack (Model A guard)
#   git checkout -- .project/     ← no add/commit
#   git update-index --skip-...   ← no add/commit
#   "never stage .project/"       ← prose, git add comes before .project/
# ---------------------------------------------------------------------------
PATTERNS: list[tuple[str, re.Pattern]] = [
    (
        "git add -f / --force on .project/",
        re.compile(r"git\s+add\s+(-f|--force)\b[^\n]*\.project/"),
    ),
    (
        "git add (without --cached) on .project/",
        # Match 'git add' on the same line as '.project/', but only when
        # '--cached' is absent (--cached = index-read, not staging new content).
        re.compile(r"git\s+add\b(?![^\n]*--cached)[^\n]*\.project/"),
    ),
    (
        "git commit referencing .project/ path",
        re.compile(r"git\s+commit\b[^\n]*\.project/"),
    ),
]

ALLOW_MARKER = "check-no-project-commit: allow"


def scan_file(path: Path) -> list[tuple[int, str, str]]:
    """Return list of (lineno, label, line) for violations in path."""
    violations = []
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return violations
    for lineno, line in enumerate(text.splitlines(), start=1):
        if ALLOW_MARKER in line:
            continue
        for label, pattern in PATTERNS:
            if pattern.search(line):
                violations.append((lineno, label, line.rstrip()))
                break  # one violation per line is enough
    return violations


def main() -> int:
    md_files = sorted(SKILLS_DIR.rglob("*.md"))
    all_violations: list[tuple[Path, int, str, str]] = []

    for path in md_files:
        for lineno, label, line in scan_file(path):
            all_violations.append((path, lineno, label, line))

    print(f"check-no-project-commit: scanned {len(md_files)} skill Markdown files")

    if not all_violations:
        print("OK: no .project/ stage/commit patterns found — Model A is intact.")
        return 0

    print(f"ERRORS: {len(all_violations)} violation(s) found\n")
    for path, lineno, label, line in all_violations:
        rel = path.relative_to(REPO_ROOT)
        print(f"  {rel}:{lineno}  [{label}]")
        print(f"    {line}")
    print(
        "\nFix: remove `git add -f`/`git add`/`git commit` on .project/ paths."
        "\nSee skills/shared/SCOPED-COMMIT.md — .project/ is local-only, never committed."
        "\nTo suppress a legitimate exception: append  # check-no-project-commit: allow"
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
