# App install check

Single check-then-install reference shared by `/core-bootstrap` (first-machine setup) and
`/project-app` (opportunistic self-heal on its default, no-argument path). Both skills read
**this file**, not each other — avoids duplicating install logic in two places. Same pattern as
`shared/STATE-SYNC.md`: a shared instructional doc that stays thin and defers the actual
implementation to a skill-specific reference (`project-app/references/install-app-{macos,
windows}.md`).

**Scope: background service only.** This never touches PWA install/pin (Step 2/3 of those docs)
— that's a browser user-gesture, can't be scripted, and is already surfaced on its own via the
"Install app" button `pwa-register.js` shows once the board is open in a tab. This file only
ensures the background process that keeps the server warm is present.

**Non-blocking by contract.** Any failure here (Node not found, task/agent registration fails)
must never fail the caller's own flow. The caller reports the outcome in its own report step and
continues regardless.

## Check

Detect platform: **Windows** (`$PSVersionTable` exists) → PowerShell; **macOS** → bash.

**macOS:**

```bash
if launchctl print "gui/$(id -u)/com.claude-config.project-board" >/dev/null 2>&1; then
  echo INSTALLED
else
  echo NOT_INSTALLED
fi
```

**Windows:**

```powershell
if (Get-ScheduledTask -TaskName "ClaudeConfigProjectBoard" -ErrorAction SilentlyContinue) {
  "INSTALLED"
} else {
  "NOT_INSTALLED"
}
```

This is deliberately cheap and non-disruptive — it only checks whether the service is currently
loaded/registered, it never touches a server that's already running. Re-running the full install
doc unconditionally (as `install-app` does) is safe too, but would needlessly restart the server
on every check, dropping open board tabs/SSE connections — this check exists specifically to
avoid that on the auto-triggered paths.

## If `NOT_INSTALLED`

> **Todo**: Read `.claude/skills/project-app/references/install-app-macos.md` (macOS) or
> `.claude/skills/project-app/references/install-app-windows.md` (Windows) and follow **Step
> 1 only** ("LaunchAgent (background server)" / "background server (Scheduled Task, logon
> trigger)") — it's self-contained, one code block, no dependency on that doc's later steps.
> Skip Step 2/3 entirely here.

If Step 1 fails (e.g. Node not found), treat that as `SKIPPED` with the reason — not a fatal
error. Return one of three outcomes to the caller: `ALREADY_INSTALLED`, `INSTALLED_NOW`, or
`SKIPPED: <reason>`.

## If `INSTALLED`

Nothing to do. Return `ALREADY_INSTALLED`.
