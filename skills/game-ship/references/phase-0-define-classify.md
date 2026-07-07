# PHASE 0 — Define + Classify + Auto-derive technique plan

The one up-front interactive phase. All up-front human decisions are front-loaded here; everything
after runs hands-off until the live playtest in PHASE 3.

**Plan-mode shape (token efficiency).** The whole define thinking-block — interview, requirements,
architecture, classify, technique-derivation — runs **inside plan mode** (entered at Step 2b). Under
an `opusplan`-style router that means it reasons on the **planning model** (e.g. Opus); execution
(build/verify/refactor) runs on the **execution model** (e.g. Sonnet). Plan mode blocks `.project/`
and source writes, so **all bookkeeping is hoisted to Step 2a (before plan mode)** and **all durable
artifacts are written at gate-accept (Step 4b, after plan mode exits)**. The gate is the single
review + go/no-go for the whole plan — reject loops back inside plan mode to revise. Runs unchanged on
a single fixed model (plan mode is then just structure, no model switch).

## Step 0 — Checkpoint-resume detection + preflight

Before resolving the feature, Read `.claude/skills/shared/SHIP-RESUME.md` and run its resume
detection against `.project/session/ship-{feature}.json` (use the resolved arg for `{feature}`; if
`/game-ship` was called with no arg, first resolve the name via Step 1, then run this check).
Normally an explicit arg + open checkpoint never reaches this file — `SKILL.md` PHASE 0 routes it
straight to `SHIP-RESUME.md`; the cases that land here are **no arg**, a fast-path miss, or **no open
checkpoint**.

- **Open checkpoint found** (`status != "complete"`) → follow `SHIP-RESUME.md`'s logic (pipeline
  check redirects a `"dev"`/`"design"` checkpoint; fast path or Resume/Restart/Inspect, then the
  On-"Resume" jump to the recorded phase — game phase map: `PHASE 3` → `phase-3-playtest.md § Resume
entry`; `PHASE 0 · define` → re-run define from the top, Step 1 below — the draft was authored in
  plan mode and is **not** durably checkpointed, so the interview re-runs; a workflow phase → its
  On-"Resume" step 4 relaunch). A **Restart** choice continues fresh below.
- **No open checkpoint** → run the **preflight checks** (dirty working tree, colliding
  `worktree-{feature}` from a prior aborted run without a checkpoint; per `SHIP-CHECKPOINT.md
§ Preflight`), surface any notice, then continue to Step 1.

On a fresh run, capture the rollback anchor now: `baselineSha = git rev-parse HEAD`. It is written
to the checkpoint in Step 2a.

## Step 1 — Resolve the feature

Resolve `feature-name` exactly as `game-define` PHASE 0 does (arg → backlog `transition` match →
first TODO → concept → open question), with one game-ship-specific addition **before** the
define-style transition match: a feature with `transition: "shipping"` (queued via the board's
⚡ Ship (auto) menu item) wins the no-arg resolution. Then check
`.project/features/{feature-name}/feature.json` to set the `defineNeeded` flag for the rest of PHASE 0:

- **Exists with `status` ≥ DEFINED** (has `requirements[]` + `architecture`) → `defineNeeded = false`.
  The plan gate was **already accepted in a prior run** (feature.json is written only at gate-accept,
  so its presence means "past the gate"). Skip both define **and** the plan gate **and** plan mode
  (nothing to think — the plan re-derives deterministically from `feature.json`): do Step 2a
  (bookkeeping), then Step 3 → Step 4 → **Step 5** (skip Step 2b/2c and Step 4b). This is the
  resume-recovery path for the narrow window where a prior run accepted the gate but the checkpoint
  had not advanced past it (once the checkpoint exists, Step 0's direct resume catches it first).
- **Missing / not yet DEFINED** → `defineNeeded = true`. Full flow: Step 2a → 2b → 2c → 3 → 4 → 4b.

## Step 2a — Bookkeeping (before plan mode — runs on both branches)

Plan mode blocks `.project/` writes, so **every** bookkeeping write happens here, up front:

1. **Feature dir + session:** `mkdir -p .project/features/{feature-name} .project/session`.
2. **Live signal** — write the board's live signal with `skill: "define"`; add `"waiting": "define"`
   **only when `defineNeeded`** (the board then shows the run waiting for input through the whole
   interactive block):

   ```bash
   echo '{"skill":"define","waiting":"define"}' | node ~/.claude/scripts/ship-checkpoint.js signal {feature-name}
   ```

   The later SKILL.md phase boundaries rewrite this same signal with `skill: build | test | refactor`
   — the board badge follows the pipeline. (Define's own PHASE 0 signal write is **skipped** — this is
   it; see Step 2c.)

3. **Run marker** — set `transition: "shipping"` on the feature's `backlog.json` entry. This keeps
   the card in the board's IN PROGRESS section between phases, when no agent is running. It is removed
   by refactor's completion-batch (feature shipped) or by PHASE 5 cleanup on every other exit path.
4. **Minimal light checkpoint** (SHIP-CHECKPOINT.md write point 0) — `init`
   `.project/session/ship-{feature}.json` with `pipeline: "game"`, `feature`, `startedAt`/`updatedAt`,
   `status: "running"`, `phase: "PHASE 0 · define"`, `completedPhases: []`, `baselineSha` (from Step
   0), empty `results`/`prompts`, `activeWorkflow: null`, and `plan: {}`. This is the **last
   `.project/` write before plan mode**. It marks the run started (so the board shows it **parked** if
   the session dies) and durably anchors the rollback SHA. It deliberately holds **no** feature draft:
   the draft is authored inside plan mode and cannot reach disk until accept (see the § Resume note at
   Step 4b for what a mid-define death costs).

**If `defineNeeded == false`** (Step 1 DEFINED branch) → continue to **Step 3** (no plan mode, no
define — Step 3 re-derives from `feature.json`).

## Step 2b — Enter plan mode (only when `defineNeeded`)

`EnterPlanMode` (per `shared/PLAN-MODE.md` Entry). **Skip if already in plan mode** — if an active
plan-mode system-reminder already exists (the user started `/plan-mode` or another plan-mode skill
first), do not call it; read the existing plan-file path from that reminder instead. Note the
plan-file path from the system-reminder — the gate (Step 4b) writes the plan there.

Everything from here to the gate runs in plan mode: `Read`/`Glob`/`Grep`, read-only Bash (including
GUT/Godot read-only introspection), `WebSearch` + Context7, `AskUserQuestion`, and read-only research
subagents all keep working; only `.project/`/source writes are blocked (and define defers all of those
to accept anyway).

## Step 2c — Run `game-define` inline (PHASE 0→3) in plan mode

Execute `game-define` by reading `.claude/skills/game-ship/references/game-define/SKILL.md` and
following it. That copy is **already adapted** for game-ship — it carries no plan-mode machinery of its
own (game-ship owns the enclosing plan mode) and no phase tracking. Notes for this enclosing context:

- It runs **PHASE 0→3 only** now (interview, requirements, architecture, and the **complete
  feature.json draft** held **in memory** — no `feature.json` write, no plan-file write yet). This is
  game-ship's one interactive touchpoint: define keeps its genuine-decision `AskUserQuestion`s (feature
  resolution, scene-layout forks, split proposal), and they reach the real user. **Pure confirmations
  are gone** — no interview summary-confirm, no ">6 REQs scope confirm", no scene-layout confirm, no
  seed/backlog-impact prompts; those are presented in the gate plan file instead (Step 4b), where the
  user reviews everything at once and the reject-loop revises.
- **Skip its PHASE 0 initial-setup writes** (the `mkdir` + `active-{feature}.json` write) — Step 2a
  already did them.
- Its **PHASE 4+5 (write + sync) run at gate-accept** (Step 4b): the draft becomes the plan-file
  appendix, `feature-from-plan.js` writes `feature.json`, and the sync runs. All
  `.project/{backlog,project,project-context}.json` writes — including the backlog `DEFINED` flip with
  `auto: true` — are deferred to that accept, so a rejected-and-abandoned define leaves no orphan card.
  Any conditional define writes (`00-split.md` + sub-feature `mkdir`s on a split) defer to accept too.

Then continue **in plan mode** to Step 3 (classify) and Step 4 (technique plan), then Step 4b (the
gate). Do not end the skill.

## Step 3 — Compute the advisory playtest classification

Classify each `acceptance[]` scenario as COVERED (a GUT unit test will verify it) or MANUAL
(requires a human playtest). **Use the short form below as the working rule — do NOT read
`checklist-classification.md`** here (this estimate is advisory; AGENT 2 does the authoritative pass
at verify-time). Read
`.claude/skills/game-ship/references/game-verify/references/checklist-classification.md` **only** if
an item stays genuinely ambiguous after the short form. Inputs come from the **in-memory draft**
(feature.json is not written until accept — or, on the `defineNeeded == false` branch, from the
existing `feature.json`): `requirements[].acceptance[]` (each `{ when, then, category }`), `type`, and
the architecture (scenes/signals/scripts).

Short form of the classifier:

- **COVERED** — deterministic, GUT-verifiable: game logic/calculations, damage/stat formulas, state
  transitions, signal flows, node config, scene-tree construction, resource creation, exported
  values. No human judgment. (These get a GUT test in game-build.)
- **MANUAL** — only when human perception/judgment is truly required: gameplay feel ("feels
  responsive/fun"), visual quality, particle/animation polish, audio, cross-requirement gameplay
  scenarios experienced live. (These need the PHASE 3 playtest.)

**Pitfall-informed bias** (memory → decision). Load preloaded pitfalls now via
`shared/LEARNINGS-LOAD.md` (scopes `[component]` + pitfall-prefix, including **direct dependencies**)
— this same load feeds Step 6, so do it once here (`Read`/`node -e` are read-only, fine in plan mode).
If a pitfall shows a related/dependency feature **needed manual playtest** for a similar acceptance
(e.g. "knockback feel needed a live playtest"), lean that item toward MANUAL even if the rules say
COVERED. Note the bias in `autoDecisions`.

Add the estimate to the draft's `playtestProfile` (it rides into the plan-file appendix at Step 4b
and lands in feature.json at accept). **No checkpoint write here** — Step 3 runs inside plan mode
(when `defineNeeded`), so the profile lives only in the in-memory draft until the gate materializes
it. Shape:

```json
{ "covered": <count>, "manual": <count>, "manualTitles": ["..."], "estimatedAt": "<ISO>" }
```

> **Advisory only.** AGENT 2 (`game-verify`) does its own authoritative classification at verify-time
> (against the real `tests.checklist[]` written by build) and returns the real `remainingManualItems`.
> This estimate is for (a) setting user expectations up front and (b) auto-deriving the technique plan
> below. PHASE 3 uses AGENT 2's output, not this.

State it in one line: `Playtest profile: ~{covered} GUT-covered, ~{manual} playtest → {"hands-off" | "live playtest expected in PHASE 3"}`.

## Step 4 — Auto-derive the technique plan (no user prompt)

game-ship's one up-front human touchpoint is `define` only. The refactor pass is **auto-derived here
from the feature's characteristics and applied in PHASE 4** — never a pre-build menu. You cannot
sensibly pick refactor lenses before the code exists; the refactor agent decides what to apply from
the _actual_ code, GUT test-guarded (revert-on-red), so the safe outcome is guaranteed by
construction, not by a pre-flight toggle. The lenses map to `game-refactor`'s GDScript anti-pattern
categories (Performance, Signals, Scene Tree, Memory, Code Organization) plus the general
Quality/Reuse pass — they **focus** game-refactor's scan; the scan is comprehensive regardless.

**Signal → lens derivation** (compute into SHIP_PLAN; applied in PHASE 4, no confirmation):

| Signal in the draft                                              | Derive                                                  |
| ---------------------------------------------------------------- | ------------------------------------------------------- |
| any source files to refactor                                     | `Quality` (readability/dead-code/typing), `Reuse` (DRY) |
| `_process`/`_physics_process`, loops, many nodes, hot paths      | + `Performance`                                         |
| signals / event handling / observer patterns                     | + `Signals`                                             |
| scene-tree composition, node instancing, sub-scenes              | + `SceneTree`                                           |
| resource loading (`preload`/`load`), instancing, object creation | + `Memory`                                              |
| none of the above                                                | `Quality`, `Reuse` only                                 |

**Pitfall-informed derivation** (memory → decision): if a preloaded pitfall (Step 3 load) flagged a
category issue in this feature or a **dependency** (e.g. a signal-leak or `_process` bottleneck), add
the matching lens even when the feature-signal heuristics alone would not — past incidents in nearby
code are a strong signal. Note it in `autoDecisions`.

## Step 4b — Plan-approval gate — the go/no-go before build (only when `defineNeeded`)

The single up-front human go/no-go for the whole run, and the point where `feature.json` is
**written** — not before. We are **already in plan mode** (entered at Step 2b), so there is no
`EnterPlanMode` here. Define authored the complete draft in memory, Step 3 added `playtestProfile`,
Step 4 derived the technique plan. Now the draft becomes the plan-file appendix, the user **accepts**,
and only then does the extract write `feature.json` + run the sync. This is game-ship's own
consolidated gate — one review surface for the whole plan. It always runs (no env-var opt-out).

> **`defineNeeded == false`** (Step 1 DEFINED branch) → **skip this whole step**: `feature.json`
> already exists (a prior run accepted the gate), no plan mode was entered, nothing to re-approve.
> Go straight to Step 5.

**Steps:**

1. **Write the plan file** (path from Step 2b) — two parts, per `game-define/SKILL.md` PHASE 3:
   - **Review surface** — a concise, readable summary: feature name + type + one-line intent;
     `requirements[]` with their `acceptance[]` scenarios (`when → then`); architecture (scene tree,
     signals, resources) / `buildSequence`; **for features with a scene layout the ASCII sceneLayout
     sketch** (this is the design review — it replaces the removed inline layout-confirm); the Step 3
     "Playtest profile" line (~N GUT-covered, ~N playtest); the auto-derived technique plan
     (`refactorLenses`). Then any **proposal sections** the draft carries, each with its default
     action stated (accept applies it; reject-feedback can drop just that one): `## Proposed seed
update` (from the Seed Alignment Check), `## Backlog impact` (obsoleted/adjusted cards from the
     Backlog Impact Check), and on a split `## Feature split` (clusters + build order). Close with:
     "Accept → build starts (PHASE 1); the proposals above are applied. Reject → back into the define
     interview to revise (tell me what to change)."
   - **`## Appendix — machine contract (skip review)`** — the complete `featureDraft` (incl.
     `playtestProfile`) as a single ```json block, **compact single-line JSON (no indentation)** —
     halves the token cost of the plan-file echo. This is what the extract reads on Accept.
2. **`ExitPlanMode`** to present it for approval (this exits plan mode; the session returns to its
   prior permission mode).
   - **Accept** → writes are allowed again; run define's hoisted PHASE 4+5 now:
     (a) `node ~/.claude/scripts/feature-from-plan.js <plan-file> .project/features/{feature}/feature.json`
     writes `feature.json` from the appendix;
     (b) run define's PHASE 5 sync (backlog `status: "DEFINED"` with `auto: true`, project.json,
     project-context.json — per `game-define/references/phase5-sync.md`), **applying the plan-file
     proposals** the user did not reject: seed update, backlog-impact mutations, and — on a split — the
     `00-split.md` write + sub-feature `mkdir`s (all deferred out of plan mode to here);
     (c) re-set `transition: "shipping"` (Step 2a) and rewrite the live signal **without** the
     `waiting` field (`echo '{"skill":"define"}' | node ~/.claude/scripts/ship-checkpoint.js signal {feature}`).
     Then continue to Step 5 → Step 6 → build.
   - **Reject** → the session **stays in plan mode** with the user's feedback (native plan-mode
     behaviour — no re-`EnterPlanMode`). Revise the in-memory draft, **re-asking only what the
     feedback touches** (e.g. reopen one scene-layout fork, adjust one requirement) — do not re-run the
     whole interview. Re-run Step 3 (reclassify) + Step 4 (re-derive) if the change affected them,
     rewrite the plan file, and `ExitPlanMode` again. Loop until accepted (mirrors `game-debug`'s
     plan-rejection-revises pattern).

**Resume note.** Between Step 2b (`EnterPlanMode`) and Accept, the draft lives **only in memory + the
plan file** — plan mode blocks the `.project/` write that would checkpoint it, and the plan file's
harness-generated name is not linked to the feature, so it is not reliably discoverable cross-session.
Consequently: a **same-session** interruption keeps the draft (plan mode + the plan file persist in
the session — just continue). A **cross-session** death anywhere in the define/plan-mode block (the
checkpoint reads `phase: "PHASE 0 · define"`, `plan: {}`) means the interview **re-runs** on resume —
the accepted cost of moving the thinking onto the planning model. Once Accept writes `feature.json`,
that file is the durable home and Step 5's checkpoint patch makes the rest resumable normally.

## Step 5 — Store the derived plan in memory + advance the checkpoint

Carry to the later phases (in-context; `feature.json` now exists — written at accept, or already
present on the DEFINED branch):

```
SHIP_PLAN (auto-derived — no user choice):
  feature:        {feature-name}
  refactorLenses: [Quality, Reuse, Performance, ...]   # every lens the signals warrant (Step 4 table)
  playtestProfile: { covered, manual, manualTitles }   # advisory (Step 3)
  godotExecutable: {resolved absolute path}             # from Step 6 resolution
```

PHASE 4's refactor agent **always runs** (it returns `clean` when nothing meets the high-confidence,
GUT-test-guarded bar — there is no pre-build skip or intensity toggle).

**Escape hatch** (optional, power-user): a `--no-refactor` skill arg overrides the derivation.
Default is fully automatic — do not prompt.

**Persist to the checkpoint** — **patch** the minimal checkpoint that already exists from Step 2a
(SHIP-CHECKPOINT.md write point 1; use the node patcher, not a fresh heredoc). Advancing `phase` to
`"PHASE 1"` here means "plan approved, building". Set the formalized `plan` (the checkpoint's `plan`
was `{}` — no `featureDraft` was ever written, so there is nothing to null): `plan: {SHIP_PLAN +
playtestProfile}`. Persisting `SHIP_PLAN` + `playtestProfile` lets a resume skip re-deriving them.
Patch the changed keys: `phase: "PHASE 1"`, `completedPhases: ["PHASE 0"]`, `plan: {SHIP_PLAN +
playtestProfile}`. The `pipeline`, `feature`, `startedAt`, `baselineSha`, and empty
`results`/`prompts`/`activeWorkflow` were set at write point 0.

## Step 6 — Resolve `{godot_executable}` + assemble `SHIP_CONTEXT` (the context-hub)

**Resolve `{godot_executable}` first** (once, for the whole run): env var `CLAUDE_GODOT_EXECUTABLE`
→ `.claude/paths.local.yaml` → `skills/project-add/paths.yaml` per platform (canonical defaults:
macOS `/Applications/Godot.app/Contents/MacOS/Godot`, Windows `C:\Godot\Godot_v4.4.1-stable_win64.exe`,
Linux `/usr/bin/godot4`). This resolved path **must be injected into every agent slice** so each
agent can run GUT headless without re-resolving.

The main chat loads project context **once** here and feeds it to every agent, so each agent skips
its own redundant PHASE 0 bootstrap and reasons on the same context the main chat did. Build the
block from the external shared loaders (`shared/` stays external — read in place):

> **Reuse define's load — don't double-load.** If define ran inline this session (Step 2c), the main
> chat already ran `GAME-CONTEXT-LOAD` + `LEARNINGS-LOAD` in-context for the interview. **Reuse the
> stable dimensions** from that load (stack, entities, structure, patterns[], architecture/scene
> graph) — do **not** re-invoke the loaders for them. **Refresh only the mutable delta define's hoisted
> PHASE 5 sync just wrote** at accept: `learnings`, `architecture`, and `feature.json#files[]` (which
> only exists after accept). **If define was skipped** (Step 1 — feature already ≥ DEFINED, nothing
> loaded in-context), do the **full** load below fresh.

The bullets below are the full-load form (used when define was skipped, and as the shape of each part):

- `node ~/.claude/scripts/context-load.js "$REPO" game-build` (see [shared/GAME-CONTEXT-LOAD.md](.claude/skills/shared/GAME-CONTEXT-LOAD.md)) → stack, entities, structure, patterns[],
  full architecture (componentTree, scenes, signals, resources). _(Reuse from Step 2c when define
  ran — stable dimensions.)_
- `shared/LEARNINGS-LOAD.md` — scopes `[component]` + `pitfall-prefix: true`, `current-feature:
{feature-name}` → the last pitfalls + component-relevant patterns (max 5). _(Mutable — re-run to
  pick up learnings define just wrote, even when define ran.)_
- Discover this feature's files via `feature.json#files[]` → a categorized `<reference-paths>` block
  (paths, **not** content — per `shared/SKILL-PATTERNS.md#pass-paths-not-content`). _(Only exists
  after define — always read here.)_

```
SHIP_CONTEXT (assembled here; each PHASE 1/2/4 agent receives its per-agent slice — see the
table below):
  feature:        {feature-name}
  godot:          {godot_executable — resolved absolute path, injected into EVERY slice}
  stack:          {from GAME-CONTEXT-LOAD build profile}
  structure:      {structure · patterns[] · scene graph}
  paths:          <reference-paths> from feature.json#files[]
  decisions:      SHIP_PLAN (lenses) + playtestProfile
  learnings:      {max 5 pitfalls/patterns from LEARNINGS-LOAD}
  worktree:       {absolute path — filled after PHASE 1; empty until then}
```

Keep `SHIP_CONTEXT` in memory. The subagent-adapter (rule 5) tells each agent to use it instead of
re-running the workflow's PHASE 0 loaders.

### Per-agent slices (don't pass the whole block to everyone)

Send each agent only the slice it needs — "the right context for the task". All slices share
`feature`, `stack`, **and `godot`** (every agent runs GUT); the build/verify/refactor slices all
carry `worktree` — AGENT 3 runs **pre-merge inside `worktree-{feature}`** (the finalize/merge is the
main chat's PHASE 4 tail, after refactor), so it needs the worktree path plus `finalizeRoute` (see
`agent-refactor.md`). They differ in the rest:

| Slice                        | Adds on top of the shared header (feature · stack · godot)                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **build-slice** (AGENT 1)    | `architecture` (scene tree, signals, resources) · `buildSequence` · `conventions` · `paths` · learnings filtered to **build** pitfalls · `worktree`                       |
| **verify-slice** (AGENT 2)   | `acceptance[]` + `testStrategy` · `playtestProfile` · `paths` · learnings filtered to **test/regression** pitfalls · `worktree` (less architecture)                       |
| **refactor-slice** (AGENT 3) | built `files[]` · `conventions` + coding-rules scope · reuse-candidates · `SHIP_PLAN` lenses · learnings filtered to **refactor** pitfalls · `worktree` + `finalizeRoute` |

Each agent's **pointer file** (per `agent-*.md` § Spawn) carries its own slice as the CONTEXT block;
the pointer-file **paths** travel to the agents as the **Workflow `args` payload**
(`buildPromptPath`/`verifyPromptPath` for Workflow 1, `refactorPromptPath` for Workflow 2 — see
`SKILL.md` PHASE 1+2/4). The static instruction bodies live in `references/prompts/*` and the agents
read them (plus `non-interactive-contract.md`) themselves. Mutable-part freshness: the **verify**
slice is assembled pre-build, so its prompt instructs AGENT 2 to refresh learnings/architecture/
`files[]` from `.project/` itself (see `agent-verify.md`); the **refactor** slice is rebuilt by the
main chat from the post-verify `.project/` (shared into the worktree via symlinks) just before
Workflow 2 launches.
