# PHASE 4 Sync — Mutation Details

## Mutations on `backlog.json` (see `shared/BACKLOG.md`)

- Find feature → set `status: "DEFINED"`, `definedAt: <ISO>`, `auto: true`, remove `transition` (if present — **except** `transition: "shipping"`, the dev-ship run marker: keep it) — all three in one write. Not found → add to `data.features` with `phase: "P4"`, `status: "DEFINED"`, `auto: true`.
- **Dependencies**: If during PHASE 1 or PHASE 2 external feature dependencies were identified (other features that must be DONE first), merge those into `dependencies[]`. Never remove existing values — only add. If nothing new found: leave field unchanged.
- **Impact Check results** (only when PHASE 2 carried `backlogImpact[]` — same write-batch): apply each approved verdict per `shared/BACKLOG.md § Impact Check → Mutations`: `covered`/`obsolete` → `status: "CANCELLED"` + `cancelledReason: "superseded by {feature}: {ref}"` + `cancelledAt` + remove `transition`; `partial` → rewrite `description` to the remaining scope + add `{feature}` to that item's `dependencies[]`. `externalRef` items: no mutation — list them in the log line as report-only. Then log `Backlog: ✓ impact applied — {N} cancelled, {M} rescoped`.
- Set `data.updated` to today.

## Mutations on `project.json` (see `shared/DASHBOARD.md`)

- Merge per entity type (always check for existing before push):
  - **Data entities** (optional — only if feature introduces domain entities): check on name → new: push with fields/relations → existing: merge new fields. If feature has no entities (UI-only, refactor, utility): skip this update, log `Skipped data.entities: no entities`.
  - **Endpoints**: check on method+path → new: push with `status: "planned"`, `auth: "public" | "user" | "admin"` (default `"public"`, use `"user"` if JWT/session required, `"admin"` if role-check required; omit `auth` field for projects without auth) → existing: skip
  - **Stack packages**: check on name → new: push `{ name, version, purpose }` → existing: skip
  - Feature status lives in the backlog only (`backlog.json#features[]`) — project.json carries no features copy.

## Mutations on `.claude/research/stack-baseline.md`

- Only when PHASE 2 collected `pendingBaselineAppends` (the baseline write was deferred): append the new patterns to `stack-baseline.md` now, parallel with the other back-writes. Empty or absent → skip silently.

## Mutations on `project-context.json` (see `shared/DASHBOARD.md`)

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
