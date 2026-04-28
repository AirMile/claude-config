#!/usr/bin/env python3
"""Valideer pipeline-skill handoff conventie.

Leest reads:/writes: frontmatter uit alle skills/*/SKILL.md en signaleert
gaten in de keten: velden die gelezen worden zonder dat een skill ze schrijft,
en velden die geschreven worden zonder lezer (zwakker signaal).

Conventie: zie skills/shared/DEVINFO.md sectie "Skill Handoff Contract".

Exit code: 0 = geen WARN, 1 = minstens één WARN.
"""

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILLS_DIR = REPO_ROOT / "skills"
LIST_RE = re.compile(r"^(reads|writes):\s*\[(.*?)\]\s*$", re.MULTILINE)


def parse_frontmatter(path: Path) -> tuple[set[str], set[str]]:
    text = path.read_text(encoding="utf-8")
    parts = text.split("---", 2)
    if len(parts) < 3:
        return set(), set()
    fm = parts[1]
    reads, writes = set(), set()
    for match in LIST_RE.finditer(fm):
        key, body = match.group(1), match.group(2)
        items = {x.strip() for x in body.split(",") if x.strip()}
        if key == "reads":
            reads = items
        else:
            writes = items
    return reads, writes


def main() -> int:
    skill_files = sorted(SKILLS_DIR.glob("*/SKILL.md"))
    declarations: dict[str, dict[str, set[str]]] = {}
    all_reads: dict[str, set[str]] = {}
    all_writes: dict[str, set[str]] = {}

    for path in skill_files:
        reads, writes = parse_frontmatter(path)
        if not reads and not writes:
            continue
        skill = path.parent.name
        declarations[skill] = {"reads": reads, "writes": writes}
        for field in reads:
            all_reads.setdefault(field, set()).add(skill)
        for field in writes:
            all_writes.setdefault(field, set()).add(skill)

    warns: list[str] = []
    infos: list[str] = []

    for field, readers in sorted(all_reads.items()):
        if field not in all_writes:
            warns.append(f"WARN: {field} gelezen door {sorted(readers)} maar door niemand geschreven")

    for field, writers in sorted(all_writes.items()):
        if field not in all_reads:
            infos.append(f"INFO: {field} geschreven door {sorted(writers)} maar door niemand gelezen")

    print(f"Pipeline skills met handoff-declaratie: {len(declarations)}")
    print(f"Unieke gelezen velden:  {len(all_reads)}")
    print(f"Unieke geschreven velden: {len(all_writes)}")
    print()

    if warns:
        print("\n".join(warns))
    if infos:
        if warns:
            print()
        print("\n".join(infos))

    if not warns and not infos:
        print("OK: alle reads matchen writes en omgekeerd.")
    elif not warns:
        print()
        print("OK: alle reads matchen writes (alleen INFO over terminal-only writes).")

    return 1 if warns else 0


if __name__ == "__main__":
    sys.exit(main())
