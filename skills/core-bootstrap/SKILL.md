---
name: core-bootstrap
description: Bootstrap ~/.claude/ config, symlinks, and settings. Use with /core-bootstrap.
metadata:
  author: claude-config
  version: 1.3.0
  category: core
---

# Core Bootstrap Skill

**Trigger**: `/core-bootstrap`

Bootstrap of the user-global Claude Code configuration. Deploys 4 user-files to `~/.claude/` and creates 4 global symlinks/junctions. Fully idempotent — running again skips anything already in place, so it is always safe to re-run after a `git pull` or on a new machine. To replace a deployed file, delete it manually first, then re-run.

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

Check `jq` availability (advisory only — does not stop execution):

```bash
command -v jq >/dev/null 2>&1 || echo "warn: jq not found — settings overlay merge will be skipped if personal/settings.overlay.json is present"
```

### Language selection

Check whether `~/.claude/CLAUDE.md` already contains a `Language:` setting:

```bash
grep -q "Language:" "$HOME/.claude/CLAUDE.md" 2>/dev/null && echo "found" || echo "not-found"
```

If `Language:` is found → store `LANGUAGE_CHOICE=skip` (language step skipped — re-runs leave existing setting alone).

If `Language:` is not found → ask:

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

### Explanation Level selection

Check whether `~/.claude/CLAUDE.md` already contains an `Explanation Level:` setting:

```bash
grep -q "Explanation Level:" "$HOME/.claude/CLAUDE.md" 2>/dev/null && echo "found" || echo "not-found"
```

If `Explanation Level:` is found → store `EXPLANATION_CHOICE=skip` (step skipped — re-runs leave existing setting alone).

If `Explanation Level:` is not found → ask:

```yaml
header: "Explanation Level"
question: "How should Claude calibrate jargon and explanation depth by default?"
options:
  - label: "Intermediate (Recommended)"
    description: "Standard depth. Jargon ok, no extra scaffolding. Good default for most stacks."
  - label: "Beginner"
    description: "Every non-trivial term explained. Analogies always used. Good for stacks you're learning from scratch."
  - label: "Novice"
    description: "Framework-specific jargon explained. Analogies when helpful. Between Beginner and standard."
  - label: "Expert"
    description: "Compact. Assumes full stack familiarity. No term introductions or analogies."
multiSelect: false
```

Store the chosen label in `EXPLANATION_CHOICE` (e.g. `"Beginner"`). If the user selects "Intermediate (Recommended)" → `EXPLANATION_CHOICE=skip` (template default, no patch needed).

### Permission mode selection

`settings.json` is only copied when it does not already exist. Mirror that for this question — re-runs leave an existing permission posture alone:

```bash
[ -f "$HOME/.claude/settings.json" ] && echo "found" || echo "not-found"
```

If `~/.claude/settings.json` is found → store `PERM_CHOICE=skip` (already configured — don't touch it).

If not found → ask:

```yaml
header: "Permission mode"
question: "How should Claude handle tool permissions by default?"
options:
  - label: "Bypass permissions (Recommended)"
    description: "No permission prompts. Safe here because all skills run within guard rails (plan mode, security-reminder + format-on-save hooks, explicit handoff contracts)."
  - label: "Auto mode"
    description: "Claude's classifier auto-approves safe actions and prompts only on risky/irreversible ones."
multiSelect: false
```

Store the choice in `PERM_CHOICE`. If the user selects "Bypass permissions (Recommended)" → `PERM_CHOICE=skip` (template default: `bypassPermissions` + `disableAutoMode` + dangerous-mode dialog pre-accepted, no patch needed). If "Auto mode" → `PERM_CHOICE=auto` (patched in PHASE 1).

### Claude plan tier

Check `$CONFIG_REPO/.claude/paths.local.yaml` for a persisted value first:

```bash
# macOS/Linux
PLAN_TIER=""
if [ -f "$CONFIG_REPO/.claude/paths.local.yaml" ]; then
  PLAN_TIER=$(grep "claude_plan:" "$CONFIG_REPO/.claude/paths.local.yaml" | sed 's/.*claude_plan:[[:space:]]*//' | tr -d '"')
fi
```

```powershell
# Windows
$planTier = ""
$pathsLocal = "$CONFIG_REPO\.claude\paths.local.yaml"
if (Test-Path $pathsLocal) {
  $line = Select-String -Path $pathsLocal -Pattern "claude_plan:" | Select-Object -First 1
  if ($line) { $planTier = ($line.Line -replace '.*claude_plan:\s*"?([^"]+)"?.*', '$1').Trim() }
}
```

If `PLAN_TIER` is non-empty → skip the question (use persisted value, note it in PHASE 3 report as `<value> (saved)`).

If `PLAN_TIER` is empty → ask:

```yaml
header: "Claude plan"
question: "Which Claude plan are you on? (used to tailor the post-bootstrap tip)"
options:
  - label: "Max 5x"
    description: 'Tip: /model opusplan + effortLevel:"high" — Opus inside plan mode, Sonnet for execution'
  - label: "Pro"
    description: 'Tip: /model sonnet + effortLevel:"medium" — Opus quota is tight on Pro'
  - label: "Max 10x+"
    description: 'Tip: /model opus + effortLevel:"high" — quota headroom for full-Opus runs'
  - label: "Skip"
    description: "No plan-specific tip shown"
multiSelect: false
```

Store the choice in `PLAN_TIER` (one of `max-5x`, `pro`, `max-10x`, `skip`). Write to `paths.local.yaml` in PHASE 0.5 (see below).

---

## PHASE 0.5: Paths setup

Write per-machine path configuration to `$CONFIG_REPO/.claude/paths.local.yaml`. Idempotent — skip writing if the file already exists, but validate that its `projects_root` still points at an existing directory and offer to correct a stale path.

```bash
# macOS/Linux
PATHS_LOCAL="$CONFIG_REPO/.claude/paths.local.yaml"
if [ -f "$PATHS_LOCAL" ]; then
  PATHS_STATUS="already-exists"
  # Validate the configured projects_root still points at an existing directory.
  # A stale path (e.g. moved projects folder) leaves the backlog server scanning
  # nothing — correct it, but don't re-prompt when the path is fine (stays idempotent).
  cur=$(awk -F'"' '/^[[:space:]]*projects_root:/ {print $2; exit}' "$PATHS_LOCAL")
  exp="${cur/#\~/$HOME}"; exp="${exp/#\$HOME/$HOME}"
  if [ -n "$cur" ] && [ ! -d "$exp" ]; then
    # AskUserQuestion (open text input): projects_root "$cur" no longer exists —
    # ask for a new absolute path that must exist as a directory. Store in NEW_ROOT.
    sed -i '' 's|^\([[:space:]]*projects_root:\).*|\1 "'"$NEW_ROOT"'"|' "$PATHS_LOCAL"
    PATHS_STATUS="updated"
  fi
else
  # Ask the user via AskUserQuestion (open text input — no default, no fallback):
  #   header: "Projects root"
  #   question: "What is the absolute path to your projects root? This is where
  #              /project-add creates new projects and /project-switch navigates.
  #              Example: /Users/you/projects or /Users/you/Documents/Projects"
  # Validate: the path must exist as a directory. If not, re-ask.
  # Store input in PROJECTS_ROOT (no fallback — the user must answer).

  mkdir -p "$CONFIG_REPO/.claude"
  cat > "$PATHS_LOCAL" <<EOF
paths:
  projects_root: "$PROJECTS_ROOT"
  config_repo: "$CONFIG_REPO"
preferences:
  claude_plan: "$PLAN_TIER"
EOF
  PATHS_STATUS="written"
fi

# Backfill preferences block if file existed but predates plan-tier
if [ "$PATHS_STATUS" = "already-exists" ] && ! grep -q "claude_plan:" "$PATHS_LOCAL" 2>/dev/null; then
  printf '\npreferences:\n  claude_plan: "%s"\n' "$PLAN_TIER" >> "$PATHS_LOCAL"
fi
```

```powershell
# Windows
$pathsLocal = "$CONFIG_REPO\.claude\paths.local.yaml"
if (Test-Path $pathsLocal) {
  $pathsStatus = "already-exists"
  # Backfill preferences block if missing (old format)
  $content = Get-Content $pathsLocal -Raw
  if ($content -notmatch "claude_plan:") {
    Add-Content $pathsLocal "`npreferences:`n  claude_plan: `"$planTier`""
  }
  # Validate projects_root still exists; correct a stale path (don't re-prompt if fine).
  if ($content -match '(?m)^\s*projects_root:\s*"?([^"\r\n]+)"?') {
    $cur = $Matches[1].Trim().TrimEnd('"')
    if (-not (Test-Path $cur -PathType Container)) {
      # AskUserQuestion (open text input): projects_root "$cur" no longer exists —
      # ask for a new absolute path that must exist. Store in $newRoot.
      (Get-Content $pathsLocal -Raw) -replace '(?m)^(\s*projects_root:).*', "`$1 `"$newRoot`"" | Set-Content $pathsLocal
      $pathsStatus = "updated"
    }
  }
} else {
  # Ask the user via AskUserQuestion (open text input — no default, no fallback):
  #   header: "Projects root"
  #   question: "What is the absolute path to your projects root?
  #              Example: C:\Projects or C:\Users\you\Documents\Projects"
  # Validate: the path must exist as a directory. If not, re-ask.
  # Store as $projectsRoot (no fallback — the user must answer).

  # Ask the user (optional):
  #   header: "Godot executable"
  #   question: "Where is your Godot executable? (optional — press Enter / leave empty to skip)"
  # Store as $godotPath; if empty, omit from file

  New-Item -ItemType Directory -Force -Path "$CONFIG_REPO\.claude" | Out-Null
  $lines = @("paths:", "  projects_root: `"$projectsRoot`"", "  config_repo: `"$CONFIG_REPO`"")
  if ($godotPath) { $lines += "  godot_executable: `"$godotPath`"" }
  $lines += @("preferences:", "  claude_plan: `"$planTier`"")
  $lines -join "`n" | Set-Content $pathsLocal
  $pathsStatus = "written"
}
```

> **Note**: `paths.local.yaml` is read by `serve-backlog.js` (and other shared tools) via `lib/config.js` fallback — so the backlog server finds your projects automatically after bootstrap without any env var setup. Setting env vars in your shell profile (`export CLAUDE_PROJECTS_ROOT="..."`) remains an override option but is no longer required.

---

## PHASE 1: Copy user-files

Copy 4 files to `~/.claude/`. **Skip if the destination already exists** — never overwrites. Create `~/.claude/` if it is missing.

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
  if [ ! -f "$dest" ]; then
    cp "$src" "$dest"
    # STATUS: placed
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
  if (-not (Test-Path $dest)) {
    Copy-Item $src $dest
    # STATUS: placed
  } else {
    # STATUS: already-exists
  }
}
```

### Language patch

After copying CLAUDE.md (only if it was actually placed, and `LANGUAGE_CHOICE` is not `skip`):

Patch the `Language:` line in `~/.claude/CLAUDE.md` **and** the `"language"` field in `~/.claude/settings.json` to keep them in sync.

```bash
# macOS/Linux — CLAUDE.md (portable sed)
sed -i.bak "s/^Language:.*$/Language: $LANGUAGE_CHOICE/" "$HOME/.claude/CLAUDE.md" && rm -f "$HOME/.claude/CLAUDE.md.bak"

# settings.json — prefer jq; fall back to sed
SETTINGS="$HOME/.claude/settings.json"
if command -v jq >/dev/null 2>&1; then
  jq --arg lang "$LANGUAGE_CHOICE" '.language = $lang' "$SETTINGS" > "$SETTINGS.tmp" && mv "$SETTINGS.tmp" "$SETTINGS"
else
  sed -i.bak "s/\"language\":.*$/\"language\": \"$LANGUAGE_CHOICE\",/" "$SETTINGS" && rm -f "$SETTINGS.bak"
fi
```

```powershell
# Windows — CLAUDE.md
(Get-Content "$env:USERPROFILE\.claude\CLAUDE.md") -replace '^Language:.*$', "Language: $LANGUAGE_CHOICE" |
  Set-Content "$env:USERPROFILE\.claude\CLAUDE.md"

# settings.json
$settings = "$env:USERPROFILE\.claude\settings.json"
$json = Get-Content $settings -Raw | ConvertFrom-Json
$json.language = $LANGUAGE_CHOICE
$json | ConvertTo-Json -Depth 10 | Set-Content $settings
```

### Explanation Level patch

After copying CLAUDE.md (only if it was actually placed, and `EXPLANATION_CHOICE` is not `skip`):

Patch the `Explanation Level:` line in `~/.claude/CLAUDE.md`.

```bash
# macOS/Linux — CLAUDE.md
sed -i.bak "s/^Explanation Level:.*$/Explanation Level: $EXPLANATION_CHOICE/" "$HOME/.claude/CLAUDE.md" && rm -f "$HOME/.claude/CLAUDE.md.bak"
```

```powershell
# Windows — CLAUDE.md
(Get-Content "$env:USERPROFILE\.claude\CLAUDE.md") -replace '^Explanation Level:.*$', "Explanation Level: $EXPLANATION_CHOICE" |
  Set-Content "$env:USERPROFILE\.claude\CLAUDE.md"
```

### Permission mode patch

After copying settings.json (only if it was actually placed, and `PERM_CHOICE=auto`):

The template ships the recommended bypass posture, so the recommended choice needs no patch. The auto-mode choice flips `defaultMode` to `auto`, drops the bypass-only flags, and pre-accepts the auto-mode opt-in dialog.

```bash
# macOS/Linux — settings.json (jq preferred, sed fallback)
SETTINGS="$HOME/.claude/settings.json"
if command -v jq >/dev/null 2>&1; then
  jq '.permissions.defaultMode = "auto"
      | del(.disableAutoMode)
      | del(.skipDangerousModePermissionPrompt)
      | .skipAutoPermissionPrompt = true' \
     "$SETTINGS" > "$SETTINGS.tmp" && mv "$SETTINGS.tmp" "$SETTINGS"
else
  # sed fallback flips defaultMode only — it cannot reliably remove the disableAutoMode /
  # skipDangerousModePermissionPrompt keys. Install jq for a clean auto-mode switch.
  sed -i.bak 's/"defaultMode":[[:space:]]*"bypassPermissions"/"defaultMode": "auto"/' "$SETTINGS" && rm -f "$SETTINGS.bak"
fi
```

```powershell
# Windows — settings.json
$settings = "$env:USERPROFILE\.claude\settings.json"
$json = Get-Content $settings -Raw | ConvertFrom-Json
$json.permissions.defaultMode = "auto"
$json.PSObject.Properties.Remove("disableAutoMode")
$json.PSObject.Properties.Remove("skipDangerousModePermissionPrompt")
$json | Add-Member -NotePropertyName skipAutoPermissionPrompt -NotePropertyValue $true -Force
$json | ConvertTo-Json -Depth 10 | Set-Content $settings
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
 Explanation Level          Intermediate
 Permission mode            Bypass permissions
 Claude plan                Max 5x
 Paths (paths.local.yaml)   written
══════════════════════════════════════════════════════
```

Statuses: `placed` · `already-exists` · `linked` · `error: <reason>`

For the Language row: show the chosen language, or the current value with `(already set)` suffix if `LANGUAGE_CHOICE=skip`. Read the current value via:

```bash
CURRENT_LANG=$(grep "^Language:" "$HOME/.claude/CLAUDE.md" | sed 's/^Language:[[:space:]]*//')
```

For the Explanation Level row: show the chosen level, or the current value with `(already set)` suffix if `EXPLANATION_CHOICE=skip`. Read the current value via:

```bash
CURRENT_EXPL=$(grep "^Explanation Level:" "$HOME/.claude/CLAUDE.md" | sed 's/^Explanation Level:[[:space:]]*//')
```

For the Permission mode row: show `Bypass permissions` or `Auto mode` per `PERM_CHOICE`, or the current `defaultMode` value with `(already set)` suffix if `PERM_CHOICE=skip`. Read the current value via:

```bash
CURRENT_MODE=$(jq -r '.permissions.defaultMode' "$HOME/.claude/settings.json" 2>/dev/null)
```

For the Claude plan row: show the `PLAN_TIER` label (`Max 5x`, `Pro`, `Max 10x+`, or `skipped`).

For the Paths row: show `written` / `already-exists`.

For the Personal overlay row:

- `personal/` does not exist → `not found (optional)`
- `personal/` exists, `OVERLAY_COUNT > 0` → `applied (N items)`
- `personal/` exists, `OVERLAY_COUNT = 0` → `found, nothing to apply`

Closing tip (always show):

> Next step: open a project and run `/core-setup` for project-internal setup.
> To stay current with claude-config updates later: run `/core-update`.

### Plan-tier tip

Based on `PLAN_TIER` (from PHASE 0), show one of the following blocks. These settings are not auto-applied — they require a runtime `/model` choice and an explicit edit to `~/.claude/settings.json`.

Skills don't depend on a specific model — they use **plan mode** (`shared/PLAN-MODE.md`), which any model router executes. `opusplan` is a router that runs Opus for plan-mode phases and Sonnet for execution; it benefits Max 5x users where the Opus quota is sufficient.

- **`max-5x`**:

  ```
  Tip for Max 5x:
    • Run /model opusplan      (Opus inside plan mode, Sonnet for execution)
    • Set "effortLevel": "high" in ~/.claude/settings.json
  ```

- **`pro`**:

  ```
  Tip for Pro — Opus quota is tight:
    • Run /model sonnet (or leave default)
    • Set "effortLevel": "medium" in ~/.claude/settings.json
    Plan mode still works under Sonnet; no need for opusplan on Pro.
  ```

- **`max-10x`**:

  ```
  Tip for Max 10x+ — quota headroom:
    • Run /model opus (full Opus for everything)
    • Set "effortLevel": "high" in ~/.claude/settings.json
    opusplan is also fine if you prefer mixed routing.
  ```

- **`skip`**: no plan-tier block shown.
