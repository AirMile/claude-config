# Feature Definition

PHASE 1 of the dev workflow: define → build → test.

> **Vendored & pre-adapted for dev-ship** — run **inline in the main chat** by dev-ship PHASE 0
> (Step 2c of `phase-0-define-classify.md`), not as a standalone skill. This copy is already adapted:
> there is **no plan-mode machinery** and **no own phase tracking** (dev-ship's task list drives).
> **dev-ship runs PHASE 0→2 of this file entirely inside plan mode** (it calls `EnterPlanMode` before
> reading this file), so under an `opusplan`-style router the interview + architecture reason on the
> planning model. Practically that means: reads, read-only Bash, `WebSearch`/Context7, `AskUserQuestion`,
> and the read-only `context-aggregator`/`define-scout` subagents all work here; only `.project/`/source
> writes are blocked — and every write below is already deferred to accept. Run **PHASE 0→2** (interview
>
> - architecture + the complete feature.json draft) and **hold the draft in memory** — no `feature.json`
>   and no plan file is written here. **PHASE 3+4 run at dev-ship's gate-accept** (Step 4b): the draft
>   becomes the plan-file appendix and `feature-from-plan.js` writes `feature.json` on accept. Do not
>   blind-sync this file from the standalone define skill — the adaptations are load-bearing.
>
> **Confirmations are hoisted to the gate.** dev-ship presents the whole plan for review at its Step 4b
> gate (an `ExitPlanMode` approval), and reject loops back here to revise. So the pure-confirmation
> `AskUserQuestion`s below are **removed** — the interview summary-confirm (PHASE 1a), the ">6 REQs
> scope confirm" (PHASE 1b), the design-sketch confirm (PHASE 2), and the Seed/Backlog-Impact prompts
> (PHASE 2) — their content becomes review sections of the gate plan file. Only genuine **decision**
> `AskUserQuestion`s stay: feature resolution (PHASE 0), design-choice forks (PHASE 1b), and the split
> proposal (PHASE 1c).

## Constraints (apply to every phase)

- **No implementation code anywhere.** Plan file and feature.json contain only type signatures, structure, decisions. Function bodies, `(set, get) => ({...})` blocks, JSX, hook internals → the build phase. Detail: see PHASE 2 "Strict boundary."
- **No requirements skipping** — every feature gets PHASE 1 extraction with acceptance criteria.
- **No phase-jump without checkpoint** — the PHASE 1b REQ-checkpoint (numbered REQ list, shown before PHASE 2) precedes architecture; the plan-approval gate (dev-ship Step 4b) is the review surface before feature.json is written.
- **Standing park escape (PHASE 0→2, up to the gate).** At any point — an open interview
  question, any `AskUserQuestion` (including a free-text "Other" answer), or plain chat — the
  user may signal this feature should not be built now: "park", "park this", "not now", "wrong
  order", "another feature first", or equivalent. Treat it as **PARK-ESCAPE**: stop the current
  phase immediately and Read `.claude/skills/dev-ship/references/define-park.md`. A feature does
  not have to be built just because define started — a different build order is a legitimate
  outcome.

## Workflow

**Phase tracking** — **none of its own.** dev-ship's 6-phase task list is already active; track
define's phases in prose. Do **not** call `TaskCreate`/`TaskUpdate` here (it would clobber dev-ship's list).

1. PHASE 0+1a+1b: Setup, Context, Interview & Requirements
2. PHASE 2: Architecture
3. PHASE 3+4: feature.json + Sync (run at dev-ship gate-accept)

### PHASE 0: Setup & Feature Name

1. **Determine feature name.**

   a) **Name provided** (`/dev-define auth`): use as feature name → go to step 2.

   b) **No name provided** (`/dev-define`): resolve in this priority order:
   1. Backlog transition match — `data.features.find(f => f.type === "FEATURE" && f.transition === "defining")` (parse per `shared/BACKLOG.md → Lifecycle Protocol → Read`) → auto-select, show `Backlog: ✓ Task picked up — {name}`, go to step 2.
   2. First TODO in backlog → confirm via AskUserQuestion ("{name} (Recommended)" / "Different feature").
   3. No backlog but concept present (`SEED_CONTEXT.present` per `shared/SEED.md`) → AskUserQuestion: generate backlog first via `/project-plan` (Recommended, then stop) or define a standalone feature directly.
   4. No backlog, no concept (or direct-define chosen) → offer 3 kebab-case suggestions via AskUserQuestion, derived from `seed.goals[]`/`seed.pitch` noun-phrases, falling back to `stack.framework` generics.

2. **Feature existence check** (before context load):

   Check: `.project/features/{feature-name}/feature.json` exists?
   - **Not found** → continue to step 3 (normal flow).
   - **Found** → go to PHASE 0b (update-mode).

3. **Initial setup writes** — **skip in the dev-ship context**: dev-ship's Step 2a already did the
   `mkdir -p .project/features/{feature-name}` + the `active-{feature-name}.json` live-signal write
   **before** entering plan mode (writes are blocked once inside). Do not repeat them here. (The
   standalone form would run `mkdir` + `node ~/.claude/scripts/ship-checkpoint.js signal {feature-name}` itself.)

   All `.project/{backlog,project,project-context}.json` writes are **deferred to dev-ship's
   gate-accept** (Step 4b) — PHASE 0→2 only read and author the in-memory draft, and plan mode blocks
   them anyway.

4. **Context load** (reads only, parallelize):
   - Glob + Grep for existing code that imports the feature name. ≥1 match: briefly mention files.
   - Project context load: `node ~/.claude/scripts/context-load.js "$REPO" define "{feature-name}"` → `{ project, projectContext }` (see [shared/PROJECT-CONTEXT-LOAD.md](.claude/skills/shared/PROJECT-CONTEXT-LOAD.md) for field rationale).
   - **Onboarding check** (after the extract): `project === null` → warn `⚠️ No project.json found. Consider /core-setup.`; present but `stack === null && features.length === 0` → warn `ℹ️ project.json lacks codebase context. /core-setup can fill this in.`; present with content → continue silently. Non-blocking.
   - Read `.claude/research/stack-baseline.md` — **decision input, not just fallback**: extract the section(s) matching this feature's stack area (e.g. navigation, storage, maps) into memory so PHASE 1b's baseline gate and PHASE 2's baseline check can reuse them without re-reading. If absent, use `project.json.stack` as basis.
   - **Backlog read-only** (required — feeds the PHASE 1 risk-check + PHASE 3 externalRef passthrough): `node ~/.claude/scripts/backlog-load.js "$REPO" read-feature "{feature-name}"` → `{ present, risk, dependencies, externalRef, description, note, ... }` (see [shared/BACKLOG-LOAD.md](.claude/skills/shared/BACKLOG-LOAD.md)). Keep `risk`, `dependencies`, `externalRef`, `description`, and `note` in memory for PHASE 1 and PHASE 3 — `description` feeds the PHASE 1a context echo and coverage check; a non-null `note` is a prior park — surface it verbatim as a `PARKED PREVIOUSLY: {note}` line before the first interview question (PHASE 1a). Mutations (status, date, `auto` flag) happen in PHASE 4. `present: false` → log `Backlog: ⓘ not present — risk-check skipped` and continue.
   - **Open-items load** (same batch — feeds the PHASE 2 Backlog Impact Check **and PHASE 1a's Assumption Block non-goal bullets**): `node ~/.claude/scripts/backlog-load.js "$REPO" open-items "{feature-name}"` → `{ backlogPresent, items }` and keep the compact list in memory. `backlogPresent: false` or empty `items` → the Impact Check will skip silently.
   - **Seed load** (required — feeds PHASE 1a's Assumption Block; PHASE 2's Seed Alignment Check reuses this same read, no re-read): follow [shared/SEED.md](.claude/skills/shared/SEED.md) § Reader → `SEED_CONTEXT`. Keep `markdown` in memory; pull out the sections relevant to the interview dimensions if present — Out of Scope, Open Decisions, Key Features/Goal, Constraints. `SEED_CONTEXT.present: false` → no seed-sourced bullets, continue (backlog/learnings sources still apply).

5. **Optional context** (skip each item if results would be empty):
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

   - **Learnings load** (via [shared/LEARNINGS-LOAD.md](.claude/skills/shared/LEARNINGS-LOAD.md)) —
     **run this unconditionally, before PHASE 1a's opening question; this is the only load point**
     (Step 3 of `phase-0-define-classify.md` reuses this result — it does not re-run the load):

     ```
     scopes: [component]
     pitfall-prefix: true
     current-feature: {feature-name}
     ```

     **Dev-define-specific extra filter**: also include learnings whose `feature` matches a **direct** dependency of the current feature AND `type === "pitfall"` — lessons that bit us last time in code we're about to touch. Show a `RELEVANT LEARNINGS` block before the first AskUserQuestion of PHASE 1 (max 5 entries, pitfalls first, then patterns) — only on ≥1 match. No match → silent (the load still ran; only the display is conditional).

### PHASE 0b: Update-mode (only if feature.json already exists)

> **Todo**: if feature.json exists → Read `.claude/skills/dev-ship/references/dev-define/references/update-mode.md` and follow that flow, then continue to PHASE 1a.

---

### PHASE 1a: Interview

> **Precondition — do not open with a fabricated modal:** the interview (`phase1a-interview.md`)
> drives every dimension through its own form check first — `AskUserQuestion` opens a dimension
> only when `shared/QUESTIONING.md § Contested Dimension` is met (≥2 source-backed, mutually
> exclusive readings), everything else opens as a plain anchored question. If you are about to
> call `AskUserQuestion` on a dimension with no citable second reading, stop — that is inventing
> options, not reading them off the evidence.
>
> **Barrier**: neither form may render until every agent spawned for this phase has returned —
> `context-aggregator` (PHASE 0 §5) at minimum, plus a Fable consult if one was clicked
> mid-interview. See `phase1a-interview.md § Interview Start` for the full rule.

> **Todo**: Read `.claude/skills/dev-ship/references/dev-define/references/phase1a-interview.md` for the full interview protocol — dimension checklist, tone rules, modal form, one-question-at-a-time flow, and adaptive stop condition.

**Risk-check (only if `feature.risk >= 4`):** show one line before opening the interview — `⚠ HIGH RISK ({risk}/5): consider splitting this feature, verify dependencies, clarify scope before defining.`

**Surface relevant past decisions** (only with ≥1 match from PHASE 0 scan, otherwise skip silently): render a short `PREVIOUSLY DECIDED` list (`[scope] {decision} → chose {chosen} (constraint: {constraint})`) before the first interview question — context only, no action required.

**Park-note surfacing** (only when the PHASE 0 §4 `note` is non-null): show `PARKED PREVIOUSLY: {note}` before the first question — context only.

Conduct the interview per the reference — one dimension at a time, each routed to an open question or a modal per its own form check (`phase1a-interview.md § Modal Form`). **`AskUserQuestion` is not a blanket opener** — it opens a dimension only when that dimension is contested, and otherwise appears only as escalation step 2 of the ladder in `shared/QUESTIONING.md` (after an "I don't know" on the same dimension). Close per the reference's Stop Condition (a stated recap, no blocking confirm — the whole plan is reviewed at the gate); proceed to PHASE 1b once the recap has been shown.

---

### PHASE 1b: Requirements Synthesis

> **Precondition — do not enter PHASE 1b without this:** the PHASE 1a closing recap (§ Stop
> Condition: a 1–3 sentence statement of goal/success/key constraints) must already be visible
> earlier in this conversation. A single `AskUserQuestion` covering design forks is PHASE 1b's own
> step below, not a substitute for PHASE 1a's own per-dimension interview (open questions and
> contested-dimension modals alike) — if no recap was shown, go back and run PHASE 1a now
> (`references/phase1a-interview.md`) before continuing.

**Design choices** (only for architecture-changing branches — storage strategy, route shape, auth model, data model boundary, external service contract; **not** a pure implementation/library choice with no user-visible behavioral difference, e.g. which rendering library, which parser — auto-decide those, record the rationale as a `durableDecision`, and don't ask): if the interview revealed a fork with concrete A vs B vs C options on a genuine architecture-changing branch, resolve these now via AskUserQuestion before extracting requirements. A fork already resolved via the PHASE 1a Opinion-Request exception (`phase1a-interview.md` § Opinion Requests — the user asked for your recommendation and you gave one) gets recorded as a `clarification` here without re-asking; AskUserQuestion is for forks still open at this point. **Baseline gate (run first):** for each candidate fork, check the `stack-baseline.md` content loaded in PHASE 0 §4 — if the baseline already standardizes the answer (e.g. "use @react-navigation/stack"), do NOT raise the modal; record it directly as a `clarification` (and a `durableDecision` if architecture-wide) citing the baseline, and show `Baseline: ✓ resolved fork — {pattern-name}`. Only forks the baseline leaves open reach the user. Each remaining sub-question must be a **design choice**. Include "Not relevant to scope" if applicable. Record each as `{ "question": "{branch}", "answer": "{chosen option}", "impact": "{which REQ area}" }` (written to `feature.json#clarifications` if ≥1 entry). Edge cases (validation rules, input notation, format defaults) → add directly as acceptance criteria, no AskUserQuestion.

**>4 open forks** → handle the remainder inline during requirement extraction as edge cases.

**Second-opinion signal** (bookkeeping only, no action here): if any fork above kept ≥2 viable options past the baseline gate — the user hesitated, chose "Other", or asked for the recommendation — note `secondOpinionSignal: "tied fork — {branch}"` in memory for dev-ship's Step 4b hook (`shared/SECOND-OPINION.md`). **If PHASE 1a already spent define's one consult slot** (a Fable click on a contested-dimension modal, `phase1a-interview.md § Modal Form`) — note `secondOpinionUsed: true` here too, so the Step 4b hook below sees the slot as spent and does not fire a second time this run.

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

> **STOP — output this checkpoint now, as its own chat message, before continuing:** show a numbered
> list with REQ-ID, 1-line description, and up to 2 key `when → then` acceptance scenarios per REQ
> (enough to catch misinterpretations before PHASE 2). Do not skip straight from the interview to
> PHASE 2 or the plan file without this turn — it is the user's only mid-flow checkpoint before
> architecture work starts.

```
REQ-001 — {1-line description}
  when {trigger} → {observable result}

REQ-002 — {1-line description}
  when {trigger} → {observable result}
  when {error trigger} → {error result}
...
```

- **≤6 REQs**: append `Scope: {N} requirements — SINGLE feature, continuing.` and proceed directly to PHASE 2. Skip PHASE 1c.
- **>6 REQs (count them — do not eyeball it)**: append `Scope: {N} requirements — checking for a split.` and proceed **directly** to PHASE 1c (cluster analysis) — do not proceed to PHASE 2 without running it. **No scope-confirm AskUserQuestion** — the numbered REQ list above is a passive progress view, and scope is reviewed at the gate; only a genuine split proposal (PHASE 1c) still asks.

**Mid-flow scope expansion**: if the user introduces new scope after requirement extraction but before PHASE 2, treat it as an additional AskUserQuestion round and re-run the completeness self-check. New REQs are regular requirements (numbered sequentially), not clarifications.

The full requirements table with acceptance criteria and the feature overview table are only written in the plan file (in PHASE 2), not inline in chat.

#### Frontend discovery (frontend projects only — skip if current feature `type` is `COMPONENT`, `INTEGRATION`, `THEME`, `A11Y`, `PERF`, `INFRA`, or `DOCS`)

> **Todo**: Read `.claude/skills/dev-ship/references/dev-define/references/frontend-discovery.md` and execute both steps: Reuse-Discovery (UI-keyword scan → `discoveredComponents[]` + `dependencies[]`) and Page-placement sparring (→ `pageHint[]` + PAGE backlog back-write).

> **Precondition — do not enter PHASE 1c without this:** the PHASE 1b numbered REQ-checklist
> (REQ-ID + acceptance scenarios, output as its own chat message) must already be visible earlier in
> this conversation — if it is not, stop and emit it now before continuing.

> **Gate — before PHASE 1c:** confirm the risk-check line ran or was genuinely skipped by type
> (`feature.risk >= 4`, PHASE 1a) — this is the only place that catches a missed one. Frontend
> discovery has its own gate at PHASE 2 entry below (where its output is actually consumed) —
> not re-checked here.

---

### PHASE 1c: Scope Analysis & Feature Splitting

**Run immediately after the PHASE 1b REQ-checkpoint.** Count `requirements.length`:

**≤6 requirements**: scope-line already shown in PHASE 1b checkpoint. Proceed directly to PHASE 2. Skip cluster analysis.

**7-10 requirements**: cluster on dependencies. ≥2 clusters with ≤2 cross-deps → RECOMMEND SPLIT.

**>10 requirements**: RECOMMEND SPLIT (unless linear chain, single concern).

**If SINGLE**: show briefly, continue.

**If SPLIT recommended**:

1. Show proposal with clusters, build order, cross-dependencies
2. AskUserQuestion: "Agree with split?" — Agree / Adjust / Keep as one feature
3. On split:
   - **Record the split in the draft** as a `## Feature split` gate section (split decision,
     sub-feature table with requirements + focus, build order). The disk writes below are **deferred
     to gate-accept** (Step 4b) — plan mode blocks them now:
     - at accept, write `.project/features/{feature-name}/00-split.md` with that content, and
       `mkdir -p .project/features/{feature-name}-{sub}` per sub-feature.
   - Re-number requirements per sub-feature (REQ-001, REQ-002, etc.)
   - Run PHASE 2-4 per sub-feature in build order
   - In backlog: sync each sub-feature individually

### PHASE 2: Architecture

> **Precondition — do not enter PHASE 2 without this:** (a) the PHASE 1b REQ-checkpoint (already
> gated once at the PHASE 1c entry above — re-confirm here since PHASE 2's own artifacts depend on
> it directly); (b) for feature types outside
> `COMPONENT`/`INTEGRATION`/`THEME`/`A11Y`/`PERF`/`INFRA`/`DOCS`, `frontend-discovery.md` must have
> actually been Read this turn (Reuse-Discovery + Page-placement sparring executed, even if both
> find nothing) — this is the binding check for that artifact (the PHASE 1c gate above only checks
> the risk-check line). Neither precondition may be satisfied retroactively by writing a plan-file
> line that assumes the step ran.

> **Todo**: mark PHASE 0+1a+1b → `completed`, PHASE 2 → `in_progress`.

**Output rule for this entire phase**: hold the design in the **in-memory draft** — do **not** write a plan file here (dev-ship's Step 4b gate writes it from the draft). **Do not show design output inline in chat** — **do** show one required chat line: `Architecture designed: N files, K build steps.`. **Exception**: for visual features the ASCII wireframe may appear inline in an AskUserQuestion description (see "Design sketch" in step 3).

**Strict boundary — design vs implementation**:

- **Allowed in plan file**: type signatures (`interface X { ... }`, `type Y = ...`, function signatures `(input: X) => Y`), file/module structure, feature flow as `→` chain, dependency graph, build sequence, test strategy table, durable decisions.
- **Forbidden in plan file**: function bodies, `(set, get) => ({...})` blocks, `set({...})` calls, helper implementations, JSX, hook internals — even as "skeleton" or "pseudo-code." That work belongs to the build phase. If a code fence contains anything beyond type declarations: stop and rewrite as an English description.

**Draft vs feature.json — role split**: full table in [shared/feature-json-schema.md § Role split](../../../shared/feature-json-schema.md#role-split). Short rule: the gate plan file (written at Step 4b) = review surface (context, REQ-list, durable decisions 1-liners, flow, verification) + a `## Appendix — machine contract` holding the **complete feature.json draft** as a ```json block (authored here in memory, skipped in review). Gate-accept extracts that block into feature.json mechanically — the appendix IS the canonical contract, written once.

Design in three steps:

1. **Baseline check** (internally):
   - Reuse the `stack-baseline.md` section(s) loaded in PHASE 0 §4 (re-read only if not yet in memory); match patterns relevant to this feature.
   - **Pattern found** → use as basis, no research topic. In PHASE 3: omit the `research` field in feature.json entirely (baseline hit is not research).
   - **Pattern not found / no baseline file** → do **not** research inline. Collect the open question as a `researchTopics[]` entry (topic + why) for the scout in step 2. Do NOT create a baseline file (that is /core-setup).

   > **Note**: record the baseline verdict (`Baseline: ✓ pattern hit — {pattern-name}` or
   > `Baseline: ⚙ research queued — {topic}`) — it prints as part of the PHASE 2 close-out
   > gate below, not here.

2. **Scout: existing code + research** (delegated — keeps the file reads and library lookups out of the main context):

   > **Todo**: unless this is a greenfield area (no prior `feature.json` under `.project/features/` **and** the PHASE 0 §4 import scan found no matches), spawn the `define-scout` agent via the `Task` tool with:
   >
   > - `featureName`, `reqSummaries` (1-line per REQ), `stackSummary` (from project.json stack),
   > - `researchTopics` = the entries collected in step 1 (empty when the baseline covered everything),
   > - `hintPaths` = the import-scan matches from PHASE 0 §4, `repoRoot` = repo root.
   >
   > Parse the `DEFINE_SCOUT_START/END` digest: `PATTERNS`/`INTEGRATION` feed step 3's design; `VERIFY` →
   > read these files yourself before finishing step 3 (their signatures anchor the machine contract —
   > the scout flagged them as worth confirming directly, not just quoting); `RESEARCH` →
   > `feature.json#research` in PHASE 3 (only when non-empty); `PENDING_BASELINE` →
   > `pendingBaselineAppends` for the PHASE 4 sync (`stack-baseline.md` append).
   >
   > **Direct-read budget** (one rule, both branches): after the digest — or in the fallback below —
   > you may read **at most 3 files directly** this feature. Spend that budget on the digest's `VERIFY`
   > entries first (if any), then on further closest-match files if still needed. This is a **cap**, not
   > a violation to police — going over it just means the remaining research belongs to `define-scout`
   > (spawn it, or a second scoped call, instead of continuing to read).
   >
   > **Fallback** (greenfield gate hit, empty digest, or scout unavailable): inline `Glob + Read` up to
   > the same 3-file budget, closest structural matches first, and, for any `researchTopics`, one
   > Context7/WebSearch lookup each — same outputs, just in-context. Never design without either the
   > digest or this bounded fallback.

3. **Design** → into the in-memory draft:
   - **Feature flow**: compact `→` chain. Conditional paths in `[brackets]`, parallel with `+`.
   - **File structure**: create/modify table (path, action, purpose, requirements).
   - **Routes registration** (frontend projects with `stack.framework` only): only `page`/`route` files with `action: CREATE` get an entry in `feature.architecture.routes[]` with `{ path, file, action, requirements[] }`. MODIFY-only route files: skip — `project-context.json#context.routing` leaves existing routes unchanged in PHASE 4. **Skip entirely** if no CREATE route/page files — omit the `routes[]` field from feature.json.
   > **Todo — visual-feature trigger (check before finishing step 3):** the wireframe below is
   > mandatory whenever `files[]` contains **any** route/page file (`action: CREATE` or `MODIFY`,
   > e.g. `src/app/**/page.tsx`) or any REQ's acceptance criteria describe on-screen rendering — even
   > when most of the feature's requirements are backend (a 6-backend/3-frontend-REQ split still
   > triggers it). Skip only when neither is true (pure API/backend/game-logic feature) — state
   > `Design sketch: n/a — no rendering surface` in the draft, mirroring the Seed/Backlog "n/a:
   > {reason}" pattern.
   - **Design sketch**: author the ASCII wireframe + states (loading/empty/error) into the draft for every route/page file the trigger above matches. **No inline confirm** — the wireframe becomes a **required section of the gate review surface** (Step 4b), where the user reviews the visual design alongside everything else and reject-feedback adjusts it. Use token names (`bg-primary`, `text-foreground`), no hex. See `shared/TOKENS.md`.
   - **Durable decisions** (1-line each for plan-file review): full rationale and canonical form go to feature.json in PHASE 3.
   - **Machine contract appendix** — author the **complete feature.json draft** NOW (held in memory; dev-ship's gate materializes it as the plan-file appendix at Step 4b) as a single ```json fenced block under a `## Appendix — machine contract (skip review)` heading, **compact single-line JSON (no indentation)** — halves the token cost of the plan-file echo. Include every define-owned field per [shared/feature-json-schema.md](../../../shared/feature-json-schema.md): `name`, `status` (`"DEFINED"`), `created`, `depends`, `summary`, `requirements` (with full `acceptance[]`), `files`, `architecture` (incl. `interfaces[].definition` — type declarations only, per the Strict boundary above), `buildSequence`, `testStrategy`, plus the conditional fields (`design`, `apiContract`, `clarifications`, `durableDecisions`, `research`, `externalRef`, `pageHint`, `seedDrift`). The appendix is not part of the review surface — the heading tells the reviewer to skip it; the review sections above (context, REQ 1-liners, file table, flow, verification, durable-decision 1-liners) are the human review surface. Gate-accept extracts this block mechanically into feature.json — no re-authoring. Dependency analysis stays implicit — derived from `buildSequence[].dependsOn`, no separate section.
   - **AI-navigability** (skip if ≤6 files AND no new registry): when applicable, identify new registries and record them in `architecture.registries[]` (written to feature.json in PHASE 3). Omit module-export lists, colocation notes, and import constraints — covered by project conventions.

**Seed Alignment Check** (penultimate step in PHASE 2 — only when `requirements.length ≥ 4` OR ≥1 durableDecision OR ≥1 clarification was recorded; below that skip silently, trivial features yield only drift-noise):

> **Todo**: Follow [shared/SEED.md](.claude/skills/shared/SEED.md) § Alignment Check — but **run only the detection**, not its `AskUserQuestion`, with one change to the comparison basis: compare against the **user's interview answers and the crystallized REQs**, not against the seed the Assumption Block already drew from — comparing a decision back to the document it was anchored on rarely finds drift. **Reversal**: any Assumption Block bullet the user struck through in PHASE 1a whose source was the seed is a first-class drift candidate regardless of what the drift scan itself finds — add it to the drift table with `ref` pointing at the dimension or REQ that replaced it. When drift is found, record the drift table + proposed rewrite in the draft as a `## Proposed seed update` gate section (default action: apply on accept). Carry `seedUpdateApproved: true` AND `overviewUpdateApproved: true` to PHASE 4 (seed + backlog-overview co-update — same description in two places) so accept applies it; the user can reject just that section at the gate, in which case carry `seedDrift[]` to PHASE 3 instead (written to `feature.json#seedDrift`). No drift detected → no section, no carry. `source: "/dev-define"`, `ref: "REQ-NNN"` where applicable.
>
> **Note**: the resulting `Seed: ✓ aligned` / `Seed: ⚠ drift — N item(s)` verdict prints
> as part of the PHASE 2 close-out gate below, not here.

**Backlog Impact Check** (last step in PHASE 2, directly after the Seed Alignment Check — no size threshold; a two-REQ feature can still obsolete a card):

> **Todo**: Follow [shared/BACKLOG.md](.claude/skills/shared/BACKLOG.md) § Impact Check — but **run only the detection**, not its `AskUserQuestion`. When ≥1 card is impacted, record the impact table in the draft as a `## Backlog impact` gate section (default action: apply the proposed verdicts on accept). Carry those verdicts to PHASE 4 as `backlogImpact[]`; the mutations happen in the accept sync batch, and the user can reject just that section at the gate. No impact → no section, no carry.
>
> **Dependents note** (same section, informational only — no architecture change): if any `open-items` entry from PHASE 0 §4 has this feature in its own `dependencies[]`, add one line to the `## Backlog impact` section — `Upcoming: {name} depends on this feature ({its description})` — so the reviewer sees it at the gate. This is visibility only; it does not add a seam-design step, and skip it entirely rather than speculate about requirements the dependent card hasn't defined yet.
>
> **Note**: the resulting `Backlog: ✓ open items unaffected` / `Backlog: ⚠ impact —
N item(s)` verdict prints as part of the PHASE 2 close-out gate below, not here.

**Second-opinion signal** (bookkeeping only): if the draft's `files[]` spans ≥3 top-level modules/dirs, note `secondOpinionSignal: "cross-cutting architecture"` in memory for dev-ship's Step 4b hook.

> **STOP — PHASE 2 close-out checkpoint (mandatory, own chat message, before Step 3):**
> print all three verdict lines together, right now, in one chat message — this is the
> only incremental visibility the user gets before the full plan-file dump at the gate:
>
> ```
> Baseline: {✓ pattern hit — {pattern-name} | ⚙ research queued — {topic}}
> Seed: {✓ aligned | ⚠ drift — N item(s)}
> Backlog: {✓ open items unaffected | ⚠ impact — N item(s)}
> ```
>
> Do not proceed to "End of PHASE 2" / dev-ship Step 3 without this exact block
> appearing as its own turn's text output — folding it only into the plan-file draft
> does not satisfy this gate.

**End of PHASE 2**: the complete in-memory draft (incl. the machine-contract appendix) is ready — **return to dev-ship Step 3** (`phase-0-define-classify.md`). dev-ship's Step 4b gate presents the draft for approval and, on accept, runs PHASE 3+4 below.

### PHASE 3+4 — run at dev-ship gate-accept (Step 4b)

> These two phases are **not** run inline during PHASE 0→2. dev-ship's Step 4b executes them on
> **Accept**: PHASE 3 extracts the draft into feature.json, PHASE 4 syncs the JSON files. Track their
> phases in prose (no `TaskCreate`).

### PHASE 3: Write feature.json

**Extract, don't re-author**: the complete feature.json draft was authored in PHASE 2 (held in memory, materialized as the gate plan-file appendix at Step 4b — the `## Appendix — machine contract` block). Run:

```
node ~/.claude/scripts/feature-from-plan.js <plan-file> .project/features/{feature-name}/feature.json
```

where `<plan-file>` is dev-ship's gate plan file (Step 4b). The script extracts the ```json appendix, validates it, and — in update-mode — merges over the existing file (preserving `build`/`tests`/`refactor`/etc. that the draft does not own). Check the exit status: exit 0 = written, done.

**Fallback** (non-zero exit — appendix missing or invalid JSON in a legacy/post-compaction plan file): author `.project/features/{feature-name}/feature.json` by hand now, using `shared/feature-json-schema.md` for the full field table, deltaOp rules, durableDecisions categories, and buildSequence structure, and `shared/FEATURE.md` for the full schema.

### PHASE 4: Sync

> **Todo**: Read `.claude/skills/dev-ship/references/dev-define/references/phase4-sync.md` for mutation details per file.

Follow `shared/SYNC.md` 3-File Sync Pattern. Mutation details for backlog.json, project.json, and project-context.json: see `references/phase4-sync.md`.

Read in parallel **directly before editing** (skip if not exists) — do NOT rely on reads from earlier phases:

- `.project/backlog.json`
- `.project/project.json`
- `.project/project-context.json`

Apply the mutations from `references/phase4-sync.md` in memory, then batch-write at the end of the phase.

**PAGE-seeding** (frontend projects only — skip for pure API/backend/game features):

Follow [Discovery — Page-Discovery](.claude/skills/shared/SKILL-PATTERNS.md#page-discovery) for the canonical protocol.

**Trigger:** scan `feature.json#architecture.routes[]` and `feature.json#files[]`. **Resolution is at the gate, not a separate prompt:** the candidate pages were surfaced as the `## Pages to seed` section of the gate plan file (authored from the draft's `routes[]`/`pageHint[]` in PHASE 2). Accept → seed **all** listed candidates here; a gate reject that edited/dropped the section already pruned the list. No `AskUserQuestion` in this sync.

**Source:** `"/dev-define"` · **Direction:** `"dev→frontend"` · **Type:** `PAGE`

Write back in parallel:

- Edit the JSON in `.project/backlog.json`
- Edit `project.json` (endpoints, data, stack — use Edit for targeted changes, not Write)
- Edit/Write `project-context.json` (if architecture or context changed — Write for large diagram changes)

#### Mutations on `project-seed.md` (only if `seedUpdateApproved: true`)

- Skip if PHASE 2 ended with "Skip" or no drift was detected.
- Source content: the plan file's `## Proposed seed update` section.
- Apply all writes per [shared/SEED.md § Write targets](.claude/skills/shared/SEED.md#write-targets-sync-phase) — that table is canonical for seed-mutation file set and log line.

All writes in this block run in parallel with the existing back-writes (`backlog.json`, `project.json`, `project-context.json`).

**Auto-build marking** (after sync):

Combine the auto flag with the status write above — no separate second write. The backlog mutation in one script: `status: "DEFINED"`, `definedAt: <ISO>`, `auto: true` together. No user prompt — always mark auto so the card gets an AUTO badge.

**Terminal handoff — none.** dev-ship drives the pipeline: **no** DEFINE COMPLETE block, **no**
`Next:`/clipboard offer, **no** wireframe preview (the ASCII wireframe is reviewed inline in the Step
4b gate), and **no** `active-{feature}.json` cleanup (dev-ship owns the live signal —
Step 2a armed it, Step 4b rewrites it without `waiting`). After the sync writes, return control to
dev-ship Step 4b, which continues to Step 5 → build.
