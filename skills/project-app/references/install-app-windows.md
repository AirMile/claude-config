# Install app (Windows)

Windows counterpart to `install-app-macos.md`. Makes the board a single real app: a background
process keeps `serve-backlog.js` running (starts at login), and the **installed PWA** (Edge or
Chrome) is the one and only taskbar icon — its own window, native minimize/restore.

**Not verified on a real Windows machine yet** (built and reviewed from macOS) — run through the
Verification steps at the bottom the first time and report back if anything doesn't match.

Run each step as **one** PowerShell invocation (see the Execution rule in `SKILL.md`).

## Step 1 — background server (Scheduled Task, logon trigger)

macOS's LaunchAgent has `KeepAlive` (restarts on crash, any time). Windows Task Scheduler can't
cleanly replicate that for a fully detached, console-free process — the trigger used here is
**`AtLogOn`**: the server starts once per login and stays up from there (`node --watch` still
restarts it on its own for file changes). A crash mid-session would need a fresh login to
recover from; that's an accepted trade-off for a small local dev-tool server, not a resilience
gap worth chasing with a foreground-task workaround.

```powershell
$ErrorActionPreference = "Stop"
$TaskName = "ClaudeConfigProjectBoard"
$ServerScript = "$env:USERPROFILE\.claude\skills\shared\references\serve-backlog.js"
$LauncherVbs = "$env:USERPROFILE\.claude\project-board-launcher.vbs"
$LogFile = "$env:TEMP\backlog-server.log"

$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
  Write-Error "Node.js not found on PATH — install it first, then re-run this doc."
  exit 1
}
$NodeBin = $nodeCmd.Source

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
$Root = Resolve-ProjectsRoot

# VBS launcher: wscript.exe is a GUI-subsystem host (no console flash on its own), and Run's
# windowstyle 0 hides the cmd.exe it spawns too — so login shows nothing. The node path is
# baked in absolute (not relying on PATH at logon time, which Scheduled Tasks may not inherit
# the same way an interactive shell does).
$vbsContent = @"
Set objShell = CreateObject("WScript.Shell")
objShell.Run "cmd /c set BACKLOG_IDLE_SHUTDOWN_MS=0 && ""$NodeBin"" --watch ""$ServerScript"" ""$Root"" > ""$LogFile"" 2>&1", 0, False
"@
# Unicode (UTF-16LE + BOM) is the traditional safe encoding for .vbs — handles non-ASCII paths
# (accented usernames etc.) that plain ASCII would mangle.
Set-Content -Path $LauncherVbs -Value $vbsContent -Encoding Unicode

# Stop any already-running instance first so re-registering + starting now doesn't collide on
# the port (also makes this step safely re-runnable after an update).
Get-NetTCPConnection -LocalPort 9876 -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }

$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$LauncherVbs`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
# -Hidden here means "hidden from the casual Task Scheduler UI list", unrelated to the
# console-window hiding above (that's the wscript.exe + windowstyle-0 combination).
$settings = New-ScheduledTaskSettingsSet -Hidden -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings `
  -Description "Keeps the local Project Board server (serve-backlog.js) running in the background." `
  -Force | Out-Null
# A per-user AtLogOn task like this does not require admin elevation.

Start-ScheduledTask -TaskName $TaskName

$ok = $false
for ($i = 0; $i -lt 20; $i++) {
  try {
    Invoke-WebRequest -Uri "http://localhost:9876/__root" -UseBasicParsing -TimeoutSec 1 | Out-Null
    $ok = $true
    break
  } catch { Start-Sleep -Milliseconds 300 }
}
if ($ok) { Write-Host "Server is up." } else { Write-Host "Server did not come up — check $LogFile" }
```

`BACKLOG_IDLE_SHUTDOWN_MS=0` disables `serve-backlog.js`'s own idle auto-shutdown — with the
Scheduled Task expecting the process to just keep running, the two mechanisms would otherwise
fight (idle timer exits, nothing restarts it until the next login).

## Step 2 — install the PWA + pin to the taskbar

No migration step here — the on-demand-launcher `.app` model this replaces only ever existed on
macOS. With the server warm (Step 1 already ensures this), open `http://localhost:9876/` in Edge
or Chrome and click the **"Install app"** button the page shows (added by `pwa-register.js` —
only appears when installable and not yet installed), or the install icon in the address bar.

If it's already installed with an outdated icon baked in (e.g. after a redesign), open the
installed app itself, use its own three-dot menu → **Uninstall**, then reinstall via the button
above so it picks up the current `icon-192.png`/`icon-512.png`.

Installing creates a Start Menu entry. Some Edge/Chrome versions offer a "Pin to taskbar"
checkbox during install — accept that if shown. Otherwise, pin manually: open the Start Menu,
find **"Project Board"**, right-click → **Pin to taskbar**. Windows blocks pinning to the
taskbar programmatically (since Windows 10), so this one step can't be scripted — it's the
Windows equivalent of the macOS doc's Dock-pin script, done by hand instead.

## If the taskbar icon still shows stale artwork

Windows caches shell icons too. Only needed if the icon looks wrong after a reinstall:

```powershell
Stop-Process -Name explorer -Force
Remove-Item "$env:LocalAppData\IconCache.db" -Force -ErrorAction SilentlyContinue
Start-Process explorer
```

(`explorer` restarts itself if the `Remove-Item` path doesn't exist on newer Windows builds —
that's expected, the restart alone often clears the in-memory icon cache too.)

## Report

State the Scheduled Task name (`ClaudeConfigProjectBoard`) and that it starts at every login, and
that the taskbar now shows a single "Project Board" icon (the PWA). If Step 2 couldn't finish
because the PWA isn't installed yet, say so explicitly and give the one-click install
instruction. Flag clearly that this doc is unverified on real Windows hardware — ask the user to
confirm each Verification step in `SKILL.md`'s plan actually worked as described.
