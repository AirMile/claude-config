# Backlog: HTML+JSON Format

De backlog is een interactieve HTML kanban met embedded JSON data. Alle skills die de backlog lezen of schrijven gebruiken dezelfde aanpak.

**Bestand:** `.workspace/backlog.html`
**Template:** `{skills_path}/shared/references/backlog-template.html`
**Server:** `{skills_path}/shared/references/serve-backlog.js` (poort 9876)

## Backlog lezen

1. Read `.workspace/backlog.html`
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
      "type": "FEATURE|API|INTEGRATION|UI|REFACTOR",
      "status": "TODO|DEF|BLT|TST|DONE",
      "phase": "P1|P2|P3",
      "description": "Beschrijving",
      "dependency": "andere-feature|null",
      "date": "2026-01-15|null"
    }
  ],
  "adhoc": [
    {
      "name": "item-naam",
      "type": "PAGE-GAP|FEATURE|...",
      "status": "TODO|DEF|BLT|TST|DONE",
      "description": "Beschrijving",
      "dependency": "null",
      "source": "bron van het ad-hoc item"
    }
  ],
  "notes": "Eventuele notities"
}
```

## Backlog schrijven

1. Read `.workspace/backlog.html` (volledige inhoud)
2. Parse het JSON-blok (zie hierboven)
3. Muteer het data object (status wijzigen, items toevoegen, etc.)
4. Zet `updated` naar huidige datum (`YYYY-MM-DD`)
5. Serialiseer het JSON object: `JSON.stringify(data, null, 2)`
6. Vervang het blok tussen `<script id="backlog-data" type="application/json">` en `</script>` met de nieuwe JSON
7. Write het volledige bestand terug naar `.workspace/backlog.html`

**Gebruik Edit tool** om alleen het JSON-blok te vervangen — niet het hele bestand herschrijven. Zorg dat de `<script>` tags intact blijven.

## Backlog genereren (nieuwe backlog)

1. Kopieer template: `{skills_path}/shared/references/backlog-template.html` → `.workspace/backlog.html`
2. Bouw het JSON data-object met alle features
3. Vervang het placeholder JSON in het `<script id="backlog-data">` blok met het echte data-object
4. Start de server als die niet draait:
   ```bash
   curl -s http://localhost:9876/ > /dev/null 2>&1 || nohup node {skills_path}/shared/references/serve-backlog.js > /tmp/backlog-server.log 2>&1 &
   ```
5. Toon de URL: `http://localhost:9876/{project-dir}`

## Status flow

```
TODO → DEF → BLT → TST → DONE
```

| Status | Betekenis              | Gezet door    |
| ------ | ---------------------- | ------------- |
| TODO   | Nog niet opgepakt      | /dev-plan     |
| DEF    | Gedefinieerd           | /dev-define   |
| BLT    | Gebouwd                | /dev-build    |
| TST    | Getest                 | /dev-test     |
| DONE   | Afgerond + gerefactord | /dev-refactor |

## Features filteren

Voorbeelden van veelvoorkomende queries op het JSON object:

```
Volgende TODO feature:    data.features.find(f => f.status === "TODO")
Alle DEF features:        data.features.filter(f => f.status === "DEF")
Alle BLT features:        data.features.filter(f => f.status === "BLT")
Alle TST features:        data.features.filter(f => f.status === "TST")
P1 (MVP) features:        data.features.filter(f => f.phase === "P1")
Ad-hoc items:             data.adhoc
```
