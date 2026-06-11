---
name: project-backlog
description: Transform a seed into a prioritized feature backlog (create or update mode, with page-discovery for web). Use with /project-backlog.
reads: [backlog.status]
writes: [backlog.status, concept.seed, backlog.seedDrift]
metadata:
  author: claude-config
  version: 1.4.0
  category: project
---

# Project Backlog

## Overview

This is the **bridge** between the seed document and the dev or game pipeline.
Transforms structured idea markdown into a prioritized feature backlog ready for `/dev-define` (web) or `/game-define` (game).

**Trigger**: `/project-backlog` or `/project-backlog [paste markdown]`

## Input

Accepts markdown from:

- `/project-seed` output
- `/project-brainstorm` output
- Any structured concept markdown (web or game)

## Output

`.project/backlog.json` with:

- Decomposed features
- Dependencies
- P1/P2/P3/P4 priority
- Direct links to `/dev-define {feature}` (web) or `/game-define {feature}` (game)

## Workflow

### Stack Detection (pre-PHASE 0)

**Goal:** Detect whether this is a web or game project so the correct feature types and terminology are used.

**Process:**

1. Try to read `.project/project.json`
2. Check fields in order:
   - `stack.engine === "godot"` → **GAME MODE**
   - `concept.platform === "game"` → **GAME MODE**
   - No match or no project.json → **WEB MODE**
3. Show detected mode:

   ```
   STACK DETECTED: web    (→ /dev-define pipeline)
   STACK DETECTED: game   (→ /game-define pipeline)
   ```

### PHASE 0: Input Detection

> **Todo**: Read `.claude/skills/project-backlog/references/input-detection.md`

### Enter Plan Mode

Follow [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Entry protocol before PHASE 0.5. PHASE 0.5 → PHASE 3 (research → feature extraction → dependencies → priority) run in plan mode; the final feature plan is written to the plan file for review.

### PHASE 0.5: Research (Optional)

> **Todo**: Read `.claude/skills/project-backlog/references/research.md`

### PHASE 1: Feature Extraction

> **Todo**: Read `.claude/skills/project-backlog/references/feature-extraction.md`

### PHASE 2: Dependency Analysis

**Goal:** Determine implementation order based on dependencies.

1. **Per feature**: what must exist first? Can it be built standalone?

2. **Build dependency graph** — ASCII decomposition tree with dependency edges, e.g.:

   ```
   routing (base)
   └── auth-pages
       └── user-dashboard
           ├── profile-settings
           └── api-user-data
   ```

3. **Detect circular dependencies** — suggest how to break the cycle; unclear → ask the user.

4. **[WEB MODE] Detect broken dependencies:** flag dependencies on CANCELLED features before the dependency table and ask the user (remove the dependency, or restore via backlog UI) before proceeding to PHASE 3.

**Output:**

```
DEPENDENCIES MAPPED

| Feature | Depends On | Blocks |
|---------|------------|--------|
| {feature-1} | - | {feature-2} |
...

Dependency tree:
{ascii tree}
```

5. **Review with user:** AskUserQuestion ("Is this order correct?") — "Yes, this is correct (Recommended)" → PHASE 3; any other answer (incl. "Other") → parse the change (add/remove/reorder), update graph, show updated table, re-ask. Loop until confirmed.

### PHASE 3: Priority Assignment

**Goal:** Assign priorities (P1–P4).

1. **Show feature list as numbered plain text:**

   ```
   Features ({N} total):

   1. {feature-1}: {description}
   2. {feature-2}: {description}
   ...
   ```

   **[WEB MODE]** Ask: "Which features are P1 (minimum needed for a working prototype)? Give numbers (e.g. `1, 3, 5` or `1-4` or `all except 2, 7`)."
   **[GAME MODE]** Ask: "Which features are P1 (minimum needed for a playable prototype)? Give numbers (e.g. `1, 3, 5` or `1-4` or `all except 2, 7`)."

   Parse free-form input → P1-set. User can also say "all" or "none".

2. **Auto-assign remaining features using heuristics:**
   - P2: Features that directly extend P1 functionality OR are prerequisites for important P3 features
   - P3: Nice-to-have, polish, extra content, integrations without core impact
   - P4: Stretch goals, experimental features, future considerations
   - When unclear: prefer P2 (easier to demote than to promote later)

3. **Review with user:** show the proposed prioritization table, then AskUserQuestion ("Is this prioritization correct? P1 = must-have, P2 = extends P1, P3 = nice-to-have, P4 = later") — "Yes, this is correct (Recommended)" → PHASE 4; any other answer → move features between priorities, show updated prioritization, re-ask. Loop until confirmed.

**Output:**

```
PRIORITY ASSIGNED

P1:
- {feature}: {reason}
- {feature}: {reason}

P2:
- {feature}: {reason}

P3:
- {feature}: {reason}

P4:
- {feature}: {reason}
```

**Seed Alignment Check** (last step in PHASE 3, before ExitPlanMode):

Follow [shared/SEED.md](../shared/SEED.md) § Alignment Check. Inputs: new features
added, features marked INDEPENDENT/CANCELLED/DEPRECATED, and significant priority
reshuffles from this run. This skill is in plan mode — drift table and proposed
rewrite go into the plan file alongside the feature plan. On "Yes" → carry
`seedUpdateApproved: true` to PHASE 4. On "Skip" → carry `seedDrift[]` to PHASE 4
(written to `backlog.json#seedDrift[]`). `source: "/project-backlog"`,
`ref: "feature:{name}"` where applicable.

**End of thinking phase**: follow [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Exit protocol — write the feature plan (features table with type/risk/phase/dependencies + ASCII dependency tree + priority breakdown) to the plan file, then `ExitPlanMode`. After approval the skill continues with PHASE 4 (`backlog.json` write + `.project/project.json` sync + server start).

### PHASE 4: Generate Backlog

> **Todo**: Read `.claude/skills/project-backlog/references/generate-backlog.md`
