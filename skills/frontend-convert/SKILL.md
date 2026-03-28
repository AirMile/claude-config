---
name: frontend-convert
description: >-
  Convert visual input (screenshots, Figma exports, URLs, inspiration images)
  into working pages or components. Two modes: 1:1 faithful copy or
  inspiration-based using project theme tokens. Self-verifies with Playwright
  comparison loop. Use with /frontend-convert.
argument-hint: "[file-path|url]"
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: frontend
---

# Convert

Convert visual input into working code. Accepts screenshots, Figma exports, website URLs, or images pasted in chat. Two modes: faithful 1:1 reproduction or inspiration-based conversion using the project's THEME.md tokens. Self-verifies by comparing source image against Playwright screenshot of generated output.

**Pipeline:** `/frontend-theme` (optional) → `/frontend-convert` → `/frontend-iterate` → quality skills

## References

- `../shared/RULES.md` — React/TypeScript coding rules
- `../shared/PATTERNS.md` — Component patterns (compound, render props, etc.)
- `../shared/DESIGN.md` — Anti-patterns, color, typography, motion, UX writing
- `../shared/PLAYWRIGHT.md` — Browser automation, screenshot capture
- `../shared/DEVINFO.md` — Session tracking, cross-skill handoff
- `../shared/BACKLOG.md` — Backlog HTML+JSON format, read/write protocol

---

## FASE 0: Pre-flight

### 0.1 Visual Input Resolution

Determine the input type from the argument or conversation:

| Input                                             | Detection                                  | Action                                                     |
| ------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------- |
| File path (`/home/...`, `C:\...`, `.png`, `.jpg`) | Contains path separator or image extension | Read file with Read tool (multimodal)                      |
| URL (`http://`, `https://`, `figma.com`)          | Starts with protocol or known domain       | Playwright: `browser_navigate` → `browser_take_screenshot` |
| Image in chat                                     | No path/URL, image data present            | Analyze directly from conversation                         |
| None                                              | No argument, no image                      | Ask user (see below)                                       |

**No input provided:**

```yaml
header: "Visual Input"
question: "Wat wil je converteren? Plak een screenshot in chat, geef een bestandspad, of geef een URL."
options:
  - label: "Ik plak een screenshot", description: "Plak afbeelding in het volgende bericht"
  - label: "Bestandspad", description: "Pad naar screenshot/export/afbeelding"
  - label: "URL", description: "Website URL, Figma share link, of Canva link"
multiSelect: false
```

**For URLs:** Navigate with Playwright, wait 3 seconds for render, take full-page screenshot. This captured screenshot becomes the source image for all subsequent phases.

Store the resolved source image reference as `$SOURCE_IMAGE` for the verification loop.

### 0.2 Visual Analysis

Analyze the source image. Extract:

```
SOURCE ANALYSIS
════════════════════════════════════════════════════════════

Type:       [Full page | Section/component | Multiple components]
Sections:   [enumerated list of visual sections top-to-bottom]
Layout:     [single column | multi-column | grid | sidebar + content | etc.]
Key colors: [dominant colors as hex, max 5]
Typography: [heading style, body style — approximate]
Components: [identifiable UI patterns: cards, nav, hero, form, table, etc.]

════════════════════════════════════════════════════════════
```

### 0.3 Mode Selection

```yaml
header: "Modus"
question: "Hoe wil je dit visuele ontwerp converteren?"
options:
  - label: "1:1 kopie (Recommended)", description: "Zo getrouw mogelijk nabouwen — kleuren, fonts, spacing uit het origineel"
  - label: "Inspiratie", description: "Layout/structuur overnemen, project theme tokens toepassen"
multiSelect: false
```

Store as `$MODE` (copy | inspiration).

### 0.4 Scope Detection

Based on the visual analysis (0.2), confirm the output scope:

```yaml
header: "Scope"
question: "Wat moet de output zijn?"
options:
  - label: "Volledige pagina (Recommended)", description: "Pagina-bestand + sectie-componenten"
  - label: "Eén component", description: "Alleen dit component genereren"
  - label: "Meerdere losse componenten", description: "Elk visueel blok als apart component"
multiSelect: false
```

### 0.5 Backlog Stage (page scope only)

If scope is a full page (not a single component):

1. Read `.project/backlog.html` (if exists) → parse JSON from `<script id="backlog-data" type="application/json">...</script>`
2. Find feature matching page name: `data.features.find(f => f.name === "{kebab-case-page-name}")`
   - **Found + status TODO**: set `status: "DOING"`, `stage: "building"`, `date: "{YYYY-MM-DD}"`. Write back via Edit.
   - **Found + status DOING**: set `stage: "building"`. Write back via Edit.
   - **Not found**: add to `data.features[]`: `{ "name": "{name}", "type": "PAGE", "status": "DOING", "stage": "building", "phase": "P4", "description": "Converted from visual input", "dependency": null }`. Write back.
3. Set `data.updated` to today. Keep `<script>` tags intact.

If scope is a component: skip this step.

### 0.6 Theme & Project Context

**Theme check:**

Check if `.project/config/THEME.md` exists.

- **Found + inspiration mode:** Read and store tokens. Mandatory for mapping.
- **Found + copy mode:** Read as reference. Use for shared utilities (cn(), Tailwind config) but not for color/font values.
- **Not found + inspiration mode:** Abort with suggestion: `"Inspiration mode vereist THEME.md. Run eerst /frontend-theme of kies 1:1 kopie."`
- **Not found + copy mode:** Proceed with extracted values from source image.

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
Theme:      [Available from THEME.md | Not available]
Existing:   [N] components found
  Reusable: [component names that match source sections]

════════════════════════════════════════════════════════════
```

---

## FASE 1: Token Mapping (Inspiration mode only)

**Skip this phase entirely if `$MODE` = copy.**

### 1.1 Extract and Map

Extract visual properties from the source image and map them to the closest THEME.md tokens:

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
question: "Klopt deze mapping van bron-design naar je project tokens?"
options:
  - label: "Ja, ga door (Recommended)", description: "Gebruik deze mapping voor code generatie"
  - label: "Aanpassen", description: "Ik wil specifieke mappings wijzigen"
multiSelect: false
```

If "Aanpassen": ask which mappings to change, update, re-confirm.

---

## FASE 2: Code Generation

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

════════════════════════════════════════════════════════════
```

### 2.2 Generate Code

Generate the page and components based on the source image.

**Rules:**

- Follow `shared/RULES.md` for React/TypeScript standards
- Follow `shared/PATTERNS.md` for component patterns
- Use `cn()` for className composition — create `src/lib/utils.ts` if not present
- TypeScript strict mode with proper interfaces
- Semantic HTML with aria-labels and keyboard support
- Import existing components — never regenerate what already works

**Mode-specific:**

- **1:1 copy:** Match source colors, fonts, spacing as closely as possible. Use arbitrary Tailwind values (`bg-[#FF5733]`, `text-[20px]`) when no standard class matches. Prioritize visual fidelity.
- **Inspiration:** Use only THEME.md tokens and standard Tailwind classes. Match source layout and structure, not visual details. No arbitrary values.

**Contextual content:** Never use "Lorem ipsum." Infer contextual placeholder text from the source image or describe what real content would go there.

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

Mode:  [1:1 copy | Inspiration with theme tokens]
Theme: [Integrated from THEME.md | Extracted from source]

════════════════════════════════════════════════════════════
```

---

## FASE 3: Visual Verification Loop

Self-verify by comparing the source image against a Playwright screenshot of the generated output. Max 3 rounds.

### 3.0 Pre-flight

Check Playwright MCP tools available (`browser_navigate`, `browser_take_screenshot`, `browser_close`). If unavailable: skip with message `"Playwright niet beschikbaar — open de pagina handmatig om te verifiëren."`, proceed to FASE 4.

### 3.1 Dev Server

Detect or start dev server:

1. Check if dev server already running on expected port (try `browser_navigate`)
2. If not running: start in background (`npm run dev` / `npx next dev` based on framework)
3. Wait for server ready

### 3.2 Verification Round

```
VERIFICATION ROUND [N]/3
────────────────────────
```

**Sequence:**

1. `browser_navigate` → `http://localhost:[port]/[page-path]`
2. `browser_wait_for` → `{ time: 3 }` (allow hydration)
3. `browser_take_screenshot` → capture generated page

**Compare source image vs generated screenshot. Analyze:**

- Layout structure (sections in correct order, proportions roughly match)
- Spacing (gaps between sections, padding within sections)
- Color accuracy (1:1 mode: exact match matters; inspiration: theme tokens applied correctly)
- Typography (heading sizes, weight, alignment)
- Component rendering (all sections visible, no blank areas, no error overlays)
- Missing elements (anything in source not present in output)

**Assessment:**

```
ROUND [N] ASSESSMENT
═════════════════════════
Match quality: [High | Medium | Low]

Discrepancies:
  [1. specific issue — file:line — suggested fix]
  [2. specific issue — file:line — suggested fix]
  [3. specific issue — file:line — suggested fix]

Action: [✓ Acceptable — stop | → Fix and re-check]
═════════════════════════
```

**Decision logic:**

- **No significant discrepancies** → stop loop, proceed to FASE 4
- **Fixable discrepancies AND rounds remaining** → apply targeted edits, increment round, repeat from 3.2
- **Round 3 reached** → stop loop regardless, report remaining discrepancies

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
  - [discrepancy — recommended fix via /frontend-iterate]

════════════════════════════════════════════════════════════
```

Close browser: `browser_close`

---

## FASE 4: Completion

### 4.1 Update DevInfo

Update `.project/session/devinfo.json`:

```json
{
  "handoff": {
    "from": "frontend-convert",
    "to": "frontend-iterate",
    "data": {
      "inputType": "screenshot | url | image",
      "mode": "copy | inspiration",
      "pageFile": "[page file path]",
      "components": ["[list of created component files]"],
      "verificationRounds": 2,
      "finalMatchQuality": "high",
      "framework": "[detected framework]",
      "theme": "[THEME.md path or null]"
    }
  }
}
```

### 4.2 Backlog Completion Sync (page scope only)

If page scope and backlog exists:

1. Read `.project/backlog.html` → parse JSON
2. Find feature matching page name → set `stage: "built"`, `data.updated` to today
3. Write back via Edit (keep `<script>` tags intact)

### 4.3 Completion Report

```
CONVERT COMPLETE
═══════════════════════════════════════════════════════════

Source:       [file path | URL | pasted image]
Mode:         [1:1 copy | Inspiration]
Framework:    [detected framework]
Verification: [N] rounds, [High | Medium | Low] match

Files ([N]):
  Page:       [page file path]
  Components: [component paths]

Next steps:
  1. /frontend-iterate → visual fine-tuning in browser
  2. /frontend-audit → performance/SEO audit

═══════════════════════════════════════════════════════════
```

---

## Restrictions

This skill must **NEVER**:

- Generate code without first analyzing the source image
- Use "Lorem ipsum" — always use contextual content from the source or realistic placeholders
- Run inspiration mode without THEME.md
- Skip the visual verification loop when Playwright is available
- Regenerate components that already exist in the codebase — import and reuse
- Exceed 3 verification rounds

This skill must **ALWAYS**:

- Resolve visual input before any code generation
- Confirm mode (1:1 vs inspiration) with user
- Confirm token mapping with user in inspiration mode
- Follow `shared/RULES.md` and `shared/PATTERNS.md`
- Detect and match the project's framework
- Run the Playwright verification loop (unless tools unavailable)
- Update DevInfo for downstream skill handoff
- Show a completion report with next steps
