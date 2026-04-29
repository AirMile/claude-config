# Backlog: HTML+JSON Format

De backlog is een interactieve HTML list view met embedded JSON data. Alle skills die de backlog lezen of schrijven gebruiken dezelfde aanpak.

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

`/dev-refactor` is de **promotion-trigger**: na een geslaagde refactor (CLEAN of REFACTORED) zet het `f.shipped = true` op het backlog-item. Shipped items verdwijnen uit de backlog-weergave en verhuizen naar het Dashboard.

**`f.shipped` veld:**

| Waarde              | Betekenis                                                                    |
| ------------------- | ---------------------------------------------------------------------------- |
| `false` / ontbreekt | Wacht op refactor of conventie-check — zichtbaar in "Wacht op refactor" zone |
| `true`              | Gepromoot naar Dashboard — niet meer zichtbaar in backlog                    |

Naast `shipped` schrijft `/dev-refactor` ook `f.shippedAt` (ISO-datumstring) en `f.shippedSha` (git blob sha van het refactor-commit) voor "as-shipped" snapshot detectie in het Dashboard.

## Pipeline

```
TODO (To define) → DEFINED (To build) → DOING (To verify) → DONE (To refactor) → shipped
```

| Status    | Sectie naam | Gezet door               |
| --------- | ----------- | ------------------------ |
| `TODO`    | To define   | /dev-todo, /dev-plan     |
| `DEFINED` | To build    | /dev-define (afsluiting) |
| `DOING`   | To verify   | /dev-build (afsluiting)  |
| `DONE`    | To refactor | /dev-verify (afsluiting) |

De UI is een single-scroll list view: elke status is een eigen sectie met een gekleurde linker border. Binnen elke sectie zijn features gegroepeerd per fase (P1/P2/P3/P4). Klik op een rij om inline details te zien, klik op ⋮ voor acties (status wijzigen, kopieer commando, bewerk, verwijder). Er is geen `stage`-veld — `status` volstaat.

## Refactor-badges ("To refactor" sectie)

Items met `status === "DONE"` worden getoond in de **"To refactor"** sectie van de backlog. Ze tonen een badge die `/dev-refactor`'s uitkomst reflecteert:

| `f.refactor` waarde | Badge  | Betekenis                                                                        |
| ------------------- | ------ | -------------------------------------------------------------------------------- |
| `null` / ontbreekt  | (geen) | Refactor nog niet gedraaid — feature is refactor-kandidaat                       |
| `"REFACTORED"`      | ✓      | Refactor voltooid (CLEAN-analyse en REFACTORED beide hieronder gerekend)         |
| `"ROLLED_BACK"`     | ⚠      | Refactor geprobeerd, teruggedraaid (zie `feature.json.refactor.failureAnalysis`) |

`/dev-refactor` schrijft dit veld op zowel `feature.json` als de backlog-feature in dezelfde sync. Bij CLEAN of REFACTORED volgt ook `f.shipped = true` en verhuist het item naar het Dashboard.

## Features filteren

Voorbeelden van veelvoorkomende queries op het JSON object:

```
Volgende TODO feature:    data.features.find(f => f.status === "TODO")
Alle DEFINED features:    data.features.filter(f => f.status === "DEFINED")
Alle DOING features:      data.features.filter(f => f.status === "DOING")
Defined (klaar voor build): data.features.filter(f => f.status === "DEFINED")
Actief (DOING):            data.features.filter(f => f.status === "DOING")
Alle DONE features:       data.features.filter(f => f.status === "DONE")
DONE niet-gerefactord:    data.features.filter(f => f.status === "DONE" && !f.refactor)
Wacht op refactor:        data.features.filter(f => f.status === "DONE" && !f.shipped)
Shipped (naar dashboard): data.features.filter(f => f.shipped === true)
P1 features:              data.features.filter(f => f.phase === "P1")
```
