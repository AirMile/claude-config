---
name: dev-server
description: Start dev server with Cloudflare Tunnel for external access. Use with /dev-server to expose local development environment via public URL.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 2.0.0
  category: dev
---

# Dev Server

Start de dev server met Cloudflare Tunnel voor HTTPS-toegang vanaf elk apparaat.

## 1. Detect framework

Check `package.json` dependencies:

- `"vite"` → `npx vite --port 3000 --host`
- `"next"` → `npx next dev --port 3000`
- Anders → fout: "Geen ondersteund framework gevonden in package.json"

## 2. Pre-flight checks

**Dependencies:** Als `node_modules` niet bestaat → `npm install` eerst.

**Vite allowedHosts:** Als Vite project, check of `vite.config` een `server.allowedHosts` heeft die `.trycloudflare.com` toestaat. Zo niet → voeg toe:

```js
server: {
  allowedHosts: [".trycloudflare.com"];
}
```

**Port 3000:** Check met `ss -tlnp | grep :3000` en identificeer het project via `/proc/[pid]/cwd`.

- **Zelfde project al actief** → skip naar stap 4
- **Ander project actief** → meld welk project, kill server + cloudflared, door naar stap 3
- **Vrij** → door naar stap 3

## 3. Start dev server

```bash
fuser -k 3000/tcp 2>/dev/null; pkill -f cloudflared 2>/dev/null; sleep 1
nohup [framework command] > /tmp/devserver.log 2>&1 &
```

Wacht tot server klaar is (max 15s):

```bash
for i in $(seq 1 15); do curl -s http://localhost:3000 > /dev/null 2>&1 && break || sleep 1; done
```

Niet klaar na 15s → toon error uit `/tmp/devserver.log` en stop.

## 4. Start tunnel

Check bestaande tunnel eerst:

```bash
pgrep -f cloudflared > /dev/null && grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cloudflared.log 2>/dev/null | head -1
```

Geen actieve tunnel → start nieuwe:

```bash
pkill -f cloudflared 2>/dev/null; sleep 1
nohup cloudflared tunnel --url http://localhost:3000 --config /dev/null --metrics 127.0.0.1:0 > /tmp/cloudflared.log 2>&1 &
sleep 10
grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cloudflared.log | head -1
```

> `--config /dev/null` voorkomt dat een named tunnel config (`~/.cloudflared/config.yml`) de quick tunnel breekt. `--metrics 127.0.0.1:0` voorkomt metrics port conflicten.

Rapporteer de tunnel URL.

## Stop

Bij verzoek om te stoppen:

```bash
fuser -k 3000/tcp 2>/dev/null; pkill -f cloudflared 2>/dev/null
```
