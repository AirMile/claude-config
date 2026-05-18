---
name: frontend-design
description: Manage design specs and generate PAGE/COMPONENT code. Use with /frontend-design. Auto-triggers when a backlog task with type PAGE or COMPONENT and transition "designing" is detected.
reads: [devinfo.handoff, backlog.status, feature.requirements, feature.files]
writes: [devinfo.handoff, devinfo.tokenDrift]
metadata:
  author: claude-config
  version: 2.8.2
  category: frontend
---

# Design

Three modes:

1. **Capture** — manages the project design specification (pages, user flows, design principles, components) in `.project/project.json` → `design`. Can be called iteratively.
2. **Brief** — generates a markdown brief based on the design spec + block inventory from the dev-pipeline + tokens + patterns. Paste the output into Claude Design as context. The visual work happens there; the handoff bundle from Claude Design goes back to Claude Code (`/frontend-convert`). Supports page-briefs and component-briefs.
3. **Build** — generates working code for PAGE or COMPONENT features. Accepts: backlog items with `transition: "designing"` (from `/project-backlog` or `/project-todo`) and design spec entries with `status: "DEF"`. For PAGE entities: shows a composition menu to select which features and components appear on the screen (including not-yet-built features rendered as TODO-markers). For visual input (screenshot/Figma/URL): use `/frontend-convert`.

**Related skills:** `/frontend-tokens` · `/frontend-convert` · `/core-setup` · `/frontend-check`

**Output locations:**

- Capture mode: `.project/project.json` → `design` section
- Brief mode: `.project/claude-design-brief.md`

## References

- `../shared/DASHBOARD.md` — project.json schema and merge strategies
- `../shared/DESIGN.md` — Anti-patterns, color, typography, motion, UX writing
- `../shared/DEVINFO.md` — Session tracking, cross-skill handoff
- `../shared/BACKLOG.md` — Backlog HTML+JSON format, read/write protocol
- `../shared/CODEGEN.md` — Code-gen patterns: block inventory, token mapping, output structure, a11y scaffold (Build route)

---

## Design JSON Schema

The `design` section in `project.json` follows this schema:

```json
{
  "pages": [
    {
      "name": "dashboard",
      "purpose": "Overview with metrics and status",
      "status": "DEF",
      "sections": ["hero", "metrics-grid", "activity-feed"],
      "flows": ["login → dashboard", "dashboard → settings"],
      "uses": [],
      "notes": ""
    }
  ],
  "flows": [
    {
      "name": "onboarding",
      "steps": ["landing", "signup", "verify-email", "dashboard"],
      "notes": ""
    }
  ],
  "principles": [
    {
      "name": "Mobile-first",
      "description": "Design for mobile viewport first, progressive enhancement"
    }
  ],
  "components": [
    {
      "name": "Button",
      "purpose": "Primary action trigger with icon support",
      "status": "DEF",
      "scope": "atomic",
      "appliesTo": "all",
      "variants": ["primary", "ghost", "destructive"],
      "sizes": ["sm", "md", "lg"],
      "states": ["default", "hover", "disabled", "loading"],
      "props": ["label", "icon?", "onClick", "disabled?"],
      "slots": [],
      "usedIn": [],
      "notes": ""
    }
  ]
}
```

**Status values (pages and components):** `IDEA` | `DEF` | `BLT` | `DONE`

**`pages[].uses[]`** — auto-maintained by Build/convert post-pass. List of component names imported by this page. Do not edit manually.

**`components[].usedIn[]`** — auto-maintained by Build/convert post-pass. List of page names that import this component. Do not edit manually.

**`components[].scope`:**

| Value     | Meaning                                                     | Example                 |
| --------- | ----------------------------------------------------------- | ----------------------- |
| `atomic`  | Small reusable element                                      | Button, Input, Avatar   |
| `section` | Composite within a single page                              | StatCard, ProductCard   |
| `layout`  | Multi-page wrapper, lives in `app/layout.tsx` or equivalent | NavBar, Footer, Sidebar |

**`components[].appliesTo`:** `"all"` | `["page1", "page2"]` | `"route-group:groupname"` (only relevant for `scope: layout`)

**Merge strategy:** `MERGE on name` — pages/flows/principles/components merge on name, update fields, never auto-delete.

---

## Forbidden choices (anti-slop)

NEVER use without explicit reason from the user. These choices signal AI-generated work and converge toward generic output:

- **Fonts**: Inter, Roboto, Arial, system-ui, Space Grotesk
- **Color schemes**: purple gradients on white background, tech-startup blue (#3B82F6 / Tailwind default), generic "AI purple"
- **Layouts**: 3-column features grid with emoji icons, hero-with-gradient-mesh, centered-narrow-column blog template
- **Component clichés**: floating glass cards, "trusted by" logo bar, gradient text on heading, blur-orb backgrounds, generic "modern SaaS" hero

Instead: choose a context-specific direction with intent. Vary between runs — two consecutive design sessions must not converge toward the same fonts/colors.

---

## State Machine

```
[*] → PREFLIGHT

PREFLIGHT → ARG_KNOWN (pass + argument matches existing entity)
PREFLIGHT → ARG_UNKNOWN (pass + argument given but unknown)
PREFLIGHT → ACTION_SELECT (pass + no argument)
PREFLIGHT → ERROR (fail)

ARG_KNOWN → BUILD (choice: Build)
ARG_KNOWN → BRIEF (choice: Brief)
ARG_KNOWN → PAGE_ROUTE (choice: Edit spec, PAGE entity)
ARG_KNOWN → COMPONENT (choice: Edit spec, COMPONENT entity)
ARG_KNOWN → CREATE (choice: Capture as new)

ARG_UNKNOWN → PAGE_ROUTE (choice: New page)
ARG_UNKNOWN → COMPONENT (choice: New component)
ARG_UNKNOWN → [*] (choice: Cancel)

ACTION_SELECT → CREATE (empty state)
ACTION_SELECT → IMPORT (empty state)
ACTION_SELECT → BUILD (populated + ≥1 PAGE or COMPONENT DEF without visuals)
ACTION_SELECT → VIEW (populated)
ACTION_SELECT → PAGE_ROUTE (populated)
ACTION_SELECT → COMPONENT (populated)
ACTION_SELECT → FLOW (populated)
ACTION_SELECT → PRINCIPLES (populated)
ACTION_SELECT → DELETE (populated)
ACTION_SELECT → RESTORE (populated, history exists)

CREATE → CONFIRM
IMPORT → CONFIRM
BUILD → BUILD_ENTITY (choose PAGE or COMPONENT)
BUILD_ENTITY → DESIGN_DIRECTION
DESIGN_DIRECTION → ALTERNATIVES_SELECT (≥2 variants or sections)
DESIGN_DIRECTION → BUILD_CODE (single-variant / stateless — skip alternatives)
ALTERNATIVES_SELECT → BUILD_CODE (layout chosen)
BUILD_CODE → BUILD_VERIFY (post-write checks pass)
BUILD_CODE → ACTION_SELECT (post-write check failed → "Fix manually")
BUILD_VERIFY → BUILD_COMPLETE ($VERIFY_STATUS = PASS or SKIPPED)
BUILD_VERIFY → ACTION_SELECT ($VERIFY_STATUS = FAIL → "Fix manually")
VIEW → ACTION_SELECT ("Edit")
VIEW → [*] ("Done")
PAGE_ROUTE → CONFIRM
COMPONENT → CONFIRM
FLOW → CONFIRM
PRINCIPLES → CONFIRM
DELETE → CONFIRM
RESTORE → POSTFLIGHT ("Yes" — skip X.0)
RESTORE → [*] ("Cancel")

CONFIRM → POSTFLIGHT ("Yes")
CONFIRM → ACTION_SELECT ("Edit" — loop back)
CONFIRM → [*] ("Cancel")

POSTFLIGHT → COMPLETE (pass)
POSTFLIGHT → RECOVER (fail)

BUILD_COMPLETE → [*]
COMPLETE → [*]
```

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
4. Never auto-delete items (only via explicit "Delete" route)
5. `pages[].uses[]` and `components[].usedIn[]` are auto-maintained by Build post-pass — never overwrite during merge

---

## PHASE 0: Pre-flight

### 0.1 Directory Check

Check `.project/` exists. If not, create it.

```
Directory: [✓|✗] .project/ — [exists | created | error]
```

### 0.2 Session Check

Read `.project/session/devinfo.json` for handoff from upstream skill.

```
Session: [✓] [New session | Continuing from {skill}]
```

### 0.3 Design State Check

Read `.project/project.json` and check if `design` section has data.

```
Design: [empty — guided setup available | {N} pages, {M} flows, {P} principles, {C} components]
```

### 0.5 Argument Detection

Detect whether a name was passed as an argument (`/frontend-design {name}`).

```
$SKILL_ARG = argument after /frontend-design (empty if no argument)
```

**If `$SKILL_ARG` is not empty:**

1. Check `design.pages[]` → entry with `name === $SKILL_ARG`? → `$ARG_MODE = "A"`, `$ARG_TYPE = "PAGE"`
2. Check `design.components[]` → entry with `name === $SKILL_ARG`? → `$ARG_MODE = "A"`, `$ARG_TYPE = "COMPONENT"`
3. Check backlog → PAGE/COMPONENT feature with `name === $SKILL_ARG`? → `$ARG_MODE = "A"`, `$ARG_TYPE = backlog type`
4. No match → `$ARG_MODE = "B"`, `$ARG_NAME = $SKILL_ARG`

**If `$SKILL_ARG` is empty:** `$ARG_MODE = "C"`

Add to pre-flight summary:

```
Argument:   [none | "{name}" → MODE A ({type} found) | "{name}" → MODE B (unknown)]
```

### 0.4 Learnings Load

**Learnings load** via [shared/LEARNINGS-LOAD.md](../shared/LEARNINGS-LOAD.md):

```
scopes: [component]
pitfall-prefix: true
current-feature: <page-name if capture/iterate-mode on 1 page, otherwise "none">
```

UI/UX patterns and pitfalls from previous designs drive consistent choices (component naming, layout patterns, accessibility gotchas). Skip silently if no learnings available.

**On failure:** AskUserQuestion:

```yaml
header: "Pre-flight"
question: "Pre-flight check failed. How do you want to proceed?"
options:
  - label: "Fix and retry (Recommended)", description: "Try to resolve the problem"
  - label: "Continue anyway", description: "Ignore and continue"
  - label: "Cancel", description: "Stop"
multiSelect: false
```

**Show pre-flight summary:**

```
PRE-FLIGHT CHECK
════════════════════════════════════════════════
Directory:  [✓|✗] .project/
Session:    [✓] [status]
Design:     [empty | {N} pages, {M} flows, {P} principles]
════════════════════════════════════════════════
```

---

## PHASE 1: Action Selection

Branching based on `$ARG_MODE` (determined in PHASE 0.5).

---

### Mode A — Existing entity (`$ARG_MODE = "A"`)

Entity found in design[]/backlog. Show entity-specific actions directly:

```yaml
header: "What do you want to do with {name}?"
question: "{$ARG_TYPE} '{name}' — {status}, {short spec summary from design.*}"
options:
  - label: "Build with Claude Code (Recommended)"
    description: "Generate code directly to repo"
  - label: "Brief for Claude Design"
    description: "Markdown handoff for Claude Design / Figma"
  - label: "Edit spec"
    description: "Update name, scope, variants or description"
  - label: "Capture as new (different name)"
    description: "I meant a different {$ARG_TYPE} — enter a new name"
multiSelect: false
```

Routing:

- "Build" → Route: Build (with `$ARG_TYPE` and `$ARG_ENTITY` pre-set, skip entity selection)
- "Brief" → Route: Brief (with entity pre-set)
- "Edit spec" → Route: Page or Component (depending on `$ARG_TYPE`, in edit mode)
- "Capture as new" → ask for new name → Route: Page or Component (in create mode)

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
multiSelect: false
```

### If design section HAS DATA:

Detect first:

- `$HAS_BUILD_CANDIDATES` (true/false): are there PAGE or COMPONENT items ready to build? True if **either**:
  - `design.pages[]` or `design.components[]` has an entry with `status: "DEF"` and no visual reference in `.project/wireframes/` or `.screenshots[]`, **or**
  - `backlog.html` has a feature with `(type === "PAGE" || type === "COMPONENT") && transition === "designing"` (newly created by `/project-backlog` or `/project-todo`).
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

"Other" options: "Flow" (manage flows), "Principles" (manage principles), "Delete" (remove page/component/flow/principle), "Restore" (go back to an earlier design state — only show if `.project/session/design-history.json` exists and is not empty).

---

## PHASE 2: Action Execution

### Route: Create (First-Time Setup)

> **Todo**: Read `.claude/skills/frontend-design/references/route-create.md` for the guided 4-step creation flow (context → pages → flows → principles → summary).

---

### Route: Import (Extract from Codebase or Screenshot)

> **Todo**: Read `.claude/skills/frontend-design/references/route-import.md` for codebase scan, screenshot analysis, component detection, and flow inference steps.

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

#### Step 1: Choice

```yaml
header: "Page"
question: "What do you want to do?"
options:
  - label: "Add new page (Recommended)", description: "Add a page to the design spec"
  - label: "Edit existing", description: "Edit an existing page"
multiSelect: false
```

#### If "Add new page":

```yaml
header: "New Page"
question: "Describe the page: name, purpose, and which sections/content it needs."
options:
  - label: "I'll type it out", description: "Free description"
multiSelect: false
```

Parse description into structured page object. Show preview, proceed to PHASE 3 (Confirm).

#### If "Edit existing":

Show existing pages as options (dynamically generated):

```yaml
header: "Edit"
question: "Which page do you want to edit?"
options:
  - label: "{page1.name}", description: "{page1.purpose} ({page1.status}) — {N} sections"
  - label: "{page2.name}", description: "{page2.purpose} ({page2.status}) — {N} sections"
  # ... max 4 options, rest via "Other"
multiSelect: false
```

Then ask what to change:

```yaml
header: "Edit: {page-name}"
question: "What do you want to update?"
options:
  - label: "Purpose", description: "Current: {purpose}"
  - label: "Sections", description: "Current: {sections joined}"
  - label: "Status", description: "Current: {status}"
  - label: "Notes", description: "Current: {notes or 'empty'}"
multiSelect: true
```

Process updates, proceed to PHASE 3 (Confirm).

---

### Route: Component (Add/Edit)

> **Todo**: Read `.claude/skills/frontend-design/references/route-component.md` for add/edit flows, component object schema, scope selection, and gap-discovery trigger.

---

### Route: Build (In-Claude-Code Code Generation)

> **Todo**: Read `.claude/skills/frontend-design/references/route-build.md` for the full build flow: entity selection, spec lookup, page composition, layout archetype, code generation, post-write checks, backlog sync, and block inventory.

**Trigger:** only reachable if `$HAS_BUILD_CANDIDATES = true` (detected in PHASE 1). Steps 0–11 are in the reference file above.

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

```yaml
header: "Delete"
question: "What do you want to delete?"
options:
  - label: "Page", description: "A page from the design spec"
  - label: "Component", description: "A component from the design spec"
  - label: "Flow", description: "A user flow"
  - label: "Principle", description: "A design principle"
multiSelect: false
```

Show items of selected type as options. After selection, confirm with safety pattern:

```yaml
header: "Confirm Deletion"
question: "Are you sure you want to delete '{item-name}'?"
options:
  - label: "No, cancel (Recommended)", description: "Keep item"
  - label: "Yes, remove", description: "Permanently remove"
multiSelect: false
```

**Cross-reference check:** When deleting a page, check if it's referenced in any flows. If so, warn:

```
⚠ Page "{page}" is used in flow(s): {flow-names}.
  These flow steps will be orphaned.
```

Proceed to PHASE 3 (Confirm).

---

### Route: Restore (Restore Checkpoint)

#### Step 1: Load Checkpoints

Read `.project/session/design-history.json`.

- If the file does not exist or is empty → show message and stop:
  ```
  ℹ No checkpoints available. Changes are only saved after the first write.
  ```

#### Step 2: Choose Checkpoint

Show the 4 most recent checkpoints as options:

```yaml
header: "Restore"
question: "Which checkpoint do you want to restore?"
options:
  - label: "{HH:mm DD-MM}", description: "{trigger} — {N} pages, {M} flows"
  # max 4 entries
multiSelect: false
```

#### Step 3: Show Diff

```
RESTORE PREVIEW
════════════════════════════════════════════════
Current: {N} pages, {M} flows, {P} principles
Restore: {N} pages, {M} flows, {P} principles

Removed:  {page/flow names that are gone in checkpoint}
Added:    {page/flow names that are new in checkpoint}
════════════════════════════════════════════════
```

#### Step 4: Confirm + Write

```yaml
header: "Restore"
question: "Are you sure you want to restore to this checkpoint?"
options:
  - label: "No, cancel (Recommended)", description: "Keep current state"
  - label: "Yes, restore", description: "Overwrite current design spec"
multiSelect: false
```

On "Yes": write `snapshot` from the chosen checkpoint back to `project.json → design`. Go directly to PHASE X.1 (Write) + PHASE X.2 (Validate) — skip X.0.

---

### Route: Brief (Claude Design Handoff)

> **Todo**: Read `.claude/skills/frontend-design/references/route-brief.md` for scope selection, component brief template, block inventory agent, token/patterns load, brief composition, and backlog sync.

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

```yaml
header: "Confirm"
question: "Apply changes?"
options:
  - label: "Yes, save (Recommended)", description: "Write to project.json"
  - label: "Edit", description: "Back to action selection"
  - label: "Cancel", description: "Stop without changes"
multiSelect: false
```

If "Yes": proceed to PHASE X (write + post-flight).
If "Edit": loop back to PHASE 1 (ACTION_SELECT with updated state).
If "Cancel": exit cleanly, no changes written.

---

## PHASE X: Post-flight Validation

### X.0 Checkpoint Save (before write)

Save the current `design` section as a checkpoint in `.project/session/design-history.json` before writing. Skipped for Restore-restores (see Restore Step 4).

1. Use the current `design` state from PHASE 0.3 (already in memory — no new read needed). Skip if empty.
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

> **Todo**: Read `.claude/skills/frontend-design/references/completion-sync.md` for backlog sync, devinfo update, and completion report.

---

## Restrictions

This skill must **NEVER**:

- Write design spec without user confirmation (PHASE 3)
- Auto-delete pages, flows, or principles (only via explicit "Delete" route)
- Overwrite other sections in project.json
- Skip pre-flight or post-flight validation
- Guess page structure without user input or codebase evidence (Import route)

This skill must **ALWAYS**:

- Run pre-flight validation (PHASE 0) before any operation
- Use AskUserQuestion for all user choices
- Show current values when editing existing items
- Show change preview before confirming (PHASE 3)
- Confirm before destructive actions with "No" as recommended option
- Save checkpoint (X.0) before every mutating write — except restores
- Run post-flight validation (PHASE X) after any write
- Cross-reference flow steps against defined pages
- Update DevInfo at completion
- Show completion report with next steps
