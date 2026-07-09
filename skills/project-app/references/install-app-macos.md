# Install app (macOS)

Makes the board a single real app: a background **LaunchAgent** keeps `serve-backlog.js` running
(starts at login, restarts on crash, idle auto-shutdown disabled so it never fights the
LaunchAgent), and the **installed PWA** is the one and only Dock icon — its own bundle, native
minimize/restore, no ad-hoc `--app=` window sharing the browser's icon. Preference order is
**Brave → Chrome → Edge** (whichever is your daily browser — a PWA installed in Brave lands in
`~/Applications/Brave Browser Apps.localized/`, Chrome's in `~/Applications/Chrome
Apps.localized/`, Edge's in `~/Applications/Microsoft Edge Apps.localized/`); adjust the order
below if that's not your setup.

Replaces the older on-demand launcher `.app` model: that approach needed a second icon (one to
start the server, one for the PWA window) because a PWA can't start itself. With the server
always warm, only the PWA icon is needed — this doc also removes the old launcher and its Dock
pin as part of running it.

Run as **one** Bash invocation (see the Execution rule in `SKILL.md`).

## Step 1 — LaunchAgent (background server)

```bash
set -e
LABEL="com.claude-config.project-board"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
SERVER_SCRIPT="$HOME/.claude/skills/shared/references/serve-backlog.js"

resolve_node() {
  if command -v node >/dev/null 2>&1; then command -v node; return; fi
  /bin/zsh -lc 'command -v node' 2>/dev/null
}
NODE_BIN="$(resolve_node)"
if [ -z "$NODE_BIN" ]; then
  echo "Node.js not found — install it first (nvm/homebrew/asdf), then re-run this doc." >&2
  exit 1
fi

resolve_projects_root() {
  if [ -n "$CLAUDE_PROJECTS_ROOT" ]; then printf '%s' "$CLAUDE_PROJECTS_ROOT"; return; fi
  local repo
  repo="$(cd "$HOME/.claude/skills" 2>/dev/null && pwd -P | sed 's|/[^/]*$||')"
  local yaml="$repo/.claude/paths.local.yaml"
  if [ -f "$yaml" ]; then
    local v
    v=$(awk -F'"' '/^[[:space:]]*projects_root:/ {print $2; exit}' "$yaml")
    if [ -n "$v" ]; then v="${v/#\~/$HOME}"; printf '%s' "$v"; return; fi
  fi
  printf '%s' "$HOME/projects"
}
ROOT="$(resolve_projects_root)"

mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PLIST" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>--watch</string>
    <string>$SERVER_SCRIPT</string>
    <string>$ROOT</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>BACKLOG_IDLE_SHUTDOWN_MS</key><string>0</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>/tmp/backlog-server.log</string>
  <key>StandardErrorPath</key><string>/tmp/backlog-server.err</string>
</dict>
</plist>
PLIST

UID_N="$(id -u)"
launchctl bootout "gui/$UID_N/$LABEL" 2>/dev/null || true
launchctl bootstrap "gui/$UID_N" "$PLIST"
launchctl enable "gui/$UID_N/$LABEL"

for i in $(seq 1 20); do
  curl -s -m 1 http://localhost:9876/__root >/dev/null 2>&1 && break
  sleep 0.3
done
curl -s http://localhost:9876/__root || echo "Server did not come up — check /tmp/backlog-server.err"
```

`BACKLOG_IDLE_SHUTDOWN_MS=0` disables the self-shutdown in `serve-backlog.js` — with `KeepAlive`
on, the two mechanisms would otherwise fight (idle timer exits the process, `launchd`
immediately restarts it). `node --watch` still restarts on its own for file changes; that's
unrelated and stays on.

## Step 2 — Remove the old launcher app + its Dock pin

Superseded by the LaunchAgent — leaving it in place would keep opening a second, stale-icon app.

```bash
OLD_APP="$HOME/Applications/Project Board.app"
[ -d "$OLD_APP" ] && rm -rf "$OLD_APP"

python3 - "$OLD_APP" <<'PY'
import subprocess, plistlib, sys, urllib.parse
old_url = "file://" + urllib.parse.quote(sys.argv[1]) + "/"
raw = subprocess.run(["defaults", "export", "com.apple.dock", "-"], capture_output=True).stdout
data = plistlib.loads(raw)
apps = data.get("persistent-apps", [])
kept = [a for a in apps
        if a.get("tile-data", {}).get("file-data", {}).get("_CFURLString", "") != old_url]
data["persistent-apps"] = kept
plistlib.dump(data, open("/tmp/dock-unpin.plist", "wb"))
print("removed" if len(kept) != len(apps) else "not pinned")
PY
defaults import com.apple.dock /tmp/dock-unpin.plist
rm -f /tmp/dock-unpin.plist
```

## Step 3 — Install (or re-pin) the PWA

The PWA can't be installed from a script — the browser's install dialog is a user gesture, and
`chrome://`/`brave://`-internal pages can't be automated either. If it's already installed with
the **old** icon baked in, open the installed app itself and use its own three-dot menu →
"Uninstall…" (the `chrome://apps` / `brave://apps` overview works too, opened by hand) so
reinstalling picks up the current `icon-192.png`/`icon-512.png`. Then, with the server warm
(Step 1 already ensures this), open `http://localhost:9876/` and click the "Install app" button
the page shows (added by `pwa-register.js` — only appears when installable and not yet
installed), or the install icon in the address bar.

Once installed, pin it to the Dock (idempotent — dedupes if run more than once; searches all
three browsers' app folders in preference order):

```bash
python3 - <<'PY'
import subprocess, plistlib, glob, os, urllib.parse
candidates = []
for appdir in ("Brave Browser Apps.localized", "Chrome Apps.localized", "Microsoft Edge Apps.localized"):
    candidates = glob.glob(os.path.expanduser(f"~/Applications/{appdir}/*Project Board*.app"))
    if candidates:
        break
if not candidates:
    print("PWA not found yet — install it in the browser first, then re-run this step.")
    raise SystemExit(0)
pwa_url = "file://" + urllib.parse.quote(candidates[0]) + "/"
raw = subprocess.run(["defaults", "export", "com.apple.dock", "-"], capture_output=True).stdout
data = plistlib.loads(raw)
apps = data.get("persistent-apps", [])
kept, seen = [], False
for a in apps:
    url = a.get("tile-data", {}).get("file-data", {}).get("_CFURLString", "")
    if url == pwa_url:
        if seen: continue
        seen = True
    kept.append(a)
if not seen:
    kept.append({"tile-data": {"file-data": {"_CFURLString": pwa_url, "_CFURLStringType": 0}}})
data["persistent-apps"] = kept
plistlib.dump(data, open("/tmp/dock-pin.plist", "wb"))
print("pinned" if not seen else "already pinned (deduped)")
PY
defaults import com.apple.dock /tmp/dock-pin.plist
rm -f /tmp/dock-pin.plist
killall Dock
```

## If the Dock icon still shows stale artwork

macOS caches app icons outside `~/Library/Caches` too. Only needed if the icon looks wrong after
a reinstall + the pin step above:

```bash
CACHE_DIR="$(getconf DARWIN_USER_CACHE_DIR)"
rm -rf "${CACHE_DIR}com.apple.dock.iconcache" "${CACHE_DIR}com.apple.iconservices"
killall iconservicesagent 2>/dev/null || true
killall Dock
killall Finder
```

## Report

State the LaunchAgent label + plist path, that it starts at login, and the Dock now shows a
single "Project Board" icon (the PWA). If Step 3 couldn't run because the PWA isn't installed
yet, say so explicitly and give the one-click install instruction.
