# Shared Finalize Flow

Single source of truth for finalizing a feature worktree — either solo-merge (no PR) or cleanup-only (after a merged PR). Used by `core-finalize`, and by the **PHASE Finalize** sections in `dev-ship (verify phase)`, `dev-ship (refactor phase)`, `game-ship (verify phase)`, `game-ship (refactor phase)`, and `design-check`.

## Finalize Offer Decision

Skills that opportunistically offer finalize (`dev-ship (refactor phase)`, `game-ship (refactor phase)`, `design-check`) consult this matrix to decide whether/how to prompt the user. Differs from the Detection matrix below: this is about **whether we ask**, not about **what finalize executes**.

> **Note:** `dev-ship (verify phase)` and `game-ship (verify phase)` no longer use this matrix — they use an inline auto-dispatch (see their own `references/finalize.md` / `references/completion-finalize.md`). The matrix below is for the last step of the pipeline only.

Read `TEAM_MODE` + detect PR state:

```bash
TEAM_MODE=$(jq -r '.team.mode // "solo"' .project/project.json 2>/dev/null || echo "solo")
PR_INFO=$(gh pr list --head "$(git branch --show-current)" --state all --json number,url,state --limit 1 2>/dev/null)
PR_STATE=$(echo "$PR_INFO" | jq -r '.[0].state // empty' 2>/dev/null || echo "")
PR_NUMBER=$(echo "$PR_INFO" | jq -r '.[0].number // empty' 2>/dev/null || echo "")
PR_URL=$(echo "$PR_INFO" | jq -r '.[0].url // empty' 2>/dev/null || echo "")
```

Dispatch:

| TEAM_MODE | PR_STATE                 | Action                                                                                                                                                                    |
| --------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| solo      | `OPEN`                   | Print `"PR #{PR_NUMBER} is open: {PR_URL}. Run /core-finalize {feature-name} after review."` No modal.                                                                    |
| solo      | `MERGED`                 | AskUserQuestion cleanup ("Cleanup now? Remove worktree + branch.") → `FINALIZE.md` mode `cleanup-only`.                                                                   |
| solo      | empty / `CLOSED` / no-gh | AskUserQuestion finalize ("Finalize now — merge to main + cleanup?") → `FINALIZE.md` mode `solo`.                                                                         |
| team      | `OPEN`                   | Print `"PR #{PR_NUMBER} is open: {PR_URL}. Run /core-finalize {feature-name} after review."` No modal.                                                                    |
| team      | `MERGED`                 | AskUserQuestion cleanup → `FINALIZE.md` mode `cleanup-only`.                                                                                                              |
| team      | empty / `CLOSED`         | AskUserQuestion 3-way: "Open PR (Recommended)" → `shared/PR.md`; "Merge directly to main (no PR)" → `FINALIZE.md` mode `solo`; "Keep open" → print `/core-finalize`-hint. |
| team      | no-gh                    | AskUserQuestion 2-way: "Merge directly to main (no PR)" → `FINALIZE.md` mode `solo`; "Keep open" → print `/core-finalize`-hint.                                           |

On "Keep open" → print `💡 Run /core-finalize {feature-name} when ready`.

**Team + empty/`CLOSED` — 3-way modal:**

```yaml
header: "Finalize"
question: "Feature '{feature-name}' verified. How do you want to finalize?"
options:
  - label: "Open PR (Recommended)"
    description: "Push the branch and open a PR via gh for review. Worktree stays until merged."
  - label: "Merge directly to main (no PR)"
    description: "Merge locally to main + cleanup worktree (same as solo mode)."
  - label: "Keep open"
    description: "Worktree stays open. Run /core-finalize {feature-name} when ready."
multiSelect: false
```

On "Open PR" → follow `shared/PR.md`. Print PR URL. Worktree stays open until merged (use `FINALIZE.md` mode=`cleanup-only` after merge).
On "Merge directly to main (no PR)" → run `FINALIZE.md` mode=`solo`.
On "Keep open" → print `/core-finalize`-hint.

**Team + no-gh — 2-way modal:**

```yaml
header: "Finalize"
question: "Feature '{feature-name}' verified. `gh` is not available — how do you want to finalize?"
options:
  - label: "Merge directly to main (no PR)"
    description: "Merge locally to main + cleanup worktree."
  - label: "Keep open"
    description: "Worktree stays open. Install gh + auth, then run /core-finalize {feature-name}."
multiSelect: false
```

On "Merge directly to main (no PR)" → run `FINALIZE.md` mode=`solo`.
On "Keep open" → print `/core-finalize`-hint.

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

| TEAM_MODE | PR state         | Action                                                                                                                                               |
| --------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| solo      | `MERGED`         | `cleanup-only`                                                                                                                                       |
| solo      | `OPEN`           | **Halt** — print `"PR #{n} ({url}) is still open. Merge it on GitHub first, then run /core-finalize {feature-name} again."` Exit.                    |
| solo      | empty / `CLOSED` | `solo` (merge locally)                                                                                                                               |
| solo      | `gh` unavailable | `solo` (fall-through — user can push/PR manually)                                                                                                    |
| team      | `MERGED`         | `cleanup-only`                                                                                                                                       |
| team      | `OPEN`           | **Halt** — print `"PR #{n} ({url}) is still open. Merge it on GitHub first."` Exit.                                                                  |
| team      | empty / `CLOSED` | **No auto-merge** — print `"Team project: no PR found. Push + open PR via /team-review, or toggle to solo in the backlog ⚙ if working alone."` Exit. |
| team      | `gh` unavailable | **Halt** — print `"Team mode but \`gh\` is unavailable. Run \`gh auth login\` or toggle to solo in the backlog ⚙."` Exit.                            |

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

3b. Target clean check — `git merge` aborts when the target has local changes overlapping with the merge:

    ```bash
    git -C "{main_root}" status --porcelain
    ```

    Non-empty → AskUserQuestion:

    ```
    header: "Target has uncommitted changes"
    question: "{target} has uncommitted changes. What do you want to do?"
    options:
      - label: "Stop (Recommended)"
        description: "Exit. Commit or stash on {target}, then re-run."
      - label: "Stash and continue"
        description: "git -C \"{main_root}\" stash push -u, then proceed."
      - label: "Ignore"
        description: "Continue anyway — merge may still abort on overlapping paths."
    ```

    On "Stash": `git -C "{main_root}" stash push -u`.

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

**Pre-remove cwd-check** — verify no _foreign_ process holds its cwd inside the worktree. Claude's own session (this shell, its parent `claude` process, and the `caffeinate` it spawned) always holds a cwd-handle in the self-finalize path — that is normal and is released by the ExitWorktree + `cd` steps below. Exclude that self process-tree first, then prompt only if a genuinely foreign shell remains:

```bash
# self = current shell + its ancestors + their direct children (covers claude → zsh subshell + caffeinate sibling)
_SELF=" $$ "
_p=$$
while :; do
  _pp=$(ps -o ppid= -p "$_p" 2>/dev/null | tr -d ' ')
  { [ -z "$_pp" ] || [ "$_pp" -le 1 ]; } && break
  _SELF="$_SELF $_pp "; _p=$_pp
done
for _a in $_SELF; do
  for _c in $(pgrep -P "$_a" 2>/dev/null); do _SELF="$_SELF $_c "; done
done

FOREIGN=$(lsof +D "{worktree_path}" 2>/dev/null \
  | awk 'NR>1 && $4=="cwd" {print $2"\t"$1"\t"$9}' | sort -u \
  | while IFS=$'\t' read -r _pid _cmd _path; do
      case "$_SELF" in *" $_pid "*) ;; *) printf '%s\t%s\t%s\n' "$_pid" "$_cmd" "$_path";; esac
    done)
```

`FOREIGN` empty → proceed silently (only Claude's own session held cwd; the steps below release it). Non-empty → AskUserQuestion:

- header: "Other shells in worktree"
- question: "Foreign process(es) `{names}` (PID `{pids}`) have their working directory in `{worktree_path}`. Removing now will leave the empty directory on disk. Close those shells first?"
- options:
  - "Stop and close shells (Recommended)" — exit cleanup; user closes shells, re-runs finalize
  - "Continue anyway" — proceed; expect leftover empty directory

**Switch session and shell out of the worktree** — before remove, exit the worktree in both Claude's session context AND the bash subshell so no cwd-handle remains:

1. If `git rev-parse --show-toplevel` != `{main_root}` → call `ExitWorktree(action: keep)`. This moves the Claude Code session back to the main checkout so the chat does not stay attached to the soon-to-be-deleted directory. (`keep` because the worktree is removed below via `git worktree remove`, not via `ExitWorktree`.)

2. Change the active bash directory so no subshell holds a cwd-handle:

   ```bash
   cd "{main_root}" || { echo "ABORT: main root {main_root} unreachable"; exit 1; }
   ```

> **Self-finalize is the normal solo path**: when Claude runs directly inside the worktree (solo mode), its own session holds the cwd-handle. The `ExitWorktree` + `cd {main_root}` steps above release it, so `git worktree remove --force` + the post-remove sweep finish clean (`Worktree: removed (clean)`). Only a genuinely foreign shell (a separate terminal `cd`'d into the worktree) can leave an orphan-dir; the `Worktree: orphan-dir:` status surfaces that case — ignore (cosmetic) or restart that shell in `{main_root}`.

**Remove**:

```bash
git worktree remove --force "{worktree_path}"
git branch -d {source_branch}
```

**Post-remove directory check**:

```bash
# Build-artifact directories left by dev servers / test runners — safe to sweep automatically
_BUILD_ARTIFACTS=".next node_modules dist build .turbo .playwright-cli out .cache"

if [ -d "{worktree_path}" ]; then
  _REMAINING=$(ls -A "{worktree_path}" 2>/dev/null)
  if [ -z "$_REMAINING" ]; then
    rmdir "{worktree_path}" 2>/dev/null && WORKTREE_RESULT="removed (clean)" \
      || WORKTREE_RESULT="orphan-dir: {worktree_path} (rmdir failed — close shells holding cwd, then: rmdir {worktree_path})"
  else
    # Check if only build artifacts remain
    _NON_ARTIFACT=$(echo "$_REMAINING" | tr ' ' '\n' | grep -v -E "^($(echo $_BUILD_ARTIFACTS | tr ' ' '|'))$" | head -3)
    if [ -z "$_NON_ARTIFACT" ]; then
      rm -rf "{worktree_path}" 2>/dev/null \
        && WORKTREE_RESULT="removed (clean — build artifacts swept)" \
        || WORKTREE_RESULT="orphan-dir: {worktree_path} (rm -rf failed — check permissions)"
    else
      WORKTREE_RESULT="orphan-dir: {worktree_path} (non-empty: $(ls -A "{worktree_path}" | head -3 | tr '\n' ' '))"
    fi
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

**Backlog sync (design-track only)**: finalize is a merge/cleanup step — it **never promotes `DOING` → `DONE`**. The verify step owns that transition (`/design-check` for design-track, `/dev-ship (refactor phase)` for dev-track), exactly as dev-ship's verify phase is forbidden from writing `shipped`. Finalize only stamps `shipped` on a PAGE that is **already `DONE`**.

After successful remove, detect the feature type **and current status**:

```bash
read -r FEATURE_TYPE FEATURE_STATUS < <(node -e "
  try {
    const data = JSON.parse(require('fs').readFileSync('.project/backlog.json','utf8'));
    const f = (data.features || []).find(x => x.name === '{feature-name}');
    process.stdout.write(f ? ((f.type || '') + ' ' + (f.status || '')) : ' ');
  } catch(e) { process.stdout.write(' '); }
" 2>/dev/null || echo " ")
```

Dispatch on `FEATURE_TYPE`:

- **`COMPONENT`** → **do nothing**. Components ship with the page/feature that consumes them (`/design-check` rule: a COMPONENT is never auto-`DONE`). Finalize leaves `status` and `shipped` untouched.
- **`PAGE`** → branch on `FEATURE_STATUS`:
  - **`DONE`** (convert route set it, or `/design-check` passed) → stamp ship fields:
    1. Read `.project/backlog.json` → find `f.name === "{feature-name}"`
    2. Set `shipped: true`, `shippedAt: "{YYYY-MM-DD}"`, `shippedSha: "{merge-sha}"`. Remove `stage` if present. Leave `status` at `DONE`.
    3. Write the updated JSON back to `.project/backlog.json`. Set `data.updated` to today.
    4. Sync same fields to `project.json` `features[]` entry.
  - **`DOING`** (verify skipped) → **do NOT** set `DONE`, **do NOT** ship. Leave at `DOING` (TO CHECK) and print:
    `ℹ {feature-name} merged but left at TO CHECK — run /design-check {feature-name} to ship.`
- **dev-track (`FEATURE`: type other than COMPONENT/PAGE)** → skip. `/dev-ship (refactor phase)` owns `shipped`/`shippedSha` for those.

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
💡 Bash cwd is a ghost (worktree was removed but a subshell didn't follow).
   Start a fresh terminal in: {main_root}
```

> **Scope of `Merge: {sha}`**: for **dev-track** features (not COMPONENT/PAGE), this SHA is informational only — do NOT write it to `backlog.json` or `feature.json` as `shippedSha`. The `shipped` / `shippedAt` / `shippedSha` keys for dev-track are set exclusively by `/dev-ship (refactor phase)` after CLEAN or REFACTORED review (see `shared/BACKLOG.md` Lifecycle Protocol). For **design-track**, the Backlog sync step above writes the merge SHA as `shippedSha` **only for a PAGE that is already `DONE`** — never as a `DOING` → `DONE` promotion, and never for a COMPONENT (which ships with its consuming page). A `DOING` PAGE stays at TO CHECK until `/design-check` ships it. Skills consuming this report (`dev-ship (verify phase)`, `game-ship (verify phase)`, `design-check`, `core-finalize`) MUST treat the SHA as display-only for dev-track.

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
