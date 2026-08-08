#!/usr/bin/env bash
# Stage only the named hunks of <file> into the index, leaving the working tree untouched.
# Usage: pick-hunks.sh <file> <1-based hunk index>...
# Hunk indices are against the CURRENT `git diff -- <file>`, which re-lists only the
# remaining hunks after each apply — so the next commit's numbering stays correct.
#
# Exit codes: 0 staged · 2 bad usage · 3 no hunk matched (stale index list)
set -euo pipefail
file="$1"; shift
[ $# -gt 0 ] || { echo "usage: pick-hunks.sh <file> <hunk-index>..." >&2; exit 2; }
want=" $* "
patch="$(mktemp)"; trap 'rm -f "$patch"' EXIT
git diff -- "$file" | awk -v want="$want" '
  /^diff --git/ { header = 1 }
  header && !/^@@/ && !seen  { print; next }
  /^@@/ { seen = 1; n++; keep = index(want, " " n " ") > 0; if (keep) print; next }
  seen  { if (keep) print }
' > "$patch"
grep -q '^@@' "$patch" || { echo "no hunks matched$want in $file" >&2; exit 3; }
git apply --cached --recount "$patch"
echo "staged hunks$want of $file"
