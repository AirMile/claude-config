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
      "status": "TODO|DEFINED|DOING|DONE|CANCELLED",
      "phase": "P1|P2|P3|P4",
      "description": "Beschrijving",
      "source": "concept|dev-todo",
      "dependencies": ["andere-feature"],
      "risk": "1-5|null",
      "assignee": "naam|null",
      "date": "2026-01-15|null",
      "auto": "true|null",
      "refactor": "REFACTORED|ROLLED_BACK|null",
      "audit": {
        "buildScreenshot": "<pad>",
        "buildSmokeStatus": "PASS|FAIL|SKIPPED",
        "buildSmokeError": "<korte reden — alleen bij FAIL>",
        "lastRun": "<YYYY-MM-DD>",
        "scopes": ["<scope-naam>"],
        "findings": { "critical": "<N>", "warnings": "<N>", "passed": "<N>" }
      }
    }
  ],
  "notes": "Eventuele notities"
}
```

Het `audit`-veld is **frontend-track-specifiek** (type `PAGE` of `COMPONENT`). `buildScreenshot`/`buildSmokeStatus`/`buildSmokeError` worden geschreven door `/frontend-design` Build (smoke-render). `lastRun`/`scopes`/`findings` worden geschreven door `/frontend-check` FASE 4.3. Geen veld is verplicht; consumers checken op aanwezigheid. PASS-status is af te leiden uit `findings.critical === 0` — geen aparte boolean nodig.

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
   # Respecteert $CLAUDE_PROJECTS_ROOT via lib/config.js (fallback: ~/projects)
   curl -s http://localhost:9876/ > /dev/null 2>&1 || nohup node {skills_path}/shared/references/serve-backlog.js > /tmp/backlog-server.log 2>&1 &
   ```
5. Toon de URL: `http://localhost:9876/{project-dir}/backlog`

## Status flow (twee tracks)

De backlog is verdeeld in twee tracks: **Frontend** (PAGE/COMPONENT) en **Dev** (alle overige types). Status-waarden zijn identiek, maar de labels en skills per status verschillen.

### Frontend track (PAGE/COMPONENT)

```
TODO (To design) → DEFINED (To convert) → DOING (To audit) → DONE (Shipped) → shipped
                        ↑ alleen Path B         ↑ Path A slaat DEFINED over
```

| Status      | Label        | Gezet door                                                        |
| ----------- | ------------ | ----------------------------------------------------------------- |
| `TODO`      | To design    | `/frontend-design` Capture, reuse-discovery                       |
| `DEFINED`   | To convert   | `/frontend-design` Brief (Path B — offline handoff)               |
| `DOING`     | To audit     | `/frontend-design` Build (Path A) of `/frontend-convert` (Path B) |
| `DONE`      | Shipped      | `/frontend-check` PASS (terminaal — geen refactor-stap)           |
| `CANCELLED` | Gearchiveerd | Handmatig via UI (○ knop), herstelbaar                            |

**Path A** (Build met Claude Code): TODO → DOING → DONE — DEFINED wordt overgeslagen.

**Path B** (Brief voor extern design): TODO → DEFINED → DOING → DONE.

`/frontend-check` PASS zet `f.shipped = true` direct — geen refactor-stap voor frontend cards.

### Dev track (FEATURE/API/UI/REFACTOR/BUG/etc.)

```
TODO (To define) → DEFINED (To build) → DOING (To verify) → DONE (To refactor) → shipped
                                                                  ↓ (handmatig)
                                                              CANCELLED (Gearchiveerd)
```

| Status      | Label        | Gezet door                             |
| ----------- | ------------ | -------------------------------------- |
| `TODO`      | To define    | `/dev-todo`, `/dev-plan`               |
| `DEFINED`   | To build     | `/dev-define` (afsluiting)             |
| `DOING`     | To verify    | `/dev-build` (afsluiting)              |
| `DONE`      | To refactor  | `/dev-verify` (afsluiting)             |
| `CANCELLED` | Gearchiveerd | Handmatig via UI (○ knop), herstelbaar |

`/dev-refactor` is de **promotion-trigger** voor dev-cards: na CLEAN of REFACTORED zet het `f.shipped = true` + `f.shippedAt` + `f.shippedSha`. Shipped items verdwijnen uit de backlog en verhuizen naar het Dashboard.

**`f.shipped` veld:**

| Waarde              | Betekenis                                                 |
| ------------------- | --------------------------------------------------------- |
| `false` / ontbreekt | Wacht op volgende stap — zichtbaar in de actieve sectie   |
| `true`              | Gepromoot naar Dashboard — niet meer zichtbaar in backlog |

### UI: dual-track swimlanes

Het backlog-board toont twee top-level swimlanes met eigen status-secties en eigen verb-labels. Track-pills (`All | Frontend | Dev`) bovenaan het board filteren op track. Binnen elke track zijn features gegroepeerd per fase (P1/P2/P3/P4).

```
═══ FRONTEND ════════════════════════════════════════
  ▾ To design    (PAGE/COMPONENT TODO)
  ▾ To convert   (PAGE/COMPONENT DEFINED — Path B)
  ▾ To audit     (PAGE/COMPONENT DOING)

═══ DEV ══════════════════════════════════════════════
  ▾ To define    (overige TODO)
  ▾ To build     (overige DEFINED)
  ▾ To verify    (overige DOING)
  ▾ To refactor  (overige DONE)
```

DONE+`shipped: true` (beide tracks) verdwijnen naar het Dashboard. CANCELLED is één gedeelde gearchiveerde sectie onderaan.

## Refactor-badges ("To refactor" sectie)

Items met `status === "DONE"` worden getoond in de **"To refactor"** sectie van de backlog. Ze tonen een badge die `/dev-refactor`'s uitkomst reflecteert:

| `f.refactor` waarde | Badge  | Betekenis                                                                        |
| ------------------- | ------ | -------------------------------------------------------------------------------- |
| `null` / ontbreekt  | (geen) | Refactor nog niet gedraaid — feature is refactor-kandidaat                       |
| `"REFACTORED"`      | ✓      | Refactor voltooid (CLEAN-analyse en REFACTORED beide hieronder gerekend)         |
| `"ROLLED_BACK"`     | ⚠      | Refactor geprobeerd, teruggedraaid (zie `feature.json.refactor.failureAnalysis`) |

`/dev-refactor` schrijft dit veld op zowel `feature.json` als de backlog-feature in dezelfde sync. Bij CLEAN of REFACTORED volgt ook `f.shipped = true` en verhuist het item naar het Dashboard.

## COMPONENT als first-class type

`type: "COMPONENT"` is een first-class backlog-type naast `PAGE`, `FEATURE`, `API`, etc. COMPONENT-features leven op de **Frontend track** — samen met PAGE — en doorlopen de frontend pipeline.

### Aanmaken

COMPONENT-todos worden aangemaakt door:

- `/frontend-design` Component-route (expliciete user-input)
- Dev-skills als reuse-discovery (suggestie, user-accept-only) — zie hieronder

Schema bij aanmaken:

```json
{
  "name": "button",
  "type": "COMPONENT",
  "status": "TODO",
  "phase": "P3",
  "description": "Primaire actie-trigger met primary/ghost/destructive varianten",
  "source": "/frontend-design",
  "scope": "atomic",
  "dependencies": []
}
```

**scope-veld op backlog-item** (spiegelt `design.components[].scope`):

| Waarde    | Betekenis                          |
| --------- | ---------------------------------- |
| `atomic`  | Klein herbruikbaar element         |
| `section` | Composiet binnen één page          |
| `layout`  | Multi-page wrapper (alle/meerdere) |

### Pipeline (Frontend track — identiek aan PAGE)

```
TODO (To design) → DOING (To audit) → DONE (Shipped)       ← Path A
TODO (To design) → DEFINED (To convert) → DOING → DONE     ← Path B
```

| Stap    | Skill               | Output                                                   |
| ------- | ------------------- | -------------------------------------------------------- |
| Design  | `/frontend-design`  | code (Build) of brief (Brief) + demo-page voor COMPONENT |
| Convert | `/frontend-convert` | code van brief (Path B only)                             |
| Audit   | `/frontend-check`   | A11Y + tokens + responsive — terminaal, zet `shipped`    |

**`/frontend-check` PASS is terminaal** — geen refactor-stap. Item shipt direct naar Dashboard.

### Reuse-discovery door dev-skills

Dev-skills suggereren COMPONENT-todos op basis van detectie tijdens page-werk:

| Skill        | Trigger                                                  |
| ------------ | -------------------------------------------------------- |
| `dev-define` | Requirements noemen UI-elementen niet in `design.*`      |
| `dev-plan`   | Cross-page pattern matching (threshold 2+ pages)         |
| `dev-build`  | Sub-component bij code-gen complex genoeg voor extractie |
| `dev-verify` | Herhalend visual pattern over meerdere pages             |

Alle suggesties zijn **user-accept-only** — geen auto-create. Geaccepteerde voorstellen worden in `feature.json#suggestionsLog[]` gelogd; afgewezen voorstellen ook (voor dedupe — geen herhaalde prompts).

Omgekeerde richting: een COMPONENT-build die links naar onbekende routes bevat → suggereert PAGE-todos.

### Multi-page components

Een NavBar met `scope: layout, appliesTo: all` is **één backlog-item** — niet één per page. Build patcht `app/layout.tsx` (of framework-equivalent) één keer. Alle PAGE-features die daarna gebouwd worden erven de NavBar automatisch via de layout-import.

Voor route-group-specifieke layout-components: `appliesTo: "route-group:authenticated"` → patch in `app/(auth)/layout.tsx`.

### Backlog-filter (dashboard)

Het backlog-dashboard toont track-pills (`All | Frontend | Dev`) om de kanban-weergave te filteren. `Frontend` toont alleen PAGE/COMPONENT items; `Dev` toont alle overige types. Het bestaande `type`-veld is de data source.

## Features filteren

Voorbeelden van veelvoorkomende queries op het JSON object:

```
Volgende TODO feature:      data.features.find(f => f.status === "TODO")
Alle DEFINED features:      data.features.filter(f => f.status === "DEFINED")
Alle DOING features:        data.features.filter(f => f.status === "DOING")
Defined (klaar voor build): data.features.filter(f => f.status === "DEFINED")
Actief (DOING):             data.features.filter(f => f.status === "DOING")
Alle DONE features:         data.features.filter(f => f.status === "DONE")
DONE niet-gerefactord:      data.features.filter(f => f.status === "DONE" && !f.refactor)
Wacht op refactor:          data.features.filter(f => f.status === "DONE" && !f.shipped)
Shipped (naar dashboard):   data.features.filter(f => f.shipped === true)
P1 features:                data.features.filter(f => f.phase === "P1")
Geblokkeerd:                data.features.filter(f => (f.dependencies||[]).some(d => { const x=data.features.find(g=>g.name===d); return !x||x.status!=="DONE"; }))
Hoog risico (TODO/DEFINED): data.features.filter(f => f.risk >= 4 && (f.status === "TODO" || f.status === "DEFINED"))
Gearchiveerd:               data.features.filter(f => f.status === "CANCELLED")
```
