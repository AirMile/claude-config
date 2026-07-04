# Visual Scan — Responsive + Darkmode + Motion

Loaded when scope contains **Responsive**, **Darkmode**, and/or **Motion**. Run only the subsections in scope.

## Responsive Scan

Capture on 6 viewports (320, 375, 768, 1024, 1440, 1920) using Playwright CLI (see `PLAYWRIGHT.md` → Use Cases: Responsive Validation):

```
playwright-cli open [url]
Per viewport: playwright-cli resize [vp] 900
             → playwright-cli run-code "async page => { await page.waitForTimeout(1000); }"
             → playwright-cli screenshot --filename=.project/screenshots/vp[vp].png
             → playwright-cli snapshot --filename=.project/snapshots/vp[vp].yml  (only on findings)
             → playwright-cli eval "[overflow-script]"
playwright-cli close
```

Analyze: horizontal overflow, touch targets < 44px, truncated text, layout breaks, font size < 16px on mobile, missing viewport meta.

## Darkmode Scan

Capture light + dark on the primary route via `colorScheme`:

```
playwright-cli run-code "async page => {
  const browser = page.context().browser();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
  const p = await ctx.newPage();
  await p.goto('{url}');
  await p.waitForLoadState('networkidle');
  await p.screenshot({ path: '.project/screenshots/darkmode-light.png' });
  await ctx.close();
}"

playwright-cli run-code "async page => {
  const browser = page.context().browser();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark' });
  const p = await ctx.newPage();
  await p.goto('{url}');
  await p.waitForLoadState('networkidle');
  await p.screenshot({ path: '.project/screenshots/darkmode-dark.png' });
  await ctx.close();
}"
```

Compare the two screenshots + eval for CSS custom properties:

```js
// playwright-cli eval
() => ({
  hasDarkClass: document.documentElement.classList.contains("dark"),
  colorScheme: getComputedStyle(document.documentElement).colorScheme,
  bgColor: getComputedStyle(document.body).backgroundColor,
});
```

Findings:

- **D001 (CRITICAL)**: dark mode toggle present but screenshots are identical — no dark variant implemented
- **D101 (HIGH)**: hardcoded color values that don't switch (re-use H004 pattern — scan source)
- **D102 (HIGH)**: contrast in dark mode below WCAG 4.5:1 threshold

## Motion Runtime Scan (M006/M007)

Emulate `prefers-reduced-motion: reduce` via Playwright and verify that all animated elements either stop or switch to an instant/opacity-only transition:

```js
playwright-cli run-code "async page => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('{url}');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '.project/screenshots/reduced-motion.png' });
}"
playwright-cli snapshot
```

- **M006 (HIGH)**: animated element still transforms/translates under reduced-motion — `motion-safe:` class missing
- **M007 (HIGH)**: spinner or keyframe animation still runs under reduced-motion
