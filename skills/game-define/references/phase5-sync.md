# PHASE 5: Sync — Mutation Details

Read in parallel **directly before editing** (skip if not present) — do NOT rely on reads from earlier phases (Prettier/linters may have modified files in the meantime):

- `.project/backlog.html`
- `.project/project.json`
- `.project/project-context.json`

Mutate in memory:

## Backlog (see `shared/BACKLOG.md`)

- Find feature: `data.features.find(f => f.name === "{feature-name}")`
- Found → set `.status = "DEFINED"`, remove `.stage` and `.transition` (no stage in DEFINED column) and set `.date = "{current date}"`
- Not found → add: `{ "name": "{feature}", "type": "FEATURE", "status": "DEFINED", "phase": "P4", "description": "{from feature.json summary}", "dependencies": [], "source": "/game-define" }`
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

- Edit `backlog.html` (keep `<script>` tags intact)
- Write `project.json` (stack, features, data)
- Write `project-context.json` (if architecture changed)

## Mutations on `project-seed.md` (only if `seedUpdateApproved: true`)

- Skip if PHASE 3 ended with "Skip" or no drift was detected.
- Write the rewritten content (reviewed inline by the user in PHASE 3 before this sync phase) to `.project/project-seed.md` — full file overwrite.
- Update `project.json#concept.pitch` if the new pitch differs. Update `concept.name` only if the H1 title changed.
- Log: `Seed: ✓ updated — N section(s) rewritten`.

This write runs in parallel with the existing back-writes.

## Auto-build marking (after sync)

Read backlog again, find feature, set `"auto": true`, write back via Edit. No user prompt — always mark auto so the card gets an AUTO-badge and the clipboard gets the correct `/game-build` command.

Clean up: `rm -f .project/session/active-{feature-name}.json`

## Output

```
DASHBOARD SYNCED

Data: {N} entities ({new} new)
Stack: {N} packages ({new} new)

Next steps:
  1. /project-backlog → generate backlog from concept (if no backlog yet)
  2. /game-build {feature-name} → start implementation (if backlog already exists)
```
