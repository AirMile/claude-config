# PHASE 0 — Target + Direction + Brief

The one interactive phase. All human design decisions are front-loaded here — spec, design
direction (visualized), content brief — then everything runs hands-off until the PHASE 4 visual
review.

## Step 0 — Checkpoint-resume detection + preflight

Before resolving the target, Read `.claude/skills/shared/SHIP-CHECKPOINT.md` and run its resume
detection against `.project/session/ship-{target}.json` (use the resolved arg for `{target}`; if
`/design-ship` was called with no arg, first resolve the name via Step 1, then run this check). This
is read-only, so it is fine before plan mode:

- **Open checkpoint found** (`status != "complete"`) → present the Resume / Restart / Inspect
  `AskUserQuestion` from SHIP-CHECKPOINT.md.
  - **Resume** → run orphan/leak cleanup, load `plan` (→ `SHIP_PLAN` + the full PHASE 0 objects) +
    `results` from the checkpoint (worktree path/branch live in `results.build`), re-derive
    `SHIP_CONTEXT` fresh (Step 10), re-seed the 6-phase `TaskCreate` list (completed phases →
    `completed`), and **jump to the recorded `phase`** (skip the rest of PHASE 0). This is the
    credits-op / crash recovery path.
  - **Restart** → archive the old checkpoint + clean the orphan worktree, then continue PHASE 0 fresh.
  - **Inspect** → print checkpoint + worktree status, re-ask.
- **No open checkpoint** → run the **preflight checks** (dirty working tree, colliding
  `worktree-{target}` from a prior aborted run without a checkpoint), surface any notice, then
  continue to Step 1.

On a fresh run, capture the rollback anchor now: `baselineSha = git rev-parse HEAD` (read-only). It
is written to the checkpoint in Step 9.

## Step 1 — Resolve the target

Resolve `{target}` in this order:

1. **Argument given** → `$TARGET = $SKILL_ARG`. Look it up in `backlog.json#data.features[]`
   (match on `name`) and/or `project.json#design.pages[]/components[]`.
2. **No argument** → first feature with `transition: "shipping"` AND
   `(type === "PAGE" || type === "COMPONENT")` (queued via the board's ⚡ Ship menu item) wins.
3. **Still nothing** → merge the Build-route candidate sources (`design.pages[]/components[]`
   with `status: "DEF"`; backlog PAGE/COMPONENT with `transition: "designing"` or
   `status: "TODO"`) and present an `AskUserQuestion` (max 4, rest via Other). Zero candidates →
   stop: `"design-ship: no PAGE/COMPONENT candidates. Run /project-backlog or /design-create
first."`

Set `$TARGET_TYPE` (PAGE | COMPONENT) from the backlog/spec entry.

**Guards** (check in order, stop with the message on hit):

- `$DOMAIN !== "web"` (resolve per `shared/DOMAIN.md`) → `"design-ship is web-only — use
/design-create for the {domain} spec flow."`
- `type === "THEME"` → `"THEME items go through /design-tokens."`
- `type === "PAGE-GAP"` or a dev-track type (FEATURE etc.) → `"That is a dev-track item — use
/dev-ship {target}."`
- Feature already `shipped: true` → `"Already shipped. Use /design-create {target} for a
rework."`
- Visual reference material exists (`.project/wireframes/{target}*` or spec `.screenshots[]`) →
  `"This target has visual input — the Convert route is interactive by design. Run
/design-create {target}."` (design-ship covers the Build lane only.)

## Step 2 — Enter plan mode

> **Todo**: Use the `EnterPlanMode` tool now — spec review, composition, direction composition,
> and the brief all benefit from Opus-level reasoning under the `opusplan` router.
> `AskUserQuestion`, `Read`, `Glob`, `Grep`, `WebFetch` keep working; disk writes are deferred to
> Step 8. Skip if plan mode is already active (see `shared/PLAN-MODE.md § Entry`).

## Step 3 — Spec gate

Run the copied Build route's Step 2.5 (read it in
`.claude/skills/design-ship/references/design-create/route-build.md` — resolve spec from
`feature.json` → `design.*` → inline questions; show the SPEC block; gate with
Build it / Edit spec / Cancel). Deviation from stock: the "Save spec only — don't build" option
becomes **"Cancel ship"** — design-ship without a build is pointless; point the user to
`/design-create` for spec-only work. Store `$SPEC` (and `$INLINE_SPEC` when captured fresh — its
deferred write happens in the build agent's completion sync 10f).

## Step 4 — Build context

Follow the copied Build route's Step 4 + 4b **in the main chat**: seed context (`shared/SEED.md`
reader → `SEED_CONTEXT`), design-levers pre-flight (→ `$DESIGN_LEVERS`, warn-only), and — PAGE
only — page composition per the **original** `
.claude/skills/design-create/references/page-compose.md` (→ `$COMPOSITION`,
`$PENDING_DESIGN_WRITES` travel to the build agent via the build-slice for sync 10f).

## Step 5 — Design directions (visualized)

Compose 2-3 directions exactly per the copied Build route's Step 5 rules (three axes, ≥3 named
token decisions each, anti-patterns from `shared/DESIGN.md`).

**Visual preview first** — render the options side-by-side in the browser:

> **Todo**: render `.claude/skills/shared/references/preview-directions.html` to
> `.project/previews/design-ship-{target}.html` (fill the `preview-data` JSON block with
> `{ target, targetType, directions: [{ name, archetype, hierarchy, tokens[], motion, surfaces,
ascii, recommended }] }` — `ascii` = the same mockup used in the modal below), then present
> that file:// path via `.claude/skills/shared/HTML-PRESENT.md`.

Then present the `AskUserQuestion` with ASCII `preview`s (identical to the Build route's Step 5
modal — the browser preview and the modal show the same options; the modal is the decision).
"Other" free text → recompose once, re-render the preview, re-present. Store
`$DESIGN_DIRECTION` + `$CHOSEN_LAYOUT`.

## Step 6 — Content brief

Run the **original** `.claude/skills/design-content/references/scope-intent.md` §1.1–1.3 in the
main chat: archetype classification (→ `$ARCHETYPE`), marketing-research hook (marketing
archetype only — offer `/marketing-research` stop as stock), brief inference + the confirm modal
(→ `$BRIEF`). Skip §1.4's separate CHECKPOINT — the §1.3 confirm is the checkpoint here (one
modal less; the PHASE 4 review re-checks the result against the live page).

## Step 7 — Check scope (auto — no question)

Derive `SHIP_PLAN.checkScope` from the copied check workflow's §0.2 auto-scope table: feature
with routes → `Performance + SEO + AEO + Responsive + Darkmode + A11Y runtime + Error states +
Smoke`; without routes → `A11Y runtime + Smoke`. Fix policy is fixed: All CRITICAL + HIGH (AGENT
3 self-selects). State it in one line — the user reviews outcomes in PHASE 4, not scopes here.

```
SHIP_PLAN:
  target:     {target} ({targetType})
  direction:  {$DESIGN_DIRECTION.name}
  archetype:  {$ARCHETYPE}
  brief:      {tone} · {lengthStyle} · {language}
  checkScope: [...]
```

## Step 8 — SHIP PLAN + plan-mode exit

> **Todo**: Use the `ExitPlanMode` tool — present the Build route's BUILD PLAN block (from the
> copied Step 7) plus `SHIP_PLAN` as the plan output. Plan rejection covers "adjust plan". Skip
> if plan mode is no longer active or the user started in plan mode (see
> `shared/PLAN-MODE.md § Exit`).

## Step 9 — Board state: `shipping` marker + live signal

After the plan-mode exit (writes are unblocked now):

1. **Run marker** — set `transition: "shipping"` on the target's `backlog.json` entry (per
   `shared/BACKLOG.md → Lifecycle Protocol → Write`). Keeps the card in the board's IN PROGRESS
   section between phases. Removed by PHASE 4 completion (shipped) or PHASE 5 cleanup.
2. **Live signal**:

   ```bash
   mkdir -p .project/session
   echo '{"feature":"{target}","skill":"design","startedAt":"{ISO}"}' > .project/session/active-{target}.json
   ```

   The agents rewrite this file with `skill: build | content | check` when they start (contract
   rule 12); PHASE 4 rewrites it with `skill: "ship"`.

3. **Checkpoint** — the first write (per `shared/SHIP-CHECKPOINT.md` atomic-write; writes are
   unblocked after the Step 8 plan-mode exit). The PHASE 0 selections are the irreproducible user
   choices that make the run resumable — store the **full objects the agent prompts are assembled
   from**, not the display-abbreviated `SHIP_PLAN` block: `$DESIGN_DIRECTION` (incl. its token
   decisions) + `$CHOSEN_LAYOUT`, `$ARCHETYPE`, `$BRIEF`, `checkScope`, `$COMPOSITION` (PAGE only),
   and `$SPEC` **when captured inline** (its disk write is deferred to the build sync 10f, so until
   the build completes the checkpoint is its only durable home). Write
   `.project/session/ship-{target}.json` with `pipeline: "design"`, `feature: {target}`,
   `startedAt`/`updatedAt`, `status: "running"`, `phase: "PHASE 1"`,
   `completedPhases: ["PHASE 0"]`, `baselineSha` (from Step 0), `plan: {the full objects above}`,
   empty `results`/`prompts`, `activeWorkflow: null`.

## Step 10 — Assemble `SHIP_CONTEXT` (the context-hub)

The main chat already loaded everything above — package it once; each agent gets its slice, so no
agent re-bootstraps its own context.

```
SHIP_CONTEXT:
  target:      {target} ({targetType})
  stack:       {project.json#stack — framework, styling, routing model}
  seed:        {SEED_CONTEXT.name + pitch; full markdown only in the content-slice}
  spec:        {$SPEC}
  levers:      {$DESIGN_LEVERS}
  direction:   {$DESIGN_DIRECTION + $CHOSEN_LAYOUT}
  composition: {$COMPOSITION + $PENDING_DESIGN_WRITES — PAGE only}
  brief:       {$ARCHETYPE + $BRIEF}
  glossary:    {project.json#theme.voice.terms or none}
  entities:    {top entities from project.json — names + key fields}
  plan:        SHIP_PLAN
  mainRepo:    {absolute main-repo path}
  worktree:    {filled from the build result — empty until then}
```

### Per-agent slices (don't pass the whole block to everyone)

All slices share `target`, `stack`, `mainRepo`. They differ in the rest:

| Slice                       | Adds on top of the shared header                                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **build-slice** (AGENT 1)   | `spec` · `levers` · `direction` · `composition` · `seed` (name+pitch) · `glossary`                                         |
| **content-slice** (AGENT 2) | `brief` + `archetype` · `seed` (full markdown) · `glossary` · `entities` · built files list (from the build result)        |
| **check-slice** (AGENT 3)   | `plan.checkScope` · target routes + files (from the build result) · `theme` summary (darkmode/motion levers for D102/M006) |

Each `agent-*.md` pastes its own slice into the `{paste the … slice}` placeholder; the assembled
prompts travel as the **Workflow `args` payload** (`buildPrompt` / `contentPromptTemplate` /
`checkPromptTemplate` — the script substitutes `{worktreePath}` after the build). The content and
check prompts are assembled **pre-build**, so they instruct the agents to refresh mutable state
(backlog entry, built files) from `.project/` themselves.
