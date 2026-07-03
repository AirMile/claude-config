# Build Completion Sync — Step 10 of route-build

Loaded after Step 9. Inputs: `$GENERATED_FILES`, `$TARGET`, `$TARGET_TYPE`, `$VERIFY_STATUS`, `$SMOKE`, `$SMOKE_SHOT`, `$COMPOSITION`, `$INLINE_SPEC`, `$PENDING_DESIGN_WRITES`.

10a–10c run unconditionally after Step 8 succeeds — they are static analyses on `$GENERATED_FILES`. Only 10d (Backlog sync) reads `$VERIFY_STATUS`/`$SMOKE` to decide the final feature stage. 10e (Gap-discovery) and 10f (Deferred writes) run always.

After these steps and the Step 11 report, `route-build.md` **Step 12 (worktree finalize)** closes the worktree opened in Step 7b — the Build route owns the full open→close lifecycle, mirroring `convert-completion.md §4.5–4.6`. Backlog status is set here (10d); the merge/cleanup in Step 12 never changes it (`FINALIZE.md` never promotes `DOING → DONE`).

**10a. Block inventory**:

Parse all `$GENERATED_FILES` → filter on component paths (`_components/`, `src/components/`, `app/components/`). Skip page files (`page.tsx`, `+page.svelte`, route-level files). Per component file:

1. Extract named exports with regex: `export (function|const|default) (\w+)` + `export { … }`
2. Detect cva-variants if `cva(` present: extract `variants.variant[]` and `variants.size[]`
3. Store as entry: `{ name, src, exports, variants, sizes }`
4. Conflict check on `components[].name`:
   - Same name + different `src` → skip + note as conflict
   - Same name + same `src` → merge (idempotent re-run)
   - New → append
5. Read `.project/project-context.json` → update `components[]` → Write back (only if changes)

**10b. Bidirectional linking**:

Parse imports from all `$GENERATED_FILES`:

- Scan for `from ['"](.+?)['"]` — extract component names from import paths
- Match against `design.components[].name` (case-insensitive)

**If `$TARGET_TYPE = PAGE`:**

- Populate `design.pages[{$TARGET}].uses[]` → list of detected component names (dedupe)
- For each matched component: append `{$TARGET}` to `design.components[{name}].usedIn[]` (dedupe)

**If `$TARGET_TYPE = COMPONENT`:**

- Set `design.components[{$TARGET}].status = "BLT"`
- If sub-components generated as `_components/` or inline (complex pattern) → show promote prompt:
  ```yaml
  header: "Sub-components found"
  question: "Do you want to add these as shared COMPONENTs in the backlog?"
  options:
    - label: "Yes, as COMPONENT-todo", description: "{sub-component-name} → backlog"
    - label: "No, keep inline", description: "Stays part of this component"
  multiSelect: true
  ```

Write `project.json#design` back after sync.

**10c. TokenDrift cleanup**:

Read `.project/session/devinfo.json` → check `tokenDrift.affectedFeatures`. If `{$TARGET}` is in it: remove from the list. If list is then empty: set `tokenDrift.resolved = true`. Write back.

**10d. Backlog sync**:

Parse `.project/backlog.json` → match on `name === {$TARGET}`:

Map `$VERIFY_STATUS` (from Step 9) to backlog state:

- `"PASS"` → `feature.status = "DOING"` + `delete feature.transition` + `feature.stage = "built"` + `delete feature.contentStatus` + `feature.audit.buildSmokeStatus = "PASS"` + `data.updated = today`
- `"SKIPPED"` → identical to PASS (including `delete feature.contentStatus`), but if `$SMOKE` is set (Step 8b ran): `feature.audit.buildSmokeStatus = $SMOKE` + `feature.audit.buildScreenshot = $SMOKE_SHOT`; otherwise `feature.audit.buildSmokeStatus = "SKIPPED"`
- `"FAIL"` → backlog status **unchanged** (code not confirmed working). Set `feature.audit.buildSmokeStatus = "FAIL"` + `feature.audit.buildSmokeError = $VERIFY_ERROR`
- **No match or no backlog** → silent skip. Add to completion report: `Backlog: feature not found — skipping`.

**10d.1. Composition persistence** (PAGE only, `$TARGET_TYPE === "PAGE"` and `$VERIFY_STATUS !== "FAIL"`):

For the matched page entry in `data.features[]`:

- Set `dependencies` to union of existing `dependencies[]` and all names from `$COMPOSITION.features` + `$COMPOSITION.components`.

For each name in `$COMPOSITION.features[].name`:

- Glob `.project/features/*/feature.json` → find where `feature.name === name`.
- Read file, add `$TARGET` to `pageHint[]` (dedupe), write back.
- No feature.json found for this name → skip silently (pageHint gets written when dev-ship's define phase runs).

Store `$COMP_FEAT_COUNT = len($COMPOSITION.features)`, `$COMP_COMP_COUNT = len($COMPOSITION.components)`, `$PAGEHINT_COUNT = number of feature.json files updated`.

Edit back to `.project/backlog.json` (see `shared/BACKLOG.md → Lifecycle Protocol → Write`).

Store block inventory counters as `$INV_NEW`, `$INV_UPDATED`, `$INV_CONFLICTS` for use in Step 11.

**10d.2. Setup context traceability** (only if external context fetched successfully, i.e. `$VERCEL_CONTEXT ≠ false`):

Read `.project/project.json` → append-or-replace entry in `theme.setupContext[]` (key on `appliedBy`):

```json
{
  "source": "vercel-labs/web-interface-guidelines",
  "url": "https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md",
  "fetchedAt": "<ISO-8601>",
  "appliedBy": "design-create@2.13.0"
}
```

Write back. Skip if `$VERCEL_CONTEXT = false`.

**10e. Gap-discovery** (always, regardless of verification status):

Follow [Discovery — Gap-Discovery](../../shared/SKILL-PATTERNS.md#gap-discovery), Trigger C (Build post code-gen): scan `$GENERATED_FILES` for stub handlers and show AskUserQuestion per found gap. If no gaps: skip step.

**10f. Deferred plan-mode writes** (always — skip silently if both inputs are empty):

Steps 4 and 4b run inside plan mode, where `.project/` writes are blocked. Flush the deferred writes now:

- `$INLINE_SPEC` set (Step 4 fallback questions) → write the inline spec to `design.pages[]` or `design.components[]` (matching `$TARGET_TYPE`) for later reuse. Merge by name — never overwrite an existing richer spec.
- `$PENDING_DESIGN_WRITES` non-empty (page-compose smart-todos) → append each entry to `design.components[]` with `status: "IDEA"` and/or push the backlog entries per `shared/BACKLOG.md → Lifecycle Protocol → Write` (dedupe by name).
