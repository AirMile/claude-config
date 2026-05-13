---
name: project-tunnel
description: Start dev server with Cloudflare Tunnel for external access. Use with /project-tunnel to expose local development environment via public URL.
metadata:
  author: claude-config
  version: 3.0.0
  category: project
---

# Project Tunnel

Start the dev server with Cloudflare Tunnel for HTTPS access from any device.

## 1. Detect framework

Check `package.json` dependencies:

- `"vite"` → Vite project
- `"next"` → Next.js project
- Otherwise → error: "No supported framework found in package.json"

**Start commands:**

| Framework | Command                                          |
| --------- | ------------------------------------------------ |
| Vite      | `node node_modules/.bin/vite --port 3000 --host` |
| Next.js   | `node node_modules/.bin/next dev -p 3000`        |

> **Important:** Always use `node node_modules/.bin/...` instead of `npx`. `npx` wrapper processes sometimes die silently under `nohup`, while direct `node` invocation is stable.

## 2. Pre-flight checks

**Dependencies:** If `node_modules` does not exist → run `npm install` first.

**Vite allowedHosts:** If Vite project, check whether `vite.config` has a `server.allowedHosts` that allows `.trycloudflare.com`. If not → add:

```js
server: {
  allowedHosts: [".trycloudflare.com"];
}
```

**Port 3000:** Use `curl` to detect whether a server is already running:

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000
```

- **200/3xx** → something is running. Check `/tmp/devserver.log` for the project path.
  - **Same project** → skip to step 4
  - **Different project** → report which project, kill everything (step 2b), continue to step 3
- **000 (no connection)** → free, continue to step 3

### 2b. Cleanup (when kill is needed)

Kill in three layers to prevent zombie processes:

```bash
# Layer 1: port-based
fuser -k 3000/tcp 2>/dev/null

# Layer 2: framework processes (use what applies)
# Next.js:
pkill -f "next dev" 2>/dev/null
pkill -f "next-router-worker" 2>/dev/null
# Vite:
pkill -f "vite" 2>/dev/null

# Layer 3: tunnel
pkill -f cloudflared 2>/dev/null

sleep 2
```

> `fuser` and `ss` sometimes fail to detect Node.js dev servers because the port is bound in a way that is not visible to these tools. Therefore always also use `pkill -f` with the framework-specific process name.

## 3. Start dev server

```bash
nohup [framework command] > /tmp/devserver.log 2>&1 &
echo $! > /tmp/devserver.pid
```

Wait until the server is ready using `curl` (max 20s, first compile can take a while):

```bash
for i in $(seq 1 20); do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000 2>/dev/null)
  [ "$HTTP_CODE" = "200" ] && echo "ready" && break
  sleep 1
done
```

Not ready after 20s → show last 20 lines from `/tmp/devserver.log` and stop.

> **Verification:** Always use `curl` against `127.0.0.1:3000`, never `ss` or `lsof`. These tools do not reliably detect Node.js dev servers.

## 4. Start tunnel

Check for existing tunnel first:

```bash
pgrep -f cloudflared > /dev/null && grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cloudflared.log 2>/dev/null | head -1
```

No active tunnel → start a new one:

```bash
pkill -f cloudflared 2>/dev/null; sleep 1
nohup cloudflared tunnel --url http://localhost:3000 --config /dev/null --metrics 127.0.0.1:0 > /tmp/cloudflared.log 2>&1 &
sleep 10
grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cloudflared.log | head -1
```

> `--config /dev/null` prevents a named tunnel config (`~/.cloudflared/config.yml`) from breaking the quick tunnel. `--metrics 127.0.0.1:0` prevents metrics port conflicts.

Report the tunnel URL.

## 5. Framework-specific tunnel config

### Next.js: allowedDevOrigins

Next.js blocks cross-origin requests from unknown origins in dev mode. Without the tunnel hostname in `allowedDevOrigins`, client components do not hydrate (page stays stuck on loading state).

> **Important:** Next.js does NOT support wildcard subdomain matching (`.trycloudflare.com` does not work). The full tunnel hostname is required.

After obtaining the tunnel URL in step 4:

1. Extract the hostname from the tunnel URL (without `https://`)
2. Check whether `next.config` already has an `allowedDevOrigins` array with this hostname
3. If not → **replace** the entire `allowedDevOrigins` array with only the new hostname (old tunnel hostnames are invalid anyway)
4. **Wait 5 seconds** — Next.js detects config changes and restarts automatically
5. Verify that the server is still running after auto-restart:

```bash
sleep 5
for i in $(seq 1 15); do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000 2>/dev/null)
  [ "$HTTP_CODE" = "200" ] && echo "ready" && break
  sleep 1
done
```

6. If the server does NOT respond after 15s → restart manually (see step 3)
7. Verify again with curl loop, report tunnel URL

> Because quick tunnels get a random hostname on each start, this step must be executed every time.

### Vite: no action needed

Vite has no origin restriction in dev mode. After step 4 report the tunnel URL directly.

## Stop

On request to stop:

```bash
fuser -k 3000/tcp 2>/dev/null
# Kill framework processes (use what applies)
pkill -f "next dev" 2>/dev/null
pkill -f "next-router-worker" 2>/dev/null
pkill -f "vite" 2>/dev/null
# Kill tunnel
pkill -f cloudflared 2>/dev/null
```
