---
description: Define game feature requirements and architecture
---

# Game Feature Definition

## Overview

This skill defines game feature requirements and architecture for Godot 4.x projects. It is FASE 1 of a 3-step gamedev workflow: define -> build -> test.

The skill gathers requirements through targeted questions, optionally researches Godot scene architecture, and designs the implementation. Output is a consolidated documentation file ready for the build phase.

**Trigger**: `/game:define` or `/game:define [feature-name]`

## When to Use

**Triggers:**
- `/game:define` - Start with feature name prompt
- `/game:define abilities` - Define ability system
- `/game:define player-movement` - Define player movement

**Works best with:**
- Godot 4.x projects with GDScript
- Games needing scene trees, signals, resources

## Workflow

### FASE 0: Feature Name

1. **If name provided** (`/game:define abilities`):
   - Use provided name as feature name
   - Continue to FASE 1

2. **If no name** (`/game:define`):
   Use **AskUserQuestion** tool:
   - header: "Feature Name"
   - question: "Welke game feature wil je definiëren?"
   - options:
     - label: "Ability System", description: "Speler abilities en element-based krachten"
     - label: "Player Movement", description: "Beweging, controls, physics"
     - label: "Combat System", description: "Damage, health, knockback"
     - label: "UI System", description: "HUD, menus, ability selection"
   - multiSelect: false

3. **Create workspace folder:**
   ```bash
   mkdir -p .workspace/features/{feature-name}
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

Show requirements table and confirm with user.

### FASE 2: Architecture Check (Automatisch)

**Goal:** Automatisch bepalen of research nodig is op basis van architecture-baseline.

**Steps:**

1. **Read architecture-baseline.md:**
   ```
   Read(".claude/research/architecture-baseline.md")
   ```

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
   Tip: Run /setup om baseline te genereren.
   ```
   - Always launch godot-scene-researcher agent
   - Do NOT create baseline (that's /setup's job)

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

### FASE 4: Generate Output

Write to `.workspace/features/{feature-name}/01-define.md`:

```markdown
# Feature Definition: {Feature Name}

**Created:** {date}
**Status:** defined

## Summary
{description}

## Requirements

| ID | Requirement | Category | Test Type |
|----|-------------|----------|-----------|
| REQ-001 | {description} | {category} | {type} |

## User Answers
{answers from FASE 1}

## Godot Research
{if research was done}

## Architecture

### Scene Tree
{scene tree}

### Files to Create
{scenes, scripts, resources}

### Signals
{signal table}

## Implementation Order

### Dependency Analysis
{dependency analysis from FASE 3}

### Build Sequence
1. REQ-XXX - {description} (base)
2. REQ-XXX - {description} (after REQ-XXX)
...

## Test Strategy
{test table}

## Next Steps
Run `/game:build {feature-name}` to start implementation.
```

### FASE 5: Sync Backlog

**Goal:** Update `.workspace/backlog.md` with new status.

**Backlog uses list-based format (not tables) for better readability.**

**Steps:**

1. **Check if backlog exists:**
   ```
   Read(".workspace/backlog.md")
   ```
   - If file not found: skip sync (no backlog to update)

2. **Find feature in backlog:**
   - Search MVP Features, Phase 2, Phase 3 sections for feature name
   - If found: move from `### TODO` to `### DEF` subsection
   - If NOT found: add to "Ad-hoc Features" section

3. **Update feature status (if found in planned features):**

   Move the line from TODO section:
   ```markdown
   ### TODO
   - **element-water** (CONTENT) → ability-system
     Water abilities (projectile, shield, etc.)
   ```
   To DEF section:
   ```markdown
   ### DEF
   - **element-water** (CONTENT) → ability-system
     Water abilities (projectile, shield, etc.)
   ```

4. **Add to Ad-hoc Features (if NOT found in planned features):**

   Add to Ad-hoc section under `### DEF`:
   ```markdown
   ### DEF
   - **mouse-aim** (MECHANIC) - {date}
     {description from 01-define.md}
   ```

5. **Update section header counts:**
   - `## MVP Features ({done}/{total} done)`
   - Recalculate done count

6. **Update "Updated" timestamp:**
   ```
   **Updated:** {current date}
   ```

7. **Update "Next" suggestion:**
   - Find first feature in `### TODO` section
   - Update: `**Next:** /game:define {first-todo-feature}`

**Output:**
```
BACKLOG SYNCED

Feature: {feature-name}
Status: TODO → DEF
Location: {MVP Features | Phase 2 | Ad-hoc}
```

**Completion notification:**
```bash
powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "Definition complete"
```

## Best Practices

- Use AskUserQuestion for all structured choices
- Extract testable requirements with REQ-IDs
- Scene research is optional but recommended for complex features
- Keep architecture focused on what's needed

## Restrictions

This skill must NEVER:
- Write actual implementation code (that's /game:build's job)
- Skip the requirements extraction step
- Proceed without user confirmation at checkpoints

This skill must ALWAYS:
- Use business-like, direct tone
- Extract testable requirements with REQ-IDs
- Include all sections in 01-define.md output
- Show copyable next command at the end
