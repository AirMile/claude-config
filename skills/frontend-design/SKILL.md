---
name: frontend-design
description: >-
  Design spec management for pages and components — Claude Design brief generator + in-Claude-Code
  code generator for PAGE and COMPONENT features. Capture mode manages pages, flows, design principles
  and components in project.json — including screenshot-import (single/multi) and checkpoint-restore.
  Brief mode generates markdown briefs for Claude Design (page or component). Build mode generates
  working code for PAGE/COMPONENT features with status DEF without visual reference material.
  Works standalone — no dev-pipeline needed. Use with /frontend-design [name] or /frontend-design.
reads: [devinfo.handoff, backlog.status, feature.requirements, feature.files]
writes: [devinfo.handoff, devinfo.tokenDrift]
metadata:
  author: mileszeilstra
  version: 2.7.0
  category: frontend
---

# Design

Three modes:

1. **Capture** — manages the project design specification (pages, user flows, design principles, components) in `.project/project.json` → `design`. Can be called iteratively.
2. **Brief** — generates a markdown brief based on the design spec + block inventory from the dev-pipeline + tokens + patterns. Paste the output into Claude Design as context. The visual work happens there; the handoff bundle from Claude Design goes back to Claude Code (`/frontend-convert`). Supports page-briefs and component-briefs.
3. **Build** — generates working code for backlog features (PAGE or COMPONENT) with `status: DEF` for which no visual reference material is available. Reuses tokens + spec + existing components. For visual input (screenshot/Figma/URL): use `/frontend-convert`.

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
      "description": "Design voor mobile viewport eerst, progressive enhancement"
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
ARG_KNOWN → PAGINA (choice: Edit spec, PAGE entity)
ARG_KNOWN → COMPONENT (choice: Edit spec, COMPONENT entity)
ARG_KNOWN → AANMAKEN (choice: Capture as new)

ARG_UNKNOWN → PAGINA (choice: New page)
ARG_UNKNOWN → COMPONENT (choice: New component)
ARG_UNKNOWN → [*] (choice: Cancel)

ACTION_SELECT → AANMAKEN (empty state)
ACTION_SELECT → IMPORTEREN (empty state)
ACTION_SELECT → BUILD (populated + ≥1 PAGE or COMPONENT DEF without visuals)
ACTION_SELECT → BEKIJKEN (populated)
ACTION_SELECT → PAGINA (populated)
ACTION_SELECT → COMPONENT (populated)
ACTION_SELECT → FLOW (populated)
ACTION_SELECT → PRINCIPES (populated)
ACTION_SELECT → VERWIJDEREN (populated)
ACTION_SELECT → HERSTELLEN (populated, history exists)

AANMAKEN → CONFIRM
IMPORTEREN → CONFIRM
BUILD → BUILD_ENTITY (choose PAGE or COMPONENT)
BUILD_ENTITY → BUILD_COMPLETE (smoke success)
BUILD_ENTITY → BUILD_REFINE (smoke fail → "Refine")
BUILD_ENTITY → ACTION_SELECT (smoke fail → "Fix manually" or max retries reached)
BUILD_REFINE → BUILD_ENTITY (re-run smoke — max 3 rounds)
BUILD_REFINE → ACTION_SELECT ("Fix manually" or "Accept as-is")
BEKIJKEN → ACTION_SELECT ("Edit")
BEKIJKEN → [*] ("Done")
PAGINA → CONFIRM
COMPONENT → CONFIRM
FLOW → CONFIRM
PRINCIPES → CONFIRM
VERWIJDEREN → CONFIRM
HERSTELLEN → POSTFLIGHT ("Yes" — skip X.0)
HERSTELLEN → [*] ("Cancel")

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

- `$HAS_BUILD_CANDIDATES` (true/false): are there PAGE or COMPONENT features with `status: DEF` on the backlog for which no visual reference exists in `.project/wireframes/` or `design.pages[]/design.components[].screenshots[]`?
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

### Route: Aanmaken (First-Time Setup)

Guided 4-step creation flow.

#### Step 1: Project context

Check for concept:

Read `CONCEPT_CONTEXT` per `shared/CONCEPT.md` Reader.

**If `CONCEPT_CONTEXT.present`:**

```
PROJECT CONTEXT
════════════════════════════════════════════════
Name:    {CONCEPT_CONTEXT.name}
Concept: {CONCEPT_CONTEXT.markdown — first 200 chars}
════════════════════════════════════════════════
```

```yaml
header: "Context"
question: "Is this context still correct?"
options:
  - label: "Yes, continue (Recommended)", description: "Context is correct"
  - label: "I'll update it", description: "Describe the context again"
multiSelect: false
```

**If no concept:**

```yaml
header: "Context"
question: "Briefly describe what you're building and for whom."
options:
  - label: "I'll type it out", description: "Free description"
multiSelect: false
```

Store context for generating relevant page suggestions.

#### Step 2: Define pages

```yaml
header: "Pages"
question: "Which pages does your app need? Describe name + purpose per page."
options:
  - label: "I'll type them out (Recommended)", description: "Describe each page freely"
  - label: "Standard set", description: "Home, Dashboard, Settings, Login/Register"
  - label: "Later", description: "Skip pages, add later"
multiSelect: false
```

**If "Standard set":** Generate 4 default pages with generic purposes based on project context. Present for confirmation.

**If "I'll type them out":** User provides free-text list. Parse into structured page objects:

For EACH page, generate:

- `name`: slug-case (e.g., "dashboard", "user-settings")
- `purpose`: 1-2 sentences derived from user description
- `status`: `DEF`
- `sections`: derived from purpose (e.g., dashboard → "metrics-grid", "activity-feed")
- `flows`: initially empty (filled after flow definition)
- `notes`: empty

Show summary table:

```
PAGES
════════════════════════════════════════════════
| Name      | Purpose                       | Sections                     | Status |
|-----------|-------------------------------|------------------------------|--------|
| dashboard | Overview with metrics         | hero, metrics-grid, feed     | DEF    |
| settings  | Account settings              | profile-form, notifications  | DEF    |
════════════════════════════════════════════════
```

#### Step 2b: Design Alternatives (optional)

For pages with ≥3 sections, offer:

```yaml
header: "Alternatives"
question: "Do you want to compare alternative layouts for {page-name}?"
options:
  - label: "No, continue (Recommended)", description: "Current layout is fine"
  - label: "Yes, 2 alternatives", description: "Generate 2 radically different section layouts"
multiSelect: false
```

**If "Yes":** spawn 2 agents in parallel, each with a different constraint:

- Agent 1: "Minimize sections — max 2, combine where possible"
- Agent 2: "Maximize focus — each section has one purpose"

Present the 3 options (original + 2 alternatives) as ASCII wireframes.
User chooses via AskUserQuestion which layout, or combines elements.

For pages with <3 sections: skip this step.

```yaml
header: "Pages"
question: "Are these pages correct?"
options:
  - label: "Yes, continue (Recommended)", description: "Go to flows"
  - label: "Edit", description: "I want to change something"
multiSelect: false
```

If "Edit": ask what to change, update, re-confirm.

#### Step 3: User Flows

```yaml
header: "Flows"
question: "Which user flows are important? (e.g. onboarding, checkout, account setup)"
options:
  - label: "I'll type them out (Recommended)", description: "Describe each flow with steps"
  - label: "Derive from pages", description: "Generate flows based on defined pages"
  - label: "Later", description: "Skip flows, add later"
multiSelect: false
```

**If "Derive from pages":** Analyze defined pages and generate logical flows:

- Login-flow if login page exists
- Navigation flows between related pages
- CRUD flows if form pages exist

Present for confirmation.

**If "I'll type them out":** User provides descriptions. Parse into structured flow objects:

- `name`: descriptive name
- `steps`: array of page names as flow steps
- `notes`: empty

**Cross-reference:** For each step in a flow, check if the page exists in the defined pages. If not:

```
⚠ Flow "{flow}" references page "{page}" which has not been defined yet.
```

Offer to add missing pages.

Show summary:

```
FLOWS
════════════════════════════════════════════════
| Name        | Steps                                      |
|-------------|--------------------------------------------|
| onboarding  | landing → signup → verify → dashboard      |
| settings    | dashboard → settings → save → dashboard    |
════════════════════════════════════════════════
```

#### Step 4: Design Principles

```yaml
header: "Principles"
question: "Which design principles apply?"
options:
  - label: "Standard set (Recommended)", description: "Mobile-first, Consistent spacing, Accessibility (WCAG AA)"
  - label: "I'll define my own", description: "Enter custom principles"
  - label: "Later", description: "Skip principles, add later"
multiSelect: false
```

**If "Standard set":** Generate:

- Mobile-first: "Design for mobile viewport first, progressive enhancement"
- Consistent spacing: "Use a spacing scale for all margins and padding"
- Accessibility: "WCAG 2.1 AA compliance, semantic HTML, keyboard navigation"

**If "I'll define my own":** Free-text input, parse into `{ name, description }` objects.

#### Step 5: Summary

Show complete summary:

```
DESIGN SPEC SUMMARY
════════════════════════════════════════════════

Pages ({N}):
| Name      | Purpose                 | Sections                 | Status |
|-----------|-------------------------|--------------------------|--------|
| dashboard | Overview with metrics   | hero, metrics-grid, feed | DEF    |
| settings  | Account settings        | profile-form, notifs     | DEF    |

Flows ({M}):
| Name       | Steps                                   |
|------------|-----------------------------------------|
| onboarding | landing → signup → verify → dashboard   |

Principles ({P}):
| Name          | Description                                      |
|---------------|--------------------------------------------------|
| Mobile-first  | Design for mobile viewport first                 |
| Accessibility | WCAG 2.1 AA compliance, semantic HTML            |

════════════════════════════════════════════════
```

Proceed to PHASE 3 (Confirm).

---

### Route: Importeren (Extract from Codebase or Screenshot)

#### Step 0: Input Selection

```yaml
header: "Import"
question: "What is your input?"
options:
  - label: "Codebase (Recommended)", description: "Scan framework files for pages and flows"
  - label: "Screenshot", description: "Analyze a screenshot of an existing design"
multiSelect: false
```

**If "Screenshot":** go to Step 0b. **If "Codebase":** go to Step 1.

#### Step 0b: Screenshot Analysis

1. **Detect input method:**
   - If there are **multiple images** in the conversation → report count and proceed directly to analysis:
     ```
     ℹ {N} screenshots detected — each image will be analyzed as a separate page.
     ```
   - If there is **one image** in the conversation → use it directly.
   - If there is **no image** in the conversation:

     ```yaml
     header: "Screenshot"
     question: "Add a screenshot to your next message, or provide a file path."
     options:
       - label: "I'll add it (Recommended)", description: "Drag or use the attachment button in VSCode"
       - label: "File path", description: "Provide an absolute or relative path"
     multiSelect: false
     ```

     - "I'll add it": wait for the next message and use the attached image(s).
     - "File path": read the image via the Read tool at the given path.

2. **Analyze visually (Claude Vision):**

   Per image separately:
   - Detect page type (landing, dashboard, form, checkout, settings, etc.)
   - Identify visible sections (hero, nav, sidebar, content-area, footer, cards, etc.)
   - Infer purpose from layout and visible content

   For multiple images: spawn N agents in parallel (one per image), merge results, show progress:

   ```
   Image 1/{N}: [page type] — {M} sections detected
   Image 2/{N}: [page type] — {M} sections detected
   ...
   ```

3. **Generate page object per image:**

   ```json
   {
     "name": "{slug of page type}",
     "purpose": "{derived from screenshot — 1-2 sentences}",
     "status": "IDEA",
     "sections": ["{section1}", "{section2}"],
     "flows": [],
     "notes": "Imported via screenshot"
   }
   ```

   Deduplicate on `name`: if two screenshots detect the same page type, suffix the second with `-2`.

4. Go to Step 4: Present and Confirm (table shows all imported page objects as rows).

---

#### Step 1: Scan

Glob for page files AND component files in common framework patterns:

**Pages:**

| Framework          | Pattern                     |
| ------------------ | --------------------------- |
| Next.js App Router | `app/**/page.{tsx,jsx}`     |
| Next.js Pages      | `src/pages/**/*.{tsx,jsx}`  |
| Vite + React       | `src/pages/**/*.{tsx,jsx}`  |
| Remix              | `app/routes/**/*.{tsx,jsx}` |
| Astro              | `src/pages/**/*.astro`      |

**Components** (scan alongside pages):

- `src/components/**/*.{tsx,jsx,svelte,vue,astro}`
- `app/components/**/*.{tsx,jsx}`
- `src/components/ui/**/*.{tsx,jsx}` (shadcn/ui convention)
- Exclude: `_dev/`, `node_modules/`, `*.test.*`, `*.stories.*`

```
SCAN RESULT
════════════════════════════════════════════════
Framework:   [detected]
Pages:       {N} found
Components:  {M} found
════════════════════════════════════════════════
```

#### Step 2: Parse Pages

For each detected page file:

- Extract page name from file path
- Analyze imports to detect section components → populate `uses[]`
- Infer purpose from component names and composition

#### Step 2b: Parse Components

For each detected component file (parallel with Step 2):

1. Extract component name from filename (PascalCase)
2. Check if name already in `design.components[]` → skip if existing
3. Detect scope heuristic:
   - File in `layout.tsx` import tree → `scope: layout`
   - Imported by ≥2 pages → `scope: section` or `atomic`
   - Only in `ui/` folder → `scope: atomic`
   - Standalone in `components/` → `scope: section`
4. Detect cva-variants/sizes via regex: `variants.variant[]`, `variants.size[]`
5. Scan all page imports → populate `usedIn[]`
6. Generate component object with `status: BLT` (already built)

Show preview of detected components:

```
COMPONENTS FOUND
════════════════════════════════════════════════
| Name    | Scope   | Variants          | UsedIn      |
|---------|---------|-------------------|-------------|
| Button  | atomic  | primary/ghost/... | dashboard   |
| NavBar  | layout  | —                 | (all pages) |
| StatCard| section | —                 | dashboard   |
════════════════════════════════════════════════
```

```yaml
header: "Import components"
question: "Which components do you want to include in the design spec?"
options:
  - label: "All ({M} components)", description: "Add all found components"
  - label: "Select", description: "Choose manually which ones"
  - label: "None", description: "Skip component import"
multiSelect: false
```

For "Select": show as multiSelect with all component names as options.

#### Step 3: Infer Flows

From routing structure and navigation components (Link, useRouter, navigate), infer user flows between pages.

#### Step 4: Present and Confirm

Show extracted design spec in same table format as Aanmaken Step 5, including components table if components were imported. Proceed to PHASE 3 (Confirm).

---

### Route: Bekijken (View)

Read `project.json` → `design` section. Render as formatted table (same format as Aanmaken Step 5 summary).

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

### Route: Pagina (Add/Edit Page)

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

#### Step 1: Choice

```yaml
header: "Component"
question: "What do you want to do?"
options:
  - label: "Add new component (Recommended)", description: "Add a component to the design spec"
  - label: "Edit existing", description: "Edit an existing component"
multiSelect: false
```

#### If "Add new component":

```yaml
header: "New Component"
question: "Describe the component: name, purpose, and which variants/states it has."
options:
  - label: "I'll type it out", description: "Free description"
multiSelect: false
```

Parse description and ask additionally:

```yaml
header: "Component details"
question: "What type of component is this?"
options:
  - label: "Atomic (Recommended)", description: "Small reusable element — Button, Input, Avatar"
  - label: "Section", description: "Composite within a single page — StatCard, ProductCard"
  - label: "Layout", description: "Multi-page wrapper — NavBar, Footer, Sidebar"
multiSelect: false
```

If `scope: layout`: additionally set `appliesTo`:

```yaml
header: "Scope"
question: "Which pages does this apply to?"
options:
  - label: "All pages (Recommended)", description: "Every page — adds to root layout"
  - label: "Specific pages", description: "Select which pages"
  - label: "Route group", description: "E.g. all authenticated pages"
multiSelect: false
```

Generate component object:

```json
{
  "name": "{slug}",
  "purpose": "{derived from description}",
  "status": "DEF",
  "scope": "{atomic|section|layout}",
  "appliesTo": "{all | [page-names] | route-group:name}",
  "variants": [],
  "sizes": [],
  "states": ["default"],
  "props": [],
  "slots": [],
  "usedIn": [],
  "notes": ""
}
```

Show preview table:

```
COMPONENT
════════════════════════════════════════════════
| Name    | Purpose                | Scope   | Variants          | Status |
|---------|------------------------|---------|-------------------|--------|
| button  | Primary action trigger | atomic  | primary/ghost/... | DEF    |
════════════════════════════════════════════════
```

Proceed to PHASE 3 (Confirm).

On confirmation:

1. Append to `project.json#design.components[]`
2. Append to `backlog.html` as COMPONENT feature with `status: TODO`, `phase: P3`, `source: "/frontend-design"`, `scope: {scope}`
3. Update `data.updated`
4. **Gap-discovery** — follow [Discovery — Gap-Discovery](../shared/SKILL-PATTERNS.md#gap-discovery), Trigger A: scan `props[]` for handler patterns and show AskUserQuestion per found gap.

#### If "Edit existing":

Show existing components as options:

```yaml
header: "Edit"
question: "Which component do you want to edit?"
options:
  - label: "{component1.name}", description: "{component1.purpose} ({component1.status}) — {scope}"
  - label: "{component2.name}", description: "..."
  # max 4, rest via Other
multiSelect: false
```

Then:

```yaml
header: "Edit: {component-name}"
question: "What do you want to update?"
options:
  - label: "Purpose", description: "Current: {purpose}"
  - label: "Variants/Sizes/States", description: "Current: {variants joined}"
  - label: "Props/Slots", description: "Current: {props joined}"
  - label: "Status", description: "Current: {status}"
  - label: "Scope / appliesTo", description: "Current: {scope}"
  - label: "Notes", description: "Current: {notes or 'empty'}"
multiSelect: true
```

Process updates, proceed to PHASE 3 (Confirm).

---

### Route: Build (In-Claude-Code Code Generation)

Generates working code for PAGE or COMPONENT features with `status: DEF` and no visual reference material. See `../shared/CODEGEN.md` for the shared code-gen patterns also used by `frontend-convert`.

**Trigger:** only reachable if `$HAS_BUILD_CANDIDATES = true` (detected in PHASE 1).

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
  - label: "{kebab-name}", description: "{description} — {route-pattern}"
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

#### Step 3: Spec lookup (entity-agnostic)

**If `$TARGET_TYPE = PAGE`:**

1. Look up `.project/features/{$TARGET}/feature.json` → read as spec source (primary).
2. Fallback: `design.pages[]` filtered by name matching `$TARGET`.
3. If both empty → AskUserQuestion: "Briefly describe the page: purpose, sections, actions." → store as inline spec and write to `design.pages[]` for later reuse.

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
3. If both empty → AskUserQuestion: "Briefly describe the component: purpose, variants, props." → store as inline spec and write to `design.components[]` for later reuse.

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

#### Step 4: Generate (entity-aware)

Consult `../shared/CODEGEN.md` for full patterns. Output path determined by entity type and scope:

| Entity              | Output-pad                                           | Sub-output                          |
| ------------------- | ---------------------------------------------------- | ----------------------------------- |
| PAGE                | `app/{route}/page.tsx` (of framework-equivalent)     | `app/{route}/_components/{Sub}.tsx` |
| COMPONENT (atomic)  | `src/components/ui/{Name}.tsx`                       | —                                   |
| COMPONENT (section) | `src/components/{Name}.tsx`                          | —                                   |
| COMPONENT (layout)  | `src/components/{Name}.tsx` + patch `app/layout.tsx` | Demo page (see below)               |

**Auto-patch for layout components:** if `scope: layout`, Build adds an import + render statement to `app/layout.tsx` (or framework equivalent). For `appliesTo: route-group:X`: patch in `app/(X)/layout.tsx`. Detect existing imports before patching — show conflict warning on duplicate and ask for confirmation.

**Demo page for COMPONENT:** generate `app/_dev/components/{name}/page.tsx` (gitignored) showing all variants × sizes × states — used for smoke-render in Step 4b.

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
question: "Is this plan correct? Then I'll generate the code."
options:
  - label: "Generate (Recommended)", description: "Plan is correct, write the files"
  - label: "Adjust plan", description: "I want to change something"
multiSelect: false
```

After confirmation — generate code:

- Semantic HTML layout (PAGE) or cva component (COMPONENT) based on spec
- Reuse existing components where matching (import from their paths in `components[]`)
- Tailwind/CSS classes via theme tokens — **no raw hex** (`#…`) or arbitrary color-values (`bg-[#…]`)
- Images: only `/placeholder.svg?w={W}&h={H}` (PAGE only) — never external CDN URLs
- Accessibility: `<main>`, `<section>`, `aria-label`, skip-nav (PAGE); correct ARIA attributes (COMPONENT)

```yaml
header: "Write"
question: "Write files?"
options:
  - label: "Write files (Recommended)", description: "Apply files to disk"
  - label: "Adjust before writing", description: "Change something before writing"
multiSelect: false
```

Write files after confirmation.

#### Step 4: Post-write checks + smoke render

**4a. Static checks** (no dev server needed — run directly after file write):

**Hex post-pass** — scan every generated `.tsx`/`.vue`/`.svelte`/`.css` file:

- Forbidden: `#[0-9a-fA-F]{3,8}` in `className`-strings of inline-style props (outside `//` and `/* */` comments)
- Forbidden: arbitrary Tailwind color-values `bg-[#`, `text-[#`, `border-[#`
- Forbidden: external placeholder-URLs (`images.unsplash.com`, `picsum.photos`, `placehold.co`, `fakeimg.pl`)

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

**Unknown-import scan** — scan every generated file for `from ['"](.+?)['"]`:

- Relative imports (`./`, `../`, `@/`): check if file exists in project structure
- Bare imports: check presence in `package.json`
- On unresolved imports → show list, note as missing dependency in completion report

**4b. Smoke render** (requires dev server):

Check availability: `curl -s http://localhost:{port}` (port from `project.json` or CLAUDE.md).

If dev server not available: skip 4b entirely with message `"Dev server unreachable — open manually."`. Proceed to Step 5.

Als beschikbaar:

**Route bepaling per entity-type:**

- `$TARGET_TYPE = PAGE` → navigate naar page-route.
- `$TARGET_TYPE = COMPONENT` → navigate naar `/_dev/components/{$TARGET}` (de demo-page).

**Basic smoke checks (daemon):**

1. **Check 1 — Console errors**: 0 fatal errors (`playwright-cli console error` filtered against default ignore patterns)
2. **Check 2 — Layout intact**: body height > 100px, width > 200px
3. **Check 3 — Tokens loaded**: computed style of `--color-primary` or equivalent is not an empty string
4. **Check 4 — Layout collapse**: iterates through `<main>` direct children; fails if ≥1 element has `offsetHeight === 0` or `offsetWidth === 0`
5. **Check 5 — Variant matrix (COMPONENT only)**: checks if `<main>` contains ≥ `{variants.length × sizes.length}` child blocks

**Multi-viewport screenshots (daemon — altijd draaien):**

Capture op 375 (mobile) en 1440 (desktop). Per viewport:

```
playwright-cli open {url}
playwright-cli resize 375 900
playwright-cli run-code "async p => { await p.waitForTimeout(500); }"
playwright-cli screenshot --filename=.project/wireframes/{$TARGET}-375.png
playwright-cli resize 1440 900
playwright-cli run-code "async p => { await p.waitForTimeout(500); }"
playwright-cli screenshot --filename=.project/wireframes/{$TARGET}-1440.png
playwright-cli close
```

**Dark/light screenshots (daemon — als `project.json#theme.modes.dark` bestaat):**

```
playwright-cli run-code "async page => {
  const ctx = await page.context().browser().newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  const p = await ctx.newPage();
  await p.goto('{url}');
  await p.waitForLoadState('networkidle');
  await p.screenshot({ path: '.project/wireframes/{$TARGET}-dark.png' });
  await ctx.close();
}"
```

**A11y smoke (mandatory — auto-install if missing):**

Check if `@axe-core/playwright` is available: `node -e "require('@axe-core/playwright')" 2>/dev/null`.

- **Available**: run axe via `playwright-cli run-code`. Fail on `critical`, show `serious` as warning.
- **Not available**: AskUserQuestion:
  ```yaml
  header: "axe-core"
  question: "@axe-core/playwright is not installed. A11y check is required for Build smoke."
  options:
    - label: "Install now (Recommended)"
      description: "npm install --save-dev @axe-core/playwright — then re-run"
    - label: "Skip (once)"
      description: "Note as missing dep in report, continue"
  ```
  On "Install now": `npm install --save-dev @axe-core/playwright`, then run the axe check. On "Skip": note as `MISSING_DEP: @axe-core/playwright` in report.

**Aria-snapshot baseline (runner — after daemon checks):**

Generate an on-the-fly runner spec for aria-snapshot assertion. First run creates baseline; subsequent runs fail on structural regression. See `shared/PLAYWRIGHT.md → Runner Mode` for the full on-the-fly pattern.

```typescript
// .project/playwright-runs/design-{$TARGET}.spec.ts  (tijdelijk)
import { test, expect } from "@playwright/test";
test("aria snapshot — {$TARGET}", async ({ page }) => {
  await page.goto("{url}");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("main")).toMatchAriaSnapshot();
  // baseline: .project/playwright-runs/__screenshots__/design-{$TARGET}-main-aria.yaml
});
```

Draai: `npx playwright test .project/playwright-runs/design-{$TARGET}.spec.ts --config=.project/playwright-runs/playwright.config.ts [--update-snapshots bij eerste run]`

Bij runner niet beschikbaar (`npx playwright --version` faalt): skip aria-snapshot, noteer als `SKIPPED: runner niet beschikbaar`.

```
SMOKE CHECKS: {$TARGET} ({$TARGET_TYPE})
──────────────────────────────────────────────────
✓ Console errors       0 fatal
✓ Layout intact        body 1024×768
✓ Tokens loaded        --color-primary OK
✓ Section collapse     0 collapsed
✓ Multi-viewport       375px OK · 1440px OK
✓ Dark mode            .project/wireframes/{$TARGET}-dark.png  (only if dark mode enabled)
✓ Variant matrix       6/6 variants visible  (COMPONENT only)
✓ axe a11y             0 critical
✓ Aria snapshot        baseline created / no regression
──────────────────────────────────────────────────
```

**4c. On failure:**

```yaml
header: "Smoke check failed"
question: "Check failed: {description}. How to proceed?"
options:
  - label: "Refine (Recommended)", description: "Describe what needs to change — I'll only edit that section"
  - label: "Fix manually", description: "I'll fix it myself"
  - label: "Open in convert", description: "/frontend-convert patch for visual rework (PAGE only)"
  - label: "Skip verification", description: "Continue without verifying"
multiSelect: false
```

**Refine loop** (on "Refine" — max 3 rounds):

1. AskUserQuestion: "Which section?" — show `<main>` direct children as options
2. AskUserQuestion: "What needs to change?" — free text
3. Edit on **only** that section (never Write on entire file)
4. Re-run checks 4b
5. On persistent failure after 3 rounds → AskUserQuestion: "Fix manually | Open in convert | Accept as-is"

**On "Open in convert"** (PAGE only — COMPONENT has no convert flow):

Write to `.project/session/devinfo.json`:

```json
{
  "handoff": {
    "source": "build-incomplete",
    "target": "{$TARGET}",
    "files": ["{generated-file-1}", "{generated-file-2}"],
    "failedChecks": ["{check-name-1}", "{check-name-2}"],
    "reason": "smoke-fail",
    "buildScreenshot": "{screenshot-pad of null}",
    "timestamp": "{ISO-timestamp}"
  }
}
```

```
BUILD INCOMPLETE: {$TARGET}

Failed checks:    {lijst}
Files written:    {pad-1, pad-2}
Handoff saved:    devinfo.handoff (source: build-incomplete)

Next:  /frontend-convert {$TARGET}   (auto-detected handoff → patch mode)
```

#### Step 5: Backlog sync + Block inventory + Drift cleanup

**5a. Block inventory** (only on smoke PASS):

Parse all `$GENERATED_FILES` → filter on component paths (`_components/`, `src/components/`, `app/components/`). Skip page files (`page.tsx`, `+page.svelte`, route-level files). Per component file:

1. Extract named exports with regex: `export (function|const|default) (\w+)` + `export { … }`
2. Detect cva-variants if `cva(` present: extract `variants.variant[]` and `variants.size[]`
3. Store as entry: `{ name, src, exports, variants, sizes }`
4. Conflict check on `components[].name`:
   - Same name + different `src` → skip + note as conflict
   - Same name + same `src` → merge (idempotent re-run)
   - New → append
5. Read `.project/project-context.json` → update `components[]` → Write back (only if changes)

**5b. Bidirectional linking** (only on smoke PASS):

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

**5c. TokenDrift cleanup** (on smoke PASS):

Read `.project/session/devinfo.json` → check `tokenDrift.affectedFeatures`. If `{$TARGET}` is in it: remove from the list. If list is then empty: set `tokenDrift.resolved = true`. Write back.

**5d. Backlog sync**:

Parse `backlog.html` → match on `name === {$TARGET}`:

- Smoke success → `feature.status = "DOING"` + `feature.audit.buildScreenshot = {path}` + `feature.audit.buildSmokeStatus = "PASS"`
- Smoke fail → backlog status **unchanged** (stays TODO or DEFINED). Set `feature.audit.buildSmokeStatus = "FAIL"` + `feature.audit.buildSmokeError = {short reason}`.
- Smoke skip → backlog status **unchanged**. Set `feature.audit.buildSmokeStatus = "SKIPPED"`.

Update `data.updated` only on smoke success. Edit back to `backlog.html`.

Store block inventory counters as `$INV_NEW`, `$INV_UPDATED`, `$INV_CONFLICTS` for use in Step 6.

**5e. Gap-discovery** (always, regardless of smoke status):

Follow [Discovery — Gap-Discovery](../shared/SKILL-PATTERNS.md#gap-discovery), Trigger C (Build post code-gen): scan `$GENERATED_FILES` for stub handlers and show AskUserQuestion per found gap. If no gaps: skip step.

#### Step 6: Completion report

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
Smoke render:     {PASS | FAIL | SKIPPED}
Screenshot:       {path or n/a}
Gaps:             {N linked | M created | K pending | "none"}
```

Ask after report:

```yaml
header: "Continue with audit?"
question: "/frontend-check {$TARGET} checks A11Y, tokens and responsive behavior."
options:
  - label: "Yes, audit now (Recommended)", description: "Run frontend-check inline"
  - label: "Later", description: "Status stays DOING — /frontend-check {$TARGET} is ready in the backlog"
multiSelect: false
```

On "Yes": read `frontend-check/SKILL.md` and run PHASE 0–4 inline for `{$TARGET}`.
On "Later": end — backlog shows DOING status with next-step `/frontend-check {$TARGET}`.

---

### Route: Flow (Add/Edit Flow)

Same structure as Pagina route.

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

#### If "Bestaande bewerken":

Show existing flows as options, then edit name/steps/notes. Same pattern as page edit.

Proceed to PHASE 3 (Confirm).

---

### Route: Principes (Add/Edit)

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

### Route: Verwijderen (Delete Item)

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

### Route: Herstellen (Restore Checkpoint)

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

Generate a markdown brief to paste into Claude Design. The brief bundles all context Claude Design needs to generate visuals that match the project (so you don't get duplicate components or inconsistent tokens).

#### Step 1: Scope

```yaml
header: "Brief Scope"
question: "What are you generating the brief for?"
options:
  - label: "Specific page (Recommended)", description: "Brief for one page from design.pages"
  - label: "Component", description: "Brief for one component from design.components"
  - label: "Both", description: "Separate briefs for page + component"
  - label: "Flow", description: "Brief for a user flow (multiple pages as sequence)"
multiSelect: false
```

**If "Specific page":** show `design.pages` with status DEF/IDEA as options (max 4, rest via Other). User chooses page. → go to Step 2 (page-flow).

**If "Component":** show `design.components` as options (max 4, rest via Other). User chooses component. → go to Step 1b (component-brief).

**If "Both":** choose page and component. Generate two separate files.

**If "Flow":** show `design.flows` as options. User chooses flow. Brief contains all pages in `flow.steps`. → go to Step 2 (page-flow).

**If "Full app":** no extra choice needed. → go to Step 2 (page-flow).

#### Step 1b: Generate Component Brief

Store as `$TARGET_COMPONENT` (name of chosen component from `design.components[]`).

Run Step 2 (block inventory) and Step 3 (tokens) in parallel, then write component brief:

Output-pad: `.project/claude-design-brief-{component-name}.md`

```markdown
# Component Brief: {ComponentName}

_Generated by /frontend-design · {date}_

## Purpose

{purpose from design.components[].purpose}

## Scope

{atomic | section | layout} — appliesTo: {appliesTo}

## Variant Matrix

| Variant      | Size      | State    | Visual treatment |
| ------------ | --------- | -------- | ---------------- |
| {variant[0]} | {size[0]} | default  |                  |
| {variant[0]} | {size[0]} | hover    |                  |
| {variant[0]} | {size[0]} | disabled |                  |

{repeat per variant × size combination from spec}

## Props

{props[] from spec — bullet list}

## Slots

{slots[] or "none"}

## States

{states[] with hints — e.g. "disabled: opacity-50, pointer-events-none"}

## Design Tokens

{Primary tokens from project.json#theme relevant to this component:
colors.primary, colors.foreground, colors.border, etc.}

## Block Inventory (possible baseline)

{components[] from project-context.json where name overlaps:}

- `{existing-component}` ({path}) — {description}
  {or "No comparable existing components found"}

## Used In (context)

{usedIn[] — pages already using this component, for visual consistency:}
{or "New component — not yet in use"}

## Patterns & Conventions

- TypeScript strict mode
- `cn()` utility for className composition
- cva (class-variance-authority) for variants — check presence in package.json
- Tailwind scale (no arbitrary values)
- ARIA: {relevant aria attributes for this component type}

## Output

shadcn/ui-style cva component with:

- variants: {variants joined}
- sizes: {sizes joined}
- asChild support (Radix UI pattern, if applicable)
- Handoff bundle for `/frontend-convert` (code → implementation)
```

After generation: go to Step 5 (write file + show summary).

#### Step 2: Block Inventory

Spawn an Explore agent to inventory the dev-pipeline blocks. This isolates recursive import tracing from the main context.

Agent prompt:

```
Inventory the existing frontend building blocks in this project.

1. Detect framework via package.json (Next.js App Router, Next.js Pages, Vite + React, Remix, Astro).
2. Scan components directories:
   - src/components/**/*.{tsx,jsx}
   - app/components/**/*.{tsx,jsx}
   - components/**/*.{tsx,jsx}
   Report per component: name, file location, exported props (interface), and one line description of what it does (derived from name + JSX).
3. Scan hooks:
   - src/hooks/**/*.{ts,tsx}
   Report per hook: name, what it returns, which API/service it calls (if visible).
4. Scan services/API clients:
   - src/services/**/*.{ts,tsx}
   - src/lib/api/**/*.{ts,tsx}
   Report per service: function name, endpoint, return type.

Return as structured list. Focus on REUSABILITY — which existing blocks are applicable for new pages?
```

Agent output becomes the "Block Inventory" section in the brief.

**Fallback if framework/dirs not found:** skip inventory, note in brief: `Block inventory: n/a (no components built yet)`.

#### Step 3: Tokens + Patterns

1. Read `.project/project.json` → `theme` section (if present). Extract: colors, typography, spacing, cssVars.
   For typography: extract semantic type scale names (`text-display`, `text-title-*`, `text-headline-*`, `text-body-*`, `text-code`) from `theme.typography.sizes[].token` if present. Store as `$TYPE_SCALE`.
   For dark mode: check `theme.modes.dark` in project.json. Store as `$HAS_DARK_MODE` (true/false).
   For motion: check `theme.motion` in project.json. Store as `$MOTION_TOKENS` (true/false).
2. Read `shared/PATTERNS.md` → extract pattern names and one-line descriptions (compound components, render props, etc).
3. If `theme` is missing: note `Tokens: Tailwind defaults (no theme defined)`.

#### Step 4: Compose Brief

Write `.project/claude-design-brief.md`:

```markdown
# Claude Design Brief — {scope name}

_Generated by /frontend-design · {date}_

## Project Context

{concept source in priority order:

{`CONCEPT_CONTEXT.markdown` if present, otherwise `CONCEPT_CONTEXT.pitch`, otherwise "No concept defined" — see `shared/CONCEPT.md`}
}

## Design Principles

{design.principles[].name + description, bullet list}

## Scope

{If page: single page spec}
{If flow: flow + page sequence}
{If full: all pages}

### Page: {name}

- **Purpose**: {purpose}
- **Sections**: {sections joined}
- **Related flows**: {flows joined}
- **Status**: {status}

{repeat per page if multiple}

## Design Tokens

{If theme populated:}

- **Colors**: {primary, secondary, accent, bg, text}
- **Typography**: {font families}
  {If $TYPE_SCALE populated:}
  Semantic scale: `text-display`, `text-title-l/m/s`, `text-headline-l/m/s`, `text-body-l/m/s`, `text-code`
  {If $TYPE_SCALE empty:}
  No semantic scale defined — use Tailwind text-scale or propose custom semantic groups in the design.
- **Spacing**: {scale}
- **CSS vars**: {list}

{If $HAS_DARK_MODE:}

- **Dark mode**: `.dark` class on root element activates dark mode — design for both variants. Show key screens in light and dark side by side.

{If $MOTION_TOKENS:}

- **Motion**: `duration-instant` (100ms) for buttons/toggles · `duration-fast` (200ms) for tooltips/hovers · `duration-normal` (300ms) for menus/accordions · `duration-slow` (500ms) for modals/drawers. Easing: `ease-out` (enter), `ease-in` (exit), `ease-in-out` (toggle). Specify which token applies per interactive element.

{If no theme:}
Tailwind defaults — Claude Design may propose its own palette (note the choice in the handoff).

## Block Inventory

Existing building blocks that must be reused (do NOT generate duplicates):

### Components

- `{ComponentName}` ({path}) — {description} · props: {interface summary}

### Hooks

- `{useHook}` ({path}) — {what it returns} · call: `{API/service}`

### Services

- `{serviceFn}` ({path}) — {endpoint} → {return type}

## Patterns & Conventions

{from shared/PATTERNS.md, bullet list with pattern name + one-line description}

- TypeScript strict mode
- Semantic HTML + ARIA
- `cn()` utility for className composition
- Tailwind scale (no arbitrary values)
- Sizing vocabulary: `fill` (flex: 1 / width: 100%), `hug` (fit-content/auto), `fixed` (explicit px/rem value) — use these terms in comments next to layout elements

## Expected Output

Generate in Claude Design:

1. Visual layout that follows the section structure above
2. Reuse existing components where possible (see Block Inventory)
3. Tokens from the theme section (if populated)
4. Handoff bundle to forward to Claude Code (`/dev-build`)
```

#### Step 5: Write + Show

Determine output path per scope:

| Scope       | File                                               |
| ----------- | -------------------------------------------------- |
| Page / Flow | `.project/claude-design-brief.md`                  |
| Component   | `.project/claude-design-brief-{component-name}.md` |
| Both        | both files above                                   |

Write file(s).

**Backlog sync** — if `{$TARGET}` is a PAGE or COMPONENT in the backlog:

Parse `backlog.html` → match on `name === {$TARGET}`:

- Set `feature.status = "DEFINED"` (Path B: brief generated, waiting for convert)
- Update `data.updated`, edit back into `backlog.html`.

Print summary:

```
CLAUDE DESIGN BRIEF GENERATED
════════════════════════════════════════════════
File(s):       {path(s)}
Scope:         {page | component | flow | both | full app}
Pages:         {N}   (or n/a for pure component brief)
Components:    {M} in inventory
Tokens:        [✓ from theme | ⚠ Tailwind defaults]
════════════════════════════════════════════════

Next steps:
  1. Open {file(s)}
  2. Copy content → paste into Claude Design (claude.ai/design)
  3. After generation → "Handoff to Claude Code" button

  Done with external design?
  /frontend-convert {$TARGET}
```

No PHASE 3 confirm needed for brief-mode. Skip to Completion.

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

Save the current `design` section as a checkpoint in `.project/session/design-history.json` before writing. Skipped for Herstellen-restores (see Herstellen Step 4).

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

### Backlog Sync

After defining pages, sync them to the backlog:

1. Read `project.json` → get `design.pages[]` array
2. Read `.project/backlog.html` (if it exists) → parse JSON from `<script id="backlog-data" type="application/json">...</script>`
   - **If backlog doesn't exist**: create it from template `{skills_path}/shared/references/backlog-template.html` → `.project/backlog.html`. Set `data.source` to `"/frontend-design"`, `data.project` to project directory name.
3. For each page in `design.pages[]`:
   - Generate kebab-case name from page name
   - Check if `data.features.find(f => f.name === name)` exists
   - **Not found**: add to `data.features[]`:
     ```json
     {
       "name": "{kebab-case-name}",
       "type": "PAGE",
       "status": "TODO",
       "phase": "P3",
       "description": "{page.purpose}",
       "dependencies": []
     }
     ```
   - **Found**: skip (don't overwrite existing items)
4. Set `data.updated` to today's date
5. Write back via Edit (keep `<script>` tags intact)

### Update DevInfo

Update `.project/session/devinfo.json`:

```json
{
  "currentSkill": { "name": "frontend-design", "phase": "COMPLETE" },
  "handoff": {
    "from": "frontend-design",
    "to": null,
    "data": {
      "designLocation": ".project/project.json#design",
      "pages": {
        "count": 4,
        "names": ["dashboard", "settings", "login", "checkout"]
      },
      "flows": {
        "count": 2,
        "names": ["onboarding", "purchase"]
      },
      "principles": {
        "count": 3,
        "names": ["Mobile-first", "Accessibility", "Consistent spacing"]
      }
    }
  }
}
```

### Completion Report

```
DESIGN SPEC [CREATED|UPDATED]
═══════════════════════════════════════════════════════════════

Location: .project/project.json (design section)

[Only show if design-history.json exists and is not empty:]
CHANGES THIS SESSION
─────────────────────────────────────────────────
+ {name}  (new page/flow/principle)
~ {name}  (changed — field: {purpose|sections|steps|...})
- {name}  (removed)
[If no changes: omit this block]
─────────────────────────────────────────────────

| Category   | Count | Details                            |
|------------|-------|------------------------------------|
| Pages      | {N}   | {status breakdown: 2 DEF, 1 BLT}  |
| Flows      | {M}   | {flow names joined}                |
| Principles | {P}   | {principle names joined}           |

Backlog: {X} new PAGE items added
  {list of added page names}

Next steps:
  1. /frontend-design       → add more pages/flows (iterative)
  2. /frontend-tokens       → design tokens and colors based on principles
  3. /frontend-design       → generate Claude Design brief (brief-mode)
  4. /frontend-convert      → convert an existing design to code
  5. /frontend-check        → performance/SEO audit (if flows defined: Flow scope also available)
  6. /frontend-check --scope=a11y → accessibility audit

═══════════════════════════════════════════════════════════════
```

---

## Restrictions

This skill must **NEVER**:

- Write design spec without user confirmation (PHASE 3)
- Auto-delete pages, flows, or principles (only via explicit "Delete" route)
- Overwrite other sections in project.json
- Skip pre-flight or post-flight validation
- Guess page structure without user input or codebase evidence (Importeren route)

This skill must **ALWAYS**:

- Run pre-flight validation (PHASE 0) before any operation
- Use AskUserQuestion for all user choices
- Show current values when editing existing items
- Show change preview before confirming (PHASE 3)
- Confirm before destructive actions with "Nee" as recommended option
- Save checkpoint (X.0) before every mutating write — except restores
- Run post-flight validation (PHASE X) after any write
- Cross-reference flow steps against defined pages
- Update DevInfo at completion
- Show completion report with next steps
