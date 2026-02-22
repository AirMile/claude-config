---
name: project-backlog-serve
description: Start, stop of check de backlog kanban server. Serveert alle project-backlogs via een enkele Node.js server op localhost:9876.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: project
---

# Backlog Serve

Start, stop of check de backlog kanban server die alle project-backlogs serveert.

## Trigger

`/backlog-serve` of `/backlog` — optioneel argument: `stop`

## Process

### FASE 0: Check huidige status

```bash
curl -s http://localhost:9876/ > /dev/null 2>&1
```

Sla het resultaat op als `SERVER_RUNNING` (true/false).

### FASE 1: Actie uitvoeren

**Als argument `stop`:**

```bash
kill $(lsof -ti:9876) 2>/dev/null
```

- Server gestopt → bevestig aan gebruiker
- Geen server draaiend → meld dat er niks te stoppen is

**Als SERVER_RUNNING = true (en geen `stop` argument):**

Spring direct naar FASE 2 (server draait al).

**Als SERVER_RUNNING = false (en geen `stop` argument):**

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

### FASE 2: Toon resultaat

Haal de index op en toon:

```
Server: http://localhost:9876
Projecten met backlog:
  - {project-naam} → http://localhost:9876/{dir}
  - ...

Open in VS Code: Ctrl+Shift+P → "Simple Browser: Show" → URL
```

Als er geen backlogs gevonden zijn, vermeld dat en hint naar `/dev-plan` om er een te genereren.
