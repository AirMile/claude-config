---
name: dev-define
description: Define feature requirements, criteria, and architecture. Use with /dev-define.
writes:
  [feature.requirements, feature.architecture, feature.files, backlog.status]
metadata:
  author: claude-config
  version: 2.7.0
  category: dev
---

# Feature Definition

PHASE 1 of the dev workflow: define → build → test.

**Trigger**: `/dev-define` or `/dev-define [feature-name]`

## Constraints (apply to every phase)

- **No implementation code anywhere.** Plan file and feature.json contain only type signatures, structure, decisions. Function bodies, `(set, get) => ({...})` blocks, JSX, hook internals → `/dev-build`. Detail: see PHASE 2 "Strict boundary."
- **No requirements skipping** — every feature gets PHASE 1 extraction with acceptance criteria.
- **No phase-jump without checkpoint** — user confirms scope (PHASE 1) before architecture; user approves plan (PHASE 2) before feature.json write.
- **No skipping plan-mode calls** — `EnterPlanMode` at PHASE 0c, `ExitPlanMode` at end of PHASE 2 (PHASE 3+4 run after ExitPlanMode approval). Required for model routers (e.g. `opusplan`).

## Workflow

### PHASE 0: Feature Name & Context

1. **Determine feature name.**

   a) **Name provided** (`/dev-define auth`): use as feature name → go to step 2.

   b) **No name provided** (`/dev-define`): pick from backlog → concept → suggestions in this order:

      - Read `.project/backlog.html` → parse JSON from `<script id="backlog-data">` (see `shared/BACKLOG.md → Lifecycle Protocol → Read`).
        - First check: `data.features.find(f => f.type === "FEATURE" && f.transition === "defining")` → if found, auto-select, show: `Backlog: ✓ Task picked up — {name}`, go to step 2.
        - Fallback: `data.features.find(f => f.status === "TODO")` (first TODO).
      - **If backlog feature found (fallback path):**
        AskUserQuestion: "Next feature from backlog: **{name}**. Continue with this?" — "{name} (Recommended)" / "Different feature". Backlog chosen → step 2. "Different feature" → next bullet.
      - **No backlog but concept present:**
        Read `SEED_CONTEXT` per `shared/SEED.md`. If `SEED_CONTEXT.present`:
        ```yaml
        header: "Concept without backlog"
        question: "There is a concept but no backlog yet. Do you want to generate a backlog first?"
        options:
          - label: "Yes, first /project-backlog (Recommended)", description: "Generate backlog from concept, then define features"
          - label: "No, define directly", description: "Define a standalone feature without a backlog"
        multiSelect: false
        ```
        "Yes" → stop, show: `Run /project-backlog to convert your concept into a backlog.`
        "No" → continue to next bullet.
      - **No backlog, no concept (or direct-define chosen):**
        Generate 3 suggestions from available signal in this order: (1) `project.json#features[]` with `status: "TODO"` or `"PLANNED"` (use feature `name` + `summary`); (2) if <3 found, scan `project.json#concept.goals[]` or `concept.pitch` for noun-phrases that could be features (e.g. "user authentication", "report export"); (3) if still <3, fallback to 3 generic next-step suggestions based on `stack.framework` (e.g. Next.js → "auth-flow", "api-route", "form-validation"). Show via AskUserQuestion: "Which feature do you want to define?" — each option label = kebab-case name, description = 1-line purpose. Selected name → step 2.

2. **Feature existence check** (before context load):

   Check: `.project/features/{feature-name}/feature.json` exists?
   - **Not found** → continue to step 3 (normal flow).
   - **Found** → go to PHASE 0b (update-mode).

3. **Setup + context load** (parallelize):
   - `mkdir -p .project/features/{feature-name}`
   - `mkdir -p .project/sessions && echo '{"feature":"{feature-name}","skill":"define","startedAt":"<new Date().toISOString()>"}' > .project/sessions/active-{feature-name}.json`
   - Glob + Grep for existing code that imports the feature name. ≥1 match: briefly mention files.
   - Read `.project/project.json` — extract: `stack`, `concept.pitch` (or first 2 sentences of `concept.content`), `features[]`, `endpoints`, `data.entities`, `thinking[]` (filter by `newFeature` matching feature name), `design.components[]`, `design.pages[]`.
   - **Onboarding check** (after project.json read): not present → warn `⚠️ No project.json found. Consider /core-setup.`; present but empty (no `context`, `stack`, `features`) → warn `ℹ️ project.json lacks codebase context. /core-setup can fill this in.`; present with content → continue silently. Non-blocking.
   - Read `.project/project-context.json` (if exists) — extract `context.patterns`, `architecture.components[]`.
   - Read `.claude/research/stack-baseline.md` (if not available, use `project.json.stack` as basis).
   - **Backlog read-only** (required — feeds the PHASE 1 risk-check + PHASE 3 externalRef passthrough): Read `.project/backlog.html`, parse JSON from `<script id="backlog-data">`, find the feature by name. Keep `risk`, `dependencies`, `externalRef` in memory for PHASE 1 and PHASE 3. Mutations (status, date, `auto` flag) happen in PHASE 4 — keeps all writes after `ExitPlanMode` per the PHASE 0c plan-mode protocol. Feature not in backlog → log `Backlog: ⓘ not present — risk-check skipped` and continue.

4. **Optional context** (skip each item if results would be empty):
   - **Thinking files**: Grep `.project/thinking/*.md` for feature name. Read matches as PHASE 1 input.
   - **Past decisions**: only if `.project/features/` has any prior `feature.json`. Collect `durableDecisions[]` from all prior features (tag `[feature-X]`) + scan `.project/thinking/*-decision-*.md` (extract `THINK:`, `RECOMMENDATION:`, `CONSTRAINT` from first 30 lines, tag `[project]`). Filter ≥2 keyword overlap with current feature. Keep top 3.
   - **Learnings**: scan `project-context.json#learnings[]` (and optionally `project.json#learnings[]`). Match: relevant if (a) summary shares ≥2 keywords with the current feature name or concept, OR (b) `feature` name matches a **direct** dependency AND `type === "pitfall"`. Rationale: keyword-match catches topical relevance; dependency-pitfalls catch lessons that bit us last time in code we're about to touch. Show `RELEVANT LEARNINGS` block before the first AskUserQuestion of PHASE 1 (max 5 entries, pitfalls first, then patterns) — only on ≥1 match. No match → silent. Extended matching: [shared/LEARNINGS-LOAD.md](../shared/LEARNINGS-LOAD.md).

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

Follow [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Entry protocol before PHASE 1. PHASE 1 + 2 run in plan mode; all PHASE 2 design output is written to the plan file for review.

**Allowed writes before `EnterPlanMode`**: only `.project/sessions/active-{name}.json` and `mkdir` calls for the feature folder. All `.project/{backlog,project,project-context}.{html,json}` writes happen in PHASE 4, after `ExitPlanMode`.

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

**Questions 2-4 (adaptive)**: Cover the must-cover categories. Choose subcategories appropriate for the stack (patterns, visual/output, persistence, API design). Derive options from the baseline and existing code. Combine related questions in one AskUserQuestion call if they are logically connected (max 2 sub-questions per call — this is the number of questions within one call, not the total).

**Question 5 (optional)**: Only for complex configuration or multiple approaches.

#### Clarification Round

After the initial questions, identify open branches: unaddressed edge cases, implicit assumptions, conflicts between answers, or ambiguous choices needing a design decision.

**Skip** if the feature is simple (≤5 expected REQs) AND no open branches.

**Otherwise**: 1-2 AskUserQuestion calls covering up to 4 sub-questions total. Each sub-question is either:
- **Factual follow-up** — "What happens if {edge case}?" with 2-3 outcome options
- **Design choice** — concrete A vs B vs C, first option Recommended, include "Not relevant to scope" if applicable

Record each as `{ "question": "{branch}", "answer": "{chosen option}", "impact": "{which REQ area}" }` in the in-memory clarifications array (written to `feature.json#clarifications` if ≥1 entry).

**"Not relevant"** → scoped-out, not a requirement.
**>4 open branches** → handle the remainder inline during requirement extraction as edge cases.

#### Requirement Extraction + Checkpoint

Extract testable requirements **internally** (no table output to chat). Write each acceptance scenario as a separate `{ when, then }` object. Multiple conditions → multiple objects (do not combine in one sentence).

**Completeness self-check** (execute, do NOT show to user):

- Each `when` is a concrete trigger (action, input, state). Each `then` is an observable result (status code, UI element, return value, state change). Not vague: "works well", "good performance", "user-friendly".
- Data sources identified (where does input/output come from?)
- Error/edge cases named for requirements with user input or external data
- No overlap between requirements (two REQs describing the same thing)
- Scope fits 1 feature (if >10 REQs → flag for PHASE 1b)

Fill any gaps before proceeding: add missing acceptance criteria, split overlapping REQs, add edge-case REQs.

**Short chat checkpoint** — show only a concise numbered list (REQ-ID + 1-line description, without category and without acceptance) so user can confirm scope is correct before architecture work:

```
REQ-001 — {1-line description}
REQ-002 — {1-line description}
...
({N} requirements; full acceptance + overview follows in plan file)
```

Confirm with user via AskUserQuestion: "Is this scope correct?"

- "Yes, continue (Recommended)" — proceed to PHASE 1b (scope analysis)
- "Adjust" — back to relevant question

**Note:** do not show the scope line ("SINGLE feature" / "RECOMMEND SPLIT") at this checkpoint — that belongs in PHASE 1b and follows after scope confirmation. Show the checkpoint purely as a REQ list + confirmation question.

**Mid-flow scope expansion**: if the user introduces new scope after requirement extraction but before PHASE 2, treat it as an additional AskUserQuestion round and re-run the completeness self-check. New REQs are regular requirements (numbered sequentially), not clarifications.

The full requirements table with acceptance criteria and the feature overview table are only written in the plan file (in PHASE 2), not inline in chat.

#### Reuse-Discovery (skip if current feature `type` is `COMPONENT` or project is not frontend)

Scan the extracted requirements (description + acceptance) for UI-element keywords: Modal, Dialog, Drawer, Tooltip, Dropdown, Select, DatePicker, TimePicker, RichTextEditor, FileUpload, Avatar, Badge, Toast, Alert, Banner, Stepper, Wizard, Table, DataGrid, Carousel, Accordion, Tab, Breadcrumb, FormField, InputGroup, ColorPicker, Rating, Slider, Progress, Skeleton. Apply project-specific prefixes too.

**Self-reference filter (always apply):** skip a match if the kebab-cased keyword appears in the current feature name (e.g. feature `kelly-slider` → skip "Slider" match, feature `event-modal` → skip "Modal" match). Prevents self-dependencies.

**On 1+ remaining match:**
1. Per match: kebab-case the name (e.g. "Select" → `currency-select` with context prefix when available).
2. Append to the in-memory `discoveredComponents[]` (carried to PHASE 4 sync).
3. Append the kebab-name to the current feature's `dependencies[]`.

**Source:** `"/dev-define"` · **Direction:** `"dev→frontend"` · **Type:** `COMPONENT`

For the shared sync implementation of `discoveredComponents` in PHASE 4, see [shared/SKILL-PATTERNS.md#reuse-discovery](../shared/SKILL-PATTERNS.md#reuse-discovery).

---

### PHASE 1b: Scope Analysis & Feature Splitting

**Run immediately after the scope confirmation from PHASE 1.** Count `requirements.length`:

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

**Output rule for this entire phase**: write design **directly to the plan file** (Write/Edit, path from PHASE 0c system-reminder). **Do not show design output inline in chat** — only a short progress marker (e.g. `Architecture designed: N files, K build steps. Plan file updated.`). **Exception**: for visual features the ASCII wireframe may appear inline in an AskUserQuestion description (see "Design sketch" in step 3).

**Strict boundary — design vs implementation**:

- **Allowed in plan file**: type signatures (`interface X { ... }`, `type Y = ...`, function signatures `(input: X) => Y`), file/module structure, feature flow as `→` chain, dependency graph, build sequence, test strategy table, durable decisions.
- **Forbidden in plan file**: function bodies, `(set, get) => ({...})` blocks, `set({...})` calls, helper implementations, JSX, hook internals — even as "skeleton" or "pseudo-code." That work belongs to `/dev-build`. If a code fence contains anything beyond type declarations: stop and rewrite as an English description.

**Plan file vs feature.json — role split**:

| Content | Plan file | feature.json |
|---|---|---|
| Context / rationale / why | ✓ | — |
| REQ list (1-line descriptions) | ✓ | ✓ |
| Full acceptance criteria | — | ✓ (canonical) |
| File structure table | ✓ | ✓ |
| Type signatures (typescript fence) | ✓ | ✓ (`interfaces[].definition`) |
| Build sequence summary | ✓ | ✓ (canonical) |
| Test strategy table | — | ✓ (canonical) |
| Durable decisions with rationale | ✓ | ✓ (canonical) |
| Verification steps | ✓ | — |
| Out of scope | ✓ | — |

Design in three steps:

1. **Baseline check** (internally):
   - Search `stack-baseline.md` for patterns relevant to this feature.
   - **Pattern found** → use as basis, skip research. Show: `Baseline: ✓ pattern hit — {pattern-name}`. In PHASE 3: omit the `research` field in feature.json entirely (baseline hit is not research).
   - **Pattern not found** → inline research via Context7 (`resolve-library-id` + `query-docs`) + WebSearch for external APIs. Show: `Baseline: ⚙ research via Context7 — {topic}`. After research: append new patterns to `stack-baseline.md`. In PHASE 3: write `research: { sources[], findings[] }` to feature.json — only for actually executed lookups.
   - **No baseline file** → always execute research. Show: `Baseline: ⓘ missing — inline research`. Do NOT create baseline (that is /core-setup). PHASE 3 gets `research` as described above.

2. **Existing code** (internally): Glob + Read the most relevant files with similar patterns.

3. **Design** → write to plan file:
   - **Feature flow**: compact `→` chain. Conditional paths in `[brackets]`, parallel with `+`.
   - **File structure**: create/modify table (path, action, purpose, requirements).
   - **Routes registration** (frontend projects with `stack.framework` only): every `page`/`route` file from the file structure table — regardless of action (CREATE or MODIFY) — gets an entry in `feature.architecture.routes[]` with `{ path, file, action, requirements[] }`. **Skip entirely** if the file structure contains no page/route files (e.g. pure component or utility features) — omit the `routes[]` field from feature.json in that case. This is canonical; `project-context.json#context.routing` is derived from it in PHASE 4 (add for CREATE, leave unchanged for MODIFY).
   - **Type signatures only**: `interface`, `type`, function signatures. No bodies. Wrap in a single ` ```typescript ` fence per module.
   - **Design sketch**: visual features only — ASCII wireframe + states (loading/empty/error). Confirm inline via AskUserQuestion: "Is this visual design correct?" — "Yes (Recommended)" / "Adjust". **Wait for user confirmation before continuing; no implicit 'Yes'.** Use token names (`bg-primary`, `text-foreground`), no hex. See `shared/TOKENS.md`.
   - **Dependency analysis**: REQ→REQ relations (1 line each).
   - **Build sequence**: numbered REQ-clusters, `dependsOn` pointers. Combine REQs touching the same file with no mutual dependencies.
   - **Test strategy**: REQ→testfile→description table.
   - **AI-navigability** (skip for ≤3 files without new pattern): module exports (public/private), registries for repeated concepts (centralize in one file, record in `architecture.registries[]`), flat vs nested structure, test colocation, forbidden imports at circular risk.

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
| `clarifications`            | only include if the clarification round (PHASE 1 Clarification Round) produced at least 1 answer — otherwise OMIT the field. Contains **only** clarification-round entries (factual follow-ups + design choices), not the main questions from PHASE 1 steps 1-5; those belong in `choices[]`.                                    |
| `durableDecisions`          | with >3 requirements — decisions that apply across all REQs                                                                                                                               |
| `research`                  | only if research was performed                                                                                                                                                            |
| `externalRef`               | only if the backlog item had this field — copy 1:1 (`type`, `id`, `url`, `labels`, `split`). Traceability to external issue tracker for downstream skills (`/dev-build`, `/core-commit`). |

**`deltaOp` on requirements**: only write in update-mode (PHASE 0b). On a fresh definition: omit `deltaOp` and `previousDescription` entirely. PHASE 0b adds these when requirements are updated via add/modify/remove.

**`durableDecisions`** — decisions that do NOT change during the build:

- Persistence strategy (which storage API, which format)
- ID generation and idempotency contract
- Key data models and their relations
- External service boundaries
- Route structures / URL patterns (for routing features)
- Auth/authz approach (for auth features)

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

Read in parallel **directly before editing** (skip if not exists) — do NOT rely on reads from earlier phases:

- `.project/backlog.html`
- `.project/project.json`
- `.project/project-context.json`

Apply the following mutations in memory, then batch-write at the end of the phase.

#### Mutations on `backlog.html` (see `shared/BACKLOG.md`)

- Find feature → set `status: "DEFINED"`, `definedAt: <ISO>`, `auto: true`, remove `transition` (if present) — all three in one write. Not found → add to `data.features` with `phase: "P4"`, `status: "DEFINED"`, `auto: true`.
- **Dependencies**: If during PHASE 1 or PHASE 2 external feature dependencies were identified (other features that must be DONE first), merge those into `dependencies[]`. Never remove existing values — only add. If nothing new found: leave field unchanged.
- Set `data.updated` to today.

#### Mutations on `project.json` (see `shared/DASHBOARD.md`)

- Update feature in `features` array: status → `"DEFINED"`, update summary.
- Merge per entity type (always check for existing before push):
  - **Data entities** (optional — only if feature introduces domain entities): check on name → new: push with fields/relations → existing: merge new fields. If feature has no entities (UI-only, refactor, utility): skip this update, log `Skipped data.entities: no entities`.
  - **Endpoints**: check on method+path → new: push with `status: "planned"`, `auth: "public" | "user" | "admin"` (default `"public"`, use `"user"` if JWT/session required, `"admin"` if role-check required; omit `auth` field for projects without auth) → existing: skip
  - **Stack packages**: check on name → new: push `{ name, version, purpose }` → existing: skip
  - **Features**: check on name → new: push `{ name, status: "DEFINED", summary, created }` → existing: update status

#### Mutations on `project-context.json` (see `shared/DASHBOARD.md`)

- **Routes** in `architecture.routes[]`: for each new page route in this feature → check on `path` → new: push `{ path, purpose, feature: "<feature-name>" }` + `auth` field only if project has auth → existing: update `purpose` if changed. Skip for non-frontend features (pure API/utility).
- **Architecture**: generate/update `architecture` section if project has multiple components/modules. **Follow the component-first model from `shared/DASHBOARD.md`**:
  - `layers`: optional — define layers with `{ name, order }` if project uses explicit layer naming (e.g. API Layer order 1, Data Layer order 3). Skip if project does not use this.
  - `dataFlow`: one-line summary of the request flow
  - `components`: per component `{ name, layer, description, status, connects_to }`. New feature components → `status: "planned"`. Existing built components → `status: "done"`. External services → `status: "external"`. `connects_to`: array of typed edges `{ to, type }` where `type` is one of `calls` | `reads` | `writes` | `depends_on` (see `shared/DASHBOARD.md` Edge fields for mapping)
  - Merge strategy: check if component `name` already exists → no: push → yes: merge (overwrite status, merge `connects_to[]` with dedup on `to+type` combination)
  - Mermaid diagram: generate `.project/architecture.mmd` only when the feature adds ≥3 new components AND introduces ≥2 cross-component edges (`calls` / `reads` / `writes` / `depends_on`) that are not obvious from the textual `components[]` list. Otherwise skip — the JSON is the source of truth.
  - Skip the entire Architecture mutation for a single-file feature without architectural impact.
- **Context**:
  - `context.structure`: scan `feature.files[]` for new top-level directories under `src/` (e.g. `src/components/onboarding/`, `src/lib/payments/`). For each new directory not yet in `context.structure`: add a new line with path + 1-line description of the feature purpose.
  - `context.routing`: source is `feature.architecture.routes[]`. For each entry with `action: "CREATE"`: add `{path} → {file}` line. Entries with `action: "MODIFY"` leave `context.routing` unchanged (route already exists).
  - **Note**: structure/routing are JSON-escaped strings — for large changes use Write instead of Edit to avoid escaping issues.
  - **Edit strategy**: do one Read directly before the first Edit, then perform all `project-context.json` mutations back-to-back without an intermediate Read. With ≥3 independent Edits on the same file: build the full object in memory and use one Write instead of separate Edits — prevents "File has been modified since read" errors from tool-hash mismatches.

**PAGE-seeding** (frontend projects only — skip for pure API/backend/game features):

Follow [Discovery — Page-Discovery](../shared/SKILL-PATTERNS.md#page-discovery) for the canonical protocol.

**Trigger:** scan `feature.json#architecture.routes[]` and `feature.json#files[]`. Resolution: batch AskUserQuestion "Yes, all" / "Selection" / "No".

**Source:** `"/dev-define"` · **Direction:** `"dev→frontend"` · **Type:** `PAGE`

Write back in parallel:

- Edit `backlog.html` (keep `<script>` tags intact)
- Edit `project.json` (features, endpoints, data, stack — use Edit for targeted changes, not Write)
- Edit/Write `project-context.json` (if architecture or context changed — Write for large diagram changes)

**Auto-build marking** (after sync):

Combine the auto flag with the status write above — no separate second write. The backlog mutation in one script: `status: "DEFINED"`, `definedAt: <ISO>`, `auto: true` together. No user prompt — always mark auto so the card gets an AUTO badge and the clipboard has the correct `/dev-build` command.

Clean up: `rm -f .project/sessions/active-{feature-name}.json`

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
