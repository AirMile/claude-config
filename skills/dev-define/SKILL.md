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
    concept.seed,
  ]
metadata:
  author: claude-config
  version: 2.11.0
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

**Phase tracking** — first action of the skill: call `TaskCreate` with these 3 items
(status `pending`), then use `TaskUpdate` to set each phase to `in_progress` at the
start and `completed` at the end. During context compaction the task list remains
visible — no risk of forgetting phases.

1. PHASE 0+1: Setup, Context & Requirements
2. PHASE 2: Architecture
3. PHASE 3+4: feature.json + Sync

### PHASE 0: Feature Name & Context

> **Todo**: call `TaskCreate` with the 3 phase items (see above). Mark PHASE 0+1 → `in_progress` via `TaskUpdate`.

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
   - **Past decisions**: only if `.project/features/` has any prior `feature.json`. Sort prior feature.json files by `created`/`definedAt` desc — take the **5 most recent**. Collect `durableDecisions[]` from those (tag `[feature-X]`). Scan `.project/thinking/*-decision-*.md` sorted by mtime desc — take the **5 most recent** (extract `THINK:`, `RECOMMENDATION:`, `CONSTRAINT` from first 30 lines, tag `[project]`). Filter ≥2 keyword overlap with current feature. Keep top 3.
   - **Learnings**: scan `project-context.json#learnings[]` (and optionally `project.json#learnings[]`). Match: relevant if (a) summary shares ≥2 keywords with the current feature name or concept, OR (b) `feature` name matches a **direct** dependency AND `type === "pitfall"`. Rationale: keyword-match catches topical relevance; dependency-pitfalls catch lessons that bit us last time in code we're about to touch. Show `RELEVANT LEARNINGS` block before the first AskUserQuestion of PHASE 1 (max 5 entries, pitfalls first, then patterns) — only on ≥1 match. No match → silent. Extended matching: [shared/LEARNINGS-LOAD.md](../shared/LEARNINGS-LOAD.md).

### PHASE 0b: Update-mode (only if feature.json already exists)

> **Todo**: if feature.json exists → Read `.claude/skills/dev-define/references/update-mode.md` and follow that flow, then continue to PHASE 0c.

---

### PHASE 0c: Enter Plan Mode

> **Todo**: mark PHASE 0 → `completed`, PHASE 1 → `in_progress`.

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

**Skip** if ≤6 expected REQs.

**Otherwise** (>6 REQs OR an open architecture-changing choice — storage strategy, route shape, auth model, data model boundary, external service contract): 1 AskUserQuestion call covering up to 3 sub-questions. Each sub-question must be a **design choice** — concrete A vs B vs C that affects architecture. First option Recommended. Include "Not relevant to scope" if applicable.

Edge cases (validation rules, input notation, format defaults, error messages) → add inline as acceptance criterion or "Out of scope" entry. No AskUserQuestion.

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

**Error scenarios extraction** (internal, do NOT show to user): for each REQ with user input, external API call, or validation logic — extract `errorScenarios[]`:

- Each entry: `{ when: "{trigger condition}", then: "{observable error result}" }`
- Limit to plausible fail-paths already implied by the acceptance criteria (no invention)
- Skip entirely if REQ has no plausible error path (pure derivation, idempotent read, state display) — omit field from that REQ
- Written to `feature.json#requirements[].errorScenarios[]` in PHASE 3

**Short chat checkpoint** — show only a concise numbered list (REQ-ID + 1-line description, without category and without acceptance):

```
REQ-001 — {1-line description}
REQ-002 — {1-line description}
...
```

- **≤6 REQs**: append `Scope: {N} requirements — SINGLE feature, continuing.` and proceed directly to PHASE 2. No AskUserQuestion, skip PHASE 1b.
- **>6 REQs**: confirm via AskUserQuestion "Is this scope correct?" — "Yes, continue (Recommended)" / "Adjust → back to relevant question". Then proceed to PHASE 1b.

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

#### Page-placement sparring (frontend projects only — skip for pure API/backend/game features)

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

### PHASE 1b: Scope Analysis & Feature Splitting

**Run immediately after the scope confirmation from PHASE 1.** Count `requirements.length`:

**≤6 requirements**: scope-line already shown in PHASE 1 checkpoint. Proceed directly to PHASE 2. Skip cluster analysis.

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

> **Todo**: mark PHASE 1 → `completed`, PHASE 2 → `in_progress`.

**Output rule for this entire phase**: write design **directly to the plan file** (Write/Edit, path from PHASE 0c system-reminder). **Do not show design output inline in chat** — only a short progress marker (e.g. `Architecture designed: N files, K build steps. Plan file updated.`). **Exception**: for visual features the ASCII wireframe may appear inline in an AskUserQuestion description (see "Design sketch" in step 3).

**Strict boundary — design vs implementation**:

- **Allowed in plan file**: type signatures (`interface X { ... }`, `type Y = ...`, function signatures `(input: X) => Y`), file/module structure, feature flow as `→` chain, dependency graph, build sequence, test strategy table, durable decisions.
- **Forbidden in plan file**: function bodies, `(set, get) => ({...})` blocks, `set({...})` calls, helper implementations, JSX, hook internals — even as "skeleton" or "pseudo-code." That work belongs to `/dev-build`. If a code fence contains anything beyond type declarations: stop and rewrite as an English description.

**Plan file vs feature.json — role split**:

| Content                            | Plan file | feature.json                             |
| ---------------------------------- | --------- | ---------------------------------------- |
| Context / rationale / why          | ✓         | —                                        |
| REQ list (1-line descriptions)     | ✓         | —                                        |
| Full acceptance criteria           | —         | ✓ (canonical)                            |
| File structure table               | ✓         | ✓                                        |
| Type signatures (typescript fence) | —         | ✓ (`interfaces[].definition`)            |
| Build sequence                     | —         | ✓ (canonical)                            |
| Test strategy table                | —         | ✓ (canonical)                            |
| Dependency analysis                | —         | — (derived from buildSequence.dependsOn) |
| Durable decisions (1-line each)    | ✓         | ✓ (canonical with full rationale)        |
| AI-navigability                    | —         | ✓ (`architecture.registries[]`)          |
| Feature flow (→ chain)             | ✓         | —                                        |
| Verification steps                 | ✓         | —                                        |
| Out of scope                       | ✓         | —                                        |

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

**Seed Alignment Check** (last step in PHASE 2, before ExitPlanMode):

Follow [shared/SEED.md](../shared/SEED.md) § Alignment Check. Inputs: REQ
descriptions + `acceptance[].then` + `durableDecisions[]`. This skill is in plan
mode at this point — drift table and proposed rewrite go into the plan file. On
"Yes" → carry `seedUpdateApproved: true` to PHASE 4. On "Skip" → carry
`seedDrift[]` to PHASE 3 (written to `feature.json#seedDrift`).
`source: "/dev-define"`, `ref: "REQ-NNN"` where applicable.

**End of thinking phase**: follow [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Exit protocol — write the full architecture design to the plan file, then `ExitPlanMode`. After approval the skill continues with PHASE 3 (writing feature.json).

### PHASE 3: Write feature.json

> **Todo**: mark PHASE 2 → `completed`, PHASE 3 → `in_progress`. Read `.claude/skills/dev-define/references/feature-json-schema.md` for the full field table, deltaOp rules, durableDecisions categories, and buildSequence structure.

Write `.project/features/{feature-name}/feature.json` (see `shared/FEATURE.md` for full schema). Field conditions, deltaOp rules, durableDecisions categories, and buildSequence structure: see `references/feature-json-schema.md`.

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
- Write the rewritten content (from the plan file's `## Proposed seed update` section) to `.project/project-seed.md` — full file overwrite; content was reviewed and approved in plan mode.
- Update `project.json#concept.pitch` if the new pitch differs. Update `concept.name` only if the H1 title in the rewrite changed.
- Log: `Seed: ✓ updated — N section(s) rewritten`.

This write runs in parallel with the existing back-writes (`backlog.html`, `project.json`, `project-context.json`).

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
