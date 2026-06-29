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

```yaml
header: "Page composition"
question: "What goes on '{$TARGET}'? Select all that apply."
options:
  - label: "✓ {feature-name}", description: "DONE — ready to import"
  - label: "○ {feature-name}", description: "DOING — will render as TODO-marker"
  - label: "◷ {feature-name}", description: "DEFINED — will render as TODO-marker"
  - label: "◻ {feature-name}", description: "TODO — will render as TODO-marker"
  - label: "[Component] {component-name}", description: "{purpose} ({scope})"
  - label: "+ New component", description: "Define a new reusable component and add to backlog"
  - label: "+ New feature", description: "Define a new feature and add to backlog"
multiSelect: true
```

Pre-select (recommended): union of two sources:

1. DONE features with `pageHint` matching `$TARGET` (backlog-based)
2. Any feature or component whose name matches an entry in `$EXISTING_IMPORTS[]` (already wired into the existing page file — regardless of status)

Show max 4 feature candidates + max 2 component candidates. Use "Other" for the rest.

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
    /* TODO: {feature-name} — status: {STATUS}, build with /dev-build {feature-name} */
  }
  <div className="todo-placeholder" aria-label="{feature-name} placeholder" />;
  ```

- Selected components → import from their `src` path in `design.components[]`

The BUILD PLAN (Step 7 thinking checkpoint) must list `$COMPOSITION.features` and `$COMPOSITION.components` under "Blocks reused".
