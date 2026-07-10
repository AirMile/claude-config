# Convert Mode: 1:1 Copy

Loaded after PHASE 0.3 when `$MODE = copy`. Defines this mode's theme requirement, PHASE 1 procedure (Fidelity Extraction) with its `ExitPlanMode` point, codegen rules, and verification thresholds. Goal: pixel-accurate reproduction of the source — colors, fonts, spacing, and text exactly as in the original.

## Theme Requirement

Theme is **optional**. If `project.json → theme` is populated: use it only for shared utilities (`cn()`, Tailwind config) — never for color/font values. If absent: proceed with values extracted from the source.

## PHASE 1: Fidelity Extraction

Copy-mode counterpart to token mapping: capture exact source values instead of mapping to tokens.

### 1.0 Ground-Truth Extraction (`$INPUT_SOURCE = "url"`, `"figma-mcp"`, or `"figma-rest"`)

**For `$INPUT_SOURCE = "figma-mcp"`:** extract ground truth via the Figma MCP instead of browser eval:

1. `get_design_context` on the node link → code representation with exact values (colors, spacing, typography, radii, shadows). Parse into `$EXTRACTED_STYLES`.
2. `get_variable_defs` on the node link → the variables/styles backing those values (token names + values). Merge into `$EXTRACTED_STYLES` — keep the variable names, they inform naming in codegen.
3. Assets: `download_assets` (PNG/JPG/SVG, max 20 nodes per call) → save under `public/` (or the framework's static dir) and record paths as `$EXTRACTED_ASSETS`.

`get_variable_defs` returning empty is **normal** — agency files often use raw fills without Figma variables. Not an error: `get_design_context` already carries the exact values; proceed without variable names.

**For `$INPUT_SOURCE = "figma-rest"`:** same as figma-mcp, but read exact values (fills, typography, layout, radii, effects) from the node-tree JSON captured in 0.1 (`.project/tmp/source-node.json`) → `$EXTRACTED_STYLES`, labeled `computed`. Assets: `GET /v1/images/{key}?ids={asset-node-ids}&format=png|svg` per asset node → `$EXTRACTED_ASSETS`.

MCP values are labeled `computed` in the fidelity table. Skip the browser-eval sequence below.

**For `$INPUT_SOURCE = "url"`:** extract computed styles instead of estimating from pixels. The browser session from PHASE 0.1 is closed — re-open the URL.

Prefer `navigate` + `javascript_tool` (Claude-in-Chrome) when a live local Chrome is connected — see `shared/CLAUDE-IN-CHROME.md` for the tool-loading ritual. Fall back to the `playwright-cli` sequence below otherwise:

```
playwright-cli open [url]
playwright-cli run-code "async page => { await page.waitForTimeout(3000); }"
playwright-cli eval "() => { const pick = el => { const s = getComputedStyle(el); return { text: (el.textContent||'').trim().slice(0,80), color: s.color, background: s.backgroundColor, fontFamily: s.fontFamily, fontSize: s.fontSize, fontWeight: s.fontWeight, lineHeight: s.lineHeight, padding: s.padding, margin: s.margin, gap: s.gap, borderRadius: s.borderRadius, border: s.border, boxShadow: s.boxShadow }; }; const sels = ['h1','h2','h3','p','a','button','nav','header','footer','section','input']; return Object.fromEntries(sels.map(sel => [sel, Array.from(document.querySelectorAll(sel)).slice(0,3).map(pick)])); }"
playwright-cli eval "() => ({ images: Array.from(document.images).slice(0,20).map(i => ({ src: i.currentSrc, alt: i.alt, w: i.naturalWidth, h: i.naturalHeight })), svgCount: document.querySelectorAll('svg').length, fontFamilies: Array.from(new Set(Array.from(document.querySelectorAll('body *')).slice(0,300).map(e => getComputedStyle(e).fontFamily))) })"
playwright-cli close
```

Store the results as `$EXTRACTED_STYLES` (computed values per element type) and `$EXTRACTED_ASSETS` (image URLs, SVG count, font families).

**Other input sources — fall back to vision estimation:**

| `$INPUT_SOURCE` | Why no extraction                                                                                                                                                             | Action                                                |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `design-tool`   | Figma/Canva render to `<canvas>` — computed styles describe the tool UI, not the design. Only applies when the figma MCP is unavailable (otherwise the source is `figma-mcp`) | Estimate from the screenshot; mark values `estimated` |
| `file`          | Static image — no DOM available                                                                                                                                               | Estimate from the image; mark values `estimated`      |
| `chat-image`    | Static image — no DOM available                                                                                                                                               | Estimate from the image; mark values `estimated`      |

### 1.1 Fidelity Table

Compile the exact-value table from `$EXTRACTED_STYLES`/`$EXTRACTED_ASSETS` (or vision estimation):

```
FIDELITY EXTRACTION
════════════════════════════════════════════════════════════

Colors:                                          Source
  Heading text         #1A1A2E                   computed
  Body text            #4A4A68                   computed
  Primary CTA bg       #FF5733                   computed
  Page background      #FAFAFA                   computed

Typography:
  Headings             "Inter", sans-serif · 700 · 36px/1.2   computed
  Body                 "Inter", sans-serif · 400 · 16px/1.6   computed

Spacing:
  Section padding      64px vertical             computed
  Card gap             24px                      computed

Radii & shadows:
  Cards                radius 12px · shadow 0 4px 12px rgba(0,0,0,.08)   computed

Exact text (per section):
  Hero h1              "Pricing that scales with you"
  Hero CTA             "Start free trial"
  ...

Assets:
  /img/hero-dashboard.png   (1280×720)
  3 inline SVGs (icons)

════════════════════════════════════════════════════════════
```

`Source` column: `computed` (ground-truth extraction) or `estimated` (vision). Mixed tables are normal when extraction partially failed.

### 1.2 Confirm

```yaml
header: "Fidelity"
question: "Is this extraction of the source's exact values correct?"
options:
  - label: "Yes, continue (Recommended)", description: "Use these exact values for code generation"
  - label: "Adjust", description: "I want to correct specific values"
multiSelect: false
```

If "Adjust": ask which values to change, update, re-confirm.

> **Todo**: Use the `ExitPlanMode` tool once the extraction is confirmed — present SOURCE ANALYSIS + FIDELITY EXTRACTION as the plan output. After user approval, all remaining phases (codegen, verification, completion) run in Sonnet. Do NOT re-enter plan mode later in this run. Skip this exit if plan mode is no longer active (patch path already exited) or the skill was started in plan mode by the user (see `shared/PLAN-MODE.md § Exit`).

## Codegen Rules (applied in PHASE 2.2)

- Use exact arbitrary Tailwind values from the fidelity table: `bg-[#FF5733]`, `text-[17px]`, `rounded-[12px]` — when no standard class matches exactly. Visual fidelity beats class purity.
- Use exact text content from the fidelity table — never paraphrase, never substitute placeholder copy.
- Reference captured asset URLs directly with a `{/* TODO: localize asset */}` comment — never download assets silently. Exception `figma-mcp`: assets were already exported via `download_assets` in 1.0 — reference the local `$EXTRACTED_ASSETS` paths, no TODO needed.
- Use the exact `font-family` with its fallback stack. If a Google Font is recognized: note the required import in the Generation Summary.
- Gold standard: `../examples/PricingPage-1to1.tsx`.

## Verification Thresholds (applied in PHASE 3)

- `$VERIFY_PIXEL_RATIO = 0.01` (strict — copy mode promises pixel accuracy).
- Early stop requires Vision match quality **High**. **Medium** is acceptable only at round 3, with remaining discrepancies listed.
- If `$EXTRACTED_STYLES` exists: run the same `eval` extraction snippet against the localhost page and compare against the fidelity table — flag any element whose computed values diverge.
