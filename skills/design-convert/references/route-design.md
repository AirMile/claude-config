# Route: Design

Incoming from the router (`SKILL.md`): `$ROUTE = "design"`, optionally `$SKILL_ARG`. Directory and session checks are complete. `$ARG_MODE` / `$ARG_TYPE` / `$ARG_ENTITY` / `$ARG_NAME` are resolved in **PHASE 0.3** below.

---

## Design JSON Schema

> **Todo**: Read `.claude/skills/shared/DASHBOARD.md § Design Section` for the full JSON schema, status values, scope table, appliesTo, and merge strategy.

---

## Forbidden Choices (Anti-Slop)

> **Todo**: Read `.claude/skills/shared/DESIGN.md § Forbidden Choices (Anti-Slop)` for the list of fonts, color schemes, layouts, and component clichés to avoid.

---

## State Machine

> **Todo**: Read `.claude/skills/design-convert/references/design-state-machine.md` for the full state machine diagram (only needed for debugging or validation).

---

## Read/Write Protocol

### Reading

1. Read `.project/project.json` (detect if missing)
2. Parse as JSON
3. Access `design` section (may be empty `{}`, undefined, or populated)

### Writing

1. Read `.project/project.json` (or create new with EMPTY schema from `shared/DASHBOARD.md` if missing)
2. Parse JSON
3. Mutate ONLY the `design` section (other sections UNTOUCHED)
4. Write back as `JSON.stringify(data, null, 2)`

**Create new file** if `.project/project.json` does not exist: use the EMPTY schema from `shared/DASHBOARD.md`, add `design` section:

```json
"design": {
  "pages": [],
  "flows": [],
  "principles": [],
  "components": []
}
```

### Merge Logic

For each page/flow/principle/component:

1. Find by `name` in existing array
2. If not found: push new item
3. If found: update fields (purpose, status, sections, flows, notes, steps, description, scope, appliesTo, variants, sizes, states, props, slots)
4. **MERGE on key** for `components[].motion{}` and `pages[].transitions{}` — never auto-delete, only add/update keys
5. Never auto-delete items (only via explicit "Delete" route)
6. `pages[].uses[]` and `components[].usedIn[]` are auto-maintained by Build post-pass — never overwrite during merge

---

## PHASE 0: Design Pre-flight

### 0.1 Design State Check

Read `.project/project.json` and check if `design` section has data.

```
Design: [empty — guided setup available | {N} pages, {M} flows, {P} principles, {C} components]
```

### 0.2 Learnings Load

**Learnings load** via [shared/LEARNINGS-LOAD.md](../../shared/LEARNINGS-LOAD.md):

```
scopes: [component]
pitfall-prefix: true
current-feature: <page-name if capture/iterate-mode on 1 page, otherwise "none">
```

UI/UX patterns and pitfalls from previous designs drive consistent choices (component naming, layout patterns, accessibility gotchas). Skip silently if no learnings available.

**Show pre-flight summary:**

```
PRE-FLIGHT CHECK
════════════════════════════════════════════════
Directory:  [✓] .project/  (verified by router)
Session:    [✓] [New session | Continuing from {skill}]
Design:     [empty | {N} pages, {M} flows, {P} principles, {C} components]
════════════════════════════════════════════════
```

**On failure:**

```yaml
header: "Pre-flight"
question: "Pre-flight check failed. How do you want to proceed?"
options:
  - label: "Fix and retry (Recommended)", description: "Try to resolve the problem"
  - label: "Continue anyway", description: "Ignore and continue"
  - label: "Cancel", description: "Stop"
multiSelect: false
```

### 0.3 Argument Resolution

Resolve `$SKILL_ARG` to the correct mode before branching in PHASE 1.

**Step 1 — Empty argument:**

If `$SKILL_ARG` is empty → `$ARG_MODE = "C"`. Skip Step 2.

**Step 2 — Named argument lookup:**

Scan in order:

1. `design.pages[]` — match on `page.name === $SKILL_ARG` (case-sensitive)
2. `design.components[]` — match on `component.name === $SKILL_ARG`
3. `backlog.features[]` (if `.project/backlog.json` exists) — match on `feature.name === $SKILL_ARG`

**Match found:**

→ `$ARG_MODE = "A"`, `$ARG_ENTITY = <matched object>`, `$ARG_TYPE = "PAGE" | "COMPONENT"` (from source array or backlog `type` field).

**No match:**

→ `$ARG_MODE = "B"`, `$ARG_NAME = $SKILL_ARG`.

```
Arg:  [{name} → Mode A: {type} | Mode B: unknown | Mode C: no arg]
```

---

## PHASE 1: Action Selection

Branching based on `$ARG_MODE` (determined in PHASE 0.3).

---

### Mode A — Existing entity (`$ARG_MODE = "A"`)

Entity found in design[]/backlog. Resolve `$HAS_SPEC` before showing actions:

- Page: `true` if `project.json → design.pages[]` has an entry with matching name
- Component: `true` if `project.json → design.components[]` has an entry with matching name

Resolve `$HAS_VISUAL` before choosing the Recommended tag:

- `$HAS_VISUAL = true` when any of the following apply: a file exists in `.project/wireframes/{name}.*`, the entity has a `.screenshots[]` entry, or a known mock-path is stored in the spec/feature.json.
- `$HAS_VISUAL = false` otherwise (backlog description + optional written spec, but no visual material).

Recommended logic:

- `$HAS_VISUAL === true` → mark **"Convert from sketch/mockup"** as Recommended (visual material present — conversion beats blind build).
- `$HAS_VISUAL === false` → mark **"Build with Claude Code"** as Recommended. Build opens with a spec gate that reviews/edits the full spec inline (no prior spec required), and can save spec-only without generating code — so it covers both the old "Build" and "Edit spec" actions. Note: Build is available regardless of `$HAS_SPEC`.

```yaml
header: "What do you want to do with {name}?"
question: "{$ARG_TYPE} '{name}' — {status}, {short spec summary from design.* or 'no spec yet'}"
options:
  - label: "Build with Claude Code{ (Recommended)}"
    description: "Review/edit the spec, then generate code — or save the spec without building"
  - label: "Convert from sketch/mockup{ (Recommended)}"
    description: "Turn a sketch, wireframe, Figma/Canva or screenshot into code with project tokens"
  - label: "Brief for Claude Design"
    description: "Markdown handoff for Claude Design / Figma"
multiSelect: false
```

Routing:

- "Build" → Route: Build (with `$ARG_TYPE` and `$ARG_ENTITY` pre-set, skip entity selection). Build's Step 2.5 spec gate handles spec review/edit and a "save spec only — don't build" off-ramp, so spec-only edits no longer need a separate menu option.
- "Convert from sketch/mockup" → Set `$CONVERT_TARGET = {name}`. Load Convert route:

  > **Todo**: Read `.claude/skills/design-convert/references/route-convert.md`

  Route: Convert pre-selects the '{name}' card in its backlog-stage step (no second command needed). The card transitions TODO→DOING on completion.

- "Brief" → Route: Brief (with entity pre-set)

**"Other" options:** "Capture as new (different name)" → ask for new name → Route: Page or Component (in create mode)

---

### Mode B — Unknown name (`$ARG_MODE = "B"`)

Name `$ARG_NAME` is not in design[]/backlog.

```yaml
header: "'{$ARG_NAME}' is not known"
question: "What do you want to create?"
options:
  - label: "New page"
    description: "Capture flow for PAGE with name {$ARG_NAME}"
  - label: "New component"
    description: "Capture flow for COMPONENT with name {$ARG_NAME}"
  - label: "Cancel"
    description: "Wrong name — stop without creating anything"
multiSelect: false
```

Routing:

- "New page" → Route: Page (name pre-filled)
- "New component" → Route: Component (name pre-filled)
- "Cancel" → exit

---

### Mode C — No argument (`$ARG_MODE = "C"`)

Use existing design-state branching:

#### If design section EMPTY (or project.json missing):

```yaml
header: "Design"
question: "No design spec found. What do you want to do?"
options:
  - label: "Create (Recommended)", description: "New design spec with guided setup"
  - label: "Import", description: "Extract design from existing codebase"
  - label: "Convert visual input", description: "Screenshot, Figma/Make link, or website URL → working code"
multiSelect: false
```

"Convert visual input" → load the Convert route without `$CONVERT_TARGET` — its PHASE 0.1 "No input provided" question collects the source itself:

> **Todo**: Read `.claude/skills/design-convert/references/route-convert.md`

### If design section HAS DATA:

Detect first:

- `$HAS_BUILD_CANDIDATES` (true/false): are there PAGE or COMPONENT items ready to build? True if **either**:
  - `design.pages[]` or `design.components[]` has an entry with `status: "DEF"` and no visual reference in `.project/wireframes/` or `.screenshots[]`, **or**
  - `backlog.json` has a feature with `(type === "PAGE" || type === "COMPONENT") && transition === "designing"` (newly created by `/project-plan` or `/project-todo`).
- `$HAS_PAGE_CANDIDATES` (true/false): subset of the above, PAGE type only.
- `$HAS_COMPONENT_CANDIDATES` (true/false): subset of the above, COMPONENT type only.

```yaml
header: "Design"
question: "Design spec found ({N} pages, {M} flows, {P} principles, {C} components). What do you want to do?"
# If $HAS_BUILD_CANDIDATES = true:
options:
  - label: "Build (Recommended)", description: "Generate code for {X} PAGE/COMPONENT(s) with status DEF — no visual material needed"
  - label: "Generate brief", description: "Markdown brief for Claude Design (page or component)"
  - label: "View", description: "Show current design spec"
  - label: "Page", description: "Add or edit a page"
  - label: "Component", description: "Add or edit a component"
# If $HAS_BUILD_CANDIDATES = false:
options:
  - label: "Generate brief (Recommended)", description: "Markdown brief for Claude Design (page or component)"
  - label: "View", description: "Show current design spec"
  - label: "Page", description: "Add or edit a page"
  - label: "Component", description: "Add or edit a component"
multiSelect: false
```

"Other" options: "Convert from sketch/mockup or URL" — a PAGE/COMPONENT name is **optional**: set `$CONVERT_TARGET` when one is provided or selected; without one the Convert route's PHASE 0.1 asks for the visual input itself. Then:

> **Todo**: Read `.claude/skills/design-convert/references/route-convert.md`

Also: "Flow" (manage flows), "Principles" (manage principles), "Delete" (remove page/component/flow/principle), "Restore" (go back to an earlier design state — only show if `.project/session/design-history.json` exists and is not empty).

---

## PHASE 1.5: Plan-Mode Gate (Conditional Entry)

The action chosen in PHASE 1 routes to a synthesis interview or a CRUD/self-managed action. Synthesis (design reasoning across one or more `AskUserQuestion` rounds) deserves the planning model — so enter plan mode here, before PHASE 2 dispatch, only when the chosen route is a synthesis route. See [shared/PLAN-MODE.md](../../shared/PLAN-MODE.md) § Conditional entry.

**Enter plan mode** (follow PLAN-MODE.md Entry protocol — call `EnterPlanMode` before PHASE 2) when the chosen route is one of:

- **Page**, **Component**, **Flow**, **Principles**, **Import**, **Brief**

`AskUserQuestion`, `Read`, `Glob`, `Grep` keep working in plan mode; only file writes are blocked — which is fine, every synthesis route defers its write to PHASE 3 confirm (Brief: to its Step 5 write boundary). The plan-file path arrives via system-reminder; the proposed design diff is written there for review at exit.

**Do NOT enter plan mode** for:

- **Build** and **Create** — these self-manage plan mode internally (Build enters at the **start** of `route-build.md` (Step 0b) so entity/candidate/spec decisions land on the planning model, and defers worktree creation to after `ExitPlanMode` (Step 7b) since the worktree git-writes must run outside plan mode; Create enters at `route-create.md`).
- **View**, **Delete**, **Restore** — pure CRUD, kept friction-free.

**Skip `EnterPlanMode` if already in plan mode** — if an active plan-mode system-reminder already exists (the user started `/plan-mode` themselves, or a prior synthesis loop already entered), skip the call and read the existing plan-file path from the active system-reminder.

---

## PHASE 2: Action Execution

### Route: Create (First-Time Setup)

> **Todo**: Read `.claude/skills/design-convert/references/route-create.md` for the guided 4-step creation flow (context → pages → flows → principles → summary).

---

### Route: Import (Extract from Codebase or Screenshot)

> **Todo**: Read `.claude/skills/design-convert/references/route-import.md` for codebase scan, screenshot analysis, component detection, and flow inference steps.

---

### Route: View

Read `project.json` → `design` section. Render as formatted table (same format as Create Step 5 summary).

```yaml
header: "Action"
question: "What do you want to do?"
options:
  - label: "Done", description: "Back to conversation"
  - label: "Edit", description: "Go to action selection"
multiSelect: false
```

If "Done": end skill, no state change.
If "Edit": loop back to PHASE 1 (ACTION_SELECT with populated-state options).

---

### Route: Page (Add/Edit Page)

> **Todo**: Read `.claude/skills/design-convert/references/route-page.md` for the add/edit page flow.

---

### Route: Component (Add/Edit)

> **Todo**: Read `.claude/skills/design-convert/references/route-component.md` for add/edit flows, component object schema, scope selection, and gap-discovery trigger.

---

### Route: Build (In-Claude-Code Code Generation)

**Domain gate (web spec→code build moved to `/design-ship`).** The web spec→code build lane is owned
by `/design-ship` (build → content → check in one auto-mode run). So:

- **`$DOMAIN === "web"`** → do **not** run route-build here. Print:
  `"Web spec→code build now runs via /design-ship {target} (build + content + runtime check). design-convert owns the spec, visual conversion, and game codegen."` and stop the Build action (the spec is already written by the Design route; the user runs `/design-ship {target}` to build it).
- **`$DOMAIN === "game"`** → continue to route-build below; its codegen step emits Godot `.tscn` via `render-godot.md` (there is no `/design-ship` for games).

> **Todo** (game domain only): Read `.claude/skills/design-convert/references/route-build.md` for the full build flow: entity selection, spec lookup + design levers, page composition, design directions (plan mode), code generation (game → `render-godot.md`), post-write checks, and completion sync (backlog + block inventory).

**Trigger:** only reachable if `$HAS_BUILD_CANDIDATES = true` (detected in PHASE 1) **and** `$DOMAIN === "game"`. Steps 0–11 are in the reference file above.

---

### Route: Flow (Add/Edit Flow)

Same structure as Page route.

#### If "New flow":

```yaml
header: "New Flow"
question: "Describe the flow: name and steps as page-to-page."
options:
  - label: "I'll type it out (Recommended)", description: "E.g.: 'onboarding: landing → signup → verify → dashboard'"
  - label: "Select from pages", description: "Choose pages and build the flow step by step"
multiSelect: false
```

If "Select from pages": show existing pages as multi-select to build flow sequence.

Cross-reference: for each step, check if page exists in `design.pages`. If not, warn and offer to create it.

#### If "Edit existing":

Show existing flows as options, then edit name/steps/notes. Same pattern as page edit.

Proceed to PHASE 3 (Confirm).

---

### Route: Principles (Add/Edit)

```yaml
header: "Principles"
question: "What do you want to do?"
options:
  - label: "Add (Recommended)", description: "Add a new principle"
  - label: "Edit", description: "Edit an existing principle"
multiSelect: false
```

**Adding:** Free-text input (name + description), parse, proceed to PHASE 3 (Confirm).

**Editing:** Show list of current principles as selectable options, then edit description. Proceed to PHASE 3 (Confirm).

---

### Route: Delete (Delete Item)

> **Todo**: Read `.claude/skills/design-convert/references/route-delete.md` for the deletion flow with cross-reference check.

---

### Route: Restore (Restore Checkpoint)

> **Todo**: Read `.claude/skills/design-convert/references/route-restore.md` for checkpoint load, diff preview, and restore flow.

---

### Route: Brief (Claude Design Handoff)

> **Todo**: Read `.claude/skills/design-convert/references/route-brief.md` for scope selection, component brief template, block inventory agent, token/patterns load, brief composition, and backlog sync.

---

## PHASE 3: Confirm + Loop

Reached after any mutating action. Show what will change:

```
CHANGES
════════════════════════════════════════════════
+ Page "checkout" added (3 sections)
~ Flow "purchase" updated (step added)
- Principle "Dark theme" removed

Total after change: {N} pages, {C} components, {M} flows, {P} principles
════════════════════════════════════════════════
```

**If plan mode was entered in PHASE 1.5** (and the skill did not start in plan mode): this confirm IS the plan-approval gate — follow [shared/PLAN-MODE.md](../../shared/PLAN-MODE.md) Exit protocol. Write the CHANGES diff above to the plan file, then call `ExitPlanMode`. Approval = "Yes, save"; proceed to PHASE X (writes run outside plan mode). Do not also show the `AskUserQuestion` modal below — `ExitPlanMode` replaces it. (If the skill was started in plan mode by the user, skip `ExitPlanMode` and use the modal below — let the user end plan mode themselves.)

**Otherwise** (CRUD path, no plan mode entered) — ask:

```yaml
header: "Confirm"
question: "Apply changes?"
options:
  - label: "Yes, save (Recommended)", description: "Write to project.json"
  - label: "Edit", description: "Back to action selection"
  - label: "Cancel", description: "Stop without changes"
multiSelect: false
```

If "Yes" (or plan approved): proceed to PHASE X (write + post-flight).
If "Edit": loop back to PHASE 1 (ACTION_SELECT with updated state — plan mode, if active, stays active; PHASE 1.5 re-entry is skipped via its already-in-plan-mode clause).
If "Cancel": exit cleanly, no changes written.

---

## PHASE X: Post-flight Validation

### X.0 Checkpoint Save (before write)

Save the current `design` section as a checkpoint in `.project/session/design-history.json` before writing. Skipped for Restore-restores (see Restore Step 4).

1. Use the current `design` state from PHASE 0.1 (already in memory — no new read needed). Skip if empty.
2. Read `.project/session/design-history.json` (create if not exists: `[]`).
3. Prepend new entry:
   ```json
   {
     "timestamp": "{ISO 8601}",
     "trigger": "{action description, e.g. 'Page checkout added'}",
     "snapshot": { "pages": [...], "flows": [...], "principles": [...] }
   }
   ```
4. Keep max 10 entries: drop oldest if `length > 10`.
5. Write back to `.project/session/design-history.json`.

### X.1 Write to project.json

Follow the Read/Write Protocol defined above. Only mutate the `design` section.

### X.2 Validate

1. **File validation** — project.json exists, is valid JSON
2. **Content validation:**
   - `design.pages` is an array, each page has `name`, `purpose`, `status`, `sections`
   - `design.flows` is an array, each flow has `name` and `steps` (non-empty array)
   - `design.principles` is an array, each principle has `name` and `description`
3. **Integrity check:**
   - Other project.json sections unchanged
   - No duplicate names within pages, flows, or principles
4. **Cross-reference check:**
   - Flow steps reference existing pages (warn if orphaned, don't block)

```
POST-FLIGHT CHECK
════════════════════════════════════════════════
File:       [✓] .project/project.json — valid JSON
Pages:      [✓] {N} pages — all valid
Flows:      [✓] {M} flows — all valid
Principles: [✓] {P} principles — all valid
Integrity:  [✓] other sections unchanged
CrossRef:   [✓|⚠] flow steps → pages
════════════════════════════════════════════════
```

**On failure:**

```yaml
header: "Validation"
question: "Post-flight validation failed. How do you want to proceed?"
options:
  - label: "Auto-fix (Recommended)", description: "Fix automatically"
  - label: "Fix manually", description: "I'll fix it myself"
  - label: "Ignore", description: "Continue despite error"
multiSelect: false
```

---

## Completion

> **Todo**: Read `.claude/skills/design-convert/references/completion-sync.md` for backlog sync, devinfo update, and completion report.

---

## Restrictions

This route must **NEVER**:

- Write design spec without user confirmation (PHASE 3)
- Auto-delete pages, flows, or principles (only via explicit "Delete" route)
- Overwrite other sections in project.json
- Skip pre-flight or post-flight validation
- Guess page structure without user input or codebase evidence (Import route)

This route must **ALWAYS**:

- Run design pre-flight (PHASE 0) before any operation
- Use AskUserQuestion for all user choices
- Show current values when editing existing items
- Show change preview before confirming (PHASE 3)
- Confirm before destructive actions with "No" as recommended option
- Save checkpoint (X.0) before every mutating write — except restores
- Run post-flight validation (PHASE X) after any write
- Cross-reference flow steps against defined pages
- Update DevInfo at completion
- Show completion report with next steps
