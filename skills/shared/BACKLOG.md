# Backlog: HTML+JSON Format

De backlog is een interactieve HTML kanban met embedded JSON data. Alle skills die de backlog lezen of schrijven gebruiken dezelfde aanpak.

**Bestand:** `.project/backlog.html`
**Template:** `{skills_path}/shared/references/backlog-template.html`
**Server:** `{skills_path}/shared/references/serve-backlog.js` (poort 9876)

## Backlog lezen

1. Read `.project/backlog.html`
2. Zoek het JSON-blok: `<script id="backlog-data" type="application/json">...</script>`
3. Parse de inhoud als JSON

**Data structuur:**

```json
{
  "project": "Projectnaam",
  "generated": "2026-01-15",
  "updated": "2026-01-20",
  "source": "/dev-plan",
  "overview": "Korte beschrijving",
  "features": [
    {
      "name": "feature-naam",
      "type": "FEATURE|API|INTEGRATION|UI|REFACTOR|PAGE|COMPONENT|THEME|A11Y|PERF|PAGE-GAP",
      "status": "TODO|DOING|DONE",
      "stage": "defining|defined|building|built|testing|null",
      "phase": "P1|P2|P3|P4",
      "description": "Beschrijving",
      "dependency": "andere-feature|null",
      "assignee": "naam|null",
      "date": "2026-01-15|null",
      "auto": "true|null"
    }
  ],
  "notes": "Eventuele notities"
}
```

## Backlog schrijven

1. Read `.project/backlog.html` (volledige inhoud)
2. Parse het JSON-blok (zie hierboven)
3. Muteer het data object (status wijzigen, items toevoegen, etc.)
4. Zet `updated` naar huidige datum (`YYYY-MM-DD`)
5. Serialiseer het JSON object: `JSON.stringify(data, null, 2)`
6. Vervang het blok tussen `<script id="backlog-data" type="application/json">` en `</script>` met de nieuwe JSON
7. Write het volledige bestand terug naar `.project/backlog.html`

**Gebruik Edit tool** om alleen het JSON-blok te vervangen — niet het hele bestand herschrijven. Zorg dat de `<script>` tags intact blijven.

## Parallel sync

Wanneer een skill meerdere bestanden tegelijk synchroniseert (backlog + project.json + feature.json):

1. **Lees parallel**: alle bestanden in één tool call batch
2. **Muteer in memory**: pas alle data objecten aan
3. **Schrijf parallel**: alle bestanden in één tool call batch

Dit reduceert 6+ sequentiële round-trips naar 2. Bestanden zijn onafhankelijk — geen volgorde vereist.

## Backlog genereren (nieuwe backlog)

1. Kopieer template: `{skills_path}/shared/references/backlog-template.html` → `.project/backlog.html`
2. Bouw het JSON data-object met alle features
3. Vervang het placeholder JSON in het `<script id="backlog-data">` blok met het echte data-object
4. Start de server als die niet draait:
   ```bash
   curl -s http://localhost:9876/ > /dev/null 2>&1 || nohup node {skills_path}/shared/references/serve-backlog.js > /tmp/backlog-server.log 2>&1 &
   ```
5. Toon de URL: `http://localhost:9876/{project-dir}/backlog`

## Status flow

```
TODO → DOING → DONE
```

| Status | Betekenis      | Gezet door                                                                                                  |
| ------ | -------------- | ----------------------------------------------------------------------------------------------------------- |
| TODO   | Niet opgepakt  | /dev-plan, /dev-todo, /frontend-plan                                                                        |
| DOING  | In bewerking   | /dev-define, /dev-build, /dev-verify, /frontend-compose, /frontend-convert, /frontend-audit, /frontend-wcag |
| DONE   | Getest & klaar | /dev-verify, /frontend-audit, /frontend-wcag                                                                |

`/dev-refactor` en `/frontend-iterate` zijn optionele kwaliteitsstappen — geen status-gate.

## Stage (voortgang binnen DOING)

```
defining → defined → building → built → verifying → [DONE]
```

| Stage     | Betekenis          | Gezet door (dev)   | Gezet door (frontend)                         |
| --------- | ------------------ | ------------------ | --------------------------------------------- |
| defining  | Wordt gedefinieerd | /dev-define FASE 0 | —                                             |
| defined   | Gedefinieerd       | /dev-define klaar  | —                                             |
| building  | Wordt gebouwd      | /dev-build FASE 0  | /frontend-compose of /frontend-convert FASE 0 |
| built     | Gebouwd            | /dev-build klaar   | /frontend-compose of /frontend-convert klaar  |
| verifying | Wordt geverifieerd | /dev-verify FASE 0 | /frontend-audit of /frontend-wcag FASE 0      |

Frontend items slaan `defining/defined` over — `/frontend-plan` maakt items aan als TODO, en `/frontend-compose` pakt ze direct op als `building`.

`stage` is persistent — blijft staan tussen skill-invocaties. Wordt verwijderd bij `DONE`.

## Features filteren

Voorbeelden van veelvoorkomende queries op het JSON object:

```
Volgende TODO feature:    data.features.find(f => f.status === "TODO")
Alle DOING features:      data.features.filter(f => f.status === "DOING")
Defined (klaar voor build): data.features.filter(f => f.status === "DOING" && f.stage === "defined")
Built (klaar voor test/audit): data.features.filter(f => f.status === "DOING" && f.stage === "built")
Alle DONE features:       data.features.filter(f => f.status === "DONE")
P1 features:              data.features.filter(f => f.phase === "P1")
```
