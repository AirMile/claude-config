# PHASE 1: Feature Extraction

**Goal:** Identify distinct features from the concept.

**Learnings load** (before analysis) via [shared/LEARNINGS-LOAD.md](../shared/LEARNINGS-LOAD.md):

```
scopes: [architectural]
pitfall-prefix: true
current-feature: none
```

Show the loaded output. Architectural patterns guide feature decomposition. Pitfall-prefix prevents repeating structural bugs in new features.

**[WEB MODE]**

1. **Analyze:**
   - What are the core pages/routes?
   - What components need to be built?
   - What API endpoints are required?
   - What can be split into independent features?

   **If research was performed (PHASE 0.5), also consider:**
   - What already exists in the codebase that can be reused or extended?
   - What framework patterns or conventions should guide the decomposition?
   - What pitfalls or anti-patterns were identified to avoid?

   **Granularity decision:** When a feature could be defined as one large item OR multiple smaller items, apply the right-size rule: each feature should represent **1-3 days of work** and be **testable independently**. If in doubt, prefer smaller features — they're easier to combine than to split later.

   **If in update mode (from PHASE 0 Scenario A):**
   - Start from existing backlog features as baseline — do NOT extract from scratch
   - Apply concept changes on top: add NEW features, update MODIFIED descriptions, mark REMOVED as deprecated
   - INDEPENDENT features: always preserve unchanged — they are not concept-derived
   - DOING/DONE features are protected: keep as-is, only enrich description if concept adds new insights
   - CANCELLED features are protected: preserve as `status: "CANCELLED"`, exclude from planning and build order — treat as unavailable
   - Present the merged feature list with change markers for clarity

2. **Extract features:**
   - Each feature = one `/dev-define` unit
   - Feature should be implementable independently (with dependencies)
   - Name in kebab-case for CLI use

3. **Categorize by type:**
   | Type | Description |
   |------|-------------|
   | FEATURE | Core functionality (auth, data processing, core behavior) |
   | API | Backend endpoints, data fetching, services |
   | INTEGRATION | Third-party services (analytics, payments, auth providers) |
   | UI | Styling, UX improvements, visual components |
   | REFACTOR | Code quality, performance, architecture improvements |
   | PAGE | Frontend page/route (goes through design → convert → check pipeline) |
   | COMPONENT | Reusable UI component (goes through same pipeline as PAGE) |
   | PAGE-GAP | Missing functionality found by /frontend-design |

4. **Score risk:**

   Assign each feature a risk score:

   | Score | Risk (how complex?)                                     |
   | ----- | ------------------------------------------------------- |
   | 1     | Trivial change, no unknowns                             |
   | 2     | Known technique, few dependencies                       |
   | 3     | Average complexity, some unknowns                       |
   | 4     | Complex integration or new technology                   |
   | 5     | High complexity, many unknowns or external dependencies |

   **Per feature, note briefly:**
   - Risk score (1-5) + reason (max 1 sentence)

   **Heuristics:**
   - Features with external API/service dependency → higher risk
   - Features that partially exist in codebase (update mode) → lower risk

   **Extraction quality self-check** (run before review, do NOT show to user):
   - Each feature is 1-3 days of work (too large → split, too small → combine)
   - No overlapping scope between features
   - Dependencies are explicit (feature X requires feature Y → note for PHASE 2)
   - Risk scores are substantiated (score without reason → add reason)
   - Research findings incorporated (if PHASE 0.5 was done: findings reflected in feature descriptions)

   Adjust the feature list based on found gaps.

**[WEB MODE] Output:**

```
FEATURES EXTRACTED

Found {count} features:

| # | Feature | Type | Risk | Description | Change |
|---|---------|------|------|-------------|--------|
| 1 | {name} | {type} | {1-5} | {one-line description} | {NEW/MODIFIED/PROTECTED/INDEPENDENT/DEPRECATED/ —} |
| 2 | {name} | {type} | {1-5} | {one-line description} | {marker or — if unchanged} |
...

In update mode, the Change column shows what happened to each feature.
In create mode, the Change column is omitted.
```

5. **[WEB MODE] Reuse-Discovery (optional — only with ≥2 PAGE/FEATURE features with shared UI patterns):**

   **When to skip:** no frontend project, fewer than 2 PAGE/FEATURE features, or all UI patterns are already in `design.components[]`.

   Follow [Discovery — Reuse-Discovery](../shared/SKILL-PATTERNS.md#reuse-discovery) for the canonical protocol.

   **Trigger:** cross-page UI-pattern matching — group features by descriptions (List/table, Card, Form, Modal/dialog, Navigation). Threshold: 2+ PAGE/FEATURE features share the pattern. Add to the feature list (included in PHASE 4 backlog generation); also append kebab-name to `dependencies[]` of each PAGE/FEATURE that triggered the pattern.

   **Source:** `"/project-backlog"` · **Direction:** `"dev→frontend"` · **Type:** `COMPONENT`

   "Skip" → do not add COMPONENT features to the list.

6. **[WEB MODE] Design & Quality signals (optional — only with explicit mentions in concept):**

   Scan concept text for the following keywords. Only add if the concept **explicitly** mentions them — not on implicit speculation.

   | Keyword triggers                                                     | Type  | Name            | Phase |
   | -------------------------------------------------------------------- | ----- | --------------- | ----- |
   | "design tokens", "colors", "typography", "theme", "branding"         | THEME | `theme-init`    | P3    |
   | "a11y", "accessibility", "WCAG", "screen reader", "toegankelijkheid" | A11Y  | `a11y-baseline` | P3    |
   | "performance", "lighthouse", "core web vitals", "SEO", "speed"       | PERF  | `perf-baseline` | P3    |

   For each found item: add to the feature list as:

   ```json
   {
     "name": "{name from table}",
     "type": "THEME|A11Y|PERF",
     "status": "TODO",
     "phase": "P3",
     "description": "{relevant quote or paraphrase from concept}",
     "source": "/project-backlog"
   }
   ```

   "No matches" → do not add Design & Quality items.

---

**[GAME MODE]**

1. **Analyze:**
   - What are the core mechanics?
   - What systems need to be built?
   - What can be split into independent features?

   **If research was performed (PHASE 0.5), also consider:**
   - What already exists in the codebase that can be reused or extended?
   - What framework patterns or conventions should guide the decomposition?
   - What pitfalls or anti-patterns were identified to avoid?

   **Granularity decision:** When a feature could be defined as one large item OR multiple smaller items, apply the right-size rule: each feature should represent **1-3 days of work** and be **testable independently**. If in doubt, prefer smaller features — they're easier to combine than to split later.

   **If in update mode (from PHASE 0 Scenario A):**
   - Start from existing backlog features as baseline — do NOT extract from scratch
   - Apply concept changes on top: add NEW features, update MODIFIED descriptions, mark REMOVED as deprecated
   - INDEPENDENT features: always preserve unchanged — they are not concept-derived
   - DOING/DONE features are protected: keep as-is, only enrich description if concept adds new insights
   - Present the merged feature list with change markers for clarity

2. **Extract features:**
   - Each feature = one `/game-define` unit
   - Feature should be implementable independently (with dependencies)
   - Name in kebab-case for CLI use

3. **Categorize by type:**
   | Type | Description |
   |------|-------------|
   | CORE | Foundation systems (player, arena, input) |
   | MECHANIC | Gameplay mechanics (combat, abilities) |
   | CONTENT | Game content (specific abilities, elements) |
   | POLISH | Juice, effects, feel |
   | UI | User interface elements |

**[GAME MODE] Output:**

```
FEATURES EXTRACTED

Found {count} features:

| # | Feature | Type | Description | Change |
|---|---------|------|-------------|--------|
| 1 | {name} | {type} | {one-line description} | {NEW/MODIFIED/PROTECTED/INDEPENDENT/DEPRECATED/ —} |
| 2 | {name} | {type} | {one-line description} | {marker or — if unchanged} |
...

In update mode, the Change column shows what happened to each feature.
In create mode, the Change column is omitted.
```

4. **[GAME MODE] Feature Review (all modes):**

   Use AskUserQuestion:
   - header: "Feature Review"
   - question: "Are these features correct? You can add, remove, or adjust."
   - options:
     - label: "Yes, this is correct (Recommended)", description: "Features are correct, proceed to dependencies"
     - label: "Adjust features", description: "Add, remove, or change name/type/description"
   - multiSelect: false

   **Response handling:**
   - "Yes, this is correct" → proceed to PHASE 2 (game) or Reuse-Discovery if applicable (web)
   - "Adjust features" → ask what to change, apply changes, show updated table, re-ask
   - "Other" → parse user's freeform input, apply changes, show updated table, re-ask

   **Loop until user confirms features are correct.**

5. **[GAME MODE] Core loop validation (only in create mode or when P1 features changed):**

   Check whether the P1 features together form a playable gameplay loop:

   ```
   LOOP VALIDATION

   Moment-to-moment (0-30s):
   - Action: {what the player does} → Response: {what the system does} → Feedback: {what the player sees/hears}

   Session loop (5-30min):
   - Goal: {what the player is trying to achieve}
   - Attempt: {how the player tries to achieve it}
   - Outcome: {win/loss/progression}

   P1 loop complete? {YES / NO — {missing element}}
   ```

   - If the loop is NOT complete: show which element is missing and suggest adding a feature or promoting one to P1
   - If the loop IS complete: show confirmation and proceed

**[WEB MODE] Feature Review:**

Use AskUserQuestion:

- header: "Feature Review"
- question: "Are these features correct? You can add, remove, or adjust."
- options:
  - label: "Yes, this is correct (Recommended)", description: "Features are correct, proceed to dependencies"
  - label: "Adjust features", description: "Add, remove, or change name/type/description/risk"
- multiSelect: false

**Response handling:**

- "Yes, this is correct" → proceed to PHASE 2
- "Adjust features" → ask what to change (add/remove/edit name/type/description/risk), apply changes, show updated table, re-ask
- "Other" → parse user's freeform input, apply changes, show updated table, re-ask

**Loop until user confirms features are correct.**
