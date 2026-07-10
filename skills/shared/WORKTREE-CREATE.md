# WORKTREE-CREATE — auto-create & destroy procedures

Worktree creation and destruction for build/design PHASE 0 paths. Switching into an
existing worktree, the shared `.project/` symlink sections, and the Symlink Integrity
Gate live in `shared/WORKTREE.md` — verify/refactor/finalize paths need only that file.

## Auto-create worktree

Run in PHASE 0 of skills that **mutate app code** (not just `.project/`) and have a known feature-name.

### Skip auto-create if

- No feature-name is known
- Already inside a worktree (`current_root != main_root` — procedure detects this)
- Skill is in batch-mode or codebase-mode (no single feature-name available)

### Procedure

#### Step 0: Prune stale registrations

```bash
git worktree prune
```

#### Step 1: Determine main repo root

```bash
main_root=$(git worktree list --porcelain | head -1 | awk '{print $2}')
current_root=$(git rev-parse --show-toplevel)
```

If `current_root != main_root`: already in a worktree → **skip auto-create**, continue skill's PHASE 0 on current branch.

#### Step 1b: Dirty-work guard

`git worktree add` branches from the last **commit**, not the working tree — any uncommitted change on `$DEFAULT` is silently absent from the new worktree's base. Before creating, check for that:

```bash
DIRTY_COUNT=$(git -C "$main_root" status --porcelain | wc -l | tr -d ' ')
```

`DIRTY_COUNT = 0` → skip silently, continue to Step 2.

`DIRTY_COUNT > 0` → AskUserQuestion:

- header: "Uncommitted work"
- question: "`$main_root` has {DIRTY_COUNT} uncommitted change(s) that would NOT be included in the new worktree (it branches from the last commit). How do you want to proceed?"
- options:
  - "Work directly on {default branch} (Recommended if this run continues that work)" — skip auto-create entirely, continue the skill's PHASE 0 on the current branch, no worktree
  - "Commit first, then create the worktree" — stop here; user commits, then re-run
  - "Create the worktree anyway (uncommitted work stays behind, unaffected)" — only sensible when the dirty changes are unrelated to this run; proceed to Step 2

Do not silently proceed past a nonzero `DIRTY_COUNT` — an unattended worktree-add here can leave two divergent copies of in-progress work with no signal to the user that it happened.

#### Step 2: Collision check

Check whether a worktree/branch already exists for this feature:

```bash
git show-ref --verify --quiet "refs/heads/worktree-{feature-name}"
test -e "{main_root}/.claude/worktrees/{feature-name}"
```

**If branch OR directory exists** — check clean state first:

```bash
WT_PATH="{main_root}/.claude/worktrees/{feature-name}"
BRANCH_OK=$(cd "$WT_PATH" 2>/dev/null && [ "$(git branch --show-current)" = "worktree-{feature-name}" ] && echo yes || echo no)
DIRTY=$(cd "$WT_PATH" 2>/dev/null && git status --porcelain | head -1)
SYMLINK_OK=$(
  test -L "$WT_PATH/.project/backlog.json" && test -e "$WT_PATH/.project/backlog.json" &&
  test -L "$WT_PATH/.project/features"     && test -e "$WT_PATH/.project/features" &&
  echo yes || echo no
)
```

**Pre-existing-orphan check** — `$WT_PATH` exists on disk but git knows no worktree there. Classic residue from a prior session that couldn't clean up (see `shared/FINALIZE.md → Cleanup Procedure` orphan-dir scenario).

```bash
if [ -d "$WT_PATH" ] \
   && ! git worktree list --porcelain 2>/dev/null | grep -q "^worktree $WT_PATH$"; then
  ORPHAN_DETECTED=1
fi
```

`ORPHAN_DETECTED=1` → AskUserQuestion (bypass of the regular collision matrix):

- header: "Orphan directory"
- question: "`$WT_PATH` exists on disk but git knows no worktree there (residue from a previous session). What do you want to do?"
- options:
  - "Cleanup + create fresh (Recommended)" — run `lsof +D "$WT_PATH"` pre-check first (same as FINALIZE.md); if no cwd-holders: `rm -rf "$WT_PATH"`; on success proceed to no-collision `EnterWorktree`; on failure abort with path hint
  - "Cancel" — exit skill; user inspects manually

On "Cleanup + create fresh" with cwd-holders → AskUserQuestion:

- "Stop and close shells (Recommended)" — exit skill
- "Continue anyway (orphan directory may persist)" — proceed with `rm -rf`

After successful cleanup → skip rest of Step 1, go directly to no-collision `EnterWorktree`.

**Collision decision matrix:**

| BRANCH_OK    | DIRTY | SYMLINK_OK | Action                                                                                                                |
| ------------ | ----- | ---------- | --------------------------------------------------------------------------------------------------------------------- |
| `yes`        | empty | `yes`      | **Silent reuse + skip Step 3** — `EnterWorktree(path: "$WT_PATH")`, proceed directly to Step 4                        |
| `yes`        | empty | `no`       | **Silent reuse + re-run Step 3** — `EnterWorktree(path: "$WT_PATH")`, continue to Step 3 (symlink repair, idempotent) |
| `no` / dirty | —     | —          | **Show AskUserQuestion** (see below)                                                                                  |

**Otherwise** (dirty tree, wrong branch, or path inaccessible) — collect context:

```bash
WT_PATH="{main_root}/.claude/worktrees/{feature-name}"
UNCOMMITTED=$(cd "$WT_PATH" 2>/dev/null && git status --porcelain | wc -l | tr -d ' ' || echo "?")
UNMERGED=$(git log "{default_branch}..worktree-{feature-name}" --oneline 2>/dev/null | wc -l | tr -d ' ' || echo "?")
LAST_COMMIT=$(git log -1 --format='%cr' "worktree-{feature-name}" 2>/dev/null || echo "unknown")
```

Then AskUserQuestion:

```yaml
header: "Worktree exists"
question: "worktree-{feature-name} already exists ({UNCOMMITTED} uncommitted · {UNMERGED} unmerged · {LAST_COMMIT}). What do you want to do?"
options:
  - label: "Reuse existing (Recommended)"
    description: "Switch into the existing worktree — continues the previous session"
  - label: "Destroy and recreate"
    description: "Remove the existing worktree + branch and create a fresh one"
  - label: "Rename this build"
    description: "Enter a suffix (e.g. -v2) and create worktree-{feature-name}-{suffix}"
  - label: "Cancel"
    description: "Exit without creating a worktree — work on current branch"
multiSelect: false
```

- **Reuse** → `EnterWorktree(path: "{main_root}/.claude/worktrees/{feature-name}")` (skip create, go to Step 4)
- **Destroy** → run **Destroy procedure** below, then continue to no-collision path
- **Rename** → ask user for suffix, then `EnterWorktree(name: "{feature-name}-{suffix}")` (go to Step 4 with adjusted name)
- **Cancel** → exit skill

#### Destroy procedure

Recreates a fresh worktree at the same path → the old directory MUST be fully gone before continuing, otherwise `EnterWorktree` collides.

0. **Branch-state safety** — guard against silent data-loss when the branch has commits that never reached the integration branch:

   ```bash
   # UNMERGED is already computed in the collision-context block above; reuse it.
   if [ "${UNMERGED:-0}" -gt 0 ] 2>/dev/null; then
     UNMERGED_WARN=1
   fi
   ```

   `UNMERGED_WARN=1` → AskUserQuestion:
   - header: "Unmerged commits"
   - question: "Branch `worktree-{feature-name}` has `{UNMERGED}` commit(s) not on `{default_branch}`. Destroy will force-delete the branch and lose them. Continue?"
   - options:
     - "Cancel (Recommended)" — return to the collision modal; user picks Reuse/Rename or commits/pushes first
     - "Continue — discard {UNMERGED} commits" — proceed to Step 1 (pre-remove cwd-check)

   `UNMERGED == 0` → skip silently, continue to Step 1.

1. **Pre-remove cwd-check** — same `lsof +D` detection as `shared/FINALIZE.md → Cleanup Procedure`:

   ```bash
   lsof +D "{main_root}/.claude/worktrees/{feature-name}" 2>/dev/null \
     | awk 'NR>1 && $4=="cwd" {print $1, $2, $9}' | sort -u
   ```

   Any line → AskUserQuestion:
   - header: "Other shells in worktree"
   - question: "Process(es) `{names}` (PID `{pids}`) have cwd inside the worktree you want to destroy. Removing now will leave the empty directory on disk and block recreate. Close those shells first?"
   - options:
     - "Stop and close shells (Recommended)" — exit skill; user closes shells, re-runs
     - "Cancel destroy — pick Reuse/Rename instead" — return to the collision modal

2. **Switch shell out of the worktree** — guarantee the Bash subshell doesn't hold a cwd-handle:

   ```bash
   cd "{main_root}" || { echo "ABORT: main root {main_root} unreachable"; exit 1; }
   ```

3. **Remove**:

   ```bash
   git worktree remove --force "{main_root}/.claude/worktrees/{feature-name}"
   git branch -D worktree-{feature-name}
   ```

4. **Post-remove residue check** — recreate-path is stricter than finalize (residue blocks the next step):

   ```bash
   if [ -d "{main_root}/.claude/worktrees/{feature-name}" ]; then
     if [ -z "$(ls -A "{main_root}/.claude/worktrees/{feature-name}" 2>/dev/null)" ]; then
       rmdir "{main_root}/.claude/worktrees/{feature-name}" 2>/dev/null \
         || { echo "ABORT: empty directory remains but rmdir failed — another process holds cwd. Close it and retry."; exit 1; }
     else
       echo "ABORT: leftover files in {main_root}/.claude/worktrees/{feature-name}: $(ls -A "{main_root}/.claude/worktrees/{feature-name}" | head -3 | tr '\n' ' '). Investigate and remove manually before recreating."
       exit 1
     fi
   fi
   ```

   Abort instead of warn — the next `EnterWorktree` would fail anyway on a non-empty path; failing fast with a clear message beats a confusing downstream error.

5. Continue to the no-collision path (`EnterWorktree(name: "{feature-name}")`).

**If no collision** — pull origin into local `$DEFAULT` (if behind), then create worktree explicitly from local `$DEFAULT`. This ensures local-only merges (features finalized but not yet pushed) are included in the new worktree's base:

```bash
DEFAULT=$(git -C "$main_root" symbolic-ref --short HEAD 2>/dev/null || echo main)
UPSTREAM=$(git -C "$main_root" rev-parse --abbrev-ref --symbolic-full-name "$DEFAULT@{u}" 2>/dev/null || echo "")
WT_NAME="worktree-{feature-name}"
WT_PATH="{main_root}/.claude/worktrees/{feature-name}"

if [ -n "$UPSTREAM" ]; then
  REMOTE=$(echo "$UPSTREAM" | cut -d/ -f1)
  if git -C "$main_root" fetch --quiet "$REMOTE" "$DEFAULT" 2>/dev/null; then
    LOCAL_HEAD=$(git -C "$main_root" rev-parse "$DEFAULT")
    REMOTE_HEAD=$(git -C "$main_root" rev-parse "$UPSTREAM")
    if [ "$LOCAL_HEAD" != "$REMOTE_HEAD" ]; then
      if git -C "$main_root" pull --ff-only --quiet "$REMOTE" "$DEFAULT" 2>/dev/null; then
        PULLED=$(git -C "$main_root" log --oneline "$LOCAL_HEAD..$UPSTREAM" 2>/dev/null | wc -l | tr -d ' ')
        echo "BASE: pulled $DEFAULT from $UPSTREAM ($PULLED commits)"
      else
        LOCAL_AHEAD=$(git -C "$main_root" rev-list --count "$UPSTREAM..$DEFAULT" 2>/dev/null || echo 0)
        if [ "${LOCAL_AHEAD:-0}" -gt 0 ]; then
          echo "BASE: local $DEFAULT is $LOCAL_AHEAD commits ahead of $UPSTREAM — local merges included in worktree base"
        else
          echo "BASE: local $DEFAULT diverged from $UPSTREAM (not fast-forward) — branching from local HEAD; resolve manually if needed"
        fi
      fi
    fi
  else
    echo "BASE: fetch $REMOTE failed (no network or auth) — branching from local $DEFAULT"
  fi
fi
# No upstream → silent, worktree branches from local HEAD

# Create worktree from local $DEFAULT — bypasses worktree.baseRef setting
git -C "$main_root" worktree add -b "$WT_NAME" "$WT_PATH" "$DEFAULT"
```

Outcome matrix:

| Situation                      | Action                             | Output                                                                        |
| ------------------------------ | ---------------------------------- | ----------------------------------------------------------------------------- |
| No upstream (local-only repo)  | `worktree add` from local main     | (silent)                                                                      |
| Local == origin                | fetch, no pull needed              | (silent)                                                                      |
| Local behind origin (ancestor) | fetch + ff-only pull               | `BASE: pulled main from origin/main (3 commits)`                              |
| Local ahead of origin          | fetch, pull no-op, log local-ahead | `BASE: local main is 15 commits ahead of origin/main — local merges included` |
| Local diverged from origin     | fetch, ff-only fails               | `BASE: local main diverged from origin/main …`                                |
| Fetch fails (network/auth)     | `worktree add` from local main     | `BASE: fetch origin failed — branching from local main`                       |

Then `EnterWorktree(path: "$WT_PATH")` — enters the already-created worktree. Using `path:` bypasses `worktree.baseRef` since the branch and directory already exist.

#### Step 3: Set up shared `.project/` and verify — one Bash call

After `EnterWorktree` (or Destroy→recreate), run symlink setup + integrity check + gate + session file in **a single Bash block** (combine `shared/WORKTREE.md → Shared .project/ via symlink`, `shared/WORKTREE.md → Verify symlink integrity`, and the skill's gate/session-file commands to minimise round-trips):

```bash
# Example for dev-ship's build phase — adapt session payload per skill
WT="{main_root}/.claude/worktrees/{feature-name}"
MP="{main_root}/.project"

mkdir -p "$WT/.project/session"
rm -f "$WT/.project/.project"
rm -f "$WT/.project/backlog.json"
rm -rf "$WT/.project/features" "$WT/.project/wireframes" "$WT/.project/screenshots" "$WT/.project/thinking"
rm -f "$WT/.project/project.json" "$WT/.project/project-context.json"
ln -sfn "$MP/backlog.json"         "$WT/.project/backlog.json"
ln -sfn "$MP/features"             "$WT/.project/features"
ln -sfn "$MP/wireframes"           "$WT/.project/wireframes"
ln -sfn "$MP/screenshots"          "$WT/.project/screenshots"
ln -sfn "$MP/thinking"             "$WT/.project/thinking"
ln -sfn "$MP/project.json"         "$WT/.project/project.json"
ln -sfn "$MP/project-context.json" "$WT/.project/project-context.json"

# Integrity check
FAILED=()
for f in backlog.json features project.json project-context.json; do
  { [ -L "$WT/.project/$f" ] && [ -e "$WT/.project/$f" ]; } || FAILED+=("$f")
done
[ ${#FAILED[@]} -gt 0 ] && echo "ERROR: symlinks failed: ${FAILED[*]}" && exit 1
echo "GATE: ok — .project/ symlinks intact"

# Gate: verify inside worktree
[[ "$(pwd)" == *"/.claude/worktrees/{feature-name}" ]] && echo "GATE: ok — inside worktree" || echo "ABORT: not inside worktree"

# Session file (main-root, never $WT — .project/session/ is worktree-local, not symlinked)
echo '{"skill":"{skill-name}"}' | node ~/.claude/scripts/ship-checkpoint.js signal {feature-name}
```

#### Step 4: Continue with skill PHASE 0

Proceed with the rest of the skill's PHASE 0 (display overview, risk check, etc.).

## Skip Auto-create when

- **No feature-name**: project/backlog/seed skills — no branch-key available
- **Already in a worktree**: detected in Step 1 of auto-create procedure
- **Batch/codebase-mode**: no single feature scoped

## Cleanup

Neither auto-create procedure removes worktrees. Use `/core-finalize` (delegates to `shared/FINALIZE.md → Cleanup Procedure`) for the canonical flow — it includes pre-remove cwd-check, cwd-switch to main root, and post-remove residue detection.

Manual fallback (only when `/core-finalize` is unavailable — does **not** include the full hardening, may leave orphan directory):

```bash
cd "{main_root}"  # ensure shell is out of the worktree
git worktree remove --force "{worktree_path}"
git branch -D worktree-{feature}
[ -d "{worktree_path}" ] && rmdir "{worktree_path}" 2>/dev/null \
  || echo "Manual cleanup needed: rmdir {worktree_path} (close shells holding cwd first)"
```

The symlinked `.project/` paths are plain filesystem links — removing the worktree directory removes them too. No extra cleanup needed for the symlinks.
