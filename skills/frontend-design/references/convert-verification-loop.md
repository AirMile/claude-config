# PHASE 3: Visual Verification Loop

Self-verify by comparing the source image against a Playwright CLI screenshot of the generated output. Max 3 rounds. See `skills/shared/VERIFICATION.md` for the generic loop pattern, round management, and code quality checks.

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
5. `playwright-cli console error` → check for runtime JS errors (see `skills/shared/PLAYWRIGHT.md` → Console Error Inspection)
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
- Reference: compare with `../examples/PricingPage-inspiration.tsx` — no arbitrary values at all

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
