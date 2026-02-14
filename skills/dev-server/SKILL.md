---
name: dev-server
description: Start dev server with Cloudflare Tunnel for external access. Use with /dev-server to expose local development environment via public URL.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.3.0
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

### 2. Check what's already running

Check if port 3000 is already in use and by which project:

```bash
ss -tlnp 2>/dev/null | grep :3000
```

```bash
ls -l /proc/$(fuser 3000/tcp 2>/dev/null | tr -d ' ')/cwd 2>/dev/null
```

**Scenario A — Current project already running:**
If the process working directory matches the current project → skip to step 4 (check tunnel).

**Scenario B — Different project running:**
If a different project is on port 3000 → report which project was running, kill it, and continue to step 3.

**Scenario C — Nothing running:**
Continue to step 3.

### 3. Start dev server

Kill any existing process on port 3000 if needed (only in scenario B or C):

```bash
fuser -k 3000/tcp 2>/dev/null
sleep 1
```

Run the detected framework command with `nohup` so the process survives after the shell exits:

**Vite:**

```bash
nohup npx vite --port 3000 --host > /tmp/vite.log 2>&1 &
```

**Next.js:**

```bash
nohup npx next dev --port 3000 > /tmp/vite.log 2>&1 &
```

Wait for server to be ready:

```bash
for i in $(seq 1 15); do curl -s http://localhost:3000 > /dev/null 2>&1 && break || sleep 1; done
```

If not ready after 15 seconds, report error and stop.

### 4. Check existing tunnel

Check if cloudflared is already running and has a valid tunnel URL:

```bash
pgrep -f cloudflared > /dev/null && grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cloudflared.log 2>/dev/null | head -1
```

If a URL is found → skip to step 6 (report).

### 5. Start Cloudflare Tunnel

Kill any stale cloudflared process, then start fresh:

```bash
pkill -f cloudflared 2>/dev/null
sleep 1
```

```bash
nohup cloudflared tunnel --url http://localhost:3000 > /tmp/cloudflared.log 2>&1 &
```

Wait for the tunnel to establish, then extract the URL:

```bash
sleep 8
```

```bash
grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cloudflared.log | head -1
```

### 6. Report

Output the tunnel URL to the user. Example:

```
Dev server running on https://xxx-xxx-xxx.trycloudflare.com
```

### Stop

When the user asks to stop the dev server:

```bash
fuser -k 3000/tcp 2>/dev/null; pkill -f cloudflared 2>/dev/null
```
