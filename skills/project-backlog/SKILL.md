---
name: project-backlog
description: "Use with /project-backlog to turn a seed into a prioritized feature backlog."
reads: [backlog.status, concept.seed, backlog.seedDrift, project.thinking]
writes: [backlog.status, backlog.features, concept.seed, backlog.seedDrift]
metadata:
  author: claude-config
  version: 1.9.0
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
3. **[WEB MODE] Mobile sub-detection:** `stack.framework`/`stack.packages[]` contains
   `react-native` or `expo` (or `concept.platform === "mobile"`) → set **WEB-MOBILE**.
   WEB-MOBILE runs the full WEB pipeline EXCEPT Page-Discovery: the `/design-create`
   browser pipeline (Playwright/DOM) does not run against React Native, so screens stay
   FEATURE-typed and flow through `/dev-define → /dev-build`.
4. Show detected mode:

   ```
   STACK DETECTED: web         (→ /dev-define pipeline)
   STACK DETECTED: web-mobile  (→ /dev-define pipeline, screens as FEATURE)
   STACK DETECTED: game        (→ /game-define pipeline)
   ```

### Enter Plan Mode

Follow [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Entry protocol before PHASE 0. PHASE 0 → PHASE 3 (input detection → research → feature extraction → dependencies → priority) run in plan mode — the Scenario A semantic diff against an existing backlog (NEW/MODIFIED/INDEPENDENT/REMOVED) is the most error-sensitive thinking step and must run on the planning model. The final feature plan is written to the plan file for review. Skip the call if plan mode is already active (see PLAN-MODE.md skip-check). On a "Cancel" exit from PHASE 0: the skill simply stops — plan mode stays active for the user to dismiss; do not call `ExitPlanMode` for a cancel.

### PHASE 0: Input Detection

> **Todo**: Read `.claude/skills/project-backlog/references/input-detection.md`

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

1. **Propose a P1 set from the dependency graph (do not ask for numbers blind):**

   Using the PHASE 2 dependency graph, derive a proposed P1:
   - **Goal/leaf features** = features that nothing else depends on (the user-facing
     ends: pages, top-level mechanics). These are the natural must-have targets.
   - **Pull in their transitive dependencies** — every feature a goal feature needs
     (directly or indirectly) must ship with it. These are P1 by necessity, not choice.

   Show the proposed P1 with the reasoning made explicit:

   ```
   PROPOSED P1

   Goal features:        {leaf-1}, {leaf-2}, ...
   Pulled in (required): {dep-1}, {dep-2}, ...   ← transitive dependencies

   P1 ({n}): {full list}
   Remaining → P2+ (step 2)
   ```

   **[WEB MODE]** framing: "minimum needed for a working prototype".
   **[GAME MODE]** framing: "minimum needed for a playable prototype".

   Then AskUserQuestion — header "P1 scope", question "Proposed P1 above. Correct?":
   - "Yes, this is correct (Recommended)" → step 2
   - "Adjust goal features" → free-text: accept **names, numbers, OR semantic phrases**
     (e.g. `the pillars`, `1, 5, 6`, `all except home`). Re-resolve transitive
     dependencies on the new goal set, re-show the proposed P1, re-ask.
   - "Start minimal — one slice" → propose the thinnest single goal feature + its deps.

   User can always say "all" or "none" in the adjust free-text.

2. **Auto-assign remaining features using heuristics:**
   - P2: Features that directly extend P1 functionality OR are prerequisites for important P3 features
   - P3: Nice-to-have, polish, extra content, integrations without core impact
   - P4: Stretch goals, experimental features, future considerations
   - When unclear: prefer P2 (easier to demote than to promote later)

   **Dependency invariant (enforce after assignment):** no feature may sit in a later
   phase than a feature that depends on it. For every feature, its dependencies must be
   in the same or an earlier phase — if a dependency landed later, promote it up. Apply
   transitively before showing the review table in step 3.

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

**Requirements coverage check** (conditional — run before the Seed Alignment Check):

Trigger only when the concept declares explicit requirements/goals — `project.json#concept.goals[]`
non-empty, OR the seed has a requirements/rubric section (heading/table matching eisen/requirements/
rubric/criteria). No such source → skip silently (free-form concepts have no formal requirements).

Map each stated requirement to the feature(s) that satisfy it and the phase they land in:

```
REQUIREMENTS COVERAGE

| # | Requirement | Covered by | Phase |
|---|-------------|------------|-------|
| 1 | {requirement} | {feature(s)} | P1 |
```

Flag any requirement with **no covering feature**, or a hard requirement covered **only in P2+**.
Zero gaps → show the table as confirmation and proceed. Gaps → AskUserQuestion (recommended-first):
"Add a feature" / "Promote covering feature to P1" / "Accept the gap". Apply the choice, re-show,
proceed.

**Seed Alignment Check** (last step in PHASE 3, before ExitPlanMode):

Follow [shared/SEED.md](../shared/SEED.md) § Alignment Check. Inputs: new features
added, features marked INDEPENDENT/CANCELLED (incl. cancel-proposal outcomes from
`references/update-reconcile.md`), and significant priority
reshuffles from this run. This skill is in plan mode — drift table and proposed
rewrite go into the plan file alongside the feature plan. On "Yes" → carry
`seedUpdateApproved: true` to PHASE 4. On "Skip" → carry `seedDrift[]` to PHASE 4
(written to `backlog.json#seedDrift[]`). `source: "/project-backlog"`,
`ref: "feature:{name}"` where applicable.

**End of thinking phase**: follow [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Exit protocol — write the feature plan (features table with type/risk/phase/dependencies + ASCII dependency tree + priority breakdown) to the plan file, then `ExitPlanMode`. After approval the skill continues with PHASE 4 (`backlog.json` write + `.project/project.json` sync + server start).

### PHASE 4: Generate Backlog

> **Todo**: Read `.claude/skills/project-backlog/references/generate-backlog.md`
