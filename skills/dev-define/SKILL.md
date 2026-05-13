---
name: dev-define
description: >-
  Define feature requirements and architecture before the build phase. Use
  with /dev-define [feature-name] to produce requirements, acceptance criteria,
  and architecture from a backlog item or a fresh name. Also handles PAGE and
  COMPONENT features from the backlog (functional pipeline, independent of
  /frontend-design).
writes:
  [feature.requirements, feature.architecture, feature.files, backlog.status]
metadata:
  author: claude-config
  version: 2.6.0
  category: dev
---

# Feature Definition

PHASE 1 of the dev workflow: define → build → test.

**Trigger**: `/dev-define` or `/dev-define [feature-name]`

## Workflow

### PHASE 0: Feature Name & Context

1. **If name provided** (`/dev-define auth`): use as feature name, go to step 2b.

2. **If no name** (`/dev-define`):

   a) Read `.project/backlog.html` → parse JSON from `<script id="backlog-data">` (see `shared/BACKLOG.md → Lifecycle Protocol → Read`).
   - First check: `data.features.find(f => f.type === "FEATURE" && f.transition === "defining")` → if found, auto-select, show: `Backlog: ✓ Task picked up — {name}`, go to step 3.
   - Fallback: `data.features.find(f => f.status === "TODO")` (first TODO).

   b) **If backlog feature found (fallback path):**
   AskUserQuestion: "Next feature from backlog: **{name}**. Continue with this?"
   - "{name} (Recommended)" / "Different feature"
   - Backlog chosen → step 3. "Different feature" → option c.

   c) **No backlog but concept present:**
   Read `SEED_CONTEXT` per `shared/SEED.md`. If `SEED_CONTEXT.present`:
   AskUserQuestion:

   ```yaml
   header: "Concept without backlog"
   question: "There is a concept but no backlog yet. Do you want to generate a backlog first?"
   options:
     - label: "Yes, first /project-backlog (Recommended)", description: "Generate backlog from concept, then define features"
     - label: "No, define directly", description: "Define a standalone feature without a backlog"
   multiSelect: false
   ```

   "Yes" → stop, show: `Run /project-backlog to convert your concept into a backlog.`
   "No" → continue to option d.

   d) **No backlog, no concept (or direct define chosen):**
   AskUserQuestion: "Which feature do you want to define?" with 3 suggestions relevant to the project.

2b. **Feature existence check** (after name is determined, before context load):

Check: `.project/features/{feature-name}/feature.json` exists?

- **Not found** → continue to step 3 (normal flow).
- **Found** → go to PHASE 0b (update-mode).

3. **Project folder + context** (parallelize):
   - `mkdir -p .project/features/{feature-name}`
   - `mkdir -p .project/session && echo '{"feature":"{feature-name}","skill":"define","startedAt":"{ISO timestamp}"}' > .project/session/active-{feature-name}.json`
   - Glob + Grep for existing code that imports the feature name. With 0 matches: continue silently. With ≥1 match: briefly mention which files already reference the name.
   - Read `.project/project.json` → extract:
     - `stack` — framework, language, packages (fallback if stack-baseline.md does not exist)
     - `SEED_CONTEXT.pitch` or first 2 sentences of `SEED_CONTEXT.markdown` as feature context (see `shared/SEED.md`)
     - `features[]` — existing features (prevents duplicates/overlap)
     - `endpoints` — existing API surface
     - `data.entities` — existing data model
     - `thinking[]` — scan for entries with `newFeature` field matching the feature name (added via `/project-todo`). Load those as context.
     - `design.components[]` — existing component specs (used for reuse-discovery in PHASE 1)
     - `design.pages[]` — existing page specs (used for reuse-discovery context)
   - **Onboarding check** (evaluate immediately after project.json read):
     - `project.json` not present → show: `⚠️ No project.json found. Consider running /core-setup first for better codebase context.`
     - Present but empty (no `context`, `stack`, and `features`) → show: `ℹ️ project.json exists but lacks codebase context. /core-setup can fill this in.`
     - Present with content → continue silently.
     - Non-blocking — skill always continues.
   - **Name-match on thinking markdown**: Grep `.project/thinking/*.md` for feature name (filename + content). With 1+ match: read the match(es) and use as input for PHASE 1 questions. The `.md` files are the source of truth for thinking output — no 7-day window anymore.
   - **Backlog card → TODO**: Read `.project/backlog.html` → parse JSON from `<script id="backlog-data">`. Find feature by name → keep `status: "TODO"`, set `date: "{date}"`. Not found → add to `data.features` with `phase: "P4"`, `status: "TODO"`. Set `data.updated` to today. Write back to `backlog.html`.
   - Read `.project/project-context.json` (if exists) → extract:
     - `context.patterns` — existing code patterns
   - **Learnings load** via [shared/LEARNINGS-LOAD.md](../shared/LEARNINGS-LOAD.md):

     ```
     scopes: [component, architectural]
     pitfall-prefix: true
     current-feature: <feature-name>
     ```

     **Required output at ≥1 match** — show as separate chat block before PHASE 1 questions (not merged with past-decisions output):

     ```
     RELEVANT LEARNINGS
     - [pattern] {summary} (from feature {feature})
     - [pitfall] {summary} (from feature {feature})
     ```

     No matches → show nothing, continue silently.

   - Read `.claude/research/stack-baseline.md` (convention/patterns detail — if not available, use `project.json.stack` as basis)
   - **Past decisions scan** (two sources, both scoped):
     - Feature-scope: Glob `.project/features/*/feature.json` → flatten all `durableDecisions[]`. Tag each entry with `[feature-X]`.
     - Project-scope: Glob `.project/thinking/*-decision-*.md` → read first ~30 lines per file, extract `THINK:` line (title), `RECOMMENDATION:` line (chosen), and `CONSTRAINT` section. Tag each entry with `[project]`.
     - Merge both sources. Filter relevant via keyword overlap between current feature name/concept and each decision's title, chosen, or constraint (≥2 substantive terms). Keep top 3 most relevant.

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
     - label: "Add requirements (Recommended)", description: "New requirements via PHASE 1 flow, numbered from REQ-{N+1}"
     - label: "Modify requirements", description: "Reword existing requirements or adjust acceptance"
     - label: "Remove requirements", description: "Remove requirements from scope (soft-delete)"
     - label: "Multiple of the above", description: "Combination of add, modify, and/or remove"
   multiSelect: false
   ```

4. Process delta based on choice:
   - **Add**: Run through PHASE 1 Requirements Gathering for new requirements only. Number from `REQ-{N+1}`.
   - **Modify**: Ask which REQ-IDs. Per REQ: show current description + acceptance, ask for new version. Use format `[{ when, then }]` per scenario.
   - **Remove**: Ask which REQ-IDs. Mark with `deltaOp: "REMOVED"` — do not physically remove from array. Also: remove the REQ-ID from all `buildSequence[].requirements[]` arrays; if a step becomes empty afterwards → remove the step.
   - **Multiple**: Combine the above flows in one round.

5. Save `deltaOp` per requirement:
   - Unchanged: `"deltaOp": "UNCHANGED"`
   - New: `"deltaOp": "ADDED"`
   - Modified: `"deltaOp": "MODIFIED"` + `"previousDescription": "{original text}"`
   - Removed: `"deltaOp": "REMOVED"` (stays in array, not built or tested)

6. **Status-reset**: if feature `status` was `"DOING"` → reset to `"DEFINED"` in `feature.json` and backlog.

7. Skip PHASE 1b (feature splitting) unless the number of requirements after update exceeds 6 and there are clear clusters.

8. Go to PHASE 2 for ADDED and MODIFIED requirements only. UNCHANGED requirements do not need re-architecture, unless MODIFIED requirements have architectural impact (ask user).

9. At PHASE 3 write: **merge** delta into existing `feature.json` — do not overwrite completely. Keep existing `architecture`, `apiContract`, `design`, `testStrategy`, `durableDecisions`, `research` and UNCHANGED requirements intact (unless MODIFIED requirements have architectural impact — ask user). `buildSequence`: remove steps that are empty after REMOVED-filtering; add new steps for ADDED requirements (from PHASE 2 architecture output); leave existing steps for UNCHANGED requirements untouched.

---

### PHASE 0c: Enter Plan Mode

Follow [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Entry protocol before PHASE 1. PHASE 1 + 2 run in plan mode; all PHASE 2 design output is written to the plan file for review. All PHASE 0 setup writes are done at this point — file writes (feature.json, .project/\* updates) wait until after ExitPlanMode.

---

### PHASE 1: Requirements Gathering

**Risk-check (only if `feature.risk >= 4`):**

If the loaded backlog feature has a `risk` score of 4 or 5, show this warning before the first question:

```
⚠ HIGH RISK — Complexity {risk}/5

This feature has a high complexity score. Consider before defining:
- Split the feature into smaller parts
- Verify that dependencies are available
- Discuss scope with the user if parts are unclear
```

**Surface relevant past decisions** (only with ≥1 match from PHASE 0 scan, otherwise skip silently):

```
PREVIOUSLY DECIDED (possibly relevant)
- [project] {decision} → chose {chosen} (constraint: {constraint})
- [feature-X] {decision} → chose {chosen} (constraint: {constraint})
```

Show before the first AskUserQuestion. No action question — context only so question-1 answers don't conflict with previously decided directions. If a current answer option directly conflicts, mention that briefly in the option description ("Deviates from {feature-X} decision").

3-5 questions via AskUserQuestion, tailored to stack and project type.

**Must-cover categories** (always cover, phrasing adaptive per stack):

- **Core function**: what must it do from a user perspective?
- **Data/state**: where does data come from, how is it stored/managed?
- **Output/contract**: what does it produce? (backend: response types, error handling, exported interface. UI: events, visual feedback. CLI: output format.)

**Question 1 (always): Core Function** — "What should this feature do?" with 2-3 options.

**Questions 2-4 (adaptive)**: Cover the must-cover categories. Choose subcategories appropriate for the stack (patterns, visual/output, persistence, API design). Derive options from the baseline and existing code. Combine related questions in one AskUserQuestion call if they are logically connected (max 2 per call).

**Question 5 (optional)**: Only for complex configuration or multiple approaches.

**User-delegation**: if the user responds with "what do you think?" or similar, give a brief recommendation with trade-off and proceed with that choice.

#### Follow-up Check

After the initial questions, evaluate whether there are open branches:

- Unaddressed edge cases in the answers
- Implicit assumptions that haven't been confirmed
- Conflicts between answers

**Skip follow-up** if the feature is simple (≤5 expected REQs) AND there are no open branches.
**Otherwise**: ask 1-2 targeted follow-up questions. Frame as "What happens if...?" or "How does this handle...?"

Max 2 extra questions, then proceed to extraction.

#### Gray-Area Resolution

**Skip** if the follow-up check found no open branches.

**Otherwise**: for each identified open branch (max 3):

1. Frame the ambiguity as a concrete choice via AskUserQuestion:
   - Header: the open branch as a short sentence
   - Options: 2-3 concrete approaches + "Not relevant to scope"
   - First option = Recommended

2. Record the choice as a clarification:
   `{ "question": "{open branch}", "answer": "{chosen option}", "impact": "brief note on which requirement area this affects" }`

**"Not relevant"** → record as scoped-out, not as a requirement.
**>3 open branches** → handle remaining ones inline during requirement extraction as edge cases.

Max 3 AskUserQuestion calls. Then proceed to extraction.

#### Requirement Extraction + Checkpoint

Extract testable requirements **internally** (no table output to chat). Write each acceptance scenario as a separate `{ when, then }` object. Multiple conditions → multiple objects (do not combine in one sentence).

**Completeness self-check** (execute, do NOT show to user):

- Each `when` is a concrete trigger (action, input, state). Each `then` is an observable result (status code, UI element, return value, state change). Not vague: "works well", "good performance", "user-friendly".
- Data sources identified (where does input/output come from?)
- Error/edge cases named for requirements with user input or external data
- No overlap between requirements (two REQs describing the same thing)
- Scope fits 1 feature (if >10 REQs → flag for PHASE 1b)

Fix found gaps internally: add missing acceptance criteria, split overlapping REQs, add edge case REQs.

**Short chat checkpoint** — show only a concise numbered list (REQ-ID + 1-line description, without category and without acceptance) so user can confirm scope is correct before architecture work:

```
REQ-001 — {1-line description}
REQ-002 — {1-line description}
...
({N} requirements; full acceptance + overview follows in plan file)
```

Confirm with user via AskUserQuestion: "Is this scope correct?"

- "Yes, continue (Recommended)" — proceed to scope analysis + architecture
- "Adjust" — back to relevant question

The full requirements table with acceptance criteria and the feature overview table are only written in the plan file (in PHASE 2), not inline in chat.

#### Reuse-Discovery (optional — skip for COMPONENT features themselves)

**When to run:** only if the current feature type is NOT `COMPONENT`, and it is a frontend project (stack.framework present).

Follow [Discovery — Reuse-Discovery](../shared/SKILL-PATTERNS.md#reuse-discovery) for the canonical protocol.

**Trigger:** keyword scan on UI element names in requirements text — Modal, Dialog, Drawer, Tooltip, Dropdown, Select, DatePicker, TimePicker, RichTextEditor, FileUpload, Avatar, Badge, Toast, Alert, Banner, Stepper, Wizard, Table, DataGrid, Carousel, Accordion, Tab, Breadcrumb, FormField, InputGroup, ColorPicker, Rating, Slider, Progress, Skeleton. Also apply project-specific name prefixes. Add items in-memory (carried forward to PHASE 4 sync); also append kebab-name to current feature's `dependencies[]`.

**Source:** `"/dev-define"` · **Direction:** `"dev→frontend"` · **Type:** `COMPONENT`

---

### PHASE 1b: Scope Analysis & Feature Splitting

**≤6 requirements**: ALWAYS show one line inline to the user:

```
Scope: {N} requirements — SINGLE feature
```

No AskUserQuestion, no extra explanation. Then proceed directly to PHASE 2. Skip cluster analysis.

**7-10 requirements**: cluster on dependencies. ≥2 clusters with ≤2 cross-deps → RECOMMEND SPLIT.

**>10 requirements**: RECOMMEND SPLIT (unless linear chain, single concern).

**If SINGLE**: show briefly, continue.

**If SPLIT recommended**:

1. Show proposal with clusters, build order, cross-dependencies
2. AskUserQuestion: "Agree with split?" — Agree / Adjust / Keep as one feature
3. On split:
   - Write `.project/features/{feature-name}/00-split.md` with: split decision, sub-feature table (requirements + focus), build order
   - Create sub-feature folders: `mkdir -p .project/features/{feature-name}-{sub}`
   - Re-number requirements per sub-feature (REQ-001, REQ-002, etc.)
   - Run PHASE 2-4 per sub-feature in build order
   - In backlog: sync each sub-feature individually

### PHASE 2: Architecture

**Output rule for this entire phase**: write the full architecture design **directly to the plan file** (Write/Edit, use the path from the PHASE 0c system-reminder). **Do not show design tables, file structures, interfaces, build sequence or test strategy inline in chat** — only a short progress marker (e.g. `Architecture designed: N components, M files, K build steps. Plan file updated.`).

**Exception**: for visual features the ASCII wireframe may appear inline in an AskUserQuestion description — otherwise the user cannot review it before the final plan file write.

Design in three steps:

1. **Baseline check** (internally):
   - Search `stack-baseline.md` for patterns relevant to this feature
   - **Pattern found** → use as basis for design, skip research
   - **Pattern not found** → inline research:
     - Call `resolve-library-id` + `query-docs` via Context7 for library/framework patterns
     - Call WebSearch for external APIs and services
     - Focus: recommended patterns, state approach, file structure
       After research: update `stack-baseline.md` with new patterns (append, do not overwrite)
   - **No baseline file** → always execute research. Do NOT create baseline (that is /core-setup)

2. **Existing code** (internally): Glob + Read the most relevant files with similar patterns. This informs the design.

3. **Design** → write to plan file: feature flow, file structure, interfaces/types, design sketch (visual only), dependency analysis, build sequence, test strategy, AI-navigability decisions.
   - **Feature flow**: compact `→` chain from trigger to output (conditional paths in `[brackets]`, parallel paths with `+`). Example: `User click → validate input → [cache hit → return] / [cache miss → fetch API + update cache] → render response`.
   - **File structure**: create/modify table.
   - **Interfaces/Types**: if relevant.
   - **Design sketch**: only for visual features — ASCII wireframe (web/UI) or scene composition (3D/game). Consider: responsive breakpoints, loading state, empty state, error state. Confirm wireframe inline via AskUserQuestion (see exception above): "Is this visual design correct?" — "Yes (Recommended)" / "Adjust". For color references in wireframes/acceptance criteria: use token names (`bg-primary`, `text-foreground`) — no hex values. See `shared/TOKENS.md`.
   - **Dependency analysis**: REQ→REQ relations.
   - **Build sequence**: numbered implementation order. Combine REQs in the same step if they touch the same file and have no mutual dependencies.
   - **Test strategy**: REQ→testfile→description table.
   - **AI-navigability** (evaluate after design, adjust file structure/interfaces where needed — skip for ≤3 files without new pattern):
     - _Module exports_: Per new file: what is public, what is private? With >3 files in the same dir: consider barrel/index file.
     - _Registries_: Multiple instances of the same concept (endpoints, commands, entities)? → Centralize in one file. Record in `architecture.registries[]`.
     - _Structure_: Flat vs nested? Guideline: flat unless >10 files or clear subcategories. Follow existing project convention.
     - _Test location_: Colocated or separate? Document in `testStrategy.location`.
     - _Module boundaries_: Which modules import from which? Note forbidden imports at circular risk.

**End of thinking phase**: follow [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Exit protocol — write the full architecture design to the plan file, then `ExitPlanMode`. After approval the skill continues with PHASE 3 (writing feature.json).

### PHASE 3: Write feature.json

Write `.project/features/{feature-name}/feature.json` (see `shared/FEATURE.md` for full schema):

| Field                       | Condition                                                                                                                                                                                 |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`, `created`, `status` | always (status = `"DEFINED"`, no stage — wait for `/dev-build`)                                                                                                                           |
| `summary`                   | always                                                                                                                                                                                    |
| `depends`                   | always (empty array if none)                                                                                                                                                              |
| `choices`                   | always (user answers)                                                                                                                                                                     |
| `requirements`              | always (each REQ with `status: "pending"`, `acceptance: [{when, then}]`)                                                                                                                  |
| `files`                     | always (normalized: `path`, `type`, `action`, `purpose`, `requirements`)                                                                                                                  |
| `architecture`              | always (`componentTree`, `interfaces`, optional `registries[]`)                                                                                                                           |
| `design`                    | visual features only                                                                                                                                                                      |
| `apiContract`               | backend only                                                                                                                                                                              |
| `buildSequence`             | always                                                                                                                                                                                    |
| `testStrategy`              | always (optional `location` field)                                                                                                                                                        |
| `clarifications`            | only include if gray-area resolution produced at least 1 answer — otherwise OMIT field (no empty array)                                                                                   |
| `durableDecisions`          | with >3 requirements — decisions that apply across all REQs                                                                                                                               |
| `research`                  | only if research was performed                                                                                                                                                            |
| `externalRef`               | only if the backlog item had this field — copy 1:1 (`type`, `id`, `url`, `labels`, `split`). Traceability to external issue tracker for downstream skills (`/dev-build`, `/core-commit`). |

**`durableDecisions`** — decisions that do NOT change during the build:

- Persistence strategy (which storage API, which format)
- ID generation and idempotency contract
- Key data models and their relations
- External service boundaries
- Route structures / URL patterns (for routing features)
- Auth/authz approach (for auth features)

Only include if there are actually cross-requirement decisions. Skip for simple features (≤3 REQs).

**`buildSequence`** structure — dev-build iterates this directly:

```json
[
  {
    "step": 1,
    "requirements": ["REQ-001"],
    "description": "...",
    "dependsOn": []
  },
  {
    "step": 2,
    "requirements": ["REQ-002", "REQ-003"],
    "description": "...",
    "dependsOn": [1]
  }
]
```

### PHASE 4: Sync

Follow `shared/SYNC.md` 3-File Sync Pattern. Skill-specific mutations below.

Read in parallel **directly before editing** (skip if not exists) — do NOT rely on reads from earlier phases (Prettier/linters can modify files in between):

- `.project/backlog.html`
- `.project/project.json`
- `.project/project-context.json`

Mutate in memory:

**Backlog** (see `shared/BACKLOG.md`):

- Find feature → set `status: "DEFINED"`, remove `transition` (if present). Not found → add to `data.features` with `phase: "P4"`, `status: "DEFINED"`.
- **Dependencies**: If during PHASE 1 or PHASE 2 external feature dependencies were identified (other features that must be DONE first), merge those into `dependencies[]`. Never remove existing values — only add. If nothing new found: leave field unchanged.
- Set `data.updated` to today.

**Dashboard** (see `shared/DASHBOARD.md`):

- Update feature in `features` array: status → `"DEFINED"`, update summary
- Merge per entity type (always check for existing before push):
  - **Data entities** (optional — only if feature introduces domain entities): check on name → new: push with fields/relations → existing: merge new fields. If feature has no entities (UI-only, refactor, utility): skip this update, log `Skipped data.entities: no entities`.
  - **Endpoints**: check on method+path → new: push with `status: "planned"`, `auth: "public" | "user" | "admin"` (default `"public"`, use `"user"` if JWT/session required, `"admin"` if role-check required; omit `auth` field for projects without auth) → existing: skip
  - **Routes** in `.project/project-context.json` → `architecture.routes[]`: for each new page route in this feature → check on `path` → new: push `{ path, purpose, feature: "<feature-name>" }` + `auth` field only if project has auth → existing: update `purpose` if changed. Skip for non-frontend features (pure API/utility).
  - **Stack packages**: check on name → new: push `{ name, version, purpose }` → existing: skip
  - **Features**: check on name → new: push `{ name, status: "DEFINED", summary, created }` → existing: update status
  - **Architecture** in `.project/project-context.json`: generate/update `architecture` section if project has multiple components/modules. **Follow component-first model from `shared/DASHBOARD.md`**:
    - `layers`: optional — define layers with `{ name, order }` if project uses explicit layer naming (e.g. API Layer order 1, Data Layer order 3). Skip if project does not use this.
    - `dataFlow`: one-line summary of the request flow
    - `components`: per component `{ name, layer, description, status, connects_to }`. New feature components → `status: "planned"`. Existing built components → `status: "done"`. External services → `status: "external"`. `connects_to`: array of typed edges `{ to, type }` where `type` is one of `calls` | `reads` | `writes` | `depends_on` (see `shared/DASHBOARD.md` Edge fields for mapping)
    - Merge strategy: check if component `name` already exists → no: push → yes: merge (overwrite status, merge `connects_to[]` with dedup on `to+type` combination)
    - Optional: generate Mermaid diagram to `.project/architecture.mmd` for visual context
    - Skip for single-file feature without architectural impact
  - **Context** in `.project/project-context.json`: update `context.structure` and `context.routing` if the feature adds new files or routes. **Note**: structure/routing are JSON-escaped strings — for large changes use Write instead of Edit to avoid escaping issues.

**PAGE-seeding** (frontend projects only — skip for pure API/backend/game features):

Follow [Discovery — Page-Discovery](../shared/SKILL-PATTERNS.md#page-discovery) for the canonical protocol.

**Trigger:** scan `feature.json#architecture.routes[]` and `feature.json#files[]`. Resolution: batch AskUserQuestion "Yes, all" / "Selection" / "No".

**Source:** `"/dev-define"` · **Direction:** `"dev→frontend"` · **Type:** `PAGE`

Write back in parallel:

- Edit `backlog.html` (keep `<script>` tags intact)
- Edit `project.json` (features, endpoints, data, stack — use Edit for targeted changes, not Write)
- Edit/Write `project-context.json` (if architecture or context changed — Write for large diagram changes)

**Auto-build marking** (after sync):

Read backlog again, find feature, set `"auto": true`, write back via Edit. No user prompt — always mark auto so the card gets an AUTO badge and the clipboard has the correct `/dev-build` command.

Clean up: `rm -f .project/session/active-{feature-name}.json`

**Output:**

```
DEFINE COMPLETE: {feature-name}

Requirements: {N} (with acceptance criteria)
Architecture: {component count} components
Files: feature.json + backlog + dashboard

Next: /dev-build {feature-name}
     /team-outsource {feature-name}   ← if you want to delegate to a teammate
```

Omit the `Next` line if the feature was not a backlog item and no concept is present — briefly note the absence of a backlog instead.

## Restrictions

- Do NOT write implementation code (that is /dev-build)
- Do not skip requirements extraction
- Do not proceed without user confirmation at checkpoints
- Do not skip the `EnterPlanMode`/`ExitPlanMode` calls — these are needed for model routers (such as `opusplan`) to run thinking phases under a stronger model
