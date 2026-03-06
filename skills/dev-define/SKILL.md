---
name: dev-define
description: Feature requirements en architectuur definiëren met gestructureerde output. Gebruik met /dev-define voor feature specificaties voor de build-fase.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 2.3.0
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

   c) **Geen backlog of andere feature gewenst:**
   AskUserQuestion: "Welke feature wil je definiëren?" met 3 suggesties relevant voor het project.

3. **Project folder + context** (paralleliseer):
   - `mkdir -p .project/features/{feature-name}`
   - `mkdir -p .project/session && echo '{"feature":"{feature-name}","skill":"define","startedAt":"{ISO timestamp}"}' > .project/session/active-{feature-name}.json`
   - Glob + Grep voor bestaande code die de feature-naam importeert
   - Read `.project/project.json` → extract:
     - `stack` — framework, language, packages (fallback als stack-baseline.md niet bestaat)
     - `concept.pitch` als feature context (korte samenvatting). Fallback: als pitch leeg, gebruik eerste 2 zinnen van `concept.content`
     - `features[]` — bestaande features (voorkomt duplicaten/overlap)
     - `endpoints` — bestaande API surface
     - `data.entities` — bestaand data model
     - `context.patterns` — bestaande code patterns
   - Read `.claude/research/stack-baseline.md` (conventie/patterns detail — als niet beschikbaar, gebruik `project.json.stack` als basis)

**Tag backlog card als actief** (direct na feature naam bepaling):

Lees `.project/backlog.html` (als bestaat), parse JSON (zie `shared/BACKLOG.md`).
Zoek feature op naam → zet `"status": "DOING"`, `"stage": "defining"`, `"inProgress": "define"`, `data.updated` naar nu.
Schrijf terug via Edit (keep `<script>` tags intact).
Niet gevonden → skip (feature wordt pas bij FASE 4 aan backlog toegevoegd).
De card verhuist naar de DOING kolom met stage `defining`.

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

**≤3 requirements verwacht**: skip doorvraag, ga naar extraction.
**>3 requirements verwacht**: stel 1-2 gerichte doorvragen over de belangrijkste open branch. Formuleer als "Wat gebeurt er als...?" of "Hoe gaat dit om met...?"

Max 2 extra vragen, dan door naar extraction.

#### Requirement Extraction

Extraheer testbare requirements als tabel:

| ID  | Requirement | Category | Acceptance Criteria |
| --- | ----------- | -------- | ------------------- |

Bevestig met user via AskUserQuestion: "Akkoord (Recommended)" / "Aanpassen" / "Opnieuw beginnen"

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
   - **Pattern niet gevonden** → launch research agent:
     ```
     Agent(subagent_type="general-purpose", prompt="
     Feature: {feature-name}
     Requirements: {requirement lijst}
     Research architecture patterns. Gebruik Context7 voor library/framework
     patterns, WebSearch voor externe APIs en services.
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
3. Genereer task brief in terminal output vanuit feature.json data:

```
───────────────────────────────────────
TASK BRIEF — {feature-name}
Toegewezen aan: {naam}
───────────────────────────────────────

## {feature-name}
**Type:** {type} | **Prioriteit:** {phase} | **Status:** DEF

### Beschrijving
{summary uit feature.json}

### Requirements
| # | Requirement | Acceptatiecriteria |
|---|------------|-------------------|
{elke REQ uit feature.json}

### Bestanden
{elke file: actie + pad + doel}

### Build Volgorde
{genummerde stappen uit buildSequence}

### Test Strategie
{per REQ: testfile + beschrijving}

### Dependencies
{dependency + status als relevant}
```

4. Toon bericht: "Kopieer bovenstaande tekst en stuur naar {naam}."

### FASE 4: Sync

Volg `shared/SYNC.md` 3-File Sync Pattern. Skill-specifieke mutaties hieronder.

Lees parallel **direct voor het editen** (skip als niet bestaat) — vertrouw NIET op reads uit eerdere fases (Prettier/linters kunnen bestanden tussentijds wijzigen):

- `.project/backlog.html`
- `.project/project.json`

Muteer beide in memory:

**Backlog** (zie `shared/BACKLOG.md`):

- Zoek feature → zet status `"DOING"`, `stage: "defined"`, verwijder `inProgress` veld, datum `"{date}"`, `assignee` (als gezet in FASE 3b). Niet gevonden → voeg toe aan `data.features` met `phase: "P4"`.
- Zet `data.updated` naar vandaag.

**Dashboard** (zie `shared/DASHBOARD.md`):

- Update feature in `features` array: status → `"DOING"`, stage → `"defined"`, update summary
- Merge per entity type (check altijd op bestaande voor push):
  - **Data entities**: check op naam → nieuw: push met fields/relations → bestaand: merge nieuwe velden
  - **Endpoints**: check op method+path → nieuw: push met `status: "planned"` → bestaand: skip
  - **Stack packages**: check op naam → nieuw: push `{ name, version, purpose }` → bestaand: skip
  - **Features**: check op naam → nieuw: push `{ name, status: "DOING", stage: "defined", summary, created }` → bestaand: update status
  - **Architecture**: genereer/update `architecture` sectie als project meerdere componenten/modules heeft. **Volg diagram conventies uit `shared/DASHBOARD.md`**:
    - `diagram`: Mermaid `graph TD` met classDef (done/planned/external), subgraphs per domein, functionele node labels met file reference (`Naam<br/>file.js`). Alle features DOING → `:::planned`, bestaande gebouwde → `:::done`
    - `description`: functionele beschrijvingen per component (geen filenamen)
    - `files`: mapping van gebouwde componenten → `{ component, src: [...], test: [...] }`
    - OVERWRITE (vervangt vorige diagram met bijgewerkte versie)
    - Skip als single-file feature zonder architecturele impact

Schrijf parallel terug:

- Edit `backlog.html` (keep `<script>` tags intact)
- Edit `project.json` (gebruik Edit voor gerichte wijzigingen, niet Write)

Clean up: `rm -f .project/session/active-{feature-name}.json`

## Restrictions

- Schrijf GEEN implementatiecode (dat is /dev-build)
- Sla requirements extractie niet over
- Ga niet verder zonder user-bevestiging bij checkpoints
