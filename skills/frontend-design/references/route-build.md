# Route: Build (In-Claude-Code Code Generation)

Generates working code for PAGE or COMPONENT features with `status: DEF` and no visual reference material. See `../shared/CODEGEN.md` for the shared code-gen patterns also used by the Convert route.

**Trigger:** only reachable if `$HAS_BUILD_CANDIDATES = true` (detected in PHASE 1).

**External setup context (fires on Build entry):**

> **Todo**: Read `.claude/skills/shared/VERCEL-CONTEXT.md` — follow the Load Protocol, then apply the guidelines as a bias layer in Step 7.

---

#### Step 0: Backlog task pickup

See `shared/BACKLOG.md → Lifecycle Protocol → Read`. Filter: `(type === "PAGE" || type === "COMPONENT") && transition === "designing"` — if found, auto-select as task (show: `Backlog: ✓ Task picked up — {taskName}`) and skip entity/candidate selection modals.

On successful code generation: remove `transition`, set `status: "DOING"`, `stage: "built"`. Handled by Step 10d — this description is informational only.

#### Step 1: Entity selection

Build candidates come from two sources (merge, deduplicate on name):

1. `design.pages[]` / `design.components[]` with `status: "DEF"` and no visual reference in `.project/wireframes/` or `.screenshots[]`.
2. `backlog.html` features with `(type === "PAGE" || type === "COMPONENT") && transition === "designing"`.

Show only type options for which candidates are available:

```yaml
header: "Build — what to build?"
question: "Which type do you want to generate?"
# If both PAGE and COMPONENT candidates:
options:
  - label: "PAGE (Recommended)", description: "{X} page(s) ready to build"
  - label: "COMPONENT", description: "{Y} component(s) ready to build"
# If only PAGE candidates: skip choice, proceed directly with PAGE
# If only COMPONENT candidates: skip choice, proceed directly with COMPONENT
multiSelect: false
```

Store chosen entity type as `$TARGET_TYPE` (PAGE or COMPONENT).

#### Step 2: Choose candidate

**If `$TARGET_TYPE = PAGE`:** show merged candidate list (design.pages[] DEF + backlog PAGE with transition=designing):

```yaml
header: "Build — choose page"
question: "Which page do you want to build?"
options:
  - label: "{name}", description: "{description} — {route-pattern}"
  # max 4, rest via Other
multiSelect: false
```

Store as `$TARGET_PAGE`.

**If `$TARGET_TYPE = COMPONENT`:** show merged candidate list:

```yaml
header: "Build — choose component"
question: "Which component do you want to build?"
options:
  - label: "{name}", description: "{purpose} — {scope}"
  # max 4, rest via Other
multiSelect: false
```

Store as `$TARGET_COMPONENT`. Store `$TARGET` = `$TARGET_PAGE` or `$TARGET_COMPONENT`.

#### Step 3: Worktree setup

Follow `shared/WORKTREE.md → Auto-create worktree` with `feature-name = $TARGET`. Creates an isolated worktree for this build so generated code lands on a separate branch. Skip if already in a worktree (procedure detects).

#### Step 4: Spec lookup (entity-agnostic)

**If `$TARGET_TYPE = PAGE`:**

1. Look up `.project/features/{$TARGET}/feature.json` → read as spec source (primary).
2. Fallback: `design.pages[]` filtered by name matching `$TARGET`.
3. If both empty → ask three structured questions:
   1. **Purpose + sections**: "What does this page do? List the sections needed (one per line)."
   2. **Primary action**: "What is the single most important action a user performs here?" — free text
   3. **States**: multi-select — `default` / `loading` / `empty` / `error` / `authenticated-only`
      → save answers as inline spec and write to `design.pages[]` for later reuse.

Show spec:

```
SPEC: {$TARGET} (PAGE)
Purpose:  {purpose}
Sections: {sections joined}
Routes:   {route-patterns}
```

**If `$TARGET_TYPE = COMPONENT`:**

1. Look up `.project/features/{$TARGET}/feature.json` → read as spec source (primary).
2. Fallback: `design.components[]` filtered by name matching `$TARGET`.
3. If both empty → ask three structured questions:
   1. **States**: multi-select — `default` / `hover` / `disabled` / `loading` / `error` / `active` / `checked`
   2. **Props**: "Which props does this component accept? (one per line, e.g. `label`, `onClick`, `disabled?`)"
   3. **Required interaction**: single-select — `keyboard only` / `pointer only` / `both`
      → save answers as inline spec and write to `design.components[]` for later reuse.

Show spec:

```
SPEC: {$TARGET} (COMPONENT)
Purpose:  {purpose}
Scope:    {scope}
Variants: {variants joined}
Props:    {props joined}
States:   {states joined}
```

```yaml
header: "Spec Confirmation"
question: "Is this spec correct?"
options:
  - label: "Continue (Recommended)", description: "Spec is correct, proceed to codegen"
  - label: "Update spec", description: "Change purpose, scope, variants or props"
multiSelect: false
```

#### Step 4b: Page Composition (PAGE entities only — skip for COMPONENT)

> **Todo**: Read `.claude/skills/frontend-design/references/page-compose.md` and follow the composition flow. Store result as `$COMPOSITION`.

---

#### Step 5: Layout Archetype

Single question that determines the structural layout before code generation. Answered once; stored as `$CHOSEN_LAYOUT`.

**PAGE:**

```yaml
header: "Layout"
question: "Which layout archetype fits {$TARGET}?"
options:
  - label: "Single column", description: "Stacked sections, full-width — ideal for long-form content or forms"
  - label: "Sidebar", description: "Navigation or filters sidebar + main content area"
  - label: "Hero + grid", description: "Hero banner at the top + responsive card or list grid below"
  - label: "Split screen", description: "Two equal panels side-by-side — auth / onboarding / comparison"
  - label: "Dashboard grid", description: "Multi-section grid with stats, charts, or lists"
multiSelect: false
```

**COMPONENT:** skip this step. Layout is determined by the component's spec (`scope`, `variants`). Go directly to Step 7.

Store as `$CHOSEN_LAYOUT`.

---

#### Step 7: Generate (entity-aware)

Consult `../shared/CODEGEN.md` for full patterns. Output path determined by entity type and scope:

| Entity              | Output path                                          | Sub-output                          |
| ------------------- | ---------------------------------------------------- | ----------------------------------- |
| PAGE                | `app/{route}/page.tsx`                               | `app/{route}/_components/{Sub}.tsx` |
| COMPONENT (atomic)  | `src/components/ui/{Name}.tsx`                       | —                                   |
| COMPONENT (section) | `src/components/{Name}.tsx`                          | —                                   |
| COMPONENT (layout)  | `src/components/{Name}.tsx` + patch `app/layout.tsx` | Demo page (see below)               |

**Auto-patch for layout components:** if `scope: layout`, Build adds an import + render statement to `app/layout.tsx`. For `appliesTo: route-group:X`: patch in `app/(X)/layout.tsx`. Detect existing imports before patching — show conflict warning on duplicate and ask for confirmation.

**Demo page for COMPONENT:** generate `app/_dev/components/{name}/page.tsx` (gitignored) showing all variants × sizes × states — used for verification in Step 9.

```tsx
// Auto-generated — gitignored
export default function {Name}Demo() {
  return (
    <main aria-label="{Name} demo">
      {variants.map((v) =>
        sizes.map((s) =>
          states.map((state) => (
            <{Name} key={`${v}-${s}-${state}`} variant={v} size={s} {...stateProps[state]}>
              {v}/{s}/{state}
            </{Name}>
          )),
        ),
      )}
    </main>
  );
}
```

**Thinking checkpoint** — present before code generation, wait for user confirmation:

```
BUILD PLAN: {$TARGET} ({$TARGET_TYPE})
═══════════════════════════════════════════════════════════════
Structure:    {output paths — one line per file}
Layout:       {$CHOSEN_LAYOUT — or "n/a" for COMPONENT}
Tokens used:  {token names to be used}
Blocks reused: {imports from components[] — or "none"}
Images:       {placeholder strategy or "n/a"}
A11y plan:    {semantic structure + aria-labels}
Caveats:      {missing deps, missing tokens, auto-patch layout, etc. — or "none"}
═══════════════════════════════════════════════════════════════
```

```yaml
header: "Build plan"
question: "Plan correct? Files will be written immediately after approval."
options:
  - label: "Write files (Recommended)", description: "Plan is correct — generate and write now"
  - label: "Adjust plan", description: "I want to change something — update the plan and come back"
  - label: "Cancel", description: "Stop this build"
multiSelect: false
```

After approval — generate and write immediately:

- Semantic HTML layout (PAGE) or cva component (COMPONENT) based on spec + `$CHOSEN_LAYOUT`
- Reuse existing components where applicable (import via their paths in `components[]`)
- Tailwind/CSS classes via theme tokens — no raw hex values, no arbitrary color values (`bg-[#…]`)
- Images: only `/placeholder.svg?w={W}&h={H}` (PAGE only) — never external CDN URLs
- Accessibility: `<main>`, `<section>`, `aria-label`, skip-nav (PAGE); correct ARIA attributes (COMPONENT)

#### Step 8: Post-write checks

**Hex post-pass** — across generated files:

- `#[0-9a-fA-F]{3,8}` in `className` or inline-style props (outside `//` and `/* */` comments)
- Arbitrary Tailwind color values (`bg-[#`, `text-[#`, `border-[#`)
- External placeholder URLs (`images.unsplash.com`, `picsum.photos`, `placehold.co`, `fakeimg.pl`)

On match → show violation + AskUserQuestion:

```yaml
header: "Code violation"
question: "Found: {violation-type} in {file}:{line}. How to proceed?"
options:
  - label: "Auto-fix (Recommended)", description: "Map to nearest theme token or /placeholder.svg"
  - label: "Fix manually", description: "I'll fix it myself"
  - label: "Ignore", description: "Intentionally deviate from the token rule"
multiSelect: false
```

**Unknown-import scan** — for each `from ['"](.+?)['"]` in generated files:

- Relative (`./`, `../`, `@/`): verify file exists in project structure
- Bare: verify presence in `package.json`
- On unresolved → show list, note as missing dependency in completion report

#### Step 9: Hand off to /frontend-check (optional)

After Step 8 passes, offer a one-question handoff:

```yaml
header: "Verify"
question: "Build complete. Run /frontend-check on {$TARGET}?"
options:
  - label: "Yes (Recommended)", description: "Smoke, a11y, responsive, darkmode via /frontend-check"
  - label: "Skip", description: "Mark build done — verify later"
multiSelect: false
```

If "Yes": invoke `/frontend-check {$TARGET}` (feature-target mode picks up `files[]` + routes from `feature.json`). Capture frontend-check's exit status:

- All critical findings resolved or none found → `$VERIFY_STATUS = "PASS"`
- Critical findings remain after user chose "Fix manually" or "Open in convert" → `$VERIFY_STATUS = "FAIL"`, store short reason in `$VERIFY_ERROR`

If "Skip": `$VERIFY_STATUS = "SKIPPED"`. Note in devinfo that verification is pending.

Step 10 reads `$VERIFY_STATUS` to set `feature.audit.buildSmokeStatus`.

#### Step 10: Backlog sync + Block inventory + Drift cleanup

10a–10c run unconditionally after Step 8 succeeds — they are static analyses on `$GENERATED_FILES`. Only 10d (Backlog sync) reads `$VERIFY_STATUS` to decide the final feature stage. 10e (Gap-discovery) runs always.

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

Parse `backlog.html` → match on `name === {$TARGET}`:

Map `$VERIFY_STATUS` (from Step 9) to backlog state:

- `"PASS"` → `feature.status = "DOING"` + `delete feature.transition` + `feature.stage = "built"` + `feature.audit.buildSmokeStatus = "PASS"` + `data.updated = today`
- `"SKIPPED"` → identical to PASS but `feature.audit.buildSmokeStatus = "SKIPPED"`
- `"FAIL"` → backlog status **unchanged** (code not confirmed working). Set `feature.audit.buildSmokeStatus = "FAIL"` + `feature.audit.buildSmokeError = $VERIFY_ERROR`
- **No match or no backlog** → silent skip. Add to completion report: `Backlog: feature not found — skipping`.

**10d.1. Composition persistence** (PAGE only, `$TARGET_TYPE === "PAGE"` and `$VERIFY_STATUS !== "FAIL"`):

For the matched page entry in `data.features[]`:

- Set `dependencies` to union of existing `dependencies[]` and all names from `$COMPOSITION.features` + `$COMPOSITION.components`.

For each name in `$COMPOSITION.features[].name`:

- Glob `.project/features/*/feature.json` → find where `feature.name === name`.
- Read file, add `$TARGET` to `pageHint[]` (dedupe), write back.
- No feature.json found for this name → skip silently (pageHint gets written when `/dev-define` runs).

Store `$COMP_FEAT_COUNT = len($COMPOSITION.features)`, `$COMP_COMP_COUNT = len($COMPOSITION.components)`, `$PAGEHINT_COUNT = number of feature.json files updated`.

Edit back to `backlog.html` (keep `<script>` tags intact, see `shared/BACKLOG.md → Lifecycle Protocol → Write`).

Store block inventory counters as `$INV_NEW`, `$INV_UPDATED`, `$INV_CONFLICTS` for use in Step 11.

**10d.2. Setup context traceability** (only if external context fetched successfully, i.e. `$VERCEL_CONTEXT ≠ false`):

Read `.project/project.json` → append-or-replace entry in `theme.setupContext[]` (key on `appliedBy`):

```json
{
  "source": "vercel-labs/web-interface-guidelines",
  "url": "https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md",
  "fetchedAt": "<ISO-8601>",
  "appliedBy": "frontend-design@2.11.0"
}
```

Write back. Skip if `$VERCEL_CONTEXT = false`.

**10e. Gap-discovery** (always, regardless of verification status):

Follow [Discovery — Gap-Discovery](../shared/SKILL-PATTERNS.md#gap-discovery), Trigger C (Build post code-gen): scan `$GENERATED_FILES` for stub handlers and show AskUserQuestion per found gap. If no gaps: skip step.

#### Step 11: Completion report

```
BUILD COMPLETE: {$TARGET} ({$TARGET_TYPE})

Files:
  {generated-file-1}
  {generated-file-2}

Tokens used:      {N token references}
Components:       {reused components}
Block inventory:  +{$INV_NEW} new, ~{$INV_UPDATED} updated, !{$INV_CONFLICTS} conflict
Linked:           {uses/usedIn sync — or "n/a"}
Missing deps:     {list or "none"}
Verification:     {$VERIFY_STATUS}
Verify error:     {$VERIFY_ERROR}   (only shown when $VERIFY_STATUS = "FAIL")
Gaps:             {N linked | M created | K pending | "none"}
Page deps:        +{$COMP_FEAT_COUNT} feature deps, {$COMP_COMP_COUNT} component deps   (PAGE only)
pageHint:         {$PAGEHINT_COUNT} features updated   (PAGE only)
Next:             /frontend-check {$TARGET} — moves PAGE to DONE on PASS   (PAGE only, when $VERIFY_STATUS != FAIL)
```
