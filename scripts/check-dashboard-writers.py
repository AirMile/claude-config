#!/usr/bin/env python3
"""Validate DASHBOARD-*.md schema-writer declarations.

Two checks:
  1. Field-level  ("Set by" tables)      — skill exists + field name in skill files
  2. Section-level ("Written by" tables) — skill exists

Scans the split dashboard schema files (DASHBOARD-PROJECT.md,
DASHBOARD-CONTEXT.md, DASHBOARD-THEME.md). Legacy Dutch headers
("Gezet door" / "Geschreven door") are still recognized.

Exit code: 0 = no WARN/ERROR, 1 = at least one WARN or ERROR.

Usage: python3 scripts/check-dashboard-writers.py
"""

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILLS_DIR = REPO_ROOT / "skills"
DASHBOARD_FILES = [
    SKILLS_DIR / "shared" / "DASHBOARD-PROJECT.md",
    SKILLS_DIR / "shared" / "DASHBOARD-CONTEXT.md",
    SKILLS_DIR / "shared" / "DASHBOARD-THEME.md",
]

FIELD_HEADERS = ("Set by", "Gezet door")
SECTION_HEADERS = ("Written by", "Geschreven door")

# Matches `/skill-name` or `/skill-name --flag` inside backtick context
SKILL_RE = re.compile(r"`/([a-z][a-z0-9-]+)(?:\s[^`]*)?`")


def extract_skills(cell: str) -> list[str]:
    return SKILL_RE.findall(cell)


def skill_files(skill: str) -> list[Path]:
    skill_dir = SKILLS_DIR / skill
    if not skill_dir.is_dir():
        return []
    return list(skill_dir.rglob("*.md"))


def grep_field(skill: str, field: str) -> bool:
    for path in skill_files(skill):
        try:
            if field in path.read_text(encoding="utf-8"):
                return True
        except OSError:
            pass
    return False


def parse_table_blocks(text: str) -> list[dict]:
    """Return list of {header_col_idx, check_type, rows} dicts.

    Detects tables whose header row contains 'Set by' or 'Written by'
    (legacy: 'Gezet door' / 'Geschreven door').
    Each row is a list of stripped cell strings.
    """
    blocks = []
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line.startswith("|"):
            i += 1
            continue
        # Header row
        cells = [c.strip() for c in line.split("|")[1:-1]]
        check_type = None
        writer_col = None
        field_col = None
        for idx, cell in enumerate(cells):
            if any(h in cell for h in FIELD_HEADERS):
                check_type = "field"
                writer_col = idx
                field_col = 0
            elif any(h in cell for h in SECTION_HEADERS):
                check_type = "section"
                writer_col = idx
                field_col = 0
        if check_type is None:
            i += 1
            continue
        # Skip separator row
        i += 2
        rows = []
        while i < len(lines) and lines[i].strip().startswith("|"):
            row_cells = [c.strip() for c in lines[i].strip().split("|")[1:-1]]
            if len(row_cells) > max(writer_col, field_col):
                rows.append({
                    "field": row_cells[field_col],
                    "writer_cell": row_cells[writer_col],
                })
            i += 1
        blocks.append({"check_type": check_type, "rows": rows})
    return blocks


def clean_field_name(raw: str) -> str:
    """Extract bare field name from markdown cell like `commitConvention`."""
    m = re.search(r"`([^`]+)`", raw)
    return m.group(1) if m else raw.strip()


def main() -> int:
    blocks = []
    errors: list[str] = []
    warns: list[str] = []

    for dashboard in DASHBOARD_FILES:
        if not dashboard.exists():
            print(f"ERROR: {dashboard} not found", file=sys.stderr)
            return 1
        text = dashboard.read_text(encoding="utf-8")
        blocks.extend(parse_table_blocks(text))

    for block in blocks:
        for row in block["rows"]:
            skills = extract_skills(row["writer_cell"])
            if not skills:
                continue
            field = clean_field_name(row["field"])

            for skill in skills:
                skill_dir = SKILLS_DIR / skill
                if not skill_dir.is_dir():
                    errors.append(
                        f"ERROR: skill `{skill}` not found in skills/ "
                        f"(declared as writer of `{field}`)"
                    )
                    continue

                if block["check_type"] == "field":
                    if not grep_field(skill, field):
                        warns.append(
                            f"WARN: `{field}` declared as set by `/{skill}` "
                            f"but field name not found in skills/{skill}/**"
                        )

    total = len(errors) + len(warns)
    print(f"DASHBOARD-*.md schema-writer check")
    print(f"Tables scanned: {len(blocks)}")
    print(f"Errors: {len(errors)}  Warns: {len(warns)}")

    if errors or warns:
        print()
        for msg in errors + warns:
            print(msg)
    else:
        print("\nOK: all declared writers are valid.")

    return 1 if total > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
