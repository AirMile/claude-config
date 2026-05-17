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

#### Step 1: Component location

If the component path is not already known (e.g. via argument or file selection in VSCode):

```yaml
header: "Component"
question: "Which file do you want to update?"
options:
  - label: "I'll type the path", description: "Relative or absolute path to the .tsx/.jsx file"
multiSelect: false
```

Read the file via Read tool. If the file does not exist: stop with message and fall back to scope "Single component".

#### Step 2: Before-screenshot

Render the current component via Playwright (if dev server is available):

```
playwright-cli goto http://localhost:[port]/[page with this component]
playwright-cli run-code "async page => { await page.waitForTimeout(2000); }"
playwright-cli screenshot --filename=.project/patch-before.png
```

If Playwright is not available: skip before-screenshot and go directly to step 3 without visual diff.

#### Step 3: Visual diff

Compare `$SOURCE_IMAGE` (new) with `patch-before.png` (current):

```
PATCH ANALYSIS
════════════════════════════════════════════════════════════
Changed:
  [Section/element that changed visually — description]
  [Section/element 2 — if applicable]

Unchanged:
  [Sections that are identical — will not be touched]
════════════════════════════════════════════════════════════
```

#### Step 4: Confirm

```yaml
header: "Patch Scope"
question: "Is this analysis of what changed correct?"
options:
  - label: "Yes, continue (Recommended)", description: "Patch only the changed sections"
  - label: "Adjust", description: "I want to change the scope"
  - label: "Full rewrite instead", description: "Fall back to normal generation"
multiSelect: false
```

Store as `$PATCH_SECTIONS`. If "Full rewrite instead": restore scope to "Single component" and continue with normal PHASE 0.5.

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

Generate the page and components based on the source image.

**Rules:**

- Follow `shared/FRONTEND-RULES.md`: React/Next.js Rules, HTML/CSS Rules, Accessibility Rules (A-series)
- Follow `shared/PATTERNS.md`: Component Patterns, Layout Patterns
- Use `cn()` for className composition — create `src/lib/utils.ts` if not present
- TypeScript strict mode with proper interfaces
- Semantic HTML with aria-labels and keyboard support
- Import existing components — never regenerate what already works

**Component states:**

If `$STATES` is non-empty: generate state variants alongside the happy path.

- **Loading**: use a skeleton that mirrors the happy path layout — same grid/flex structure, placeholder blocks at text positions. No generic spinner unless the source explicitly shows one.
- **Error**: show error message with retry action if that makes sense for the context. Use `error`-semantic color if the theme defines one.
- **Empty**: contextual empty state — infer from the section name what would go there (e.g. "No projects yet" for a projects list).

All states follow the same `dark:` and responsive logic as the happy path.

**Mode-specific** (see `./examples/` for gold standard examples per mode):

- **1:1 copy:** Match source colors, fonts, spacing as closely as possible. Use arbitrary Tailwind values (`bg-[#FF5733]`, `text-[20px]`) when no standard class matches. Prioritize visual fidelity. Reference: `./examples/PricingPage-1to1.tsx`
- **Inspiration:** Use only theme tokens (from project.json) and standard Tailwind classes. Match source layout and structure, not visual details. No arbitrary values. Reference: `./examples/PricingPage-inspiration.tsx`

**Dark mode classes:**

Check `theme.modes.dark` in `project.json`. If present (`$HAS_DARK_MODE = true`): add `dark:` Tailwind prefix to all background-, text-color-, and border-classes.

- `bg-white dark:bg-[var(--color-dark)]` or via theme alias: `bg-background dark:bg-background`
- `text-gray-900 dark:text-[var(--color-light)]`
- `border-gray-200 dark:border-[var(--color-mid-gray)]`

If `theme.modes.dark` is missing: no `dark:` classes — do not add them speculatively.

**Responsive layout:**

If `$RESPONSIVE_VIEWPORTS` shows multiple viewports: use Tailwind responsive prefixes systematically (mobile-first).

- No prefix = mobile/default
- `md:` = tablet (768px+)
- `lg:` = desktop (1024px+)

Examples: `flex-col md:flex-row`, `hidden md:block`, `px-4 md:px-8 lg:px-16`, `text-sm lg:text-base`

If single viewport: generate for that viewport. Add `{/* TODO: responsive — only [mobile|desktop] frame available */}` at the top of the component.

**Contextual content:** Never use "Lorem ipsum." Infer contextual placeholder text from the source image or describe what real content would go there.

**Variant-aware components:**

If `$VARIANTS` is non-empty: use `cva` (class-variance-authority) for each component with ≥2 detected variants. Check first if `cva` is available in `package.json`; do not install automatically — add to Generation Summary as missing dependency.

Structure:

```typescript
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva("base-classes-here", {
  variants: {
    variant: { primary: "...", ghost: "...", destructive: "..." },
    size: { sm: "...", md: "...", lg: "..." },
  },
  defaultVariants: { variant: "primary", size: "md" },
});

interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}
```

Without detected variants (`$VARIANTS` empty): generate normally without `cva`.

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

Self-verify by comparing the source image against a Playwright CLI screenshot of the generated output. Max 3 rounds. See `../shared/VERIFICATION.md` for the generic loop pattern, round management, and code quality checks.

### 3.0 Pre-flight

Check Playwright CLI available: `playwright-cli --version`. If unavailable: skip with message `"Playwright CLI not available — open the page manually to verify."`, proceed to PHASE 4.

### 3.1 Dev Server

Detect or start dev server:

1. Check if dev server already running on expected port (try `playwright-cli open http://localhost:[port]`)
2. If not running: start in background (`npm run dev` / `npx next dev` based on framework)
3. Wait for server ready

### 3.2 Verification Round

```
VERIFICATION ROUND [N]/3
────────────────────────
```

**Sequence:**

1. `playwright-cli goto http://localhost:[port]/[page-path]`
2. `playwright-cli run-code "async page => { await page.waitForTimeout(3000); }"` (allow hydration)
3. `playwright-cli screenshot --filename=.project/verify-round-[N].png`
4. `Read .project/verify-round-[N].png` → capture generated page
5. `playwright-cli console error` → check for runtime JS errors (see `../shared/PLAYWRIGHT.md` → Console Error Inspection)
   → Filter output against PLAYWRIGHT.md → Default Ignore Patterns before reporting; only unfiltered lines become findings.

**Runner verification (round 1 only — create or compare baseline):**

Check runner available: `npx playwright --version 2>/dev/null`.

If available → generate on-the-fly spec (see `shared/PLAYWRIGHT.md → Runner Mode`):

```typescript
// .project/playwright-runs/convert-{slug}-r1.spec.ts  (temporary)
import { test, expect } from "@playwright/test";

test("visual baseline — {slug}", async ({ page }) => {
  await page.goto("{url}");
  await page.waitForLoadState("networkidle");
  // Pixel-diff: first run creates baseline, subsequent runs compare
  await expect(page).toHaveScreenshot("convert-{slug}.png", {
    mask: [
      page.locator('[data-testid="timestamp"]'),
      page.locator(".skeleton"),
    ],
    maxDiffPixelRatio: 0.03,
  });
  // Structural equivalence: semantic HTML of output vs expected
  await expect(page.locator("main")).toMatchAriaSnapshot();
});
```

If `$HAS_DARK_MODE = true`: add dark variant:

```typescript
test("visual baseline dark — {slug}", async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: "dark" });
  const page = await ctx.newPage();
  await page.goto("{url}");
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveScreenshot("convert-{slug}-dark.png", {
    maxDiffPixelRatio: 0.03,
  });
  await ctx.close();
});
```

First run: `npx playwright test ... --update-snapshots` (create baseline in `.project/playwright-runs/__screenshots__/`).
Subsequent rounds (2, 3): baseline already present → run without `--update-snapshots` → FAIL on pixel regression or aria structure change.

Runner FAIL = discrepancy found → treat as fix target alongside Vision findings.
Runner not available → skip runner, continue with Vision-only sanity check.

**Vision comparison (sanity check — always run, even if runner is available):**

Compare source image vs generated screenshot. Analyze:

- Layout structure (sections in correct order, proportions roughly match)
- Spacing (gaps between sections, padding within sections)
- Color accuracy (1:1 mode: exact match matters; inspiration: theme tokens applied correctly)
- Typography (heading sizes, weight, alignment)
- Component rendering (all sections visible, no blank areas, no error overlays)
- Missing elements (anything in source not present in output)
- **Runtime errors** (from step 5 — JS errors indicate broken hydration or missing imports, even if nothing looks wrong visually; report as **P004** findings — see FRONTEND-RULES.md)

**Assessment:**

```
ROUND [N] ASSESSMENT
═════════════════════════
Match quality: [High | Medium | Low]
Runtime errors (P004): [None | [N] errors — see below]

Discrepancies:
  [1. specific issue — file:line — suggested fix]
  [2. specific issue — file:line — suggested fix]
  [3. specific issue — file:line — suggested fix]

JS errors (from console):
  [- TypeError: foo is undefined at HeroSection:14]
  [- Failed to load module: ./Icon — verify import path]

Action: [✓ Acceptable — stop | → Fix and re-check]
═════════════════════════
```

Runtime errors are always fixable in this phase — resolve before visual discrepancies (a crashing component can cause visual issues that don't exist elsewhere).

**Decision logic:**

- **No significant discrepancies** → stop loop, proceed to PHASE 4
- **Fixable discrepancies AND rounds remaining** → apply targeted edits, increment round, repeat from 3.2
- **Round 3 reached** → stop loop regardless, report remaining discrepancies

### 3.2b Code Quality Check (first round only)

After the first visual verification, scan all generated files:

**Always check (both modes):**

- Missing alt text: `<img>` or `<Image>` without `alt` prop (R002)
- Missing labels: `<input>`/`<select>` without `<label>` or `aria-label` (R004)
- Div-soup: `<div onClick>` without `role="button"` — use `<button>` (R001)
- Implicit any: functions/parameters without type annotation (T002)

**Inspiration mode only:**

- Arbitrary color values: `bg-[#hex]`, `text-[#hex]`, `border-[#hex]` etc. — must use theme tokens (H101)
- Arbitrary spacing: `p-[16px]`, `gap-[24px]`, `mt-[32px]` etc. — must use standard Tailwind scale (R103)
- Reference: compare with `./examples/PricingPage-inspiration.tsx` — no arbitrary values at all

On violations: include as fixes in step 3.3 alongside visual discrepancies. Add to the ROUND assessment:

```
Code quality:  [PASS | [N] violations]
  [- arbitrary color: bg-[#2D3748] → bg-surface-dark (H101)]
  [- missing alt: <img> in HeroSection:14 (R002)]
```

### 3.3 Fix and Re-check

Apply targeted edits for identified discrepancies. Focus on:

1. Layout/structure issues first (wrong flex direction, missing grid columns)
2. Spacing/sizing second (padding, gaps, widths)
3. Visual details last (colors, border radius, shadows)

After edits, return to 3.2 for next round.

### 3.4 Final Assessment

After the loop exits (either by quality threshold or max rounds):

```
VISUAL VERIFICATION COMPLETE
════════════════════════════════════════════════════════════

Rounds:         [N]/3
Final match:    [High | Medium | Low]
Source:         [source image description]
Generated:      [page URL]

[If remaining discrepancies:]
Remaining:
  - [discrepancy — recommended manual fix]

════════════════════════════════════════════════════════════
```

Close browser: `playwright-cli close`

---

## PHASE 4: Completion

### 4.1 Update DevInfo

Update `.project/session/devinfo.json`:

```json
{
  "handoff": {
    "from": "frontend-convert",
    "to": null,
    "data": {
      "inputType": "screenshot | url | image",
      "mode": "copy | inspiration",
      "pageFile": "[page file path]",
      "components": ["[list of created component files]"],
      "verificationRounds": 2,
      "finalMatchQuality": "high",
      "framework": "[detected framework]",
      "theme": "[.project/project.json#theme or null]"
    }
  }
}
```

**Handoff cleanup** (if session started via PHASE 0.0 handoff): set `devinfo.handoff = null`.

**TokenDrift cleanup** (if page scope): read `devinfo.tokenDrift.affectedFeatures` → remove the current page name if present → if list is empty: `tokenDrift.resolved = true`. Write back.

### 4.2 Backlog Completion Sync (page scope only)

If page scope and backlog exists:

1. Read `.project/backlog.html` → parse JSON
2. Find feature matching page name → set `stage: "built"`, `data.updated` to today
3. Write back via Edit (keep `<script>` tags intact)

### 4.3 Gap-Discovery

Trigger C — scan all generated/updated component files for stub handlers. Follow [Discovery — Gap-Discovery](../shared/SKILL-PATTERNS.md#gap-discovery). **Source:** `"/frontend-convert"` · **Direction:** `"frontend→dev"` · **Type:** `FEATURE`. If no gaps: skip this step.

### 4.4 Completion Report

```
CONVERT COMPLETE
═══════════════════════════════════════════════════════════

Source:       [file path | URL | pasted image]
Mode:         [1:1 copy | Inspiration]
Framework:    [detected framework]
Verification: [N] rounds, [High | Medium | Low] match
Code quality: [PASS | [N] violations fixed]
Gaps:         [N linked | M created | K pending | "none"]

Files ([N]):
  Page:       [page file path]
  Components: [component paths]

═══════════════════════════════════════════════════════════
```

Ask after report:

```yaml
header: "Continue with audit?"
question: "/frontend-check {page-name} checks A11Y, tokens, and responsive behavior."
options:
  - label: "Yes, audit now (Recommended)", description: "Run frontend-check inline"
  - label: "Later", description: "Status stays DOING — /frontend-check {page-name} ready in the backlog"
multiSelect: false
```

On "Yes": read `frontend-check/SKILL.md` and run PHASE 0–4 inline for `{page-name}`.
On "Later": end — backlog shows DOING status with next step `/frontend-check {page-name}`.

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
