# PHASE 5: Sync — Mutation Details

Read in parallel **directly before editing** (skip if not present) — do NOT rely on reads from earlier phases (Prettier/linters may have modified files in the meantime):

- `.project/backlog.json`
- `.project/project.json`
- `.project/project-context.json`

Mutate in memory:

## Backlog (see `shared/BACKLOG.md`)

- Find feature: `data.features.find(f => f.name === "{feature-name}")`
- Found → set `.status = "DEFINED"`, remove `.stage` and `.transition` (no stage in DEFINED column), remove `.note` if present (the park context is consumed — the interview surfaced it), and set `.date = "{current date}"`
- **POLISH promotion**: if the found entry carries `type: "POLISH"` (a `/game-tweak` escalation handed off — see `shared/TWEAK-DISCIPLINE.md` § Escalation gate), overwrite `type` with the type this define pass just classified, in the same write as `.status`/`.date` above. This is the one sanctioned exception to `shared/BACKLOG.md` § TWEAK cards' `TODO → shipped` invariant (POLISH shares that lifecycle): the card leaves it the moment it legitimately enters the ship pipeline, so it never sits as `type: "POLISH"` + `status: "DEFINED"`. Not a POLISH entry → leave `.type` untouched.
- Not found → add: `{ "name": "{feature}", "type": "FEATURE", "status": "DEFINED", "phase": "P4", "description": "{from feature.json summary}", "dependencies": [], "source": "/game-define" }`
- **Impact Check results** (only when PHASE 3 carried `backlogImpact[]` — same write-batch): apply each approved verdict per `shared/BACKLOG.md § Impact Check → Mutations`: `covered`/`obsolete` → `status: "CANCELLED"` + `cancelledReason: "superseded by {feature}: {ref}"` + `cancelledAt` + remove `transition`; `partial` → rewrite `description` to the remaining scope + add `{feature}` to that item's `dependencies[]`. `externalRef` items: no mutation — list them in the log line as report-only. Then log `Backlog: ✓ impact applied — {N} cancelled, {M} rescoped`.
- Set `data.updated` to current date

## Dashboard (see `shared/DASHBOARD.md`)

- **Data entities** (optional — only if feature introduces domain entities): for each entity check whether `data.entities` already has an entry with that name → no: push with fields/relations → yes: merge new fields. If feature has no entities (UI-only scene, pure gameplay, utility): skip, log `Skipped data.entities: no entities`.
- **Stack**: if Godot plugins/assets → check `stack.packages` by name → no: push `{ name, version, purpose }`
- **Features**: check by name → no: push `{ name, status: "DEFINED", summary, depends: [], created }` → yes: update status to `"DEFINED"`, remove `stage`
- **Architecture** in `.project/project-context.json`: generate/update if feature has a scene tree and/or signals. **Follow component-first model from `shared/DASHBOARD.md`**:
  - `layers`: define layers with `{ name, order }` (e.g. Scenes order 1, Systems order 2, Resources order 3)
  - `dataFlow`: one-line summary of the scene/signal flow
  - `components`: per component `{ name, layer, description, status, connects_to }`. Scene tree as components. `connects_to[]` as typed edges `{ to, type }` (`calls` for signal emits/method calls, `reads`/`writes` for shared state or autoloads, `depends_on` for scene-tree parent or resource references). All features DOING → `status: "planned"`, existing → `"done"`
  - Merge strategy: check whether component `name` already exists → no: push → yes: merge
  - Skip if feature is too small (single node without signals)

Write back in parallel:

- Edit `.project/backlog.json`
- Write `project.json` (stack, features, data)
- Write `project-context.json` (if architecture changed)

## Deferred architecture-baseline append

Only when PHASE 2 collected `pendingBaselineAppends` (research ran inside plan mode — the baseline write was deferred): append the new Feature Pattern Index row and any new signal/resource patterns to `.claude/research/architecture-baseline.md` now, in the same parallel batch. Empty or absent → skip silently.

## Mutations on `project-seed.md` (only if `seedUpdateApproved: true`)

- Skip if PHASE 3 ended with "Skip" or no drift was detected.
- Source content: the plan file's `## Proposed seed update` section (reviewed via plan-mode approval at the end of PHASE 3).
- Apply all writes per [shared/SEED.md § Write targets](../../shared/SEED.md#write-targets-sync-phase) — that table is canonical for seed-mutation file set and log line.

This write runs in parallel with the existing back-writes.

## Auto-build marking (after sync)

Read backlog again, find feature, set `"auto": true`, write back via Edit. No user prompt — always mark auto so the card gets an AUTO-badge.

**Terminal handoff — none.** game-ship drives the pipeline: **no** DASHBOARD SYNCED block, **no** `Next:`/clipboard offer, and **no** `active-{feature}.json` cleanup (game-ship owns the live signal — Step 2a armed it, Step 4b rewrites it without `waiting`). After the sync writes, return control to game-ship Step 4b, which continues to Step 5 → build.
