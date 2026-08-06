# Page Composition

**Goal:** Before generating code for a PAGE, let the user select which features and components appear on it. The selection drives imports and TODO-markers in the generated output.

**Only runs for `$TARGET_TYPE = PAGE`.** Skip for COMPONENT.

---

## Step 1: Build the candidate lists

Read in parallel:

- `.project/backlog.json` → parse `data.features[]`
- `.project/project.json` → read `design.components[]`
- `.project/features/*/feature.json` → read `pageHint[]` from each (glob all feature.json files)

**Feature candidates** — include a feature if ANY of:

- `feature.pageHint[]` contains `$TARGET` (exact name match)
- backlog item has `$TARGET` in `dependencies[]`
- backlog item `type === "FEATURE"` and its name matches a section keyword in the PAGE spec

Label each by status:

| Status  | Label prefix |
| ------- | ------------ |
| DONE    | `✓`          |
| DOING   | `○`          |
| DEFINED | `◷`          |
| TODO    | `◻`          |

**Component candidates** — all entries from `design.components[]` (any status).

---

## Step 2: Composition question

The candidate count is unbounded and runtime-dependent (every backlog feature + every design component matching `$TARGET`) — an `AskUserQuestion` modal caps at 4 options, so this is the "holistic choice from an unbounded list" case `shared/SKILL-PATTERNS.md § Modal Option Cap` routes to plain-text instead. Use Numbered List Selection (`§ Numbered List Selection`), not a modal:

1. Compute the pre-select set (recommended): union of two sources:
   - DONE features with `pageHint` matching `$TARGET` (backlog-based)
   - Any feature or component whose name matches an entry in `$EXISTING_IMPORTS[]` (already wired into the existing page file — regardless of status)
2. Print every real candidate — no 4+2 cap, no items pushed to an unlabeled "Other" — as one numbered list, features first then components, each with its status icon:

   ```
   PAGE COMPOSITION — '{$TARGET}'
   1. ✓ {feature-name}        DONE — ready to import
   2. ○ {feature-name}        DOING — will render as TODO-marker
   3. ◷ {feature-name}        DEFINED — will render as TODO-marker
   4. ◻ {feature-name}        TODO — will render as TODO-marker
   ...
   N.   [Component] {component-name}   {purpose} ({scope})
   N+1. + New component
   N+2. + New feature

   Suggested: {comma-separated numbers from the pre-select set}
   Enter numbers (e.g. `1, 3, 5` or `1-4` or `all except 2`), or `suggested` to accept the pre-select.
   ```

3. Parse the reply per `§ Numbered List Selection`'s canonical syntax, plus the literal `suggested` → the pre-select set from step 1. Empty input still means "none" (the pattern's own safety default) — it is **not** a synonym for `suggested`, don't conflate the two. Echo the parsed selection before proceeding.

---

## Step 3: Handle smart-todo selections

**If "+ New component" selected:**

Follow [Smart-Todo Creation — "new component"](../../shared/SKILL-PATTERNS.md#smart-todo-creation), but **defer all writes**: route-build runs this step inside plan mode. Add the created component name to the selection, and collect the `design.components[]` entry (status: "IDEA") plus any backlog push in `$PENDING_DESIGN_WRITES` — flushed in `build-completion-sync.md → 10f`.

**If "+ New feature" selected:**

Follow [Smart-Todo Creation — "new feature"](../../shared/SKILL-PATTERNS.md#smart-todo-creation), with the same write deferral: add the created feature name to the selection, collect the backlog push in `$PENDING_DESIGN_WRITES`.

---

## Step 4: Store composition result

Store as `$COMPOSITION`:

```json
{
  "features": [
    { "name": "cart-total", "status": "DONE", "ready": true },
    { "name": "checkout-form", "status": "DOING", "ready": false }
  ],
  "components": [{ "name": "button", "status": "DEF", "ready": true }]
}
```

**Write backlog update** (as part of completion sync 10d.1, not here): set `page-task.dependencies[]` to the union of selected feature + component names, and write back `pageHint[]` to each selected feature.json. See `build-completion-sync.md → 10d.1` for the implementation.

---

## Step 5: Inject into CODEGEN (Step 7 of route-build)

Pass `$COMPOSITION` to the codegen step:

- `ready: true` items → generate real imports and usage (`import { CartTotal } from "@/features/cart-total"`, etc.)
- `ready: false` items → generate a TODO-marker comment:

  ```tsx
  {
    /* TODO: {feature-name} — status: {STATUS}, build with /dev-ship {feature-name} */
  }
  <div className="todo-placeholder" aria-label="{feature-name} placeholder" />;
  ```

- Selected components → import from their `src` path in `design.components[]`

The BUILD PLAN (Step 7 thinking checkpoint) must list `$COMPOSITION.features` and `$COMPOSITION.components` under "Blocks reused".
