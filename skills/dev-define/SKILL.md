---
name: dev-define
description: Define feature requirements and architecture with structured output. Use with /dev-define to create feature specifications before building.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 2.2.0
  category: dev
---

# Feature Definition

FASE 1 van de dev workflow: define → build → test.

Verzamel requirements, ontwerp architectuur, genereer gestructureerd definitiebestand voor de build-fase.

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

   c) **Geen backlog of andere feature gewenst:**
   AskUserQuestion: "Welke feature wil je definiëren?" met 3 suggesties relevant voor het project.

3. **Project folder + context** (paralleliseer):
   - `mkdir -p .project/features/{feature-name}`
   - Glob + Grep voor bestaande code die de feature-naam importeert
   - Read `.project/project.json` → `concept.content` als context
   - Read `.claude/research/stack-baseline.md`

### FASE 1: Requirements Gathering

3-5 vragen via AskUserQuestion, afgestemd op stack en projecttype.

**Must-cover categorieën** (altijd dekken, formulering adaptief per stack):

- **Core function**: wat moet het doen vanuit gebruikersperspectief?
- **Data/state**: waar komt data vandaan, hoe wordt het opgeslagen/beheerd?
- **Interacties/output**: wat ziet of doet de gebruiker? (UI events, visuele feedback, CLI output, etc.)

**Vraag 1 (altijd): Core Function** — "Wat moet deze feature doen?" met 2-3 opties.

**Vraag 2-4 (adaptief)**: Dek de must-cover categorieën. Kies subcategorieën passend bij de stack (patterns, visual/output, persistence, API design). Leid opties af uit de baseline en bestaande code.

**Vraag 5 (optioneel)**: Alleen bij complexe configuratie of meerdere benaderingen.

**User-delegatie**: als de user antwoordt met "wat denk jij?" of vergelijkbaar, geef een korte aanbeveling met trade-off en ga door met die keuze.

#### Requirement Extraction

Extraheer testbare requirements als tabel:

| ID  | Requirement | Category | Test Type | Acceptance Criteria |
| --- | ----------- | -------- | --------- | ------------------- |

Bevestig met user via AskUserQuestion: "Akkoord (Recommended)" / "Aanpassen" / "Opnieuw beginnen"

### FASE 1b: Scope Analysis & Feature Splitting

**Cluster identificatie**: groepeer requirements op basis van afhankelijkheden:

- Requirements met directe dependencies → zelfde cluster
- Requirements zonder cross-dependencies → aparte clusters
- Geïsoleerde requirements → eigen cluster of bij dichtstbijzijnde gerelateerd cluster

**Decision logic:**

- ≤6 requirements, single concern → SINGLE
- 7-10 requirements → EVALUATE: ≥2 clusters met ≤2 cross-deps → RECOMMEND SPLIT
- \>10 requirements → RECOMMEND SPLIT (tenzij lineaire keten, single concern)

**Output**: toon scope analyse met totaal requirements, categorieën, en dependency depth.

**Als SINGLE**: toon kort, ga door.

**Als SPLIT aanbevolen**:

1. Toon voorstel met clusters, build order, cross-dependencies
2. AskUserQuestion: "Akkoord met opsplitsing?" — Akkoord / Aanpassen / Eén feature houden
3. Bij split:
   - Schrijf `.project/features/{feature-name}/00-split.md` met: split decision, sub-feature tabel (requirements + focus), build order
   - Maak sub-feature folders: `mkdir -p .project/features/{feature-name}-{sub}`
   - Re-number requirements per sub-feature (REQ-001, REQ-002, etc.)
   - Doorloop FASE 2-5 per sub-feature in build order
   - Bij backlog: sync elke sub-feature individueel

### FASE 2: Architecture

Ontwerp in drie stappen:

1. **Baseline check**:
   - Doorzoek `stack-baseline.md` op patronen relevant voor deze feature
   - **Pattern gevonden** → gebruik als basis voor design, skip research
   - **Pattern niet gevonden** → launch research:
     ```
     Task(subagent_type="general-purpose", prompt="
     Feature: {feature-name}
     Requirements: {requirement lijst}
     Research architecture patterns via Context7.
     Return: recommended patterns, state approach, file structure.
     ")
     ```
     Na research: update `stack-baseline.md` met nieuwe patronen (append, niet overschrijven)
   - **Geen baseline file** → altijd research uitvoeren. Baseline NIET aanmaken (dat is /core-setup)

2. **Bestaande code**: Glob + Read de meest relevante bestanden met vergelijkbare patterns. Dit informeert het ontwerp.

3. **Design**: ontwerp op basis van requirements, baseline en bestaande code:
   - **File structuur**: create/modify tabel
   - **Interfaces/Types**: als relevant
   - **Design sketch**: alleen voor visuele features — ASCII wireframe (web/UI) of scene composition (3D/game). Overweeg: responsive breakpoints, loading state, empty state, error state.
     Bij visuele features: bevestig wireframe met user via AskUserQuestion: "Klopt dit visuele ontwerp?" — "Ja (Recommended)" / "Aanpassen"
   - **Dependency analysis**: REQ→REQ relaties
   - **Build sequence**: genummerde implementatievolgorde
   - **Test strategy**: REQ→testfile→beschrijving tabel

### FASE 3: Write feature.json

Schrijf `.project/features/{feature-name}/feature.json` (zie `shared/FEATURE.md` voor volledig schema):

| Veld                        | Conditie                                                                     |
| --------------------------- | ---------------------------------------------------------------------------- |
| `name`, `created`, `status` | altijd (status = `"DEF"`)                                                    |
| `summary`                   | altijd                                                                       |
| `depends`                   | altijd (lege array als geen)                                                 |
| `choices`                   | altijd (user antwoorden)                                                     |
| `requirements`              | altijd (elke REQ met `status: "pending"`)                                    |
| `files`                     | altijd (genormaliseerd: `path`, `type`, `action`, `purpose`, `requirements`) |
| `architecture`              | altijd (`componentTree`, `interfaces`)                                       |
| `design`                    | alleen visuele features                                                      |
| `apiContract`               | alleen bij backend                                                           |
| `buildSequence`             | altijd                                                                       |
| `testStrategy`              | altijd                                                                       |
| `research`                  | alleen als research is gedaan                                                |

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
    "requirements": ["REQ-002"],
    "description": "...",
    "dependsOn": [1]
  },
  {
    "step": 3,
    "requirements": ["REQ-003", "REQ-004"],
    "description": "... (gecombineerd)",
    "dependsOn": [2]
  }
]
```

Gecombineerde steps: meerdere REQs in `requirements[]` array, `dependsOn` verwijst naar step nummers.

### FASE 4: Sync Backlog

1. Read `.project/backlog.html` → niet gevonden: skip.
2. Parse JSON uit `<script id="backlog-data">`.
3. Zoek feature → zet status `"DEF"`, datum `"{date}"`. Niet gevonden → voeg toe aan adhoc.
4. Zet `data.updated` naar vandaag. Schrijf terug via Edit (keep `<script>` tags intact).

### FASE 5: Dashboard Sync

1. Read `.project/project.json`
2. Update feature in `features` array: status → `"DEF"`, update summary
3. Merge per entity type (check altijd op bestaande voor push):
   - **Data entities**: check op naam → nieuw: push met fields/relations → bestaand: merge nieuwe velden
   - **Endpoints**: check op method+path → nieuw: push met `status: "planned"` → bestaand: skip
   - **Stack packages**: check op naam → nieuw: push `{ name, version, purpose }` → bestaand: skip
   - **Features**: check op naam → nieuw: push `{ name, status: "DEF", summary, created }` → bestaand: update status
   - **Architecture**: genereer/update `architecture` sectie als project meerdere componenten/modules heeft:
     - `diagram`: Mermaid `graph TD` vanuit componentTree — nodes voor modules/services, edges voor dependencies/data flow. Gebruik `[(DB)]` voor databases, `[Service]` voor modules, `{{Gateway}}` voor middleware
     - `description`: markdown overzicht + componentenlijst met verantwoordelijkheden
     - OVERWRITE (vervangt vorige diagram met bijgewerkte versie)
     - Skip als single-file feature zonder architecturele impact
4. Write `.project/project.json`

## Restrictions

- Schrijf GEEN implementatiecode (dat is /dev-build)
- Sla requirements extractie niet over
- Ga niet verder zonder user-bevestiging bij checkpoints
