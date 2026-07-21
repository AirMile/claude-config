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
- **`$SCOPE = audit`, value-level**: light pass — 3.0, 3.1, then a single round of 3.2 steps 1–4 (render + console) plus **3.2c** re-checking the patched properties. Skip the runner pixel/aria baseline and the vision-comparison rounds: the "source" is a set of per-property edits, not one screenshot — 3.2c against `$SECTION_GROUND_TRUTH` is the real check here.
- **`$SCOPE = audit` after a structural-mismatch escalation** (convert-audit.md Step C/D): the light pass plus a **section-presence check** — full-page screenshot, confirm each `$PATCH_SECTIONS` work item landed (added sections render, reordered sections in the intended order, retired sections gone). Findings are fixed and re-checked within the same 3-round cap.

### 3.0 Pre-flight

Check Playwright CLI available: `playwright-cli --version`. If unavailable: skip with message `"No browser available — open the page manually to verify."`, proceed to PHASE 4.

### 3.1 Dev Server

Detect or start dev server:

1. Check if dev server already running on expected port: `playwright-cli open http://localhost:[port]`
2. If not running: start in background (`npm run dev` / `npx next dev` based on framework)
3. Wait for server ready

### 3.2 Verification Round

```
VERIFICATION ROUND [N]/3
────────────────────────
```

**Sequence:**

1. `playwright-cli goto http://localhost:[port]/[page-path]`
2. Wait for hydration — `playwright-cli run-code "async page => { await page.waitForTimeout(3000); }"`
3. `playwright-cli screenshot --filename=.project/tmp/verify-round-[N].png` + `Read` → capture generated page
4. `playwright-cli console error` → check for runtime JS errors (see `skills/shared/PLAYWRIGHT.md` → Console Error Inspection)
   → Filter output against PLAYWRIGHT.md → Default Ignore Patterns before reporting; only unfiltered lines become findings.

**Runner verification (round 1 only — create or compare baseline):**

Check runner available: `npx playwright --version 2>/dev/null`.

If available → generate on-the-fly spec (see `skills/shared/PLAYWRIGHT.md → Runner Mode`):

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
    maxDiffPixelRatio: { $VERIFY_PIXEL_RATIO },
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
    maxDiffPixelRatio: { $VERIFY_PIXEL_RATIO },
  });
  await ctx.close();
});
```

If `$ANALYSIS` Responsive shows multiple viewports: add a mobile variant (codegen emitted responsive prefixes — guard them):

```typescript
test("visual baseline mobile — {slug}", async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await ctx.newPage();
  await page.goto("{url}");
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveScreenshot("convert-{slug}-mobile.png", {
    maxDiffPixelRatio: { $VERIFY_PIXEL_RATIO },
  });
  await ctx.close();
});
```

Vision-compare the mobile screenshot against the source's mobile frame only when the source actually has one; otherwise the mobile run is a regression + overflow guard only (no design to match it against).

First run: `npx playwright test ... --update-snapshots` (create baseline in `.project/playwright-runs/__screenshots__/`).
Subsequent rounds (2, 3): baseline already present → run without `--update-snapshots` → FAIL on pixel regression or aria structure change.

Note: the pixel/aria baseline is generated from the code's own output, so on the audit path (and copy mode with ground truth) it is a **structural-regression guard only** — it cannot catch a wrong design value that was already present when the baseline was created. That is what 3.2c is for.

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

Action: [✓ Acceptable — stop | → Fix and re-check]
═════════════════════════
```

Runtime errors are always fixable in this phase — resolve before visual discrepancies (a crashing component can cause visual issues that don't exist elsewhere).

**Decision logic:**

- **No significant discrepancies** → stop loop, proceed to PHASE 4
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

1. On the rendered localhost page, per section (audit: `$AUDIT_SECTIONS[].domSelector`; copy: the element-type selectors from the fidelity table) extract computed styles with the `getComputedStyle` snippet from `convert-mode-copy.md § 1.0`, scoped to the section node.
2. Compare against ground truth: `background-color`, `color`, `border-radius`, key spacing (`padding`/`gap`), `font-size`/`font-weight`.
   - **Color:** normalize to rgb; exact match required, ≤2/255 per-channel rounding tolerance.
   - **Spacing / radius:** exact px, ≤1px tolerance.
3. Any divergence is an **exact-value MISMATCH** — add to the ROUND assessment (treat as higher-priority than vision findings, since it is a confirmed ground-truth divergence, not a judgment call) and fix in 3.3, within the existing 3-round cap:

```
Exact-value check:  [PASS | [N] mismatches]
  [- CardSection background-color: #141414 → #00111e (Figma)  file:line]
```

This makes the loop non-self-referential for these properties: the compare target is the design's exact value, not the code's own baseline (contrast with the Playwright pixel baseline in 3.2, which compares against the code's own prior screenshot).

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
Source:         [source image description]
Generated:      [page URL]

[If remaining discrepancies:]
Remaining:
  - [discrepancy — recommended manual fix]

════════════════════════════════════════════════════════════
```

Close browser: `playwright-cli close` (or `tabs_close_mcp` if Claude-in-Chrome was used, e.g. a `figma-make` session)
