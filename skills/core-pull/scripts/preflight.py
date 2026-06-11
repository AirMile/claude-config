#!/usr/bin/env python3
"""Single-call pre-flight for /core-pull.

Consolidates the PHASE 0 checks (worktree guard, open worktrees, dirty
status, remote + fetch, context staleness, onboard-nudge condition,
team mode) into one JSON object on stdout. Read-only except `git fetch`.

Usage:
    python3 preflight.py [--path <dir>]

The skip-worktree dance and stash handling stay in the skill (safety-
critical, interleaved with the pull itself).
"""

import argparse
import json
import subprocess
import sys
from datetime import date, datetime, timedelta
from pathlib import Path

STALE_DAYS = 90
NUDGE_MIN_COMMITS = 50


def run(args, cwd, timeout=15):
    """Run a command; return (ok, stdout). Never raises."""
    try:
        out = subprocess.run(
            args, cwd=cwd, capture_output=True, text=True, timeout=timeout
        )
        return out.returncode == 0, out.stdout.strip()
    except (subprocess.TimeoutExpired, OSError):
        return False, ""


def parse_date(value):
    """Parse YYYY-MM-DD (date part of ISO strings accepted); None on failure."""
    if not value or not isinstance(value, str):
        return None
    try:
        return datetime.strptime(value[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def read_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError, UnicodeDecodeError):
        return None


def main():
    parser = argparse.ArgumentParser(description="core-pull pre-flight checks")
    parser.add_argument("--path", default=".", help="Repo directory (default: cwd)")
    args = parser.parse_args()
    cwd = Path(args.path).resolve()

    ok, current_root = run(["git", "rev-parse", "--show-toplevel"], cwd)
    if not ok:
        print(json.dumps({"error": "not a git repository"}))
        sys.exit(1)

    # Worktree topology: first "worktree " line of porcelain output is the
    # main checkout; branches named worktree-* are open feature worktrees.
    ok, porcelain = run(["git", "worktree", "list", "--porcelain"], cwd)
    main_root = current_root
    open_worktrees = []
    if ok:
        seen_main = False
        for line in porcelain.splitlines():
            if line.startswith("worktree ") and not seen_main:
                main_root = line[len("worktree "):]
                seen_main = True
            if line.startswith("branch refs/heads/worktree-"):
                open_worktrees.append(line[len("branch refs/heads/"):])
    try:
        # samefile = inode comparison: robust against symlinks and the
        # case-insensitive macOS filesystem (git may report either casing).
        is_main_checkout = Path(main_root).samefile(Path(current_root))
    except OSError:
        is_main_checkout = Path(main_root).resolve() == Path(current_root).resolve()

    ok, status = run(["git", "status", "--porcelain"], cwd)
    dirty_files = [l for l in status.splitlines() if l.strip()] if ok else []

    ok, remotes = run(["git", "remote"], cwd)
    has_remote = ok and bool(remotes)
    fetch_ok = False
    if has_remote:
        fetch_ok, _ = run(["git", "fetch"], cwd, timeout=60)

    behind_count = 0
    ok, behind = run(["git", "rev-list", "--count", "HEAD..@{u}"], cwd)
    if ok and behind.isdigit():
        behind_count = int(behind)

    ok, total = run(["git", "rev-list", "--count", "HEAD"], cwd)
    total_commits = int(total) if ok and total.isdigit() else 0

    ok, last_commit = run(["git", "log", "-1", "--format=%cs"], cwd)
    last_commit_date = last_commit if ok and last_commit else None

    _, user_name = run(["git", "config", "user.name"], cwd)
    _, user_email = run(["git", "config", "user.email"], cwd)

    # .project/ always lives in the main checkout (SYNC.md worktree rule).
    project_dir = Path(main_root) / ".project"
    context_file = project_dir / "project-context.json"
    project_file = project_dir / "project.json"
    has_context_json = context_file.is_file()
    has_project_json = project_file.is_file()

    context = read_json(context_file) if has_context_json else None
    context_updated = None
    learnings_count = 0
    if isinstance(context, dict):
        context_updated = (context.get("context") or {}).get("updated")
        learnings = context.get("learnings") or []
        learnings_count = len(learnings) if isinstance(learnings, list) else 0
    learnings_empty = learnings_count == 0

    # Stale = context predates the last commit, or is older than STALE_DAYS.
    # Unparseable/missing date on an existing context file counts as stale.
    updated_date = parse_date(context_updated)
    commit_date = parse_date(last_commit_date)
    stale_cutoff = date.today() - timedelta(days=STALE_DAYS)
    context_stale = False
    stale_baseline = False
    if has_context_json:
        if updated_date is None:
            context_stale = True
        else:
            stale_baseline = updated_date < stale_cutoff
            context_stale = stale_baseline or (
                commit_date is not None and updated_date < commit_date
            )

    project = read_json(project_file) if has_project_json else None
    team_mode = "solo"
    if isinstance(project, dict):
        mode = (project.get("team") or {}).get("mode")
        if mode in ("solo", "team"):
            team_mode = mode

    session_dir = project_dir / "session"
    dismissed = (session_dir / "onboard-dismissed").exists()
    onboarded = (session_dir / "onboarded").exists()
    nudge = (
        not dismissed
        and not onboarded
        and total_commits > NUDGE_MIN_COMMITS
        and (learnings_empty or stale_baseline)
    )
    reason = None
    if nudge:
        reason = "no-learnings" if learnings_empty else "stale-baseline"

    print(json.dumps({
        "is_main_checkout": is_main_checkout,
        "current_root": current_root,
        "main_root": main_root,
        "open_worktrees": open_worktrees,
        "dirty": bool(dirty_files),
        "dirty_file_count": len(dirty_files),
        "has_remote": has_remote,
        "fetch_ok": fetch_ok,
        "behind_count": behind_count,
        "has_context_json": has_context_json,
        "has_project_json": has_project_json,
        "context_updated": context_updated,
        "last_commit_date": last_commit_date,
        "context_stale": context_stale,
        "total_commits": total_commits,
        "learnings_count": learnings_count,
        "learnings_empty": learnings_empty,
        "onboard": {
            "dismissed": dismissed,
            "onboarded": onboarded,
            "nudge": nudge,
            "reason": reason,
        },
        "team_mode": team_mode,
        "git_user_name": user_name,
        "git_user_email": user_email,
    }, indent=2))


if __name__ == "__main__":
    main()
