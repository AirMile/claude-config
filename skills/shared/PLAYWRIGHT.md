# Playwright Browser Automation

Reusable Playwright CLI patterns for visual validation, accessibility checks, and browser-based testing across frontend skills. For round-based screenshot comparison loops, see `VERIFICATION.md`.

**CLI:** `playwright-cli` (global via `@playwright/cli`). Check: `playwright-cli --version`.

---

## Overview

| MCP (old)                          | CLI command                                                                                 | Output                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------ |
| `browser_navigate`                 | `playwright-cli goto [url]`                                                                 | Auto-snapshot link                   |
| `browser_wait_for { time }`        | `playwright-cli run-code "async page => { await page.waitForTimeout(N); }"`                 | —                                    |
| `browser_wait_for { text }`        | `playwright-cli run-code "async page => { await page.waitForSelector(':text(\"...\")'); }"` | —                                    |
| `browser_snapshot`                 | `playwright-cli snapshot --filename=[path]`                                                 | YAML on disk, link only in stdout    |
| `browser_snapshot` (inline)        | `playwright-cli snapshot`                                                                   | Full tree inline in stdout           |
| `browser_take_screenshot`          | `playwright-cli screenshot --filename=[path]`                                               | PNG on disk, link in stdout          |
| `browser_take_screenshot fullPage` | `playwright-cli screenshot --full-page --filename=[path]`                                   | PNG (full height) on disk            |
| `browser_close`                    | `playwright-cli close`                                                                      | —                                    |
| `browser_resize`                   | `playwright-cli resize [width] [height]`                                                    | Auto-snapshot link                   |
| `browser_evaluate`                 | `playwright-cli eval "[js expression]"`                                                     | JSON result inline                   |
| `browser_run_code`                 | `playwright-cli run-code "async page => { ... }"`                                           | Return value inline                  |
| —                                  | `playwright-cli state-save [path]` / `state-load [path]`                                    | Storage state (cookies + LS) on disk |
| —                                  | `playwright-cli console [error\|warning\|info]`                                             | Console messages inline              |
| —                                  | `playwright-cli requests` / `request <i>` / `response-headers <i>`                          | Network requests sinds page load     |

> **Snapshot strategy**: `--filename` → tree on disk, link only returned (token-efficient, for batch). Without flag → tree inline (for direct analysis of 1-2 routes).

> **Important**: `file://` protocol is blocked. HTTP always required — start dev server for local files.

---

## Standard Execution Pattern

### Basic Analysis Sequence

For static page validation:

```
PLAYWRIGHT SEQUENCE
───────────────────
1. playwright-cli open [url]
2. playwright-cli snapshot --filename=snapshot.yml
3. Read snapshot.yml                  ← only if tree analysis needed
4. playwright-cli screenshot --filename=page.png
5. Read page.png                      ← only if visual check needed
6. playwright-cli close
```

### Dynamic Content Sequence

For client-rendered content (SPA, React, Vue):

```
PLAYWRIGHT SEQUENCE (Dynamic)
─────────────────────────────
1. playwright-cli open [url]
2. playwright-cli run-code "async page => { await page.waitForSelector(':text(\"[expected]\")'); }"
3. playwright-cli snapshot --filename=snapshot.yml
4. Read snapshot.yml
5. playwright-cli close
```

### Timed Wait Sequence

For animations or transitions:

```
PLAYWRIGHT SEQUENCE (Timed)
───────────────────────────
1. playwright-cli open [url]
2. playwright-cli run-code "async page => { await page.waitForTimeout(2000); }"
3. playwright-cli screenshot --filename=page.png
4. playwright-cli close
```

---

## Pre-flight Validation

For every Playwright operation, verify availability:

```
PRE-FLIGHT: Playwright CLI
──────────────────────────
[ ] playwright-cli available: playwright-cli --version
    → version: [x.x.x | ERROR]
[ ] Dev server running at expected URL
    (file:// is blocked — HTTP required)
```

### Availability Check

```
Playwright CLI: [✓ Available | ✗ Unavailable]
  Version: [x.x.x | not found]
  Status: [Ready | Unavailable]
```

### On Unavailable

```yaml
header: "Playwright Unavailable"
question: "Playwright CLI not available. How to proceed?"
options:
  - label: "Continue without visuals (Recommended)"
    description: "Skip browser checks, continue workflow"
  - label: "Installeer via /core-setup"
    description: "Run /core-setup playwright — installeert daemon + runner + config"
  - label: "Cancel"
    description: "Stop workflow"
```

---

## Error Recovery

### Navigation Failures

| Error              | Cause                | Recovery                                     |
| ------------------ | -------------------- | -------------------------------------------- |
| URL not found      | Invalid path         | Check URL, start dev server if needed        |
| Timeout            | Page not loading     | Increase waitForTimeout, retry once          |
| file:// blocked    | Protocol not allowed | Use `python3 -m http.server` for local files |
| Connection refused | Server not running   | Start dev server, retry                      |

### Graceful Degradation

```
PLAYWRIGHT DEGRADATION
──────────────────────
Level 1: Full analysis (screenshot + snapshot) ← Default
Level 2: Snapshot only (skip screenshot)
Level 3: Skip browser validation entirely
Level 4: Manual browser open instruction
```

**Degradation Flow:**

```
Full Analysis
    ↓ (screenshot fails)
Snapshot Only
    ↓ (snapshot fails)
Skip Browser Validation (warn user)
    ↓ (CLI unavailable)
Manual Instructions:
  "Open [url] in browser to verify manually"
```

---

## Use Cases by Skill

### Wireframe / Design: Visual Validation

```
Purpose: Analyze rendered design for reflection
Sequence: open → screenshot → Read → close
Agent analyzes: Layout, sections, spacing, color
```

### SEO: Rendered Content Validation (S003)

```
Purpose: Verify client-rendered content visible to crawlers
Sequence: open → run-code (wait for content) → snapshot → Read → close
Agent checks: Title, H1, meta tags in accessibility tree
Critical: Detects SPA content invisible to search engines
```

### A11y: Browser-Based Accessibility

```
Purpose: Check accessibility rules requiring DOM inspection
Sequence: open → snapshot → Read → close
Agent checks: H1 count (H002), interactive elements (H006)
```

---

## Integration Examples

### Example: Development Server (SPA)

```
DEV SERVER ANALYSIS
───────────────────
URL: http://localhost:3000/dashboard

1. playwright-cli open http://localhost:3000/dashboard
2. playwright-cli run-code "async page => { await page.waitForSelector(':text(\"Dashboard\")'); }"
3. playwright-cli snapshot --filename=.project/snapshots/dashboard.yml
4. Read .project/snapshots/dashboard.yml
5. playwright-cli close
```

### Example: Accessibility Snapshot Analysis

```
ACCESSIBILITY ANALYSIS
──────────────────────
1. playwright-cli open [url]
2. playwright-cli snapshot    ← inline tree voor directe analyse

Parse snapshot voor:
- heading: H1 count (H002 rule)
- button: Interactive element count
- link: Navigation elements
- textbox: Form fields

Example output:
  - heading "Dashboard Overview" [level=1] [ref=e3]
  - navigation "Main Nav" [ref=e4]
    - link "Home" [ref=e5]
    - link "Settings" [ref=e6]
  - button "Create New" [ref=e7]
  - textbox "Search" [ref=e8]
```

---

## Best Practices

### URL Handling

- **Dev servers**: Always HTTP — `file://` is blocked
- **Local files**: `python3 -m http.server [port]` → `http://localhost:[port]/file.html`
- **Storybook**: Use iframe URL for cleaner analysis

### Snapshot Strategy

| Scenario                          | Approach                                                |
| --------------------------------- | ------------------------------------------------------- |
| Direct tree analysis (1-2 routes) | `playwright-cli snapshot` (inline)                      |
| Batch (6+ viewports/routes)       | `playwright-cli snapshot --filename=X.yml` + Read later |
| Tree not needed (screenshot only) | No snapshot call                                        |

### Wait Strategy

| Content Type    | Wait Approach                                                                |
| --------------- | ---------------------------------------------------------------------------- |
| Static HTML     | No wait needed                                                               |
| SSR/SSG         | `run-code "async page => { await page.waitForTimeout(500); }"`               |
| Client-rendered | `run-code "async page => { await page.waitForSelector(':text(\"...\")'); }"` |
| Animations      | `run-code "async page => { await page.waitForTimeout(2000); }"`              |
| networkidle     | `run-code "async page => { await page.waitForLoadState('networkidle'); }"`   |

### Resource Cleanup

- **Always** `playwright-cli close` after session — even on errors
- **On hanging processes**: `playwright-cli kill-all`
- **No orphaned Chrome** — CLI daemon closes cleanly, no `pkill` needed

### Named Sessions (multi-session / auth)

```bash
playwright-cli -s=mysession open [url] --persistent
playwright-cli -s=mysession fill e5 "user@example.com"
playwright-cli -s=mysession screenshot --filename=result.png
playwright-cli -s=mysession close
```

---

## Cross-Skill References

| Skill                   | Uses Playwright For                                 | Snapshot strategy   |
| ----------------------- | --------------------------------------------------- | ------------------- |
| `frontend-check`        | A11y tree analysis, focus validation (--scope=a11y) | Inline (1-2 routes) |
| `frontend-convert`      | Screenshot capture + verification loop              | Screenshot only     |
| `frontend-check`        | Multi-viewport, CWV, SEO render check, smoke, flow  | --filename (batch)  |
| `marketing-screenshots` | HiDPI screenshots, dark mode variants               | run-code newContext |

---

## Use Cases: Responsive Validation

### Multi-Viewport Capture Sequence

Per route, capture at 6 viewports:

```
RESPONSIVE CAPTURE SEQUENCE
────────────────────────────
Viewports: 320, 375, 768, 1024, 1440, 1920

playwright-cli open [url]

Per viewport:
1. playwright-cli resize [vp] 900
2. playwright-cli run-code "async page => { await page.waitForTimeout(1000); }"
3. playwright-cli screenshot --filename=.project/screenshots/vp[vp].png
4. playwright-cli snapshot --filename=.project/snapshots/vp[vp].yml  ← alleen als tree nodig
5. playwright-cli eval "() => ({ hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, overflowElements: Array.from(document.querySelectorAll('*')).filter(el => { const rect = el.getBoundingClientRect(); return rect.right > document.documentElement.clientWidth; }).map(el => ({ tag: el.tagName, class: el.className, width: el.getBoundingClientRect().width })).slice(0, 10) })"

After all viewports:
playwright-cli close
```

### Overflow Detection Script

```javascript
// playwright-cli eval "..."
() => ({
  hasOverflow:
    document.documentElement.scrollWidth > document.documentElement.clientWidth,
  scrollWidth: document.documentElement.scrollWidth,
  clientWidth: document.documentElement.clientWidth,
  overflowElements: Array.from(document.querySelectorAll("*"))
    .filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.right > document.documentElement.clientWidth;
    })
    .map((el) => ({
      tag: el.tagName,
      class: el.className,
      width: el.getBoundingClientRect().width,
    }))
    .slice(0, 10),
});
```

### Viewport Configuration

| Viewport | Width | Device Category | Breakpoint |
| -------- | ----- | --------------- | ---------- |
| XS       | 320   | Small phone     | < 375      |
| SM       | 375   | Phone           | < 768      |
| MD       | 768   | Tablet          | < 1024     |
| LG       | 1024  | Small desktop   | < 1440     |
| XL       | 1440  | Desktop         | < 1920     |
| 2XL      | 1920  | Large desktop   | ≥ 1920     |

---

## Use Cases: Performance Measurement

### Core Web Vitals via PerformanceObserver

```javascript
// playwright-cli eval "..."
() =>
  new Promise((resolve) => {
    const metrics = {};

    // LCP
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      metrics.lcp = entries[entries.length - 1]?.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });

    // CLS
    let clsValue = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) clsValue += entry.value;
      }
      metrics.cls = clsValue;
    }).observe({ type: "layout-shift", buffered: true });

    // FCP
    new PerformanceObserver((list) => {
      metrics.fcp = list.getEntries()[0]?.startTime;
    }).observe({ type: "paint", buffered: true });

    // Collect after 3 seconds
    setTimeout(() => {
      metrics.ttfb =
        performance.getEntriesByType("navigation")[0]?.responseStart;
      resolve(metrics);
    }, 3000);
  });
```

### Performance Thresholds

| Metric | Good    | Needs Improvement | Poor    |
| ------ | ------- | ----------------- | ------- |
| LCP    | ≤ 2.5s  | ≤ 4.0s            | > 4.0s  |
| CLS    | ≤ 0.1   | ≤ 0.25            | > 0.25  |
| INP    | ≤ 200ms | ≤ 500ms           | > 500ms |
| FCP    | ≤ 1.8s  | ≤ 3.0s            | > 3.0s  |
| TTFB   | ≤ 800ms | ≤ 1.8s            | > 1.8s  |

---

## Use Cases: HiDPI Screenshots

### 2× Retina via run-code

```javascript
// playwright-cli run-code "async page => { ... }"
async (page) => {
  const browser = page.context().browser();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  const p = await ctx.newPage();
  await p.goto("{url}");
  await p.waitForLoadState("networkidle");
  await p.screenshot({
    path: ".project/screenshots/{filename}",
    fullPage: false,
  });
  await ctx.close();
  return "Captured: {filename}";
};
```

### Dark Mode Variant

```javascript
async (page) => {
  const browser = page.context().browser();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: "dark",
  });
  // ... zelfde navigatie + screenshot met '-dark' suffix
};
```

---

## Use Cases: Auth State Persistence

For flows that do multiple screenshots/checks on pages behind a login. Log in once, save state, reload for each subsequent context. Avoids repeated login flow per call.

### Sequence

```
AUTH STATE FLOW
───────────────
1. Eerste sessie — login + state-save:
   playwright-cli open [login-url]
   playwright-cli snapshot                              ← refs ophalen
   playwright-cli fill [email-ref] "[email]"
   playwright-cli fill [password-ref] "[password]"
   playwright-cli click [submit-ref]
   playwright-cli run-code "async p => { await p.waitForLoadState('networkidle'); }"
   playwright-cli state-save .project/auth-state.json   ← cookies + localStorage op disk

2. Volgende sessies — state-load:
   playwright-cli state-load .project/auth-state.json
   playwright-cli goto [authed-url]
   ...

3. Of via run-code newContext (HiDPI/dark variants):
   newContext({ storageState: '.project/auth-state.json', deviceScaleFactor: 2, ... })

4. Cleanup aan einde flow:
   rm .project/auth-state.json    ← geen credentials op disk laten
```

### Constraints

- **State file lifecycle**: always clean up at end of skill run (state contains session tokens).
- **Locatie**: `.project/auth-state.json` (gitignored). Niet committen.
- **Validity**: state expires when cookies expire — on failure: re-login + state-save.

---

## Use Cases: Console Error Inspection

Voor het detecteren van client-side JS errors die niet zichtbaar zijn in screenshot of snapshot. Een pagina kan visueel correct zijn maar runtime crashen — `console error` vangt dat.

### Sequence

```
CONSOLE INSPECTION
──────────────────
1. playwright-cli goto [url]
2. playwright-cli run-code "async p => { await p.waitForLoadState('networkidle'); }"
3. playwright-cli console error                ← alleen errors (geen warnings/info)
4. Parse output → indien errors: noteer als finding
```

### Filter Strategie

| Min-level | Use case                                                    |
| --------- | ----------------------------------------------------------- |
| `error`   | Default voor audit/verification — alleen blokkerende issues |
| `warning` | A11y libs (React/axe) — pakt missing-aria-label warnings op |
| `info`    | Debugging — zelden nuttig in skills, veel ruis              |

### Noise Mitigation

Veel apps loggen non-critical warnings in dev-mode (HMR, deprecation notices). Voor stabiele detectie:

- Filter op `error` level standaard
- Filter console-output tegen onderstaande patronen; alles wat overblijft is een echte finding
- Bij twijfel: noteer count + voorbeeld, laat user beslissen

**Default Ignore Patterns (regex, case-insensitive)**

```
^\[HMR\]                           # Webpack/Vite HMR reconnect
^\[Fast Refresh\]                  # Next.js Fast Refresh
Download the React DevTools        # React DevTools nag
Download the Apollo DevTools       # Apollo DevTools nag
DevTools failed to load source map # Source map dev-warning
\[vite\] connect(ed|ing)          # Vite HMR socket
React Router (Future|v7)           # React Router future-flag warnings
```

---

## Use Cases: Network Inspection

Voor het auditen van failed requests, payload-grootte, missing cache headers, en het valideren of content-API's daadwerkelijk content terugstuurden (vs fallback).

### Sequence

```
NETWORK INSPECTION
──────────────────
1. playwright-cli goto [url]
2. playwright-cli run-code "async p => { await p.waitForLoadState('networkidle'); }"
3. playwright-cli requests                     ← lijst alle requests, genummerd
4. Per relevant index:
   playwright-cli response-headers [idx]       ← cache, content-type, status
   playwright-cli response-body [idx]          ← inhoud (text inline, binary → file)
```

### Audit Patterns

| Pattern                | Detectie                                                                  |
| ---------------------- | ------------------------------------------------------------------------- |
| Failed requests        | `requests` → filter status 4xx/5xx                                        |
| Large payloads         | `requests` → filter size > 500KB                                          |
| Missing cache headers  | `response-headers <i>` → check `cache-control`, `etag` op static assets   |
| Render-blocking        | `requests` order + timing — long-running CSS/JS vóór LCP                  |
| Content endpoint check | `request <i>` op kritieke API → 200 + body bevat verwachte content (S003) |

### Token Efficiency

`requests` (without index) returns a compressed list. Only with `request <i>` / `response-body <i>` do you get full content — only do this for relevant indexes.

---

## Daemon vs Runner — Beslisboom

```
Wat heb je nodig?
│
├── Snel iets inspecteren, screenshot/snapshot maken, console/network kijken,
│   multi-viewport scans uitvoeren, ad-hoc validatie?
│   → DAEMON (playwright-cli)   — geen test-files, directe output
│
└── Een van deze vijf features?
    │
    ├── Pixel-baseline visual regression  →  toHaveScreenshot()
    ├── A11y-tree assertion met fail bij regressie  →  toMatchAriaSnapshot()
    ├── Debug-timeline na failure  →  --trace on + show-trace
    ├── First-class browser assertions  →  expect(page).toHaveURL() / toHaveText() etc.
    └── Persistente acceptance/regression specs  →  .spec.ts bestand
    → RUNNER (@playwright/test)   — zie sectie hieronder
```

---

## Runner Mode (@playwright/test)

Gebruik de runner **alleen** voor de vijf features hierboven. Daemon blijft default.

### Pre-flight

```bash
# Check runner beschikbaar
npx playwright --version 2>/dev/null || echo "niet beschikbaar"

# Als niet beschikbaar: installeer lokaal (dev dependency)
npm install --save-dev @playwright/test
npx playwright install chromium --with-deps
```

### On-the-fly Spec Pattern

Skills genereren een tijdelijke spec — geen permanente `tests/`-conventie in het project.

**1. Genereer config (eenmalig per skill-run)**

```typescript
// .project/playwright-runs/playwright.config.ts  (tijdelijk, gitignored)
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".", // spec staat naast config
  snapshotDir: "./__screenshots__", // baselines in .project/playwright-runs/__screenshots__/
  use: {
    baseURL: "http://localhost:3000", // aanpassen aan actieve dev server
    trace: "retain-on-failure", // always trace on failure
  },
  reporter: [["json", { outputFile: "./results.json" }]],
});
```

**2. Genereer spec**

```typescript
// .project/playwright-runs/{skill}-{slug}.spec.ts  (tijdelijk, gitignored)
import { test, expect } from "@playwright/test";

test("{beschrijving}", async ({ page }) => {
  await page.goto("{pad}");
  await page.waitForLoadState("networkidle");

  // Visual regression (eerste run maakt baseline aan):
  await expect(page).toHaveScreenshot("{naam}.png", {
    mask: [page.locator("{dynamisch-element}")], // mask time/date/ads
    maxDiffPixelRatio: 0.02, // 2% tolerantie voor anti-aliasing
  });

  // A11y-tree assertion:
  await expect(page.locator("main")).toMatchAriaSnapshot(`
    - heading "{verwachte titel}" [level=1]
    - navigation
    - main
  `);
});
```

**3. Draai de runner**

```bash
# Eerste run — maak baselines aan:
npx playwright test .project/playwright-runs/{spec}.spec.ts \
  --config=.project/playwright-runs/playwright.config.ts \
  --update-snapshots

# Volgende runs — vergelijk met baselines:
npx playwright test .project/playwright-runs/{spec}.spec.ts \
  --config=.project/playwright-runs/playwright.config.ts

# Bij failure — open trace:
npx playwright show-trace .project/playwright-runs/test-results/*/trace.zip
```

**4. Parseer resultaat**

```bash
# results.json bevat: passed/failed/timedOut counts + per-test details
cat .project/playwright-runs/results.json | python3 -c "
import json, sys
r = json.load(sys.stdin)
suites = r.get('suites', [])
for s in suites:
  for spec in s.get('specs', []):
    status = 'PASS' if all(t['status'] == 'passed' for t in spec['tests']) else 'FAIL'
    print(f'{status}: {spec[\"title\"]}')
"
```

**5. Cleanup**

```bash
# Bij success: verwijder spec + config, bewaar baselines
rm -f .project/playwright-runs/{spec}.spec.ts
rm -f .project/playwright-runs/playwright.config.ts
rm -rf .project/playwright-runs/test-results/   # playwright output dir

# Bij failure: bewaar alles voor debugging
# Baselines always stay at: .project/playwright-runs/__screenshots__/
```

### Baseline Management

| Situatie                         | Actie                                               |
| -------------------------------- | --------------------------------------------------- |
| Eerste run (geen baseline)       | `--update-snapshots` → maakt baseline aan           |
| Bewuste stijlwijziging           | `--update-snapshots` → update baseline              |
| Onverwacht verschil              | Bekijk diff in `test-results/` of via `show-report` |
| Dynamische content (datums, ads) | Mask via `{ mask: [page.locator('...')] }`          |

### Trace Debuggen

```bash
# Trace is automatically saved on failure (retain-on-failure in config)
# Vind trace-bestand:
ls .project/playwright-runs/test-results/*/trace.zip

# Open interactieve viewer:
npx playwright show-trace .project/playwright-runs/test-results/{slug}/trace.zip
```

---

## Use Cases: Emulatie Snippets

Combineer deze opties in `browser.newContext({ ... })` (daemon via `run-code`) of in `playwright.config.ts` `use:` (runner).

### prefers-reduced-motion

```javascript
// Daemon: playwright-cli run-code "async page => { ... }"
async (page) => {
  const ctx = await page.context().browser().newContext({
    reducedMotion: "reduce", // 'no-preference' om expliciet te resetten
  });
  const p = await ctx.newPage();
  await p.goto("{url}");
  await p.screenshot({
    path: ".project/screenshots/{naam}-reduced-motion.png",
  });
  await ctx.close();
};
```

```typescript
// Runner: playwright.config.ts use-blok
use: {
  reducedMotion: "reduce";
}
```

### forcedColors (High Contrast Mode)

```javascript
// Daemon
async (page) => {
  const ctx = await page.context().browser().newContext({
    forcedColors: "active", // simuleert Windows High Contrast Mode
  });
  const p = await ctx.newPage();
  await p.goto("{url}");
  await p.screenshot({ path: ".project/screenshots/{naam}-high-contrast.png" });
  await ctx.close();
};
```

### Geolocation

```javascript
// Daemon
async (page) => {
  const ctx = await page
    .context()
    .browser()
    .newContext({
      geolocation: { latitude: 52.3702, longitude: 4.8952 }, // Amsterdam
      permissions: ["geolocation"],
    });
  const p = await ctx.newPage();
  await p.goto("{url}");
  await ctx.close();
};
```

### HiDPI + colorScheme (referentie)

For HiDPI 2× retina and dark/light mode snippets: see **Use Cases: HiDPI Screenshots** above — those patterns are identical, use `newContext({ deviceScaleFactor: 2, colorScheme: 'dark' })`.

### Combinaties

```javascript
// HiDPI + dark + reduced motion + auth — alles samen
async (page) => {
  const ctx = await page
    .context()
    .browser()
    .newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      colorScheme: "dark",
      reducedMotion: "reduce",
      storageState: ".project/auth-state.json", // alleen als auth gebruikt
    });
  const p = await ctx.newPage();
  await p.goto("{url}");
  await p.waitForLoadState("networkidle");
  await p.screenshot({
    path: ".project/screenshots/{naam}-dark-hidpi-a11y.png",
  });
  await ctx.close();
};
```
