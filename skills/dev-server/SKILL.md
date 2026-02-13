---
name: dev-server
description: Start dev server with Cloudflare Tunnel for external access. Use with /dev-server to expose local development environment via public URL.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: dev
---

# Dev Server

Start the Next.js dev server and open a Cloudflare Tunnel so the site is accessible from any device via HTTPS.

## Trigger

`/dev-server`

## Process

### 1. Kill existing processes

```bash
pkill -f "next dev" 2>/dev/null; pkill -f cloudflared 2>/dev/null; sleep 1
```

### 2. Start dev server

```bash
npx next dev --port 3000 &
```

Wait for server to be ready:

```bash
for i in $(seq 1 15); do curl -s http://localhost:3000 > /dev/null && break || sleep 1; done
```

If not ready after 15 seconds, report error and stop.

### 3. Start Cloudflare Tunnel

```bash
cloudflared tunnel --url http://localhost:3000 2>&1 &
```

Wait for tunnel URL:

```bash
sleep 8
```

Read the tunnel process output to find the `trycloudflare.com` URL.

### 4. Report

Output the tunnel URL to the user. Example:

```
Dev server running on https://xxx-xxx-xxx.trycloudflare.com
```

### Stop

When the user asks to stop the dev server:

```bash
pkill -f "next dev"; pkill -f cloudflared
```
