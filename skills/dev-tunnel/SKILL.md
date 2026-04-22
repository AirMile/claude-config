---
name: dev-tunnel
description: Start dev server with Cloudflare Tunnel for external access. Use with /dev-tunnel to expose local development environment via public URL.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 3.0.0
  category: dev
---

# Dev Tunnel

Start de dev server met Cloudflare Tunnel voor HTTPS-toegang vanaf elk apparaat.

## 1. Detect framework

Check `package.json` dependencies:

- `"vite"` → Vite project
- `"next"` → Next.js project
- Anders → fout: "Geen ondersteund framework gevonden in package.json"

**Start commands:**

| Framework | Command                                          |
| --------- | ------------------------------------------------ |
| Vite      | `node node_modules/.bin/vite --port 3000 --host` |
| Next.js   | `node node_modules/.bin/next dev -p 3000`        |

> **Belangrijk:** Gebruik altijd `node node_modules/.bin/...` in plaats van `npx`. `npx` wrapper-processen sterven soms stil onder `nohup`, terwijl directe `node` aanroep stabiel is.

## 2. Pre-flight checks

**Dependencies:** Als `node_modules` niet bestaat → `npm install` eerst.

**Vite allowedHosts:** Als Vite project, check of `vite.config` een `server.allowedHosts` heeft die `.trycloudflare.com` toestaat. Zo niet → voeg toe:

```js
server: {
  allowedHosts: [".trycloudflare.com"];
}
```

**Port 3000:** Gebruik `curl` om te detecteren of er al een server draait:

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000
```

- **200/3xx** → er draait iets. Check `/tmp/devserver.log` voor het project pad.
  - **Zelfde project** → skip naar stap 4
  - **Ander project** → meld welk project, kill alles (stap 2b), door naar stap 3
- **000 (geen connectie)** → vrij, door naar stap 3

### 2b. Cleanup (wanneer kill nodig is)

Kill in drie lagen om zombie processes te voorkomen:

```bash
# Laag 1: port-gebaseerd
fuser -k 3000/tcp 2>/dev/null

# Laag 2: framework processes (gebruik wat van toepassing is)
# Next.js:
pkill -f "next dev" 2>/dev/null
pkill -f "next-router-worker" 2>/dev/null
# Vite:
pkill -f "vite" 2>/dev/null

# Laag 3: tunnel
pkill -f cloudflared 2>/dev/null

sleep 2
```

> `fuser` en `ss` detecteren Node.js dev servers soms niet omdat de port op een manier gebonden wordt die niet zichtbaar is voor deze tools. Daarom altijd ook `pkill -f` met de framework-specifieke process naam gebruiken.

## 3. Start dev server

```bash
nohup [framework command] > /tmp/devserver.log 2>&1 &
echo $! > /tmp/devserver.pid
```

Wacht tot server klaar is met `curl` (max 20s, eerste compile kan lang duren):

```bash
for i in $(seq 1 20); do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000 2>/dev/null)
  [ "$HTTP_CODE" = "200" ] && echo "ready" && break
  sleep 1
done
```

Niet klaar na 20s → toon laatste 20 regels uit `/tmp/devserver.log` en stop.

> **Verificatie:** Gebruik altijd `curl` tegen `127.0.0.1:3000`, nooit `ss` of `lsof`. Deze tools detecteren Node.js dev servers niet betrouwbaar.

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

## 5. Framework-specifieke tunnel config

### Next.js: allowedDevOrigins

Next.js blokkeert cross-origin requests van onbekende origins in dev mode. Zonder de tunnel hostname in `allowedDevOrigins` hydrateren client components niet (pagina blijft hangen op loading state).

> **Belangrijk:** Next.js ondersteunt GEEN wildcard subdomain matching (`.trycloudflare.com` werkt niet). De volledige tunnel hostname is vereist.

Na het verkrijgen van de tunnel URL in stap 4:

1. Extract de hostname uit de tunnel URL (zonder `https://`)
2. Check of `next.config` al een `allowedDevOrigins` array heeft met deze hostname
3. Zo niet → **vervang** de hele `allowedDevOrigins` array met alleen de nieuwe hostname (oude tunnel hostnames zijn toch ongeldig)
4. **Wacht 5 seconden** — Next.js detecteert config changes en herstart automatisch
5. Verifieer dat de server nog draait na auto-restart:

```bash
sleep 5
for i in $(seq 1 15); do
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000 2>/dev/null)
  [ "$HTTP_CODE" = "200" ] && echo "ready" && break
  sleep 1
done
```

6. Als de server NIET meer reageert na 15s → handmatig herstarten (zie stap 3)
7. Verifieer opnieuw met curl-loop, rapporteer tunnel URL

> Omdat quick tunnels een random hostname krijgen bij elke start, moet deze stap elke keer uitgevoerd worden.

### Vite: geen actie nodig

Vite heeft geen origin-restrictie in dev mode. Na stap 4 direct de tunnel URL rapporteren.

## Stop

Bij verzoek om te stoppen:

```bash
fuser -k 3000/tcp 2>/dev/null
# Kill framework processes (gebruik wat van toepassing is)
pkill -f "next dev" 2>/dev/null
pkill -f "next-router-worker" 2>/dev/null
pkill -f "vite" 2>/dev/null
# Kill tunnel
pkill -f cloudflared 2>/dev/null
```
