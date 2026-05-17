# Shared Finalize Flow

Single source of truth for finalizing a feature worktree — either solo-merge (no PR) or cleanup-only (after a merged PR). Used by `core-finalize`, and by the **PHASE Finalize** sections in `dev-verify`, `dev-refactor`, `game-verify`, `game-refactor`, and `frontend-check`.

## Finalize Offer Decision

Skills die opportunistisch finalize aanbieden (`dev-verify`, `dev-refactor`, `game-verify`, `game-refactor`, `frontend-check`) consulteren deze matrix om te beslissen of/hoe ze de gebruiker prompten. Verschilt van de Detection-matrix hieronder: dit gaat over **of we vragen**, niet over **wat finalize uitvoert**.

Read `TEAM_MODE` + detect PR state:

```bash
TEAM_MODE=$(jq -r '.team.mode // "solo"' .project/project.json 2>/dev/null || echo "solo")
PR_INFO=$(gh pr list --head "$(git branch --show-current)" --state all --json number,url,state --limit 1 2>/dev/null)
PR_STATE=$(echo "$PR_INFO" | jq -r '.[0].state // empty' 2>/dev/null || echo "")
PR_NUMBER=$(echo "$PR_INFO" | jq -r '.[0].number // empty' 2>/dev/null || echo "")
PR_URL=$(echo "$PR_INFO" | jq -r '.[0].url // empty' 2>/dev/null || echo "")
```

Dispatch:

| TEAM_MODE | PR_STATE                    | Action                                                                                                                                 |
| --------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| solo      | `OPEN`                      | Print `"PR #{PR_NUMBER} is open: {PR_URL}. Run /core-finalize {feature-name} after review."` No modal.                                 |
| solo      | `MERGED`                    | AskUserQuestion cleanup ("Cleanup nu? Worktree + branch verwijderen.") → `FINALIZE.md` mode `cleanup-only`.                             |
| solo      | empty / `CLOSED` / no-gh   | AskUserQuestion finalize ("Finalize nu — merge naar main + cleanup?") → `FINALIZE.md` mode `solo`.                                     |
| team      | `OPEN`                      | Print `"PR #{PR_NUMBER} is open: {PR_URL}. Run /core-finalize {feature-name} after review."` No modal.                                 |
| team      | `MERGED`                    | AskUserQuestion cleanup → `FINALIZE.md` mode `cleanup-only`.                                                                           |
| team      | empty / `CLOSED`            | Print `"Team project: geen PR gevonden. Push + open PR via /team-review."` Halt — geen auto-merge.                                     |
| team      | no-gh                       | Print `"Team mode maar \`gh\` niet beschikbaar — run \`gh auth login\` of toggle solo in backlog ⚙."` Halt.                           |

On "Keep open" (alleen mogelijk in solo paths of team `MERGED`) → print `💡 Run /core-finalize {feature-name} when ready`.

---

## Entry Contract

| Parameter      | Values                             | Default  |
| -------------- | ---------------------------------- | -------- |
| `feature-name` | string                             | required |
| `mode`         | `auto` \| `solo` \| `cleanup-only` | `auto`   |

`auto` → detect mode from PR state (see Detection below).  
`solo` → run solo-merge procedure directly.  
`cleanup-only` → run cleanup procedure directly (worktree already merged via GitHub).

## Detection (auto mode only)

Read `TEAM_MODE` first (see `shared/PROJECT-MODE.md`):

```bash
TEAM_MODE=$(jq -r '.team.mode // "solo"' .project/project.json 2>/dev/null || echo "solo")
```

Then detect PR state:

```bash
gh pr list --head "worktree-{feature-name}" --state all --json number,url,state --limit 1 2>/dev/null
```

Combined decision matrix (`TEAM_MODE` × PR state):

| TEAM_MODE | PR state             | Action                                                                                                                                       |
| --------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| solo      | `MERGED`             | `cleanup-only`                                                                                                                               |
| solo      | `OPEN`               | **Halt** — print `"PR #{n} ({url}) is still open. Merge it on GitHub first, then run /core-finalize {feature-name} again."` Exit.            |
| solo      | empty / `CLOSED`     | `solo` (merge locally)                                                                                                                       |
| solo      | `gh` unavailable     | `solo` (fall-through — user can push/PR manually)                                                                                            |
| team      | `MERGED`             | `cleanup-only`                                                                                                                               |
| team      | `OPEN`               | **Halt** — print `"PR #{n} ({url}) is still open. Merge it on GitHub first."` Exit.                                                          |
| team      | empty / `CLOSED`     | **No auto-merge** — print `"Team project: no PR found. Push + open PR via /team-review, or toggle to solo in the backlog ⚙ if working alone."` Exit. |
| team      | `gh` unavailable     | **Halt** — print `"Team mode but \`gh\` is unavailable. Run \`gh auth login\` or toggle to solo in the backlog ⚙."` Exit.                   |

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

**Pre-remove cwd-check** — verify no other process has its working directory inside the worktree:

```bash
lsof +D "{worktree_path}" 2>/dev/null | awk 'NR>1 && $4=="cwd" {print $1, $2, $9}' | sort -u
```

Any line → AskUserQuestion:

- header: "Other shells in worktree"
- question: "Process(es) `{names}` (PID `{pids}`) have their working directory in `{worktree_path}`. Removing now will leave the empty directory on disk. Close those shells first?"
- options:
  - "Stop and close shells (Recommended)" — exit cleanup; user closes shells, re-runs finalize
  - "Continue anyway" — proceed; expect leftover empty directory

**Switch shell out of the worktree** — before remove, change the active Bash directory to the main checkout so no subshell holds a cwd-handle:

```bash
cd "{main_root}" || { echo "ABORT: main root {main_root} unreachable"; exit 1; }
```

> **Self-finalize scenario**: when this Claude Code session was launched with its working directory **inside** the worktree (e.g. user opened a shell in `{worktree_path}` and started Claude there), the Claude **parent process** still holds a cwd-handle even after this `cd`. `git worktree remove` will succeed but `rmdir` typically fails → the empty directory remains on disk. The Output Report's `Worktree: orphan-dir:` status surfaces this; the user can either ignore it (cosmetic remnant) or close this Claude session and start a new one in `{main_root}`.

**Remove**:

```bash
git worktree remove --force "{worktree_path}"
git branch -d {source_branch}
```

**Post-remove directory check**:

```bash
if [ -d "{worktree_path}" ]; then
  if [ -z "$(ls -A "{worktree_path}" 2>/dev/null)" ]; then
    rmdir "{worktree_path}" 2>/dev/null && WORKTREE_RESULT="removed (clean)" \
      || WORKTREE_RESULT="orphan-dir: {worktree_path} (rmdir failed — close shells holding cwd, then: rmdir {worktree_path})"
  else
    WORKTREE_RESULT="orphan-dir: {worktree_path} (non-empty: $(ls -A "{worktree_path}" | head -3 | tr '\n' ' '))"
  fi
else
  WORKTREE_RESULT="removed (clean)"
fi
```

`WORKTREE_RESULT` feeds the `Worktree:` line in the Output Report below.

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
Worktree:  {WORKTREE_RESULT}
```

When `WORKTREE_RESULT` starts with `orphan-dir:` → also print:

```
⚠ Worktree directory remained on disk. Close any shells with cwd in {worktree_path}, then run:
  rmdir {worktree_path}
```

Also detect ghost cwd via `[ "$(pwd)" != "{main_root}" ] && [ ! -d "$(pwd)" ]`. If true → also print:

```
💡 This Claude session was started inside the worktree directory.
   Its working directory is now a ghost. Start a fresh session in:
   {main_root}
```

> **Scope of `Merge: {sha}`**: informational only — surfaces the merge commit for the user. Do NOT write it to `backlog.html` or `feature.json` as `shippedSha`. The `shipped` / `shippedAt` / `shippedSha` keys are set exclusively by `/dev-refactor` after CLEAN or REFACTORED review (see `shared/BACKLOG.md` Lifecycle Protocol). Skills consuming this report (`dev-verify`, `game-verify`, `frontend-check`, `core-finalize`) MUST treat the SHA as display-only.

For cleanup-only with PR context:

```
✅ Cleanup complete: {source_branch} was merged via PR #{n}.

   Worktree: {WORKTREE_RESULT}
   Branch:   {deleted | kept}
```

For solo-merge:

```
✅ Merged into {target}: {sha}

   Source:  {source_branch}
   Push:    {pushed to origin/{target} | skipped}
   Worktree: {WORKTREE_RESULT}
```

## Failure Modes

| Situation                        | Action                                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| Dirty worktree                   | AskUserQuestion (Stop / Stash / Ignore)                                                    |
| Merge conflict                   | Show files, exit with manual-resolve instructions                                          |
| Branch not found                 | Fail with open worktree list                                                               |
| `git branch -d` fails (unmerged) | Confirm `git branch -D` with user                                                          |
| `gh` unavailable (solo project)  | Fall back to `solo` mode                                                                   |
| `gh` unavailable (team project)  | Halt — print install hint (see Detection matrix)                                           |
| Push rejected                    | AskUserQuestion: "Pull --rebase first (Recommended)" / "Force push (dangerous)" / "Cancel" |
