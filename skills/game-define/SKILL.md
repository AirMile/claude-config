---
name: game-define
description: Define game feature requirements and architecture with structured output. Use with /game-define to create detailed game feature specifications before building.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 2.2.0
  category: game
---

# Game Feature Definition

## Overview

This skill defines game feature requirements and architecture for Godot 4.x projects. It is FASE 1 of the gamedev workflow: plan -> **define** -> build -> test -> refactor.

The skill gathers requirements through targeted questions, optionally researches Godot scene architecture, and designs the implementation. Output is a consolidated documentation file ready for the build phase.

**Trigger**: `/game-define` or `/game-define [feature-name]`

## When to Use

**Triggers:**

- `/game-define` - Start with feature name prompt
- `/game-define abilities` - Define ability system
- `/game-define player-movement` - Define player movement

**Works best with:**

- Godot 4.x projects with GDScript
- Games needing scene trees, signals, resources

## Workflow

### FASE 0: Feature Name + Context

1. **If name provided** (`/game-define abilities`):
   - Use provided name as feature name
   - Continue to step 3

2. **If no name** (`/game-define`):

   **a) Check backlog for next feature:**

   ```
   Read(".project/backlog.html")
   ```

   - If backlog exists: parse JSON uit `<script id="backlog-data">` blok (zie `shared/BACKLOG.md`)
   - Zoek eerste TODO feature: `data.features.find(f => f.status === "TODO")`
   - Gebruik feature naam als suggestie

   **b) If backlog has a next feature:**

   Use **AskUserQuestion** tool:
   - header: "Feature Name"
   - question: "Volgende feature uit backlog: **{feature-name}**. Hiermee doorgaan?"
   - options:
     - label: "{feature-name} (Recommended)", description: "{description from backlog TODO list}"
     - label: "Andere feature", description: "Ik wil een andere feature definiëren"
   - multiSelect: false

   - If user picks the backlog feature → use that name, continue to step 3
   - If user picks "Andere feature" → fall through to option (c)

   **c) No backlog but concept exists:**

   Check of `.project/project-concept.md` bestaat (of `project.json` → `concept.content` niet leeg).
   Als concept gevonden:
   AskUserQuestion:

   ```yaml
   header: "Concept zonder backlog"
   question: "Er is een concept maar nog geen backlog. Wil je eerst een backlog genereren?"
   options:
     - label: "Ja, eerst /game-plan (Recommended)", description: "Genereer backlog uit concept, dan features definiëren"
     - label: "Nee, direct definiëren", description: "Definieer een losse feature zonder backlog"
   multiSelect: false
   ```

   "Ja" → stop, toon: `Draai /game-plan om je concept om te zetten in een backlog.`
   "Nee" → ga door naar optie d.

   **d) No backlog, no concept (or user chose direct define):**

   Use **AskUserQuestion** tool:
   - header: "Feature Name"
   - question: "Welke game feature wil je definiëren? Kies een suggestie of typ je eigen feature-naam via 'Other'."
   - options:
     - label: "Ability System", description: "Speler abilities en element-based krachten"
     - label: "Player Movement", description: "Beweging, controls, physics"
     - label: "Combat System", description: "Damage, health, knockback"
     - label: "UI System", description: "HUD, menus, ability selection"
   - multiSelect: false

   The user can type any feature name via the built-in "Other" option.

**Tag backlog card als actief** (direct na feature naam bepaling):

Lees `.project/backlog.html` (als bestaat), parse JSON (zie `shared/BACKLOG.md`).
Zoek feature op naam → zet `"status": "DOING"`, `"stage": "defining"`, `data.updated` naar nu.
Schrijf terug via Edit (keep `<script>` tags intact).
Niet gevonden → skip (feature wordt pas bij FASE 5 aan backlog toegevoegd).
De card verhuist naar de DOING kolom met stage `defining`.

3. **Create project folder + signal active feature:**

   ```bash
   mkdir -p .project/features/{feature-name}
   mkdir -p .project/session
   echo '{"feature":"{feature-name}","skill":"define","startedAt":"{ISO timestamp}"}' > .project/session/active-{feature-name}.json
   ```

4. **Load architecture-baseline as context:**

   ```
   Read(".claude/research/architecture-baseline.md")
   ```

   - If found: store as context for all subsequent phases (requirements, design, architecture)
   - If not found: note absence, continue without (research may be triggered in FASE 2)

   ```
   ℹ Architecture baseline loaded — context available for all phases.
   ```

   Or if not found:

   ```
   ⚠ Architecture baseline not found — run /core-setup to generate.
   ```

5. **Load project context** (paralleliseer met stap 4):
   - Glob + Grep voor bestaande code die de feature-naam importeert
   - Read `.project/project.json` → extract:
     - `stack` — framework, language, packages (fallback als architecture-baseline niet bestaat)
     - `concept.pitch` als feature context (korte samenvatting). Fallback: als pitch leeg, lees `.project/project-concept.md` → eerste 2 zinnen
     - `features[]` — bestaande features (voorkomt duplicaten/overlap)
     - `data.entities` — bestaand data model
     - `thinking[]` — scan voor entries met `newFeature` veld matching de feature-naam (toegevoegd via `/dev-todo`). Laad die als context.
   - **Naam-match op thinking markdown**: Grep `.project/thinking/*.md` op feature-naam (bestandsnaam + content). Bij 1+ match: lees de match(es) en gebruik als input voor FASE 1 vragen. De `.md` bestanden zijn bron van waarheid voor thinking-output — geen 7-dagen window meer.
   - Read `.project/project-context.json` (als bestaat) → extract:
     - `context.patterns` — bestaande code patterns
     - `learnings[]` — eerdere inzichten uit build/test/refactor (gebruik als input voor architectuurkeuzes)
   - Als project.json niet bestaat → ga door zonder (backwards compatible)

### FASE 1: Requirements Gathering

Ask 5 targeted questions using AskUserQuestion:

**Question 1: Core Function**

- header: "Core Function"
- question: "Wat moet deze feature doen vanuit spelersperspectief?"

**Question 2: Game Mechanics**

- header: "Mechanics"
- question: "Welke game mechanics zijn betrokken?"
- options: Physics-based, Turn-based, Real-time, State-based

**Question 3: Player Interactions**

- header: "Interactions"
- question: "Welke speler interacties moet deze feature ondersteunen?"
- options: Input controls, Collision triggers, UI selection, Automatic

**Question 4: Visual Feedback**

- header: "Visuals"
- question: "Welke visuele feedback is nodig?"
- options: Sprite animations, Particles, UI updates, Screen effects

**Question 5: Data Requirements**

- header: "Data"
- question: "Welke data moet worden opgeslagen/beheerd?"
- options: Stats/values, Inventory/collections, State persistence, Configuration

**User-delegatie**: als de user antwoordt met "wat denk jij?" of vergelijkbaar, geef een korte aanbeveling met trade-off en ga door met die keuze.

#### Doorvraag-check

Na de initiële vragen, evalueer of er open branches zijn:

- Onbesproken edge cases in de antwoorden
- Impliciete aannames die niet bevestigd zijn
- Conflicten tussen antwoorden

**≤3 requirements verwacht**: skip doorvraag, ga naar extraction.
**>3 requirements verwacht**: stel 1-2 gerichte doorvragen over de belangrijkste open branch. Formuleer als "Wat gebeurt er als...?" of "Hoe gaat dit om met...?"

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

#### Requirement Extraction

After questions, extract testable requirements:

- Each requirement gets an ID (REQ-001, REQ-002, etc.)
- Categorize by type (core, scene, script, signal)
- Determine test type for each
- Define acceptance criteria per requirement (concrete, verifiable conditions)

Show requirements table with acceptance criteria:

| ID      | Requirement   | Category   | Test Type | Acceptance Criteria    |
| ------- | ------------- | ---------- | --------- | ---------------------- |
| REQ-001 | {description} | {category} | {type}    | {verifiable condition} |

#### Tuning Levers & Edge Cases (mechanica-requirements)

Voor requirements die **getallen of timing** bevatten (damage, speed, cooldown, radius, etc.), extraheer tuning levers:

| Parameter | Default  | Min   | Max   | Impact                            |
| --------- | -------- | ----- | ----- | --------------------------------- |
| {naam}    | {waarde} | {min} | {max} | {wat verandert er voor de speler} |

Markeer defaults als `[PLACEHOLDER]` als ze nog niet geplaytest zijn.

Voor requirements met **interacties of state changes**, documenteer edge cases:

- Wat als de waarde 0 is?
- Wat als twee acties tegelijk triggeren?
- Wat als de speler maximale/minimale resource heeft?

Alleen relevante edge cases — niet elk requirement heeft ze. Skip bij simpele features (≤3 requirements zonder getallen).

Tuning levers worden opgeslagen in `feature.json` per requirement als `tuningLevers[]`.

**Confirm with user** via **AskUserQuestion**:

- header: "Requirements"
- question: "Akkoord met deze requirements?"
- options:
  - label: "Akkoord (Recommended)", description: "Requirements zijn compleet en correct"
  - label: "Aanpassen", description: "Ik wil requirements wijzigen of toevoegen"
  - label: "Opnieuw beginnen", description: "Verwerp alles en stel nieuwe vragen"
- multiSelect: false

**If "Aanpassen"** → ask what to change, update requirements table, re-confirm.
**If "Opnieuw beginnen"** → restart FASE 1 from Question 1.

### CHECKPOINT: Requirements Samenvatting

Na de requirements tabel bevestiging, presenteer een compleet overzicht:

| Aspect        | Waarde                      |
| ------------- | --------------------------- |
| Feature       | {naam}                      |
| Core function | {vanuit spelersperspectief} |
| Mechanics     | {gekozen mechanics}         |
| Interactions  | {gekozen interacties}       |
| Visuals       | {gekozen visuele feedback}  |
| Data          | {gekozen data management}   |
| Requirements  | {N} requirements            |

Vraag via AskUserQuestion: "Klopt dit overzicht voordat we doorgaan naar architectuur?"

- "Ga door (Recommended)" — door naar scope analysis + architectuur
- "Aanpassen" — terug naar relevante vraag

### FASE 1b: Scope Analysis & Feature Splitting

**Goal:** Analyze gathered requirements and decide whether to keep as a single feature or split into multiple sub-features for optimal build execution.

**Steps:**

1. **Analyze requirement scope:**

   Count requirements and map dependency graph from FASE 1 output.

   ```
   SCOPE ANALYSIS:

   Total requirements: {count}
   Categories: {list of unique categories}
   Dependency depth: {max chain length}
   ```

2. **Identify dependency clusters:**

   Group requirements that depend on each other into clusters:
   - Requirements with direct dependencies → same cluster
   - Requirements with no cross-dependencies → separate clusters
   - Single isolated requirements → own cluster or attach to nearest related cluster

3. **Apply decision logic:**

   ```
   IF requirements ≤ 6 AND single category/concern:
     → SINGLE feature (continue normally)

   IF requirements 7-10:
     → EVALUATE: check if ≥2 natural clusters exist with ≤2 cross-dependencies
     → If clusters found: RECOMMEND SPLIT
     → If tightly coupled: SINGLE feature

   IF requirements > 10:
     → RECOMMEND SPLIT (unless linear dependency chain with single concern)
   ```

4. **If SINGLE feature:**

   ```
   ✓ Scope analysis: SINGLE FEATURE

   Requirements: {count}
   Reason: {e.g., "tightly coupled, single concern", "≤6 requirements"}

   → Continuing to architecture design.
   ```

   Proceed to FASE 2.

5. **If SPLIT recommended:**

   Show proposed split:

   ```
   SPLIT RECOMMENDATION:

   Requirements: {count} → {n} sub-features

   1. {feature-name}-{sub1} (REQ-001, REQ-002, REQ-003)
      Focus: {description of this group's concern}

   2. {feature-name}-{sub2} (REQ-004, REQ-005)
      Focus: {description of this group's concern}

   Build order: {sub1} → {sub2}
   Cross-dependencies: {list or "none"}
   ```

   Use **AskUserQuestion** for confirmation:
   - header: "Feature Split"
   - question: "Akkoord met deze opsplitsing?"
   - options:
     - label: "Akkoord (Recommended)", description: "Opsplitsen in {n} sub-features"
     - label: "Aanpassen", description: "Ik wil de groepering wijzigen"
     - label: "Eén feature houden", description: "Niet splitsen, alles in één feature"
   - multiSelect: false

   **Response Handling:**
   - Akkoord → proceed with split
   - Aanpassen → ask which requirements should move where, regenerate split
   - Eén feature houden → proceed as SINGLE feature to FASE 2

6. **Execute split (if approved):**

   a. Create parent documentation:

   Write `.project/features/{feature-name}/00-split.md`:

   ````markdown
   # Feature Split: {Feature Name}

   **Created:** {date}
   **Status:** split
   **Original requirements:** {count}
   **Sub-features:** {count}

   ## Split Decision

   Reason: {why split was recommended}

   ## Sub-features

   | #   | Sub-feature   | Requirements              | Focus   |
   | --- | ------------- | ------------------------- | ------- |
   | 1   | {name}-{sub1} | REQ-001, REQ-002, REQ-003 | {focus} |
   | 2   | {name}-{sub2} | REQ-004, REQ-005          | {focus} |

   ## Build Order

   1. {name}-{sub1} (base, no dependencies)
   2. {name}-{sub2} (after {sub1})

   ## Commands

   ```
   /game-build {name}-{sub1}
   /game-build {name}-{sub2}
   ```
   ````

   b. Create sub-feature project folders:

   ```bash
   mkdir -p .project/features/{feature-name}-{sub1}
   mkdir -p .project/features/{feature-name}-{sub2}
   ```

   c. Continue FASE 2-5 for EACH sub-feature sequentially:
   - Re-number requirements per sub-feature (REQ-001, REQ-002, etc.)
   - Each sub-feature gets its own architecture, scene layout, and feature.json
   - Use build order: complete all FASEs for sub-feature 1 before starting sub-feature 2

7. **Update backlog (split only):**

   If `.project/backlog.html` exists:
   - Replace original feature entry with sub-feature entries
   - Each sub-feature gets its own line in the backlog
   - Add `(split from {original-name})` annotation

### FASE 2: Architecture Check (Automatisch)

**Goal:** Automatisch bepalen of research nodig is op basis van architecture-baseline.

**Steps:**

1. **Use pre-loaded architecture-baseline:**
   - Use the baseline context loaded in FASE 0
   - If baseline was not found in FASE 0, skip to step 5 (baseline not found fallback)

2. **Extract feature type from requirements:**
   Map the feature to a category:
   - "player" / "movement" → Player
   - "ability" / "abilities" / "spell" → Ability System
   - "combat" / "damage" / "health" → Combat
   - "projectile" / "bullet" → Projectile
   - "ui" / "hud" / "menu" → UI
   - "arena" / "round" / "match" → Arena

3. **Check Feature Pattern Index in baseline:**

   Look for matching row in `## Feature Pattern Index` table:

   ```
   | Feature Type | Node Type | Pattern | State Machine |
   |--------------|-----------|---------|---------------|
   | Player | CharacterBody2D | Composition | Enum-based |
   | Projectile | Area2D | Instancing | None |
   | Ability System | Node | Signal-based | None |
   | UI | Control | Sub-scenes | None |
   | Arena | Node2D | Coordinator | Round states |
   ```

4. **Decision:**

   **A) Pattern FOUND in baseline:**

   ```
   ✓ Architecture pattern gevonden in baseline

   | Field | Value |
   |-------|-------|
   | Feature Type | {type} |
   | Node Type | {from baseline} |
   | Pattern | {from baseline} |
   | State Machine | {from baseline} |

   → Baseline gebruiken, research overgeslagen.
   ```

   - Use patterns from baseline for FASE 3
   - Skip godot-scene-researcher agent

   **B) Pattern NOT FOUND in baseline:**

   ```
   ⚠ Geen architecture pattern gevonden voor "{feature-type}"

   → Research wordt uitgevoerd en baseline wordt bijgewerkt.
   ```

   - Launch godot-scene-researcher agent:

   ```
   Task(subagent_type="godot-scene-researcher", prompt="
   Feature: {feature-name}
   Type: {feature-type}

   Requirements:
   {list of requirements}

   Mechanics: {selected}
   Interactions: {selected}

   Research Godot 4.x scene architecture patterns for this feature.
   Return: Node type, scene pattern, signal patterns, state machine approach.
   ")
   ```

   - **Update architecture-baseline.md** with new pattern:
     - Add row to Feature Pattern Index table
     - Add relevant signal patterns if new
     - Add resource patterns if new

5. **Baseline not found fallback:**

   If `.claude/research/architecture-baseline.md` does not exist:

   ```
   ⚠ Architecture baseline niet gevonden.

   → Volledige research wordt uitgevoerd.
   Tip: Run /core-setup om baseline te genereren.
   ```

   - Always launch godot-scene-researcher agent
   - Do NOT create baseline (that's /setup's job)

### FASE 2b: Scene Layout & Gameplay Flow

**Goal:** Define visual scene layout and gameplay state flow before architecture design.

**Condition:** Only execute this phase if the feature involves visual elements (scenes, sprites, UI, particles). If the feature is non-visual (pure data, logic, resources), skip with:

```
FASE 2b: N/A — non-visual feature
```

**Steps:**

1. **Describe layout in ASCII scene layout:**

   ```
   ┌─────────────────────────────┐
   │ Camera2D (viewport)         │
   │  ┌──────┐  ┌──────────┐   │
   │  │Player│→ │ Projectile│   │
   │  └──────┘  └──────────┘   │
   │        ┌────────┐          │
   │        │ Puddle │          │
   │        └────────┘          │
   └─────────────────────────────┘
   ```

2. **Define gameplay state diagram:**

   ```
   idle → casting → cooldown → idle
          ↓
        cancelled
   ```

   - Map key states and transitions
   - Note triggers for each transition (input, timer, signal)

3. **Map nodes to scene layout:**
   - Label each element with the node type
   - Note key interactive elements (collision areas, raycasts, timers)
   - Identify state-dependent visual changes (animations, visibility, modulate)

4. **Confirm with user:**
   Use **AskUserQuestion**:
   - header: "Scene Layout"
   - question: "Klopt dit visuele ontwerp en de gameplay flow?"
   - options:
     - label: "Ja (Recommended)", description: "Layout en flow zijn correct, ga door"
     - label: "Aanpassen", description: "Ik wil het ontwerp wijzigen"
   - multiSelect: false

### FASE 3: Architecture Design

Design based on requirements (and research if done). Genereer een ASCII state machine van de core gameplay loop (states + transitions + triggers) naast de scene tree:

**Scene Tree:**

```
{RootNodeType} ({feature-name})
├── {ChildNode} ({NodeType})
└── {ChildNode} ({NodeType})
```

**Scripts:**
| File | Class | Purpose |
|------|-------|---------|
| {path}.gd | {ClassName} | {purpose} |

**Signals:**
| Signal | Emitter | Receivers | Purpose |
|--------|---------|-----------|---------|

**Resources:**
| File | Type | Purpose |
|------|------|---------|

**Test Strategy:**
| REQ ID | Test File | Test Function | Type |
|--------|-----------|---------------|------|

### Dependency Analysis

Determine implementation order based on requirement dependencies:

**Analysis process:**

1. For each requirement, identify dependencies on other requirements
2. Base requirements (no dependencies) come first
3. Dependent requirements follow their dependencies

**Output format:**

```
DEPENDENCY ANALYSIS:

REQ-001: {description}
  └── Dependencies: None (BASE)

REQ-002: {description}
  └── Dependencies: REQ-001 (needs {reason})

REQ-003: {description}
  └── Dependencies: REQ-002 (needs {reason})

IMPLEMENTATION ORDER:
1. REQ-001 (base)
2. REQ-002 (after REQ-001)
3. REQ-003 (after REQ-002)
```

### FASE 4: Write feature.json

Schrijf `.project/features/{feature-name}/feature.json` (zie `shared/FEATURE.md` voor volledig schema):

| Veld                                 | Conditie                                                                           |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| `name`, `created`, `status`, `stage` | altijd (status = `"DOING"`, stage = `"defined"`)                                   |
| `summary`                            | altijd                                                                             |
| `depends`                            | altijd (lege array als geen)                                                       |
| `choices`                            | altijd (user antwoorden)                                                           |
| `requirements`                       | altijd (elke REQ met `status: "pending"`)                                          |
| `files`                              | altijd (genormaliseerd: `path`, `type`, `action`, `purpose`, `requirements`)       |
| `architecture`                       | altijd (`componentTree`, `interfaces`)                                             |
| `design`                             | alleen visuele features (`wireframe`, `components`, `sceneLayout`, `gameplayFlow`) |
| `buildSequence`                      | altijd                                                                             |
| `testStrategy`                       | altijd                                                                             |
| `clarifications`                     | alleen als gray-area resolution is uitgevoerd                                      |
| `durableDecisions`                   | bij >3 requirements — beslissingen die over alle REQs gelden                       |
| `research`                           | alleen als research is gedaan                                                      |

**`durableDecisions`** — beslissingen die tijdens de build NIET veranderen:

- Scene tree structuur (root node type, compositie)
- Resource schema shape (custom Resources, exports)
- Signal architecture (welke signals, wie emit/ontvangt)
- State machine aanpak (enum-based, node-based, stateless)

### FASE 4b: Toewijzing

AskUserQuestion:

```yaml
header: "Toewijzing"
question: "Wie gaat dit bouwen?"
options:
  - label: "Zelf bouwen (Recommended)"
    description: "Ik bouw dit met /game-build"
  - label: "Teammate toewijzen"
    description: "Genereer een task brief"
multiSelect: false
```

**Zelf bouwen**: `assignee` blijft `null`. Ga door naar FASE 5.

**Teammate toewijzen**:

1. AskUserQuestion: "Naam van de teammate?" (vrije tekst)
2. Zet `assignee` in memory (meenemen naar FASE 5 backlog sync)
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

### FASE 5: Sync

Volg `shared/SYNC.md` 3-File Sync Pattern. Skill-specifieke mutaties hieronder.

Lees parallel **direct voor het editen** (skip als niet bestaat) — vertrouw NIET op reads uit eerdere fases (Prettier/linters kunnen bestanden tussentijds wijzigen):

- `.project/backlog.html`
- `.project/project.json`
- `.project/project-context.json`

Muteer in memory:

**Backlog** (zie `shared/BACKLOG.md`):

- Zoek feature: `data.features.find(f => f.name === "{feature-name}")`
- Gevonden → zet `.status = "DOING"`, `.stage = "defined"` en `.date = "{current date}"`
- Niet gevonden → voeg toe: `{ "name": "{feature}", "type": "FEATURE", "status": "DOING", "stage": "defined", "phase": "P4", "description": "{from feature.json summary}", "dependency": null, "source": "/game-define" }`
- Zet `data.updated` naar huidige datum

**Dashboard** (zie `shared/DASHBOARD.md`):

- **Data entities** (optioneel — alleen als feature domain entities introduceert): voor elke entity check of `data.entities` al entry heeft met die naam → nee: push met fields/relations → ja: merge nieuwe velden. Als feature geen entities heeft (UI-only scene, pure gameplay, utility): skip, log `Skipped data.entities: no entities`.
- **Stack**: als Godot plugins/assets → check `stack.packages` op naam → nee: push `{ name, version, purpose }`
- **Features**: check op naam → nee: push `{ name, status: "DOING", stage: "defined", summary, depends: [], created }` → ja: update status naar `"DOING"`, stage naar `"defined"`
- **Architecture** in `.project/project-context.json`: genereer/update als feature scene tree en/of signals heeft. **Volg component-first model uit `shared/DASHBOARD.md`**:
  - `layers`: definieer lagen met `{ name, order }` (bijv. Scenes order 1, Systems order 2, Resources order 3)
  - `dataFlow`: één-regel samenvatting van de scene/signal flow
  - `components`: per component `{ name, layer, description, status, connects_to }`. Scene tree als componenten, signal flow als `connects_to`. Alle features DOING → `status: "planned"`, bestaande → `"done"`
  - Merge strategie: check of component `name` al bestaat → nee: push → ja: merge
  - Skip als feature te klein (enkele node zonder signals)

Schrijf parallel terug:

- Edit `backlog.html` (keep `<script>` tags intact)
- Write `project.json` (stack, features, data)
- Write `project-context.json` (als architecture gewijzigd)

Clean up: `rm -f .project/session/active-{feature-name}.json`

**Output:**

```
DASHBOARD SYNCED

Data: {N} entities ({new} nieuw)
Stack: {N} packages ({new} nieuw)

Next steps:
  1. /game-plan → genereer backlog uit concept (als nog geen backlog)
  2. /game-build {feature-name} → start implementatie (als backlog al bestaat)
```

## Best Practices

- Use AskUserQuestion for all structured choices
- Extract testable requirements with REQ-IDs and acceptance criteria
- Scene research is optional but recommended for complex features
- Keep architecture focused on what's needed

## Restrictions

This skill must NEVER:

- Write actual implementation code (that's /game-build's job)
- Skip the requirements extraction step
- Proceed without user confirmation at checkpoints

This skill must ALWAYS:

- Use business-like, direct tone
- Extract testable requirements with REQ-IDs and acceptance criteria
- Include all required sections in feature.json output
