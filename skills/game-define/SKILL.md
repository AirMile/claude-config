---
name: game-define
description: Define Godot feature requirements and architecture. Use with /game-define.
writes: [feature.requirements, backlog.stage, concept.seed]
metadata:
  author: claude-config
  version: 2.7.0
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

**Phase tracking** — first action of the skill: call `TaskCreate` with these 3 items (status `pending`), then use `TaskUpdate` to set each phase `in_progress` at start and `completed` at end. During context compaction the task list remains visible — no risk of forgotten phases.

1. PHASE 0+1: Setup, Context & Requirements
2. PHASE 2+3: Architecture Check & Design
3. PHASE 4+5: feature.json + Sync

### PHASE 0: Feature Name + Context

> **Todo**: call `TaskCreate` with the 3 phase items (see above). Mark PHASE 0+1 → `in_progress` via `TaskUpdate`.

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

   Read `SEED_CONTEXT` per `shared/SEED.md`. If `SEED_CONTEXT.present`:
   AskUserQuestion:

   ```yaml
   header: "Concept without backlog"
   question: "There is a concept but no backlog yet. Generate a backlog first?"
   options:
     - label: "Yes, /project-backlog first (Recommended)", description: "Generate backlog from concept, then define features"
     - label: "No, define directly", description: "Define a standalone feature without backlog"
   multiSelect: false
   ```

   "Yes" → stop, show: `Run /project-backlog to convert your concept into a backlog.`
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
     - `SEED_CONTEXT.pitch` or first 2 sentences of `SEED_CONTEXT.markdown` as feature context (see `shared/SEED.md`)
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
     - Feature-scope: Glob `.project/features/*/feature.json` sorted by `created`/`definedAt` desc — take **5 most recent**. Flatten their `durableDecisions[]`. Tag each entry with `[feature-X]`.
     - Project-scope: Glob `.project/thinking/*-decision-*.md` sorted by mtime desc — take **5 most recent**. Read first ~30 lines per file, extract `THINK:` line (title), `AANBEVELING:` line (chosen), and `CONSTRAINT` section. Tag each entry with `[project]`.
     - Merge both sources. Filter relevant via keyword-overlap between current feature name/concept and each decision's title, chosen, or constraint (≥2 substantive terms). Keep top 3 most-relevant.

### PHASE 0b: Update-mode (only if feature.json already exists)

> **Todo**: Read `.claude/skills/game-define/references/update-mode.md` for the full update-mode flow.

---

### PHASE 1: Requirements Gathering

> **Todo**: mark PHASE 0 → `completed`, PHASE 1 → `in_progress`.

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

**≤6 requirements expected**: skip follow-up, go to extraction.
**>6 requirements expected**: ask 1 targeted follow-up question about the most important open branch. Frame as a design choice (scene structure, state machine approach, signal boundary). Edge cases (parameter ranges, input behavior, defaults) → inline as acceptance criterion. No AskUserQuestion.

#### Gray-Area Resolution

**Skip** if ≤6 requirements expected OR follow-up check found no open branches.

**Otherwise** (>6 REQs with an open architecture-changing choice — scene ownership, resource schema, signal boundary): 1 AskUserQuestion call, max 3 sub-questions. Each must be a concrete A vs B choice affecting architecture. First option = Recommended. Include "Not relevant for scope" if applicable.

Record each as: `{ "question": "{open branch}", "answer": "{chosen option}", "impact": "brief note on which requirement area this affects" }`

**"Not relevant"** → record as scoped-out, not as a requirement.
**>3 open branches** → handle remaining ones inline during requirement extraction as edge cases.

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

**Error scenarios** (for REQs with validation, boundary checks, or fail-paths): extract `errorScenarios[]` alongside tuning levers:

- Each entry: `{ when: "{trigger condition}", then: "{observable error result}" }`
- Examples: out-of-bounds input, simultaneous conflicting triggers, resource at zero/max
- Skip if REQ has no plausible error path — omit field from that REQ
- Stored in `feature.json` per requirement as `errorScenarios[]`

**Confirm with user:**

- **≤6 REQs**: show requirements table, append `Scope: {N} requirements — SINGLE feature, continuing.` and proceed to PHASE 2. No AskUserQuestion.
- **>6 REQs**: confirm via AskUserQuestion:
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

Only run if >6 REQs (≤6: already handled above). Present a complete overview:

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

**Condition:** Only run if requirement count exceeds 6 or there are clear independent clusters.

> **Todo**: Read `.claude/skills/game-define/references/feature-splitting.md` for full scope analysis logic and split execution steps.

### PHASE 2: Architecture Check (Automatic)

> **Todo**: mark PHASE 1 → `completed`, PHASE 2 → `in_progress`.

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

> **Todo**: mark PHASE 2 → `completed`, PHASE 3 → `in_progress`.

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

**Seed Alignment Check** (last step in PHASE 3, before writing feature.json):

Follow [shared/SEED.md](../shared/SEED.md) § Alignment Check. Inputs: REQ
descriptions + `acceptance[].then` + `durableDecisions[]` from PHASE 1 and PHASE 3.
This skill is NOT in plan mode — drift table and proposed rewrite go inline in
chat for user review before PHASE 4. On "Yes" → carry `seedUpdateApproved: true`
to PHASE 5. On "Skip" → carry `seedDrift[]` to PHASE 4 (written to
`feature.json#seedDrift`). `source: "/game-define"`, `ref: "REQ-NNN"` where
applicable.

### PHASE 4: Write feature.json

> **Todo**: mark PHASE 3 → `completed`, PHASE 4 → `in_progress`.

Write `.project/features/{feature-name}/feature.json` (see `shared/FEATURE.md` for full schema):

| Field                       | Condition                                                                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`, `created`, `status` | always (status = `"DEFINED"`, no stage — waiting for `/game-build`)                                                                                                                                    |
| `summary`                   | always                                                                                                                                                                                                 |
| `depends`                   | always (empty array if none)                                                                                                                                                                           |
| `choices`                   | always (user answers)                                                                                                                                                                                  |
| `requirements`              | always (each REQ with `status: "pending"`)                                                                                                                                                             |
| `files`                     | always (normalized: `path`, `type`, `action`, `purpose`, `requirements`)                                                                                                                               |
| `architecture`              | always (`componentTree`, `interfaces`)                                                                                                                                                                 |
| `design`                    | only for visual features (`wireframe`, `components`, `sceneLayout`, `gameplayFlow`)                                                                                                                    |
| `buildSequence`             | always                                                                                                                                                                                                 |
| `testStrategy`              | always                                                                                                                                                                                                 |
| `clarifications`            | only if gray-area resolution was performed                                                                                                                                                             |
| `durableDecisions`          | with >3 requirements — decisions that apply across all REQs                                                                                                                                            |
| `research`                  | only if research was done                                                                                                                                                                              |
| `seedDrift`                 | only if PHASE 3 Seed Alignment Check ran and user chose "Skip" — array of `{ category, seedSays, featureDecides, source: "/game-define", ref? }`. Omit when seed was updated or no drift was detected. |

**`durableDecisions`** — decisions that do NOT change during the build:

- Scene tree structure (root node type, composition)
- Resource schema shape (custom Resources, exports)
- Signal architecture (which signals, who emits/receives)
- State machine approach (enum-based, node-based, stateless)

### PHASE 5: Sync

Follow `shared/SYNC.md` 3-File Sync Pattern.

> **Todo**: mark PHASE 4 → `completed`, PHASE 5 → `in_progress`. Read `.claude/skills/game-define/references/phase5-sync.md` for Godot-specific backlog/dashboard/seed mutations.

> **Todo**: mark PHASE 5 → `completed`.

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
