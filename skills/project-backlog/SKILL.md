---
name: project-backlog
description: >-
  Start, stop, or check the local backlog/dashboard server on localhost:9876.
  Use with /project-backlog to serve kanban backlogs and dashboards across
  all projects via a single Node.js server.
metadata:
  author: mileszeilstra
  version: 3.1.0
  category: project
---

# Backlog

Start, stop of check de lokale backlog/dashboard server. Serveert alle project-backlogs en dashboards op `http://localhost:9876`.

## Trigger

`/project-backlog` — optioneel argument: `stop`

## Platform

Detecteer platform:

- **Windows**: `$PSVersionTable` bestaat → PowerShell
- **macOS**: bash

Projects root (eerste match wint):

- Env var `CLAUDE_PROJECTS_ROOT` (override voor afwijkende locaties)
- **Windows fallback**: `C:\Projects`
- **macOS fallback**: `$HOME/projects`

Server-script pad: `~/.claude/skills/shared/references/serve-backlog.js`

## Process

### PHASE 0: Check huidige status

**Windows (PowerShell):**

```powershell
try { Invoke-WebRequest -Uri http://localhost:9876/ -UseBasicParsing -TimeoutSec 2 | Out-Null; "RUNNING" } catch { "STOPPED" }
```

**macOS (bash):**

```bash
curl -s http://localhost:9876/ > /dev/null 2>&1 && echo RUNNING || echo STOPPED
```

Sla resultaat op als `SERVER_RUNNING`.

### PHASE 1: Actie uitvoeren

**Als argument `stop`:**

_Windows:_

```powershell
Get-NetTCPConnection -LocalPort 9876 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

_macOS:_

```bash
kill $(lsof -ti:9876) 2>/dev/null
```

Bevestig resultaat. Als geen server draaide → meld dat.

**Als SERVER_RUNNING = true:** Spring direct naar PHASE 2.

**Als SERVER_RUNNING = false:** Start de server.

_Windows:_

```powershell
$root = if ($env:CLAUDE_PROJECTS_ROOT) { $env:CLAUDE_PROJECTS_ROOT } else { "C:\Projects" }
Start-Process -WindowStyle Hidden -FilePath node -ArgumentList "$env:USERPROFILE\.claude\skills\shared\references\serve-backlog.js","$root" -RedirectStandardOutput "$env:TEMP\backlog-server.log" -RedirectStandardError "$env:TEMP\backlog-server.err"
```

_macOS:_

```bash
root="${CLAUDE_PROJECTS_ROOT:-$HOME/projects}"
nohup node ~/.claude/skills/shared/references/serve-backlog.js "$root" > /tmp/backlog-server.log 2>&1 &
```

Wacht max 5 seconden op readiness (gebruik de PHASE 0 check in een loop).

Als na 5s niet bereikbaar → toon foutmelding + laatste regels uit de log file.

### PHASE 2: Toon resultaat

Scan projecten in de projects root (directories met een `.project/` subdirectory):

_Windows:_

```powershell
$root = if ($env:CLAUDE_PROJECTS_ROOT) { $env:CLAUDE_PROJECTS_ROOT } else { "C:\Projects" }
Get-ChildItem -Path $root -Directory | Where-Object { Test-Path "$($_.FullName)\.project" } | Select-Object -ExpandProperty Name
```

_macOS:_

```bash
root="${CLAUDE_PROJECTS_ROOT:-$HOME/projects}"
for d in "$root"/*/; do [ -d "$d/.project" ] && basename "$d"; done
```

Toon output:

```
Server:  http://localhost:9876

Projecten:
  - {project-naam} → http://localhost:9876/{project-naam}           (dashboard)
                     http://localhost:9876/{project-naam}/backlog   (kanban)
  - ...
```

Als er geen projecten gevonden zijn, hint naar `/project-add` of `/project-plan`.

### PHASE 3: Kopieer link naar clipboard

Bepaal welke URL gekopieerd wordt (context-aware):

- Als cwd direct onder de projects root ligt én die subdirectory bevat `.project/` → gebruik `http://localhost:9876/{project-naam}` (dashboard van huidig project)
- Anders → gebruik `http://localhost:9876` (server root)

**Windows (PowerShell):**

```powershell
$root = if ($env:CLAUDE_PROJECTS_ROOT) { $env:CLAUDE_PROJECTS_ROOT } else { "C:\Projects" }
$cwd = (Get-Location).Path
$url = "http://localhost:9876"
if ($cwd -like "$root\*") {
  $rel = $cwd.Substring($root.Length + 1)
  $project = $rel.Split('\')[0]
  if (Test-Path "$root\$project\.project") { $url = "http://localhost:9876/$project" }
}
Set-Clipboard -Value $url
$url
```

**macOS (bash):**

```bash
root="${CLAUDE_PROJECTS_ROOT:-$HOME/projects}"
cwd="$PWD"
url="http://localhost:9876"
if [[ "$cwd" == "$root"/* ]]; then
  rel="${cwd#$root/}"
  project="${rel%%/*}"
  [ -d "$root/$project/.project" ] && url="http://localhost:9876/$project"
fi
printf '%s' "$url" | pbcopy
echo "$url"
```

Toon onder de projecten-output:

```
Link gekopieerd: {url}
```
