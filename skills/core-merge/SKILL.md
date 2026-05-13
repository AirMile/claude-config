---
name: core-merge
description: Merge a feature worktree branch back to a target branch with optional push/PR creation and worktree cleanup. Use with /core-merge or /core-merge [feature-name]. Detects worktree state, offers squash/no-ff/PR-flow strategies, handles cleanup.
argument-hint: "[feature-name]"
metadata:
  author: claude-config
  version: 1.0.0
  category: core
---

# Merge

Integrate a finished feature branch (created via `EnterWorktree` in the build skill) back into the target branch. Supports PR-flow for OTAP/review setups and local merge (squash or `--no-ff`) for solo work. Handles worktree cleanup.

## Trigger

`/core-merge` or `/core-merge [feature-name]`

## When to Use

- Feature is `DONE` in backlog and lives on a `worktree-{feature}` branch
- You want to integrate the branch (PR, local merge, or push-only)
- You want to clean up the worktree after merging

Not for: regular commits (use `/core-commit`), pulling remote changes (use `/core-pull`), creating new branches.

## PHASE 0: Pre-flight + State Detection

### Detect current state

Run in parallel:

```bash
git branch --show-current        # current branch name
git worktree list --porcelain    # all worktrees + branches
git status --porcelain           # uncommitted changes check
git rev-parse --show-toplevel    # current repo root
```

### Determine source branch and worktree path

Parse `git worktree list --porcelain` once. The first entry is always the main checkout — skip it. Remaining entries are candidate source worktrees, regardless of branch naming convention.

**If feature-name argument provided** (`/core-merge auth`):

- Search candidate entries for a match:
  - Branch == `worktree-auth` (build-skill default), OR
  - Branch == `auth` (manual `git worktree add` with same-name branch), OR
  - Path ends with `/auth` (manual worktree path-based match)
- Pick first match. If multiple matches → AskUserQuestion to disambiguate.
- Not found → fail: "No worktree found for 'auth'. Existing worktrees: {list}."

**If no argument and currently in a worktree** (current pwd != main_root):

- Source branch = current branch (any name, no pattern restriction)
- Source worktree path = current `git rev-parse --show-toplevel`

**If no argument and currently on main**:

- List all candidate worktrees from parsed output (already excluded main).
- Use AskUserQuestion to pick one:
  - header: "Worktree"
  - question: "Which worktree do you want to integrate?"
  - options: per worktree: `{branch} ({short path}, {N} commits ahead)`. Limit to 4 — if more, show top 4 by recency and add "Other" for free input.
- 0 candidates → exit: "No active worktrees found."

### Validate state

Before proceeding:

- Source worktree must not have uncommitted changes:
  - Run `cd "{worktree_path}" && git status --porcelain`
  - If non-empty → AskUserQuestion: "Worktree has uncommitted changes. What do you want to do?"
    - "Stop, I'll commit first (Recommended)" → exit
    - "Stash and continue" → `cd "{worktree_path}" && git stash push -u`
    - "Ignore (dangerous)" → continue, warn user

## PHASE 0b: Already-merged Detection

After source branch is determined, check if it's already integrated:

1. Detect target candidates (same as PHASE 1): `git branch -a` filtered on `main|master|develop|staging`
2. Per candidate: `git branch --merged {target} | grep -E "^[* ]+{source}$"` — branch is in `--merged` output?
3. If source-branch is merged in any target:
   - AskUserQuestion:
     - header: "Already merged"
     - question: "Branch `{source}` is already merged into `{merged_target}`. What now?"
     - options:
       - "Cleanup only (Recommended)" — remove worktree + branch, no new merge
       - "Cancel" — exit without action
   - Cleanup only → skip PHASE 1, PHASE 2, PHASE 3 and jump directly to PHASE 4 cleanup-prompt
     - Set `strategy = "cleanup-only"`, `merged_into = "{merged_target}"` for PHASE 5 report
4. Not merged → check commits-ahead for remaining targets:
   - `git log {target}..{source} --oneline | wc -l` — if 0 commits ahead on all targets → "Nothing to merge.", exit
   - Else → continue normally to PHASE 1

> **Caveat (rebase-workflow)**: `git branch --merged` does not always recognize rebase-merged commits. In a rebase-flow this check can produce a false negative. Workaround: manually `git worktree remove --force` + `git branch -D`.

## PHASE 1: Target Branch Selection

Detect candidate targets:

```bash
git branch -a | grep -E '^[* ]+(main|master|develop|staging)$' | sed 's/^[* ]*//'
```

Use AskUserQuestion:

- header: "Target"
- question: "Which branch do you want to merge into?"
- options: found candidates (default first = `main` or `master`)

If no candidates found → ask user freeform via "Other".

## PHASE 2: Strategy Selection

Detect `gh` availability:

```bash
command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1
```

### Existing PR check (only if `gh` available)

Before showing strategy options, check whether a PR already exists for this branch:

```bash
gh pr list --head {source-branch} --state all --json number,url,state --limit 1
```

If a PR exists:

- **state == "OPEN"**:
  - AskUserQuestion:
    - header: "Existing PR"
    - question: "PR #{n} already exists ({url}). What do you want to do?"
    - options:
      - "Show PR URL and exit (Recommended)" — print URL, exit successfully
      - "Update PR (push extra commits)" — `git push` on branch, no new PR
      - "Force new PR" — `gh pr close {n} --comment "Replaced by new PR"`, then normal PR-flow
      - "Cancel" — exit
- **state == "MERGED"**:
  - Auto-route to cleanup-only path (same as PHASE 0b cleanup-only):
    - Set `strategy = "cleanup-only"`, `pr_url = {url}` for PHASE 5 report
    - Jump directly to PHASE 4 cleanup-prompt
- **state == "CLOSED"** (and not merged):
  - AskUserQuestion: "PR #{n} is closed. Force new PR?"
    - "Yes, create new PR (Recommended)"
    - "Cancel" — exit

If no PR exists: continue to strategy options below.

### Strategy options

Build options list dynamically:

| Strategy                            | Show always                              |
| ----------------------------------- | ---------------------------------------- |
| Push + open PR via gh               | Only if `gh` installed AND authenticated |
| Squash-merge locally into {target}  | Always                                   |
| Merge --no-ff locally into {target} | Always                                   |
| Push only (no PR/merge)             | Only if remote configured                |

AskUserQuestion:

- header: "Strategy"
- question: "How do you want to integrate this feature?"
- options: dynamic list (first = "Push + open PR" if available, else "Squash-merge locally")
- multiSelect: false

## PHASE 3: Execute

> **Cross-platform**: use `cd "{worktree_path}" && git <cmd>` instead of `git -C <path>`. On Windows, `git -C` breaks with paths containing backslashes. Always quote the path.

### Strategy: Push + open PR

1. If session is in a worktree → `ExitWorktree(action: "keep")`
2. From main checkout: `cd "{worktree_path}" && git push -u origin worktree-{feature}`
3. Build PR title from latest skill-commit subject:
   - Read `git log -1 --format=%s worktree-{feature}` → if matches `build({feature}): ...` → title = `feat({feature}): {feature description}`
   - Else → title = `feat({feature}): merge worktree-{feature}`
4. Build PR body from commit list:

   ```
   ## Summary
   - {commit subjects from worktree-{feature}, oldest to newest}

   ## Test plan
   - [ ] Review changes
   - [ ] CI passes
   ```

5. `gh pr create --base {target} --head worktree-{feature} --title "{title}" --body "{body}"`
6. Capture PR URL from output
7. Skip cleanup (PR must be reviewed first)

### Strategy: Squash-merge locally

1. If session is in a worktree → `ExitWorktree(action: "keep")`
2. Defensive checkout — if target only exists remotely, create a local tracking branch:
   ```bash
   git show-ref --verify --quiet "refs/heads/{target}" \
     && git checkout {target} \
     || (git fetch origin "{target}" && git checkout -B "{target}" "origin/{target}")
   ```
3. `git pull --rebase` (sync first; skip if no remote)
4. `git merge --squash worktree-{feature}`
5. Build commit message:
   - Subject: `feat({feature}): {summary}` — derive `{summary}` from latest `build({feature})` commit body or first paragraph of feature.json description if available
   - Body: list of squashed skill-commits as bullets
6. `git commit -m "{subject}\n\n{body}"`
7. → PHASE 4 cleanup-prompt

### Strategy: Merge --no-ff

1. If session is in a worktree → `ExitWorktree(action: "keep")`
2. Defensive checkout (same pattern as Squash-merge step 2):
   ```bash
   git show-ref --verify --quiet "refs/heads/{target}" \
     && git checkout {target} \
     || (git fetch origin "{target}" && git checkout -B "{target}" "origin/{target}")
   ```
3. `git pull --rebase` (skip if no remote)
4. `git merge --no-ff worktree-{feature} -m "Merge feature {feature}\n\n{commit subjects bullet list}"`
5. → PHASE 4 cleanup-prompt

### Strategy: Push only

1. If session is in a worktree → `ExitWorktree(action: "keep")`
2. `cd "{worktree_path}" && git push -u origin worktree-{feature}`
3. Skip cleanup, output remote-tracking confirmation

## PHASE 4: Cleanup (only after local merge)

Only run after Squash-merge or Merge --no-ff strategies. Skip after PR-flow and Push-only.

AskUserQuestion:

- header: "Cleanup"
- question: "Clean up worktree?"
- options:
  - "Yes, remove worktree + delete branch (Recommended)" → execute cleanup
  - "No, keep worktree" → skip cleanup, log path
- multiSelect: false

If cleanup chosen:

```bash
git worktree remove --force {worktree_path}
git branch -D worktree-{feature}
```

If branch was pushed to remote and merged via PR / local-merge:

- Detect remote tracking: `git config branch.worktree-{feature}.remote`
- If set → AskUserQuestion: "Also delete remote branch?"
  - "Yes" → `git push origin --delete worktree-{feature}`
  - "No" → skip

## PHASE 5: Output Report

Generate ASCII table summary:

```
CORE-MERGE COMPLETE

Strategy:    {Push + PR | Squash-merge | Merge --no-ff | Push only | Cleanup only}
Source:      {source-branch}
Target:      {target}                                  (skip line for Cleanup only without context)
Commits:     {N} commits integrated                    (skip line for Cleanup only)
Result:      {merge SHA | PR URL | push ref | already merged in {target} | PR #{n} merged}
Worktree:    {removed | kept at {path}}
Branch:      {deleted | kept ({source-branch})}
```

For PR-flow, output PR URL prominently:

```
✅ PR opened: {url}

Next steps:
- Review and merge via GitHub
- Run /core-merge {feature} again after PR merge for cleanup
```

For local merges:

```
✅ Merged into {target}: {sha}

Next steps:
- Push {target} to remote: git push
- Worktree {removed | kept}
```

For cleanup-only:

```
✅ Cleanup complete: {source-branch} was already merged in {target}{ via PR #{n}}.

Next steps:
- Worktree {removed | kept}
- Branch {deleted | kept}
```

## Error Handling

### Source equals target

If source branch equals target branch (e.g. `/core-merge` triggered while on `main`):

- "Source and target are the same branch ({target}). Nothing to do.", exit

### Uncommitted changes in worktree

Already handled in PHASE 0 validate.

### `gh` not installed or not authenticated

PR-strategy hidden in PHASE 2. No error, just other options.

### Merge conflicts

`git merge --squash` or `git merge --no-ff` fails:

```
❌ Merge conflict in {N} files:
  - {file1}
  - {file2}

Resolve manually:
  1. Edit conflicts in working tree
  2. git add {resolved files}
  3. git commit (for --no-ff) or git commit -m "feat({feature}): ..." (for squash)
  4. /core-merge {feature} again for cleanup
```

Exit, no automatic retry. User must resolve conflicts.

### Push rejected

`git push` failed with "rejected" / "behind remote":

- AskUserQuestion: "Push rejected. What do you want to do?"
  - "Pull --rebase first (Recommended)" → `git pull --rebase` then retry push
  - "Force push (dangerous)" → confirm with second AskUserQuestion, then `git push --force-with-lease`
  - "Cancel" → exit

### `gh pr create` failure

If PR creation fails after successful push:

- Show error
- AskUserQuestion: "PR creation failed. What do you want to do?"
  - "Skip — branch is pushed, create PR manually" → exit with success on push
  - "Retry" → `gh pr create` again
  - "Cancel" → exit

## Output

**Success (PR):**

```
✅ PR opened: https://github.com/{owner}/{repo}/pull/{n}

   Strategy:  Push + PR
   Branch:    worktree-{feature} → {target}
   Commits:   {N}
```

**Success (local merge):**

```
✅ Merged: {sha} on {target}

   Strategy:  {Squash-merge | Merge --no-ff}
   Source:    {source-branch} ({N} commits)
   Worktree:  {removed | kept at {path}}
```

**Success (cleanup-only):**

```
✅ Cleanup complete: {source-branch} was already merged in {target}{ via PR #{n}}.

   Strategy:  Cleanup only
   Source:    {source-branch} (reason: {already merged in {target} | PR #{n} merged})
   Worktree:  {removed | kept at {path}}
   Branch:    {deleted | kept}
```

**Failure:**

```
❌ {operation} failed: {reason}

   💡 {suggestion}
```
