# Convert Mode: 1:1 Copy

Loaded after PHASE 0.3 when `$MODE = copy`. Defines this mode's theme requirement, PHASE 1 procedure (Fidelity Extraction) with its `ExitPlanMode` point, codegen rules, and verification thresholds. Goal: pixel-accurate reproduction of the source — colors, fonts, spacing, and text exactly as in the original.

## Theme Requirement

Theme is **optional**. If `project.json → theme` is populated: use it only for shared utilities (`cn()`, Tailwind config) — never for color/font values. If absent: proceed with values extracted from the source.

## PHASE 1: Fidelity Extraction

Copy-mode counterpart to token mapping: capture exact source values instead of mapping to tokens.

### 1.0 Ground-Truth Extraction (`$INPUT_SOURCE = "url"`, `"figma-mcp"`, `"figma-rest"`, or `"figma-make"`)

**For `$INPUT_SOURCE = "figma-mcp"`:** extract ground truth via the Figma MCP instead of browser eval:

**Delegate the extraction — never run it in the main context.** A full-page frame returns 10–15k tokens of raw `get_design_context` output, and none of it is needed again once §1.1's table exists (`shared/SKILL-PATTERNS.md § Pass Paths, Not Content`).

Dispatch one extraction agent per frame: `Agent` tool, `subagent_type: "general-purpose"`, `model: "sonnet"` (mechanical extraction against a fixed schema, per `§ Agent Model Selection`). Several frames → dispatch in one message (`§ Parallel Dispatch`).

The brief carries, verbatim:

- the explicit node-ids (never a bare `get_metadata` — that reads the Figma desktop app's current selection, which the agent cannot see);
- §1.1's table shape rules — one row per colour segment · one spacing row per section · one line-break row per heading · `offset` only on sections that actually overlap;
- this rule, which otherwise lives in a file the agent never reads: _"do NOT substitute a single whole-frame `get_design_context` — that collapses every section's fills into one result and loses per-section ground truth"_ (`route-convert.md:81`). A fresh Sonnet with a node list and a token budget is exactly the actor most likely to make that call.

The agent returns ONLY the filled fidelity-table rows, and writes its raw output to `.project/tmp/figma-extract-{node}.json` so a later spot-check can grep one value without reloading the dump. Store those paths as `$EXTRACTED_RAW[]`.

**Row-count assertion (mandatory).** A delegated table fails by _omission_, and §3.2c cannot catch that: it drives its comparison off the table's rows, so a row the agent never emitted never mismatches. Before accepting the table, count against `$SOURCE_STRUCTURE` — which is already in the main context and costs nothing to re-read:

- one spacing row per section frame;
- one line-break row per heading text node;
- at least one `seg` row per heading whose text node reports more than one style run.

Counts short → re-dispatch that frame naming the gap. Do not fall back to running the extraction inline: that is the cost this step avoids.

The steps below are the brief handed to each extraction agent — they describe what the agent does, not what runs here:

1. `get_design_context` on the node link → code representation with exact values (colors, spacing, typography, radii, shadows). Parse into `$EXTRACTED_STYLES`.
   - **Mixed-fill text nodes.** A heading whose characters carry different fills (an accent word in a brand color) arrives as multiple styled runs, not as one color. Record every run as its own segment `{text, fill, weight, family}` under that node. Record `family` even when it looks like a substitution — the Codegen Rules below decide what to do with it, and a family dropped here cannot be questioned later. Collapsing to the dominant fill is the single most common way a two-tone title ships monochrome — the value is already in the response, it gets lost on the way into the table.
   - **Layout spacing.** Record `paddingTop/Bottom/Left/Right` and `itemSpacing` **per section node**, never one page-wide value. Section padding and grid gaps differ per section in almost every real design.
   - **Section offset.** A section frame that starts _above_ the bottom of the frame before it is deliberately overlapping — record that distance as a negative block-start offset for that section, together with the top radius that makes the overlap visible. Sections that simply stack record nothing. This is the only value in the extraction describing a relationship between two sections rather than one section's own box, which is exactly why a per-section padding read cannot represent it.
2. `get_variable_defs` on the node link → the variables/styles backing those values (token names + values). Merge into `$EXTRACTED_STYLES` — keep the variable names, they inform naming in codegen.
3. Assets — three-outcome branch, do not assume:
   - `download_assets` present and returns files → save under `public/` (or the framework's static dir), record paths as `$EXTRACTED_ASSETS`.
   - `download_assets` absent from the connected MCP toolset, OR present but returns empty for these nodes (both normal — not every Figma MCP server exposes it, and raster fills on unselected/grouped nodes routinely export empty) → fetch the image URLs `get_design_context` already returned (`http://localhost:.../assets/...`, served live by Figma desktop for the session's duration) directly via Bash (`curl -o public/images/{slug}.jpg {url}`); record the written paths as `$EXTRACTED_ASSETS`. These URLs die when Figma desktop closes — do not defer this fetch.
   - Fetch also fails → this is a **blocking gap**, not a judgment call. Do not invent a path. Emit the live URL with the `{/* TODO: localize asset */}` comment and add the item to 4.4b's Open-gaps bucket.

`get_variable_defs` returning empty is **normal** — agency files often use raw fills without Figma variables. Not an error: `get_design_context` already carries the exact values; proceed without variable names. `$EXTRACTED_ASSETS` ending up empty after all three outcomes is equally normal — it is not evidence anything went wrong, only evidence the general asset rule below applies.

**For `$INPUT_SOURCE = "figma-rest"`:** same as figma-mcp, but read exact values (fills, typography, layout, radii, effects) from the node-tree JSON captured in 0.1 (`.project/tmp/source-node.json`) → `$EXTRACTED_STYLES`, labeled `computed`. The mixed-fill case lives in the text node's `characterStyleOverrides` + `styleOverrideTable` — read both, never `style.fills` alone (that returns the node default and silently drops every accent segment). Assets: `GET /v1/images/{key}?ids={asset-node-ids}&format=png|svg` per asset node → `$EXTRACTED_ASSETS`.

MCP values are labeled `computed` in the fidelity table. Skip the browser-eval sequence below.

**For `$INPUT_SOURCE = "url"` or `"figma-make"`:** extract computed styles instead of estimating from pixels. **Copy the script into the project first, then run the copy** — ESM resolves `playwright` relative to the script file, and `~/.claude/skills/` has no `node_modules`, so running it in place always exits `ERR_MODULE_NOT_FOUND`:

```bash
mkdir -p .project/tmp
cp ~/.claude/skills/design-convert/scripts/extract-computed-styles.mjs .project/tmp/
node .project/tmp/extract-computed-styles.mjs "[url]" > .project/tmp/extracted-styles.json
```

`ERR_MODULE_NOT_FOUND` means the copy step was skipped, not that the page failed. `convert-completion.md § 4.5` deletes the copy at the end of the run.

Store the parsed result as `$EXTRACTED_STYLES` (`elements`, `sections`, `seams`) and `$EXTRACTED_ASSETS` (`assets`). Exit 1 means the page never loaded — that is a blocking gap, not a reason to fall back to vision estimation on a source that has a DOM.

`figma-make` is the one exception: its preview needs the user's logged-in session, so the script cannot reach it. Drive Claude-in-Chrome instead (`navigate` + `javascript_tool` per `shared/CLAUDE-IN-CHROME.md`) and run the script's `page.evaluate` body as the injected snippet — same contract, same output shape.

What the script measures, and why each part is load-bearing (do not hand-roll a smaller version):

- **`seg(el)`** walks inline children, so a heading with an accent `<span>` returns one entry per color segment. `getComputedStyle` on the parent alone reports a single color for a two-tone title.
- **Wrapper selectors** (`section > div`, `[class*=container|grid|flex]`) are where section padding and grid gaps actually live in a Tailwind page — `h1`/`p`/`section` carry almost none of it. It takes 8 per selector, not 3, so sections past the top of the page get measured.
- **`sections[]`** gives one padding/margin/radius row per section, so each section is compared against its own fidelity row instead of a page-wide average.
- **`seams[]`** is the only measurement that looks at two sections at once — it is what catches a negative margin cropping the previous section's bottom padding while every padding value in the code is still correct.
- **The scroll pass** fires scroll-triggered entrances before measuring; without it every element below the fold reports its pre-animation state.

The same script is what `convert-verification-loop.md § 3.2c` runs against the rendered page, so it governs verification for **every** input source — including a pure Figma run that never executes the command above.

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
  Hero h1 · seg 1  "Protect your"  #1A1A2E · 700 computed
  Hero h1 · seg 2  "building"      #FF5733 · 700 computed
  Body text                        #4A4A68       computed
  Primary CTA bg                   #FF5733       computed
  Page background                  #FAFAFA       computed

Typography:
  Headings             "Inter", sans-serif · 700 · 36px/1.2   computed
  Body                 "Inter", sans-serif · 400 · 16px/1.6   computed

Spacing (per section):
  Hero                 padding 96/24px · gap 32px                 computed
  Features             padding 64/24px · gap 24px · offset -60px  computed
  Footer               padding 48/24px · gap 16px                 computed

Radii & shadows:
  Cards                radius 12px · shadow 0 4px 12px rgba(0,0,0,.08)   computed

Exact text (per section):
  Hero h1              "Pricing that scales with you"
  Hero CTA             "Start free trial"
  ...

Line breaks (per heading):
  Hero h1              3 lines · "Pricing that" / "scales" /
                       "with you"                          computed
  Features h2          1 line                              computed

Assets:
  /img/hero-dashboard.png   (1280×720)
  3 inline SVGs (icons)

════════════════════════════════════════════════════════════
```

`Source` column: `computed` (ground-truth extraction) or `estimated` (vision). Mixed tables are normal when extraction partially failed.

**This table is the only artifact that survives the `ExitPlanMode` handoff below** — codegen and verification both read it, not the raw extraction. A value that cannot be _represented_ here is lost even when §1.0 captured it perfectly. Two shape rules follow from that, and neither is optional:

- **One row per color segment, not per element type.** A text node whose fill is not uniform (an accent word, a gradient-split heading) gets one row per segment, labeled `{element} · seg {n}` with its literal text. Collapsing to the dominant color is forbidden — that is exactly how a two-tone title ships monochrome.
- **One spacing row per section, never a page-wide row.** `Section padding: 64px` for a whole page is not ground truth, it is an average. List each section with its own padding and gap.
- **One line-break row per heading.** Where a heading wraps is a design decision, not a rendering accident — `max-width`, `text-balance` and font choice all move it, and a heading that ships on two lines where the design has one reads as a different design. The value is already in hand at §1.0: the text node carries both its height and its line-height, so `round(height / lineHeight)` is the line count, and the frame render shows which word starts each line. Without this row both are captured and then discarded.
- **An `offset` field belongs to the section that carries it, never to a sibling.** Only sections the design actually overlaps get one; the rest omit the field entirely. Copying an offset across rows because neighbouring sections "look the same" produces a negative margin on a section that was never meant to overlap — which crops the previous section's bottom padding while every padding value in the table stays correct, so nothing downstream reads as wrong.

Sections with genuinely identical values may share one row (`Features, Pricing  padding 64/24px`) — merging equal measurements is fine, guessing one value for all of them is not.

**Interactions:** if `$INTERACTION_SPEC` is set (interaction capture in route-convert 0.2), present the INTERACTIONS table (`convert-interactions.md` Step 4) directly below the fidelity table — the 1.2 confirm covers both.

### 1.2 Confirm

Whichever form this takes, the confirmation must open with the `Sections:` line from SOURCE ANALYSIS (0.2), enumerated top-to-bottom in the exact order they will be generated — this is the only point in the route where that order becomes an artifact the user sees before codegen, rather than a mental note. Even when 0.2 and 1.1 are presented together, the section order appears as its own line, never buried inside prose.

**There is exactly one gate here.** Branch on plan-mode state — asking both is the double confirmation `SKILL-PATTERNS.md` warns about:

**Plan mode active (the normal path — entered at route-convert 0.1)** → `ExitPlanMode` **is** this confirmation. Write SOURCE ANALYSIS + FIDELITY EXTRACTION (+ INTERACTIONS when captured) into the plan file, then call it. Its rejection path is the "Adjust" branch: the user's correction arrives as prose, apply it, update the plan file, call `ExitPlanMode` again. Do not also ask the modal below.

> **Todo**: after approval, all remaining phases (codegen, verification, completion) run in Sonnet. Do NOT re-enter plan mode later in this run.

**Plan mode not active** (patch fast-path already exited, or the user started the skill outside it — see `shared/PLAN-MODE.md § Exit`) → there is no approval gate yet, so ask:

```yaml
header: "Fidelity"
question: "Sections (top-to-bottom): {list}. Is this extraction of the source's exact values correct?"
options:
  - label: "Yes, continue (Recommended)", description: "Use these exact values and this section order for code generation"
  - label: "Adjust", description: "I want to correct specific values or the section order"
multiSelect: false
```

If "Adjust": ask which values to change, update, re-confirm.

## Codegen Rules (applied in PHASE 2.2)

- Use exact arbitrary Tailwind values from the fidelity table: `bg-[#FF5733]`, `text-[17px]`, `rounded-[12px]` — when no standard class matches exactly. Visual fidelity beats class purity.
- **"No standard class matches" is a lookup, not an impression.** Before emitting any arbitrary value, resolve it against the project's own token list (`project.json#theme`, or the `@theme`/`:root` block in the stylesheet — read it once at 2.2 and keep it). Three outcomes, and only the last one produces an arbitrary value:
  - **Exact match** → emit the token class. `rounded-[16px]` where `--radius-2xl: 1rem` exists is a token written the long way; it renders identically and silently opts the page out of every future token change.
  - **Composite value whose _tint_ is tokenised but whose geometry is not** (shadows are the usual case: the design's blur/offset is its own, the colour is the brand's) → keep the geometry from the design, take the colour from the token. A shadow carrying the design tool's near-miss purple is the same defect as a heading carrying it, and it hides better.
  - **No equivalent** → arbitrary value, as above.

  This check is not optional under "the user approved mapping to project tokens" at 0.6 — that approval is what _requires_ it. It applies to every property with a token namespace: colour, radius, shadow, font, spacing, z-index. Spacing legitimately lands on "no equivalent" most often (a 107px section padding is not on anyone's scale); radii and shadow tints almost never do.

  <!-- Rationale: one run emitted rounded-[16px]/[20px]/[24px] against exact
  --radius-2xl/-card-sm/-card-md tokens, and shadows tinted rgb(45 40 112) — the
  Figma purple the same run had been told to map to rgb(43 33 113). Colour was
  checked because the mapping was visible in the fidelity table; radius and shadow
  were not, because nothing asked. -->

- Use exact text content from the fidelity table — never paraphrase, never substitute placeholder copy.
- **Multi-segment rows emit multi-segment markup.** A heading with two `seg` rows becomes one element wrapping a `<span>` per segment, each carrying its own color class: `<h1 className="text-[#1A1A2E]">Protect your <span className="text-[#FF5733]">building</span></h1>`. Never pick one color for the whole heading — the row count in the table is the span count in the output. **The same applies to weight and style.** When a segment's row carries a weight or style value that differs from the element's own base (heading is 400/normal, an accent segment is 700 or italic), emit `font-bold`/`italic`/`font-[weight]` on that segment's span too — a color-only span that silently drops a differing weight is the same defect as a collapsed color, and just as easy to miss because nothing about the span "looks" wrong.
- **Separate rhythm from composition before deciding whether a spacing value is exact-worthy.** Not every number in the table deserves the same fidelity:
  - **Rhythm** — section padding, grid gaps between repeated cards. The design's spread here (80 / 84 / 91 / 107px across four sections) is almost never a designed distinction; it is where the frames happened to land. The project usually already owns this: a `Section`/layout component with padding variants, a standard gap scale. Adopt it, and say so in the Generation Summary with the per-section delta so the user can object.
  - **Composition** — a negative section offset and its top radius, an image offset that stacks two columns, a fixed card or media height, an aspect ratio. These carry layout meaning; rounding them changes proportion, not air. Emit exactly.
  - Where the two conflict, rhythm loses to whatever the codebase already does and composition wins over it.

  A design that genuinely varies its rhythm deliberately (a dark section given more air than its neighbours) is the exception — flag it and ask rather than flattening it silently.

- **Spacing comes from that section's own row**, not from the first section's. A page whose sections all render `py-16` because one value was read off the top of the table is the spacing defect this table shape exists to prevent.
- **An `offset` row emits the negative margin _and_ the top radius together** (`-mt-[60px] rounded-t-[60px]` on the same element, per `shared/FRONTEND-RULES.md` H009). A row without an `offset` field emits neither — no negative margin, no top radius. These two classes are one declaration: the margin slides the section over its predecessor, the radius is what makes that overlap read as a curve instead of as 60px of the previous section's padding being cut off.
- Reference captured asset URLs directly with a `{/* TODO: localize asset */}` comment — never download assets silently. Exception `figma-mcp` **when `$EXTRACTED_ASSETS` is non-empty**: reference the local paths from the branch above, no TODO needed. `$EXTRACTED_ASSETS` empty or unset → the general rule applies regardless of source type.
- Never invent an asset path. The same rule that forbids paraphrasing placeholder copy (above) applies to assets: a `src`/`href` must resolve to a file written this run or carry the `{/* TODO: localize asset */}` comment with a live URL — never a plausible-looking filename that doesn't exist on disk.
- Use the exact `font-family` with its fallback stack. If a Google Font is recognized: note the required import in the Generation Summary.
- **A font name on an accent segment is a claim to verify, not a value to copy.** (The token lookup above catches values the project has _named_; this catches roles the project has already _solved_ — a pattern, not a token.) Design tools substitute freely: a run styled "Times New Roman Bold Italic" or "Playfair Display Medium Italic" inside an otherwise-branded heading is usually the tool's stand-in for _emphasis_, not a second typeface the brand owns. Before emitting any font class on a segment, grep the codebase for the same visual role — an accent word in a heading — and read what it already does:

  ```bash
  grep -rn "text-accent\|text-\[#" src/components --include=*.tsx | grep -i "italic\|<span"
  ```

  An existing implementation of that pattern outranks the literal font mapping, even when the user approved "map Figma fonts to project fonts" at 0.6 — that answer authorises reusing the project's fonts, not introducing a second serif the site never used. Emit a different family from the surrounding heading **only** when the codebase already does so somewhere, or when the user names that font explicitly. When the design's font genuinely has no counterpart, say so in the Generation Summary instead of picking the nearest-looking one silently.

  <!-- Rationale: a real run mapped Playfair Display Italic → the project's second
  serif on six headings. The codebase's own accent pattern was `text-accent-primary
  italic` with no font override — inheriting the heading font — and the user had to
  point at an existing section to show what right looked like. The colour rules
  already force a per-segment check; fonts had none. -->

- Figma sources (`figma-mcp`/`figma-rest`): Figma-emitted code is a **value source, not a code source**. Never copy absolute pixel offsets (`left-[92.33px]`) — reconstruct element groups with flex/grid + gap (visual result identical, code responsive). Replace data-URI SVG gradients with equivalent CSS gradients. Repeated visual patterns (buttons, cards, badges) become one shared component even when the file has no Figma components.
- `$INTERACTION_SPEC` rows with `source: spec-text` or `observed` are ground truth — implement with exact values: arbitrary easing (`ease-[cubic-bezier(0.25,0.46,0.45,0.94)]`), exact scale/translate/duration values. Implementation patterns (sibling-dimming, scroll entrances, `prefers-reduced-motion` wrapper): `convert-generate-template.md § Motion`.
- Gold standard: `../examples/PricingPage-1to1.tsx`.

## Verification Thresholds (applied in PHASE 3)

- `$VERIFY_PIXEL_RATIO = 0.01` (strict — copy mode promises pixel accuracy).
- Early stop requires Vision match quality **High**. **Medium** is acceptable only at round 3, with remaining discrepancies listed.
- If `$EXTRACTED_STYLES` exists: run the same `eval` extraction snippet against the localhost page and compare against the fidelity table — flag any element whose computed values diverge.
- If `$INTERACTION_SPEC` is set: the 3.2d interaction check runs **exact** — computed transform (matrix-equivalent), duration, and easing must match the spec values.
