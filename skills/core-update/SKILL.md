---
name: core-update
description: Pull latest claude-config and rebuild ~/.claude/ files. Use with /core-update.
metadata:
  author: claude-config
  version: 1.0.0
  category: core
---

# Core Update

Pull the latest claude-config and rebuild the composed global files.

**Trigger**: `/core-update`

---

## PHASE 0: Pre-flight

Resolve `CONFIG_REPO` — same logic as core-bootstrap:

```bash
# macOS/Linux
if [ -L "$HOME/.claude/skills" ]; then
  CONFIG_REPO="$(realpath "$HOME/.claude/skills/..")"
else
  echo "error: ~/.claude/skills symlink not found. Run /core-bootstrap first." && exit 1
fi
```

```powershell
# Windows
if (Test-Path "$env:USERPROFILE\.claude\skills" -PathType Container) {
  $CONFIG_REPO = Split-Path (Resolve-Path "$env:USERPROFILE\.claude\skills") -Parent
} else {
  Write-Error "~\.claude\skills junction not found. Run /core-bootstrap first."
  exit 1
}
```

Validate `$CONFIG_REPO` is a git repo:

```bash
git -C "$CONFIG_REPO" rev-parse --git-dir >/dev/null 2>&1 || \
  { echo "error: $CONFIG_REPO is not a git repository." && exit 1; }
```

Check `jq` availability (advisory only):

```bash
command -v jq >/dev/null 2>&1 || echo "warn: jq not found — settings overlay merge will be skipped"
```

Check for active git operations (rebase/merge/cherry-pick):

```bash
ls "$CONFIG_REPO/.git/rebase-merge" \
   "$CONFIG_REPO/.git/rebase-apply" \
   "$CONFIG_REPO/.git/MERGE_HEAD" \
   "$CONFIG_REPO/.git/CHERRY_PICK_HEAD" 2>/dev/null
```

If any found → stop:

> `Active git operation detected in claude-config repo. Resolve it first (git rebase --continue / --abort), then re-run /core-update.`

Capture current `Language:` from `~/.claude/CLAUDE.md` before any overwrite:

```bash
# macOS/Linux
CURRENT_LANG=$(grep "^Language:" "$HOME/.claude/CLAUDE.md" 2>/dev/null | sed 's/^Language: //')
[ -z "$CURRENT_LANG" ] && CURRENT_LANG="English"
```

```powershell
# Windows
$currentLang = (Select-String -Path "$env:USERPROFILE\.claude\CLAUDE.md" -Pattern "^Language:" |
  Select-Object -First 1).Line -replace "^Language: ", ""
if (-not $currentLang) { $currentLang = "English" }
```

---

## PHASE 1: Git status

Detect branch and upstream:

```bash
# macOS/Linux
BRANCH=$(git -C "$CONFIG_REPO" rev-parse --abbrev-ref HEAD)
UPSTREAM=$(git -C "$CONFIG_REPO" rev-parse --abbrev-ref @{u} 2>/dev/null || echo "")
[ -z "$UPSTREAM" ] && echo "warn: no upstream configured for branch $BRANCH — pull may fail"
```

```powershell
# Windows
$branch = git -C $CONFIG_REPO rev-parse --abbrev-ref HEAD
$upstream = git -C $CONFIG_REPO rev-parse --abbrev-ref "@{u}" 2>$null
if (-not $upstream) { Write-Warning "No upstream configured for branch $branch — pull may fail" }
```

Check dirty working tree:

```bash
git -C "$CONFIG_REPO" status --porcelain
```

If dirty → **AskUserQuestion**:

- header: "Uncommitted changes"
- question: "claude-config has uncommitted changes. What would you like to do?"
- options:
  - label: "Stash (Recommended)", description: "Stash changes, pull, then re-apply"
  - label: "Cancel", description: "Stop — I'll handle this myself"
- multiSelect: false

On **Stash**: `git -C "$CONFIG_REPO" stash push -u -m "core-update auto-stash"`. Continue with PHASE 2. After successful pull: `git -C "$CONFIG_REPO" stash apply`. On apply success → `git -C "$CONFIG_REPO" stash drop`. On conflict → report ("Stash conflict after pull — resolve manually with `git stash list`") and continue with rebuild anyway.

On **Cancel** → exit.

Store pre-pull ref:

```bash
PRE_REF=$(git -C "$CONFIG_REPO" rev-parse HEAD)
```

---

## PHASE 2: Git pull

Fetch first (fail-fast on network issues):

```bash
git -C "$CONFIG_REPO" fetch 2>&1
```

If fetch fails → stop:

> `Fetch failed — check network connection or remote access. ~/.claude/ was not modified.`

Pull:

```bash
git -C "$CONFIG_REPO" pull --rebase
```

If conflicts → show conflicting files, stop:

> `Pull resulted in conflicts. Resolve with \`git rebase --continue\` or \`--abort\`, then re-run /core-update.`

Store post-pull ref and count pulled commits:

```bash
POST_REF=$(git -C "$CONFIG_REPO" rev-parse HEAD)
COMMITS_PULLED=$(git -C "$CONFIG_REPO" rev-list --count "$PRE_REF".."$POST_REF")
```

Detect which config files changed in this pull:

```bash
CHANGED_LOCAL=$(git -C "$CONFIG_REPO" diff --name-only "$PRE_REF" "$POST_REF" -- local/ 2>/dev/null | wc -l | tr -d ' ')
CHANGED_SKILLS=$(git -C "$CONFIG_REPO" diff --name-only "$PRE_REF" "$POST_REF" -- skills/ agents/ hooks/ 2>/dev/null | wc -l | tr -d ' ')
```

If stashed in PHASE 1: `git -C "$CONFIG_REPO" stash apply` now. On apply success → `git -C "$CONFIG_REPO" stash drop`. On conflict → report and continue.

---

## PHASE 3: Rebuild composed files

Always rebuild, regardless of whether any `local/` files changed. This keeps composed files in sync even when the pull was "already up to date".

### 3a. Rebuild `~/.claude/CLAUDE.md`

```bash
# macOS/Linux
cp "$CONFIG_REPO/local/CLAUDE.md.base" "$HOME/.claude/CLAUDE.md"
sed -i.bak "s/^Language:.*$/Language: $CURRENT_LANG/" "$HOME/.claude/CLAUDE.md" && rm -f "$HOME/.claude/CLAUDE.md.bak"
```

```powershell
# Windows
Copy-Item "$CONFIG_REPO\local\CLAUDE.md.base" "$env:USERPROFILE\.claude\CLAUDE.md"
(Get-Content "$env:USERPROFILE\.claude\CLAUDE.md") -replace '^Language:.*$', "Language: $currentLang" |
  Set-Content "$env:USERPROFILE\.claude\CLAUDE.md"
```

### 3b. Rebuild `~/.claude/settings.json`

```bash
# macOS/Linux
cp "$CONFIG_REPO/local/settings.json.template" "$HOME/.claude/settings.json"
```

```powershell
# Windows
Copy-Item "$CONFIG_REPO\local\settings.json.template" "$env:USERPROFILE\.claude\settings.json"
```

### 3c. Rebuild `~/.claude/keybindings.json` and `~/.claude/statusline-command.cjs`

Simple overwrites — no merge needed, these files have no user customisation.

```bash
# macOS/Linux
cp "$CONFIG_REPO/local/keybindings.json" "$HOME/.claude/keybindings.json"
cp "$CONFIG_REPO/local/statusline-command.cjs" "$HOME/.claude/statusline-command.cjs"
```

```powershell
# Windows
Copy-Item "$CONFIG_REPO\local\keybindings.json" "$env:USERPROFILE\.claude\keybindings.json"
Copy-Item "$CONFIG_REPO\local\statusline-command.cjs" "$env:USERPROFILE\.claude\statusline-command.cjs"
```

### 3d. Apply personal overlay

```bash
# macOS/Linux
PERSONAL_DIR="$CONFIG_REPO/personal"
OVERLAY_COUNT=0

if [ -d "$PERSONAL_DIR" ]; then
  if [ -f "$PERSONAL_DIR/CLAUDE.md.overlay" ]; then
    cat "$PERSONAL_DIR/CLAUDE.md.overlay" >> "$HOME/.claude/CLAUDE.md"
    OVERLAY_COUNT=$((OVERLAY_COUNT + 1))
  fi

  if [ -f "$PERSONAL_DIR/settings.overlay.json" ]; then
    if command -v jq >/dev/null 2>&1; then
      jq -s '.[0] * .[1]' "$HOME/.claude/settings.json" "$PERSONAL_DIR/settings.overlay.json" \
        > "$HOME/.claude/settings.json.tmp" && mv "$HOME/.claude/settings.json.tmp" "$HOME/.claude/settings.json"
      OVERLAY_COUNT=$((OVERLAY_COUNT + 1))
    else
      echo "warn: jq not found — skipping settings overlay merge"
    fi
  fi

  # styles/ symlink: skip — already linked by /core-bootstrap, idempotent
fi
```

```powershell
# Windows
$personalDir = "$CONFIG_REPO\personal"
$overlayCount = 0

if (Test-Path $personalDir) {
  $overlay = "$personalDir\CLAUDE.md.overlay"
  if (Test-Path $overlay) {
    Get-Content $overlay | Add-Content "$env:USERPROFILE\.claude\CLAUDE.md"
    $overlayCount++
  }

  $settingsOverlay = "$personalDir\settings.overlay.json"
  if (Test-Path $settingsOverlay) {
    if (Get-Command jq -ErrorAction SilentlyContinue) {
      $merged = jq -s '.[0] * .[1]' "$env:USERPROFILE\.claude\settings.json" $settingsOverlay
      $merged | Set-Content "$env:USERPROFILE\.claude\settings.json"
      $overlayCount++
    } else {
      Write-Warning "jq not found — skipping settings overlay merge"
    }
  }
}
```

---

## PHASE 3.5: Project schema migration check

Detect projects still on the pre-v2 `.project/` schema (legacy marker: `backlog.html` exists, or `project.json` without `schemaVersion`):

```bash
ls -d {projects_root}/*/.project/backlog.html 2>/dev/null
```

- **No hits** → skip silently.
- **Hits** → AskUserQuestion: "Found {N} project(s) on the pre-v2 .project/ schema: {names}. Migrate now?" — "Yes, migrate all (Recommended)" / "Pick which" / "Skip". Per chosen project run:

  ```bash
  python3 "$CONFIG_REPO/scripts/migrate-project.py" {projects_root}/{name}
  ```

  The script is idempotent (re-runs are no-ops) and can also be run standalone at any time. Add the per-project result lines to the PHASE 4 report.

---

## PHASE 4: Report

```
Update complete
══════════════════════════════════════════════════════
 Item                          Status
──────────────────────────────────────────────────────
 Branch                        dev ← origin/dev
 Commits pulled                3
 Config files changed          2 (in local/)
 Skills / agents updated       7
 ~/.claude/CLAUDE.md           rebuilt
 ~/.claude/settings.json       rebuilt
 ~/.claude/keybindings.json    rebuilt
 ~/.claude/statusline-…        rebuilt
 Personal overlay              applied (2 items)
 Language                      Nederlands (preserved)
══════════════════════════════════════════════════════
```

- **Commits pulled**: show count. If 0 → "0 (already up to date)"
- **Config files changed**: count from PHASE 2 `CHANGED_LOCAL`. If 0 → "0 (no base changes)"
- **Skills / agents updated**: count from PHASE 2 `CHANGED_SKILLS`. If 0 → "0"
- **Personal overlay**: "applied (N items)" / "not found (optional)" / "found, nothing to apply"
- **Language**: show preserved value, e.g. `Nederlands (preserved)`
