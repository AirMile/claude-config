---
name: dev-define
description: Define feature requirements, criteria, and architecture. Use with /dev-define.
reads: [backlog.status, feature.requirements]
writes:
  [
    feature.requirements,
    feature.architecture,
    feature.files,
    backlog.status,
    backlog.overview,
    backlog.siblings,
    concept.seed,
  ]
metadata:
  author: claude-config
  version: 3.2.0
  category: dev
---

# Feature Definition

PHASE 1 of the dev workflow: define → build → test.

**Trigger**: `/dev-define` or `/dev-define [feature-name]`

## Constraints (apply to every phase)

- **No implementation code anywhere.** Plan file and feature.json contain only type signatures, structure, decisions. Function bodies, `(set, get) => ({...})` blocks, JSX, hook internals → `/dev-build`. Detail: see PHASE 2 "Strict boundary."
- **No requirements skipping** — every feature gets PHASE 1 extraction with acceptance criteria.
- **No phase-jump without checkpoint** — user confirms scope (PHASE 1) before architecture; user approves plan (PHASE 2) before feature.json write.
- **Plan mode active before any analytical step** — `EnterPlanMode` MUST be called immediately after TaskCreate + setup writes (mkdir, session file) and BEFORE the first `Read`, `Glob`, `Grep`, or `AskUserQuestion` in this skill. The interview (PHASE 1a) must run inside plan mode so model routers (e.g. `opusplan`) route it through the planning model. `ExitPlanMode` at end of PHASE 2; PHASE 3+4 run after approval.

## Workflow

**Phase tracking** — first action of the skill: call `TaskCreate` with these 3 items
(status `pending`), then use `TaskUpdate` to set each phase to `in_progress` at the
start and `completed` at the end. During context compaction the task list remains
visible — no risk of forgetting phases.

1. PHASE 0+1a+1b: Setup, Plan Mode, Context, Interview & Requirements
2. PHASE 2: Architecture
3. PHASE 3+4: feature.json + Sync

### PHASE 0: Setup, Feature Name & Plan Mode

> **Todo**: call `TaskCreate` with the 3 phase items (see above). Mark PHASE 0+1a+1b → `in_progress` via `TaskUpdate`.

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
     Generate 3 suggestions from available signal in this order: (1) `project.json#features[]` with `status: "TODO"` or `"PLANNED"` (use feature `name` + `summary`); (2) if <3 found, scan `project.json#seed.goals[]` or `seed.pitch` for noun-phrases that could be features (e.g. "user authentication", "report export"); (3) if still <3, fallback to 3 generic next-step suggestions based on `stack.framework` (e.g. Next.js → "auth-flow", "api-route", "form-validation"). Show via AskUserQuestion: "Which feature do you want to define?" — each option label = kebab-case name, description = 1-line purpose. Selected name → step 2.

2. **Feature existence check** (before context load):

   Check: `.project/features/{feature-name}/feature.json` exists?
   - **Not found** → continue to step 3 (normal flow).
   - **Found** → go to PHASE 0b (update-mode).

3. **Initial setup writes** (only writes allowed before plan mode):
   - `mkdir -p .project/features/{feature-name}`
   - `mkdir -p .project/sessions && echo '{"feature":"{feature-name}","skill":"define","startedAt":"<new Date().toISOString()>"}' > .project/sessions/active-{feature-name}.json`

4. **Enter Plan Mode** — call `EnterPlanMode` NOW, before any `Read`, `Glob`, `Grep`, or `AskUserQuestion`. Follow [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Entry protocol. PHASE 0 step 5 onwards + PHASE 1a + 1b + 2 all run in plan mode.
   - **Note on user consent**: `EnterPlanMode` may prompt the user for plan-mode confirmation in some Claude Code UIs. This is intentional — model routers (e.g. `opusplan`) use plan mode as the trigger for upgrading to Opus. Do not skip the call to avoid the prompt.
   - **Skip-check**: if plan mode is already active (existing system-reminder), skip the call and read the plan-file path from the active reminder.
   - **If `feature.json` already exists** (update-mode trigger from step 2): EnterPlanMode still fires here — update-mode body in PHASE 0b runs inside plan mode.
   - All `.project/{backlog,project,project-context}.{html,json}` writes wait until after `ExitPlanMode` in PHASE 4.

5. **Context load** (inside plan mode — reads only, parallelize):
   - Glob + Grep for existing code that imports the feature name. ≥1 match: briefly mention files.
   - Project context load (via [shared/PROJECT-CONTEXT-LOAD.md](../shared/PROJECT-CONTEXT-LOAD.md)):
     ```
     profile: define
     feature-name: {feature-name}
     ```
     Run the two `node -e` snippets for the `define` profile (set `FEAT="{feature-name}"` before running).
   - **Onboarding check** (after project.json extract): `PROJECT_JSON: not present` → warn `⚠️ No project.json found. Consider /core-setup.`; present but `stack === null && features.length === 0` → warn `ℹ️ project.json lacks codebase context. /core-setup can fill this in.`; present with content → continue silently. Non-blocking.
   - Read `.claude/research/stack-baseline.md` (if not available, use `project.json.stack` as basis).
   - **Backlog read-only** (required — feeds the PHASE 1 risk-check + PHASE 3 externalRef passthrough): Backlog load (via [shared/BACKLOG-LOAD.md](../shared/BACKLOG-LOAD.md)):
     ```
     profile: read-feature
     feature-name: {feature-name}
     ```
     Keep `risk`, `dependencies`, `externalRef` in memory for PHASE 1 and PHASE 3. Mutations (status, date, `auto` flag) happen in PHASE 4. `BACKLOG_FEATURE_NOT_FOUND` or `BACKLOG_HTML: not present` → log `Backlog: ⓘ not present — risk-check skipped` and continue.

6. **Optional context** (skip each item if results would be empty):
   - **Thinking files**: Grep `.project/thinking/*.md` for feature name. Read matches as PHASE 1 input.
   - **Past decisions** (only if `.project/features/` has any prior `feature.json`):

     > **Todo**: spawn `context-aggregator` agent via `Task` tool with:
     >
     > - `featureName` = current feature name
     > - `featureKeywords` = tokens from feature name (split kebab-case)
     > - `featuresDir` = `$REPO/.project/features`
     > - `thinkingDir` = `$REPO/.project/thinking`
     >
     > Parse `PRIOR_DECISIONS_START/END` block from response. Store for PHASE 1a "Surface relevant past decisions" render. Empty or missing block → silent skip (no output).

   - **Learnings**: scan `project-context.json#learnings[]` (and optionally `project.json#learnings[]`). Match: relevant if (a) summary shares ≥2 keywords with the current feature name or concept, OR (b) `feature` name matches a **direct** dependency AND `type === "pitfall"`. Rationale: keyword-match catches topical relevance; dependency-pitfalls catch lessons that bit us last time in code we're about to touch. Show `RELEVANT LEARNINGS` block before the first AskUserQuestion of PHASE 1 (max 5 entries, pitfalls first, then patterns) — only on ≥1 match. No match → silent. Extended matching: [shared/LEARNINGS-LOAD.md](../shared/LEARNINGS-LOAD.md).

### PHASE 0b: Update-mode (only if feature.json already exists)

> **Todo**: if feature.json exists → Read `.claude/skills/dev-define/references/update-mode.md` and follow that flow, then continue to PHASE 1a. (Plan mode is already active from PHASE 0 step 4.)

---

### PHASE 1a: Interview

> **Todo**: Read `.claude/skills/dev-define/references/phase1a-interview.md` for the full interview protocol — dimension checklist, tone rules, one-question-at-a-time flow, and adaptive stop condition.

> **Precondition check**: plan mode MUST be active before the first interview question (set in PHASE 0 step 4). If not active, call `EnterPlanMode` now and only then start the interview.

**Risk-check (only if `feature.risk >= 4`):**

If the loaded backlog feature has a `risk` score of 4 or 5, show this warning before opening the interview:

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

Show before the first interview question. No action required — context only, so interview answers don't conflict with previously decided directions.

**Interview opening**: "I see we're defining `{feature-name}`. Tell me first — what problem does this solve for you?"

Conduct an open interview — **no AskUserQuestion and no multiple-choice options in this phase**. Ask one open question at a time. Paraphrase substantive answers to check understanding. Probe and follow up. Follow the dimension checklist and tone rules in `references/phase1a-interview.md`.

**End of interview**: when all relevant dimensions are covered, close with an explicit summary + confirmation: "I understood that {brief summary of goal, success, scope, and key constraints} — is this correct, or am I missing something?" Proceed to PHASE 1b only after the user confirms.

**If the user cannot answer a dimension**: follow the escape-hatch protocol in `references/phase1a-interview.md § Handling "I Don't Know" Responses` — probe first, offer options second, mark as `unresolved` on third failure and move on.

---

### PHASE 1b: Requirements Synthesis

**Design choices** (only for architecture-changing branches — storage strategy, route shape, auth model, data model boundary, external service contract): if the interview revealed a fork with concrete A vs B vs C options, resolve these now via AskUserQuestion before extracting requirements. Each sub-question must be a **design choice**. Include "Not relevant to scope" if applicable. Record each as `{ "question": "{branch}", "answer": "{chosen option}", "impact": "{which REQ area}" }` (written to `feature.json#clarifications` if ≥1 entry). Edge cases (validation rules, input notation, format defaults) → add directly as acceptance criteria, no AskUserQuestion.

**>4 open forks** → handle the remainder inline during requirement extraction as edge cases.

#### Requirement Extraction + Checkpoint

Extract testable requirements **internally** (no table output to chat). Write each acceptance scenario as a separate `{ when, then, category }` object (`category` ∈ `"happy" | "edge" | "boundary"`). Multiple conditions → multiple objects (do not combine in one sentence).

**Completeness self-check** (execute, do NOT show to user):

- Each `when` is a concrete trigger (action, input, state). Each `then` is an observable result (status code, UI element, return value, state change). Not vague: "works well", "good performance", "user-friendly".
- Data sources identified (where does input/output come from?)
- **Scenario categories per REQ** — assign `category` to each `acceptance[]` entry:
  - Every REQ: ≥1 `happy` scenario (primary flow, REQ as intended).
  - REQ with user input, conditional logic, or external call: ≥1 `edge` scenario (unusual-but-valid input: empty string/array, unicode, null-equivalent, duplicate submit, race condition, concurrent state change).
  - REQ with numeric input, list-iteration, or pagination: ≥1 `boundary` scenario (min/max value, off-by-one, empty list, single item, first/last element).
  - REQ with user input, validation, or external call: `errorScenarios[]` (plausible fail-paths only — already required).
- No overlap between requirements (two REQs describing the same thing)
- Scope fits 1 feature (if >10 REQs → flag for PHASE 1c)

Fill any gaps before proceeding: add missing acceptance criteria, split overlapping REQs, add edge-case REQs.

**Error scenarios extraction** (internal, do NOT show to user): for each REQ with user input, external API call, or validation logic — extract `errorScenarios[]`:

- Each entry: `{ when: "{trigger condition}", then: "{observable error result}" }`
- Limit to plausible fail-paths already implied by the acceptance criteria (no invention)
- Skip entirely if REQ has no plausible error path (pure derivation, idempotent read, state display) — omit field from that REQ
- Written to `feature.json#requirements[].errorScenarios[]` in PHASE 3

**Short chat checkpoint** — show a numbered list with REQ-ID, 1-line description, and up to 2 key `when → then` acceptance scenarios per REQ (enough to catch misinterpretations before PHASE 2):

```
REQ-001 — {1-line description}
  when {trigger} → {observable result}

REQ-002 — {1-line description}
  when {trigger} → {observable result}
  when {error trigger} → {error result}
...
```

- **≤6 REQs**: append `Scope: {N} requirements — SINGLE feature, continuing.` and proceed directly to PHASE 2. No AskUserQuestion, skip PHASE 1c.
- **>6 REQs**: confirm via AskUserQuestion "Is this scope correct?" — "Yes, continue (Recommended)" / "Adjust". Then proceed to PHASE 1c.

**Mid-flow scope expansion**: if the user introduces new scope after requirement extraction but before PHASE 2, treat it as an additional AskUserQuestion round and re-run the completeness self-check. New REQs are regular requirements (numbered sequentially), not clarifications.

The full requirements table with acceptance criteria and the feature overview table are only written in the plan file (in PHASE 2), not inline in chat.

#### Reuse-Discovery (skip if current feature `type` is `COMPONENT`, `INTEGRATION`, `THEME`, `A11Y`, `PERF`, `INFRA`, `DOCS`, or project is not frontend)

Scan the extracted requirements (description + acceptance) for UI-element keywords: Modal, Dialog, Drawer, Tooltip, Dropdown, Select, DatePicker, TimePicker, RichTextEditor, FileUpload, Avatar, Badge, Toast, Alert, Banner, Stepper, Wizard, Table, DataGrid, Carousel, Accordion, Tab, Breadcrumb, FormField, InputGroup, ColorPicker, Rating, Slider, Progress, Skeleton. Apply project-specific prefixes too.

**Self-reference filter (always apply):** skip a match if the kebab-cased keyword appears in the current feature name (e.g. feature `kelly-slider` → skip "Slider" match, feature `event-modal` → skip "Modal" match). Prevents self-dependencies.

**On 1+ remaining match:**

1. Per match: kebab-case the name (e.g. "Select" → `currency-select` with context prefix when available).
2. Show inline: `Reuse detected: {kebab-name}` — one line per match, before adding to dependencies.
3. Append to the in-memory `discoveredComponents[]` (carried to PHASE 4 sync).
4. Append the kebab-name to the current feature's `dependencies[]`.

**Source:** `"/dev-define"` · **Direction:** `"dev→frontend"` · **Type:** `COMPONENT`

For the shared sync implementation of `discoveredComponents` in PHASE 4, see [shared/SKILL-PATTERNS.md#reuse-discovery](../shared/SKILL-PATTERNS.md#reuse-discovery).

#### Page-placement sparring (frontend projects only — skip if `type` is `COMPONENT`, `INTEGRATION`, `THEME`, `A11Y`, `PERF`, `INFRA`, `DOCS`, or for pure API/backend/game features)

After Reuse-Discovery, ask which PAGE(s) this feature surfaces on. This writes `pageHint[]` to `feature.json` (PHASE 3) and enables `/frontend-design` Build to pre-populate its composition menu.

1. Read `.project/backlog.html` → collect all PAGE-type features (any status). Read `project.json#design.pages[]` — collect page names. Merge both lists (dedupe by name) as `$KNOWN_PAGES`.

2. ```yaml
   header: "Page placement"
   question: "On which page(s) does '{feature-name}' appear? (select all that apply)"
   options:
     - label: "{page-name-1}", description: "Existing PAGE in backlog/design"
     - label: "{page-name-2}", description: "..."
     - label: "+ New page", description: "This feature introduces a new screen"
     - label: "Not on a page (API/service only)", description: "Skip — no UI placement"
   multiSelect: true
   ```

   Show max 3 known pages as options; use "Other" for the rest. Always include "+ New page" and "Not on a page" as last two options.

3. **If "+ New page" selected:** follow [Smart-Todo Creation — "new PAGE"](../shared/SKILL-PATTERNS.md#smart-todo-creation). Add the created PAGE name to `$PAGE_HINTS`.

4. **If "Not on a page" selected:** set `$PAGE_HINTS = []`, skip write.

5. Write result as `pageHint: $PAGE_HINTS` into the in-memory feature.json object (written to disk in PHASE 3).

6. **Backlog back-write** (PAGE → feature backref): for each `pageName` in `$PAGE_HINTS` where `pageName` already exists in `backlog.html` as `type === "PAGE"` (idempotent — re-runs and later Page-Discovery seeding in PHASE 4 dedupe on the same array; Smart-Todo "+ new PAGE" earlier already wrote the parent feature into dependencies[]):
   - Add `{feature-name}` to `page.dependencies[]` (dedupe). Write back to `backlog.html`.
   - Add to completion report when ≥1 update: `Page deps: {N} PAGEs updated ({comma-separated names})`
   - Applies to both FEATURE and COMPONENT types — no type filter.

---

### PHASE 1c: Scope Analysis & Feature Splitting

**Run immediately after the scope confirmation from PHASE 1b.** Count `requirements.length`:

**≤6 requirements**: scope-line already shown in PHASE 1b checkpoint. Proceed directly to PHASE 2. Skip cluster analysis.

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

> **Todo**: mark PHASE 0+1a+1b → `completed`, PHASE 2 → `in_progress`.

**Output rule for this entire phase**: write design **directly to the plan file** (Write/Edit, path from the plan-mode system-reminder received at PHASE 0 step 4). **Do not show design output inline in chat** — only a short progress marker (e.g. `Architecture designed: N files, K build steps. Plan file updated.`). **Exception**: for visual features the ASCII wireframe may appear inline in an AskUserQuestion description (see "Design sketch" in step 3).

**Strict boundary — design vs implementation**:

- **Allowed in plan file**: type signatures (`interface X { ... }`, `type Y = ...`, function signatures `(input: X) => Y`), file/module structure, feature flow as `→` chain, dependency graph, build sequence, test strategy table, durable decisions.
- **Forbidden in plan file**: function bodies, `(set, get) => ({...})` blocks, `set({...})` calls, helper implementations, JSX, hook internals — even as "skeleton" or "pseudo-code." That work belongs to `/dev-build`. If a code fence contains anything beyond type declarations: stop and rewrite as an English description.

**Plan file vs feature.json — role split**: full table in [references/feature-json-schema.md § Role split](references/feature-json-schema.md#role-split). Short rule: plan file = review-artefact (context, REQ-list, durable decisions 1-liners, flow, verification). feature.json = canonical contract (acceptance criteria, build sequence, test strategy, type signatures, AI-navigability).

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
   - **Routes registration** (frontend projects with `stack.framework` only): only `page`/`route` files with `action: CREATE` get an entry in `feature.architecture.routes[]` with `{ path, file, action, requirements[] }`. MODIFY-only route files: skip — `project-context.json#context.routing` leaves existing routes unchanged in PHASE 4. **Skip entirely** if no CREATE route/page files — omit the `routes[]` field from feature.json.
   - **Design sketch**: visual features only — ASCII wireframe + states (loading/empty/error). Confirm inline via AskUserQuestion: "Is this visual design correct?" — "Yes (Recommended)" / "Adjust". **Wait for user confirmation before continuing; no implicit 'Yes'.** Use token names (`bg-primary`, `text-foreground`), no hex. See `shared/TOKENS.md`.
   - **Durable decisions** (1-line each for plan-file review): full rationale and canonical form go to feature.json in PHASE 3.
   - **feature.json-only** — do NOT write to plan file: type signatures, dependency analysis, build sequence, test strategy. These are canonical in feature.json (PHASE 3) and not needed for plan-mode review.
   - **AI-navigability** (skip if ≤6 files AND no new registry): when applicable, identify new registries and record them in `architecture.registries[]` (written to feature.json in PHASE 3). Omit module-export lists, colocation notes, and import constraints — covered by project conventions.

**Seed Alignment Check** (penultimate step in PHASE 2):

**Trigger condition** — only run when **either** holds:

- `requirements.length ≥ 4`, OR
- `≥1 durableDecision` was recorded in this PHASE 2.

Below the threshold → skip silently (no plan-file section, no `seedDrift` carry, no sibling-cascade either — same threshold). Rationale: triviale features (config-tweaks, single-REQ bug-fixes) leveren geen meaningful drift-signaal en zouden de check tot ruis maken.

When triggered: follow [shared/SEED.md](../shared/SEED.md) § Alignment Check. Inputs: REQ
descriptions + `acceptance[].then` + `durableDecisions[]`. This skill is in plan
mode at this point — drift table and proposed rewrite go into the plan file. On
"Yes" → carry `seedUpdateApproved: true` AND `overviewUpdateApproved: true` to PHASE 4
(seed and backlog-overview always co-update — they hold the same project description in two
places). On "Skip" → carry `seedDrift[]` to PHASE 3 (written to `feature.json#seedDrift`).
`source: "/dev-define"`, `ref: "REQ-NNN"` where applicable.

**Sibling Cascade Check** (last step in PHASE 2, before ExitPlanMode):

**Same trigger condition as Seed Alignment Check** (`requirements.length ≥ 4` OR `≥1 durableDecision`). Below threshold → skip silently.

**Goal**: detect other backlog features whose `dependencies[]` or `description` are made stale by the scope decisions of this feature, so the user reviews and approves the updates in plan mode rather than discovering drift weeks later.

**Inputs** (already in memory from earlier phases):

- Current feature: `name`, `requirements[]`, `architecture` (exports/produced artifacts), `durableDecisions[]`, in-memory `discoveredComponents[]` and `pageHint[]`.
- Backlog: `data.features[]` from the PHASE 0 read (no re-read needed — the file isn't mutated between PHASE 0 and PHASE 2).

**Scan procedure** (internal, no chat output during scan):

1. Filter siblings: `data.features.filter(f => f.name !== current && !["DONE","CANCELLED"].includes(f.status))`.
2. For each sibling, evaluate two impact-types:
   - **Dep-add**: does the sibling's `description` or `name` reference an artifact this feature produces (shared object-types, schemas, utilities, routes, components named in `architecture.components[]`/`files[]`)? If yes AND `current-name ∉ sibling.dependencies[]` → candidate dep-add.
   - **Description-stale**: does the sibling's `description` describe scope that this feature now owns (e.g. sibling says "with X singleton schema" and this feature defers/owns that schema)? If yes → candidate description-update with concrete suggested append/replace.
3. Collect candidates into `siblingUpdates[]`:
   ```json
   {
     "name": "page-contact",
     "field": "dependencies | description",
     "currentValue": "...",
     "proposedValue": "...",
     "reason": "Current feature defines siteSettings singleton + shared contactMethod object-type used by this page."
   }
   ```

**Output to plan file** — append a `## Sibling backlog updates` section ONLY when `siblingUpdates.length ≥ 1`:

```md
## Sibling backlog updates

Detected {N} backlog feature(s) impacted by this feature's scope:

| Feature      | Field        | Current → Proposed                            | Reason                                            |
| ------------ | ------------ | --------------------------------------------- | ------------------------------------------------- |
| page-contact | dependencies | + sanity-schemas-foundation                   | Uses siteSettings singleton + shared object-types |
| page-contact | description  | append "(incl. contactPage singleton schema)" | Page owns its own singleton per scope decision    |
```

**No drift detected** → skip the section entirely, log `Siblings: ✓ no cascade` inline.

**Resolution**: implicit via plan-mode approval. ExitPlanMode → plan approved → all `siblingUpdates[]` are applied in PHASE 4. The user can reject individual rows by editing the plan file before approval; the PHASE 4 applier reads from the (possibly edited) plan-file table, not from in-memory state.

**Never**:

- Remove existing entries from a sibling's `dependencies[]` (additive only — removals are out-of-scope for this check).
- Change a sibling's `status`, `phase`, `risk`, or `transition` (lifecycle is owned elsewhere).
- Create new sibling features (that's Reuse-Discovery / Page-Discovery / Smart-Todo).

`source: "/dev-define"` on every applied mutation.

**End of thinking phase**: follow [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Exit protocol — write the full architecture design to the plan file, then `ExitPlanMode`. After approval the skill continues with PHASE 3 (writing feature.json).

### PHASE 3: Write feature.json

> **Todo**: mark PHASE 2 → `completed`, PHASE 3 → `in_progress`. Read `.claude/skills/dev-define/references/feature-json-schema.md` for the full field table, deltaOp rules, durableDecisions categories, and buildSequence structure.

Write `.project/features/{feature-name}/feature.json` (see `shared/FEATURE.md` for full schema). Field conditions, deltaOp rules, durableDecisions categories, and buildSequence structure: see `references/feature-json-schema.md`.

Include `interviewSummary` from the PHASE 1a closing summary — fields: `goal`, `successCriteria`, `edgeCases`, optional `userContext` (only if that dimension was covered), optional `unresolvedDimensions[]` (only if ≥1 dimension stayed unresolved). Schema: `references/feature-json-schema.md`.

### PHASE 4: Sync

> **Todo**: mark PHASE 3 → `completed`, PHASE 4 → `in_progress`. Read `.claude/skills/dev-define/references/phase4-sync.md` for mutation details per file.

Follow `shared/SYNC.md` 3-File Sync Pattern. Mutation details for backlog.html, project.json, and project-context.json: see `references/phase4-sync.md`.

Read in parallel **directly before editing** (skip if not exists) — do NOT rely on reads from earlier phases:

- `.project/backlog.html`
- `.project/project.json`
- `.project/project-context.json`

Apply the mutations from `references/phase4-sync.md` in memory, then batch-write at the end of the phase.

**PAGE-seeding** (frontend projects only — skip for pure API/backend/game features):

Follow [Discovery — Page-Discovery](../shared/SKILL-PATTERNS.md#page-discovery) for the canonical protocol.

**Trigger:** scan `feature.json#architecture.routes[]` and `feature.json#files[]`. Resolution: batch AskUserQuestion "Yes, all" / "Selection" / "No".

**Source:** `"/dev-define"` · **Direction:** `"dev→frontend"` · **Type:** `PAGE`

Write back in parallel:

- Edit `backlog.html` (keep `<script>` tags intact)
- Edit `project.json` (features, endpoints, data, stack — use Edit for targeted changes, not Write)
- Edit/Write `project-context.json` (if architecture or context changed — Write for large diagram changes)

#### Mutations on `project-seed.md` (only if `seedUpdateApproved: true`)

- Skip if PHASE 2 ended with "Skip" or no drift was detected.
- Source content: the plan file's `## Proposed seed update` section.
- Apply all writes per [shared/SEED.md § Write targets](../shared/SEED.md#write-targets-sync-phase) — that table is canonical for seed-mutation file set and log line.

All writes in this block run in parallel with the existing back-writes (`backlog.html`, `project.json`, `project-context.json`).

#### Apply `siblingUpdates[]` (only if plan file has a `## Sibling backlog updates` section)

- Skip if the section is absent (sub-threshold feature OR no cascade detected).
- Parse the table from the plan file (`name | field | proposed | reason`). Trust the post-approval content — the user may have removed rows before approving.
- For each row, mutate the in-memory `backlog.html` representation already loaded for PHASE 4:
  - `field: "dependencies"` → `feature.dependencies = unique([...feature.dependencies, current-feature-name])`. Never replace; never remove.
  - `field: "description"` → replace `feature.description` with the proposed value verbatim. (The proposal in the table is the final string, not a diff.)
- Sibling not found in backlog (e.g. deleted between PHASE 2 and PHASE 4) → log `Siblings: ⚠ {name} not found — skipped` and continue.
- Log: `Siblings: ✓ {N} update(s) applied ({comma-separated names})`.

This applier writes to the same in-memory backlog object as the existing PHASE 4 mutations and Page-seeding, so all changes land in the single `backlog.html` write at the end of PHASE 4 — no extra I/O.

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

> **Todo**: mark PHASE 4 → `completed`.
