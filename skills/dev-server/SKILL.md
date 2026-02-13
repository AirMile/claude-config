---
name: dev-server
description: Start dev server with Cloudflare Tunnel for external access. Use with /dev-server to expose local development environment via public URL.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.1.0
  category: dev
---

# Dev Server

Start the project's dev server and open a Cloudflare Tunnel so the site is accessible from any device via HTTPS.

## Trigger

`/dev-server`

## Process

### 1. Detect framework

Read `package.json` in the current project to determine which dev server to use:

```bash
cat package.json
```

- If `dependencies` or `devDependencies` contains `"next"` → **Next.js** (`npx next dev --port 3000`)
- If `dependencies` or `devDependencies` contains `"vite"` → **Vite** (`npx vite --port 3000 --host`)
- Otherwise → report error: "Geen ondersteund framework gevonden in package.json"

### 2. Kill existing processes on port 3000

Kill **anything** already listening on port 3000, regardless of framework. Also kill any existing cloudflared tunnel.

```bash
# Kill any process on port 3000
fuser -k 3000/tcp 2>/dev/null
# Kill cloudflared
pkill -f cloudflared 2>/dev/null
sleep 1
```

### 3. Verify port is free

```bash
ss -tlnp 2>/dev/null | grep :3000
```

If port 3000 is still occupied after kill, report error and stop.

### 4. Start dev server

Run the detected framework command:

**Vite:**
```bash
npx vite --port 3000 --host &
```

**Next.js:**
```bash
npx next dev --port 3000 &
```

Wait for server to be ready:

```bash
for i in $(seq 1 15); do curl -s http://localhost:3000 > /dev/null 2>&1 && break || sleep 1; done
```

If not ready after 15 seconds, report error and stop.

### 5. Verify correct server

After the server is ready, confirm the right project is running:

```bash
ss -tlnp 2>/dev/null | grep :3000
```

Check that the process path contains the current project directory. If it points to a different project, report the conflict and stop.

### 6. Start Cloudflare Tunnel

```bash
cloudflared tunnel --url http://localhost:3000 > /tmp/cloudflared.log 2>&1 &
sleep 8
grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cloudflared.log | head -1
```

### 7. Report

Output the tunnel URL to the user. Example:

```
Dev server running on https://xxx-xxx-xxx.trycloudflare.com
```

### Stop

When the user asks to stop the dev server:

```bash
fuser -k 3000/tcp 2>/dev/null; pkill -f cloudflared 2>/dev/null
```
