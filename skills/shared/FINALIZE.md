# Shared Finalize Flow

Single source of truth for finalizing a feature worktree — either solo-merge (no PR) or cleanup-only (after a merged PR). Used by `core-finalize`, and by the **PHASE Finalize** sections in `dev-refactor`, `game-refactor`, and `frontend-check`.

## Entry Contract

| Parameter      | Values                             | Default  |
| -------------- | ---------------------------------- | -------- |
| `feature-name` | string                             | required |
| `mode`         | `auto` \| `solo` \| `cleanup-only` | `auto`   |

`auto` → detect mode from PR state (see Detection below).  
`solo` → run solo-merge procedure directly.  
`cleanup-only` → run cleanup procedure directly (worktree already merged via GitHub).

## Detection (auto mode only)

```bash
gh pr list --head "worktree-{feature-name}" --state all --json number,url,state --limit 1 2>/dev/null
```

| PR state         | Mode                                                                                                                              |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `MERGED`         | `cleanup-only`                                                                                                                    |
| `OPEN`           | **Halt** — print `"PR #{n} ({url}) is still open. Merge it on GitHub first, then run /core-finalize {feature-name} again."` Exit. |
| empty / `CLOSED` | `solo`                                                                                                                            |

If `gh` is unavailable: fall back to `solo` (user can always push/PR manually before running).

## Branch Resolution

Parse `git worktree list --porcelain`. Skip the first entry (main checkout). For remaining entries, match against `feature-name`:

1. Branch == `worktree-{feature-name}` (build-skill default)
2. Branch starts with `worktree-{feature-name}-` (Rename path, e.g. `worktree-auth-v2`)
3. Branch == `{feature-name}` (manual `git worktree add` with same-name branch)
4. Path ends with `/{feature-name}` (path-based match)

Pick first match. If multiple matches → **AskUserQuestion** to disambiguate:

```yaml
header: "Multiple worktrees"
question: "Multiple worktrees match '{feature-name}': {list}. Which one do you want to finalize?"
options: [one per match: "{branch} ({short-path})"]
multiSelect: false
```

Not found → **fail**: `"No worktree found for '{feature-name}'. Open worktrees: {list}."`

Store resolved: `source_branch`, `worktree_path`.

## Uncommitted Changes Check

Before any merge or cleanup:

```bash
cd "{worktree_path}" && git status --porcelain
```

If non-empty → **AskUserQuestion**:

```yaml
header: "Uncommitted changes"
question: "Worktree has uncommitted changes. What do you want to do?"
options:
  - label: "Stop — I'll commit first (Recommended)"
    description: "Exit. Commit or stash, then re-run."
  - label: "Stash and continue"
    description: "git stash push -u, then proceed"
  - label: "Ignore (dangerous)"
    description: "Continue anyway — uncommitted changes may be lost"
multiSelect: false
```

On "Stash": `cd "{worktree_path}" && git stash push -u`.

## Solo-Merge Procedure

Run when `mode = solo`.

1. If currently in a worktree → `ExitWorktree(action: keep)`.

2. Detect target branch:

   ```bash
   git branch -a | grep -E '^[* ]+(main|master|develop|staging)$' | sed 's/^[* ]*//' | head -1
   ```

   Default = `main` or `master`. If multiple candidates → AskUserQuestion to pick.

3. Defensive checkout:

   ```bash
   git show-ref --verify --quiet "refs/heads/{target}" \
     && git checkout {target} \
     || (git fetch origin "{target}" && git checkout -B "{target}" "origin/{target}")
   ```

4. Sync: `git pull --rebase` (skip if no remote).

5. Merge:

   ```bash
   git merge --no-ff {source_branch} -m "Merge feature {feature-name}

   {bullet list of commit subjects on source_branch}"
   ```

   On conflict → show conflicting files, exit with instructions:

   ```
   Merge conflict in {N} files: {list}
   Resolve manually, then: git add + git commit
   Run /core-finalize {feature-name} again for cleanup.
   ```

6. Optional push: if remote is configured → AskUserQuestion: "Push {target} to remote?" — "Yes (Recommended)" / "No".

7. → Run **Cleanup** (below).

## Cleanup Procedure

Run after solo-merge OR directly when `mode = cleanup-only`.

```bash
git worktree remove --force "{worktree_path}"
git branch -d {source_branch}
```

If `git branch -d` fails (unmerged commits): use `git branch -D` after confirming with user.

If branch was pushed to remote:

- Check: `git config branch.{source_branch}.remote`
- If set → AskUserQuestion: "Also delete remote branch `{source_branch}`?" — "Yes (Recommended)" / "No".
  - Yes → `git push origin --delete {source_branch}`

**Symlink preservation**: the worktree's `.project/` symlinks point to main's `.project/`. Removing the worktree directory removes those symlinks — main's `.project/` is untouched. No extra cleanup needed.

## Output Report

```
FINALIZE COMPLETE

Mode:      {Solo-merge | Cleanup-only}
Feature:   {feature-name}
Branch:    {source_branch} → {deleted | kept}
Target:    {target}                              (solo-merge only)
Merge:     {sha}                                 (solo-merge only)
PR:        {pr_url}                              (cleanup-only only)
Worktree:  removed
```

For cleanup-only with PR context:

```
✅ Cleanup complete: {source_branch} was merged via PR #{n}.

   Worktree: removed
   Branch:   {deleted | kept}
```

For solo-merge:

```
✅ Merged into {target}: {sha}

   Source:  {source_branch}
   Push:    {pushed to origin/{target} | skipped}
   Worktree: removed
```

## Failure Modes

| Situation                        | Action                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| Dirty worktree                   | AskUserQuestion (Stop / Stash / Ignore)                                                    |
| Merge conflict                   | Show files, exit with manual-resolve instructions                                          |
| Branch not found                 | Fail with open worktree list                                                               |
| `git branch -d` fails (unmerged) | Confirm `git branch -D` with user                                                          |
| `gh pr list` unavailable         | Fall back to `solo` mode                                                                   |
| Push rejected                    | AskUserQuestion: "Pull --rebase first (Recommended)" / "Force push (dangerous)" / "Cancel" |
