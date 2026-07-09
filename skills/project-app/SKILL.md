---
name: project-app
description: Install/control the backlog board's background app; stop with the stop argument. Use with /project-app.
metadata:
  author: claude-config
  version: 4.0.0
  category: project
---

# Project App

**Day-to-day, you shouldn't need this skill at all** — once `install-app` (PHASE 5) has run
once (automatically, via `/core-bootstrap` or the first time this skill's default path runs),
the board lives behind a single Dock/Launchpad (macOS) or taskbar/Start (Windows) icon: click it,
the board opens, minimize/restore works natively. This skill is the **install/control layer**
underneath that icon, plus a **fallback opener** for before it exists yet:

- **`stop`** — pause the background service. Closing the PWA window doesn't do this (the
  LaunchAgent/Scheduled Task keeps `serve-backlog.js` running on purpose) — this is the only
  interface to actually stop it.
- **Root-mismatch self-heal** (default path, PHASE 1) — if `projects_root` changes, the
  background service keeps serving the old one until something detects and restarts it; the
  LaunchAgent/Task alone can't do that.
- **`install-app`** — (re)run the full background-service + PWA setup. Needed after a
  projects-root change, an icon/script update, or on a machine where the auto-install (PHASE 0 /
  `core-bootstrap` PHASE 2.5) hasn't run yet or failed (e.g. Node wasn't installed at the time).
- **Default path as fallback opener** — starts the server if needed and opens it in a window.
  This still matters for the very first open on a machine: before the PWA is installed there's no
  icon to click yet, and not every setup path (e.g. `/project-add` restoring an existing project
  without going through `core-setup`'s greenfield flow) surfaces a link on its own.

Serves all project backlogs and dashboards at `http://localhost:9876`. The server also serves a
PWA manifest + service worker (`/manifest.webmanifest`, `/sw.js`) — the whole origin (index,
dashboards, backlogs, reviews) is installable from the browser's "Install app" prompt for that
permanent icon.

**The background process itself installs automatically** — `serve-backlog.js` starts at login
(`BACKLOG_IDLE_SHUTDOWN_MS=0` so its idle auto-shutdown never fights the background-restart
mechanism), silently, via `/core-bootstrap` PHASE 2.5 or this skill's own PHASE 0 the first time
it's found missing (`shared/APP-INSTALL-CHECK.md`). On macOS this is a LaunchAgent (`KeepAlive`,
restarts on crash too); on Windows a Scheduled Task (`AtLogOn` — restarts at next login, not
mid-session, since a detached start has no crash-restart hook). An earlier on-demand-launcher
model needed a second icon for exactly that reason on macOS — a PWA can't start itself —
`install-app` replaces it and removes the old launcher if found.

**Multi-device — same backlog/dashboard content, not real-time:** this skill only starts/stops
the _local_ server; it doesn't sync `.project/` data by itself. Use `/project-sync push` (Mac) →
clone the repo + `/project-add` (or `/project-sync pull` on an existing clone) on the new
machine to bring the backlog/dashboard content over via the `claude/state` orphan branch — a
deliberate push/pull step, not continuous sync. Requires a git remote both machines can reach;
only text travels (screenshots/wireframes and credentials don't). See `shared/STATE-SYNC.md` for
the full mechanics.

## Trigger

`/project-app` — opens the app window (starts the server first if needed; auto-installs the
background service on first run, see PHASE 0). Optional argument: `stop`, or `install-app`
(macOS + Windows — force a full background-server + PWA setup/update, see PHASE 5).

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

**Execution rule:** shell state (variables like `$root`/`$SERVER_RUNNING`, function
definitions like `resolve_projects_root`) does **not** persist across separate Bash tool
calls — only the working directory does. Run each phase's code blocks (resolve → validate →
branch → start/stop) as **one** Bash invocation per phase, not split across multiple calls.
Splitting them silently drops `$root` (empty-string checks then pass/fail unpredictably) and
is the most common cause of this skill misbehaving — it is not a bug in the extraction
commands themselves.

### PHASE 0: Ensure background service, then check current status

**Sub-step A — auto-install check (default path only).** Skip this sub-step entirely when the
argument is `stop` (don't install just to immediately stop) or `install-app` (PHASE 5 already
runs the full install unconditionally — this would be redundant). Otherwise:

> **Todo**: Read `.claude/skills/shared/APP-INSTALL-CHECK.md` and follow it.

Store the outcome as `AUTO_INSTALLED` — `true` if it returned `INSTALLED_NOW`, `false` for
`ALREADY_INSTALLED` or `SKIPPED: <reason>` (keep the reason for the PHASE 2 report if skipped).
This is purely additive: whether it installs, skips, or fails, PHASE 1 below still runs its own
existing "start the server if not running" logic regardless — nothing here is a hard dependency.

**Sub-step B — status check.**

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

Resolve `$root` first (altijd, ook als server al draait). If the resolved root does not exist as a directory, prompt for a new path and persist it to `paths.local.yaml` before continuing:

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

# Validate the resolved root exists. A stale/incorrect projects_root leaves the
# board empty — offer to fix it and persist to paths.local.yaml (the source of truth).
if (-not (Test-Path $root -PathType Container)) {
  # AskUserQuestion (open text input): projects_root "$root" does not exist —
  # ask for a new absolute path that must exist as a directory. Store in $newRoot.
  # (If $env:CLAUDE_PROJECTS_ROOT is set it keeps overriding on the next run — note that.)
  $skillsLink = Get-Item "$env:USERPROFILE\.claude\skills" -ErrorAction SilentlyContinue
  if ($skillsLink -and $skillsLink.Target) {
    $yaml = Join-Path (Split-Path -Parent $skillsLink.Target) ".claude\paths.local.yaml"
    if (Test-Path $yaml) {
      (Get-Content $yaml -Raw) -replace '(?m)^(\s*projects_root:).*', "`$1 `"$newRoot`"" | Set-Content $yaml
    }
  }
  $root = $newRoot
}

# If a server is already running, verify it serves the resolved root.
$rootMatches = $true
if ($SERVER_RUNNING -eq "RUNNING") {
  try {
    $served = (Invoke-WebRequest -Uri http://localhost:9876/__root -UseBasicParsing -TimeoutSec 2 | ConvertFrom-Json).root
    $servedNorm = try { (Resolve-Path $served -ErrorAction Stop).Path } catch { $served }
    $rootNorm = try { (Resolve-Path $root -ErrorAction Stop).Path } catch { $root }
    if ($served -and -not ($servedNorm -ieq $rootNorm)) { $rootMatches = $false }
  } catch {}
}
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

# Validate the resolved root exists. A stale/incorrect projects_root leaves the
# board empty — offer to fix it and persist to paths.local.yaml (the source of truth).
if [ ! -d "$root" ]; then
  # AskUserQuestion (open text input): projects_root "$root" does not exist —
  # ask for a new absolute path that must exist as a directory. Store in NEW_ROOT.
  # (If $CLAUDE_PROJECTS_ROOT is set it keeps overriding on the next run — note that.)
  repo="$(cd "$HOME/.claude/skills" 2>/dev/null && pwd -P | sed 's|/[^/]*$||')"
  yaml="$repo/.claude/paths.local.yaml"
  if [ -f "$yaml" ]; then
    sed -i '' 's|^\([[:space:]]*projects_root:\).*|\1 "'"$NEW_ROOT"'"|' "$yaml"
  fi
  root="$NEW_ROOT"
fi

# If a server is already running, verify it serves the resolved root.
ROOT_MATCHES=true
if [ "$SERVER_RUNNING" = RUNNING ]; then
  served="$(curl -s http://localhost:9876/__root | sed -n 's/.*"root":"\([^"]*\)".*/\1/p')"
  canon() { (cd "$1" 2>/dev/null && pwd -P) || printf '%s' "$1"; }
  if [ -n "$served" ] && [ "$(canon "$served")" != "$(canon "$root")" ]; then
    ROOT_MATCHES=false
  fi
fi
```

**If argument `stop`:**

_Windows:_

```powershell
Get-NetTCPConnection -LocalPort 9876 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

If `install-app` (PHASE 5) was run, the Scheduled Task only triggers `AtLogOn` — unlike macOS's
`KeepAlive`, there's no mid-session auto-restart to fight, so this kill just works and the server
stays down until the next login. To stop it permanently (not just for this session), disable the
task: `Disable-ScheduledTask -TaskName "ClaudeConfigProjectBoard"`.

_macOS:_

```bash
launchctl bootout "gui/$(id -u)/com.claude-config.project-board" 2>/dev/null
kill $(lsof -ti:9876) 2>/dev/null
```

If `install-app` (PHASE 5) was run, a LaunchAgent restarts the server automatically
(`KeepAlive`) — plain `kill` alone would just bounce right back. `launchctl bootout` unloads the
agent first so the kill actually sticks; it's a no-op (silently fails, ignored) when no agent is
installed, so this line is safe to always run.

Confirm result. If no server was running → report that. **Stop here — do not continue to PHASE
2-4.**

**No argument (default):** pick the branch below to ensure the server is running, then continue
through PHASE 2, 3, and 4 in order — PHASE 4 (open the app window) always runs, it is not a
separate mode.

- **SERVER_RUNNING = true && root matches** (`ROOT_MATCHES`/`$rootMatches` true): jump directly to PHASE 2 — fast path, don't restart (keeps open boards/SSE alive). `COLD_START=false`.
- **SERVER_RUNNING = true && root mismatches**: a stale server is bound to a different projects root. Kill it (use the `stop` kill command above), then start a fresh server with `$root`. Mention in the report that the server was restarted because the projects root changed. `COLD_START=true`.
- **SERVER_RUNNING = false**: start the server. `COLD_START=true`.

**Start the server** (mismatch-restart and cold-start both use this):

_Windows:_

```powershell
Start-Process -WindowStyle Hidden -FilePath node -ArgumentList "--watch","$env:USERPROFILE\.claude\skills\shared\references\serve-backlog.js","$root" -RedirectStandardOutput "$env:TEMP\backlog-server.log" -RedirectStandardError "$env:TEMP\backlog-server.err"
```

_macOS:_

```bash
nohup node --watch ~/.claude/skills/shared/references/serve-backlog.js "$root" > /tmp/backlog-server.log 2>&1 &
```

Don't block waiting for readiness here — starting it in the background and moving straight on to
PHASE 2/3 (both pure filesystem/string logic, no server call) is fine. PHASE 4 shows a loading
state in the opened window itself while the server comes up, which is a better experience than a
synchronous wait-and-report in chat.

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
  - {project-name} → http://localhost:9876/{project-name}                  (dashboard)
                     http://localhost:9876/{project-name}/backlog          (kanban)
                     http://localhost:9876/{project-name}/review/{entity}  (design review)
  - ...
```

If no projects are found, hint toward `/project-add` or `/project-plan`.

If `AUTO_INSTALLED=true` (from PHASE 0), add one line: "Background service wasn't installed yet
— set it up automatically (starts on its own from now on at login)." If it was `SKIPPED: <reason>`,
add: "Background service auto-install skipped ({reason}) — the server still started normally for
this session; run `/project-app install-app` once {reason is resolved} to set it up."

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

### PHASE 4: Open app window

Always runs (unless argument was `stop`, which already exited above). Reuse `$url` from PHASE 3
— the same context-aware URL (cwd under a project with `.project/` → that project's dashboard;
otherwise the index `http://localhost:9876`). Use `$COLD_START` from PHASE 1.

**If `$COLD_START=true`:** open a loading state instead of `$url` directly — the server may take
a second or two to boot. Point the ad-hoc `--app=` window (or default browser, if no app-capable
browser is found) at the local loading page, which polls the server and redirects itself once
ready:

```bash
loading_url="file://$HOME/.claude/skills/shared/references/loading.html?url=$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1]))" "$url")"
```

Use `$loading_url` in place of `$url` everywhere below when `$COLD_START=true`.

**macOS — prefer the installed PWA if present** (only when `$COLD_START=false` — the installed
app always opens its fixed `start_url`, so it can't show the loading page; on a cold start use
the ad-hoc window below instead so the loading page can be shown, even if the PWA is installed).
With `install-app` (PHASE 5) set up, the LaunchAgent keeps the server warm at all times, so
`$COLD_START` is `false` on nearly every run — this installed-PWA branch is the normal path, not
a fallback. `$COLD_START=true` now only happens without the LaunchAgent (e.g. before running
`install-app`, or after a manual `kill` that bypassed `stop`):

An ad-hoc `open -na "Brave Browser" --args --app=...` window runs inside that browser's regular
application bundle, so it **shares its Dock icon** — minimizing it and clicking the Dock icon
later can bring up a plain browser window instead of restoring it, which is confusing. The
**installed PWA** (via the browser's "Install app" prompt) is a real, separate `.app` bundle
with its own bundle ID and Dock icon — native minimize/restore, no ambiguity.

Browser preference order is **Brave → Chrome → Edge** (matches this setup's actual daily
browser — adjust if that changes). A PWA installed in Brave lands in
`~/Applications/Brave Browser Apps.localized/`, Chrome's in `~/Applications/Chrome
Apps.localized/`, Edge's in `~/Applications/Microsoft Edge Apps.localized/` — check all three,
in preference order, since the app could be installed in any of them:

```bash
installed_app=""
if [ "$COLD_START" = false ]; then
  for appdir in "Brave Browser Apps.localized" "Chrome Apps.localized" "Microsoft Edge Apps.localized"; do
    installed_app=$(find "$HOME/Applications/$appdir" -maxdepth 1 -iname "*Project Board*.app" 2>/dev/null | head -1)
    [ -n "$installed_app" ] && break
  done
fi
if [ -n "$installed_app" ]; then
  open -a "$installed_app"
else
  target="$url"
  [ "$COLD_START" = true ] && target="$loading_url"
  opened=false
  for app in "Brave Browser" "Google Chrome" "Microsoft Edge"; do
    if [ -d "/Applications/$app.app" ]; then
      open -na "$app" --args --app="$target"
      opened=true
      break
    fi
  done
  if [ "$opened" = false ]; then
    open "$target"
  fi
fi
```

Note: the installed-app path opens the PWA's `start_url` (the index) — it can't be pointed at
`$url` directly, since `open -a` doesn't pass a URL through to an already-scoped app reliably.
That's fine on a warm start: `scope` is `/`, so the project's dashboard/backlog is one click away
inside the same app window. If `$installed_app` is empty (not installed yet, or cold start),
fall back to the `--app=` window, and mention in the report that installing once (click the
install icon in the address bar on `$url`) fixes the Dock/minimize behavior for good.

**Windows (PowerShell):**

```powershell
$loadingUrl = "file://$env:USERPROFILE\.claude\skills\shared\references\loading.html?url=$([uri]::EscapeDataString($url))"
$target = if ($COLD_START) { $loadingUrl } else { $url }
$candidates = @(
  "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
  "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
  "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
  "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
  "$env:ProgramFiles\BraveSoftware\Brave-Browser\Application\brave.exe",
  "${env:ProgramFiles(x86)}\BraveSoftware\Brave-Browser\Application\brave.exe"
)
$browser = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if ($browser) {
  Start-Process -FilePath $browser -ArgumentList "--app=$target"
} else {
  Start-Process $target
}
```

Report:

```
App window opened: {url}
```

If `$COLD_START` was true, note that the server was just started and the window shows a loading
state until it's reachable. If `$installed_app` was used, note that too. Otherwise (ad-hoc
`--app=` window), add a one-line tip: click "Install app" / the install icon in the browser's
address bar on `$url` once — that installs a real `.app` with its own icon and Dock/Launchpad/
Start entry, so minimize/restore works correctly and future `/project-app` runs auto-detect
and use it. If none of the app-capable browsers were found, note that a normal tab was opened
instead.

### PHASE 5: Install app (argument `install-app`, macOS + Windows)

One-time (or re-run-to-update) setup — after this, `/project-app` itself is no longer needed
for everyday use; the server is always warm in the background and the installed PWA is the one
Dock/taskbar icon.

**macOS:**

> **Todo**: Read `.claude/skills/project-app/references/install-app-macos.md` and follow it
> exactly (LaunchAgent setup, old-launcher removal, PWA install/pin — all as one Bash invocation
> per step, per the Execution rule above).

**Windows:**

> **Todo**: Read `.claude/skills/project-app/references/install-app-windows.md` and follow it
> exactly (Scheduled Task setup, PWA install, taskbar pin — one PowerShell invocation per step,
> per the Execution rule above). Unlike the macOS doc, the taskbar-pin step is a manual instruction
> for the user, not a script — Windows blocks programmatic taskbar pinning since Win10.
