---
name: project-sync
description: Sync durable .project/ state via the state branch. Use with /project-sync.
argument-hint: "[push|pull|status]"
metadata:
  author: claude-config
  version: 1.0.0
  category: project
---

# Project Sync

Sync the durable subset of a project's gitignored `.project/` folder across your own
devices, via the orphan branch `claude/state`. Backlog, dashboard, seed, learnings,
archive, and feature dossiers travel with the repo without ever being tracked on a
working branch — Model A stays intact.

All procedures live in `.claude/skills/shared/STATE-SYNC.md`; this skill wires them to
the `push` / `pull` / `status` modes and reports the result.

## Trigger

`/project-sync [push|pull|status]` — no argument → mode is chosen in PHASE 1.

## Platform

Detect platform: **Windows** (`$PSVersionTable` exists) → PowerShell; **macOS/Linux** →
bash. Command variants for both OSes are in `shared/STATE-SYNC.md`.

## Process

### PHASE 0: Pre-flight

Follow `shared/STATE-SYNC.md § 5` (preflight & temp-worktree hygiene). Concretely:

1. **Main-checkout gate** — compute `main_root` / `current_root`. If
   `current_root != main_root` → **exit**: "project-sync only runs on the main
   checkout. You are in worktree `{current_root}`. Run `ExitWorktree(action: keep)`
   first, then retry." (Worktree `.project/` is symlinks back to main.)
2. **Repo + remote** — inside a git repo with a non-empty `git remote`; else **exit**:
   "state sync requires a git remote."
3. **`.project/` exists** — else **exit**: "no `.project/` to sync — run `/core-setup`
   first."
4. **Hygiene** — `git worktree prune`; remove any dangling `$STATE_WT`.
5. **Branch resolution** — per `shared/STATE-SYNC.md § 2`. If `project.json#team.mode
== "team"` and no branch is recorded in `.project/session/state-sync.json`, and the
   mode (PHASE 1) is `push` → **AskUserQuestion** for the branch name (first option
   `claude/state-{user}` = recommended). Persist the choice.

### PHASE 1: Mode dispatch

Argument `push` / `pull` / `status`. No argument → **AskUserQuestion**:

- "Status (Recommended)" — show what would sync, change nothing
- "Push" — send local durable state to the state branch
- "Pull" — bring remote state into this device

### PHASE 2: Execute

- **status** — `git fetch origin "$STATE_BRANCH"`; show the resolved branch, remote SHA
  vs `state-sync.json#lastSyncedSha`, local drift (the `collect`-into-`LAST`-worktree
  check from `STATE-SYNC.md § 7`, reported as a changed-file count), and last
  push/pull timestamps. No writes.
- **push** — follow `shared/STATE-SYNC.md § 6` (Push procedure, incl. first-time orphan
  and push-rejected retry). Update `state-sync.json`.
- **pull** — follow `shared/STATE-SYNC.md § 7` (Pull procedure & conflict matrix).
  Update `state-sync.json`.

### PHASE 3: Report

ASCII table:

```
STATE SYNC ─ {mode}
───────────────────────────────────────────
Branch          claude/state[-user]
Remote SHA      {shortsha}   (was {last shortsha})
Pushed          {n} file(s)  | —
Pulled          {n} file(s)  | —
Merged          {n} file(s)  | —
Conflicts       {n resolved} | —
lastSyncedSha   {shortsha}
───────────────────────────────────────────
```

Fill only the rows relevant to the mode (status shows drift counts, no SHA change).
