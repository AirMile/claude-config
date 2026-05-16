---
name: project-viewer
description: Start, stop, or check the local backlog board server. Use with /project-viewer.
metadata:
  author: claude-config
  version: 3.2.0
  category: project
---

# Viewer

Start, stop, or check the local backlog/dashboard server. Serves all project backlogs and dashboards at `http://localhost:9876`.

## Trigger

`/project-viewer` — optional argument: `stop`

## Platform

Detect platform:

- **Windows**: `$PSVersionTable` bestaat → PowerShell
- **macOS**: bash

Projects root (first match wins):

1. Env var `CLAUDE_PROJECTS_ROOT`
2. `<config_repo>/.claude/paths.local.yaml` → veld `projects_root` (geschreven door `/core-bootstrap`)
3. **Windows fallback**: `C:\Projects`
4. **macOS fallback**: `$HOME/projects`

`config_repo` = parent van de gederefereerde symlink/junction `~/.claude/skills`.

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

Resolve `$root` first (altijd, ook als server al draait):

_Windows:_

```powershell
function Resolve-ProjectsRoot {
  if ($env:CLAUDE_PROJECTS_ROOT) { return $env:CLAUDE_PROJECTS_ROOT }
  $skillsLink = Get-Item "$env:USERPROFILE\.claude\skills" -ErrorAction SilentlyContinue
  if ($skillsLink -and $skillsLink.Target) {
    $repo = Split-Path -Parent $skillsLink.Target
    $yaml = Join-Path $repo ".claude\paths.local.yaml"
    if (Test-Path $yaml) {
      $line = Select-String -Path $yaml -Pattern '^\s*projects_root:\s*"?([^"\r\n]+)"?' | Select-Object -First 1
      if ($line) { return $line.Matches[0].Groups[1].Value.Trim().TrimEnd('"') }
    }
  }
  return "C:\Projects"
}
$root = Resolve-ProjectsRoot
```

_macOS:_

```bash
resolve_projects_root() {
  if [ -n "$CLAUDE_PROJECTS_ROOT" ]; then printf '%s' "$CLAUDE_PROJECTS_ROOT"; return; fi
  local repo
  repo="$(cd "$HOME/.claude/skills" 2>/dev/null && pwd -P | sed 's|/[^/]*$||')"
  local yaml="$repo/.claude/paths.local.yaml"
  if [ -f "$yaml" ]; then
    local v
    v=$(awk -F'"' '/^[[:space:]]*projects_root:/ {print $2; exit}' "$yaml")
    if [ -n "$v" ]; then
      v="${v/#\~/$HOME}"; v="${v/#\$HOME/$HOME}"
      printf '%s' "$v"; return
    fi
  fi
  printf '%s' "$HOME/projects"
}
root="$(resolve_projects_root)"
```

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
Start-Process -WindowStyle Hidden -FilePath node -ArgumentList "--watch","$env:USERPROFILE\.claude\skills\shared\references\serve-backlog.js","$root" -RedirectStandardOutput "$env:TEMP\backlog-server.log" -RedirectStandardError "$env:TEMP\backlog-server.err"
```

_macOS:_

```bash
nohup node --watch ~/.claude/skills/shared/references/serve-backlog.js "$root" > /tmp/backlog-server.log 2>&1 &
```

Wait max 5 seconds for readiness (use the PHASE 0 check in a loop).

If not reachable after 5s → show error message + last lines from the log file.

### PHASE 2: Show result

Scan projects in the projects root (directories containing a `.project/` subdirectory).
Use `$root` uit PHASE 1 (al resolved).

_Windows:_

```powershell
Get-ChildItem -Path $root -Directory | Where-Object { Test-Path "$($_.FullName)\.project" } | Select-Object -ExpandProperty Name
```

_macOS:_

```bash
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

If no projects are found, hint toward `/project-add` or `/project-backlog`.

### PHASE 3: Copy link to clipboard

Determine which URL to copy (context-aware):

- If cwd is directly under the projects root and that subdirectory contains `.project/` → use `http://localhost:9876/{project-name}` (dashboard of current project)
- Otherwise → use `http://localhost:9876` (server root)

Use `$root` uit PHASE 1 (al resolved).

**Windows (PowerShell):**

```powershell
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
