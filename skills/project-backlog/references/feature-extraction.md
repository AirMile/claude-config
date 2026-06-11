# PHASE 1: Feature Extraction

**Goal:** Identify distinct features from the concept. Steps are mode-agnostic unless marked [WEB MODE]/[GAME MODE].

**Learnings load** (before analysis) via [shared/LEARNINGS-LOAD.md](../../shared/LEARNINGS-LOAD.md):

```
scopes: [architectural]
pitfall-prefix: true
current-feature: none
```

Show the loaded output. Architectural patterns guide feature decomposition. Pitfall-prefix prevents repeating structural bugs in new features.

1. **Analyze** the concept for decomposition:
   - [WEB MODE] core pages/routes, components to build, required API endpoints, independent splits
   - [GAME MODE] core mechanics, systems to build, independent splits

   **If research was performed (PHASE 0.5), also consider:** what already exists in the codebase to reuse/extend, framework patterns or conventions that should guide decomposition, and pitfalls/anti-patterns to avoid.

   **Granularity decision:** each feature should represent **1-3 days of work** and be **testable independently**. If in doubt, prefer smaller features — easier to combine than to split later.

   **If in update mode (from PHASE 0 Scenario A):**
   - Start from existing backlog features as baseline — do NOT extract from scratch
   - Apply concept changes on top: add NEW features, update MODIFIED descriptions, mark REMOVED as deprecated
   - INDEPENDENT features: always preserve unchanged — they are not concept-derived
   - DOING/DONE features are protected: keep as-is, only enrich description if concept adds new insights
   - CANCELLED features are protected: preserve as `status: "CANCELLED"`, exclude from planning and build order
   - Present the merged feature list with change markers for clarity

2. **Extract features:** each feature = one `/dev-define` (web) or `/game-define` (game) unit, implementable independently (with dependencies), kebab-case name for CLI use.

3. **Categorize by type:**

   **[WEB MODE]:**
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

   **[GAME MODE]:**
   | Type | Description |
   |------|-------------|
   | CORE | Foundation systems (player, arena, input) |
   | MECHANIC | Gameplay mechanics (combat, abilities) |
   | CONTENT | Game content (specific abilities, elements) |
   | POLISH | Juice, effects, feel |
   | UI | User interface elements |

4. **[WEB MODE] Score risk:**

   Assign each feature a risk score:

   | Score | Risk (how complex?)                                     |
   | ----- | ------------------------------------------------------- |
   | 1     | Trivial change, no unknowns                             |
   | 2     | Known technique, few dependencies                       |
   | 3     | Average complexity, some unknowns                       |
   | 4     | Complex integration or new technology                   |
   | 5     | High complexity, many unknowns or external dependencies |

   Per feature: risk score (1-5) + reason (max 1 sentence). Heuristics: external API/service dependency → higher; partially exists in codebase (update mode) → lower.

   **Extraction quality self-check** (run before review, do NOT show to user): each feature 1-3 days (too large → split); no overlapping scope; dependencies explicit (note for PHASE 2); risk scores substantiated; research findings reflected in descriptions. Adjust the feature list based on found gaps.

5. **Output** (both modes):

   ```
   FEATURES EXTRACTED

   Found {count} features:

   | # | Feature | Type | Risk | Description | Change |
   |---|---------|------|------|-------------|--------|
   | 1 | {name} | {type} | {1-5} | {one-line description} | {NEW/MODIFIED/PROTECTED/INDEPENDENT/DEPRECATED/ —} |
   ...
   ```

   Risk column: web mode only. Change column: update mode only (omit in create mode).

6. **Feature Review (all modes):**

   AskUserQuestion — header "Feature Review", question "Are these features correct? You can add, remove, or adjust.", options "Yes, this is correct (Recommended)" / "Adjust features". Response handling: "Yes" → continue below; "Adjust features" or "Other" → apply changes, show updated table, re-ask. **Loop until confirmed.**

   After confirmation: [GAME MODE] → step 7, then PHASE 2 · [WEB MODE] → step 8, then Page-Discovery.

7. **[GAME MODE] Core loop validation (only in create mode or when P1 features changed):**

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

   - Loop NOT complete → show which element is missing and suggest adding a feature or promoting one to P1
   - Loop complete → show confirmation and proceed

8. **[WEB MODE] THEME signal (optional — only on explicit mention in concept):**

   If the concept explicitly mentions "design tokens", "colors", "typography", "theme", or "branding" (no implicit speculation): add `{ "name": "theme-init", "type": "THEME", "status": "TODO", "phase": "P3", "description": "{relevant quote from concept}", "source": "/project-backlog" }` to the feature list — `/frontend-tokens` auto-triggers on THEME items. No match → skip.

---

**[WEB MODE] Page-Discovery (always — after feature review confirms):**

> **Todo**: Read `.claude/skills/project-backlog/references/page-discovery.md` and follow the Page-Discovery flow before proceeding to PHASE 2.
