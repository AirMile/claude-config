---
name: game-define
description: Define game feature requirements and architecture with structured output. Use with /game-define to create detailed game feature specifications before building.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 2.0.0
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

   **c) If no backlog found OR user wants a different feature:**

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

3. **Create project folder:**

   ```bash
   mkdir -p .project/features/{feature-name}
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

Design based on requirements (and research if done):

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

| Veld                        | Conditie                                                                           |
| --------------------------- | ---------------------------------------------------------------------------------- |
| `name`, `created`, `status` | altijd (status = `"DEF"`)                                                          |
| `summary`                   | altijd                                                                             |
| `depends`                   | altijd (lege array als geen)                                                       |
| `choices`                   | altijd (user antwoorden)                                                           |
| `requirements`              | altijd (elke REQ met `status: "pending"`)                                          |
| `files`                     | altijd (genormaliseerd: `path`, `type`, `action`, `purpose`, `requirements`)       |
| `architecture`              | altijd (`componentTree`, `interfaces`)                                             |
| `design`                    | alleen visuele features (`wireframe`, `components`, `sceneLayout`, `gameplayFlow`) |
| `buildSequence`             | altijd                                                                             |
| `testStrategy`              | altijd                                                                             |
| `research`                  | alleen als research is gedaan                                                      |

### FASE 5: Sync Backlog

**Goal:** Update `.project/backlog.html` with new status.

Zie `shared/BACKLOG.md` voor het JSON read/write protocol.

**Steps:**

1. **Check if backlog exists:**

   ```
   Read(".project/backlog.html")
   ```

   - If file not found: skip sync (no backlog to update)

2. **Parse JSON data:**
   - Extraheer JSON uit `<script id="backlog-data" type="application/json">` blok
   - Parse als object (zie `shared/BACKLOG.md`)

3. **Find feature and update status:**
   - Zoek in `data.features`: `data.features.find(f => f.name === "{feature-name}")`
   - Gevonden → zet `.status = "DEF"` en `.date = "{current date}"`
   - Niet gevonden → voeg toe aan `data.features`:
     `{ "name": "{feature}", "type": "FEATURE", "status": "DEF", "phase": "P4", "description": "{from feature.json summary}", "dependency": null, "source": "/game-define" }`

4. **Update metadata and write back:**
   - Zet `data.updated` naar huidige datum (`YYYY-MM-DD`)
   - Vervang het JSON-blok in het HTML bestand via Edit tool (keep `<script>` tags intact)

**Output:**

```
BACKLOG SYNCED

Feature: {feature-name}
Status: TODO → DEF
Location: {P1 | P2 | P3 | P4}
```

### FASE 6: Dashboard Sync

**Goal:** Update `.project/project.json` met data en stack info uit deze feature definitie.

Zie `shared/DASHBOARD.md` voor het volledige schema en merge-strategieën.

**Steps:**

1. Read `.project/project.json` (of maak nieuw met leeg schema als niet bestaat)

2. **Data entities** — als de feature data entities/resources definieert (uit Architecture):
   - Voor elke entity: check of `data.entities` al een entry heeft met die naam
   - Zo nee: push hele entity met fields en relations
   - Zo ja: merge nieuwe velden/relaties toe

3. **Stack** — als de feature Godot plugins of assets introduceert:
   - Voor elk package: check of `stack.packages` al een entry heeft met die naam
   - Zo nee: push `{ name, version, purpose }`

4. **Features** — push feature naar `features` array:
   - Check of feature met deze naam al bestaat
   - Zo nee: push `{ name: "{feature-name}", status: "DEF", summary: "{from feature.json summary}", depends: [], created: "{date}" }`
   - Zo ja: update status naar `"DEF"`

5. **Architecture** — genereer/update `architecture` sectie als feature scene tree en/of signals heeft:
   - `diagram`: Mermaid `graph TD` vanuit scene tree hiërarchie (nodes, children). Signal flow als edges (`emitter --|signal_name|--> receiver`). State machines als subgraph
   - `description`: markdown scene overzicht + signals + state machines
   - OVERWRITE (vervangt vorige diagram met bijgewerkte versie)
   - Skip als feature te klein is (enkele node zonder signals)

6. Write `.project/project.json`

**Output:**

```
DASHBOARD SYNCED

Data: {N} entities ({new} nieuw)
Stack: {N} packages ({new} nieuw)
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
