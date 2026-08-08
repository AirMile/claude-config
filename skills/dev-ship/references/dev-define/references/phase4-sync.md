# PHASE 4 Sync — Mutation Details

## Mutations on `backlog.json` (see `shared/BACKLOG.md`)

- Find feature → set `status: "DEFINED"`, `definedAt: <ISO>`, `auto: true`, remove `transition` (if present — **except** `transition: "shipping"`, the dev-ship run marker: keep it), remove `note` if present (the park context is consumed — the interview surfaced it) — all in one write. Not found → add to `backlog.json#features[]` — the **top-level** array, not a nested `data.features` (`data` holds only `updated`) — with `phase: "P4"`, `status: "DEFINED"`, `auto: true`.
- **TWEAK promotion**: if the found entry carries `type: "TWEAK"` (a `/dev-tweak` escalation handed off — see `shared/TWEAK-DISCIPLINE.md` § Escalation gate), overwrite `type` with the type this define pass just classified (the in-memory draft's `type`, same inference this run already derived for a fresh feature) — in the **same write** as the status/definedAt/auto fields above. This is the one sanctioned exception to `shared/BACKLOG.md` § TWEAK cards' `TODO → shipped` invariant: the card leaves the TWEAK lifecycle the moment it legitimately enters the ship pipeline, so it never sits as `type: "TWEAK"` + `status: "DEFINED"` (a state the invariant forbids). Not a TWEAK entry → leave `type` untouched as today.
- **Dependencies**: If during PHASE 1 or PHASE 2 external feature dependencies were identified (other features that must be DONE first), merge those into `dependencies[]`. Never remove existing values — only add. If nothing new found: leave field unchanged.
- **Impact Check results** (only when PHASE 2 carried `backlogImpact[]` — same write-batch): apply each approved verdict per `shared/BACKLOG.md § Impact Check → Mutations`: `covered`/`obsolete` → `status: "CANCELLED"` + `cancelledReason: "superseded by {feature}: {ref}"` + `cancelledAt` + remove `transition` + **run the dependent scan** (`define-park.md § 6`) for that cancelled item in this same write-batch — a card still listing it in `dependencies[]` would otherwise block on a card that will never ship; `partial` → rewrite `description` to the remaining scope + add `{feature}` to that item's `dependencies[]`. `externalRef` items: no mutation — list them in the log line as report-only. Then log `Backlog: ✓ impact applied — {N} cancelled, {M} rescoped, {K} dependents repointed`.
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
- **Context**:
  - `context.structure`: scan `feature.files[]` for new top-level directories under `src/` (e.g. `src/components/onboarding/`, `src/lib/payments/`). For each new directory not yet in `context.structure`: add a new line with path + 1-line description of the feature purpose.
  - `context.routing`: source is `feature.architecture.routes[]`. For each entry with `action: "CREATE"`: add `{path} → {file}` line. Entries with `action: "MODIFY"` leave `context.routing` unchanged (route already exists).
  - **Note**: structure/routing are JSON-escaped strings — for large changes use Write instead of Edit to avoid escaping issues.
  - **Edit strategy**: do one Read directly before the first Edit, then perform all `project-context.json` mutations back-to-back without an intermediate Read. With ≥3 independent Edits on the same file: build the full object in memory and use one Write instead of separate Edits — prevents "File has been modified since read" errors from tool-hash mismatches.
