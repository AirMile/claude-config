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
  "source": "/project-plan",
  "overview": "Korte beschrijving",
  "features": [
    {
      "name": "feature-naam",
      "type": "FEATURE|API|INTEGRATION|UI|REFACTOR|PAGE|COMPONENT|THEME|A11Y|PERF|PAGE-GAP",
      "status": "TODO|DEFINED|DOING|DONE|CANCELLED",
      "phase": "P1|P2|P3|P4",
      "description": "Beschrijving",
      "source": "concept|project-todo",
      "dependencies": ["andere-feature"],
      "risk": "1-5|null",
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
      },
      "externalRef": {
        "type": "github|jira|linear",
        "id": "<issue/ticket id>",
        "url": "<full URL>",
        "itemId": "<ProjectV2 node id of null>",
        "assignees": ["<username>"],
        "labels": ["<label>"],
        "direction": "inbound|outbound",
        "syncedStatus": "open|closed|null",
        "syncedAt": "<YYYY-MM-DD>",
        "split": "frontend|backend|tests|null"
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

   **Bij items toevoegen — dedup-check (altijd, voor elke `data.features.push()`):**
   1. `data.features.find(f => f.name === kebab-name)` → al in backlog? → skip.
   2. Type COMPONENT: ook `project.json#design.components.find(c => c.name === kebab-name)` → al gespecificeerd? → link i.p.v. push.
   3. Discovery-flows: `feature.json#suggestionsLog.find(s => s.name === name && s.status === "rejected" && s.skill === current-skill)` → eerder afgewezen door huidige skill? → skip.

4. Zet `updated` naar huidige datum (`YYYY-MM-DD`)
5. Serialiseer het JSON object: `JSON.stringify(data, null, 2)`
6. Vervang het blok tussen `<script id="backlog-data" type="application/json">` en `</script>` met de nieuwe JSON
7. Write het volledige bestand terug naar `.project/backlog.html`

**Gebruik Edit tool** om alleen het JSON-blok te vervangen — niet het hele bestand herschrijven. Zorg dat de `<script>` tags intact blijven.

## Source-veld conventie

Het `source`-veld op een backlog-item geeft aan welke skill het aangemaakt heeft. Conventie: **altijd met voorloopslash**, bijv. `"/project-todo"`, `"/dev-define"`, `"/frontend-design"`. Items met `source: "/project-todo"` zijn INDEPENDENT — `/project-plan` mag ze nooit overschrijven bij backlog-rebuild. Readers accepteren ook de slash-loze variant (`"project-todo"`) en legacy-waarden (`"dev-todo"`) van bestaande items.

## Team-context

In team-repos waar collega's geen claude-config gebruiken: backlog blijft lokaal (`.project/` is gitignored), team gebruikt zijn eigen tracker. Zie `shared/TEAM.md` voor de volledige workflow.

Het **externalRef veld** linkt een backlog-item aan een externe issue/ticket. Eén issue kan meerdere items genereren via `/team-issues` smart split — die delen dezelfde `id` met verschillende `split` waarden.

```json
{
  "name": "oauth-login",
  "type": "PAGE",
  "source": "/team-issues",
  "externalRef": {
    "type": "github",
    "id": "123",
    "url": "https://github.com/owner/repo/issues/123",
    "labels": ["enhancement", "P1"],
    "split": "frontend"
  }
}
```

- `/team-issues` schrijft het bij intake
- `/dev-define` en `/frontend-design` kopiëren naar `feature.json`
- `/core-commit` leest om commit-messages te prefixen

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

| Status      | Label        | Gezet door                                                                    |
| ----------- | ------------ | ----------------------------------------------------------------------------- |
| `TODO`      | To design    | `/frontend-design` Capture, `/project-todo`, `/project-plan`, reuse-discovery |
| `DEFINED`   | To convert   | `/frontend-design` Brief (Path B — offline handoff)                           |
| `DOING`     | To audit     | `/frontend-design` Build (Path A) of `/frontend-convert` (Path B)             |
| `DONE`      | Shipped      | `/frontend-check` PASS (terminaal — geen refactor-stap)                       |
| `CANCELLED` | Gearchiveerd | Handmatig via UI (○ knop), herstelbaar                                        |

**Path A** (Build met Claude Code): TODO → DOING → DONE — DEFINED wordt overgeslagen.

**Path B** (Brief voor extern design): TODO → DEFINED → DOING → DONE.

`/frontend-check` PASS zet `f.shipped = true` direct — geen refactor-stap voor frontend cards.

### Wanneer welke skill voor PAGE/COMPONENT

| Situatie                                          | Skill                           |
| ------------------------------------------------- | ------------------------------- |
| Snelle "ik bedacht net iets" toevoeging           | `/project-todo`                 |
| Volledig ontwerp (screenshot, Figma, brief)       | `/frontend-design` Capture      |
| Bulk-init uit concept of brainstorm-output        | `/project-plan`                 |
| Pattern-detectie tijdens build (cross-page reuse) | `/project-plan` reuse-discovery |

Alle vier routes schrijven dezelfde JSON-structuur naar `data.features[]` met `type=PAGE` of `COMPONENT` en `status=TODO`. `/frontend-design` Capture voegt extra spec-velden toe (mock paths, brief, audit). De andere routes laten die velden leeg — `/frontend-design` Build vult ze later aan.

### Dev track (FEATURE/API/UI/REFACTOR/BUG/etc.)

```
TODO (To define) → DEFINED (To build) → DOING (To verify) → DONE (To refactor) → shipped
                                                                  ↓ (handmatig)
                                                              CANCELLED (Gearchiveerd)
```

| Status      | Label        | Gezet door                             |
| ----------- | ------------ | -------------------------------------- |
| `TODO`      | To define    | `/project-todo`, `/project-plan`       |
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

### Discovery door dev-skills

Triggers, resolution en persisteer-schema: zie [Discovery — Reuse-Discovery en Page-Discovery](./SKILL-PATTERNS.md#reuse-discovery).

Alle suggesties zijn **user-accept-only** — geen auto-create. Geaccepteerde en afgewezen voorstellen worden gelogd in `feature.json#suggestionsLog[]` (voor dedup — geen herhaalde prompts).

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
