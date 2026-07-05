# PHASE 0 — Define + Classify + Auto-derive technique plan

The one up-front interactive phase. All up-front human decisions are front-loaded here; everything
after runs hands-off until the live playtest in PHASE 3.

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
entry`; `PHASE 0 · plan gate` → Step 4b, restoring `plan.featureDraft`; a workflow phase → its
  On-"Resume" step 4 relaunch). A **Restart** choice continues fresh below.
- **No open checkpoint** → run the **preflight checks** (dirty working tree, colliding
  `worktree-{feature}` from a prior aborted run without a checkpoint; per `SHIP-CHECKPOINT.md
§ Preflight`), surface any notice, then continue to Step 1.

On a fresh run, capture the rollback anchor now: `baselineSha = git rev-parse HEAD`. It is written
to the checkpoint in Step 5.

## Step 1 — Resolve the feature

Resolve `feature-name` exactly as `game-define` PHASE 0 does (arg → backlog `transition` match →
first TODO → concept → open question), with one game-ship-specific addition **before** the
define-style transition match: a feature with `transition: "shipping"` (queued via the board's
⚡ Ship (auto) menu item) wins the no-arg resolution. Then check
`.project/features/{feature-name}/feature.json`:

- **Exists with `status` ≥ DEFINED** (has `requirements[]` + `architecture`) → the plan gate was
  **already accepted in a prior run**. `feature.json` is written only at gate-accept now (Step 4b), so
  its presence unambiguously means "past the gate." Skip both define **and** the gate: go to Step 3
  (re-derive the plan — classify + technique are deterministic from `feature.json`) → build. This is
  the resume-recovery path for the narrow window where a prior run accepted the gate but stopped
  before the light checkpoint advanced past it. (Once the checkpoint exists — the usual case — Step 0's
  direct resume catches it first.)
- **Missing / not yet DEFINED** → Step 2 (run define inline).

## Step 2 — Run `game-define` inline (main chat, interactive)

Execute the full `game-define` workflow by reading
`.claude/skills/game-ship/references/game-define/SKILL.md` and following it PHASE 0 → PHASE 5
(interview, requirements, architecture, feature.json + sync). This is the interactive part — the
user answers define's questions here.

**Deviations from stock define.** Define is the one place the user is interviewed, so — unlike the
spawned agents — it runs **inline in the main chat** and the subagent-adapter is **not** applied
wholesale (define keeps `AskUserQuestion`). But these adapter-aligned deviations DO apply, because
game-ship already owns the run:

1. **No own phase tracking** (adapter rule 1). game-ship's 6-phase `TaskCreate` list is already
   active. Do **not** call define's own `TaskCreate`/`TaskUpdate` (its "first action of the skill:
   call TaskCreate with these 3 items") — following that would clobber game-ship's task list. Track
   define's phases in prose instead.
2. **No terminal handoff** (adapter rule 4). Skip define's Next-Step Clipboard Offer
   (`NEXT-STEP-OFFER.md`) and its `Next: /game-build` / clipboard output. game-ship continues to
   Step 3 itself.
3. **Define's own plan-mode wrapper is stripped; its writes are hoisted to the gate** (adapter rule
   2). **Never** call `EnterPlanMode`/`ExitPlanMode` _inside_ define's PHASE 0→3 analytical/interview
   steps — run them directly, in the main chat. Ignore every "Enter Plan Mode NOW" / "plan mode must
   be active before …" / "write to the plan file" / "Exit plan mode" instruction in the vendored
   define workflow. The interview stays inline so `AskUserQuestion` keeps reaching the real user
   (define is **not** "auto" — that word describes the hands-off build/verify/refactor phases, never
   define).

   In auto-mode, define runs **only its PHASE 0→3** here: the interview, architecture, and authoring
   the **complete feature.json draft** (requirements + acceptance, scene tree, scripts, signals,
   resources, test strategy, buildSequence, `tuningLevers`/`errorScenarios`). That draft is held **in
   memory** — do **not** write `feature.json`, and do **not** run define's PHASE 4 (write) or PHASE 5
   (sync) yet. Define's PHASE 4+5 are **hoisted to gate-accept** (Step 4b): on Accept the draft
   becomes the plan-file appendix, `feature-from-plan.js` writes `feature.json` from it, and define's
   PHASE 5 sync runs. So the whole run goes through the same plan-file + appendix + accept flow as
   stock define — the approved plan **is** the contract, and no `feature.json` exists before you
   accept. Two define behaviours plan mode used to carry are preserved without it: **(a) write-gating**
   — all `.project/{backlog,project,project-context}.json` writes wait until the accept-time sync
   (Step 4b), not PHASE 5; **(b) the machine contract** is authored in-context during PHASE 2b/3,
   exactly as above, just held as a draft rather than written. The PHASE 2b scene-layout
   `AskUserQuestion` and the PHASE 3 Seed-Alignment / Backlog-Impact `AskUserQuestion`s still run
   (they reach the real user; plan mode was only ever a routing wrapper).

   **The single plan-approval gate** is game-ship's own consolidated `EnterPlanMode` → `ExitPlanMode`
   at the very **end** of PHASE 0 (Step 4b), after define + classify + technique derivation — one
   review surface for the whole feature plan before the hands-off pipeline starts (the Step 2c preview
   is only a visual aid on top). See Step 4b.

4. **Spec preview is conditional — visual aid only** (this is the one place define's HTML preview
   can run — define is inline in the main chat, so the browser is reachable here; adapter rule 8's
   "no browser" applies only to the spawned subagents). Instead of define's stock scene-layout-only
   preview, game-ship renders an **adaptive feature-spec preview** — but **only when the feature has a
   visual scene layout to show** (`feature.design.sceneLayout`). It is a visual layer on top of the
   Step 4b plan-approval gate, **not** a replacement for it: the gate is the review surface, the
   preview just helps the user see the scene. Games are visual, so this condition fires more often
   than in dev-ship — but when there is no `sceneLayout` the preview is skipped entirely (no error).
   See Step 2c.
5. **Backlog DEFINED flip moves to accept** (adapter rule 13). Define does **not** flip `feature.json`
   - `backlog.json` to `status: "DEFINED"` during Step 2 — that flip is part of define's hoisted
     PHASE 4+5 and happens at **gate-accept** (Step 4b), alongside `feature.json` being written. PHASE 1's
     build reads DEFINED, so the transition is still required — just deferred until after you accept.
     Benefit: a rejected-and-abandoned define leaves **no** orphan `DEFINED` card with no build behind it.
6. After define finishes authoring the draft (PHASE 0→3), **write the light checkpoint now**
   (SHIP-CHECKPOINT.md write point 0): `.project/session/ship-{feature}.json` with `pipeline: "game"`,
   `feature`, `startedAt`/`updatedAt`, `status: "running"`, `phase: "PHASE 0 · plan gate"`,
   `completedPhases: []`, `baselineSha` (from Step 0), empty `results`/`prompts`,
   `activeWorkflow: null`, and `plan: { featureDraft: <the in-memory draft> }`. The `featureDraft` is
   the **durable pre-accept home** for the draft (no `feature.json` exists yet) — it makes the gate
   resumable from a fresh session without re-running the interview (same pattern design uses for its
   deferred spec; see SHIP-CHECKPOINT.md). This is the last write slot before the plan gate (plan mode
   blocks `.project/` writes) and the board shows it parked. Then continue to Step 2b then Step 2c
   (preview) then Step 3 — do not end the skill.

**Kept as-is** (define is NOT a silent subagent): `AskUserQuestion` reaches the real user (the whole
reason define is the main-chat touchpoint), and define's interview + write-gating discipline run as
normal — just **without** the plan-mode wrapper and with its PHASE 4+5 hoisted to gate-accept
(deviation 3). Everything else in define's PHASE 0→3 runs unchanged.

## Step 2b — Board state: `shipping` marker + live signal

The backlog board renders two progress states: **queued** (`transition` set by a board copy
action) and **live** (`.project/session/active-{feature}.json`, pulsing badge). game-ship owns both
for the whole run:

1. **Live signal** — write (or re-arm) it now, whether define was skipped (Step 1: already ≥ DEFINED)
   or ran inline (its PHASE 5 signal-cleanup is hoisted to accept, so re-arm here either way):

   ```bash
   mkdir -p .project/session
   echo '{"feature":"{feature-name}","skill":"define","startedAt":"{ISO}"}' > .project/session/active-{feature-name}.json
   ```

   The later SKILL.md phase boundaries rewrite this same file with `skill: build | test |
refactor` — the board badge follows the pipeline.

2. **Run marker** — set `transition: "shipping"` on the feature's `backlog.json` entry. This keeps
   the card in the board's IN PROGRESS section between phases, when no agent is running. (Define's
   PHASE 5 sync, which would clear the transition, is hoisted to accept; Step 4b re-sets `shipping`
   after that sync runs.) It is removed by refactor's completion-batch (feature shipped) or by PHASE 5
   cleanup on every other exit path.

## Step 2c — Present the feature-spec preview (conditional: only when there is a scene layout)

The plan-approval gate (Step 4b) is the review surface; this preview is **only a visual aid** for
features with a scene to show. **Condition — render the preview only when** the feature has a
`design.sceneLayout` field. Without one there is nothing visual, so **skip the preview entirely** (no
error) — expected, not a deviation. Also skip if the in-memory draft has no `requirements[]` yet
(should not happen post-define).

When it does run: it is in the main chat (browser reachable) and **non-blocking** — a launch failure
prints the path, never halts; `CLAUDE_AUTO_PREVIEW=0` opts out. It renders **before** the Step 4b
gate so the user can see the scene while approving the plan. The Step 3 "Playtest profile" line still
prints regardless.

Assemble the `preview-data` payload from the in-memory feature draft (adaptive — include only
the fields that exist; `feature.*` below refers to that draft, not a file on disk):

```
{
  "feature":       "{feature-name}",
  "type":          feature.type,
  "status":        "DEFINED",
  "requirements":  feature.requirements[] → [{ id, text }],
  "acceptance":    flattened requirements[].acceptance[] → [{ when, then }],
  "wireframe":     feature.design.sceneLayout (ASCII scene sketch) — omit when absent,
  "buildSequence": feature.architecture.buildSequence[] → [{ step, dependsOn }] — omit when absent
}
```

> **Todo** (only when the `sceneLayout` condition above holds): render
> `.claude/skills/shared/references/preview-feature-spec.html` to
> `.project/previews/game-ship-{feature-name}.html` (fill the `preview-data` JSON block with the
> payload above), then present that `file://` path via `.claude/skills/shared/HTML-PRESENT.md`
> (auto-opens in the browser; `CLAUDE_AUTO_PREVIEW=0` opts out). One preview per run. The textual
> "Playtest profile" line (Step 3) still prints — the preview is the visual layer on top, not a
> replacement.

## Step 3 — Compute the advisory playtest classification

Classify each `acceptance[]` scenario as COVERED (a GUT unit test will verify it) or MANUAL
(requires a human playtest), mirroring `game-verify`'s checklist-classification concept and
`game-build`'s TDD-vs-Implementation-Only decision logic. Inputs come from the **in-memory draft**
(feature.json is not written until accept): `requirements[].acceptance[]` (each `{ when, then,
category }`), `type`, and the architecture (scenes/signals/scripts).

Short form of the classifier (defer to
`.claude/skills/game-ship/references/game-verify/references/checklist-classification.md` for edge
cases — that file is the authoritative COVERED/MANUAL definition AGENT 2 uses at verify-time):

- **COVERED** — deterministic, GUT-verifiable: game logic/calculations, damage/stat formulas, state
  transitions, signal flows, node config, scene-tree construction, resource creation, exported
  values. No human judgment. (These get a GUT test in game-build.)
- **MANUAL** — only when human perception/judgment is truly required: gameplay feel ("feels
  responsive/fun"), visual quality, particle/animation polish, audio, cross-requirement gameplay
  scenarios experienced live. (These need the PHASE 3 playtest.)

**Pitfall-informed bias** (memory → decision). Load preloaded pitfalls now via
`shared/LEARNINGS-LOAD.md` (scopes `[component]` + pitfall-prefix, including **direct dependencies**)
— this same load feeds Step 6, so do it once here. If a pitfall shows a related/dependency feature
**needed manual playtest** for a similar acceptance (e.g. "knockback feel needed a live playtest"),
lean that item toward MANUAL even if the rules say COVERED. Note the bias in `autoDecisions`.

Add the estimate to the draft's `playtestProfile` (it rides into the plan-file appendix at Step 4b
and lands in feature.json at accept; feature.json is not written here). Also patch it into the light
checkpoint's `plan.featureDraft.playtestProfile` so a resume-at-gate keeps it:

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

## Step 4b — Plan-approval gate (plan mode) — the go/no-go before build

The single up-front human go/no-go for the whole run, and the point where `feature.json` is
**written** — not before. Define authored the complete draft (in memory, stashed in the checkpoint's
`plan.featureDraft`), Step 3 added `playtestProfile`, Step 4 derived the technique plan. Now the draft
becomes the plan-file appendix, the user **accepts**, and only then does the extract write
`feature.json`. This is game-ship's own consolidated gate — one review surface for the whole plan. It
always runs (no env-var opt-out): the whole PHASE 0 is main-chat interactive anyway, so the gate adds
no new blocker a headless run wouldn't already hit at the define interview.

**Ordering — why the gate is here.** It runs **after** Step 2c's optional preview (so the user can
see the scene while approving) and after classify + technique derivation (so the plan is complete). No
`feature.json` / backlog / project writes have happened yet — they are all deferred to Accept below,
so entering plan mode now blocks nothing that was going to run before it.

**Steps:**

1. **Signal the board is waiting, and ensure the light checkpoint exists.** Do both **before**
   `EnterPlanMode` — writes are blocked once in plan mode.
   - Rewrite the live signal with a `waiting` field so the board shows the run paused for input (per
     `shared/DEVINFO.md`): rewrite `.project/session/active-{feature}.json` adding
     `"waiting": "plan-review"`.
   - **Light checkpoint:** it normally already exists (Step 2 deviation 6 wrote it with
     `plan.featureDraft`). Only if it does **not** exist yet — the resume-recovery case where Step 1's
     DEFINED branch fired (a prior run already accepted, `feature.json` on disk) — reconstruct the
     draft from `feature.json` and write the checkpoint now (SHIP-CHECKPOINT.md write point 0). If it
     already exists, just touch `updatedAt`. Either way the gate is resumable.
2. **`EnterPlanMode`.** You receive the plan-file path via system-reminder.
3. **Write the plan file** — two parts, per `game-define/SKILL.md` PHASE 3 (same shape as stock
   define):
   - **Review surface** — a concise, readable summary: feature name + type + one-line intent;
     `requirements[]` with their `acceptance[]` scenarios (`when → then`); architecture (scene tree,
     signals, resources) / `buildSequence`; the Step 3 "Playtest profile" line (~N GUT-covered, ~N
     playtest); the auto-derived technique plan (`refactorLenses`); a closing line: "Accept → build
     starts (PHASE 1). Reject → back to the define interview to revise."
   - **`## Appendix — machine contract (skip review)`** — the complete `featureDraft` (incl.
     `playtestProfile`) as a single ```json block. This is what the extract reads on Accept.
4. **`ExitPlanMode`** to present it for approval.
   - **Accept** → run define's hoisted PHASE 4+5 now: (a)
     `node ~/.claude/scripts/feature-from-plan.js <plan-file> .project/features/{feature}/feature.json`
     writes `feature.json` from the appendix; (b) run define's PHASE 5 sync (backlog `status: "DEFINED"`,
     project.json, project-context.json — per `game-define/references/phase5-sync.md`), and re-set
     `transition: "shipping"` (Step 2b); (c) rewrite `active-{feature}.json` **without** the `waiting`
     field. Then continue to Step 5 (checkpoint patch) → Step 6 → build.
   - **Reject** → return to the define interview to revise: re-run **Step 2** (`game-define` inline)
     from the in-memory draft (still no `feature.json` on disk) — the user restates/adjusts
     requirements + architecture and define re-authors the draft. Then re-run Step 3 (reclassify),
     Step 4 (re-derive), and re-present this gate. Loop until accepted (mirrors `game-debug`'s "plan
     rejection lets the user revise" pattern).

**Resume note.** The **light checkpoint** at this gate (`phase: "PHASE 0 · plan gate"`, written in
Step 2 deviation 6) holds the `featureDraft`. If the session ends while the gate is open, a
fresh-session `/game-ship {feature}` direct-resumes it (Step 0 fast path) straight back to this gate —
restoring the draft from `plan.featureDraft` and re-writing the appendix, **no interview re-run**
(`feature.json` does not exist yet, so there is nothing to reconstruct from disk). Step 1's DEFINED
branch is the separate path for a prior run that already **accepted**. The board shows the feature
parked (`plan approval pending`) the whole time.

## Step 5 — Store the derived plan in memory + checkpoint

Carry to the later phases (in-context; `feature.json` was just written at accept):

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

**Persist to the checkpoint** — **patch** the light checkpoint that already exists from Step 2
(SHIP-CHECKPOINT.md write point 1; use the node patcher, not a fresh heredoc). This runs **only after
the Step 4b gate is accepted** — advancing `phase` to `"PHASE 1"` here means "plan approved,
building". Replace the pre-accept `plan.featureDraft` with the formalized `plan`: now that
`feature.json` is on disk (written at accept), the draft is no longer the durable home. Persisting
`SHIP_PLAN` + `playtestProfile` lets a resume skip re-deriving them. Patch the changed keys:
`phase: "PHASE 1"`, `completedPhases: ["PHASE 0"]`,
`plan: {SHIP_PLAN + playtestProfile, "featureDraft": null}` — the explicit `featureDraft: null` drops
it (the patcher deep-merges `plan`, so it must be nulled, not just omitted). The `pipeline`, `feature`,
`startedAt`, `baselineSha`, and empty `results`/`prompts`/`activeWorkflow` were set at write point 0.

## Step 6 — Resolve `{godot_executable}` + assemble `SHIP_CONTEXT` (the context-hub)

**Resolve `{godot_executable}` first** (once, for the whole run): env var `CLAUDE_GODOT_EXECUTABLE`
→ `.claude/paths.local.yaml` → `skills/project-add/paths.yaml` per platform (canonical defaults:
macOS `/Applications/Godot.app/Contents/MacOS/Godot`, Windows `C:\Godot\Godot_v4.4.1-stable_win64.exe`,
Linux `/usr/bin/godot4`). This resolved path **must be injected into every agent slice** so each
agent can run GUT headless without re-resolving.

The main chat loads project context **once** here and feeds it to every agent, so each agent skips
its own redundant PHASE 0 bootstrap and reasons on the same context the main chat did. Build the
block from the external shared loaders (`shared/` stays external — read in place):

> **Reuse define's load — don't double-load.** If define ran inline this session (Step 2), the main
> chat already ran `GAME-CONTEXT-LOAD` + `LEARNINGS-LOAD` in-context for the interview. **Reuse the
> stable dimensions** from that load (stack, entities, structure, patterns[], architecture/scene
> graph) — do **not** re-invoke the loaders for them. **Refresh only the mutable delta define's hoisted
> PHASE 5 sync just wrote** at accept: `learnings`, `architecture`, and `feature.json#files[]` (which
> only exists after accept). **If define was skipped** (Step 1 — feature already ≥ DEFINED, nothing
> loaded in-context), do the **full** load below fresh.

The bullets below are the full-load form (used when define was skipped, and as the shape of each part):

- `shared/GAME-CONTEXT-LOAD.md` — run the **build** profile → stack, entities, structure, patterns[],
  full architecture (componentTree, scenes, signals, resources). _(Reuse from Step 2 when define
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
