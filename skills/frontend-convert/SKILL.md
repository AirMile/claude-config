---
name: frontend-convert
description: Convert screenshots or URLs into working pages or components. Use with /frontend-convert.
argument-hint: "[file-path|url]"
writes: [devinfo.handoff]
metadata:
  author: claude-config
  version: 2.6.0
  category: frontend
---

# Convert

Convert visual input into working code. Accepts screenshots, Figma exports, website URLs, or images pasted in chat. Two modes: faithful 1:1 reproduction or inspiration-based conversion using the project's theme tokens (from project.json). Self-verifies by comparing source image against Playwright CLI screenshot of generated output.

**Related skills:** `/frontend-tokens` · `/frontend-design` · `/core-setup` · `/frontend-check`

## References

- `../shared/FRONTEND-RULES.md` — React/TypeScript coding rules
- `../shared/PATTERNS.md` — Component patterns (compound, render props, etc.)
- `../shared/DESIGN.md` — Anti-patterns, color, typography, motion, UX writing
- `../shared/CODEGEN.md` — Block inventory, token mapping, output structure, a11y scaffold, cva pattern (shared with frontend-design Build route)
- `../shared/PLAYWRIGHT.md` — Playwright CLI, screenshot capture
- `../shared/DEVINFO.md` — Session tracking, cross-skill handoff
- `../shared/BACKLOG.md` — Backlog HTML+JSON format, read/write protocol
- `./examples/` — Before/after conversion examples (1:1 and inspiration mode)

---

## PHASE 0: Pre-flight

### 0.0 Handoff Detection (auto)

Read `.project/session/devinfo.json` → check `handoff.source`.

**If `handoff.source === "build-incomplete"`:**

Check `handoff.timestamp` — if older than 24h: show `"Handoff is {N}h old — may no longer be relevant"` with the prompt.

```yaml
header: "Handoff from Build detected"
question: "Build of '{handoff.target}' is incomplete ({handoff.failedChecks}). Continue with patch on those files?"
options:
  - label: "Yes, patch (Recommended)", description: "Scope = patch, files loaded from handoff, before-screenshot from handoff.buildScreenshot"
  - label: "New screenshot", description: "Ignore handoff, continue normally with PHASE 0.1"
  - label: "Cancel", description: "Stop, handoff remains for a later run"
multiSelect: false
```

**On "Yes, patch":**

1. Ask user for the target screenshot (the desired end state Build didn't fully reach): `"Paste the desired final state as a screenshot"`
2. Store as `$SOURCE_IMAGE`, `$SCOPE = "patch"`, `$PATCH_FILE = handoff.files[0]`
3. `$BEFORE_SCREENSHOT = handoff.buildScreenshot` (if null: skip before-screenshot step 0.4b Step 2)
4. Jump to **0.4b Step 3** (Visual diff) — skip 0.1 through 0.4b Step 2

Handoff is cleaned up in PHASE 4 after success (`devinfo.handoff = null`).

**If `handoff` is empty/absent or `handoff.source !== "build-incomplete"`:** Skip 0.0, go to 0.1.

---

### 0.1 Visual Input Resolution

Determine the input type from the argument or conversation:

| Input                                             | Detection                                  | Action                                                         |
| ------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------- |
| File path (`/home/...`, `C:\...`, `.png`, `.jpg`) | Contains path separator or image extension | Read file with Read tool (multimodal)                          |
| URL (`http://`, `https://`, `figma.com`)          | Starts with protocol or known domain       | CLI: `playwright-cli open [url]` → `playwright-cli screenshot` |
| Image in chat                                     | No path/URL, image data present            | Analyze directly from conversation                             |
| None                                              | No argument, no image                      | Ask user (see below)                                           |

**No input provided:**

```yaml
header: "Visual Input"
question: "What do you want to convert? Paste a screenshot in chat, provide a file path, or give a URL."
options:
  - label: "I'll paste a screenshot", description: "Paste image in the next message"
  - label: "File path", description: "Path to screenshot/export/image"
  - label: "URL", description: "Website URL, Figma share link, or Canva link"
multiSelect: false
```

**For URLs:** Navigate with Playwright CLI, wait 3 seconds for render, take full-page screenshot. This captured screenshot becomes the source image for all subsequent phases.

```
playwright-cli open [url]
playwright-cli run-code "async page => { await page.waitForTimeout(3000); }"
playwright-cli screenshot --full-page --filename=.project/source-capture.png
playwright-cli close
Read .project/source-capture.png
```

Store the resolved source image reference as `$SOURCE_IMAGE` for the verification loop.

### 0.2 Visual Analysis

Analyze the source image. Extract:

```
SOURCE ANALYSIS
════════════════════════════════════════════════════════════

Type:       [Full page | Section/component | Multiple components]
Sections:   [enumerated list of visual sections top-to-bottom]
Layout:     [single column | multi-column | grid | sidebar + content | etc.]
Responsive: [single viewport | mobile + desktop | mobile + tablet + desktop | unknown]
Sizing:     [per key element: fixed (explicit px/rem) | fill (flex:1 / width:100%) | hug (fit-content/auto)]
Key colors: [dominant colors as hex, max 5]
Dark mode:  [light only | dark only | both visible | unknown]
Typography: [heading style, body style — approximate]
Components: [identifiable UI patterns: cards, nav, hero, form, table, etc.]
Variants:   [component name → detected variant axes: size=sm/md/lg, state=default/hover/disabled, type=primary/ghost]
            [or: no variants detectable]
States:     [no separate state frames | loading | error | empty | success]
            Detect only frames/artboards that explicitly show a non-default state. Store as $STATES.
Properties: [design properties with direct CSS mapping — note only what is visibly present:
              fill → background-color/color: [value(s)]
              stroke → border: [value(s)]
              corner-radius → border-radius: [value(s)]
              shadow → box-shadow: [value(s)]
              opacity → opacity: [value(s)]
              rotation → transform: rotate([value(s)])]

════════════════════════════════════════════════════════════
```

### 0.3 Mode Selection

```yaml
header: "Mode"
question: "How do you want to convert this visual design?"
options:
  - label: "1:1 copy (Recommended)", description: "Reproduce as faithfully as possible — colors, fonts, spacing from the original"
  - label: "Inspiration", description: "Adopt layout/structure, apply project theme tokens"
multiSelect: false
```

Store as `$MODE` (copy | inspiration).

### 0.4 Scope Detection

Based on the visual analysis (0.2), confirm the output scope:

```yaml
header: "Scope"
question: "What should the output be?"
options:
  - label: "Full page (Recommended)", description: "Page file + section components"
  - label: "Single component", description: "Generate only this component"
  - label: "Multiple separate components", description: "Each visual block as a separate component"
  - label: "Update existing component", description: "Patch based on new screenshot — only changed sections"
multiSelect: false
```

On "Update existing component": skip PHASE 0.5 and go to PHASE 0.4b.

### 0.4b Patch Detection

Only for scope = patch.

> **Todo**: Read '.claude/skills/frontend-convert/references/patch-detection.md'

### 0.5 Backlog Stage (page scope only)

If scope is a full page (not a single component):

1. Read `.project/backlog.html` (if exists) → parse JSON from `<script id="backlog-data" type="application/json">...</script>`
2. See `shared/BACKLOG.md → Lifecycle Protocol → Read`. Filter: `(type === "PAGE" || type === "COMPONENT") && transition === "converting"` — if found, auto-select as task (show: `Backlog: ✓ Task picked up — {taskName}`).
3. Find feature matching page name: `data.features.find(f => f.name === "{kebab-case-page-name}")`
   - **Found + status TODO**: set `status: "DOING"`, `stage: "building"`, `date: "{YYYY-MM-DD}"`. Write back via Edit.
   - **Found + status DOING**: set `stage: "building"`. Write back via Edit.
   - **Not found**: add to `data.features[]`: `{ "name": "{name}", "type": "PAGE", "status": "DOING", "stage": "building", "phase": "P4", "description": "Converted from visual input", "dependencies": [] }`. Write back.
4. Set `data.updated` to today. Keep `<script>` tags intact.

On successful completion: re-read backlog.html, find the task by name → remove `transition`. See `shared/BACKLOG.md → Lifecycle Protocol → Write`.

If scope is a component: skip this step.

### 0.5b Worktree Setup

Feature-name: use backlog-matched feature name from 0.5 (page scope), or component name derived from scope selection (component scope). Follow `shared/WORKTREE.md → Auto-create worktree`. Skip if no clear feature-name is available or if already in a worktree (procedure detects).

### 0.6 Theme & Project Context

**Theme check:**

Check `.project/project.json` → `theme` section.

- **Theme populated + inspiration mode:** Read and store tokens. Mandatory for mapping.
- **Theme populated + copy mode:** Read as reference. Use for shared utilities (cn(), Tailwind config) but not for color/font values.
- **No theme + inspiration mode:** Abort with suggestion: `"Inspiration mode requires a theme. Run /frontend-tokens first or choose 1:1 copy."`
- **No theme + copy mode:** Proceed with extracted values from source image.

```
Theme: [Available | Not available]
Mode:  [1:1 copy | Inspiration]
```

**Framework detection:**

Detect from `package.json`:

| Framework          | Detection             | Page path                | Component dir            |
| ------------------ | --------------------- | ------------------------ | ------------------------ |
| Next.js App Router | `next` + `app/` dir   | `app/[page]/page.tsx`    | `src/components/[page]/` |
| Next.js Pages      | `next` + `src/pages/` | `src/pages/[page].tsx`   | `src/components/[page]/` |
| Vite + React       | `vite` in deps        | `src/pages/[page].tsx`   | `src/components/[page]/` |
| Remix              | `@remix-run/react`    | `app/routes/[page].tsx`  | `app/components/[page]/` |
| Astro              | `astro` in deps       | `src/pages/[page].astro` | `src/components/[page]/` |

**Light component scan:**

Quick scan for reusable components in the project. No deep inventory — just check what exists:

1. Glob for `src/components/**/*.{tsx,jsx}` (or framework equivalent)
2. List component names and their approximate purpose (from filename + exports)
3. Match against sections identified in the source image

```
PROJECT CONTEXT
════════════════════════════════════════════════════════════

Framework:  [detected]
Theme:      [Available (project.json#theme) | Not available]
Existing:   [N] components found
  Reusable: [component names that match source sections]

════════════════════════════════════════════════════════════
```

---

## PHASE 1: Token Mapping (Inspiration mode only)

**Skip this phase entirely if `$MODE` = copy.**

### 1.1 Extract and Map

Extract visual properties from the source image and map them to the closest theme tokens (from project.json):

```
TOKEN MAPPING
════════════════════════════════════════════════════════════

Colors:
  Source              → Theme Token
  #FF5733 (accent)    → primary-500 (#3B82F6)
  #333333 (heading)   → foreground (#1a1a2e)
  #F5F5F5 (bg)        → background (#ffffff)
  #666666 (body text) → muted-foreground (#6B7280)

Typography:
  Source              → Theme Token
  Bold sans-serif     → heading (Inter, 700)
  Regular sans-serif  → body (Inter, 400)

Spacing:
  Source (approx.)    → Theme Token
  ~16px sections      → spacing-4 (16px)
  ~32px large gaps    → spacing-8 (32px)

════════════════════════════════════════════════════════════
```

### 1.2 Confirm Mapping

```yaml
header: "Token Mapping"
question: "Is this mapping from source design to your project tokens correct?"
options:
  - label: "Yes, continue (Recommended)", description: "Use this mapping for code generation"
  - label: "Adjust", description: "I want to change specific mappings"
multiSelect: false
```

If "Adjust": ask which mappings to change, update, re-confirm.

---

## PHASE 2: Code Generation

### 2.0 Patch Guard (scope = patch only)

If `$SCOPE` ≠ patch: skip this section and go directly to 2.1.

Per section in `$PATCH_SECTIONS`:

1. Read the relevant lines in the existing component file (Read tool).
2. Generate only the changed JSX/classes/structure based on `$SOURCE_IMAGE`.
3. Apply via **Edit tool** — never Write. Find the exact string, replace only that block.
4. Show a brief summary per edit:
   ```
   PATCH: [section-name]
   ─────────────────────────
   File: [path:line]
   Change: [description — e.g. "CTA text + variant updated"]
   ```

After all edits: go to PHASE 3 (verification) with the new screenshot as target. Skip 2.1 and 2.2.

### 2.1 Plan Output Structure

Based on scope (page vs component), framework, and reusable components:

```
GENERATION PLAN
════════════════════════════════════════════════════════════

Output:
  Page file:    [path]
  Components:   [list with paths]
  Reusing:      [existing components to import]

Strategy per section:
  [Section 1] → [new component | reuse existing]
  [Section 2] → [new component | reuse existing]
  ...

{If $VARIANTS is non-empty:}
Variant components:
  [ComponentName] → cva ([variant axes: type × size])
  [ComponentName] → cva ([variant axes: state])

{If $STATES is non-empty:}
State components:
  [ComponentName] → loading: skeleton | error: ErrorBoundary | empty: EmptyState

════════════════════════════════════════════════════════════
```

### 2.2 Generate Code

> **Todo**: Read '.claude/skills/frontend-convert/references/generate-template.md'

### 2.3 Generation Summary

```
CODE GENERATED
════════════════════════════════════════════════════════════

Files created:
  ✓ [page file path]              (page)
  ✓ [component path]              (new)
  ✓ [component path]              (new)

Existing components imported:
  ✓ [component path]              (reused)

{If cva used but not present in package.json:}
Dependencies:
  ⚠ cva not found in package.json — install: npm install class-variance-authority

Mode:       [1:1 copy | Inspiration with theme tokens]
Theme:      [Integrated from project.json#theme | Extracted from source]
Dark mode:  [✓ dark: classes applied | — no dark mode in theme]
Responsive: [✓ responsive prefixes applied | — single viewport (TODO comment placed)]
States:     [✓ state components generated: [loading|error|empty] | — no state frames detected]

════════════════════════════════════════════════════════════
```

---

## PHASE 3: Visual Verification Loop

> **Todo**: Read '.claude/skills/frontend-convert/references/verification-loop.md'

---

## PHASE 4: Completion

> **Todo**: Read '.claude/skills/frontend-convert/references/completion.md'

---

## Restrictions

This skill must **NEVER**:

- Generate code without first analyzing the source image
- Use "Lorem ipsum" — always use contextual content from the source or realistic placeholders
- Run inspiration mode without theme (project.json#theme empty)
- Skip the visual verification loop when Playwright is available
- Regenerate components that already exist in the codebase — import and reuse
- Exceed 3 verification rounds

This skill must **ALWAYS**:

- Resolve visual input before any code generation
- Confirm mode (1:1 vs inspiration) with user
- Confirm token mapping with user in inspiration mode
- Follow `shared/FRONTEND-RULES.md` (React/Next.js, HTML/CSS, A-series) and `shared/PATTERNS.md` (Component, Layout)
- Detect and match the project's framework
- Run the Playwright verification loop (unless tools unavailable)
- Update DevInfo for downstream skill handoff
- Show a completion report with next steps
