---
name: dev-define
description: >-
  Define feature requirements and architecture before the build phase. Use
  with /dev-define [feature-name] to produce requirements, acceptance criteria,
  and architecture from a backlog item or a fresh name. Also handles PAGE and
  COMPONENT features from the backlog (functional pipeline, independent of
  /frontend-design).
writes:
  [feature.requirements, feature.architecture, feature.files, backlog.status]
metadata:
  author: mileszeilstra
  version: 2.6.0
  category: dev
---

# Feature Definition

FASE 1 van de dev workflow: define → build → test.

**Trigger**: `/dev-define` of `/dev-define [feature-name]`

## Workflow

### FASE 0: Feature Name & Context

1. **If name provided** (`/dev-define auth`): gebruik als feature name, ga naar stap 2b.

2. **If no name** (`/dev-define`):

   a) Read `.project/backlog.html` → parse JSON uit `<script id="backlog-data">`
   → Zoek eerste TODO: `data.features.find(f => f.status === "TODO")`

   b) **Als backlog feature gevonden:**
   AskUserQuestion: "Volgende feature uit backlog: **{name}**. Hiermee doorgaan?"
   - "{name} (Recommended)" / "Andere feature"
   - Backlog gekozen → stap 3. "Andere feature" → optie c.

   c) **Geen backlog maar concept aanwezig:**
   Lees `CONCEPT_CONTEXT` per `shared/CONCEPT.md`. Als `CONCEPT_CONTEXT.present`:
   AskUserQuestion:

   ```yaml
   header: "Concept zonder backlog"
   question: "Er is een concept maar nog geen backlog. Wil je eerst een backlog genereren?"
   options:
     - label: "Ja, eerst /project-plan (Recommended)", description: "Genereer backlog uit concept, dan features definiëren"
     - label: "Nee, direct definiëren", description: "Definieer een losse feature zonder backlog"
   multiSelect: false
   ```

   "Ja" → stop, toon: `Draai /project-plan om je concept om te zetten in een backlog.`
   "Nee" → ga door naar optie d.

   d) **Geen backlog, geen concept (of direct definiëren gekozen):**
   AskUserQuestion: "Welke feature wil je definiëren?" met 3 suggesties relevant voor het project.

2b. **Feature existence check** (na naam-bepaling, vóór context-load):

Check: `.project/features/{feature-name}/feature.json` bestaat?

- **Niet gevonden** → ga door naar stap 3 (gewone flow).
- **Gevonden** → ga naar FASE 0b (update-mode).

3. **Project folder + context** (paralleliseer):
   - `mkdir -p .project/features/{feature-name}`
   - `mkdir -p .project/session && echo '{"feature":"{feature-name}","skill":"define","startedAt":"{ISO timestamp}"}' > .project/session/active-{feature-name}.json`
   - Glob + Grep voor bestaande code die de feature-naam importeert. Bij 0 matches: stilzwijgend doorgaan. Bij ≥1 match: vermeld kort welke bestanden de naam al refereren.
   - Read `.project/project.json` → extract:
     - `stack` — framework, language, packages (fallback als stack-baseline.md niet bestaat)
     - `CONCEPT_CONTEXT.pitch` of eerste 2 zinnen van `CONCEPT_CONTEXT.markdown` als feature context (zie `shared/CONCEPT.md`)
     - `features[]` — bestaande features (voorkomt duplicaten/overlap)
     - `endpoints` — bestaande API surface
     - `data.entities` — bestaand data model
     - `thinking[]` — scan voor entries met `newFeature` veld matching de feature-naam (toegevoegd via `/project-todo`). Laad die als context.
     - `design.components[]` — bestaande component-specs (gebruikt voor reuse-discovery in FASE 1)
     - `design.pages[]` — bestaande page-specs (gebruikt voor reuse-discovery context)
   - **Onboarding check** (evalueer direct na project.json read):
     - `project.json` niet aanwezig → toon: `⚠️ Geen project.json gevonden. Overweeg eerst /core-setup te draaien voor betere codebase-context.`
     - Aanwezig maar leeg (geen `context`, `stack`, én `features`) → toon: `ℹ️ project.json bestaat maar mist codebase-context. /core-setup kan dit aanvullen.`
     - Aanwezig met content → stil doorgaan.
     - Niet-blocking — skill gaat altijd verder.
   - **Naam-match op thinking markdown**: Grep `.project/thinking/*.md` op feature-naam (bestandsnaam + content). Bij 1+ match: lees de match(es) en gebruik als input voor FASE 1 vragen. De `.md` bestanden zijn bron van waarheid voor thinking-output — geen 7-dagen window meer.
   - **Backlog card → TODO**: Read `.project/backlog.html` → parse JSON uit `<script id="backlog-data">`. Zoek feature op naam → behoud `status: "TODO"`, zet `date: "{date}"`. Niet gevonden → voeg toe aan `data.features` met `phase: "P4"`, `status: "TODO"`. Zet `data.updated` naar vandaag. Schrijf terug naar `backlog.html`.
   - Read `.project/project-context.json` (als bestaat) → extract:
     - `context.patterns` — bestaande code patterns
   - **Learnings load** via [shared/LEARNINGS-LOAD.md](../shared/LEARNINGS-LOAD.md):

     ```
     scopes: [component, architectural]
     pitfall-prefix: true
     current-feature: <feature-name>
     ```

     **Verplichte output bij ≥1 match** — toon als aparte chat-block vóór FASE 1 vragen (niet samengevoegd met past-decisions output):

     ```
     RELEVANTE LEARNINGS
     - [pattern] {summary} (uit feature {feature})
     - [pitfall] {summary} (uit feature {feature})
     ```

     Geen matches → toon niets, ga stil door.

   - Read `.claude/research/stack-baseline.md` (conventie/patterns detail — als niet beschikbaar, gebruik `project.json.stack` als basis)
   - **Past decisions scan** (twee bronnen, beide scope):
     - Feature-scope: Glob `.project/features/*/feature.json` → flatten alle `durableDecisions[]`. Tag elke entry met `[feature-X]`.
     - Project-scope: Glob `.project/thinking/*-decision-*.md` → lees eerste ~30 regels per file, extract `THINK:` regel (titel), `AANBEVELING:` regel (chosen), en `CONSTRAINT` sectie. Tag elke entry met `[project]`.
     - Merge beide bronnen. Filter relevant via keyword-overlap tussen huidige feature-naam/concept en elke decision's titel, chosen, of constraint (≥2 substantieve termen). Houd top 3 meest-relevante.

### FASE 0b: Update-mode (alleen als feature.json al bestaat)

1. Lees `.project/features/{feature-name}/feature.json`.

2. Toon bestaande requirements samenvatting:

   | ID      | Beschrijving (eerste 60 chars) | Status  |
   | ------- | ------------------------------ | ------- |
   | REQ-001 | {beschrijving}                 | pending |

3. AskUserQuestion: "Feature **{name}** bestaat al met {N} requirements. Wat wil je aanpassen?"

   ```yaml
   header: "Update-mode"
   options:
     - label: "Requirements toevoegen (Recommended)", description: "Nieuwe requirements via FASE 1 flow, doorgenummerd vanaf REQ-{N+1}"
     - label: "Requirements wijzigen", description: "Bestaande requirements herformuleren of acceptance aanpassen"
     - label: "Requirements verwijderen", description: "Requirements uit scope halen (soft-delete)"
     - label: "Meerdere van bovenstaande", description: "Combinatie van toevoegen, wijzigen en/of verwijderen"
   multiSelect: false
   ```

4. Verwerk delta op basis van keuze:
   - **Toevoegen**: Doorloop FASE 1 Requirements Gathering voor alleen de nieuwe requirements. Nummer door vanaf `REQ-{N+1}`.
   - **Wijzigen**: Vraag welke REQ-IDs. Per REQ: toon huidige beschrijving + acceptance, vraag nieuwe versie. Gebruik formaat `[{ when, then }]` per scenario.
   - **Verwijderen**: Vraag welke REQ-IDs. Markeer met `deltaOp: "REMOVED"` — verwijder niet fysiek uit de array. Ook: verwijder het REQ-ID uit alle `buildSequence[].requirements[]` arrays; als een step daarna leeg is → verwijder de step.
   - **Meerdere**: Combineer bovenstaande flows in één ronde.

5. Sla `deltaOp` op per requirement:
   - Ongewijzigd: `"deltaOp": "UNCHANGED"`
   - Nieuw: `"deltaOp": "ADDED"`
   - Gewijzigd: `"deltaOp": "MODIFIED"` + `"previousDescription": "{oorspronkelijke tekst}"`
   - Verwijderd: `"deltaOp": "REMOVED"` (blijft in array, wordt niet gebouwd of getest)

6. **Status-reset**: als feature `status` was `"DOING"` → zet terug naar `"DEFINED"` in `feature.json` en backlog.

7. Skip FASE 1b (feature splitting) tenzij het aantal requirements na update boven 6 stijgt én er duidelijke clusters zijn.

8. Ga naar FASE 2 voor alleen ADDED en MODIFIED requirements. UNCHANGED requirements hoeven geen herarchitectuur, tenzij MODIFIED requirements architecturale impact hebben (vraag user).

9. Bij FASE 3 write: **merge** delta naar bestaand `feature.json` — overschrijf niet volledig. Bewaar bestaande `architecture`, `apiContract`, `design`, `testStrategy`, `durableDecisions`, `research` en UNCHANGED requirements intact (tenzij MODIFIED requirements architecturale impact hebben — vraag user). `buildSequence`: verwijder stappen die leeg zijn na REMOVED-filtering; voeg nieuwe stappen toe voor ADDED requirements (uit FASE 2 architectuur output); bestaande stappen voor UNCHANGED requirements ongewijzigd laten.

---

### FASE 0c: Enter Plan Mode

Volg [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Entry-protocol vóór FASE 1. FASE 1 + 2 draaien in plan mode; alle FASE 2 design-output wordt naar de plan file geschreven ter review. Alle FASE 0 setup-writes zijn op dit punt al gedaan — file writes (feature.json, .project/\* updates) wachten tot na ExitPlanMode.

---

### FASE 1: Requirements Gathering

**Risk-check (alleen als `feature.risk >= 4`):**

Als de geladen backlog-feature een `risk`-score van 4 of 5 heeft, toon deze waarschuwing vóór de eerste vraag:

```
⚠ HOOG RISICO — Complexiteit {risk}/5

Deze feature heeft een hoge complexiteitsscore. Overweeg vóór de definitie:
- Splits de feature op in kleinere onderdelen
- Verifieer dat dependencies beschikbaar zijn
- Bespreek scope met de gebruiker als onderdelen onduidelijk zijn
```

**Surface relevant past decisions** (alleen bij ≥1 match uit FASE 0 scan, anders skip stilzwijgend):

```
EERDER BESLOTEN (mogelijk relevant)
- [project] {decision} → koos {chosen} (constraint: {constraint})
- [feature-X] {decision} → koos {chosen} (constraint: {constraint})
```

Toon vóór de eerste AskUserQuestion. Geen actie-vraag — alleen context zodat vraag-1 antwoorden niet conflicteren met eerder besloten richtingen. Als een huidige antwoord-optie direct conflicteert, noem dat kort in de optie-description ("Wijkt af van {feature-X} decision").

3-5 vragen via AskUserQuestion, afgestemd op stack en projecttype.

**Must-cover categorieën** (altijd dekken, formulering adaptief per stack):

- **Core function**: wat moet het doen vanuit gebruikersperspectief?
- **Data/state**: waar komt data vandaan, hoe wordt het opgeslagen/beheerd?
- **Output/contract**: wat levert het op? (backend: response types, error handling, exported interface. UI: events, visuele feedback. CLI: output format.)

**Vraag 1 (altijd): Core Function** — "Wat moet deze feature doen?" met 2-3 opties.

**Vraag 2-4 (adaptief)**: Dek de must-cover categorieën. Kies subcategorieën passend bij de stack (patterns, visual/output, persistence, API design). Leid opties af uit de baseline en bestaande code. Combineer gerelateerde vragen in één AskUserQuestion call als ze samen logisch zijn (max 2 per call).

**Vraag 5 (optioneel)**: Alleen bij complexe configuratie of meerdere benaderingen.

**User-delegatie**: als de user antwoordt met "wat denk jij?" of vergelijkbaar, geef een korte aanbeveling met trade-off en ga door met die keuze.

#### Doorvraag-check

Na de initiële vragen, evalueer of er open branches zijn:

- Onbesproken edge cases in de antwoorden
- Impliciete aannames die niet bevestigd zijn
- Conflicten tussen antwoorden

**Skip doorvraag** als de feature simpel is (≤5 verwachte REQs) EN er geen open branches zijn.
**Anders**: stel 1-2 gerichte doorvragen. Formuleer als "Wat gebeurt er als...?" of "Hoe gaat dit om met...?"

Max 2 extra vragen, dan door naar extraction.

#### Gray-Area Resolution

**Skip** als doorvraag-check geen open branches heeft gevonden.

**Anders**: voor elke geïdentificeerde open branch (max 3):

1. Formuleer de ambiguïteit als concrete keuze via AskUserQuestion:
   - Header: de open branch als korte zin
   - Opties: 2-3 concrete benaderingen + "Niet relevant voor scope"
   - Eerste optie = Recommended

2. Noteer de keuze als clarification:
   `{ "question": "{open branch}", "answer": "{gekozen optie}", "impact": "kort welk requirement-gebied dit raakt" }`

**"Niet relevant"** → noteer als scoped-out, niet als requirement.
**>3 open branches** → verwerk overige inline bij requirement extraction als edge case.

Max 3 AskUserQuestion calls. Dan door naar extraction.

#### Requirement Extraction + Checkpoint

Extraheer testbare requirements **intern** (geen tabel-output naar chat). Schrijf elk acceptance-scenario als een apart `{ when, then }` object. Meerdere condities → meerdere objecten (niet samenvoegen in één zin).

**Completeness self-check** (voer uit, NIET aan user tonen):

- Elk `when` is een concrete trigger (actie, input, toestand). Elk `then` is een observeerbaar resultaat (status code, UI-element, returnwaarde, state change). Niet vaag: "werkt goed", "goede performance", "gebruiksvriendelijk".
- Data sources geïdentificeerd (waar komt input/output vandaan?)
- Error/edge cases benoemd voor requirements met user input of externe data
- Geen overlap tussen requirements (twee REQs die hetzelfde beschrijven)
- Scope past bij 1 feature (als >10 REQs → markeer voor FASE 1b)

Fix gevonden gaps intern: voeg ontbrekende acceptance criteria toe, splits overlappende REQs, voeg edge case REQs toe.

**Korte chat-checkpoint** — toon alleen een beknopte numbered list (REQ-ID + 1-regel beschrijving, zonder category en zonder acceptance) zodat user kan bevestigen dat de scope klopt vóór architectuur-werk:

```
REQ-001 — {1-regel beschrijving}
REQ-002 — {1-regel beschrijving}
...
({N} requirements; volledige acceptance + overzicht volgt in plan file)
```

Bevestig met user via AskUserQuestion: "Klopt deze scope?"

- "Ja, ga door (Recommended)" — door naar scope analysis + architectuur
- "Aanpassen" — terug naar relevante vraag

De volledige requirements-tabel met acceptance criteria en de feature-overzicht-tabel worden alleen in de plan file geschreven (in FASE 2), niet inline in de chat.

#### Reuse-Discovery (optioneel — skip voor COMPONENT-features zelf)

**Wanneer uitvoeren:** alleen als de huidige feature type NIET `COMPONENT` is, én het een frontend-project is (stack.framework aanwezig).

Volg [Discovery — Reuse-Discovery](../shared/SKILL-PATTERNS.md#reuse-discovery) voor het canonieke protocol.

**Trigger:** keyword-scan op UI-element namen in requirements-tekst — Modal, Dialog, Drawer, Tooltip, Dropdown, Select, DatePicker, TimePicker, RichTextEditor, FileUpload, Avatar, Badge, Toast, Alert, Banner, Stepper, Wizard, Table, DataGrid, Carousel, Accordion, Tab, Breadcrumb, FormField, InputGroup, ColorPicker, Rating, Slider, Progress, Skeleton. Pas ook project-specifieke naam-prefixen toe. Voeg items in-memory toe (meegenomen naar FASE 4 sync); append kebab-naam ook aan huidige feature's `dependencies[]`.

**Source:** `"/dev-define"` · **Direction:** `"dev→frontend"` · **Type:** `COMPONENT`

---

### FASE 1b: Scope Analysis & Feature Splitting

**≤6 requirements**: toon ALTIJD één regel inline aan de gebruiker:

```
Scope: {N} requirements — SINGLE feature
```

Geen AskUserQuestion, geen extra uitleg. Daarna direct door naar FASE 2. Skip cluster-analyse.

**7-10 requirements**: cluster op afhankelijkheden. ≥2 clusters met ≤2 cross-deps → RECOMMEND SPLIT.

**>10 requirements**: RECOMMEND SPLIT (tenzij lineaire keten, single concern).

**Als SINGLE**: toon kort, ga door.

**Als SPLIT aanbevolen**:

1. Toon voorstel met clusters, build order, cross-dependencies
2. AskUserQuestion: "Akkoord met opsplitsing?" — Akkoord / Aanpassen / Eén feature houden
3. Bij split:
   - Schrijf `.project/features/{feature-name}/00-split.md` met: split decision, sub-feature tabel (requirements + focus), build order
   - Maak sub-feature folders: `mkdir -p .project/features/{feature-name}-{sub}`
   - Re-number requirements per sub-feature (REQ-001, REQ-002, etc.)
   - Doorloop FASE 2-4 per sub-feature in build order
   - Bij backlog: sync elke sub-feature individueel

### FASE 2: Architecture

**Output-regel voor deze hele fase**: schrijf het volledige architectuur-ontwerp **direct naar de plan file** (Write/Edit, gebruik het pad uit de FASE 0c system-reminder). **Toon geen design-tabellen, file-structuren, interfaces, build sequence of test strategy inline in de chat** — alleen een korte progress-marker (bv. `Architectuur ontworpen: N componenten, M files, K build steps. Plan file bijgewerkt.`).

**Uitzondering**: bij visuele features mag de ASCII-wireframe wél inline in een AskUserQuestion description verschijnen — anders kan user niet beoordelen vóór de finale plan-file write.

Ontwerp in drie stappen:

1. **Baseline check** (intern):
   - Doorzoek `stack-baseline.md` op patronen relevant voor deze feature
   - **Pattern gevonden** → gebruik als basis voor design, skip research
   - **Pattern niet gevonden** → inline research:
     - Call `resolve-library-id` + `query-docs` via Context7 voor library/framework patterns
     - Call WebSearch voor externe APIs en services
     - Focus: recommended patterns, state approach, file structure
       Na research: update `stack-baseline.md` met nieuwe patronen (append, niet overschrijven)
   - **Geen baseline file** → altijd research uitvoeren. Baseline NIET aanmaken (dat is /core-setup)

2. **Bestaande code** (intern): Glob + Read de meest relevante bestanden met vergelijkbare patterns. Dit informeert het ontwerp.

3. **Design** → schrijf naar plan file: feature flow, file structuur, interfaces/types, design sketch (alleen visueel), dependency analysis, build sequence, test strategy, AI-navigability beslissingen.
   - **Feature flow**: compacte `→`-keten van trigger tot output (conditionele paden in `[brackets]`, parallelle paden met `+`). Voorbeeld: `User click → validate input → [cache hit → return] / [cache miss → fetch API + update cache] → render response`.
   - **File structuur**: create/modify tabel.
   - **Interfaces/Types**: als relevant.
   - **Design sketch**: alleen voor visuele features — ASCII wireframe (web/UI) of scene composition (3D/game). Overweeg: responsive breakpoints, loading state, empty state, error state. Bevestig wireframe inline via AskUserQuestion (zie uitzondering bovenaan): "Klopt dit visuele ontwerp?" — "Ja (Recommended)" / "Aanpassen". Bij kleur-referenties in wireframes/acceptance criteria: gebruik token-namen (`bg-primary`, `text-foreground`) — geen hex-waarden. Zie `shared/TOKENS.md`.
   - **Dependency analysis**: REQ→REQ relaties.
   - **Build sequence**: genummerde implementatievolgorde. Combineer REQs in dezelfde step als ze dezelfde file raken en geen onderlinge dependencies hebben.
   - **Test strategy**: REQ→testfile→beschrijving tabel.
   - **AI-navigability** (evalueer na design, pas file structure/interfaces aan waar nodig — skip bij ≤3 bestanden zonder nieuw pattern):
     - _Module exports_: Per nieuw bestand: wat is public, wat is private? Bij >3 bestanden in dezelfde dir: overweeg barrel/index bestand.
     - _Registries_: Meerdere instances van hetzelfde concept (endpoints, commands, entities)? → Centraliseer in één bestand. Noteer in `architecture.registries[]`.
     - _Structuur_: Plat vs genest? Richtlijn: plat tenzij >10 files of duidelijke subcategorieën. Volg bestaande projectconventie.
     - _Test locatie_: Colocated of apart? Documenteer in `testStrategy.location`.
     - _Module boundaries_: Welke modules importeren van welke? Noteer verboden imports bij circulaire risico's.

**Einde denkfase**: volg [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Exit-protocol — schrijf het volledige architectuur-design naar de plan file, dan `ExitPlanMode`. Na approval gaat de skill verder met FASE 3 (feature.json schrijven).

### FASE 3: Write feature.json

Schrijf `.project/features/{feature-name}/feature.json` (zie `shared/FEATURE.md` voor volledig schema):

| Veld                        | Conditie                                                                                                                                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`, `created`, `status` | altijd (status = `"DEFINED"`, geen stage — wacht op `/dev-build`)                                                                                                                                  |
| `summary`                   | altijd                                                                                                                                                                                             |
| `depends`                   | altijd (lege array als geen)                                                                                                                                                                       |
| `choices`                   | altijd (user antwoorden)                                                                                                                                                                           |
| `requirements`              | altijd (elke REQ met `status: "pending"`, `acceptance: [{when, then}]`)                                                                                                                            |
| `files`                     | altijd (genormaliseerd: `path`, `type`, `action`, `purpose`, `requirements`)                                                                                                                       |
| `architecture`              | altijd (`componentTree`, `interfaces`, optioneel `registries[]`)                                                                                                                                   |
| `design`                    | alleen visuele features                                                                                                                                                                            |
| `apiContract`               | alleen bij backend                                                                                                                                                                                 |
| `buildSequence`             | altijd                                                                                                                                                                                             |
| `testStrategy`              | altijd (optioneel `location` veld)                                                                                                                                                                 |
| `clarifications`            | alleen opnemen als gray-area resolution minimaal 1 antwoord heeft opgeleverd — anders veld WEGLATEN (geen lege array)                                                                              |
| `durableDecisions`          | bij >3 requirements — beslissingen die over alle REQs gelden                                                                                                                                       |
| `research`                  | alleen als research is gedaan                                                                                                                                                                      |
| `externalRef`               | alleen als het backlog-item dit veld had — kopieer 1:1 (`type`, `id`, `url`, `labels`, `split`). Traceerbaarheid naar externe issue-tracker voor downstream skills (`/dev-build`, `/core-commit`). |

**`durableDecisions`** — beslissingen die tijdens de build NIET veranderen:

- Persistentie-strategie (welke storage API, welk formaat)
- ID-generatie en idempotency-contract
- Key data models en hun relaties
- Externe service boundaries
- Route structuren / URL patronen (bij routing-features)
- Auth/authz aanpak (bij auth-features)

Alleen opnemen als er daadwerkelijk cross-requirement beslissingen zijn. Bij simpele features (≤3 REQs) overslaan.

**`buildSequence`** structuur — dev-build itereert dit direct:

```json
[
  {
    "step": 1,
    "requirements": ["REQ-001"],
    "description": "...",
    "dependsOn": []
  },
  {
    "step": 2,
    "requirements": ["REQ-002", "REQ-003"],
    "description": "...",
    "dependsOn": [1]
  }
]
```

### FASE 4: Sync

Volg `shared/SYNC.md` 3-File Sync Pattern. Skill-specifieke mutaties hieronder.

Lees parallel **direct voor het editen** (skip als niet bestaat) — vertrouw NIET op reads uit eerdere fases (Prettier/linters kunnen bestanden tussentijds wijzigen):

- `.project/backlog.html`
- `.project/project.json`
- `.project/project-context.json`

Muteer in memory:

**Backlog** (zie `shared/BACKLOG.md`):

- Zoek feature → zet `status: "DEFINED"`, verwijder `transition` (als aanwezig). Niet gevonden → voeg toe aan `data.features` met `phase: "P4"`, `status: "DEFINED"`.
- **Dependencies**: Als tijdens FASE 1 of FASE 2 externe feature-afhankelijkheden zijn geïdentificeerd (andere features die eerst DONE moeten zijn), merge die naar `dependencies[]`. Verwijder nooit bestaande waarden — alleen toevoegen. Als niets nieuws gevonden: laat het veld ongewijzigd.
- Zet `data.updated` naar vandaag.

**Dashboard** (zie `shared/DASHBOARD.md`):

- Update feature in `features` array: status → `"DEFINED"`, update summary
- Merge per entity type (check altijd op bestaande voor push):
  - **Data entities** (optioneel — alleen als feature domain entities introduceert): check op naam → nieuw: push met fields/relations → bestaand: merge nieuwe velden. Als feature geen entities heeft (UI-only, refactor, utility): skip deze update, log `Skipped data.entities: no entities`.
  - **Endpoints**: check op method+path → nieuw: push met `status: "planned"`, `auth: "public" | "user" | "admin"` (default `"public"`, gebruik `"user"` als JWT/session vereist, `"admin"` als role-check vereist; laat `auth` veld weg bij projecten zonder auth) → bestaand: skip
  - **Routes** in `.project/project-context.json` → `architecture.routes[]`: voor elke nieuwe pagina-route in deze feature → check op `path` → nieuw: push `{ path, purpose, feature: "<feature-name>" }` + `auth` veld alleen als project auth heeft → bestaand: update `purpose` als gewijzigd. Skip voor non-frontend features (pure API/utility).
  - **Stack packages**: check op naam → nieuw: push `{ name, version, purpose }` → bestaand: skip
  - **Features**: check op naam → nieuw: push `{ name, status: "DEFINED", summary, created }` → bestaand: update status
  - **Architecture** in `.project/project-context.json`: genereer/update `architecture` sectie als project meerdere componenten/modules heeft. **Volg component-first model uit `shared/DASHBOARD.md`**:
    - `layers`: optioneel — definieer lagen met `{ name, order }` als project expliciete layer-naming gebruikt (bijv. API Laag order 1, Data Laag order 3). Skip als project dit niet hanteert.
    - `dataFlow`: één-regel samenvatting van de request flow
    - `components`: per component `{ name, layer, description, status, connects_to }`. Nieuwe feature componenten → `status: "planned"`. Bestaande gebouwde → `status: "done"`. Externe services → `status: "external"`. `connects_to`: array van typed edges `{ to, type }` waar `type` een van `calls` | `reads` | `writes` | `depends_on` is (zie `shared/DASHBOARD.md` Edge velden voor mapping)
    - Merge strategie: check of component `name` al bestaat → nee: push → ja: merge (overschrijf status, merge `connects_to[]` met dedup op `to+type` combinatie)
    - Optioneel: genereer Mermaid diagram naar `.project/architecture.mmd` voor visuele context
    - Skip als single-file feature zonder architecturele impact
  - **Context** in `.project/project-context.json`: update `context.structure` en `context.routing` als de feature nieuwe bestanden of routes toevoegt. **Let op**: structure/routing zijn JSON-escaped strings — bij grote wijzigingen gebruik Write i.p.v. Edit om escaping-problemen te voorkomen.

**PAGE-seeding** (frontend projects only — skip voor pure API/backend/game features):

Volg [Discovery — Page-Discovery](../shared/SKILL-PATTERNS.md#page-discovery) voor het canonieke protocol.

**Trigger:** scan `feature.json#architecture.routes[]` en `feature.json#files[]`. Resolution: batch AskUserQuestion "Ja, alle" / "Selectie" / "Nee".

**Source:** `"/dev-define"` · **Direction:** `"dev→frontend"` · **Type:** `PAGE`

Schrijf parallel terug:

- Edit `backlog.html` (keep `<script>` tags intact)
- Edit `project.json` (features, endpoints, data, stack — gebruik Edit voor gerichte wijzigingen, niet Write)
- Edit/Write `project-context.json` (als architecture of context gewijzigd — Write bij grote diagram-wijzigingen)

**Auto-build markering** (na sync):

Lees backlog opnieuw, zoek feature, zet `"auto": true`, schrijf terug via Edit. Geen user-prompt — altijd auto markeren zodat de card een AUTO-badge krijgt en het clipboard het juiste `/dev-build`-commando geeft.

Clean up: `rm -f .project/session/active-{feature-name}.json`

**Output:**

```
DEFINE COMPLETE: {feature-name}

Requirements: {N} (met acceptance criteria)
Architecture: {component count} componenten
Files: feature.json + backlog + dashboard

Next: /dev-build {feature-name}
     /team-outsource {feature-name}   ← als je wilt delegeren aan een teammate
```

Laat de `Next`-regel weg als de feature géén backlog-item was én geen concept aanwezig is — wijs dan kort op het ontbreken van een backlog.

## Restrictions

- Schrijf GEEN implementatiecode (dat is /dev-build)
- Sla requirements extractie niet over
- Ga niet verder zonder user-bevestiging bij checkpoints
- Skip de `EnterPlanMode`/`ExitPlanMode` calls niet — die zijn nodig voor model-routers (zoals `opusplan`) om denkfasen onder een sterker model te draaien
