---
name: project-plan
description: "Turn a seed into a gap-checked, prioritized feature backlog for /project-plan."
reads: [backlog.status, concept.seed, backlog.seedDrift, project.thinking]
writes: [backlog.status, backlog.features, concept.seed, backlog.seedDrift]
metadata:
  author: claude-config
  version: 2.3.0
  category: project
---

# Project Plan

## Overview

This is the **bridge** between the seed document and the dev or game pipeline.
Transforms structured idea markdown into a prioritized feature backlog ready for `/dev-ship (define phase)` (web) or `/game-ship (define phase)` (game). Along the way it actively hunts for **technical holes** the seed doesn't mention and proposes its own **improvements** (PHASE 1, step 6a) — the output is a plan, not just a transcription.

**Trigger**: `/project-plan`, `/project-plan [paste markdown]`, or `/project-plan reorg` (backlog re-order only)

## Input

Accepts markdown from:

- `/project-seed` output
- `/project-seed brainstorm` output
- Any structured concept markdown (web or game)

## Output

`.project/backlog.json` with:

- Decomposed features
- Dependencies
- P1/P2/P3/P4 priority
- Direct links to `/dev-ship {feature}` (web) or `/game-ship {feature}` (game)

## Workflow

### Mode dispatch (first — before any TaskCreate)

Arg `reorg` → **reorg mode**: a lightweight backlog re-order, not the pipeline below. Do not
create the 8-phase task list and do not enter plan mode. Read
`.claude/skills/project-plan/references/reorg-mode.md`, follow it, then stop. Any other
invocation → continue below.

**Phase tracking** — first action of the skill: call `TaskCreate` with these items
(status `pending`), then use `TaskUpdate` to set each phase to `in_progress` at the
start and `completed` at the end. During context compaction the task list remains
visible — no risk of forgetting phases.

1. Stack Detection
2. PHASE 0: Input Detection
3. PHASE 0.5: Research (Optional)
4. PHASE 1: Feature Extraction
5. Page-Discovery (WEB MODE only)
6. PHASE 2: Dependency Analysis
7. PHASE 3: Priority Assignment
8. PHASE 4: Generate Backlog

### Stack Detection (pre-PHASE 0)

> **Todo**: call `TaskCreate` with the 8 phase items above (status `pending`). Mark Stack Detection → `in_progress`.

**Goal:** Detect whether this is a web or game project so the correct feature types and terminology are used.

**Process:**

1. Try to read `.project/project.json`
2. Check fields in order:
   - `stack.engine === "godot"` → **GAME MODE**
   - `concept.platform === "game"` → **GAME MODE**
   - No match or no project.json → **WEB MODE**
3. **[WEB MODE] Mobile sub-detection:** `stack.framework`/`stack.packages[]` contains
   `react-native` or `expo` (or `concept.platform === "mobile"`) → set **WEB-MOBILE**.
   WEB-MOBILE runs the full WEB pipeline EXCEPT Page-Discovery: the `/design-convert`
   browser pipeline (Playwright/DOM) does not run against React Native, so screens stay
   FEATURE-typed and flow through `/dev-ship`.
4. Show detected mode:

   ```
   STACK DETECTED: web         (→ /dev-ship pipeline)
   STACK DETECTED: web-mobile  (→ /dev-ship pipeline, screens as FEATURE)
   STACK DETECTED: game        (→ /game-ship pipeline)
   ```

### Enter Plan Mode

Follow [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Entry protocol before PHASE 0. PHASE 0 → PHASE 3 (input detection → research → feature extraction → dependencies → priority) run in plan mode — the Scenario A semantic diff against an existing backlog (NEW/MODIFIED/INDEPENDENT/REMOVED) is the most error-sensitive thinking step and must run on the planning model. The final feature plan is written to the plan file for review. Skip the call if plan mode is already active (see PLAN-MODE.md skip-check). On a "Cancel" exit from PHASE 0: the skill simply stops — plan mode stays active for the user to dismiss; do not call `ExitPlanMode` for a cancel.

### PHASE 0: Input Detection

> **Todo**: mark Stack Detection → `completed`, PHASE 0 → `in_progress`. Read `.claude/skills/project-plan/references/input-detection.md`

### PHASE 0.5: Research (Optional)

> **Todo**: mark PHASE 0 → `completed`, PHASE 0.5 → `in_progress` (declined by the user → mark PHASE 0.5 `completed` immediately, no research runs). Read `.claude/skills/project-plan/references/research.md`

### PHASE 1: Feature Extraction

> **Todo**: mark PHASE 0.5 → `completed`, PHASE 1 → `in_progress`. Read `.claude/skills/project-plan/references/feature-extraction.md`

### Page-Discovery (WEB MODE only)

> **Todo**: mark PHASE 1 → `completed`, Page-Discovery → `in_progress` (GAME MODE or WEB-MOBILE → mark `completed` immediately, no pages proposed). Read `.claude/skills/project-plan/references/page-discovery.md`. On completion mark Page-Discovery → `completed`, PHASE 2 → `in_progress`.

### PHASE 2: Dependency Analysis

> **Todo**: mark Page-Discovery → `completed`, PHASE 2 → `in_progress`.

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

> **Todo**: mark PHASE 2 → `completed`, PHASE 3 → `in_progress`.

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

   **Degenerate-graph check**: if the proposed P1 covers ≥90% of all features (a single
   terminal goal pulling in nearly the whole graph — common in single-deliverable/event
   projects where nothing is genuinely optional), say so explicitly and surface the 4th
   option below instead of forcing an artificial P1/P2 split.

   Then AskUserQuestion — header "P1 scope", question "Proposed P1 above. Correct?":
   - "Yes, this is correct (Recommended)" → step 2
   - "Adjust goal features" → free-text: accept **names, numbers, OR semantic phrases**
     (e.g. `the pillars`, `1, 5, 6`, `all except home`). Re-resolve transitive
     dependencies on the new goal set, re-show the proposed P1, re-ask.
   - "Start minimal — one slice" → propose the thinnest single goal feature + its deps.
   - **[only when the degenerate-graph check fires]** "Reindex by build risk" → re-derive
     phases by build order instead of importance: P1 = foundation + highest-risk features
     (risk ≥4, or features the concept flags as having no fallback) + one low-risk feature
     as an end-to-end validation slice; P2+ = remaining features ordered by risk descending.
     Re-apply the dependency invariant (step 2) afterward.

   User can always say "all" or "none" in the adjust free-text.

   **Second-opinion hook** (auto-fires before the modal below, at most once) — if any of: (a)
   PHASE 1's Scenario A semantic diff proposed MODIFIED/REMOVED for ≥3 existing features; (b)
   PHASE 2 needed user intervention to break a circular dependency; (c) the degenerate-graph check
   above just fired:

   > **Todo**: Read `.claude/skills/shared/SECOND-OPINION.md` and follow it — the trigger
   > auto-fires the consult (no confirm step) with INPUT = seed doc path, `backlog.json`, the
   > diff table / dependency tree inline (project-plan row of § Brief contents). Fold the digest
   > into the P1 proposal above before asking (attended: show the digest, then ask; unattended:
   > Opus weighs it and revises the proposed P1 itself, or confirms it), set `secondOpinionUsed`,
   > carry the outcome to the final report's `Second opinion:` line.

2. **Auto-assign remaining features using heuristics:**
   - P2: Features that directly extend P1 functionality OR are prerequisites for important P3 features
   - P3: Nice-to-have, polish, extra content, integrations without core impact
   - P4: Stretch goals, experimental features, future considerations
   - When unclear: prefer P2 (easier to demote than to promote later)

   **Dependency invariant (enforce after assignment):** no feature may sit in a later
   phase than a feature that depends on it. For every feature, its dependencies must be
   in the same or an earlier phase — if a dependency landed later, promote it up. Apply
   transitively before showing the review table in step 3.

3. **Review with user** (mandatory gate — do not proceed to Requirements Coverage Check or the Seed Alignment Check without it):

   > **Todo**: show the proposed prioritization table, then AskUserQuestion ("Is this prioritization correct? P1 = must-have, P2 = extends P1, P3 = nice-to-have, P4 = later") — "Yes, this is correct (Recommended)" → continue below; any other answer → move features between priorities, show updated prioritization, re-ask. Loop until confirmed.

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

> **Todo**: check `project.json#concept.goals[]` and the seed for a requirements/rubric
> section now — mandatory to _check_ even when the outcome is silent-skip.

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

> **Todo**: run this gate now and output the inline log line (`Seed: ✓ aligned` or
> `Seed: ⚠ drift — N item(s)`) directly in chat — a plan-file copy does not substitute.

Follow [shared/SEED.md](../shared/SEED.md) § Alignment Check. Inputs: new features
added, features marked INDEPENDENT/CANCELLED (incl. cancel-proposal outcomes from
`references/update-reconcile.md`), and significant priority
reshuffles from this run. This skill is in plan mode — drift table and proposed
rewrite go into the plan file alongside the feature plan.

**Second-opinion hook (seed drift)** (auto-fires before the resolution prompt below,
at most once, independent budget slot from the PHASE 3 P1-modal hook) — if the drift
scan above found ≥2 contradiction/new-direction items:

> **Todo**: Read `.claude/skills/shared/SECOND-OPINION.md` and follow it — the trigger
> auto-fires the consult (no confirm step) with INPUT = seed doc path, the drift table
> inline, `backlog.json` (project-plan seed-drift row of § Brief contents). Fold the
> digest into the drift table/resolution prompt before asking, set `secondOpinionUsed`,
> carry the outcome to the final report's `Second opinion:` line.

On "Yes" → carry
`seedUpdateApproved: true` to PHASE 4. On "Skip" → carry `seedDrift[]` to PHASE 4
(written to `backlog.json#seedDrift[]`). `source: "/project-plan"`,
`ref: "feature:{name}"` where applicable.

**End of thinking phase**: follow [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Exit protocol — write the feature plan (features table with type/risk/phase/dependencies + ASCII dependency tree + priority breakdown) to the plan file, then `ExitPlanMode`. After approval the skill continues with PHASE 4 (`backlog.json` write + `.project/project.json` sync + server start).

### PHASE 4: Generate Backlog

> **Todo**: mark PHASE 3 → `completed`, PHASE 4 → `in_progress`. Read `.claude/skills/project-plan/references/generate-backlog.md`. On completion mark PHASE 4 → `completed`.
