---
name: dev-define
description: Feature requirements en architectuur definiëren. Gebruik bij /dev-define [feature-name] om een feature te specificeren voor de build-fase.
metadata:
  author: mileszeilstra
  version: 2.4.0
  category: dev
---

# Feature Definition

FASE 1 van de dev workflow: define → build → test.

**Trigger**: `/dev-define` of `/dev-define [feature-name]`

## Workflow

### FASE 0: Feature Name & Context

1. **If name provided** (`/dev-define auth`): gebruik als feature name, ga naar stap 3.

2. **If no name** (`/dev-define`):

   a) Read `.project/backlog.html` → parse JSON uit `<script id="backlog-data">`
   → Zoek eerste TODO: `data.features.find(f => f.status === "TODO")`

   b) **Als backlog feature gevonden:**
   AskUserQuestion: "Volgende feature uit backlog: **{name}**. Hiermee doorgaan?"
   - "{name} (Recommended)" / "Andere feature"
   - Backlog gekozen → stap 3. "Andere feature" → optie c.

   c) **Geen backlog maar concept aanwezig:**
   Check of `.project/project-concept.md` bestaat (of `project.json` → `concept.content` niet leeg).
   Als concept gevonden:
   AskUserQuestion:

   ```yaml
   header: "Concept zonder backlog"
   question: "Er is een concept maar nog geen backlog. Wil je eerst een backlog genereren?"
   options:
     - label: "Ja, eerst /dev-plan (Recommended)", description: "Genereer backlog uit concept, dan features definiëren"
     - label: "Nee, direct definiëren", description: "Definieer een losse feature zonder backlog"
   multiSelect: false
   ```

   "Ja" → stop, toon: `Draai /dev-plan om je concept om te zetten in een backlog.`
   "Nee" → ga door naar optie d.

   d) **Geen backlog, geen concept (of direct definiëren gekozen):**
   AskUserQuestion: "Welke feature wil je definiëren?" met 3 suggesties relevant voor het project.

3. **Project folder + context** (paralleliseer):
   - `mkdir -p .project/features/{feature-name}`
   - `mkdir -p .project/session && echo '{"feature":"{feature-name}","skill":"define","startedAt":"{ISO timestamp}"}' > .project/session/active-{feature-name}.json`
   - Glob + Grep voor bestaande code die de feature-naam importeert
   - Read `.project/project.json` → extract:
     - `stack` — framework, language, packages (fallback als stack-baseline.md niet bestaat)
     - `concept.pitch` of `concept.content` als feature context (korte samenvatting). Fallback: als beide leeg, lees `.project/project-concept.md` → eerste 2 zinnen
     - `features[]` — bestaande features (voorkomt duplicaten/overlap)
     - `endpoints` — bestaande API surface
     - `data.entities` — bestaand data model
     - `thinking[]` — twee checks:
     1. **Naam-match**: entries met `title` of `newFeature` matching de feature-naam → automatisch laden als context
     2. **Recent (afgelopen 7 dagen)**: entries met `date` binnen 7 dagen, NIET al geladen via naam-match. Als gevonden, toon via AskUserQuestion:
        ```yaml
        header: "Recente thinking-output gevonden"
        question: "Er zijn recente verkenningen/ideeën. Wil je deze als context gebruiken?"
        options:
          - label: "Ja, gebruik als context (Recommended)", description: "{N} entries: {titels kort}"
          - label: "Nee, overslaan", description: "Start zonder thinking-context"
        multiSelect: false
        ```
        "Ja" → lees de gekoppelde `.project/thinking/*.md` bestanden en gebruik als input voor FASE 1 vragen.
   - **Backlog card → DOING + "defining"**: Read `.project/backlog.html` → parse JSON uit `<script id="backlog-data">`. Zoek feature op naam → zet `status: "DOING"`, `stage: "defining"`, `date: "{date}"`. Niet gevonden → voeg toe aan `data.features` met `phase: "P4"`, `status: "DOING"`, `stage: "defining"`. Zet `data.updated` naar vandaag. Schrijf terug naar `backlog.html`.
   - Read `.project/project-context.json` (als bestaat) → extract:
     - `context.patterns` — bestaande code patterns
     - `learnings[]` — eerder geleerde patronen en pitfalls. Gebruik als input bij architectuur-keuzes en requirement-formulering.
   - Read `.claude/research/stack-baseline.md` (conventie/patterns detail — als niet beschikbaar, gebruik `project.json.stack` als basis)

### FASE 1: Requirements Gathering

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

Extraheer testbare requirements als tabel:

| ID  | Requirement | Category | Acceptance Criteria |
| --- | ----------- | -------- | ------------------- |

**Completeness self-check** (voer uit, NIET aan user tonen):

- Elk acceptance criterium is automatisch testbaar: bevat verwachte input → output, status codes, of meetbare condities. Meerdere condities in één criterium zijn OK (bijv. "201 bij succes, 400 bij >5, 409 bij duplicate"). Niet vaag: "werkt goed", "goede performance", "gebruiksvriendelijk".
- Data sources geïdentificeerd (waar komt input/output vandaan?)
- Error/edge cases benoemd voor requirements met user input of externe data
- Geen overlap tussen requirements (twee REQs die hetzelfde beschrijven)
- Scope past bij 1 feature (als >10 REQs → markeer voor FASE 1b)

Fix gevonden gaps inline: voeg ontbrekende acceptance criteria toe, splits overlappende REQs, voeg edge case REQs toe. De requirements tabel hierboven toont het uiteindelijke resultaat inclusief fixes.

Presenteer direct daarna het volledige overzicht:

| Aspect          | Waarde                       |
| --------------- | ---------------------------- |
| Feature         | {naam}                       |
| Core function   | {samenvatting user antwoord} |
| Data/state      | {samenvatting}               |
| Output/contract | {samenvatting}               |
| Requirements    | {N} requirements             |

Bevestig met user via AskUserQuestion: "Akkoord met requirements en overzicht?"

- "Akkoord (Recommended)" — door naar scope analysis + architectuur
- "Aanpassen" — terug naar relevante vraag

### FASE 1b: Scope Analysis & Feature Splitting

**≤6 requirements**: toon totaal + "SINGLE — ga door". Skip cluster-analyse.

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

Ontwerp in drie stappen:

1. **Baseline check**:
   - Doorzoek `stack-baseline.md` op patronen relevant voor deze feature
   - **Pattern gevonden** → gebruik als basis voor design, skip research
   - **Pattern niet gevonden** → inline research:
     - Call `resolve-library-id` + `query-docs` via Context7 voor library/framework patterns
     - Call WebSearch voor externe APIs en services
     - Focus: recommended patterns, state approach, file structure
       Na research: update `stack-baseline.md` met nieuwe patronen (append, niet overschrijven)
   - **Geen baseline file** → altijd research uitvoeren. Baseline NIET aanmaken (dat is /core-setup)

2. **Bestaande code**: Glob + Read de meest relevante bestanden met vergelijkbare patterns. Dit informeert het ontwerp.

3. **Design**: ontwerp op basis van requirements, baseline en bestaande code. Genereer een ASCII diagram van de gekozen architectuur (component layers, data flow, of module relaties — afhankelijk van project type):
   - **File structuur**: create/modify tabel
   - **Interfaces/Types**: als relevant
   - **Design sketch**: alleen voor visuele features — ASCII wireframe (web/UI) of scene composition (3D/game). Overweeg: responsive breakpoints, loading state, empty state, error state.
     Bij visuele features: bevestig wireframe met user via AskUserQuestion: "Klopt dit visuele ontwerp?" — "Ja (Recommended)" / "Aanpassen"
   - **Dependency analysis**: REQ→REQ relaties
   - **Build sequence**: genummerde implementatievolgorde. Combineer REQs in dezelfde step als ze dezelfde file raken en geen onderlinge dependencies hebben.
   - **Test strategy**: REQ→testfile→beschrijving tabel

### FASE 3: Write feature.json

Schrijf `.project/features/{feature-name}/feature.json` (zie `shared/FEATURE.md` voor volledig schema):

| Veld                                 | Conditie                                                                     |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| `name`, `created`, `status`, `stage` | altijd (status = `"DOING"`, stage = `"defined"`)                             |
| `summary`                            | altijd                                                                       |
| `depends`                            | altijd (lege array als geen)                                                 |
| `choices`                            | altijd (user antwoorden)                                                     |
| `requirements`                       | altijd (elke REQ met `status: "pending"`)                                    |
| `files`                              | altijd (genormaliseerd: `path`, `type`, `action`, `purpose`, `requirements`) |
| `architecture`                       | altijd (`componentTree`, `interfaces`)                                       |
| `design`                             | alleen visuele features                                                      |
| `apiContract`                        | alleen bij backend                                                           |
| `buildSequence`                      | altijd                                                                       |
| `testStrategy`                       | altijd                                                                       |
| `clarifications`                     | alleen als gray-area resolution is uitgevoerd                                |
| `durableDecisions`                   | bij >3 requirements — beslissingen die over alle REQs gelden                 |
| `research`                           | alleen als research is gedaan                                                |

**`durableDecisions`** — beslissingen die tijdens de build NIET veranderen:

- Route structuren / URL patronen
- Database schema shape
- Key data models en hun relaties
- Auth/authz aanpak
- Externe service boundaries

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

### FASE 3b: Toewijzing

AskUserQuestion:

```yaml
header: "Toewijzing"
question: "Wie gaat dit bouwen?"
options:
  - label: "Zelf bouwen (Recommended)"
    description: "Ik bouw dit met /dev-build"
  - label: "Teammate toewijzen"
    description: "Genereer een task brief"
multiSelect: false
```

**Zelf bouwen**: `assignee` blijft `null`. Ga door naar FASE 4.

**Teammate toewijzen**:

1. AskUserQuestion: "Naam van de teammate?" (vrije tekst)
2. Zet `assignee` in memory (meenemen naar FASE 4 backlog sync)
3. Genereer task brief in terminal output vanuit feature.json: header met naam/toewijzing, beschrijving, requirements tabel (ID + beschrijving + acceptatiecriteria), bestanden (actie + pad + doel), build volgorde, test strategie, dependencies.
4. Toon bericht: "Kopieer bovenstaande tekst en stuur naar {naam}."

### FASE 4: Sync

Volg `shared/SYNC.md` 3-File Sync Pattern. Skill-specifieke mutaties hieronder.

Lees parallel **direct voor het editen** (skip als niet bestaat) — vertrouw NIET op reads uit eerdere fases (Prettier/linters kunnen bestanden tussentijds wijzigen):

- `.project/backlog.html`
- `.project/project.json`
- `.project/project-context.json`

Muteer in memory:

**Backlog** (zie `shared/BACKLOG.md`):

- Zoek feature → zet `stage: "defined"`, `assignee` (als gezet in FASE 3b). Card staat al op DOING + "defining" sinds FASE 0. Niet gevonden → voeg toe aan `data.features` met `phase: "P4"`, `status: "DOING"`, `stage: "defined"`.
- Zet `data.updated` naar vandaag.

**Dashboard** (zie `shared/DASHBOARD.md`):

- Update feature in `features` array: status → `"DOING"`, stage → `"defined"`, update summary
- Merge per entity type (check altijd op bestaande voor push):
  - **Data entities**: check op naam → nieuw: push met fields/relations → bestaand: merge nieuwe velden
  - **Endpoints**: check op method+path → nieuw: push met `status: "planned"` → bestaand: skip
  - **Stack packages**: check op naam → nieuw: push `{ name, version, purpose }` → bestaand: skip
  - **Features**: check op naam → nieuw: push `{ name, status: "DOING", stage: "defined", summary, created }` → bestaand: update status
  - **Architecture** in `.project/project-context.json`: genereer/update `architecture` sectie als project meerdere componenten/modules heeft. **Volg component-first model uit `shared/DASHBOARD.md`**:
    - `layers`: definieer lagen met `{ name, order }` (bijv. API Laag order 1, Data Laag order 3)
    - `dataFlow`: één-regel samenvatting van de request flow
    - `components`: per component `{ name, layer, description, status, connects_to }`. Nieuwe feature componenten → `status: "planned"`. Bestaande gebouwde → `status: "done"`. Externe services → `status: "external"`. `connects_to`: array van component namen waar dit component naar communiceert
    - Merge strategie: check of component `name` al bestaat → nee: push → ja: merge (overschrijf status, append connects_to met dedup)
    - Optioneel: genereer Mermaid diagram naar `.project/architecture.mmd` voor visuele context
    - Skip als single-file feature zonder architecturele impact
  - **Context** in `.project/project-context.json`: update `context.structure` en `context.routing` als de feature nieuwe bestanden of routes toevoegt. **Let op**: structure/routing zijn JSON-escaped strings — bij grote wijzigingen gebruik Write i.p.v. Edit om escaping-problemen te voorkomen.

Schrijf parallel terug:

- Edit `backlog.html` (keep `<script>` tags intact)
- Edit `project.json` (features, endpoints, data, stack — gebruik Edit voor gerichte wijzigingen, niet Write)
- Edit/Write `project-context.json` (als architecture of context gewijzigd — Write bij grote diagram-wijzigingen)

Clean up: `rm -f .project/session/active-{feature-name}.json`

**Output:**

```
DEFINE COMPLETE: {feature-name}

Requirements: {N} (met acceptance criteria)
Architecture: {component count} componenten
Files: feature.json + backlog + dashboard

Next steps:
  1. /dev-plan → genereer backlog uit concept (als nog geen backlog)
  2. /dev-build {feature-name} → start implementatie (als backlog al bestaat)
```

## Restrictions

- Schrijf GEEN implementatiecode (dat is /dev-build)
- Sla requirements extractie niet over
- Ga niet verder zonder user-bevestiging bij checkpoints
