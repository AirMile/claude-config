---
name: project-backlog-serve
description: Start, stop of check de backlog kanban server. Serveert alle project-backlogs via een enkele Node.js server op localhost:9876. Ondersteunt auth, invites en tunnel voor teammates.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 2.0.0
  category: project
---

# Backlog Serve

Start, stop of check de backlog kanban server die alle project-backlogs serveert.

## Trigger

`/backlog-serve` of `/backlog` — optioneel argument: `stop`, `invite <naam> <project>`, `invites`

## Process

### FASE 0: Check huidige status

```bash
curl -s http://localhost:9876/ > /dev/null 2>&1
```

Sla het resultaat op als `SERVER_RUNNING` (true/false).

### FASE 0.5: Auth setup

Check of `~/.claude/server-auth.json` bestaat:

```bash
test -f ~/.claude/server-auth.json && echo "EXISTS" || echo "MISSING"
```

**Als MISSING:** De server maakt automatisch een config aan bij eerste start met een random adminToken. Geen actie nodig.

**Als EXISTS:** Lees de adminToken voor gebruik in FASE 2:

```bash
node -e "console.log(JSON.parse(require('fs').readFileSync(require('os').homedir()+'/.claude/server-auth.json','utf8')).adminToken)"
```

### FASE 1: Actie uitvoeren

**Als argument `stop`:**

```bash
kill $(lsof -ti:9876) 2>/dev/null
```

- Server gestopt → bevestig aan gebruiker
- Geen server draaiend → meld dat er niks te stoppen is

**Als argument `invite <naam> <project>`:**

Maak een nieuwe invite aan via de admin API (server moet draaien):

```bash
curl -s -X POST http://localhost:9876/admin/invite \
  -H "Content-Type: application/json" \
  -H "Cookie: auth=<adminToken>" \
  -d '{"name":"<naam>","projects":["<project>"]}'
```

Toon het resultaat met de invite URL. Stop hier (geen server start nodig).

**Als argument `invites`:**

Lijst actieve invites:

```bash
curl -s http://localhost:9876/admin/invites -H "Cookie: auth=<adminToken>"
```

Toon tabel met naam, projecten en invite URL. Stop hier.

**Als SERVER_RUNNING = true (en geen speciaal argument):**

Spring direct naar FASE 1.5.

**Als SERVER_RUNNING = false (en geen speciaal argument):**

Start de server:

```bash
nohup node ~/.claude/skills/shared/references/serve-backlog.js > /tmp/backlog-server.log 2>&1 &
```

Wacht max 5 seconden op readiness:

```bash
for i in 1 2 3 4 5; do
  curl -s http://localhost:9876/ > /dev/null 2>&1 && break
  sleep 1
done
```

Als na 5 seconden niet bereikbaar → toon foutmelding + log output.

### FASE 1.5: Tunnel starten

Check of cloudflared tunnel al draait op port 9876:

```bash
pgrep -f "cloudflared.*9876" > /dev/null 2>&1 && echo "RUNNING" || echo "STOPPED"
```

**Als STOPPED:** Start een quick tunnel:

```bash
nohup cloudflared tunnel --url http://localhost:9876 > /tmp/cloudflared-backlog.log 2>&1 &
```

Wacht op de tunnel URL (max 15 seconden):

```bash
for i in $(seq 1 15); do
  URL=$(grep -oP 'https://[a-z0-9-]+\.trycloudflare\.com' /tmp/cloudflared-backlog.log | head -1)
  [ -n "$URL" ] && break
  sleep 1
done
echo "$URL"
```

Sla de tunnel URL op als `TUNNEL_URL`.

**Als RUNNING:** Parse de bestaande tunnel URL uit het log of process.

### FASE 2: Toon resultaat

Lees de adminToken uit `~/.claude/server-auth.json` en lees de invites.

```
Server:  http://localhost:9876
Tunnel:  {TUNNEL_URL}

Admin:   {TUNNEL_URL}/auth?token={adminToken}

Invites:
  - {naam} ({projecten}) → {TUNNEL_URL}/invite/{token}
  - ...

Projecten:
  - {project-naam} → {TUNNEL_URL}/{dir}/backlog (kanban)
  - ...
```

Als er geen invites zijn, hint: `Maak een invite: /backlog invite <naam> <project>`

Als er geen projecten gevonden zijn, vermeld dat en hint naar `/dev-plan` om er een te genereren.
