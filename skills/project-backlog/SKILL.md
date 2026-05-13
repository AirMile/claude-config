---
name: project-backlog
description: >-
  Start, stop, or check the local backlog/dashboard server on localhost:9876.
  Use with /project-backlog to serve kanban backlogs and dashboards across
  all projects via a single Node.js server.
metadata:
  author: claude-config
  version: 3.1.0
  category: project
---

# Backlog

Start, stop, or check the local backlog/dashboard server. Serves all project backlogs and dashboards at `http://localhost:9876`.

## Trigger

`/project-backlog` — optional argument: `stop`

## Platform

Detect platform:

- **Windows**: `$PSVersionTable` bestaat → PowerShell
- **macOS**: bash

Projects root (first match wins):

- Env var `CLAUDE_PROJECTS_ROOT` (override for non-default locations)
- **Windows fallback**: `C:\Projects`
- **macOS fallback**: `$HOME/projects`

Server-script pad: `~/.claude/skills/shared/references/serve-backlog.js`

## Process

### PHASE 0: Check current status

**Windows (PowerShell):**

```powershell
try { Invoke-WebRequest -Uri http://localhost:9876/ -UseBasicParsing -TimeoutSec 2 | Out-Null; "RUNNING" } catch { "STOPPED" }
```

**macOS (bash):**

```bash
curl -s http://localhost:9876/ > /dev/null 2>&1 && echo RUNNING || echo STOPPED
```

Store result as `SERVER_RUNNING`.

### PHASE 1: Execute action

**If argument `stop`:**

_Windows:_

```powershell
Get-NetTCPConnection -LocalPort 9876 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

_macOS:_

```bash
kill $(lsof -ti:9876) 2>/dev/null
```

Confirm result. If no server was running → report that.

**If SERVER_RUNNING = true:** Jump directly to PHASE 2.

**If SERVER_RUNNING = false:** Start the server.

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

Wait max 5 seconds for readiness (use the PHASE 0 check in a loop).

If not reachable after 5s → show error message + last lines from the log file.

### PHASE 2: Show result

Scan projects in the projects root (directories containing a `.project/` subdirectory):

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

Show output:

```
Server:  http://localhost:9876

Projects:
  - {project-name} → http://localhost:9876/{project-name}           (dashboard)
                     http://localhost:9876/{project-name}/backlog   (kanban)
  - ...
```

If no projects are found, hint toward `/project-add` or `/project-plan`.

### PHASE 3: Copy link to clipboard

Determine which URL to copy (context-aware):

- If cwd is directly under the projects root and that subdirectory contains `.project/` → use `http://localhost:9876/{project-name}` (dashboard of current project)
- Otherwise → use `http://localhost:9876` (server root)

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

Show below the projects output:

```
Link copied: {url}
```
