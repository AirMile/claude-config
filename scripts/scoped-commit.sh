#!/usr/bin/env bash
# scripts/scoped-commit.sh — land a skill's scoped changes as an atomic commit,
# safe against a concurrent session mutating the same repo's .git/index or
# branch tip mid-run (shared/SCOPED-COMMIT.md § 5).
#
# WHY THIS SCRIPT EXISTS: `git add <files> && git commit` shares the repo's ONE
# .git/index and assumes the branch tip doesn't move between when a skill reads
# it and when it commits. A slow pre-commit hook (lint+test, tens of seconds)
# widens that window. Two failure modes were observed running two /dev-tweak
# sessions on the same repo: (a) another session's `git add` mutated the shared
# index mid-hook, so the commit that landed contained THEIR staged files
# instead of the caller's; (b) a corrective `git reset HEAD^` assumed the tip
# hadn't moved and silently orphaned another session's already-landed commit.
# This script never touches the shared index or HEAD directly: it builds the
# tree in an isolated index, creates the commit object without invoking hooks,
# and lands it via a compare-and-swap `git update-ref`, retrying against the
# new tip if another writer won the race.
#
# Usage:
#   bash scripts/scoped-commit.sh --message <file> --files <f1,f2,...> [--retries N]
#
# Reads the commit message from a file (avoids shell-quoting a multi-line
# message through argv). --files is a comma-separated list of paths already
# approved for staging (NEW + approved-OVERLAP per SCOPED-COMMIT.md § 2) — this
# script does not decide what belongs in the commit, only lands it safely.
# Stages each file's CURRENT WORKING-TREE content in full; it does not support
# staging only part of a file's diff (see § 5's mixed-content fallback note).
#
# Exit 0 = committed, prints the new commit sha.
#   2 = usage error. 3 = not a git repo. 4 = nothing to commit for the given
#   files. 5 = CAS retries exhausted — another writer keeps winning; the
#   caller should report a conflict instead of forcing it.

set -euo pipefail

MESSAGE_FILE=""
FILES=""
RETRIES=3

while [[ $# -gt 0 ]]; do
  case "$1" in
    --message) MESSAGE_FILE="$2"; shift 2 ;;
    --files) FILES="$2"; shift 2 ;;
    --retries) RETRIES="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

[[ -n "$MESSAGE_FILE" && -f "$MESSAGE_FILE" ]] || { echo "usage: --message <file> required" >&2; exit 2; }
[[ -n "$FILES" ]] || { echo "usage: --files <comma-separated> required" >&2; exit 2; }
git rev-parse --git-dir > /dev/null 2>&1 || { echo "not a git repo" >&2; exit 3; }

IFS=',' read -ra FILE_ARR <<< "$FILES"

attempt=0
while (( attempt < RETRIES )); do
  OLD_HEAD=$(git rev-parse HEAD)
  ISO_INDEX=$(mktemp)
  rm -f "$ISO_INDEX"

  GIT_INDEX_FILE="$ISO_INDEX" git read-tree "$OLD_HEAD"
  GIT_INDEX_FILE="$ISO_INDEX" git add -- "${FILE_ARR[@]}"
  TREE=$(GIT_INDEX_FILE="$ISO_INDEX" git write-tree)
  rm -f "$ISO_INDEX"

  BASE_TREE=$(git rev-parse "$OLD_HEAD^{tree}")
  if [[ "$TREE" == "$BASE_TREE" ]]; then
    echo "nothing to commit for: $FILES" >&2
    exit 4
  fi

  NEW_COMMIT=$(git commit-tree "$TREE" -p "$OLD_HEAD" -F "$MESSAGE_FILE")
  BRANCH=$(git branch --show-current)

  if git update-ref -m "scoped-commit.sh" "refs/heads/$BRANCH" "$NEW_COMMIT" "$OLD_HEAD" 2>/dev/null; then
    git reset --mixed HEAD > /dev/null   # resync the real index; working tree untouched
    echo "$NEW_COMMIT"
    exit 0
  fi

  attempt=$((attempt + 1))
  echo "ref moved during commit, retrying ($attempt/$RETRIES)..." >&2
done

echo "CAS retries exhausted — another session keeps committing to this branch; land manually" >&2
exit 5
