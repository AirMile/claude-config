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
writes:
  [
    feature.requirements,
    backlog.stage,
    backlog.features,
    concept.seed,
    feature.seedDrift,
  ]
metadata:
  author: claude-config
  version: 3.3.0
  category: game
---

# Game Feature Definition

## Overview

This skill defines game feature requirements and architecture for Godot 4.x projects. It is PHASE 1 of the gamedev workflow: plan -> **define** -> build -> test -> refactor.

The skill gathers requirements through targeted questions, optionally researches Godot scene architecture, and designs the implementation. Output is a consolidated documentation file ready for the build phase.

**Trigger**: `/game-define` or `/game-define [feature-name]`

> **Vendored & pre-adapted for game-ship** — run **inline in the main chat** by game-ship PHASE 0
> (Step 2c of `phase-0-define-classify.md`), not as a standalone skill. This copy is already adapted:
> there is **no plan-mode machinery** and **no own phase tracking** (game-ship's task list drives).
> **game-ship runs PHASE 0→3 of this file entirely inside plan mode** (it calls `EnterPlanMode` before
> reading this file), so under an `opusplan`-style router the interview + architecture reason on the
> planning model. Practically: reads, read-only Bash, `WebSearch`/Context7, `AskUserQuestion`, and
> read-only research subagents all work here; only `.project/`/source writes are blocked — and every
> write below is already deferred to accept. Run **PHASE 0→3** (interview + architecture + the complete
> feature.json draft) and **hold the draft in memory** — no `feature.json` and no plan file is written
> here. **PHASE 4+5 run at game-ship's gate-accept** (Step 4b): the draft becomes the plan-file appendix
> and `feature-from-plan.js` writes `feature.json` on accept. Do not blind-sync this file from the
> standalone define skill — the adaptations are load-bearing.
>
> **Confirmations are hoisted to the gate.** game-ship presents the whole plan for review at its Step 4b
> gate (an `ExitPlanMode` approval), and reject loops back here to revise. So the pure-confirmation
> `AskUserQuestion`s below are **removed** — the interview summary-confirm (PHASE 1a), the ">6 REQs
> scope confirm" (PHASE 1b), the scene-layout confirm (PHASE 2b), and the Seed/Backlog-Impact prompts
> (PHASE 3) — their content becomes review sections of the gate plan file. Only genuine **decision**
> `AskUserQuestion`s stay: feature resolution (PHASE 0), design-choice forks (PHASE 1b), and the split
> proposal (PHASE 1c).

## When to Use

**Triggers:**

- `/game-define` - Start with feature name prompt
- `/game-define abilities` - Define ability system
- `/game-define player-movement` - Define player movement

**Works best with:**

- Godot 4.x projects with GDScript
- Games needing scene trees, signals, resources

## Workflow

**Phase tracking** — **none of its own.** game-ship's 6-phase task list is already active; track
define's phases in prose. Do **not** call `TaskCreate`/`TaskUpdate` here (it would clobber game-ship's list).

1. PHASE 0+1a+1b: Setup, Context, Interview & Requirements
2. PHASE 2+3: Architecture Check & Design
3. PHASE 4+5: feature.json + Sync (run at game-ship gate-accept)

### PHASE 0: Feature Name + Context

1. **If name provided** (`/game-define abilities`):
   - Use provided name as feature name
   - Continue to step 2b

2. **If no name** (`/game-define`):

   **a) Check backlog for next feature:**

   Backlog load: `node ~/.claude/scripts/backlog-load.js "$REPO" game-queue DEFINED defining` → `{ backlogPresent, items }` (see [shared/GAME-BACKLOG-LOAD.md](../shared/GAME-BACKLOG-LOAD.md)). Filter: first entry with `transition === "defining"` → auto-select (no modal needed). Empty result → fall through to option (c)/(d).

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
     - label: "Yes, /project-plan first (Recommended)", description: "Generate backlog from concept, then define features"
     - label: "No, define directly", description: "Define a standalone feature without backlog"
   multiSelect: false
   ```

   "Yes" → stop, show: `Run /project-plan to convert your concept into a backlog.`
   "No" → continue to option d.

   **d) No backlog, no concept (or user chose direct define):**

   Ask openly: "Which gameplay aspect do you want to work on?" — no preset options. Use the user's answer as the feature name (kebab-case it if needed).

**Tag backlog card as active** (immediately after feature name determination):

Read `.project/backlog.json` (if it exists), parse JSON (see `shared/BACKLOG.md`).
Find feature by name → keep `"status": "TODO"`, set `"stage": "defining"`, `data.updated` to now.
Write back via Edit.
Not found → skip (feature is added to backlog at PHASE 5).
The card stays in TODO but gets a pulsing `defining` stage-badge.
Keep the card's `description`, `risk`, and `dependencies` in memory — `description` feeds the PHASE 1a context echo and coverage check, `risk` the risk-check line.

2b. **Feature existence check** (after name determination, before context-load):

Check: `.project/features/{feature-name}/feature.json` exists?

- **Not found** → continue to step 3 (normal flow).
- **Found** → go to PHASE 0b (update-mode).

3. **Create project folder + signal active feature** — **skip in the game-ship context**: game-ship's
   Step 2a already did the `mkdir -p .project/features/{feature-name}` + the `active-{feature-name}.json`
   live-signal write **before** entering plan mode (writes are blocked once inside). Do not repeat them.
   (The standalone form would run `mkdir` + `node ~/.claude/scripts/ship-checkpoint.js signal {feature-name}` itself.)

   All `.project/` and `architecture-baseline.md` writes are **deferred to game-ship's gate-accept**
   (Step 4b) — PHASE 0→3 only read and author the in-memory draft, and plan mode blocks them anyway.

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
   - Project context load: `node ~/.claude/scripts/context-load.js "$REPO" game-define "{feature-name}"` → `{ project, projectContext }` (see [shared/GAME-CONTEXT-LOAD.md](../shared/GAME-CONTEXT-LOAD.md)). Extracts: `stack`, `pitch`, `features[]`, `entities[]`, `thinking[]` (filtered to current feature) from `project.json`; `patterns` (max 15) and full `architecture` from `project-context.json`. Use the extracted output for: stack fallback, feature context/pitch, existing feature list (prevent duplicates), existing entities, thinking as PHASE 1 input, code patterns, current scene graph.

   - **Open-items load** (feeds the PHASE 3 Backlog Impact Check): `node ~/.claude/scripts/backlog-load.js "$REPO" open-items "{feature-name}"` → `{ backlogPresent, items }` (see [shared/BACKLOG-LOAD.md](../shared/BACKLOG-LOAD.md) — store-generic, works on game backlogs too) and keep the compact list in memory. `backlogPresent: false` or empty `items` → the Impact Check will skip silently.
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

> **Todo**: Read `.claude/skills/game-ship/references/game-define/references/update-mode.md` for the full update-mode flow.

---

### PHASE 1a: Interview

> **Todo**: Read `.claude/skills/game-ship/references/game-define/references/phase1a-interview.md` for the full interview protocol — dimension checklist, tone rules, one-question-at-a-time flow, escape-hatch, and adaptive stop condition.

**Risk-check (only if `feature.risk >= 4`):** show one line before opening the interview — `⚠ HIGH RISK ({risk}/5): consider splitting this feature, verify dependencies, clarify scope before defining.`

**Surface relevant past decisions** (only with ≥1 match from PHASE 0 scan, otherwise skip silently):

```
PREVIOUSLY DECIDED (possibly relevant)
- [project] {decision} → chose {chosen} (constraint: {constraint})
- [feature-X] {decision} → chose {chosen} (constraint: {constraint})
```

Show before the first interview question. No action required — context only, so interview answers don't conflict with previously decided directions.

**Interview opening**: context echo + freshly composed anchored opening question per `references/phase1a-interview.md § Interview Start` — never a canned scaffold.

Conduct an open interview — one anchored open question at a time. **AskUserQuestion is not an opener in this phase** — it is allowed only as escalation step 2 of the ladder in `shared/QUESTIONING.md` (after two "I don't know"s on the same dimension). Paraphrase substantive answers to check understanding. Probe and follow up. Follow the dimension checklist and tone rules in `references/phase1a-interview.md`.

**If the user cannot answer a dimension**: follow the escape-hatch protocol in `references/phase1a-interview.md § Handling "I Don't Know" Responses`.

**End of interview**: **no blocking summary-confirm** — the whole plan is reviewed at the gate
(game-ship Step 4b `ExitPlanMode`), and reject loops back to revise, so the old "is this correct?"
ceremony is redundant. Close lightly: show a short recap (gameplay goal, player experience, key
mechanics, scope boundaries) as a **statement**, then **one optional final open question** ("anything
else before I write up the plan?") **only when genuinely useful** (an unresolved thread or a
best-guess dimension); if the interview landed cleanly, skip it. Then proceed to PHASE 1b — anything
still fuzzy is surfaced in the gate plan file, not re-litigated here.

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

**Scope note (no confirm):**

- **≤6 REQs**: show requirements table, append `Scope: {N} requirements — SINGLE feature, continuing.` and proceed to PHASE 2. Skip PHASE 1c.
- **>6 REQs**: show the table, append `Scope: {N} requirements — checking for a split.` and proceed **directly** to PHASE 1c (scope analysis). **No requirements-confirm AskUserQuestion** — the table above is a passive progress view, scope is reviewed at the gate, and only a genuine split proposal (PHASE 1c) still asks. (To adjust requirements, the user rejects at the gate.)

### PHASE 1c: Scope Analysis & Feature Splitting

**Condition:** Only run if requirement count exceeds 6 or there are clear independent clusters.

> **Todo**: Read `.claude/skills/game-ship/references/game-define/references/feature-splitting.md` for full scope analysis logic and split execution steps.

**Plan-mode note:** the split **proposal** `AskUserQuestion` stays (a genuine structural decision), but
its **disk writes** (`00-split.md` + sub-feature `mkdir`s) are **deferred to gate-accept** (Step 4b) —
plan mode blocks them now. Record the split in the draft as a `## Feature split` gate section; the
writes happen at accept alongside the sync.

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

   - **Collect baseline updates in memory** as `pendingBaselineAppends` (new Feature Pattern Index row, new signal patterns, new resource patterns) — the `architecture-baseline.md` write is deferred to gate-accept; PHASE 5 appends them during sync (see `references/phase5-sync.md`).

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

4. **No inline confirm** — the ASCII scene layout + gameplay state flow are authored into the draft
   and become a **required section of the gate review surface** (Step 4b), where the user reviews the
   visual design alongside everything else and reject-feedback adjusts it.

### PHASE 3: Architecture Design

> **Todo**: mark PHASE 2 → `completed`, PHASE 3 → `in_progress`.

**Output rule for this phase**: hold the design in the **in-memory draft** — do **not** write a plan file here (game-ship's Step 4b gate writes it from the draft) — scene tree, scripts, signals, resources, test strategy, dependency analysis/implementation order. In chat show only a short progress marker (e.g. `Architecture designed: {N} scripts, {K} signals.`). **Exception**: the PHASE 2b ASCII scene layout may appear inline in the AskUserQuestion description.

Design based on requirements (and research if done). Generate an ASCII state machine of the core gameplay loop (states + transitions + triggers) alongside the scene tree:

**Scene Tree:**

```
{RootNodeType} ({feature-name})
├── {ChildNode} ({NodeType})
└── {ChildNode} ({NodeType})
```

**Scripts:**

| File      | Class       | Purpose   |
| --------- | ----------- | --------- |
| {path}.gd | {ClassName} | {purpose} |

**Signals:**

| Signal | Emitter | Receivers | Purpose |
| ------ | ------- | --------- | ------- |

**Resources:**

| File | Type | Purpose |
| ---- | ---- | ------- |

**Test Strategy:**

| REQ ID | Test File | Test Function | Type |
| ------ | --------- | ------------- | ---- |

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

**Seed Alignment Check** (penultimate step in PHASE 3):

Follow [shared/SEED.md](../shared/SEED.md) § Alignment Check — but **run only the
detection**, not its `AskUserQuestion`. Inputs: REQ descriptions +
`acceptance[].then` + `clarifications[]` + `durableDecisions[]` from PHASE 1 and
PHASE 3 — clarifications are the PHASE 1 fork resolutions (scene ownership,
resource schema, signal boundary) and the most common source of seed divergence;
never scan without them. When drift is found, record the drift table + proposed
rewrite in the draft as a `## Proposed seed update` gate section (default action:
apply on accept). Carry `seedUpdateApproved: true` to PHASE 5 so accept applies it;
a gate reject that drops that section carries `seedDrift[]` to PHASE 4 instead
(written to `feature.json#seedDrift`). No drift → no section, no carry.
`source: "/game-define"`, `ref: "REQ-NNN"` where applicable.

**Backlog Impact Check** (last step in PHASE 3, directly after the Seed
Alignment Check — no size threshold; a two-REQ feature can still obsolete a card):

Follow [shared/BACKLOG.md](../shared/BACKLOG.md) § Impact Check — but **run only the
detection**, not its `AskUserQuestion`. Inputs: the `open-items` list from PHASE 0
step 5 + this feature's REQ descriptions, `acceptance[]`, `clarifications[]`, and
`durableDecisions[]`. When ≥1 card is impacted, record the impact table in the draft
as a `## Backlog impact` gate section (default action: apply the proposed verdicts on
accept). Carry those verdicts to PHASE 5 as `backlogImpact[]`; the mutations happen in
the accept sync batch, and the user can reject just that section at the gate. No
impact → no section, no carry.

**Machine contract appendix**: author the **complete feature.json draft** NOW (held in memory; game-ship's gate materializes it as the plan-file appendix at Step 4b) as a single ```json fenced block under a `## Appendix — machine contract (skip review)` heading, **compact single-line JSON (no indentation)** — halves the token cost of the plan-file echo. Include every define-owned field per the PHASE 4 field table below (name/status/created/depends/summary, requirements with full `acceptance[]` + game fields `tuningLevers`/`errorScenarios`, files, architecture, buildSequence, testStrategy, and the conditional fields). `interfaces[].definition` holds signal/resource/script declarations only — no method bodies. The heading marks it non-review; the design narrative above it (scene tree, flow, verification) is the review surface. Gate-accept extracts this block mechanically — no re-authoring.

**End of PHASE 3**: the complete in-memory draft (incl. the machine-contract appendix) is ready — **return to game-ship Step 3** (`phase-0-define-classify.md`). game-ship's Step 4b gate presents the draft for approval and, on accept, runs PHASE 4+5 below.

### PHASE 4+5 — run at game-ship gate-accept (Step 4b)

> These two phases are **not** run inline during PHASE 0→3. game-ship's Step 4b executes them on
> **Accept**: PHASE 4 extracts the draft into feature.json, PHASE 5 syncs the JSON files. Track their
> phases in prose (no `TaskCreate`).

### PHASE 4: Write feature.json

**Extract, don't re-author**: the complete feature.json draft was authored in PHASE 3 (held in memory, materialized as the gate plan-file appendix at Step 4b — the `## Appendix — machine contract` block). Run:

```
node ~/.claude/scripts/feature-from-plan.js <plan-file> .project/features/{feature-name}/feature.json
```

where `<plan-file>` is game-ship's gate plan file (Step 4b). The script extracts the ```json appendix, validates it, and — in update-mode — merges over the existing file (preserving `build`/`tests`/`refactor`/etc. that the draft does not own). Exit 0 = written, done.

**Fallback** (non-zero exit — appendix missing or invalid JSON in a legacy/post-compaction plan file): author `.project/features/{feature-name}/feature.json` by hand now, using the field table below and `shared/FEATURE.md` for the full schema.

The field table governs the appendix draft (and this fallback):

| Field                       | Condition                                                                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `name`, `created`, `status` | always (status = `"DEFINED"`, no stage — waiting for `/game-build`)                                                                                                                                    |
| `summary`                   | always                                                                                                                                                                                                 |
| `depends`                   | always (empty array if none)                                                                                                                                                                           |
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

> **Todo**: Read `.claude/skills/game-ship/references/game-define/references/phase5-sync.md` for Godot-specific backlog/dashboard/seed mutations.

## Best Practices

- Use AskUserQuestion for architecture/design choices (PHASE 1b) — in the PHASE 1a interview only as escalation per `shared/QUESTIONING.md § Escalation Ladder`
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
