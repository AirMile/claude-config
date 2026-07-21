# Error States Scan

Loaded when scope contains **Error states**.

Test how the app responds to error scenarios:

```
1. 404: `playwright-cli` daemon by default (scriptable — see shared/BROWSER-VEHICLES.md):
        playwright-cli goto {url}/this-route-does-not-exist-404test + playwright-cli snapshot + screenshot
        (Claude-in-Chrome opt-in only if a live Chrome tab already has this exact page open) → check if
        app-404 renders (not browser-default)

2. Offline (no Claude-in-Chrome equivalent — stays on Playwright): playwright-cli run-code "async page => {
     await page.context().setOffline(true);
     await page.reload();
     await page.waitForTimeout(2000);
     await page.screenshot({ path: '.project/screenshots/offline.png' });
     await page.context().setOffline(false);
   }"
   → snapshot → check if offline-UI renders

3. Slow 3G (no Claude-in-Chrome equivalent — stays on Playwright): playwright-cli run-code "async page => {
     await page.context().route('**/*', async route => {
       await new Promise(r => setTimeout(r, 1500));
       await route.continue();
     });
     await page.goto('{url}');
     await page.screenshot({ path: '.project/screenshots/slow-3g.png' });
   }"
   → check if loading skeleton / spinner is visible
```

Findings:

- **E001 (CRITICAL)**: 404 page shows browser-default error (no custom 404)
- **E002 (CRITICAL)**: offline UI missing — blank page or JavaScript crash
- **E101 (HIGH)**: no loading skeleton on slow connection — FOUC or empty screen
- **E102 (HIGH)**: error page without navigation back to home
