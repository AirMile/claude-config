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
| —                                  | `playwright-cli requests` / `request <i>` / `response-headers <i>`                          | Network requests since page load     |

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
  - label: "Install via /core-setup"
    description: "Run /core-setup playwright — installs daemon + runner + config"
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
2. playwright-cli snapshot    ← inline tree for direct analysis

Parse snapshot for:
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
4. playwright-cli snapshot --filename=.project/snapshots/vp[vp].yml  ← only if tree needed
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
  // ... same navigation + screenshot with '-dark' suffix
};
```

---

## Use Cases: Auth State Persistence

For flows that do multiple screenshots/checks on pages behind a login. Log in once, save state, reload for each subsequent context. Avoids repeated login flow per call.

### Sequence

```
AUTH STATE FLOW
───────────────
1. First session — login + state-save:
   playwright-cli open [login-url]
   playwright-cli snapshot                              ← get refs
   playwright-cli fill [email-ref] "[email]"
   playwright-cli fill [password-ref] "[password]"
   playwright-cli click [submit-ref]
   playwright-cli run-code "async p => { await p.waitForLoadState('networkidle'); }"
   playwright-cli state-save .project/auth-state.json   ← cookies + localStorage to disk

2. Subsequent sessions — state-load:
   playwright-cli state-load .project/auth-state.json
   playwright-cli goto [authed-url]
   ...

3. Or via run-code newContext (HiDPI/dark variants):
   newContext({ storageState: '.project/auth-state.json', deviceScaleFactor: 2, ... })

4. Cleanup at end of flow:
   rm .project/auth-state.json    ← don't leave credentials on disk
```

### Constraints

- **State file lifecycle**: always clean up at end of skill run (state contains session tokens).
- **Location**: `.project/auth-state.json` (gitignored). Do not commit.
- **Validity**: state expires when cookies expire — on failure: re-login + state-save.

---

## Use Cases: Console Error Inspection

For detecting client-side JS errors that are not visible in screenshot or snapshot. A page can look visually correct but crash at runtime — `console error` catches that.

### Sequence

```
CONSOLE INSPECTION
──────────────────
1. playwright-cli goto [url]
2. playwright-cli run-code "async p => { await p.waitForLoadState('networkidle'); }"
3. playwright-cli console error                ← errors only (no warnings/info)
4. Parse output → if errors: record as finding
```

### Filter Strategy

| Min-level | Use case                                                    |
| --------- | ----------------------------------------------------------- |
| `error`   | Default for audit/verification — blocking issues only       |
| `warning` | A11y libs (React/axe) — catches missing-aria-label warnings |
| `info`    | Debugging — rarely useful in skills, a lot of noise         |

### Noise Mitigation

Many apps log non-critical warnings in dev-mode (HMR, deprecation notices). For stable detection:

- Filter on `error` level by default
- Filter console output against the patterns below; anything remaining is a real finding
- When in doubt: record count + example, let the user decide

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

For auditing failed requests, payload size, missing cache headers, and validating whether content APIs actually returned content (vs fallback).

### Sequence

```
NETWORK INSPECTION
──────────────────
1. playwright-cli goto [url]
2. playwright-cli run-code "async p => { await p.waitForLoadState('networkidle'); }"
3. playwright-cli requests                     ← list all requests, numbered
4. Per relevant index:
   playwright-cli response-headers [idx]       ← cache, content-type, status
   playwright-cli response-body [idx]          ← content (text inline, binary → file)
```

### Audit Patterns

| Pattern                | Detectie                                                                    |
| ---------------------- | --------------------------------------------------------------------------- |
| Failed requests        | `requests` → filter status 4xx/5xx                                          |
| Large payloads         | `requests` → filter size > 500KB                                            |
| Missing cache headers  | `response-headers <i>` → check `cache-control`, `etag` on static assets     |
| Render-blocking        | `requests` order + timing — long-running CSS/JS before LCP                  |
| Content endpoint check | `request <i>` on critical API → 200 + body contains expected content (S003) |

### Token Efficiency

`requests` (without index) returns a compressed list. Only with `request <i>` / `response-body <i>` do you get full content — only do this for relevant indexes.

---

## Daemon vs Runner — Decision Tree

```
What do you need?
│
├── Quickly inspect something, take a screenshot/snapshot, check console/network,
│   run multi-viewport scans, ad-hoc validation?
│   → DAEMON (playwright-cli)   — no test files, direct output
│
└── One of these five features?
    │
    ├── Pixel-baseline visual regression  →  toHaveScreenshot()
    ├── A11y-tree assertion with fail on regression  →  toMatchAriaSnapshot()
    ├── Debug timeline after failure  →  --trace on + show-trace
    ├── First-class browser assertions  →  expect(page).toHaveURL() / toHaveText() etc.
    └── Persistent acceptance/regression specs  →  .spec.ts file
    → RUNNER (@playwright/test)   — see section below
```

---

## Runner Mode (@playwright/test)

Use the runner **only** for the five features above. Daemon remains the default.

### Pre-flight

```bash
# Check runner available
npx playwright --version 2>/dev/null || echo "not available"

# If not available: install locally (dev dependency)
npm install --save-dev @playwright/test
npx playwright install chromium --with-deps
```

### On-the-fly Spec Pattern

Skills generate a temporary spec — no permanent `tests/` convention in the project.

**1. Generate config (once per skill-run)**

```typescript
// .project/playwright-runs/playwright.config.ts  (temporary, gitignored)
import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: ".", // spec lives next to config
  snapshotDir: "./__screenshots__", // baselines in .project/playwright-runs/__screenshots__/
  use: {
    baseURL: "http://localhost:3000", // adjust to active dev server
    trace: "retain-on-failure", // always trace on failure
  },
  reporter: [["json", { outputFile: "./results.json" }]],
});
```

**2. Generate spec**

```typescript
// .project/playwright-runs/{skill}-{slug}.spec.ts  (temporary, gitignored)
import { test, expect } from "@playwright/test";

test("{description}", async ({ page }) => {
  await page.goto("{path}");
  await page.waitForLoadState("networkidle");

  // Visual regression (first run creates baseline):
  await expect(page).toHaveScreenshot("{name}.png", {
    mask: [page.locator("{dynamic-element}")], // mask time/date/ads
    maxDiffPixelRatio: 0.02, // 2% tolerance for anti-aliasing
  });

  // A11y-tree assertion:
  await expect(page.locator("main")).toMatchAriaSnapshot(`
    - heading "{expected title}" [level=1]
    - navigation
    - main
  `);
});
```

**3. Run the runner**

```bash
# First run — create baselines:
npx playwright test .project/playwright-runs/{spec}.spec.ts \
  --config=.project/playwright-runs/playwright.config.ts \
  --update-snapshots

# Subsequent runs — compare with baselines:
npx playwright test .project/playwright-runs/{spec}.spec.ts \
  --config=.project/playwright-runs/playwright.config.ts

# On failure — open trace:
npx playwright show-trace .project/playwright-runs/test-results/*/trace.zip
```

**4. Parse result**

```bash
# results.json contains: passed/failed/timedOut counts + per-test details
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
# On success: delete spec + config, keep baselines
rm -f .project/playwright-runs/{spec}.spec.ts
rm -f .project/playwright-runs/playwright.config.ts
rm -rf .project/playwright-runs/test-results/   # playwright output dir

# On failure: keep everything for debugging
# Baselines always stay at: .project/playwright-runs/__screenshots__/
```

### Baseline Management

| Situation                    | Action                                            |
| ---------------------------- | ------------------------------------------------- |
| First run (no baseline)      | `--update-snapshots` → creates baseline           |
| Intentional style change     | `--update-snapshots` → update baseline            |
| Unexpected diff              | View diff in `test-results/` or via `show-report` |
| Dynamic content (dates, ads) | Mask via `{ mask: [page.locator('...')] }`        |

### Trace Debugging

```bash
# Trace is automatically saved on failure (retain-on-failure in config)
# Find trace file:
ls .project/playwright-runs/test-results/*/trace.zip

# Open interactive viewer:
npx playwright show-trace .project/playwright-runs/test-results/{slug}/trace.zip
```

---

## Use Cases: Emulation Snippets

Combine these options in `browser.newContext({ ... })` (daemon via `run-code`) or in `playwright.config.ts` `use:` (runner).

### prefers-reduced-motion

```javascript
// Daemon: playwright-cli run-code "async page => { ... }"
async (page) => {
  const ctx = await page.context().browser().newContext({
    reducedMotion: "reduce", // 'no-preference' to explicitly reset
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
// Runner: playwright.config.ts use-block
use: {
  reducedMotion: "reduce";
}
```

### forcedColors (High Contrast Mode)

```javascript
// Daemon
async (page) => {
  const ctx = await page.context().browser().newContext({
    forcedColors: "active", // simulates Windows High Contrast Mode
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

### HiDPI + colorScheme (reference)

For HiDPI 2× retina and dark/light mode snippets: see **Use Cases: HiDPI Screenshots** above — those patterns are identical, use `newContext({ deviceScaleFactor: 2, colorScheme: 'dark' })`.

### Combinations

```javascript
// HiDPI + dark + reduced motion + auth — all combined
async (page) => {
  const ctx = await page
    .context()
    .browser()
    .newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
      colorScheme: "dark",
      reducedMotion: "reduce",
      storageState: ".project/auth-state.json", // only if auth is used
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
