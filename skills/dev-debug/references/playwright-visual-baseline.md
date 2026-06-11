# Playwright Visual Baseline Reproduction

Loaded from PHASE 7 when the user chooses "Playwright visual baseline — UI visual / CSS" in Step 1.

## Runner availability check

Check runner availability: `npx playwright --version 2>/dev/null`.

- **Available**: go to Step 2b below.
- **Not available**: run `/core-setup playwright` to install daemon + runner. Then Step 2b.
- **Installation failed**: fall back to skip, note `reproductionTest: { skipped: true, reason: "runner not available" }`, go to PHASE 8.

## Step 2b: Playwright UI reproduction

Location: `test/regression/{slug}.spec.ts`
Framework: `@playwright/test` — on-the-fly spec (see `shared/PLAYWRIGHT.md → Runner Mode`).

```typescript
// test/regression/{slug}.spec.ts
import { test, expect } from "@playwright/test";

test("{issue slug} — visual regression", async ({ page }) => {
  await page.goto("{url-where-bug-occurs}");
  await page.waitForLoadState("networkidle");
  // First run: captures buggy state as baseline
  // After fix: --update-snapshots to set new correct state as baseline
  await expect(page).toHaveScreenshot("{slug}-regression.png", {
    maxDiffPixelRatio: 0.02,
  });
  // Optional: aria-snapshot for structural UI regressions
  await expect(
    page.locator("{selector-of-broken-component}"),
  ).toMatchAriaSnapshot();
});
```

Run with `--update-snapshots` to capture the buggy state as baseline:
`npx playwright test test/regression/{slug}.spec.ts --config=.project/playwright-runs/playwright.config.ts --update-snapshots`

After fix (PHASE 8): run without `--update-snapshots` → PASS if fix does not degrade the render compared to the correct image. Update baseline explicitly after desired visual improvement.

Note: `reproductionTest: { file: "test/regression/{slug}.spec.ts", type: "visual-baseline", tool: "playwright-runner" }`

Store the PHASE 7 step-3 run command as: `npx playwright test test/regression/{slug}.spec.ts --config=.project/playwright-runs/playwright.config.ts`

After this step: skip Step 2 (Write failing test) — the visual baseline IS the reproduction test. Continue at PHASE 7 Step 4 (Confirm), then PHASE 8.
