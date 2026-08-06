#!/usr/bin/env bash
# scripts/export-skill.sh — package a skill from skills/ as a ZIP that
# claude.ai's uploader accepts (Customize → Skills → Add).
#
# WHY THIS SCRIPT EXISTS: claude.ai skills are an upload, not a symlink.
# ~/.claude/skills/ is a symlink to this repo, so Claude Code picks up an edit
# instantly — Cowork and claude.ai chat keep serving whatever ZIP was uploaded
# last. Two things about that upload are easy to get wrong by hand and silent
# when you do: the archive's root must be the skill FOLDER (a ZIP with SKILL.md
# at the root does not register), and it is easy to forget the export exists at
# all after editing the skill. This script fixes the first and makes the second
# a one-liner the skill file can point at.
#
# The archive is VERBATIM — no frontmatter rewriting. Extra Claude Code keys
# (argument-hint, user-invocable, metadata) are expected to be ignored by the
# uploader. If an upload is ever rejected or the skill fails to register, that
# assumption is what to test first: re-export with frontmatter reduced to
# `name` + `description` and make the reduction a permanent step here.
#
# Usage:
#   bash scripts/export-skill.sh <skill-name>
#
# Exit 0 = wrote dist/<skill-name>.zip, prints the path.
#   2 = usage error. 3 = no such skill. 4 = skill has no SKILL.md. 5 = zip missing.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [ $# -ne 1 ]; then
  echo "usage: bash scripts/export-skill.sh <skill-name>" >&2
  exit 2
fi

SKILL="$1"
SRC="$REPO_ROOT/skills/$SKILL"
OUT_DIR="$REPO_ROOT/dist"
OUT="$OUT_DIR/$SKILL.zip"

if [ ! -d "$SRC" ]; then
  echo "error: no such skill: skills/$SKILL" >&2
  exit 3
fi

if [ ! -f "$SRC/SKILL.md" ]; then
  echo "error: skills/$SKILL has no SKILL.md" >&2
  exit 4
fi

if ! command -v zip >/dev/null 2>&1; then
  echo "error: 'zip' not found on PATH" >&2
  exit 5
fi

# Warn (do not fail) when the description exceeds claude.ai's 200-char limit.
DESC_LEN=$(awk '
  /^description:[[:space:]]*/ {
    sub(/^description:[[:space:]]*/, "")
    gsub(/^"|"$/, "")
    print length($0)
    exit
  }
' "$SRC/SKILL.md")
if [ -n "${DESC_LEN:-}" ] && [ "$DESC_LEN" -gt 200 ]; then
  echo "warning: description is $DESC_LEN chars; claude.ai's limit is 200" >&2
fi

mkdir -p "$OUT_DIR"
rm -f "$OUT"

# Zip from skills/ so the archive root is the skill FOLDER, not its contents.
# -r recurse, -q quiet, -X drop macOS extra attributes; exclude Finder cruft.
(cd "$REPO_ROOT/skills" && zip -rqX "$OUT" "$SKILL" -x '*.DS_Store' '__MACOSX/*')

VERSION=$(awk '/^[[:space:]]*version:[[:space:]]*/ { sub(/^[[:space:]]*version:[[:space:]]*/, ""); print; exit }' "$SRC/SKILL.md")

echo "$OUT"
echo "  root:    $SKILL/ ($(cd "$REPO_ROOT/skills" && find "$SKILL" -type f | wc -l | tr -d ' ') files)"
echo "  version: ${VERSION:-unset}"
echo "  next:    Claude app → Customize → Skills → Add → select this ZIP"
