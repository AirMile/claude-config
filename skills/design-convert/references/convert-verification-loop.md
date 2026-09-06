# PHASE 3: Visual Verification Loop

Self-verify by comparing the source image against a screenshot of the generated output. Max 3 rounds. See `skills/shared/VERIFICATION.md` for the generic loop pattern, round management, and code quality checks.

`playwright-cli` daemon by default for the smoke/console steps below — a fixed, scriptable
navigate→screenshot→console-check sequence against a local dev server, see
`shared/BROWSER-VEHICLES.md`. Claude-in-Chrome only applies if the page genuinely needs the real
user session (rare for a local-dev-server verify loop). The **runner verification** block
(pixel-baseline / aria-snapshot regression) is unaffected — that stays on Playwright always.

Thresholds come from the loaded `convert-mode-{$MODE}.md → Verification Thresholds`: `$VERIFY_PIXEL_RATIO` (copy 0.01, inspiration/sketch 0.03). Default to `0.03` when no mode file is loaded (patch fast-path).

### Scope selection

- **Generation scopes** (copy/sketch/inspiration) and **patch**: run the full procedure below.
- **Section-scoped build** (`$BUILD_SECTIONS` from `route-convert.md` 0.4c is a strict subset of
  `$ANALYSIS.Sections`): run the full procedure below, scoped to only the sections this run built —
  see the Vision comparison carve-out below.
- **`$SCOPE = audit`, value-level**: light pass — 3.0, 3.1, then a single round of 3.2 steps 1–4 (render + console) plus **3.2c** re-checking the patched properties. Skip the runner pixel/aria baseline and the vision-comparison rounds: the "source" is a set of per-property edits, not one screenshot — 3.2c against `$SECTION_GROUND_TRUTH` is the real check here.
- **`$SCOPE = audit` after a structural-mismatch escalation** (convert-audit.md Step C/D): the light pass plus a **section-presence check** — full-page screenshot, confirm each `$PATCH_SECTIONS` work item landed (added sections render, reordered sections in the intended order, retired sections gone). Findings are fixed and re-checked within the same 3-round cap.

### 3.0 Pre-flight

Resolve a browser vehicle in this order — only the last rung skips verification. A missing `playwright-cli` daemon is not the same thing as a project without a browser, and treating it that way silently drops the whole phase on projects that ship their own Playwright.

1. `playwright-cli --version` succeeds → use it for every step below.
2. The project depends on Playwright (`playwright` or `@playwright/test` in `package.json`) → drive it directly: write a short script under `.project/tmp/` that imports `chromium` and run it with `node`. The script must live inside the project directory, otherwise package resolution fails.
3. The project's own `CLAUDE.md` prescribes a screenshot workflow → follow that one; it outranks both rungs above.
4. None of these → skip with `"No browser available — open the page manually to verify."` and proceed to PHASE 4.

Record the resolved vehicle as `$BROWSER_VEHICLE`. Every later step in this file is written in `playwright-cli` syntax; on rungs 2-3 translate each step to the resolved vehicle rather than skipping it.

### 3.1 Dev Server

Detect or start dev server — **check before starting, and report which one you got**:

1. Probe the expected port first: `curl -s -o /dev/null -w "%{http_code}" http://localhost:[port]`
2. `200` → reuse that server. Never start a second one on a port that already answers.
3. Otherwise start in background (`npm run dev` / `npx next dev` based on framework) and wait for ready.
4. Print one line either way — same reasoning as `route-convert.md § 0.5b`: a step whose successful path is silence leaves the user unable to tell whether a process was spawned in their project.

```
Dev server: [reused existing on :3000 | started (pid N) on :3000]
```

**Never run a production build while the verification dev server is running.** `next build` (and its equivalents) writes to the same output directory the dev server serves from, so the running server starts 404-ing its own chunks. The page still screenshots and still looks correct — but nothing hydrates, so every interaction check silently fails and the round is worthless. Symptom: 404s on `/_next/static/chunks/*` in the console with no visible change on screen.

When a build belongs to this run, place it outside the loop:

- run it before the dev server starts, or
- stop the dev server, build, restart it, and re-render before continuing.

Already hit it: stop the server, delete the build output, restart, and redo the last round. Screenshots taken while the chunks were 404-ing are void — do not carry their findings forward.

### 3.2 Verification Round

```
VERIFICATION ROUND [N]/3
────────────────────────
```

**Sequence:**

0. `playwright-cli open http://localhost:[port]/[page-path]` — required first on a cold daemon; `goto` alone returns `The browser 'default' is not open`. Already open → `goto` is enough.
1. `playwright-cli goto http://localhost:[port]/[page-path]`
2. Wait for hydration — `playwright-cli run-code "async page => { await page.waitForTimeout(3000); }"`
3. `playwright-cli screenshot --filename=.project/tmp/verify-round-[N].png` + `Read` → capture generated page
4. `playwright-cli console error` → check for runtime JS errors (see `skills/shared/PLAYWRIGHT.md` → Console Error Inspection)
   → Filter output against PLAYWRIGHT.md → Default Ignore Patterns before reporting; only unfiltered lines become findings.

**Runner verification (OPTIONAL, round 1) — skip on a first conversion.**

A pixel/aria baseline compares the page against _its own_ previous output, so on a page being converted for the first time it has nothing to compare to: it writes a snapshot and passes by construction. Skipping is the normal outcome — record it as `Runner: skipped (first conversion)` in the round assessment, so a reader can tell it was decided rather than forgotten.

> **Todo**: baseline already on disk, or this page was converted before → Read `.claude/skills/design-convert/references/convert-runner-baseline.md` and follow it. Otherwise skip that file entirely.

**Vision comparison (sanity check — always run, even if runner is available):**

Compare source image vs generated screenshot. Analyze:

- Layout structure (sections in correct order, proportions roughly match)
- Spacing (gaps between sections, padding within sections)
- Color accuracy (1:1 mode: exact match matters; inspiration: theme tokens applied correctly)
- Typography (heading sizes, weight, alignment)
- Component rendering (all sections visible, no blank areas, no error overlays) — **`$BUILD_SECTIONS` is set (0.4c) and is a strict subset**: sections outside it are expected-absent this run; note them as `deferred (not in this run's scope)` rather than flagging as missing/blank
- Missing elements (anything in source not present in output — same carve-out: a section outside `$BUILD_SECTIONS` is deferred, not missing)
- **Runtime errors** (from step 4 — JS errors indicate broken hydration or missing imports, even if nothing looks wrong visually; report as **P004** findings — see FRONTEND-RULES.md)

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

Action: [✓ Acceptable — go to PHASE 3.5 | → Fix and re-check]
═════════════════════════
```

Runtime errors are always fixable in this phase — resolve before visual discrepancies (a crashing component can cause visual issues that don't exist elsewhere).

**This is not the end of the run.** The report above looks like a natural stopping point but isn't one — and a run has ended here before. Go to `route-convert.md` **PHASE 3.5** now and Read `convert-refine-round.md`: the user has not yet seen the result. PHASE 4 runs only after they accept it there, and it is what syncs the backlog, updates devinfo, and creates the recoverable commit.

**Decision logic:**

- **No significant discrepancies** → stop loop, go to PHASE 3.5 (not PHASE 4 — see above)
- **Copy mode:** early stop requires match quality **High** — **Medium** is acceptable only at round 3, with remaining discrepancies listed
- **Fixable discrepancies AND rounds remaining** → apply targeted edits, increment round, repeat from 3.2
- **Round 3 reached** → stop loop regardless, report remaining discrepancies

### 3.2b Code Quality Check (first round only)

After the first visual verification, scan all generated files:

**Always check (both modes):**

- Missing alt text: `<img>` or `<Image>` without `alt` prop (R002)
- Missing labels: `<input>`/`<select>` without `<label>` or `aria-label` (R004)
- Div-soup: `<div onClick>` without `role="button"` — use `<button>` (R001)
- Implicit any: functions/parameters without type annotation (T002)
- Unpaired section overlap: a section element carrying a negative block-start margin (`-mt-*`, `-mt-[Npx]`, `margin-block-start: -…`) with no top radius (`rounded-t-*`, `border-start-*-radius`) on that same element — or the reverse (H009). Grep every section file this run produced, not only the ones the current round edited: the defect never shows up as a broken-looking section, only as a wrong seam with its neighbour.

**Inspiration mode only:**

- Arbitrary color values: `bg-[#hex]`, `text-[#hex]`, `border-[#hex]` etc. — must use theme tokens (H101)
- Arbitrary spacing: `p-[16px]`, `gap-[24px]`, `mt-[32px]` etc. — must use standard Tailwind scale (R103)
- Reference: compare with `../examples/PricingPage-inspiration.tsx` — no arbitrary values at all

On violations: include as fixes in step 3.3 alongside visual discrepancies. Add to the ROUND assessment:

```
Code quality:  [PASS | [N] violations]
  [- arbitrary color: bg-[#2D3748] → bg-surface-dark (H101)]
  [- missing alt: <img> in HeroSection:14 (R002)]
```

### 3.2c Exact per-section value check (audit + copy with ground truth)

Thumbnail vision (3.2) cannot catch a wrong-but-plausible value — a card `background-color: #141414` where the design specifies `#00111e` looks fine in a thumbnail. When per-section ground truth exists, compare computed styles directly instead of relying on vision alone.

**Runs when** `$SECTION_GROUND_TRUTH` is set (audit path, see `convert-audit.md`) OR `$EXTRACTED_STYLES` is set (copy mode with `figma-mcp` / `figma-rest` / `figma-make` / `url` ground truth — see `convert-mode-copy.md § Verification Thresholds`). Skip otherwise (inspiration/sketch, or copy mode that fell back to vision estimation).

**Exclude every section rendered by a file in `$PRESERVE`** (route-convert.md 0.6b). Those components are deliberately off-design — the user chose their existing styling over the frame's — so their computed values will diverge by construction. Reporting that divergence as a mismatch invites a "fix" that overwrites the decision, the same failure the content-fill guard prevents on the audit path (`convert-audit.md` Step B). Name them once in the check's output as `— skipped (preserved)`, so their absence reads as deliberate rather than forgotten. **Also skip entirely** when `$AUDIT_PROPERTY_SCOPE = "content"` (route-convert.md PHASE 0.4 follow-up) — the user explicitly asked to leave style values as-is, so re-verifying them here would flag "mismatches" the run was told not to touch.

1. Run the same extraction script against the rendered page. Copy it into the project first — ESM resolves `playwright` relative to the script file, so running it from `~/.claude/skills/` exits `ERR_MODULE_NOT_FOUND` (see `convert-mode-copy.md § 1.0`). Already copied earlier this run → reuse that copy.

   ```bash
   cp -n ~/.claude/skills/design-convert/scripts/extract-computed-styles.mjs .project/tmp/
   node .project/tmp/extract-computed-styles.mjs \
     "http://localhost:[port]/[page-path]" > .project/tmp/rendered-styles.json
   ```

   Audit path: add `--selector "$AUDIT_SECTIONS[].domSelector"` per section. Do not hand-roll a smaller version — a plain `getComputedStyle(el).color` reads the parent's inherited color and cannot see an accent segment at all, which is precisely the mismatch this check exists to catch.

2. Compare against ground truth: `background-color`, `color`, `border-radius`, key spacing (`padding`/`gap`/`margin-top`), `font-size`/`font-weight`.
   - **Color:** normalize to rgb; exact match required, ≤2/255 per-channel rounding tolerance.
   - **Text color, per segment.** A ground-truth row with multiple `seg` entries compares **segment by segment, in document order**, and the segment _count_ is part of the comparison. A heading that rendered as one segment where the design has two is a MISMATCH — not a pass because the first color happened to match. This is the check that catches a two-tone title shipped monochrome; element-level color compare structurally cannot.
   - **Text weight/style, per segment.** Same walk, same document order — compare `fontWeight`/`fontStyle` segment by segment against the fidelity row. The extraction script already returns both per segment (`extract-computed-styles.mjs § seg()`), so this reuses the same `rendered-styles.json` the color check above reads. A segment whose row calls for `700`/`italic` and rendered without it is a MISMATCH, same priority as a color mismatch — this is the check that catches an accent span that lost its `font-bold` while its color class survived.
   - **Spacing / radius:** exact px, ≤1px tolerance. Compare each section against **its own** fidelity-table row, never against a page-wide value — comparing every section to one number either passes wrong spacing or floods the report with false mismatches.
   - **Seam, per consecutive section pair.** Every check above measures one element's own box, so none of them can see a section that overlaps its neighbour. The script's `seams[]` array already carries the rendered distance between consecutive top-level sections; compare each entry against the `offset` field of the _second_ section's fidelity row (absent field = expected 0).

   - **Line breaks, per heading.** Compare `round(boundingHeight / lineHeight)` on each rendered heading against its `Line breaks` row. A mismatch is a MISMATCH, not a cosmetic note: the usual cause is a `max-width` or `text-balance` the design does not have, and it changes the composition of the section. Report as `2 lines rendered, design has 1`.

     A negative result means that section is pulled over the one above it. Non-zero where the design has no offset is a MISMATCH — this is the one check that looks at two sections at once, and the only one that catches a negative margin cropping the previous section's bottom padding while every padding value in the code is still correct. Fix per H009: the offset and the top radius are one declaration, so remove or add them together.

3. Any divergence is an **exact-value MISMATCH** — add to the ROUND assessment (treat as higher-priority than vision findings, since it is a confirmed ground-truth divergence, not a judgment call) and fix in 3.3, within the existing 3-round cap:

```
Exact-value check:  [PASS | [N] mismatches]
  [- CardSection background-color: #141414 → #00111e (Figma)  file:line]
  [- Hero h1 seg 2 "building": rendered #1A1A2E → #FF5733     file:line]
  [- Hero h1: 1 segment rendered, design has 2                file:line]
  [- Features padding: 96px → 64px (per-section value)        file:line]
  [- Doelgroep→Onderscheid seam: -60px rendered, design has 0  file:line]
  [- Proces h2: 2 lines rendered, design has 1                 file:line]
```

This makes the loop non-self-referential for these properties: the compare target is the design's exact value, not the code's own baseline (contrast with the Playwright pixel baseline in 3.2, which compares against the code's own prior screenshot).

### 3.2e Responsive check (every generation scope — no gate)

**Runs on every round-1 verification**, regardless of how many viewports the source has. A Figma frame almost never ships a mobile or tablet variant, so gating this on "source has multiple viewports" meant it fired on virtually no run — while `convert-generate-template.md § Responsive layout` emits `md:`/`lg:` prefixes on every generation. The tier nobody looked at is where wrapping and overflow defects live, and checking mobile alone leaves the entire `md:` (768px+) breakpoint — real markup, never rendered once during verification.

**Three tiers, always** — matching the breakpoints codegen actually emits (`convert-generate-template.md`: no prefix = mobile, `md:` = tablet 768px+, `lg:` = desktop 1024px+) and `shared/PLAYWRIGHT.md § Viewport Configuration`'s canonical widths:

| Tier    | Viewport | Tailwind prefix it exercises |
| ------- | -------- | ---------------------------- |
| Mobile  | 390×844  | (none — default)             |
| Tablet  | 768×1024 | `md:`                        |
| Desktop | 1440×900 | `lg:`                        |

For **each** tier:

1. Resize, reload, wait for hydration.
2. **Overflow assert**: `document.documentElement.scrollWidth === clientWidth`. Unequal → MISMATCH (name the overflowing element).
2b. **Section-overlap assert**: sections that pull themselves over their predecessor (a negative `margin-top`, usually paired with a rounded top edge) eat exactly that many px out of the previous section's bottom padding — so the space below that section reads narrower than the space above it, at that breakpoint only. Codegen emits the negative margin and forgets the compensation, and the defect is invisible in a single-section screenshot because both sections look fine on their own. Assert it numerically instead:

    ```js
    // per top-level section in <main>
    [...document.querySelectorAll('main > *')].map((el, i, all) => {
      const cs = getComputedStyle(el);
      // the overlap may sit on the section or on its first child (wrapper pattern)
      const inner = el.firstElementChild ? getComputedStyle(el.firstElementChild) : null;
      const overlap = Math.min(parseFloat(cs.marginTop) || 0,
                               inner ? parseFloat(inner.marginTop) || 0 : 0);
      if (overlap >= 0 || !all[i - 1]) return null;
      const prev = getComputedStyle(all[i - 1]);
      return { visible: (parseFloat(prev.paddingBottom) || 0) + overlap,
               prevPaddingBottom: parseFloat(prev.paddingBottom) || 0, overlap: -overlap };
    }).filter(Boolean)
    ```

    `visible` is the space the reader actually sees under the previous section. It must equal the padding that section would have had without the overlap — i.e. `prevPaddingBottom` must contain the overlap on top of its own value. `visible` far below `prevPaddingBottom - overlap`'s intended value → MISMATCH. Two legitimate exceptions, both of which must be stated rather than silently passed: a hero (no bottom padding of its own — the overlap is the effect), and a deliberately flush seam where the previous section's entire bottom padding IS the overlap (`visible ≈ 0` on both sides of the breakpoint).

    Fix by adding the overlap to the previous section's bottom padding, written as a `calc()` that names the overlap — `md:pb-[calc(6rem+var(--section-overlap))]`, never the pre-added number. A section used on several pages that only overlaps on some gets a prop (`overlapNext`) or receives the compensation via `className` from the page; never hardcode it in the shared section.
3. Screenshot **and Read it** — a full-page shot of a long page is unreadably tall at any width, so capture viewport-sized slices while scrolling and read each one. A full-page thumbnail is not a tier check; text legibility, mid-word heading breaks, and `md:`/`lg:` layout switches (column count, hidden/shown elements) only show at slice scale.
4. **Source-frame compare, gated on `$RESPONSIVE_VIEWPORTS`** (route-convert.md § 0.2):
   - `mobile+tablet+desktop` → this tier has a source frame; vision-compare against it.
   - `mobile+desktop` → mobile and desktop compare against their source frames; tablet has none — it is codegen's own `md:` interpolation between the two, so run the overflow/wrap/legibility check only, and say so explicitly rather than implying a match.
   - `1 viewport` or `unknown` → only the tier matching that viewport (if identifiable) compares against a source frame; the other two are overflow/wrap-only checks.
5. Findings join the ROUND ASSESSMENT at 3.2c priority.

Add to the assessment block, one line per tier:

```
Overlap:     [PASS | N findings]  (per tier, with the measured px)
Responsive:  [PASS | N findings] (390px)
  [- hero h1 breaks mid-phrase: "zichtbaar / maken."  file:line]
Responsive:  [PASS | N findings] (768px)
  [- card grid still 1-column past the md: breakpoint  file:line]
Responsive:  [PASS | N findings] (1440px)
  [- kicker label lines collide (design leading only
     valid on one line)                               file:line]
```

A tier with no source frame to compare against still gets its own line — mark it `interpretation` instead of `PASS`/`N findings`, e.g. `Responsive: interpretation (no tablet source frame) (768px)`. Never omit a tier's line — that reads as "not checked," and every tier is checked regardless of source coverage.

### 3.2d Interaction check (when `$INTERACTION_SPEC` is set)

Static screenshots can't tell whether an interaction fires — verify positively, per `$INTERACTION_SPEC` row, on the rendered localhost page. Follow `shared/PLAYWRIGHT.md § Use Cases: Interaction State Capture` (`playwright-cli` daemon by default — scriptable, see `shared/BROWSER-VEHICLES.md`):

1. **Drive the trigger**: `hover` → hover-delta sequence on the row's element; `scroll-into-view` → scroll the section in, then run the animation inventory; `focus`/`press` → focus the element / read `active:` styles.
2. **Compare against the spec's `expected:` line** — a plain string compare, no conversion reasoning here: the eval's computed values (transform matrix, `transition-duration`, `transition-timing-function`) must equal the row's precomputed `expected` strings (filled during capture, `convert-interactions.md` Step 4). Fallback for rows without an `expected` line: transform as matrix equivalent (`scale(1.04)` ↔ `matrix(1.04, 0, 0, 1.04, 0, 0)`), duration/easing from the baseline computed `transition`.
   - **Copy mode**: exact match required (spec ground truth — same status as 3.2c colors).
   - **Inspiration/sketch**: assert the mapped choreography effect fires (an effect of the right kind and direction); exact `expected` match only for explicit-delta rows.
   - Sibling rows: one hover, read both elements.
3. **Hover-state screenshot** per interactive pattern (one representative element) as vision-sanity — overlay/color effects that don't show in computed transforms.
4. `estimated` rows: presence-check only (does _an_ effect fire) — never fail exact values that were never ground truth.

Mismatches join the ROUND assessment at 3.2c priority (confirmed spec divergence, not a judgment call) and are fixed in 3.3 within the 3-round cap:

```
Interaction check:  [PASS | [N] mismatches]
  [- Sector card hover: expected scale(1.04), computed matrix(1.02,…) — SectorGrid.tsx:41]
  [- Section entrance: no animation fired on scroll-into-view — missing IntersectionObserver wiring]
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
Responsive:     mobile  [PASS | N findings | interpretation]
                tablet  [PASS | N findings | interpretation]
                desktop [PASS | N findings | interpretation]
Source:         [source image description]
Generated:      [page URL]

[If remaining discrepancies:]
Remaining:
  - [discrepancy — recommended manual fix]

════════════════════════════════════════════════════════════
```

**The ROUND ASSESSMENT block from §3.2 is the artifact PHASE 4 reads.** `convert-completion.md § 4.4` takes `finalMatchQuality` from the last one printed and forbids recalling a value without it. Printing your own summary instead of the block therefore does not just change the formatting — it removes the only thing §4.4 is allowed to source that field from, and the honest result is `Verification: NOT RUN` on the completion report. Print the block.

Close browser: `playwright-cli close` (or `tabs_close_mcp` if Claude-in-Chrome was used, e.g. a `figma-make` session)
