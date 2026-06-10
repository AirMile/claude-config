---
name: game-define
description: Define Godot feature requirements and architecture. Use with /game-define.
reads:
  [
    backlog.status,
    feature.requirements,
    project-context.architecture,
    backlog.features,
  ]
writes: [feature.requirements, backlog.stage, concept.seed, feature.seedDrift]
metadata:
  author: claude-config
  version: 3.0.0
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

1. PHASE 0+1a+1b: Setup, Context, Interview & Requirements
2. PHASE 2+3: Architecture Check & Design
3. PHASE 4+5: feature.json + Sync

### PHASE 0: Feature Name + Context

> **Todo**: call `ToolSearch query="select:TaskCreate,TaskUpdate"` first — both tools are deferred and unusable without their schemas. Then call `TaskCreate` with the 3 phase items (see above). Mark PHASE 0+1a+1b → `in_progress` via `TaskUpdate`.

1. **If name provided** (`/game-define abilities`):
   - Use provided name as feature name
   - Continue to step 2b

2. **If no name** (`/game-define`):

   **a) Check backlog for next feature:**

   Backlog load (via [shared/GAME-BACKLOG-LOAD.md](../shared/GAME-BACKLOG-LOAD.md)):

   ```
   profile: queue
   status: DEFINED
   transition: defining
   ```

   Run the `queue` snippet. Filter: first entry with `transition === "defining"` → auto-select (no modal needed). Empty result → fall through to option (c)/(d).

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

   Ask openly: "Which gameplay aspect do you want to work on?" — no preset options. Use the user's answer as the feature name (kebab-case it if needed).

**Tag backlog card as active** (immediately after feature name determination):

Read `.project/backlog.json` (if it exists), parse JSON (see `shared/BACKLOG.md`).
Find feature by name → keep `"status": "TODO"`, set `"stage": "defining"`, `data.updated` to now.
Write back via Edit.
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
   - Project context load (via [shared/GAME-CONTEXT-LOAD.md](../shared/GAME-CONTEXT-LOAD.md)):

     ```
     profile: define
     feature-name: {feature-name}
     ```

     Run the two `node -e` snippets for the `define` profile. Extracts: `stack`, `pitch`, `features[]`, `entities[]`, `thinking[]` (filtered to current feature) from `project.json`; `patterns` (max 15) and full `architecture` from `project-context.json`. Use the extracted output for: stack fallback, feature context/pitch, existing feature list (prevent duplicates), existing entities, thinking as PHASE 1 input, code patterns, current scene graph.

   - **Name-match on thinking markdown**: Grep `.project/thinking/*.md` on feature name (filename + content). With 1+ match: read the match(es) and use as input for PHASE 1 questions. The `.md` files are the source of truth for thinking output — no 7-day window anymore.
   - **Learnings load** via [shared/LEARNINGS-LOAD.md](../shared/LEARNINGS-LOAD.md):
     ```
     scopes: [component, architectural]
     pitfall-prefix: true
     current-feature: <feature-name>
     ```
     Show the loaded output before PHASE 1 questions. Component-scoped patterns and architectural patterns guide architecture choices and requirement formulation. Pitfall-prefix prevents repetition of earlier bugs.
   - **Onboarding check** (evaluate immediately after project.json read):
     - `project.json` not present → show: `⚠️ No project.json found. Consider running /core-setup first for better codebase context.` Continue without (non-blocking).
     - Present but `stack` and `features` both absent or empty → show: `ℹ️ project.json exists but is missing codebase context. /core-setup can fill this in.`
     - Present with content → proceed silently.
   - **Past decisions** (only if `.project/features/` has any prior `feature.json`):

     > **Todo**: spawn `context-aggregator` agent via `Task` tool with:
     >
     > - `featureName` = current feature name
     > - `featureKeywords` = tokens from feature name (split kebab-case)
     > - `featuresDir` = `$REPO/.project/features`
     > - `thinkingDir` = `$REPO/.project/thinking`
     >
     > Parse `PRIOR_DECISIONS_START/END` block from response. Store for PHASE 1a "Surface relevant past decisions" render. Empty or missing block → silent skip (no output).

### PHASE 0b: Update-mode (only if feature.json already exists)

> **Todo**: Read `.claude/skills/game-define/references/update-mode.md` for the full update-mode flow.

---

### PHASE 1a: Interview

> **Todo**: Read `.claude/skills/game-define/references/phase1a-interview.md` for the full interview protocol — dimension checklist, tone rules, one-question-at-a-time flow, escape-hatch, and adaptive stop condition.

**Risk-check (only if `feature.risk >= 4`):**

If the loaded backlog feature has a `risk` score of 4 or 5, show this warning before opening the interview:

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

Show before the first interview question. No action required — context only, so interview answers don't conflict with previously decided directions.

**Interview opening**: "I see we're defining `{feature-name}`. Tell me first — what gameplay problem does this solve?"

Conduct an open interview — **no AskUserQuestion and no multiple-choice options in this phase**. Ask one open question at a time. Paraphrase substantive answers to check understanding. Probe and follow up. Follow the dimension checklist and tone rules in `references/phase1a-interview.md`.

**If the user cannot answer a dimension**: follow the escape-hatch protocol in `references/phase1a-interview.md § Handling "I Don't Know" Responses`.

**End of interview**: when all relevant dimensions are covered, close with an explicit summary + confirmation: "I understood that {brief summary of gameplay goal, player experience, key mechanics, and scope boundaries} — is this correct, or am I missing something?" Proceed to PHASE 1b only after the user confirms.

---

### PHASE 1b: Requirements Synthesis

> **Todo**: mark PHASE 0+1a+1b task still in progress — no TaskUpdate needed here.

**Design choices** (only for architecture-changing forks — scene ownership, resource schema, signal boundary, state machine approach): if the interview revealed a concrete A vs B vs C choice, resolve via AskUserQuestion before extracting requirements. Include "Not relevant for scope" if applicable. Record each as `{ "question": "{open branch}", "answer": "{chosen option}", "impact": "{which REQ area}" }` (written to `feature.json#clarifications` if ≥1 entry). Edge cases → add directly as acceptance criteria.

**>3 open forks** → handle the remainder inline during requirement extraction as edge cases.

#### Requirement Extraction

After questions, extract testable requirements:

- Each requirement gets an ID (REQ-001, REQ-002, etc.)
- Categorize by type (core, scene, script, signal)
- Determine test type for each
- Define acceptance scenarios per requirement as `{ when, then, category }` pairs (`category` ∈ `"happy" | "edge" | "boundary"`) (concrete, verifiable)

**Completeness self-check** (execute, do NOT show to user):

- Each `when` is a concrete trigger (player action, input event, signal, state transition). Each `then` is an observable result (node state, signal emitted, value change, visual feedback). Not vague: "works well", "feels good", "correct behaviour".
- **Scenario categories per REQ** — assign `category` to each acceptance entry:
  - Every REQ: ≥1 `happy` scenario (primary gameplay flow, REQ as designed).
  - REQ with player input, conditional logic, or signal-driven state change: ≥1 `edge` scenario (unusual-but-valid: duplicate input, rapid trigger, simultaneous actions, overlapping states).
  - REQ with numeric values, timing, or resource counters: ≥1 `boundary` scenario (min/max value, zero, at-capacity, first/last frame, off-by-one tick).
  - REQ with validation, boundary checks, or fail-paths: `errorScenarios[]` (plausible fail-paths only — already required).
- No overlap between requirements
- Scope fits 1 feature (if >6 REQs → flag for PHASE 1c)

Fill any gaps before proceeding: add missing acceptance criteria, split overlapping REQs.

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
    - label: "Start over", description: "Discard everything — restart PHASE 1a interview"
  - multiSelect: false

  **If "Edit"** → ask what to change, update requirements table, re-confirm.
  **If "Start over"** → restart PHASE 1a interview.

### PHASE 1c: Scope Analysis & Feature Splitting

**Condition:** Only run if requirement count exceeds 6 or there are clear independent clusters.

> **Todo**: Read `.claude/skills/game-define/references/feature-splitting.md` for full scope analysis logic and split execution steps.

### PHASE 2: Architecture Check (Automatic)

> **Todo**: mark PHASE 0+1a+1b → `completed`, PHASE 2+3 → `in_progress`.

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

- Use AskUserQuestion for architecture/design choices (PHASE 1b) — not for requirements gathering (PHASE 1a: open interview)
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
