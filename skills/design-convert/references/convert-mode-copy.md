# Convert Mode: 1:1 Copy

Loaded after PHASE 0.3 when `$MODE = copy`. Defines this mode's theme requirement, PHASE 1 procedure (Fidelity Extraction) with its `ExitPlanMode` point, codegen rules, and verification thresholds. Goal: pixel-accurate reproduction of the source — colors, fonts, spacing, and text exactly as in the original.

## Theme Requirement

Theme is **optional**. If `project.json → theme` is populated: use it only for shared utilities (`cn()`, Tailwind config) — never for color/font values. If absent: proceed with values extracted from the source.

## PHASE 1: Fidelity Extraction

Copy-mode counterpart to token mapping: capture exact source values instead of mapping to tokens.

### 1.0 Ground-Truth Extraction (`$INPUT_SOURCE = "url"`, `"figma-mcp"`, `"figma-rest"`, or `"figma-make"`)

**For `$INPUT_SOURCE = "figma-mcp"`:** extract ground truth via the Figma MCP instead of browser eval:

1. `get_design_context` on the node link → code representation with exact values (colors, spacing, typography, radii, shadows). Parse into `$EXTRACTED_STYLES`.
2. `get_variable_defs` on the node link → the variables/styles backing those values (token names + values). Merge into `$EXTRACTED_STYLES` — keep the variable names, they inform naming in codegen.
3. Assets — three-outcome branch, do not assume:
   - `download_assets` present and returns files → save under `public/` (or the framework's static dir), record paths as `$EXTRACTED_ASSETS`.
   - `download_assets` absent from the connected MCP toolset, OR present but returns empty for these nodes (both normal — not every Figma MCP server exposes it, and raster fills on unselected/grouped nodes routinely export empty) → fetch the image URLs `get_design_context` already returned (`http://localhost:.../assets/...`, served live by Figma desktop for the session's duration) directly via Bash (`curl -o public/images/{slug}.jpg {url}`); record the written paths as `$EXTRACTED_ASSETS`. These URLs die when Figma desktop closes — do not defer this fetch.
   - Fetch also fails → this is a **blocking gap**, not a judgment call. Do not invent a path. Emit the live URL with the `{/* TODO: localize asset */}` comment and add the item to 4.4b's Open-gaps bucket.

`get_variable_defs` returning empty is **normal** — agency files often use raw fills without Figma variables. Not an error: `get_design_context` already carries the exact values; proceed without variable names. `$EXTRACTED_ASSETS` ending up empty after all three outcomes is equally normal — it is not evidence anything went wrong, only evidence the general asset rule below applies.

**For `$INPUT_SOURCE = "figma-rest"`:** same as figma-mcp, but read exact values (fills, typography, layout, radii, effects) from the node-tree JSON captured in 0.1 (`.project/tmp/source-node.json`) → `$EXTRACTED_STYLES`, labeled `computed`. Assets: `GET /v1/images/{key}?ids={asset-node-ids}&format=png|svg` per asset node → `$EXTRACTED_ASSETS`.

MCP values are labeled `computed` in the fidelity table. Skip the browser-eval sequence below.

**For `$INPUT_SOURCE = "url"` or `"figma-make"`:** extract computed styles instead of estimating from pixels. The browser session from PHASE 0.1 is closed — re-open the URL. For `figma-make` this must run via Claude-in-Chrome (the preview needs the user's logged-in session — see route-convert 0.1) — its `navigate` + `javascript_tool` per `shared/CLAUDE-IN-CHROME.md`. For a plain `url` source (no session dependency), use the `playwright-cli` sequence below by default (scriptable — see `shared/BROWSER-VEHICLES.md`):

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

**Interactions:** if `$INTERACTION_SPEC` is set (interaction capture in route-convert 0.2), present the INTERACTIONS table (`convert-interactions.md` Step 4) directly below the fidelity table — the 1.2 confirm covers both.

### 1.2 Confirm

The question body must open with the `Sections:` line from SOURCE ANALYSIS (0.2), enumerated top-to-bottom in the exact order they will be generated — this is the only point in the route where that order becomes an artifact the user sees before codegen, rather than a mental note. If SOURCE ANALYSIS was compressed into this same confirmation (common when 0.2 and 1.1 end up presented together), the section order must still appear as its own line, not buried inside prose.

```yaml
header: "Fidelity"
question: "Sections (top-to-bottom): {list}. Is this extraction of the source's exact values correct?"
options:
  - label: "Yes, continue (Recommended)", description: "Use these exact values and this section order for code generation"
  - label: "Adjust", description: "I want to correct specific values or the section order"
multiSelect: false
```

If "Adjust": ask which values to change, update, re-confirm.

> **Todo**: Use the `ExitPlanMode` tool once the extraction is confirmed — present SOURCE ANALYSIS + FIDELITY EXTRACTION (+ INTERACTIONS when captured) as the plan output. After user approval, all remaining phases (codegen, verification, completion) run in Sonnet. Do NOT re-enter plan mode later in this run. Skip this exit if plan mode is no longer active (patch path already exited) or the skill was started in plan mode by the user (see `shared/PLAN-MODE.md § Exit`).

## Codegen Rules (applied in PHASE 2.2)

- Use exact arbitrary Tailwind values from the fidelity table: `bg-[#FF5733]`, `text-[17px]`, `rounded-[12px]` — when no standard class matches exactly. Visual fidelity beats class purity.
- Use exact text content from the fidelity table — never paraphrase, never substitute placeholder copy.
- Reference captured asset URLs directly with a `{/* TODO: localize asset */}` comment — never download assets silently. Exception `figma-mcp` **when `$EXTRACTED_ASSETS` is non-empty**: reference the local paths from the branch above, no TODO needed. `$EXTRACTED_ASSETS` empty or unset → the general rule applies regardless of source type.
- Never invent an asset path. The same rule that forbids paraphrasing placeholder copy (above) applies to assets: a `src`/`href` must resolve to a file written this run or carry the `{/* TODO: localize asset */}` comment with a live URL — never a plausible-looking filename that doesn't exist on disk.
- Use the exact `font-family` with its fallback stack. If a Google Font is recognized: note the required import in the Generation Summary.
- Figma sources (`figma-mcp`/`figma-rest`): Figma-emitted code is a **value source, not a code source**. Never copy absolute pixel offsets (`left-[92.33px]`) — reconstruct element groups with flex/grid + gap (visual result identical, code responsive). Replace data-URI SVG gradients with equivalent CSS gradients. Repeated visual patterns (buttons, cards, badges) become one shared component even when the file has no Figma components.
- `$INTERACTION_SPEC` rows with `source: spec-text` or `observed` are ground truth — implement with exact values: arbitrary easing (`ease-[cubic-bezier(0.25,0.46,0.45,0.94)]`), exact scale/translate/duration values. Implementation patterns (sibling-dimming, scroll entrances, `prefers-reduced-motion` wrapper): `convert-generate-template.md § Motion`.
- Gold standard: `../examples/PricingPage-1to1.tsx`.

## Verification Thresholds (applied in PHASE 3)

- `$VERIFY_PIXEL_RATIO = 0.01` (strict — copy mode promises pixel accuracy).
- Early stop requires Vision match quality **High**. **Medium** is acceptable only at round 3, with remaining discrepancies listed.
- If `$EXTRACTED_STYLES` exists: run the same `eval` extraction snippet against the localhost page and compare against the fidelity table — flag any element whose computed values diverge.
- If `$INTERACTION_SPEC` is set: the 3.2d interaction check runs **exact** — computed transform (matrix-equivalent), duration, and easing must match the spec values.
