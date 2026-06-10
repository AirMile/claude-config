#!/usr/bin/env python3
"""Migrate a project's .project/ directory to schemaVersion 2.

Idempotent — safe to run multiple times; a second run is a no-op.

Transformations:
  1. backlog.html  → backlog.json   (extract <script id="backlog-data"> JSON,
                                     add schemaVersion, delete the HTML file)
  2. project.json                    strip stale duplicated keys:
                                     - architecture / context  (canonical in
                                       project-context.json — merged there first
                                       when project-context.json misses them)
                                     - learnings (merged into project-context.json
                                       with exact-tuple dedup)
                                     - features / thinking-empty leftovers:
                                       features[] is dropped (canonical in
                                       backlog.json); entries missing from the
                                       backlog are preserved by appending them
                                       to backlog.json#features first
                                     add schemaVersion: 2
  3. project-context.json            add schemaVersion: 2 (create scaffold if a
                                     project.json exists but this file doesn't)
  4. sessions/ → session/            merge contents (session/ wins on conflict),
                                     remove sessions/
  5. loose work-PNGs in .project/    move source-capture*, patch-before*,
                                     verify-round-*, smoke-render-* → tmp/ ;
                                     other loose images → screenshots/

Usage:
  python3 scripts/migrate-project.py <project-root> [--dry-run]

Exit codes: 0 = migrated or already current, 1 = error.
"""

import json
import re
import shutil
import sys
from pathlib import Path

WORK_PNG_PREFIXES = ("source-capture", "patch-before", "verify-round", "smoke-render")
IMAGE_SUFFIXES = {".png", ".jpg", ".jpeg", ".gif", ".webp"}

CONTEXT_SCAFFOLD = {
    "schemaVersion": 2,
    "architecture": {},
    "context": {},
    "learnings": [],
}


def log(msg):
    print(f"  {msg}")


def load_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def write_json(path, data, dry):
    if dry:
        log(f"[dry-run] would write {path}")
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def dedup_key(learning):
    summary = re.sub(r"[^\w\s]", "", (learning.get("summary") or "").lower()).strip()
    return (learning.get("type"), summary, learning.get("author"))


def migrate_backlog(project_dir, dry):
    """backlog.html → backlog.json. Returns the backlog data (or None)."""
    json_file = project_dir / ".project/backlog.json"
    html_file = project_dir / ".project/backlog.html"

    data = load_json(json_file)
    if data is not None:
        if data.get("schemaVersion") != 2:
            data = {"schemaVersion": 2, **data}
            write_json(json_file, data, dry)
            log("backlog.json: added schemaVersion 2")
        if html_file.exists():
            if not dry:
                html_file.unlink()
            log("backlog.html: removed (backlog.json already canonical)")
        return data

    if html_file.exists():
        html = html_file.read_text(encoding="utf-8", errors="replace")
        m = re.search(
            r'<script id="backlog-data"[^>]*>([\s\S]*?)</script>', html
        )
        if not m:
            log("WARN backlog.html present but no <script id=\"backlog-data\"> block — left untouched")
            return None
        try:
            data = json.loads(m.group(1))
        except json.JSONDecodeError as e:
            log(f"WARN backlog.html JSON unparseable ({e}) — left untouched")
            return None
        data = {"schemaVersion": 2, **data}
        write_json(json_file, data, dry)
        if not dry:
            html_file.unlink()
        log(f"backlog.html → backlog.json ({len(data.get('features', []))} features), HTML removed")
        return data

    return None


def migrate_dashboards(project_dir, backlog_data, dry):
    """Strip duplicated keys from project.json; merge into project-context.json."""
    pj_file = project_dir / ".project/project.json"
    pc_file = project_dir / ".project/project-context.json"

    pj = load_json(pj_file)
    if pj is None:
        return

    pc = load_json(pc_file)
    if pc is None:
        pc = dict(CONTEXT_SCAFFOLD)
        log("project-context.json: created scaffold")
    pc_changed = pc.get("schemaVersion") != 2
    if pc_changed:
        pc = {"schemaVersion": 2, **pc}

    pj_changed = False

    # architecture / context: project-context.json wins; only copy over when missing there
    for key in ("architecture", "context"):
        if key in pj:
            if not pc.get(key) and pj.get(key):
                pc[key] = pj[key]
                pc_changed = True
                log(f"project.json#{key}: moved to project-context.json (was missing there)")
            else:
                log(f"project.json#{key}: stripped (stale duplicate)")
            del pj[key]
            pj_changed = True

    # learnings: merge with exact-tuple dedup
    if "learnings" in pj:
        existing = {dedup_key(l) for l in pc.get("learnings", [])}
        moved = 0
        for l in pj.get("learnings") or []:
            if dedup_key(l) not in existing:
                pc.setdefault("learnings", []).append(l)
                existing.add(dedup_key(l))
                moved += 1
        if moved:
            pc_changed = True
        log(f"project.json#learnings: stripped ({moved} unique entries merged into project-context.json)")
        del pj["learnings"]
        pj_changed = True

    # features: backlog.json is canonical; preserve entries the backlog doesn't know
    if "features" in pj:
        preserved = 0
        if backlog_data is not None:
            known = {f.get("name") for f in backlog_data.get("features", [])}
            archive = load_json(project_dir / ".project/archive/backlog-archive.json") or {}
            known |= {f.get("name") for f in archive.get("archived", [])}
            # Skip the known populate.js artifact: the .project/features/archive/
            # DIRECTORY used to be scanned as a feature ({name: "archive",
            # status: TODO, empty summary}) by the pre-v2 server.
            def is_artifact(f):
                return f.get("name") == "archive" and not f.get("summary")

            orphans = [
                f
                for f in (pj.get("features") or [])
                if f.get("name") not in known and not is_artifact(f)
            ]
            if orphans:
                backlog_data.setdefault("features", []).extend(orphans)
                write_json(project_dir / ".project/backlog.json", backlog_data, dry)
                preserved = len(orphans)
        elif pj.get("features"):
            log("WARN project.json#features present but no backlog store — entries dropped would lose data; creating backlog.json from them")
            backlog_data = {
                "schemaVersion": 2,
                "project": pj.get("seed", {}).get("name") or project_dir.name,
                "features": pj["features"],
            }
            write_json(project_dir / ".project/backlog.json", backlog_data, dry)
            preserved = len(pj["features"])
        log(f"project.json#features: stripped ({preserved} entries preserved in backlog.json)")
        del pj["features"]
        pj_changed = True

    if pj.get("schemaVersion") != 2:
        pj = {"schemaVersion": 2, **pj}
        pj_changed = True
        log("project.json: added schemaVersion 2")

    if pj_changed:
        write_json(pj_file, pj, dry)
    if pc_changed:
        write_json(pc_file, pc, dry)


def migrate_sessions(project_dir, dry):
    sessions = project_dir / ".project/sessions"
    session = project_dir / ".project/session"
    if not sessions.exists():
        return
    moved = 0
    for item in sorted(sessions.rglob("*")):
        if not item.is_file():
            continue
        target = session / item.relative_to(sessions)
        if target.exists():
            log(f"sessions/{item.relative_to(sessions)}: conflict — session/ wins, dropping duplicate")
            if not dry:
                item.unlink()
            continue
        if not dry:
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(item), str(target))
        moved += 1
    if not dry:
        shutil.rmtree(sessions, ignore_errors=True)
    log(f"sessions/ → session/ ({moved} files moved, dir removed)")


def migrate_loose_images(project_dir, dry):
    root = project_dir / ".project"
    tmp = root / "tmp"
    shots = root / "screenshots"
    n_tmp = n_shots = 0
    for item in sorted(root.iterdir()):
        if not item.is_file() or item.suffix.lower() not in IMAGE_SUFFIXES:
            continue
        dest_dir = tmp if item.name.startswith(WORK_PNG_PREFIXES) else shots
        if not dry:
            dest_dir.mkdir(parents=True, exist_ok=True)
            shutil.move(str(item), str(dest_dir / item.name))
        if dest_dir is tmp:
            n_tmp += 1
        else:
            n_shots += 1
    if n_tmp or n_shots:
        log(f"loose images: {n_tmp} work-PNGs → tmp/, {n_shots} → screenshots/")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry-run" in sys.argv
    if len(args) != 1:
        print(__doc__)
        return 1
    project_dir = Path(args[0]).expanduser().resolve()
    dot_project = project_dir / ".project"
    if not dot_project.is_dir():
        print(f"ERROR: {dot_project} not found — pass the project root (the dir containing .project/)")
        return 1

    print(f"Migrating {dot_project}{' (dry-run)' if dry else ''}:")
    backlog_data = migrate_backlog(project_dir, dry)
    migrate_dashboards(project_dir, backlog_data, dry)
    migrate_sessions(project_dir, dry)
    migrate_loose_images(project_dir, dry)
    print("Done." if not dry else "Dry-run complete — no files changed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
