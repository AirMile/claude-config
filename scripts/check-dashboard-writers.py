#!/usr/bin/env python3
"""Valideer DASHBOARD.md schema-writer declaraties.

Twee checks:
  1. Field-level  ("Gezet door" tabellen)  — skill bestaat + veld-naam in skill files
  2. Section-level ("Geschreven door" tabellen) — skill bestaat

Exit code: 0 = geen WARN/ERROR, 1 = minstens één WARN of ERROR.

Usage: python3 scripts/check-dashboard-writers.py
"""

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILLS_DIR = REPO_ROOT / "skills"
DASHBOARD = SKILLS_DIR / "shared" / "DASHBOARD.md"

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

    Detects tables whose header row contains 'Gezet door' or 'Geschreven door'.
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
            if "Gezet door" in cell:
                check_type = "field"
                writer_col = idx
                field_col = 0
            elif "Geschreven door" in cell:
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
    if not DASHBOARD.exists():
        print(f"ERROR: {DASHBOARD} niet gevonden", file=sys.stderr)
        return 1

    text = DASHBOARD.read_text(encoding="utf-8")
    blocks = parse_table_blocks(text)

    errors: list[str] = []
    warns: list[str] = []

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
                        f"ERROR: skill `{skill}` niet gevonden in skills/ "
                        f"(gedeclareerd als writer van `{field}`)"
                    )
                    continue

                if block["check_type"] == "field":
                    if not grep_field(skill, field):
                        warns.append(
                            f"WARN: `{field}` gedeclareerd als gezet door `/{skill}` "
                            f"maar veld-naam niet gevonden in skills/{skill}/**"
                        )

    total = len(errors) + len(warns)
    print(f"DASHBOARD.md schema-writer check")
    print(f"Tabellen gescand: {len(blocks)}")
    print(f"Errors: {len(errors)}  Warns: {len(warns)}")

    if errors or warns:
        print()
        for msg in errors + warns:
            print(msg)
    else:
        print("\nOK: alle gedeclareerde writers zijn valide.")

    return 1 if total > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
