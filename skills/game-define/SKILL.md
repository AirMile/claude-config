---
name: game-define
description: Define game feature requirements and architecture with structured output. Use with /game-define to create detailed game feature specifications before building.
writes: [feature.requirements, backlog.stage]
metadata:
  author: claude-config
  version: 2.3.0
  category: game
---

# Game Feature Definition

## Overview

This skill defines game feature requirements and architecture for Godot 4.x projects. It is PHASE 1 of the gamedev workflow: plan -> **define** -> build -> test -> refactor.

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

### PHASE 0: Feature Name + Context

1. **If name provided** (`/game-define abilities`):
   - Use provided name as feature name
   - Continue to step 2b

2. **If no name** (`/game-define`):

   **a) Check backlog for next feature:**

   ```
   Read(".project/backlog.html")
   ```

   - If backlog exists: parse JSON from `<script id="backlog-data">` block (see `shared/BACKLOG.md`)
   - See `shared/BACKLOG.md → Lifecycle Protocol → Read`. Filter: `type === "FEATURE" && transition === "defining"` — if found, auto-select (no modal needed).
   - Fallback: `data.features.find(f => f.status === "TODO")` — use as suggestion
   - Use feature name as suggestion

   **b) If backlog has a next feature:**

   Use **AskUserQuestion** tool:
   - header: "Feature Name"
   - question: "Next feature from backlog: **{feature-name}**. Continue with this?"
   - options:
     - label: "{feature-name} (Recommended)", description: "{description from backlog TODO list}"
     - label: "Other feature", description: "I want to define a different feature"
   - multiSelect: false

   - If user picks the backlog feature → use that name, continue to step 3
   - If user picks "Other feature" → fall through to option (c)

   **c) No backlog but concept exists:**

   Read `CONCEPT_CONTEXT` per `shared/CONCEPT.md`. If `CONCEPT_CONTEXT.present`:
   AskUserQuestion:

   ```yaml
   header: "Concept without backlog"
   question: "There is a concept but no backlog yet. Generate a backlog first?"
   options:
     - label: "Yes, /project-plan first (Recommended)", description: "Generate backlog from concept, then define features"
     - label: "No, define directly", description: "Define a standalone feature without backlog"
   multiSelect: false
   ```

   "Yes" → stop, show: `Run /project-plan to convert your concept into a backlog.`
   "No" → continue to option d.

   **d) No backlog, no concept (or user chose direct define):**

   Use **AskUserQuestion** tool:
   - header: "Feature Name"
   - question: "Which game feature do you want to define? Pick a suggestion or type your own feature name via 'Other'."
   - options:
     - label: "Ability System", description: "Player abilities and element-based powers"
     - label: "Player Movement", description: "Movement, controls, physics"
     - label: "Combat System", description: "Damage, health, knockback"
     - label: "UI System", description: "HUD, menus, ability selection"
   - multiSelect: false

   The user can type any feature name via the built-in "Other" option.

**Tag backlog card as active** (immediately after feature name determination):

Read `.project/backlog.html` (if it exists), parse JSON (see `shared/BACKLOG.md`).
Find feature by name → keep `"status": "TODO"`, set `"stage": "defining"`, `data.updated` to now.
Write back via Edit (keep `<script>` tags intact).
Not found → skip (feature is added to backlog at PHASE 5).
The card stays in TODO but gets a pulsing `defining` stage-badge.

2b. **Feature existence check** (after name determination, before context-load):

Check: `.project/features/{feature-name}/feature.json` exists?

- **Not found** → continue to step 3 (normal flow).
- **Found** → go to PHASE 0b (update-mode).

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
   - If not found: note absence, continue without (research may be triggered in PHASE 2)

   ```
   ℹ Architecture baseline loaded — context available for all phases.
   ```

   Or if not found:

   ```
   ⚠ Architecture baseline not found — run /core-setup to generate.
   ```

5. **Load project context** (parallelize with step 4):
   - Glob + Grep for existing code that imports the feature name
   - Read `.project/project.json` → extract:
     - `stack` — framework, language, packages (fallback if architecture-baseline does not exist)
     - `CONCEPT_CONTEXT.pitch` or first 2 sentences of `CONCEPT_CONTEXT.markdown` as feature context (see `shared/CONCEPT.md`)
     - `features[]` — existing features (prevents duplicates/overlap)
     - `data.entities` — existing data model
     - `thinking[]` — scan for entries with `newFeature` field matching the feature name (added via `/project-todo`). Load those as context.
   - **Name-match on thinking markdown**: Grep `.project/thinking/*.md` on feature name (filename + content). With 1+ match: read the match(es) and use as input for PHASE 1 questions. The `.md` files are the source of truth for thinking output — no 7-day window anymore.
   - Read `.project/project-context.json` (if it exists) → extract:
     - `context.patterns` — existing code patterns
   - **Learnings load** via [shared/LEARNINGS-LOAD.md](../shared/LEARNINGS-LOAD.md):
     ```
     scopes: [component, architectural]
     pitfall-prefix: true
     current-feature: <feature-name>
     ```
     Show the loaded output before PHASE 1 questions. Component-scoped patterns and architectural patterns guide architecture choices and requirement formulation. Pitfall-prefix prevents repetition of earlier bugs.
   - **Onboarding check** (evaluate immediately after project.json read):
     - `project.json` not present → show: `⚠️ No project.json found. Consider running /core-setup first for better codebase context.` Continue without (non-blocking).
     - Present but empty (no `context`, `stack`, or `features`) → show: `ℹ️ project.json exists but is missing codebase context. /core-setup can fill this in.`
     - Present with content → proceed silently.
   - **Past decisions scan** (two sources, both scope):
     - Feature-scope: Glob `.project/features/*/feature.json` → flatten all `durableDecisions[]`. Tag each entry with `[feature-X]`.
     - Project-scope: Glob `.project/thinking/*-decision-*.md` → read first ~30 lines per file, extract `THINK:` line (title), `AANBEVELING:` line (chosen), and `CONSTRAINT` section. Tag each entry with `[project]`.
     - Merge both sources. Filter relevant via keyword-overlap between current feature name/concept and each decision's title, chosen, or constraint (≥2 substantive terms). Keep top 3 most-relevant.

### PHASE 0b: Update-mode (only if feature.json already exists)

1. Read `.project/features/{feature-name}/feature.json`.

2. Show existing requirements summary:

   | ID      | Description (first 60 chars) | Status  |
   | ------- | ---------------------------- | ------- |
   | REQ-001 | {description}                | pending |

3. AskUserQuestion: "Feature **{name}** already exists with {N} requirements. What do you want to change?"

   ```yaml
   header: "Update-mode"
   options:
     - label: "Add requirements (Recommended)", description: "New requirements, numbered from REQ-{N+1}"
     - label: "Edit requirements", description: "Reformulate existing requirements or adjust acceptance"
     - label: "Remove requirements", description: "Remove requirements from scope (soft-delete)"
     - label: "Multiple of the above", description: "Combination of add, edit and/or remove"
   multiSelect: false
   ```

4. Process delta based on choice:
   - **Add**: Run through PHASE 1 Requirements Gathering for the new requirements only. Number from `REQ-{N+1}`.
   - **Edit**: Ask which REQ-IDs. Per REQ: show current description + acceptance, ask for new version. Use format `[{ when, then }]` per scenario.
   - **Remove**: Ask which REQ-IDs. Mark with `deltaOp: "REMOVED"` — do not physically delete from the array. Also: remove the REQ-ID from all `buildSequence[].requirements[]` arrays; if a step becomes empty → remove the step.
   - **Multiple**: Combine the above flows in one round.

5. Save `deltaOp` per requirement:
   - Unchanged: `"deltaOp": "UNCHANGED"`
   - New: `"deltaOp": "ADDED"`
   - Modified: `"deltaOp": "MODIFIED"` + `"previousDescription": "{original text}"`
   - Removed: `"deltaOp": "REMOVED"` (stays in array, is not built or tested)

6. **Status-reset**: if feature `status` was `"DOING"` → reset to `"DEFINED"` in `feature.json` and backlog.

7. Skip PHASE 1b (feature splitting) unless the number of requirements after update exceeds 6 and there are clear clusters.

8. Go to PHASE 2 for ADDED and MODIFIED requirements only. For PHASE 5 write: **merge** delta into existing `feature.json` — do not overwrite fully. Preserve existing `build`, `tests` and UNCHANGED requirements. `buildSequence`: remove steps that are empty after REMOVED-filtering; add new steps for ADDED requirements (from PHASE 2 architecture output); leave existing steps for UNCHANGED requirements unchanged.

---

### PHASE 1: Requirements Gathering

**Risk-check (only if `feature.risk >= 4`):**

If the loaded backlog feature has a `risk` score of 4 or 5, show this warning before the first question:

```
⚠ HIGH RISK — Complexity {risk}/5

This feature has a high complexity score. Consider before defining:
- Split the feature into smaller parts
- Verify that dependencies are available
- Discuss scope if parts are unclear
```

**Surface relevant past decisions** (only with ≥1 match from PHASE 0 scan, otherwise skip silently):

```
PREVIOUSLY DECIDED (possibly relevant)
- [project] {decision} → chose {chosen} (constraint: {constraint})
- [feature-X] {decision} → chose {chosen} (constraint: {constraint})
```

Show before the first AskUserQuestion. No action question — context only so that question-1 answers do not conflict with previously decided directions. If a current answer option directly conflicts, mention that briefly in the option description ("Deviates from {feature-X} decision").

Ask 5 targeted questions using AskUserQuestion:

**Question 1: Core Function**

- header: "Core Function"
- question: "What should this feature do from the player's perspective?"

**Question 2: Game Mechanics**

- header: "Mechanics"
- question: "Which game mechanics are involved?"
- options: Physics-based, Turn-based, Real-time, State-based

**Question 3: Player Interactions**

- header: "Interactions"
- question: "Which player interactions must this feature support?"
- options: Input controls, Collision triggers, UI selection, Automatic

**Question 4: Visual Feedback**

- header: "Visuals"
- question: "Which visual feedback is needed?"
- options: Sprite animations, Particles, UI updates, Screen effects

**Question 5: Data Requirements**

- header: "Data"
- question: "Which data needs to be stored/managed?"
- options: Stats/values, Inventory/collections, State persistence, Configuration

**User delegation**: if the user responds with "what do you think?" or similar, give a brief recommendation with trade-off and continue with that choice.

#### Follow-up check

After the initial questions, evaluate whether there are open branches:

- Undiscussed edge cases in the answers
- Implicit assumptions that have not been confirmed
- Conflicts between answers

**≤3 requirements expected**: skip follow-up, go to extraction.
**>3 requirements expected**: ask 1-2 targeted follow-up questions about the most important open branch. Frame as "What happens if...?" or "How does this handle...?"

Max 2 extra questions, then proceed to extraction.

#### Gray-Area Resolution

**Skip** if the follow-up check found no open branches.

**Otherwise**: for each identified open branch (max 3):

1. Frame the ambiguity as a concrete choice via AskUserQuestion:
   - Header: the open branch as a short phrase
   - Options: 2-3 concrete approaches + "Not relevant for scope"
   - First option = Recommended

2. Record the choice as a clarification:
   `{ "question": "{open branch}", "answer": "{chosen option}", "impact": "brief note on which requirement area this affects" }`

**"Not relevant"** → record as scoped-out, not as a requirement.
**>3 open branches** → handle remaining ones inline during requirement extraction as edge cases.

Max 3 AskUserQuestion calls. Then proceed to extraction.

#### Requirement Extraction

After questions, extract testable requirements:

- Each requirement gets an ID (REQ-001, REQ-002, etc.)
- Categorize by type (core, scene, script, signal)
- Determine test type for each
- Define acceptance scenarios per requirement as `{ when, then }` pairs (concrete, verifiable)

Show requirements table with acceptance scenarios:

| ID      | Requirement   | Category   | Test Type | Acceptance                              |
| ------- | ------------- | ---------- | --------- | --------------------------------------- |
| REQ-001 | {description} | {category} | {type}    | WHEN {trigger} → THEN {expected result} |

Multiple scenarios per requirement → multiple rows with the same REQ-ID, or bullets.

#### Tuning Levers & Edge Cases (mechanics requirements)

For requirements that contain **numbers or timing** (damage, speed, cooldown, radius, etc.), extract tuning levers:

| Parameter | Default | Min   | Max   | Impact                        |
| --------- | ------- | ----- | ----- | ----------------------------- |
| {name}    | {value} | {min} | {max} | {what changes for the player} |

Mark defaults as `[PLACEHOLDER]` if they have not been playtested yet.

For requirements with **interactions or state changes**, document edge cases:

- What if the value is 0?
- What if two actions trigger simultaneously?
- What if the player has maximum/minimum resource?

Only relevant edge cases — not every requirement has them. Skip for simple features (≤3 requirements without numbers).

Tuning levers are stored in `feature.json` per requirement as `tuningLevers[]`.

**Confirm with user** via **AskUserQuestion**:

- header: "Requirements"
- question: "Agree with these requirements?"
- options:
  - label: "Agree (Recommended)", description: "Requirements are complete and correct"
  - label: "Edit", description: "I want to change or add requirements"
  - label: "Start over", description: "Discard everything and ask new questions"
- multiSelect: false

**If "Edit"** → ask what to change, update requirements table, re-confirm.
**If "Start over"** → restart PHASE 1 from Question 1.

### CHECKPOINT: Requirements Summary

After the requirements table confirmation, present a complete overview:

| Aspect        | Value                       |
| ------------- | --------------------------- |
| Feature       | {name}                      |
| Core function | {from player's perspective} |
| Mechanics     | {chosen mechanics}          |
| Interactions  | {chosen interactions}       |
| Visuals       | {chosen visual feedback}    |
| Data          | {chosen data management}    |
| Requirements  | {N} requirements            |

Ask via AskUserQuestion:

- header: "Requirements Summary"
- question: "Does this overview look correct before we continue to architecture?"
- options:
  - label: "Continue (Recommended)", description: "On to scope analysis + architecture"
  - label: "Edit", description: "Back to relevant question"
- multiSelect: false

### PHASE 1b: Scope Analysis & Feature Splitting

**Goal:** Analyze gathered requirements and decide whether to keep as a single feature or split into multiple sub-features for optimal build execution.

**Steps:**

1. **Analyze requirement scope:**

   Count requirements and map dependency graph from PHASE 1 output.

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

   Proceed to PHASE 2.

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
   - question: "Agree with this split?"
   - options:
     - label: "Agree (Recommended)", description: "Split into {n} sub-features"
     - label: "Edit", description: "I want to change the grouping"
     - label: "Keep as one feature", description: "No split, everything in one feature"
   - multiSelect: false

   **Response Handling:**
   - Agree → proceed with split
   - Edit → ask which requirements should move where, regenerate split
   - Keep as one feature → proceed as SINGLE feature to PHASE 2

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

   c. Continue PHASE 2-5 for EACH sub-feature sequentially:
   - Re-number requirements per sub-feature (REQ-001, REQ-002, etc.)
   - Each sub-feature gets its own architecture, scene layout, and feature.json
   - Use build order: complete all PHASEs for sub-feature 1 before starting sub-feature 2

7. **Update backlog (split only):**

   If `.project/backlog.html` exists:
   - Replace original feature entry with sub-feature entries
   - Each sub-feature gets its own line in the backlog
   - Add `(split from {original-name})` annotation

### PHASE 2: Architecture Check (Automatic)

**Goal:** Automatically determine whether research is needed based on the architecture-baseline.

**Steps:**

1. **Use pre-loaded architecture-baseline:**
   - Use the baseline context loaded in PHASE 0
   - If baseline was not found in PHASE 0, skip to step 5 (baseline not found fallback)

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
   ✓ Architecture pattern found in baseline

   | Field | Value |
   |-------|-------|
   | Feature Type | {type} |
   | Node Type | {from baseline} |
   | Pattern | {from baseline} |
   | State Machine | {from baseline} |

   → Using baseline, research skipped.
   ```

   - Use patterns from baseline for PHASE 3
   - Skip godot-scene-researcher agent

   **B) Pattern NOT FOUND in baseline:**

   ```
   ⚠ No architecture pattern found for "{feature-type}"

   → Research will be run and baseline will be updated.
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
   ⚠ Architecture baseline not found.

   → Full research will be run.
   Tip: Run /core-setup to generate the baseline.
   ```

   - Always launch godot-scene-researcher agent
   - Do NOT create baseline (that's /setup's job)

### PHASE 2b: Scene Layout & Gameplay Flow

**Goal:** Define visual scene layout and gameplay state flow before architecture design.

**Condition:** Only execute this phase if the feature involves visual elements (scenes, sprites, UI, particles). If the feature is non-visual (pure data, logic, resources), skip with:

```
PHASE 2b: N/A — non-visual feature
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
   - question: "Does this visual design and gameplay flow look correct?"
   - options:
     - label: "Yes (Recommended)", description: "Layout and flow are correct, continue"
     - label: "Edit", description: "I want to change the design"
   - multiSelect: false

### PHASE 3: Architecture Design

Design based on requirements (and research if done). Generate an ASCII state machine of the core gameplay loop (states + transitions + triggers) alongside the scene tree:

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

### PHASE 4: Write feature.json

Write `.project/features/{feature-name}/feature.json` (see `shared/FEATURE.md` for full schema):

| Field                       | Condition                                                                           |
| --------------------------- | ----------------------------------------------------------------------------------- |
| `name`, `created`, `status` | always (status = `"DEFINED"`, no stage — waiting for `/game-build`)                 |
| `summary`                   | always                                                                              |
| `depends`                   | always (empty array if none)                                                        |
| `choices`                   | always (user answers)                                                               |
| `requirements`              | always (each REQ with `status: "pending"`)                                          |
| `files`                     | always (normalized: `path`, `type`, `action`, `purpose`, `requirements`)            |
| `architecture`              | always (`componentTree`, `interfaces`)                                              |
| `design`                    | only for visual features (`wireframe`, `components`, `sceneLayout`, `gameplayFlow`) |
| `buildSequence`             | always                                                                              |
| `testStrategy`              | always                                                                              |
| `clarifications`            | only if gray-area resolution was performed                                          |
| `durableDecisions`          | with >3 requirements — decisions that apply across all REQs                         |
| `research`                  | only if research was done                                                           |

**`durableDecisions`** — decisions that do NOT change during the build:

- Scene tree structure (root node type, composition)
- Resource schema shape (custom Resources, exports)
- Signal architecture (which signals, who emits/receives)
- State machine approach (enum-based, node-based, stateless)

### PHASE 5: Sync

Follow `shared/SYNC.md` 3-File Sync Pattern. Skill-specific mutations below.

Read in parallel **directly before editing** (skip if not present) — do NOT rely on reads from earlier phases (Prettier/linters may have modified files in the meantime):

- `.project/backlog.html`
- `.project/project.json`
- `.project/project-context.json`

Mutate in memory:

**Backlog** (see `shared/BACKLOG.md`):

- Find feature: `data.features.find(f => f.name === "{feature-name}")`
- Found → set `.status = "DEFINED"`, remove `.stage` and `.transition` (no stage in DEFINED column) and set `.date = "{current date}"`
- Not found → add: `{ "name": "{feature}", "type": "FEATURE", "status": "DEFINED", "phase": "P4", "description": "{from feature.json summary}", "dependencies": [], "source": "/game-define" }`
- Set `data.updated` to current date

**Dashboard** (see `shared/DASHBOARD.md`):

- **Data entities** (optional — only if feature introduces domain entities): for each entity check whether `data.entities` already has an entry with that name → no: push with fields/relations → yes: merge new fields. If feature has no entities (UI-only scene, pure gameplay, utility): skip, log `Skipped data.entities: no entities`.
- **Stack**: if Godot plugins/assets → check `stack.packages` by name → no: push `{ name, version, purpose }`
- **Features**: check by name → no: push `{ name, status: "DEFINED", summary, depends: [], created }` → yes: update status to `"DEFINED"`, remove `stage`
- **Architecture** in `.project/project-context.json`: generate/update if feature has a scene tree and/or signals. **Follow component-first model from `shared/DASHBOARD.md`**:
  - `layers`: define layers with `{ name, order }` (e.g. Scenes order 1, Systems order 2, Resources order 3)
  - `dataFlow`: one-line summary of the scene/signal flow
  - `components`: per component `{ name, layer, description, status, connects_to }`. Scene tree as components. `connects_to[]` as typed edges `{ to, type }` (`calls` for signal emits/method calls, `reads`/`writes` for shared state or autoloads, `depends_on` for scene-tree parent or resource references). All features DOING → `status: "planned"`, existing → `"done"`
  - Merge strategy: check whether component `name` already exists → no: push → yes: merge
  - Skip if feature is too small (single node without signals)

Write back in parallel:

- Edit `backlog.html` (keep `<script>` tags intact)
- Write `project.json` (stack, features, data)
- Write `project-context.json` (if architecture changed)

**Auto-build marking** (after sync):

Read backlog again, find feature, set `"auto": true`, write back via Edit. No user prompt — always mark auto so the card gets an AUTO-badge and the clipboard gets the correct `/game-build` command.

Clean up: `rm -f .project/session/active-{feature-name}.json`

**Output:**

```
DASHBOARD SYNCED

Data: {N} entities ({new} new)
Stack: {N} packages ({new} new)

Next steps:
  1. /project-plan → generate backlog from concept (if no backlog yet)
  2. /game-build {feature-name} → start implementation (if backlog already exists)
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
