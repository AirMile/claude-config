# Route: Convert

Convert visual input into working code. Accepts low/medium-fi wireframes, Figma/Canva mockups, screenshots, website URLs, or images pasted in chat. Three modes: faithful 1:1 reproduction, inspiration-based using project theme tokens, or sketch → high-fi (interpret layout-intent from wireframe/mockup, fill in details with tokens and DESIGN.md principles). Self-verifies by comparing source image against Playwright CLI screenshot of generated output.

**Incoming variable contract — all paths that reach this route:**

| Var                   | Direct arg | Backlog match                 | Design Mode A   | Patch handoff |
| --------------------- | ---------- | ----------------------------- | --------------- | ------------- |
| `$ROUTE = "convert"`  | ✓          | ✓                             | ✓               | ✓             |
| `$CONVERT_TARGET`     |            | ✓ (entity name)               | ✓ (entity name) |               |
| `$BACKLOG_ROUTE_HINT` |            | ✓ (`"transition=converting"`) |                 |               |
| `$PATCH_MODE = true`  |            |                               |                 | ✓             |
| `$SOURCE_IMAGE`       |            |                               |                 | ✓             |
| `$SCOPE = "patch"`    |            |                               |                 | ✓             |
| `$PATCH_FILE`         |            |                               |                 | ✓             |
| `$BEFORE_SCREENSHOT`  |            |                               |                 | ✓ (nullable)  |

**Assertion (PHASE 0 entry):** if `$PATCH_MODE = true` AND `$SOURCE_IMAGE` is unset → abort with `"Patch mode requires $SOURCE_IMAGE — handoff incomplete"`.

**Patch fast-path:** if `$PATCH_MODE = true`, skip PHASE 0.1 through 0.4b Steps 1-2 and jump directly to **PHASE 0.4b Step 3**.

> **Todo**: In patch fast-path, use the `EnterPlanMode` tool before jumping to PHASE 0.4b Step 3 — visual diff of source vs. patch-before image benefits from Opus-level reasoning. Use `ExitPlanMode` after Step 4 (Confirm), before PHASE 2 Patch Guard.

---

**Step 0: External setup context**

> **Todo**: Read `.claude/skills/shared/VERCEL-CONTEXT.md` — follow the Load Protocol, then apply the guidelines as a bias layer throughout this route.

---

## PHASE 0: Convert Pre-flight

**If `$PATCH_MODE = true`:** skip PHASE 0.1 through 0.4b Steps 1-2 — jump to **PHASE 0.4b Step 3**.

### 0.1 Visual Input Resolution

Determine the input type from the argument or conversation:

| Input                                             | Detection                                  | Action                                                                                              |
| ------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Figma/Canva URL (`figma.com`, `canva.com`)        | URL contains `figma.com` or `canva.com`    | CLI: `playwright-cli open [url]` → `playwright-cli screenshot`; set `$INPUT_SOURCE = "design-tool"` |
| File path (`/home/...`, `C:\...`, `.png`, `.jpg`) | Contains path separator or image extension | Read file with Read tool (multimodal); set `$INPUT_SOURCE = "file"`                                 |
| URL (`http://`, `https://`)                       | Starts with protocol                       | CLI: `playwright-cli open [url]` → `playwright-cli screenshot`; set `$INPUT_SOURCE = "url"`         |
| Image in chat                                     | No path/URL, image data present            | Analyze directly from conversation; set `$INPUT_SOURCE = "chat-image"`                              |
| None                                              | No argument, no image                      | Ask user (see below)                                                                                |

**No input provided:**

```yaml
header: "Visual Input"
question: "What do you want to convert? Paste a screenshot, provide a file path, a website URL, or a Figma/Canva share link."
options:
  - label: "I'll paste a screenshot or image", description: "Paste wireframe, sketch, or screenshot in the next message"
  - label: "Figma or Canva link", description: "Share link from Figma or Canva — captured via Playwright"
  - label: "File path", description: "Path to screenshot, export, or image file"
  - label: "Website URL", description: "URL of a live website to capture and convert"
multiSelect: false
```

**For URLs:** Navigate with Playwright CLI, wait 3 seconds for render, take full-page screenshot. This captured screenshot becomes the source image for all subsequent phases.

```
mkdir -p .project/tmp
playwright-cli open [url]
playwright-cli run-code "async page => { await page.waitForTimeout(3000); }"
playwright-cli screenshot --full-page --filename=.project/tmp/source-capture.png
playwright-cli close
Read .project/tmp/source-capture.png
```

Store the resolved source image reference as `$SOURCE_IMAGE` for the verification loop.

> **Todo**: Use the `EnterPlanMode` tool now — Phases 0.2 (Visual Analysis), 0.3 (Mode), 0.4 (Scope), and the mode file's PHASE 1 all benefit from Opus-level vision and design reasoning. `AskUserQuestion` modals and Bash reads remain available inside plan mode; only Write/Edit are blocked, which is fine until Phase 2. Skip `EnterPlanMode` if plan mode is already active (see `shared/PLAN-MODE.md § Entry`).

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
Fidelity:   [low | medium | high]
            low    = handdrawn/monochrome, placeholder boxes, no typography detail
            medium = Figma/Canva draft, rough colors, partial components, not pixel-accurate
            high   = polished mockup or live-site screenshot, pixel-accurate
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
Motion intent: [detected motion/animation cues — note what is present:
                transitions: [elements with visible transition/animation frames]
                hover states: [if hover variants shown: element → effect]
                animated: [elements labeled "animated" or with motion arrows/paths]
                glass/blur: [backdrop-filter surfaces visible?]
                spring/bounce: [bouncy or elastic motion implied?]
                → store as $MOTION_INTENT (description string or "none detected")]

════════════════════════════════════════════════════════════
```

Store fidelity as `$FIDELITY` (low | medium | high).

### 0.3 Mode Selection

Default recommendation is based on `$FIDELITY`: low/medium → Sketch → high-fi; high → 1:1 copy or Inspiration.

```yaml
header: "Mode"
question: "How do you want to convert this visual design?"
options:
  - label: "Sketch → high-fi", description: "Interpret layout-intent from wireframe/mockup — fill in colors, spacing, typography from project tokens and DESIGN.md. Best for low/medium-fidelity input."
  - label: "1:1 copy", description: "Reproduce as faithfully as possible — colors, fonts, spacing from the original"
  - label: "Inspiration", description: "Adopt layout/structure of a polished mockup, apply project theme tokens"
multiSelect: false
```

Note: show `(Recommended)` after the option that matches `$FIDELITY` (low/medium → Sketch; high → 1:1 copy).

Store as `$MODE` (sketch | copy | inspiration).

> **Todo**: Read '.claude/skills/frontend-design/references/convert-mode-{$MODE}.md' — it defines this mode's theme requirement (applied in 0.6), PHASE 1 procedure with its `ExitPlanMode` point, codegen rules (applied in 2.2), and verification thresholds (applied in PHASE 3).

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

**Visual review (optional).** Once the target name is resolved (after 0.5 for page scope, or from the scope selection for component scope), if the board server is running (`/project-viewer`) and the entity already exists in `project.json#design`, print its review URL as a plain `http://` URL on its own line so it renders clickable in the Claude Code chat:

```
http://localhost:9876/{project-dir}/review/{target-name}
```

There the user can confirm the detected sections/components as a wireframe and leave open-questions before conversion proceeds; answers persist to `design.{pages|components}[].reviewNotes[]`. Skip the line if the entity is not yet in the design spec.

### 0.4b Patch Detection

Only for scope = patch.

> **Todo**: Read '.claude/skills/frontend-design/references/convert-patch-detection.md'

### 0.5 Backlog Task Lookup (page scope only)

If scope is a full page (not a single component):

1. Read `.project/backlog.json` (if exists) → parse JSON
2. See `shared/BACKLOG.md → Lifecycle Protocol → Read`. Filter: `(type === "PAGE" || type === "COMPONENT") && transition === "converting"` — if found, auto-select as task (show: `Backlog: ✓ Task picked up — {taskName}`).
3. If `$CONVERT_TARGET` is set: use it as the page name to match (skip name derivation). Otherwise derive from scope selection. Find feature: `data.features.find(f => f.name === "{kebab-case-page-name}")`
   - **Found**: use as task reference. Do NOT modify `status` or add `stage` during build — the page stays `TODO` until PHASE 4 completion. Skip write.
   - **Not found**: store `$NEW_BACKLOG_ENTRY = { "name": "{name}", "type": "PAGE", "status": "TODO", "phase": "P4", "description": "Converted from visual input", "dependencies": [] }`. **Do not write yet** — Phase 4 completion (4.2) writes the entry along with the DONE sync.

If scope is a component: skip this step.

### 0.5b Worktree Setup

Feature-name: use backlog-matched feature name from 0.5 (page scope), or component name derived from scope selection (component scope). Follow `shared/WORKTREE.md → Auto-create worktree`. Skip if no clear feature-name is available or if already in a worktree (procedure detects).

### 0.6 Theme & Project Context

**Theme check:**

Check `.project/project.json` → `theme` section. Apply the **Theme Requirement** section from the loaded `convert-mode-{$MODE}.md` (mandatory with abort for sketch/inspiration, optional for copy).

```
Theme: [Available | Not available]
Mode:  [1:1 copy | Inspiration | Sketch → high-fi (fidelity: {$FIDELITY})]
```

**Dark-mode fallback:** if `$ANALYSIS` dark mode is `dark only` or `both visible` AND `theme.modes.dark` is missing AND `$MODE` ≠ copy:

```yaml
header: "Dark mode"
question: "The source shows a dark variant, but your theme has no dark mode configured. How to proceed?"
options:
  - label: "Convert as light mode using theme (Recommended)", description: "Generate the light variant only — add dark mode later via /frontend-tokens"
  - label: "Add dark mode first", description: "Stop here, run /frontend-tokens, then re-run this conversion"
  - label: "Cancel", description: "Stop without changes"
multiSelect: false
```

**Seed context (sketch & inspiration modes only):**

If `$MODE ∈ {sketch, inspiration}`: run the `shared/SEED.md` Reader once → `SEED_CONTEXT`. Store the full `SEED_CONTEXT.markdown` for use in PHASE 1 (inspiration brief / fidelity filter) and PHASE 2 codegen — it grounds copy, labels, and CTA text in what the product actually is, so generated content is on-concept instead of generic placeholder text. For `$MODE = copy` (or any patch path): skip — pure reproduction takes all content from the source.

```
Seed: [✓ loaded ({SEED_CONTEXT.name}) | — not present | — skipped (copy mode)]
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

## PHASE 1: Mode Procedure

Execute the **PHASE 1** section of the loaded `convert-mode-{$MODE}.md`:

- **copy** → Fidelity Extraction (ground-truth computed styles for URL sources, exact-value table)
- **inspiration** → Inspiration Brief (questioning round per `shared/QUESTIONING.md`) + Token Mapping
- **sketch** → Fidelity Filter + Token Mapping

Every mode ends PHASE 1 with a user-confirmed table and its own `ExitPlanMode` point — after that, all remaining phases (codegen, verification, completion) run in Sonnet.

**Patch paths (any scope = patch) skip PHASE 1 entirely** — their plan-mode exit happened in patch detection Step 4.

---

## PHASE 2: Code Generation

### 2.0b Forbidden Patterns Load

Before any generation, load project-specific bans:

1. Read `design.principles[*].forbid[]` from `project.json`. Collect all strings into `$FORBID_LIST`.
2. If `design.banPacks[]` is non-empty: read `shared/ANTI-SLOP.md`, load entries for each named pack, append to `$FORBID_LIST`.
3. Show count:
   ```
   Forbidden patterns: [N] loaded ([pack names if any] + [M principle rules])
   ```
   If $FORBID_LIST is empty: skip silently (no bans active).

`$FORBID_LIST` is injected into the codegen prompt in 2.2 as a "FORBIDDEN PATTERNS" section. After generation (2.3), run a sanity grep: scan each generated file for forbidden patterns. If a violation is found: note in Generation Summary, then regenerate that file with `"you emitted forbidden pattern [code]: do not use [pattern]. Replace with: [fix]."` in the prompt.

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
Variant components:   (mechanism: React+Tailwind → cva; else native binding per shared/CODEGEN.md)
  [ComponentName] → [cva | native] ([variant axes: type × size])
  [ComponentName] → [cva | native] ([variant axes: state])

{If $STATES is non-empty:}
State components:
  [ComponentName] → loading: skeleton | error: ErrorBoundary | empty: EmptyState

════════════════════════════════════════════════════════════
```

### 2.2 Generate Code

> **Todo**: Read '.claude/skills/frontend-design/references/convert-generate-template.md'

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

Mode:       [1:1 copy | Inspiration with theme tokens | Sketch → high-fi (fidelity: {$FIDELITY})]
Theme:      [Integrated from project.json#theme | Extracted from source]
Dark mode:  [✓ dark: classes applied | — no dark mode in theme]
Responsive: [✓ responsive prefixes applied | — single viewport (TODO comment placed)]
States:     [✓ state components generated: [loading|error|empty] | — no state frames detected]

════════════════════════════════════════════════════════════
```

---

## PHASE 3: Visual Verification Loop

> **Todo**: Read '.claude/skills/frontend-design/references/convert-verification-loop.md'

---

## PHASE 4: Completion + Finalize (REQUIRED after PHASE 3)

PHASE 4 is mandatory — the convert route is not complete without it. Load and execute `convert-completion.md` immediately after PHASE 3 ends, **before reporting completion to the user**.

Without PHASE 4:

- backlog is never synced to DONE (4.2)
- worktree remains unmerged on disk and `/diensten`-style routes are unreachable on main (4.6)
- next session opens with stale handoff data (4.1)

The user-visible report in 4.4 is **not** the end of the workflow — it must be followed by 4.5 (dev-server cleanup) and 4.6 (Finalize offer). If you find yourself about to end the skill after 4.4 without showing the Finalize offer: re-read convert-completion.md from §4.5 onward.

> **Todo**: Read '.claude/skills/frontend-design/references/convert-completion.md'

---

## Restrictions

This route must **NEVER**:

- Generate code without first analyzing the source image
- Use "Lorem ipsum" — always use contextual content from the source or realistic placeholders
- Run sketch or inspiration mode without theme (project.json#theme empty)
- Reach PHASE 2 with plan mode still active — every path has exactly one `ExitPlanMode` point (mode file 1.2, or patch detection Step 4)
- Skip the visual verification loop when Playwright is available
- Regenerate components that already exist in the codebase — import and reuse
- Exceed 3 verification rounds

This route must **ALWAYS**:

- Resolve visual input before any code generation
- Confirm mode (1:1 vs inspiration vs sketch) with user
- Confirm the mode's PHASE 1 output (token mapping / fidelity table) with the user
- Follow `shared/FRONTEND-RULES.md` (React/Next.js, HTML/CSS, A-series) and `shared/PATTERNS.md` (Component, Layout)
- Detect and match the project's framework
- Run the Playwright verification loop (unless tools unavailable)
- Update DevInfo for downstream skill handoff
- Show a completion report with next steps
