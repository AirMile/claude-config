#!/usr/bin/env python3
"""Valideer pipeline-skill handoff conventie.

Leest reads:/writes:/writes-terminal: frontmatter uit alle skills/*/SKILL.md
en signaleert gaten in de keten: velden die gelezen worden zonder dat een
skill ze schrijft, en velden die geschreven worden zonder lezer (zwakker
signaal). Velden onder `writes-terminal:` zijn bewust terminale writes
(dashboard/rapportage, geen downstream-consument): ze tellen mee als writes
voor de read-match, maar genereren geen INFO-regel.

Daarnaast: undeclared-writer detectie — skills ZONDER reads:/writes:
frontmatter waarvan de body (SKILL.md + references/*.md) wel schrijvend
naar `.project/`-state verwijst, krijgen een WARN (niet-fataal, exit 0).

Conventie: zie skills/shared/DEVINFO.md sectie "Skill Handoff Contract".

Exit code: 0 = geen mismatch-WARN, 1 = minstens één mismatch-WARN
(undeclared-writer WARNs tellen niet mee voor de exit code).
"""

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILLS_DIR = REPO_ROOT / "skills"
LIST_RE = re.compile(r"^(reads|writes|writes-terminal):\s*\[([^\]]*)\]", re.MULTILINE)

# Undeclared-writer heuristiek: een regel telt als schrijvende verwijzing
# wanneer een write-werkwoord en een .project/-statebestand op dezelfde
# regel staan (in willekeurige volgorde). Bewust simpel — vangt "Write
# .project/project.json", "update feature.json", "sync naar backlog.html"
# etc.; leesvermeldingen zonder werkwoord blijven buiten schot.
STATE_FILE_RE = (
    r"\.project/project\.json"
    r"|\.project/backlog\.html"
    r"|\.project/project-context\.json"
    r"|\.project/thinking/"
    r"|feature\.json"
    r"|devinfo\.json"
)
WRITE_VERB_RE = r"\b(write|writes|written|update|updates|append|appends|set|sets|sync|syncs|create|creates)\b"
UNDECLARED_WRITE_RE = re.compile(
    rf"(?:{WRITE_VERB_RE}.*(?:{STATE_FILE_RE}))|(?:(?:{STATE_FILE_RE}).*{WRITE_VERB_RE})",
    re.IGNORECASE,
)

# Bekende false positives / bewuste uitzonderingen — geen WARN voor deze skills.
UNDECLARED_WRITER_ALLOWLIST = {
    # Bootstrap-skill: schrijft het volledige dashboard (project.json,
    # project-context.json, backlog) eenmalig bij setup — geen pipeline-handoff,
    # per-key declareren voegt niets toe.
    "core-setup",
    # Board-server: serveert/leest backlog.html, schrijft geen pipeline-state.
    "project-viewer",
}


def find_undeclared_writers(path: Path) -> list[str]:
    """Geef regels terug die op een .project/-write duiden (SKILL.md + references/)."""
    hits: list[str] = []
    files = [path, *sorted((path.parent / "references").glob("*.md"))]
    for f in files:
        for lineno, line in enumerate(f.read_text(encoding="utf-8").splitlines(), 1):
            if UNDECLARED_WRITE_RE.search(line):
                rel = f.relative_to(REPO_ROOT)
                hits.append(f"{rel}:{lineno}")
    return hits


def parse_frontmatter(path: Path) -> tuple[set[str], set[str], set[str]]:
    text = path.read_text(encoding="utf-8")
    parts = text.split("---", 2)
    if len(parts) < 3:
        return set(), set(), set()
    fm = parts[1]
    reads, writes, terminal = set(), set(), set()
    for match in LIST_RE.finditer(fm):
        key, body = match.group(1), match.group(2)
        items = {x.strip() for x in body.split(",") if x.strip()}
        if key == "reads":
            reads = items
        elif key == "writes":
            writes = items
        else:
            terminal = items
    return reads, writes, terminal


def main() -> int:
    skill_files = sorted(SKILLS_DIR.glob("*/SKILL.md"))
    declarations: dict[str, dict[str, set[str]]] = {}
    all_reads: dict[str, set[str]] = {}
    all_writes: dict[str, set[str]] = {}

    undeclared_warns: list[str] = []

    terminal_fields: set[str] = set()

    for path in skill_files:
        reads, writes, terminal = parse_frontmatter(path)
        skill = path.parent.name
        if not reads and not writes and not terminal:
            if skill in UNDECLARED_WRITER_ALLOWLIST:
                continue
            hits = find_undeclared_writers(path)
            if hits:
                undeclared_warns.append(
                    f"WARN: {skill} heeft geen reads:/writes: declaratie maar lijkt "
                    f".project/-state te schrijven ({len(hits)} hit(s), eerste: {hits[0]})"
                )
            continue
        declarations[skill] = {"reads": reads, "writes": writes | terminal}
        for field in reads:
            all_reads.setdefault(field, set()).add(skill)
        for field in writes | terminal:
            all_writes.setdefault(field, set()).add(skill)
        terminal_fields |= terminal

    warns: list[str] = []
    infos: list[str] = []

    for field, readers in sorted(all_reads.items()):
        if field not in all_writes:
            warns.append(f"WARN: {field} gelezen door {sorted(readers)} maar door niemand geschreven")

    for field, writers in sorted(all_writes.items()):
        if field not in all_reads and field not in terminal_fields:
            infos.append(f"INFO: {field} geschreven door {sorted(writers)} maar door niemand gelezen")

    print(f"Pipeline skills met handoff-declaratie: {len(declarations)}")
    print(f"Unieke gelezen velden:  {len(all_reads)}")
    print(f"Unieke geschreven velden: {len(all_writes)}")
    print()

    if warns:
        print("\n".join(warns))
    if undeclared_warns:
        if warns:
            print()
        print("\n".join(undeclared_warns))
    if infos:
        if warns or undeclared_warns:
            print()
        print("\n".join(infos))

    if not warns and not infos and not undeclared_warns:
        print("OK: alle reads matchen writes en omgekeerd.")
    elif not warns:
        print()
        print("OK: alle reads matchen writes (alleen INFO over terminal-only writes).")

    # Alleen mismatch-WARNs zijn fataal; undeclared-writer WARNs niet.
    return 1 if warns else 0


if __name__ == "__main__":
    sys.exit(main())
