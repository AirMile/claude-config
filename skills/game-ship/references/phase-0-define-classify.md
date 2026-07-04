# PHASE 0 — Define + Classify + Auto-derive technique plan

The one up-front interactive phase. All up-front human decisions are front-loaded here; everything
after runs hands-off until the live playtest in PHASE 3.

## Step 0 — Checkpoint-resume detection + preflight

Before resolving the feature, Read `.claude/skills/shared/SHIP-CHECKPOINT.md` and run its resume
detection against `.project/session/ship-{feature}.json` (use the resolved arg for `{feature}`; if
`/game-ship` was called with no arg, first resolve the name via Step 1, then run this check):

- **Open checkpoint found** (`status != "complete"`) → present the Resume / Restart / Inspect
  `AskUserQuestion` from SHIP-CHECKPOINT.md. First check `pipeline`: a `pipeline: "game"` checkpoint
  resumes here; a `"dev"`/`"design"` checkpoint is redirected to the matching skill.
  - **Resume** → run orphan/leak cleanup, load `plan` (→ `SHIP_PLAN`) + `results` from the
    checkpoint (worktree path/branch live in `results.build`), re-derive `SHIP_CONTEXT` fresh
    (Step 6), re-seed the 6-phase `TaskCreate` list (completed phases → `completed`), and **jump to
    the recorded `phase`** (skip the rest of PHASE 0). This is the credits-op / crash recovery path.
  - **Restart** → archive the old checkpoint + clean the orphan worktree, then continue PHASE 0
    fresh below.
  - **Inspect** → print checkpoint + worktree status, re-ask.
- **No open checkpoint** → run the **preflight checks** (dirty working tree, colliding
  `worktree-{feature}` from a prior aborted run without a checkpoint), surface any notice, then
  continue to Step 1.

On a fresh run, capture the rollback anchor now: `baselineSha = git rev-parse HEAD`. It is written
to the checkpoint in Step 5.

## Step 1 — Resolve the feature

Resolve `feature-name` exactly as `game-define` PHASE 0 does (arg → backlog `transition` match →
first TODO → concept → open question), with one game-ship-specific addition **before** the
define-style transition match: a feature with `transition: "shipping"` (queued via the board's
⚡ Ship (auto) menu item) wins the no-arg resolution. Then check
`.project/features/{feature-name}/feature.json`:

- **Exists with `status` ≥ DEFINED** (has `requirements[]` + `architecture`) → define already ran;
  skip to Step 3 (classify). Do not re-run define.
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
3. **No plan mode** (adapter rule 2). **Never** call `EnterPlanMode`/`ExitPlanMode` — run define's
   PHASE 0→3 analytical/interview steps directly, in the main chat. Ignore every "Enter Plan Mode
   NOW" / "plan mode must be active before …" / "write to the plan file" / "Exit plan mode"
   instruction in the vendored define workflow. `/game-ship` must **never** surface a plan-mode
   screen or a plan-approval gate. Two define behaviours that plan mode used to carry are preserved
   without it: **(a) write-gating** — all `.project/{backlog,project,project-context}.json` writes
   still wait until PHASE 5's sync batch (do not write them early just because the plan-mode block is
   gone); **(b) the architecture design** (scene tree, scripts, signals, resources, test strategy,
   buildSequence) is authored **in-context** during define's PHASE 2b/3 and transcribed straight into
   `feature.json` at PHASE 4 — hold it in memory instead of writing it to a plan file. No plan file
   is created. The PHASE 2b scene-layout `AskUserQuestion` and the PHASE 3 Seed-Alignment /
   Backlog-Impact `AskUserQuestion`s still run (they reach the real user; plan mode was only ever a
   routing wrapper).
4. **Spec preview STAYS** (this is the one place define's HTML preview runs — define is inline in the
   main chat, so the browser is reachable here; adapter rule 8's "no browser" applies only to the
   spawned subagents). Instead of define's stock scene-layout-only preview, game-ship renders an
   **adaptive feature-spec preview** so the user sees what is about to be built before the hands-off
   pipeline starts (it visually replaces the plan-approval gate removed in deviation 3). See Step 2c.
5. **Backlog write STAYS** (adapter rule 13). Define still flips `feature.json` + `backlog.json` to
   `status: "DEFINED"` (no stage — waiting for build) — PHASE 1's build reads DEFINED, so this
   transition is required, not dead.
6. When define finishes the DEFINED write, continue to Step 2b then Step 2c (preview) then Step 3 —
   do not end the skill.

**Kept as-is** (define is NOT a silent subagent): `AskUserQuestion` reaches the real user (the whole
reason define is the main-chat touchpoint), and define's interview + write-gating discipline run as
normal — just **without** the plan-mode wrapper (deviation 3). Everything else in define runs
unchanged (it owns its own `.project/` writes).

## Step 2b — Board state: `shipping` marker + live signal

The backlog board renders two progress states: **queued** (`transition` set by a board copy
action) and **live** (`.project/session/active-{feature}.json`, pulsing badge). game-ship owns both
for the whole run:

1. **Live signal** — if define was skipped (Step 1: already ≥ DEFINED), write it now; when define
   ran inline it already wrote and cleaned its own signal, so re-arm it here either way:

   ```bash
   mkdir -p .project/session
   echo '{"feature":"{feature-name}","skill":"define","startedAt":"{ISO}"}' > .project/session/active-{feature-name}.json
   ```

   The later SKILL.md phase boundaries rewrite this same file with `skill: build | test |
refactor` — the board badge follows the pipeline.

2. **Run marker** — set `transition: "shipping"` on the feature's `backlog.json` entry (define's
   phase5-sync removes any transition; re-set it after define completes). This keeps the card in
   the board's IN PROGRESS section between phases, when no agent is running. It is removed by
   refactor's completion-batch (feature shipped) or by PHASE 5 cleanup on every other exit path.

## Step 2c — Present the feature-spec preview (main chat, auto-open browser)

game-ship is hands-off after this phase and (per Step 2 deviation 3) shows no plan-approval gate — so
give the user one visual confirmation of **what is about to be built** before the pipeline runs
autonomously. This runs in the main chat (browser reachable) and is **non-blocking**: a launch
failure prints the path, never halts. Skip entirely (no error) if the resolved `feature.json` has no
`requirements[]` yet (should not happen post-define).

Assemble the `preview-data` payload from the just-written `feature.json` (adaptive — include only
the fields that exist):

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

> **Todo**: render `.claude/skills/shared/references/preview-feature-spec.html` to
> `.project/previews/game-ship-{feature-name}.html` (fill the `preview-data` JSON block with the
> payload above), then present that `file://` path via `.claude/skills/shared/HTML-PRESENT.md`
> (auto-opens in the browser; `CLAUDE_AUTO_PREVIEW=0` opts out). One preview per run. The textual
> "Playtest profile" line (Step 3) still prints — the preview is the visual layer on top, not a
> replacement.

## Step 3 — Compute the advisory playtest classification

Classify each `acceptance[]` scenario as COVERED (a GUT unit test will verify it) or MANUAL
(requires a human playtest), mirroring `game-verify`'s checklist-classification concept and
`game-build`'s TDD-vs-Implementation-Only decision logic. Inputs are already on disk after define:
`feature.json#requirements[].acceptance[]` (each `{ when, then, category }`), `feature.type`, and the
architecture (scenes/signals/scripts).

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

Write the estimate to `feature.json#playtestProfile`:

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

| Signal in feature.json                                           | Derive                                                  |
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

## Step 5 — Store the derived plan in memory + checkpoint

Carry to the later phases (in-context, no extra `.project/` write beyond `playtestProfile`):

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

**Persist to the checkpoint** (the first write, per `shared/SHIP-CHECKPOINT.md` atomic-write). This
makes the run resumable — persisting `SHIP_PLAN` + `playtestProfile` lets a resume skip re-deriving
them. Write `.project/session/ship-{feature}.json` with `pipeline: "game"`, `feature`,
`startedAt`/`updatedAt`, `status: "running"`, `phase: "PHASE 1"`, `completedPhases: ["PHASE 0"]`,
`baselineSha` (from Step 0), `plan: {SHIP_PLAN + playtestProfile}`, empty `results`/`prompts`,
`activeWorkflow: null`.

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
> graph) — do **not** re-invoke the loaders for them. **Refresh only the mutable delta define itself
> just wrote** in its PHASE 5 sync: `learnings`, `architecture`, and `feature.json#files[]` (which
> only exists after define). **If define was skipped** (Step 1 — feature already ≥ DEFINED, nothing
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
`feature`, `stack`, **and `godot`** (every agent runs GUT); the build/verify slices also carry
`worktree`, but the **refactor slice does not** — AGENT 3 runs on `main` after PHASE 3 finalize
removed the worktree (leave `worktree` empty there). They differ in the rest:

| Slice                        | Adds on top of the shared header (feature · stack · godot)                                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| **build-slice** (AGENT 1)    | `architecture` (scene tree, signals, resources) · `buildSequence` · `conventions` · `paths` · learnings filtered to **build** pitfalls · `worktree` |
| **verify-slice** (AGENT 2)   | `acceptance[]` + `testStrategy` · `playtestProfile` · `paths` · learnings filtered to **test/regression** pitfalls · `worktree` (less architecture) |
| **refactor-slice** (AGENT 3) | built `files[]` · `conventions` + coding-rules scope · reuse-candidates · `SHIP_PLAN` lenses · learnings filtered to **refactor** pitfalls          |

Each agent's **pointer file** (per `agent-*.md` § Spawn) carries its own slice as the CONTEXT block;
the pointer-file **paths** travel to the agents as the **Workflow `args` payload**
(`buildPromptPath`/`verifyPromptPath` for Workflow 1, `refactorPromptPath` for Workflow 2 — see
`SKILL.md` PHASE 1+2/4). The static instruction bodies live in `references/prompts/*` and the agents
read them (plus `non-interactive-contract.md`) themselves. Mutable-part freshness: the **verify**
slice is assembled pre-build, so its prompt instructs AGENT 2 to refresh learnings/architecture/
`files[]` from `.project/` itself (see `agent-verify.md`); the **refactor** slice is rebuilt by the
main chat from the post-merge `.project/` just before Workflow 2 launches.
