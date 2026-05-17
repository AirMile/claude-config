# Route: Build (In-Claude-Code Code Generation)

Generates working code for PAGE or COMPONENT features with `status: DEF` and no visual reference material. See `../shared/CODEGEN.md` for the shared code-gen patterns also used by `frontend-convert`.

**Trigger:** only reachable if `$HAS_BUILD_CANDIDATES = true` (detected in PHASE 1).

#### Step 0: Backlog task pickup

See `shared/BACKLOG.md → Lifecycle Protocol → Read`. Filter: `(type === "PAGE" || type === "COMPONENT") && transition === "designing"` — if found, auto-select as task (show: `Backlog: ✓ Task picked up — {taskName}`) and skip entity/candidate selection modals.

On successful code generation: remove `transition`, set `status: "DOING"`, `stage: "built"`. Handled by Step 10d — this description is informational only.

#### Step 1: Entity selection

Show only type options for which candidates are available:

```yaml
header: "Build — what to build?"
question: "Which type do you want to generate?"
# If both PAGE and COMPONENT candidates:
options:
  - label: "PAGE (Recommended)", description: "{X} page(s) with status DEF available"
  - label: "COMPONENT", description: "{Y} component(s) with status DEF available"
# If only PAGE candidates: skip choice, proceed directly with PAGE
# If only COMPONENT candidates: skip choice, proceed directly with COMPONENT
multiSelect: false
```

Store chosen entity type as `$TARGET_TYPE` (PAGE or COMPONENT).

#### Step 2: Choose candidate

**If `$TARGET_TYPE = PAGE`:** show all PAGE features with `status: DEF` on the backlog for which no visual reference exists:

```yaml
header: "Build — choose page"
question: "Which page do you want to build?"
options:
  - label: "{name}", description: "{description} — {route-pattern}"
  # max 4, rest via Other
multiSelect: false
```

Store as `$TARGET_PAGE`.

**If `$TARGET_TYPE = COMPONENT`:** show all COMPONENT features with `status: DEF`:

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

#### Step 5: Design Direction

Three short questions that lock the visual direction before code generation. Answers stored as `$DESIGN_DIRECTION` and injected into the Build Plan (Step 7).

```yaml
header: "Tone"
question: "Which tone fits {$TARGET}?"
options:
  - label: "Sober", description: "Reserved, information-first — no decorative elements"
  - label: "Bold", description: "Strong contrast, dominant typography, assertive spacing"
  - label: "Playful", description: "Rounded shapes, softer palette, motion accents"
  - label: "Minimal", description: "Maximum whitespace, single accent, no ornamentation"
multiSelect: false
```

```yaml
header: "Density"
question: "How dense should the layout of {$TARGET} be?"
options:
  - label: "Compact", description: "Tight padding, small font sizes — information-dense"
  - label: "Comfortable (Recommended)", description: "Standard spacing — balanced readability"
  - label: "Spacious", description: "Generous padding, large touch targets — simple content"
multiSelect: false
```

Derive primary-affordance options from the spec (`$TARGET`): list up to 4 clearly distinct interaction or perception goals (e.g. "color shift on value change", "numeric readout", "proximity threshold marker", "drag animation"). If the spec is too sparse to derive options: skip this question.

```yaml
header: "Primary affordance"
question: "Which element should dominate the user's attention in {$TARGET}?"
options:
  - label: "{affordance-1}", description: "{derived from spec}"
  - label: "{affordance-2}", description: "{derived from spec}"
  # max 4 options — always derived from spec, never generic
multiSelect: false
```

Store as `$DESIGN_DIRECTION = { tone, density, primaryAffordance }`.

#### Step 6: Design Alternatives

Only for PAGE entities or COMPONENTs with ≥2 variants or sections. Skip for single-variant, stateless components.

Spawn 2 Plan-agents **parallel** with opposing constraints on `$DESIGN_DIRECTION`:

- **Agent 1 constraint:** `"Maximize {$DESIGN_DIRECTION.primaryAffordance} — every visual decision supports this single goal. Tone: {tone}. Density: {density}."`
- **Agent 2 constraint:** `"Invert hierarchy — treat the secondary goal as the hero. Suppress {primaryAffordance} in favour of context/navigation. Tone: {tone}. Density: {density}."`

Each agent produces:

1. An ASCII wireframe (max 30 lines)
2. A 2-sentence rationale

Present as 3 options (original plan from Step 4 + 2 alternatives). Use `preview` field for the ASCII wireframes:

```yaml
header: "Design choice"
question: "Three approaches for {$TARGET} — choose one or describe a combination."
options:
  - label: "Original plan"
    description: "{spec-derived layout overview}"
    preview: "{ascii wireframe of original}"
  - label: "Option A — maximize {primaryAffordance}"
    description: "{agent-1 rationale}"
    preview: "{agent-1 ascii wireframe}"
  - label: "Option B — inverted hierarchy"
    description: "{agent-2 rationale}"
    preview: "{agent-2 ascii wireframe}"
multiSelect: false
```

Store as `$CHOSEN_LAYOUT`. Inject into Step 7 code generation as layout-direction override.

If user selects "Other" (combination): ask what to take from which option → synthesize into `$CHOSEN_LAYOUT`.

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

Edit back to `backlog.html` (keep `<script>` tags intact, see `shared/BACKLOG.md → Lifecycle Protocol → Write`).

Store block inventory counters as `$INV_NEW`, `$INV_UPDATED`, `$INV_CONFLICTS` for use in Step 11.

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
```
