---
name: core-bootstrap
description: >-
  Bootstrap user-level ~/.claude/ (CLAUDE.md, settings.json, keybindings,
  statusline) + globale symlinks/junctions naar de claude-config repo. Eenmalig
  per machine — idempotent, skip files die al bestaan tenzij --force. Use with
  /core-bootstrap.
argument-hint: "[--force]"
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: core
---

# Core Bootstrap Skill

**Trigger**: `/core-bootstrap [--force]`

Bootstrap van de user-globale Claude Code configuratie. Deployt 4 user-files naar `~/.claude/` en maakt 4 globale symlinks/junctions aan. Eenmalig per machine na het clonen van de claude-config repo.

`--force`: overschrijft bestaande user-files (FASE 1). Symlinks zijn altijd idempotent via `ln -sfn` / pre-check.

---

## FASE 0: Pre-flight

Resolve `CONFIG_REPO` — de root van de geclonte claude-config repo:

```bash
# macOS/Linux — volg symlink van ~/.claude/skills als die al bestaat
if [ -L "$HOME/.claude/skills" ]; then
  CONFIG_REPO="$(realpath "$HOME/.claude/skills/..")"
else
  # Fallback: huidige working directory als het de repo is
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

Valideer dat `$CONFIG_REPO/local/` bestaat. Zo niet:

> `Kan local/ niet vinden. Draai /core-bootstrap vanuit de claude-config repo directory, of zorg dat ~/.claude/skills al symlinkt naar de repo.`

Stop.

Parse `--force` flag: als aanwezig, sla `FORCE=true` op.

---

## FASE 1: Kopieer user-files

Kopieer 4 files naar `~/.claude/`. **Skip als de doelfile al bestaat** tenzij `FORCE=true`. Maak `~/.claude/` aan als die ontbreekt.

Rapporteer per file de uitkomst (voor FASE 3 rapport):

| File                   | Bron                                        | Doel                               |
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
    # STATUS: placed (of forced-overwrite bij FORCE)
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
    # STATUS: placed (of forced-overwrite bij FORCE)
  } else {
    # STATUS: already-exists
  }
}
```

**Na kopiëren**: toon kort een reminder:

> `settings.json gekopieerd — controleer of hook-paden kloppen voor jouw platform (zie local/README.md).`

Toon deze reminder alleen als settings.json daadwerkelijk geplaatst of overschreven is.

---

## FASE 2: Globale symlinks / junctions

Koppel 4 directories: `agents`, `hooks`, `skills`, `scripts`. Skip als de link al bestaat (`-e` check, geen overwrite).

```bash
# macOS/Linux
for dir in agents hooks skills scripts; do
  target="$HOME/.claude/$dir"
  [ ! -e "$target" ] && ln -sfn "$CONFIG_REPO/$dir" "$target"
  # STATUS: linked (nieuw) of already-exists
done
```

```powershell
# Windows
foreach ($dir in @("agents","hooks","skills","scripts")) {
  $target = "$env:USERPROFILE\.claude\$dir"
  if (-not (Test-Path $target)) {
    cmd /c "mklink /J `"$target`" `"$CONFIG_REPO\$dir`""
    # STATUS: linked (nieuw)
  } else {
    # STATUS: already-exists
  }
}
```

---

## FASE 3: Rapport

Toon ASCII tabel met uitkomst per item:

```
Bootstrap voltooid
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
══════════════════════════════════════════════════════
```

Statussen: `placed` · `already-exists` · `forced-overwrite` · `linked` · `error: <reden>`

Slottip (altijd tonen):

> Volgende stap: open een project en run `/core-setup` voor project-interne setup.
