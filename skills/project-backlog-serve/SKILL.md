---
name: project-backlog-serve
description: Start, stop of check de lokale backlog/dashboard server op localhost:9876. Serveert alle project-backlogs en dashboards via één Node.js server.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 3.0.0
  category: project
---

# Backlog Serve

Start, stop of check de lokale backlog server. Serveert alle project-backlogs en dashboards op `http://localhost:9876`.

## Trigger

`/backlog-serve` of `/backlog` — optioneel argument: `stop`

## Platform

Detecteer platform:

- **Windows**: `$PSVersionTable` bestaat → PowerShell
- **Linux/macOS**: bash

Projects root:

- **Windows**: `C:\Projects`
- **Linux/macOS**: `$HOME/projects`

Server-script pad: `~/.claude/skills/shared/references/serve-backlog.js`

## Process

### FASE 0: Check huidige status

**Windows (PowerShell):**

```powershell
try { Invoke-WebRequest -Uri http://localhost:9876/ -UseBasicParsing -TimeoutSec 2 | Out-Null; "RUNNING" } catch { "STOPPED" }
```

**Linux/macOS (bash):**

```bash
curl -s http://localhost:9876/ > /dev/null 2>&1 && echo RUNNING || echo STOPPED
```

Sla resultaat op als `SERVER_RUNNING`.

### FASE 1: Actie uitvoeren

**Als argument `stop`:**

_Windows:_

```powershell
Get-NetTCPConnection -LocalPort 9876 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

_Linux/macOS:_

```bash
kill $(lsof -ti:9876) 2>/dev/null
```

Bevestig resultaat. Als geen server draaide → meld dat.

**Als SERVER_RUNNING = true:** Spring direct naar FASE 2.

**Als SERVER_RUNNING = false:** Start de server.

_Windows:_

```powershell
Start-Process -WindowStyle Hidden -FilePath node -ArgumentList "$env:USERPROFILE\.claude\skills\shared\references\serve-backlog.js","C:\Projects" -RedirectStandardOutput "$env:TEMP\backlog-server.log" -RedirectStandardError "$env:TEMP\backlog-server.err"
```

_Linux/macOS:_

```bash
nohup node ~/.claude/skills/shared/references/serve-backlog.js "$HOME/projects" > /tmp/backlog-server.log 2>&1 &
```

Wacht max 5 seconden op readiness (gebruik de FASE 0 check in een loop).

Als na 5s niet bereikbaar → toon foutmelding + laatste regels uit de log file.

### FASE 2: Toon resultaat

Lees de adminToken (de server maakt deze automatisch aan bij eerste start):

```bash
node -e "console.log(JSON.parse(require('fs').readFileSync(require('os').homedir()+'/.claude/server-auth.json','utf8')).adminToken)"
```

Scan projecten in de projects root (directories met een `.project/` subdirectory):

_Windows:_

```powershell
Get-ChildItem -Path C:\Projects -Directory | Where-Object { Test-Path "$($_.FullName)\.project" } | Select-Object -ExpandProperty Name
```

_Linux/macOS:_

```bash
for d in "$HOME/projects"/*/; do [ -d "$d/.project" ] && basename "$d"; done
```

Toon output:

```
Server:  http://localhost:9876

Admin:   http://localhost:9876/auth?token={adminToken}
         (eenmalig openen voor login — daarna werkt de bookmark)

Projecten:
  - {project-naam} → http://localhost:9876/{project-naam}           (dashboard)
                     http://localhost:9876/{project-naam}/backlog   (kanban)
  - ...
```

Als er geen projecten gevonden zijn, hint naar `/project-add` of `/dev-plan`.
