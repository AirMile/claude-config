#!/usr/bin/env bash
# scripts/wire-project-symlinks.sh — wire a worktree's .project/ back to the
# main checkout via per-file symlinks, without ever destroying content.
#
# WHY THIS SCRIPT EXISTS: this procedure used to live as an inline bash block
# in shared/WORKTREE.md, duplicated (and drifted) into WORKTREE-CREATE.md.
# Three problems that a script fixes and prose cannot:
#   (a) It unconditionally `rm -f`/`rm -rf`d eight paths before re-linking.
#       On a symlink that is safe; on a REAL file it destroyed whatever a
#       broken-symlink window had written into the worktree. Observed once:
#       a unique learning in project-context.json vanished during a repair.
#   (b) Executing agents reconstruct long bash blocks from memory rather than
#       copying them verbatim (WORKTREE.md says so itself), so a multi-arm
#       per-path decision written as prose does not survive.
#   (c) Sandboxed worktree sessions reject compound bash with "too complex to
#       verify stays inside worktree". One script invocation does not trip it.
#
# Usage:
#   wire-project-symlinks.sh --worktree PATH --main-root PATH [--feature NAME]
#
# Exit 0 = symlinks wired (possibly with rescued/promoted content, reported on
#          stdout). Exit 1 = refused or failed; nothing half-wired silently.

set -u

WT=""
MP_ROOT=""
FEATURE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --worktree)  WT="${2:-}"; shift 2 ;;
    --main-root) MP_ROOT="${2:-}"; shift 2 ;;
    --feature)   FEATURE="${2:-}"; shift 2 ;;
    -h|--help)
      echo "Usage: $0 --worktree PATH --main-root PATH [--feature NAME]"
      exit 0 ;;
    *)
      echo "ERROR: unknown argument: $1" >&2
      echo "Usage: $0 --worktree PATH --main-root PATH [--feature NAME]" >&2
      exit 1 ;;
  esac
done

if [ -z "$WT" ] || [ -z "$MP_ROOT" ]; then
  echo "ERROR: --worktree and --main-root are both required." >&2
  exit 1
fi

MP="$MP_ROOT/.project"
[ -n "$FEATURE" ] || FEATURE="$(basename "$WT")"

# --- GATE 1 -----------------------------------------------------------------
# If WT ever resolves to main_root itself (a bad substitution, a stale/empty
# feature name, or a caller that passed main_root as WT by mistake), every
# rm + ln pair below collapses into deleting-then-relinking the SAME path —
# replacing main_root's real .project/ files with symlinks pointing at
# themselves. .project/ is gitignored (no git history), so that is
# unrecoverable from the repo alone. Abort loudly instead.
case "$WT" in
  */.claude/worktrees/*) ;;
  *)
    echo "ERROR: refusing to wire .project/ symlinks — worktree path does not look like one: $WT" >&2
    echo "Expected shape: {main_root}/.claude/worktrees/{feature-name}. Aborting, nothing touched." >&2
    exit 1 ;;
esac

if [ "$(cd "$WT" 2>/dev/null && pwd -P)" = "$(cd "$MP_ROOT" 2>/dev/null && pwd -P)" ]; then
  echo "ERROR: refusing to wire .project/ symlinks — worktree resolves to main root itself ($WT)." >&2
  echo "This procedure must target a worktree, never the main checkout. Aborting, nothing touched." >&2
  exit 1
fi

if [ ! -d "$WT" ]; then
  echo "ERROR: worktree directory does not exist: $WT" >&2
  exit 1
fi

# --- GATE 2 -----------------------------------------------------------------
# $WT/.project must be a real directory, never a symlink. A whole-directory
# symlink there (an earlier agent improvising `ln -s "$MP" "$WT/.project"`)
# makes every path below resolve THROUGH it onto main's real files, so the
# per-file handling would operate on main — Gate 1's hazard by another route.
if [ -L "$WT/.project" ]; then
  echo "WARN: $WT/.project was itself a symlink (not the expected per-file scheme) — replacing it with a real directory."
  rm -f "$WT/.project"
fi
mkdir -p "$WT/.project/session" || exit 1

# Remove any ad-hoc nested symlink a prior session may have created.
rm -f "$WT/.project/.project"

# --- GATE 3 -----------------------------------------------------------------
# Never delete a real file. A real file/dir where a symlink belongs is
# unmerged content, not debris: it is what a broken-symlink window wrote into
# the worktree.
#
# The rescue destination lives under MAIN's .project/, deliberately NOT under
# the worktree: core-finalize and the orphan-cleanup path both `rm -rf` the
# worktree wholesale, so a rescue stored inside it would be deleted anyway.
SHARED="backlog.json features archive wireframes screenshots thinking project.json project-context.json"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
RESCUE="$MP/.rescued/$FEATURE-$STAMP"
RESCUED=""
PROMOTED=""

for name in $SHARED; do
  p="$WT/.project/$name"

  if [ ! -e "$p" ] && [ ! -L "$p" ]; then
    continue                                   # absent — nothing to handle
  elif [ -L "$p" ]; then
    rm -rf "$p"                                # symlink — always safe (normal case)
  elif [ ! -e "$MP/$name" ]; then
    # Main has no counterpart: the worktree copy is the ONLY copy. Promoting it
    # keeps the content reachable; rescuing it would strand it behind a
    # dangling symlink.
    mkdir -p "$(dirname "$MP/$name")"
    mv "$p" "$MP/$name" || exit 1
    PROMOTED="$PROMOTED $name"
  elif diff -rq "$p" "$MP/$name" >/dev/null 2>&1; then
    rm -rf "$p"                                # byte-identical to main — nothing to lose
  else
    # ANY nonzero diff exit counts as divergent, including exit 2 (unreadable).
    # Testing for `-eq 1` here would delete on a read error.
    mkdir -p "$RESCUE"
    mv "$p" "$RESCUE/$name" || exit 1
    RESCUED="$RESCUED $name"
  fi
done

# --- wire -------------------------------------------------------------------
for name in $SHARED; do
  ln -sfn "$MP/$name" "$WT/.project/$name" || exit 1
done

# CLAUDE.md is gitignored (not committed — shared/TEAM.md), so `git worktree
# add` never carries it. Symlink it too — safe to dangle if main has none yet.
if [ -f "$MP_ROOT/CLAUDE.md" ]; then
  rm -f "$WT/CLAUDE.md"
  ln -sfn "$MP_ROOT/CLAUDE.md" "$WT/CLAUDE.md" || exit 1
fi

# --- assert -----------------------------------------------------------------
# Only these four gate the worktree. archive/wireframes/screenshots/thinking
# may dangle safely — their source dirs do not exist on a fresh project.
FAILED=""
for name in backlog.json features project.json project-context.json; do
  if [ ! -L "$WT/.project/$name" ] || [ ! -e "$WT/.project/$name" ]; then
    FAILED="$FAILED $name"
  fi
done

if [ -n "$FAILED" ]; then
  echo "ERROR: symlink wire-up failed for:$FAILED" >&2
  echo "Check permissions on $WT/.project/ and that $MP exists." >&2
  exit 1
fi

[ -n "$PROMOTED" ] && echo "PROMOTED to main (worktree held the only copy):$PROMOTED"
[ -n "$RESCUED" ] && echo "WARN: rescued to $RESCUE (differs from main, NOT deleted):$RESCUED — reconcile by hand, then remove that directory."
echo "SYMLINKS: ok (4/4 required; archive/wireframes/screenshots/thinking optional — dangling is safe)"
exit 0
