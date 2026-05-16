---
name: core-finalize
description: Merge or clean up a feature worktree. Use with /core-finalize.
argument-hint: "[feature-name]"
metadata:
  author: claude-config
  version: 1.0.0
  category: core
---

# Finalize

Integrate or clean up a finished feature worktree. Detects whether the branch was already merged via a PR (cleanup-only) or needs a local merge (solo), then removes the worktree and branch.

**Trigger**: `/core-finalize` or `/core-finalize [feature-name]`

## When to Use

- Feature worktree exists but the pipeline skill's PHASE Finalize was skipped or not reached
- Orphan worktree from an earlier session (hotfix, abandoned build, etc.)
- Manual recovery when a pipeline skill is not involved

Not for: regular commits (use `/core-commit`), pulling remote changes (use `/core-pull`), creating new branches.

## Workflow

Follow `shared/FINALIZE.md` end-to-end.

### Feature-name resolution

- **Argument provided** (`/core-finalize auth`): pass `feature-name = "auth"` to `FINALIZE.md`.
- **No argument, currently in a worktree**: use current branch name (strip `worktree-` prefix if present).
- **No argument, on main**: list all open `worktree-*` branches via `git worktree list --porcelain`. Use AskUserQuestion to pick:
  - header: "Worktree"
  - question: "Which worktree do you want to finalize?"
  - options: one per open worktree — `{branch} ({short-path}, {N} commits ahead)`
  - 0 candidates → exit: "No active worktrees found."

Pass resolved `feature-name` to `FINALIZE.md` with `mode: auto`.
