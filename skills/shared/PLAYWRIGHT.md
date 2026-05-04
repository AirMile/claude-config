# Playwright Browser Automation

Reusable Playwright CLI patterns voor visual validation, accessibility checks, en browser-based testing across frontend skills. For round-based screenshot comparison loops, see `VERIFICATION.md`.

**CLI:** `playwright-cli` (global via `@playwright/cli`). Check: `playwright-cli --version`.

---

## Overview

| MCP (oud)                          | CLI command                                                                                 | Output                              |
| ---------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------- |
| `browser_navigate`                 | `playwright-cli goto [url]`                                                                 | Auto-snapshot link                  |
| `browser_wait_for { time }`        | `playwright-cli run-code "async page => { await page.waitForTimeout(N); }"`                 | —                                   |
| `browser_wait_for { text }`        | `playwright-cli run-code "async page => { await page.waitForSelector(':text(\"...\")'); }"` | —                                   |
| `browser_snapshot`                 | `playwright-cli snapshot --filename=[path]`                                                 | YAML op disk, alleen link in stdout |
| `browser_snapshot` (inline)        | `playwright-cli snapshot`                                                                   | Volledige tree inline in stdout     |
| `browser_take_screenshot`          | `playwright-cli screenshot --filename=[path]`                                               | PNG op disk, link in stdout         |
| `browser_take_screenshot fullPage` | `playwright-cli screenshot --full-page --filename=[path]`                                   | PNG (volledige hoogte) op disk      |
| `browser_close`                    | `playwright-cli close`                                                                      | —                                   |
| `browser_resize`                   | `playwright-cli resize [width] [height]`                                                    | Auto-snapshot link                  |
| `browser_evaluate`                 | `playwright-cli eval "[js expression]"`                                                     | JSON result inline                  |
| `browser_run_code`                 | `playwright-cli run-code "async page => { ... }"`                                           | Return value inline                 |

> **Snapshot strategie**: `--filename` → tree op disk, alleen link terug (token-efficient, voor batch). Zonder flag → tree inline (voor directe analyse van 1-2 routes).

> **Belangrijk**: `file://` protocol is geblokkeerd. Altijd HTTP vereist — start dev server voor lokale bestanden.

---

## Standard Execution Pattern

### Basic Analysis Sequence

Voor statische pagina-validatie:

```
PLAYWRIGHT SEQUENCE
───────────────────
1. playwright-cli open [url]
2. playwright-cli snapshot --filename=snapshot.yml
3. Read snapshot.yml                  ← alleen als tree-analyse nodig
4. playwright-cli screenshot --filename=page.png
5. Read page.png                      ← alleen als visuele check nodig
6. playwright-cli close
```

### Dynamic Content Sequence

Voor client-rendered content (SPA, React, Vue):

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

Voor animaties of transities:

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

Voor elke Playwright-operatie, verifieer beschikbaarheid:

```
PRE-FLIGHT: Playwright CLI
──────────────────────────
[ ] playwright-cli beschikbaar: playwright-cli --version
    → version: [x.x.x | ERROR]
[ ] Dev server draait op verwachte URL
    (file:// is geblokkeerd — HTTP vereist)
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
question: "Playwright CLI niet beschikbaar. Hoe doorgaan?"
options:
  - label: "Doorgaan zonder visuals (Recommended)"
    description: "Skip browser checks, continue workflow"
  - label: "Installeer CLI"
    description: "Run: npm install -g @playwright/cli@latest"
  - label: "Annuleren"
    description: "Stop workflow"
```

---

## Error Recovery

### Navigation Failures

| Error              | Cause                    | Recovery                                           |
| ------------------ | ------------------------ | -------------------------------------------------- |
| URL not found      | Invalid path             | Controleer URL, start dev server indien nodig      |
| Timeout            | Pagina laadt niet        | Verhoog waitForTimeout, retry once                 |
| file:// blocked    | Protocol niet toegestaan | Gebruik `python3 -m http.server` voor lokale files |
| Connection refused | Server draait niet       | Start dev server, retry                            |

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

- **Dev servers**: Altijd HTTP — `file://` is geblokkeerd
- **Lokale bestanden**: `python3 -m http.server [port]` → `http://localhost:[port]/file.html`
- **Storybook**: Gebruik iframe URL voor schonere analyse

### Snapshot Strategie

| Scenario                            | Aanpak                                                  |
| ----------------------------------- | ------------------------------------------------------- |
| Directe tree-analyse (1-2 routes)   | `playwright-cli snapshot` (inline)                      |
| Batch (6+ viewports/routes)         | `playwright-cli snapshot --filename=X.yml` + Read later |
| Tree niet nodig (alleen screenshot) | Geen snapshot-call                                      |

### Wait Strategie

| Content Type    | Wait Aanpak                                                                  |
| --------------- | ---------------------------------------------------------------------------- |
| Static HTML     | Geen wait nodig                                                              |
| SSR/SSG         | `run-code "async page => { await page.waitForTimeout(500); }"`               |
| Client-rendered | `run-code "async page => { await page.waitForSelector(':text(\"...\")'); }"` |
| Animaties       | `run-code "async page => { await page.waitForTimeout(2000); }"`              |
| networkidle     | `run-code "async page => { await page.waitForLoadState('networkidle'); }"`   |

### Resource Cleanup

- **Altijd** `playwright-cli close` na sessie — ook bij errors
- **Bij hangende processen**: `playwright-cli kill-all`
- **Geen orphaned Chrome** — CLI daemon sluit netjes, geen `pkill` nodig

### Named Sessions (multi-sessie / auth)

```bash
playwright-cli -s=mysession open [url] --persistent
playwright-cli -s=mysession fill e5 "user@example.com"
playwright-cli -s=mysession screenshot --filename=result.png
playwright-cli -s=mysession close
```

---

## Cross-Skill References

| Skill              | Uses Playwright For                    | Snapshot strategie  |
| ------------------ | -------------------------------------- | ------------------- |
| `frontend-wcag`    | A11y tree analyse, focus validatie     | Inline (1-2 routes) |
| `frontend-convert` | Screenshot capture + verification loop | Screenshot only     |
| `frontend-audit`   | Multi-viewport, CWV, SEO render check  | --filename (batch)  |
| `marketing-promo`  | HiDPI screenshots, dark mode variants  | run-code newContext |

---

## Use Cases: Responsive Validation

### Multi-Viewport Capture Sequence

Per route, capture op 6 viewports:

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
