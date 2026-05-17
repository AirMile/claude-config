# Worktree Boilerplate

Two procedures used in pipeline skills:

- **Auto-create** — used in PHASE 0 of build/convert/fix skills. Automatically creates a worktree for a feature when none exists yet. Replaces the "Do you want to work in a worktree?" AskUserQuestion.
- **Switch** — used in PHASE 0 of verify/debug/refactor/check skills. Detects and switches into an existing worktree for the active feature.

---

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

#### Step 2: Collision check

Check whether a worktree/branch already exists for this feature:

```bash
# macOS/Linux
git show-ref --verify --quiet "refs/heads/worktree-{feature-name}"
test -e "{main_root}/.claude/worktrees/{feature-name}"

# Windows (PowerShell)
git show-ref --verify --quiet "refs/heads/worktree-{feature-name}"
Test-Path "{main_root}\.claude\worktrees\{feature-name}"
```

**If branch OR directory exists** — check clean state first:

```bash
WT_PATH="{main_root}/.claude/worktrees/{feature-name}"

# macOS/Linux
BRANCH_OK=$(cd "$WT_PATH" 2>/dev/null && [ "$(git branch --show-current)" = "worktree-{feature-name}" ] && echo yes || echo no)
DIRTY=$(cd "$WT_PATH" 2>/dev/null && git status --porcelain | head -1)
SYMLINK_OK=$(
  test -L "$WT_PATH/.project/backlog.html" && test -e "$WT_PATH/.project/backlog.html" &&
  test -L "$WT_PATH/.project/features"     && test -e "$WT_PATH/.project/features" &&
  echo yes || echo no
)
```

```powershell
# Windows (PowerShell)
$branchOk = if (Test-Path "$WT_PATH") {
  Push-Location "$WT_PATH"; $b = git branch --show-current; Pop-Location
  if ($b -eq "worktree-{feature-name}") { "yes" } else { "no" }
} else { "no" }
$dirty = if (Test-Path "$WT_PATH") {
  Push-Location "$WT_PATH"; $d = git status --porcelain | Select-Object -First 1; Pop-Location; $d
} else { "?" }
$symlinkOk = if ((Test-Path "$WT_PATH\.project\backlog.html") -and (Test-Path "$WT_PATH\.project\features")) { "yes" } else { "no" }
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

# macOS/Linux
UNCOMMITTED=$(cd "$WT_PATH" 2>/dev/null && git status --porcelain | wc -l | tr -d ' ' || echo "?")
UNMERGED=$(git log "{default_branch}..worktree-{feature-name}" --oneline 2>/dev/null | wc -l | tr -d ' ' || echo "?")
LAST_COMMIT=$(git log -1 --format='%cr' "worktree-{feature-name}" 2>/dev/null || echo "unknown")

# Windows: replace `wc -l` with `( | Measure-Object -Line).Lines`
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

**If no collision** → `EnterWorktree(name: "{feature-name}")` → creates `{main_root}/.claude/worktrees/{feature-name}` with branch `worktree-{feature-name}`.

#### Step 3: Set up shared `.project/` (see section below)

After `EnterWorktree` (or Destroy→recreate), follow `## Shared .project/ via symlink` to wire the new worktree's `.project/` to main.

#### Step 4: Continue with skill PHASE 0

Proceed with the rest of the skill's PHASE 0 (backlog tag, session file, etc.).

---

## Shared .project/ via symlink

Run once after a worktree is first created (Step 3 of auto-create). Makes backlog/features/project state visible in main checkout while the worktree is open. `.project/session/` stays worktree-local.

### What to share

| Path                            | Share?  | Reason                                                                                            |
| ------------------------------- | ------- | ------------------------------------------------------------------------------------------------- |
| `.project/backlog.html`         | **Yes** | Status updates (DOING, DONE) visible on main instantly                                            |
| `.project/features/`            | **Yes** | `feature.json` readable from both checkouts                                                       |
| `.project/project.json`         | **Yes** | Design spec, theme, routing — project-wide                                                        |
| `.project/project-context.json` | **Yes** | Learnings, architecture — project-wide                                                            |
| `.project/wireframes/`          | **Yes** | Design artifacts — not code, not session-bound                                                    |
| `.project/screenshots/`         | **Yes** | Audit artifacts — not session-bound                                                               |
| `.project/thinking/`            | **Yes** | Research output — not session-bound                                                               |
| `.project/session/`             | **No**  | Skill-state per worktree (`active-{feature}.json`, `pre-debug-status.txt`, `design-history.json`) |

### Procedure

```bash
WT="{main_root}/.claude/worktrees/{feature-name}"
MP="{main_root}/.project"

# macOS/Linux — ensure .project dir exists in worktree, then symlink shared paths
mkdir -p "$WT/.project/session"

# Remove any ad-hoc nested symlink (.project/.project) that a prior session may have created
rm -f "$WT/.project/.project"

rm -f "$WT/.project/backlog.html"
rm -rf "$WT/.project/features" "$WT/.project/wireframes" \
       "$WT/.project/screenshots" "$WT/.project/thinking"
rm -f "$WT/.project/project.json" "$WT/.project/project-context.json"

ln -sfn "$MP/backlog.html"          "$WT/.project/backlog.html"
ln -sfn "$MP/features"              "$WT/.project/features"
ln -sfn "$MP/wireframes"            "$WT/.project/wireframes"
ln -sfn "$MP/screenshots"           "$WT/.project/screenshots"
ln -sfn "$MP/thinking"              "$WT/.project/thinking"
ln -sfn "$MP/project.json"          "$WT/.project/project.json"
ln -sfn "$MP/project-context.json"  "$WT/.project/project-context.json"

# Assert: all required symlinks must resolve — fail loudly instead of silently passing with broken links
WIRE_FAILED=()
for f in backlog.html features project.json project-context.json; do
  if ! { [ -L "$WT/.project/$f" ] && [ -e "$WT/.project/$f" ]; }; then
    WIRE_FAILED+=("$f")
  fi
done
if [ ${#WIRE_FAILED[@]} -ne 0 ]; then
  echo "ERROR: symlink wire-up failed for: ${WIRE_FAILED[*]}"
  echo "Check permissions on $WT/.project/ and that $MP exists."
  exit 1
fi
```

```powershell
# Windows (PowerShell) — Junction for directories, SymbolicLink for files (requires Developer Mode or admin)
$WT  = "{main_root}\.claude\worktrees\{feature-name}"
$MP  = "{main_root}\.project"

# Developer Mode pre-check (file symlinks require Developer Mode or admin)
$devModeKey  = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock"
$devModeProp = Get-ItemProperty -Path $devModeKey -Name "AllowDevelopmentWithoutDevLicense" -ErrorAction SilentlyContinue
$devModeOn   = $devModeProp -and $devModeProp.AllowDevelopmentWithoutDevLicense -eq 1

if (-not $devModeOn) {
  Write-Warning @"
Developer Mode is uit — file symlinks vallen terug op COPY-mode.
Effect: backlog.html, project.json, project-context.json zijn NIET shared
tussen main en worktree. Status updates vanuit worktree zijn niet direct
zichtbaar op main checkout.

Enable: Settings -> Privacy & Security -> For developers -> Developer Mode (ON).
Daarna deze skill opnieuw uitvoeren voor echte symlinks.
"@
}

New-Item -Force -ItemType Directory "$WT\.project\session" | Out-Null

# Directories → Junction (no elevated rights needed)
foreach ($dir in @("features","wireframes","screenshots","thinking")) {
  if (Test-Path "$WT\.project\$dir") { Remove-Item -Recurse -Force "$WT\.project\$dir" }
  New-Item -ItemType Junction -Path "$WT\.project\$dir" -Target "$MP\$dir" | Out-Null
}

# Files → SymbolicLink (needs Developer Mode)
foreach ($file in @("backlog.html","project.json","project-context.json")) {
  if (Test-Path "$WT\.project\$file") { Remove-Item -Force "$WT\.project\$file" }
  try {
    New-Item -ItemType SymbolicLink -Path "$WT\.project\$file" -Target "$MP\$file" | Out-Null
  } catch {
    Write-Warning "Symlink for $file failed (Developer Mode required). Using copy fallback — .project/$file will diverge."
    Copy-Item "$MP\$file" "$WT\.project\$file"
  }
}
```

**Caveat**: if main's `.project/backlog.html` does not exist yet (fresh project), `ln -sfn` creates a dangling symlink — this resolves itself as soon as the first backlog write happens on main. Skills check for file existence before reading, so a dangling symlink is safe.

### Verify symlink integrity

After Step 3 completes (and on every silent-reuse path), verify all expected symlinks resolve. Idempotent — re-running repairs broken links.

```bash
# macOS/Linux
WT="{main_root}/.claude/worktrees/{feature-name}"
EXPECTED=("backlog.html" "features" "wireframes" "screenshots" "thinking" "project.json" "project-context.json")
FAILED=()
for name in "${EXPECTED[@]}"; do
  link="$WT/.project/$name"
  if [ ! -L "$link" ] || [ ! -e "$link" ]; then
    FAILED+=("$name")
  fi
done
if [ ${#FAILED[@]} -gt 0 ]; then
  echo "ERROR: symlink integrity check failed for: ${FAILED[*]}"
  echo "Re-run ## Shared .project/ via symlink. If failure persists, check permissions on $WT/.project/"
  exit 1
fi
echo "SYMLINKS: ok (7/7)"
```

```powershell
# Windows
$WT = "{main_root}\.claude\worktrees\{feature-name}"
$expected = @("backlog.html","features","wireframes","screenshots","thinking","project.json","project-context.json")
$failed = @()
foreach ($name in $expected) {
  if (-not (Test-Path "$WT\.project\$name")) { $failed += $name }
}
if ($failed.Count -gt 0) {
  Write-Error "Symlink integrity check failed for: $($failed -join ', ')"
  exit 1
}
Write-Output "SYMLINKS: ok (7/7)"
```

On Windows with Developer Mode off, file entries are copies — `Test-Path` returns `true` for both. Directory junctions always work.

---

## Switch into existing worktree

Used in PHASE 0 of pipeline skills that operate on a single feature (verify, debug, refactor single-mode). Skip in batch/codebase modes.

### Why

Pipeline skills run in separate chats. When `dev-build` (or `game-build`) creates a worktree, follow-up skills start in main-checkout — not in the worktree where the code lives. This boilerplate detects an existing worktree for the active feature and switches into it automatically.

The worktree path is predictable: `{repo-root}/.claude/worktrees/{feature-name}`. The branch name is `worktree-{feature-name}` (auto-prefixed by `EnterWorktree`).

### Skip the entire procedure if

- **feature-name is not known** (e.g. debug skill called without active feature context)
- **skill is in batch-mode** (refactor with `feature_queue.length > 1`)
- **skill is in codebase-mode** (refactor on full codebase, not feature-bound)

In skip cases: do not run any of the steps below. Continue the calling skill's PHASE 0 on the current branch.

### Procedure

Run after the feature-name is known. Before any state-mutating operations (backlog tag updates, session-file writes, commits).

#### Step 0: Prune stale registrations

```bash
git worktree prune
```

Run once before any `git worktree list` read. Idempotent and cheap (~10 ms). Removes orphan registrations where the worktree directory was deleted manually outside git (e.g. `rm -rf .claude/worktrees/foo`). Without this, `git worktree list` still shows the stale path, causing false positives in Step 4.

#### Step 1: Determine main repo root

The first entry in `git worktree list --porcelain` is always the main checkout, regardless of where the current session is running.

```bash
main_root=$(git worktree list --porcelain | head -1 | awk '{print $2}')
```

#### Step 2: Compute expected worktree path

```
expected_path = "{main_root}/.claude/worktrees/{feature-name}"
```

#### Step 3: Read current state

- `current_root = git rev-parse --show-toplevel`
- `registered = expected_path appears in git worktree list --porcelain`

#### Step 4: Decide and act

| current_root       | registered | Action                                                                                                                                                                                       |
| ------------------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| == `expected_path` | yes        | **Skip** — already in the right worktree                                                                                                                                                     |
| == `main_root`     | yes        | Call `EnterWorktree(path: expected_path)` to switch                                                                                                                                          |
| other worktree     | yes        | **FAIL** — print: "You are in worktree {pwd}, this skill is for feature {feature-name}. Exit first via ExitWorktree(action: keep) and restart."                                              |
| == `main_root`     | no         | If caller provides `feature.status === "DOING"` → **WARN + AskUserQuestion** (see Step 4a). Otherwise → **Continue** silently — no worktree was used for this feature, run on current branch |
| == `expected_path` | no         | **Continue cautiously** — pwd matches but not registered (rare race condition)                                                                                                               |

#### Step 4.5: Repair shared `.project/` (idempotent)

When `EnterWorktree` was just called in Step 4 (i.e. `current_root` changed to `expected_path`), immediately follow `## Shared .project/ via symlink` to re-wire the symlinks before the calling skill's PHASE 0 continues. The wire-up is fully idempotent — `ln -sfn` overwrites stale copies, `rm -f`/`rm -rf` of file-copies is safe. **Skip if** `current_root` was already `expected_path` at the start of Step 4 (no switch occurred) AND the verify-block in `### Verify symlink integrity` passes.

This ensures that any skill using Switch finds healthy symlinks before its first backlog write, even if a prior session (or a `/core-pull` run inside the worktree) silently destroyed them.

#### Step 4a: DOING-without-worktree warning

Triggers when: caller passed `feature.status === "DOING"`, `current_root == main_root`, no `worktree-{feature-name}` branch exists.

Interpretation: the feature was built without isolation — `/dev-build` likely silently fell back to main (worktree step skipped or bypassed). Build commits live on the current branch, not on an isolated `worktree-{feature-name}` branch. Recoverable, but worth flagging.

Print:

```
⚠ ANOMALY: feature "{feature-name}" is DOING but has no worktree branch.
  /dev-build likely skipped the isolation step.
  Build commits are on current branch ({current-branch-name}), not isolated.
```

Then AskUserQuestion:

```yaml
header: "DOING without worktree"
question: "How do you want to proceed?"
options:
  - label: "Continue on current branch (Recommended)"
    description: "Run verify in-place — no isolation, but matches actual state."
  - label: "Stop — fix isolation manually first"
    description: "Exit so you can retroactively stage a worktree before verify."
multiSelect: false
```

- **Continue** → proceed to Step 5
- **Stop** → exit skill. Print: `Hint: ask Claude to retroactively stage a worktree for "{feature-name}", then restart /dev-verify.`

#### Step 5: Continue with skill PHASE 0

After successful switch (or skip, or warn-continue), proceed with the rest of the skill's PHASE 0.

---

## Caveats

### Branch naming

`EnterWorktree(name: "auth")` creates branch `worktree-auth`, NOT `auth`. For merge / cleanup commands (e.g. `git branch -D worktree-auth`), use the prefixed name. The `core-finalize` skill handles this automatically, including `worktree-auth-{suffix}` variants from the Rename path.

### Skip conditions

Skip the entire **Switch** procedure when:

- **Refactor batch-mode**: feature queue contains multiple features OR codebase-mode selected
- **Refactor codebase-mode**: not feature-bound, runs on main
- **No active feature**: e.g. debug skill called without context — run standalone

Skip **Auto-create** when:

- **No feature-name**: project/backlog/seed skills — no branch-key available
- **Already in a worktree**: detected in Step 1 of auto-create procedure
- **Batch/codebase-mode**: no single feature scoped

### Cleanup

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

### Windows file symlinks

`New-Item -ItemType SymbolicLink` for files requires Windows Developer Mode (Settings → Privacy & Security → Developer Mode) or admin rights. If unavailable, the fallback copies the files — they will diverge between main and worktree. The warning message makes this explicit. Directory junctions (`-ItemType Junction`) work without elevated rights.

### core-pull on a worktree

`/core-pull` resets `.project/` via `git checkout -- .project/` (PHASE 0, step 1). This destroys symlinks. Run `/core-pull` only on the main checkout, not inside a worktree.
