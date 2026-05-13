---
name: core-bootstrap
description: >-
  Bootstrap user-level ~/.claude/ (CLAUDE.md, settings.json, keybindings,
  statusline) + global symlinks/junctions to the claude-config repo. One-time
  per machine — idempotent, skips files that already exist unless --force. Use with
  /core-bootstrap.
argument-hint: "[--force]"
metadata:
  author: claude-config
  version: 1.1.0
  category: core
---

# Core Bootstrap Skill

**Trigger**: `/core-bootstrap [--force]`

Bootstrap of the user-global Claude Code configuration. Deploys 4 user-files to `~/.claude/` and creates 4 global symlinks/junctions. One-time per machine after cloning the claude-config repo.

`--force`: overwrites existing user-files (PHASE 1). Symlinks are always idempotent via `ln -sfn` / pre-check.

---

## PHASE 0: Pre-flight

Resolve `CONFIG_REPO` — the root of the cloned claude-config repo:

```bash
# macOS/Linux — follow symlink of ~/.claude/skills if it already exists
if [ -L "$HOME/.claude/skills" ]; then
  CONFIG_REPO="$(realpath "$HOME/.claude/skills/..")"
else
  # Fallback: current working directory if it is the repo
  CONFIG_REPO="$(pwd)"
fi
```

```powershell
# Windows
if (Test-Path "$env:USERPROFILE\.claude\skills" -PathType Container) {
  $CONFIG_REPO = Split-Path (Resolve-Path "$env:USERPROFILE\.claude\skills") -Parent
} else {
  $CONFIG_REPO = (Get-Location).Path
}
```

Validate that `$CONFIG_REPO/local/` exists. If not:

> `Cannot find local/. Run /core-bootstrap from the claude-config repo directory, or ensure ~/.claude/skills already symlinks to the repo.`

Stop.

Parse `--force` flag: if present, store `FORCE=true`.

Check `jq` availability (advisory only — does not stop execution):

```bash
command -v jq >/dev/null 2>&1 || echo "warn: jq not found — settings overlay merge will be skipped if personal/settings.overlay.json is present"
```

### Language selection

Check whether `~/.claude/CLAUDE.md` already contains a `Language:` setting:

```bash
grep -q "Language:" "$HOME/.claude/CLAUDE.md" 2>/dev/null && echo "found" || echo "not-found"
```

If `Language:` is found **and** `FORCE` is not set → store `LANGUAGE_CHOICE=skip` (language step skipped).

If `Language:` is not found **or** `FORCE=true` → ask:

```yaml
header: "Language"
question: "Which language should Claude use for output?"
options:
  - label: "English (Recommended)"
    description: "Claude responds in English"
  - label: "Nederlands"
    description: "Claude responds in Dutch"
  - label: "Deutsch"
    description: "Claude antwortet auf Deutsch"
  - label: "Français"
    description: "Claude répond en français"
  - label: "Español"
    description: "Claude responde en español"
multiSelect: false
```

Store the chosen label in `LANGUAGE_CHOICE` (e.g. `"Nederlands"`). If the user selects "English (Recommended)" → `LANGUAGE_CHOICE=skip` (template default, no patch needed).

---

## PHASE 1: Copy user-files

Copy 4 files to `~/.claude/`. **Skip if the destination already exists** unless `FORCE=true`. Create `~/.claude/` if it is missing.

Report the outcome per file (for the PHASE 3 report):

| File                   | Source                                      | Destination                        |
| ---------------------- | ------------------------------------------- | ---------------------------------- |
| CLAUDE.md              | `$CONFIG_REPO/local/CLAUDE.md.base`         | `~/.claude/CLAUDE.md`              |
| settings.json          | `$CONFIG_REPO/local/settings.json.template` | `~/.claude/settings.json`          |
| keybindings.json       | `$CONFIG_REPO/local/keybindings.json`       | `~/.claude/keybindings.json`       |
| statusline-command.cjs | `$CONFIG_REPO/local/statusline-command.cjs` | `~/.claude/statusline-command.cjs` |

```bash
# macOS/Linux
CLAUDE_DIR="$HOME/.claude"
mkdir -p "$CLAUDE_DIR"
LOCAL="$CONFIG_REPO/local"

declare -A FILES=(
  ["CLAUDE.md"]="$LOCAL/CLAUDE.md.base"
  ["settings.json"]="$LOCAL/settings.json.template"
  ["keybindings.json"]="$LOCAL/keybindings.json"
  ["statusline-command.cjs"]="$LOCAL/statusline-command.cjs"
)

for dest_name in "${!FILES[@]}"; do
  src="${FILES[$dest_name]}"
  dest="$CLAUDE_DIR/$dest_name"
  if [ ! -f "$dest" ] || [ "$FORCE" = "true" ]; then
    cp "$src" "$dest"
    # STATUS: placed (or forced-overwrite when FORCE)
  else
    : # STATUS: already-exists
  fi
done
```

```powershell
# Windows
$claudeDir = "$env:USERPROFILE\.claude"
New-Item -ItemType Directory -Force -Path $claudeDir | Out-Null
$local = "$CONFIG_REPO\local"

$files = @{
  "CLAUDE.md"               = "$local\CLAUDE.md.base"
  "settings.json"           = "$local\settings.json.template"
  "keybindings.json"        = "$local\keybindings.json"
  "statusline-command.cjs"  = "$local\statusline-command.cjs"
}

foreach ($destName in $files.Keys) {
  $src  = $files[$destName]
  $dest = "$claudeDir\$destName"
  if (-not (Test-Path $dest) -or $FORCE) {
    Copy-Item $src $dest
    # STATUS: placed (or forced-overwrite when FORCE)
  } else {
    # STATUS: already-exists
  }
}
```

### Language patch

After copying CLAUDE.md (only if it was actually placed or force-overwritten, and `LANGUAGE_CHOICE` is not `skip`):

Locate the `Language:` line in `~/.claude/CLAUDE.md` and replace the value with `LANGUAGE_CHOICE`.

```bash
# macOS/Linux — replace Language: line in-place
sed -i '' "s/^Language:.*$/Language: $LANGUAGE_CHOICE/" "$HOME/.claude/CLAUDE.md"
```

```powershell
# Windows
(Get-Content "$env:USERPROFILE\.claude\CLAUDE.md") -replace '^Language:.*$', "Language: $LANGUAGE_CHOICE" |
  Set-Content "$env:USERPROFILE\.claude\CLAUDE.md"
```

**After copying**: show a brief reminder:

> `settings.json copied — verify that hook paths are correct for your platform (see local/README.md).`

Show this reminder only if settings.json was actually placed or overwritten.

---

## PHASE 1.5: Personal overlay

Apply user-specific customisations from `$CONFIG_REPO/personal/` (gitignored, optional).

```bash
# macOS/Linux
PERSONAL_DIR="$CONFIG_REPO/personal"
if [ -d "$PERSONAL_DIR" ]; then
  OVERLAY_COUNT=0

  # 1. CLAUDE.md overlay — append to base
  if [ -f "$PERSONAL_DIR/CLAUDE.md.overlay" ]; then
    cat "$PERSONAL_DIR/CLAUDE.md.overlay" >> "$HOME/.claude/CLAUDE.md"
    OVERLAY_COUNT=$((OVERLAY_COUNT + 1))
  fi

  # 2. settings.overlay.json — deep-merge (right-wins) via jq
  if [ -f "$PERSONAL_DIR/settings.overlay.json" ]; then
    if command -v jq >/dev/null 2>&1; then
      jq -s '.[0] * .[1]' "$HOME/.claude/settings.json" "$PERSONAL_DIR/settings.overlay.json" \
        > "$HOME/.claude/settings.json.tmp" && mv "$HOME/.claude/settings.json.tmp" "$HOME/.claude/settings.json"
      OVERLAY_COUNT=$((OVERLAY_COUNT + 1))
    else
      echo "warn: jq not found — skipping settings overlay merge"
    fi
  fi

  # 3. styles/ — symlink to ~/.claude/styles/
  if [ -d "$PERSONAL_DIR/styles" ]; then
    ln -sfn "$PERSONAL_DIR/styles" "$HOME/.claude/styles"
    OVERLAY_COUNT=$((OVERLAY_COUNT + 1))
  fi

  # STATUS: applied ($OVERLAY_COUNT items) if OVERLAY_COUNT > 0, else found-nothing
else
  # STATUS: not found (optional)
fi
```

```powershell
# Windows
$personalDir = "$CONFIG_REPO\personal"
$overlayCount = 0

if (Test-Path $personalDir) {
  # 1. CLAUDE.md overlay
  $overlay = "$personalDir\CLAUDE.md.overlay"
  if (Test-Path $overlay) {
    Get-Content $overlay | Add-Content "$env:USERPROFILE\.claude\CLAUDE.md"
    $overlayCount++
  }

  # 2. settings.overlay.json — deep-merge via jq
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

  # 3. styles/ — junction to ~/.claude/styles/
  $stylesDir = "$personalDir\styles"
  $stylesTarget = "$env:USERPROFILE\.claude\styles"
  if ((Test-Path $stylesDir) -and (-not (Test-Path $stylesTarget))) {
    cmd /c "mklink /J `"$stylesTarget`" `"$stylesDir`""
    $overlayCount++
  }

  # STATUS: applied ($overlayCount items) if $overlayCount > 0, else found-nothing
} else {
  # STATUS: not found (optional)
}
```

---

## PHASE 2: Global symlinks / junctions

Link 4 directories: `agents`, `hooks`, `skills`, `scripts`. Skip if the link already exists (`-e` check, no overwrite).

```bash
# macOS/Linux
for dir in agents hooks skills scripts; do
  target="$HOME/.claude/$dir"
  [ ! -e "$target" ] && ln -sfn "$CONFIG_REPO/$dir" "$target"
  # STATUS: linked (new) or already-exists
done
```

```powershell
# Windows
foreach ($dir in @("agents","hooks","skills","scripts")) {
  $target = "$env:USERPROFILE\.claude\$dir"
  if (-not (Test-Path $target)) {
    cmd /c "mklink /J `"$target`" `"$CONFIG_REPO\$dir`""
    # STATUS: linked (new)
  } else {
    # STATUS: already-exists
  }
}
```

---

## PHASE 3: Report

Show ASCII table with outcome per item:

```
Bootstrap complete
══════════════════════════════════════════════════════
 Item                      Status
──────────────────────────────────────────────────────
 ~/.claude/CLAUDE.md        placed
 ~/.claude/settings.json    already-exists
 ~/.claude/keybindings.json already-exists
 ~/.claude/statusline-…     placed
 ~/.claude/agents/          linked
 ~/.claude/hooks/           already-exists
 ~/.claude/skills/          already-exists
 ~/.claude/scripts/         already-exists
 Personal overlay           applied (2 items)
 Language                   English
══════════════════════════════════════════════════════
```

Statuses: `placed` · `already-exists` · `forced-overwrite` · `linked` · `error: <reason>`

For the Language row: show the chosen language, or `skipped (already set)` if `LANGUAGE_CHOICE=skip`.

For the Personal overlay row:

- `personal/` does not exist → `not found (optional)`
- `personal/` exists, `OVERLAY_COUNT > 0` → `applied (N items)`
- `personal/` exists, `OVERLAY_COUNT = 0` → `found, nothing to apply`

Closing tip (always show):

> Next step: open a project and run `/core-setup` for project-internal setup.
> To stay current with claude-config updates later: run `/core-update`.
