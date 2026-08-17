# Runner Baseline (pixel + aria regression)

Loaded from `convert-verification-loop.md § 3.2` when a baseline already exists
on disk, or the page was converted before. On a first conversion the baseline
has nothing to compare against — that case is handled inline there and never
reaches this file.

Check the runner is available (`npx playwright --version 2>/dev/null`) and
generate the on-the-fly spec (see `skills/shared/PLAYWRIGHT.md → Runner Mode`):

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

If `$ANALYSIS` Responsive shows multiple viewports: add mobile and tablet
variants to the baseline too (the responsive check itself is §3.2e and runs
regardless — this only adds a regression guard on top of it, matching the
tiers §3.2e checks):

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

test("visual baseline tablet — {slug}", async ({ browser }) => {
  const ctx = await browser.newContext({
    viewport: { width: 768, height: 1024 },
  });
  const page = await ctx.newPage();
  await page.goto("{url}");
  await page.waitForLoadState("networkidle");
  await expect(page).toHaveScreenshot("convert-{slug}-tablet.png", {
    maxDiffPixelRatio: { $VERIFY_PIXEL_RATIO },
  });
  await ctx.close();
});
```

First run: `npx playwright test ... --update-snapshots` (create baseline in
`.project/playwright-runs/__screenshots__/`).
Subsequent rounds (2, 3): baseline already present → run without
`--update-snapshots` → FAIL on pixel regression or aria structure change.

Note: the pixel/aria baseline is generated from the code's own output, so on the
audit path (and copy mode with ground truth) it is a **structural-regression
guard only** — it cannot catch a wrong design value that was already present
when the baseline was created. That is what 3.2c is for.

Runner FAIL = discrepancy found → treat as fix target alongside Vision findings.
Runner not available → skip runner, continue with Vision-only sanity check.
