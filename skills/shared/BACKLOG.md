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
      "status": "TODO|DEFINED|DOING|DONE",
      "stage": "defining|building|built|verifying|testing|null",
      "phase": "P1|P2|P3|P4",
      "description": "Beschrijving",
      "source": "concept|dev-todo",
      "dependency": "andere-feature|null",
      "assignee": "naam|null",
      "date": "2026-01-15|null",
      "auto": "true|null",
      "refactor": "REFACTORED|ROLLED_BACK|null"
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
TODO → DEFINED → DOING → DONE
```

| Status  | Betekenis                           | Gezet door                                                                  |
| ------- | ----------------------------------- | --------------------------------------------------------------------------- |
| TODO    | Idee, nog niet (klaar) gedefinieerd | /dev-plan, /dev-todo, /dev-define start, /frontend-design                   |
| DEFINED | Gedefinieerd, wacht op build-go     | /dev-define klaar, /game-define klaar                                       |
| DOING   | Claude bouwt of verifieert          | /dev-build, /dev-verify, /frontend-convert, /frontend-audit, /frontend-wcag |
| DONE    | Klaar (refactor optioneel)          | /dev-verify, /frontend-audit, /frontend-wcag                                |

`/dev-refactor` is een optionele kwaliteitsstap — geen status-gate. Schrijft `f.refactor` veld op DONE-features (zie Refactor-badges hieronder).

## Stage (voortgang-badge binnen kolom)

```
defining (TODO) → [DEFINED] → building → built → verifying|testing → [DONE]
```

| Stage     | Betekenis          | Kolom | Gezet door (dev)   | Gezet door (frontend)                        |
| --------- | ------------------ | ----- | ------------------ | -------------------------------------------- |
| defining  | Wordt gedefinieerd | TODO  | /dev-define FASE 0 | —                                            |
| building  | Wordt gebouwd      | DOING | /dev-build FASE 0  | /frontend-design of /frontend-convert FASE 0 |
| built     | Gebouwd            | DOING | /dev-build klaar   | /frontend-design of /frontend-convert klaar  |
| verifying | Wordt geverifieerd | DOING | /dev-verify FASE 0 | /frontend-audit of /frontend-wcag FASE 0     |
| testing   | Wordt getest       | DOING | /game-verify       | /frontend-wcag                               |

Frontend items slaan `defining` en de DEFINED-kolom over — `/frontend-design` (capture-mode) maakt items aan als TODO, en `/frontend-convert` pakt ze direct op als `DOING + building`.

`defined` als stage is **vervallen** — vervangen door eigen status `DEFINED`. `stage` is persistent — blijft staan tussen skill-invocaties. Wordt verwijderd bij overgang naar `DEFINED` (uit `defining`) en `DONE` (uit `verifying`/`testing`).

## Refactor-badges (DONE-kolom)

DONE-cards tonen een badge die `/dev-refactor`'s uitkomst reflecteert:

| `f.refactor` waarde | Badge  | Betekenis                                                                        |
| ------------------- | ------ | -------------------------------------------------------------------------------- |
| `null` / ontbreekt  | (geen) | Refactor nog niet gedraaid — feature is refactor-kandidaat                       |
| `"REFACTORED"`      | ✓      | Refactor voltooid (CLEAN-analyse en REFACTORED beide hieronder gerekend)         |
| `"ROLLED_BACK"`     | ⚠      | Refactor geprobeerd, teruggedraaid (zie `feature.json.refactor.failureAnalysis`) |

`/dev-refactor` schrijft dit veld op zowel `feature.json` als de backlog-feature in dezelfde sync.

## Features filteren

Voorbeelden van veelvoorkomende queries op het JSON object:

```
Volgende TODO feature:    data.features.find(f => f.status === "TODO")
Alle DEFINED features:    data.features.filter(f => f.status === "DEFINED")
Alle DOING features:      data.features.filter(f => f.status === "DOING")
Defined (klaar voor build): data.features.filter(f => f.status === "DEFINED")
Built (klaar voor test/audit): data.features.filter(f => f.status === "DOING" && f.stage === "built")
Alle DONE features:       data.features.filter(f => f.status === "DONE")
DONE niet-gerefactord:    data.features.filter(f => f.status === "DONE" && !f.refactor)
P1 features:              data.features.filter(f => f.phase === "P1")
```
