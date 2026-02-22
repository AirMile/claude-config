# Playwright Browser Automation

Reusable Playwright MCP patterns for visual validation, accessibility checks, and browser-based testing across frontend skills.

---

## Overview

| Tool                      | Purpose                    | Returns                     |
| ------------------------- | -------------------------- | --------------------------- |
| `browser_navigate`        | Open URL in browser        | Page loaded state           |
| `browser_wait_for`        | Wait for content/time      | Sync point                  |
| `browser_snapshot`        | Capture accessibility tree | **Tree structure (direct)** |
| `browser_take_screenshot` | Capture visual state       | **Image data (direct)**     |
| `browser_close`           | Clean up browser session   | -                           |

> **Ephemeral Pattern**: All Playwright tools return data directly to the agent. Analyze in conversation - no file storage needed.

---

## Standard Execution Pattern

### Basic Analysis Sequence

For static page validation:

```
PLAYWRIGHT SEQUENCE
───────────────────
1. browser_navigate → [url]
2. browser_snapshot → (analyze accessibility tree)
3. browser_take_screenshot → (view visual state)
4. browser_close
5. Bash: pkill -f "chrome.*(playwright|mcp-chrome)" 2>/dev/null || true
```

### Dynamic Content Sequence

For client-rendered content (SPA, React, Vue):

```
PLAYWRIGHT SEQUENCE (Dynamic)
─────────────────────────────
1. browser_navigate → [url]
2. browser_wait_for → { text: "[expected content]" }
3. browser_snapshot → (analyze accessibility tree)
4. browser_take_screenshot → (view visual state)
5. browser_close
6. Bash: pkill -f "chrome.*(playwright|mcp-chrome)" 2>/dev/null || true
```

### Timed Wait Sequence

For animations or transitions:

```
PLAYWRIGHT SEQUENCE (Timed)
───────────────────────────
1. browser_navigate → [url]
2. browser_wait_for → { time: 2 }
3. browser_take_screenshot → (view visual state)
4. browser_close
5. Bash: pkill -f "chrome.*(playwright|mcp-chrome)" 2>/dev/null || true
```

---

## Pre-flight Validation

Before any Playwright operations, verify availability:

```
PRE-FLIGHT: Playwright
──────────────────────
[ ] Playwright MCP tools available
    → browser_navigate: [✓|✗]
    → browser_snapshot: [✓|✗]
    → browser_take_screenshot: [✓|✗]
    → browser_close: [✓|✗]
[ ] URL accessible (file:// or http://)
```

### Availability Check

```
Playwright: [✓ Available | ✗ Unavailable]
  Tools: [4/4 | N/4] available
  Status: [Ready | Degraded | Unavailable]
```

### On Unavailable

```yaml
header: "Playwright Unavailable"
question: "Playwright tools niet beschikbaar. Hoe doorgaan?"
options:
  - label: "Doorgaan zonder visuals (Recommended)"
    description: "Skip browser checks, continue workflow"
  - label: "Installeer browser"
    description: "Run: browser_install"
  - label: "Annuleren"
    description: "Stop workflow"
```

---

## Error Recovery

### Navigation Failures

| Error              | Cause              | Recovery                                         |
| ------------------ | ------------------ | ------------------------------------------------ |
| URL not found      | Invalid path       | Use absolute path with `file:///` prefix         |
| Timeout            | Page doesn't load  | Increase wait time, retry once                   |
| Protocol error     | Wrong URL scheme   | Ensure `file://` for local, `http://` for server |
| Connection refused | Server not running | Start dev server, retry                          |

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
    ↓ (tools unavailable)
Manual Instructions:
  "Open [url] in browser to verify manually"
```

---

## Use Cases by Skill

### Wireframe: Visual Design Validation

```
Purpose: Analyze wireframe designs for reflection
Data needed: Accessibility tree for structure analysis
Sequence: navigate → snapshot → screenshot → close
Agent analyzes: Layout, headings, interactive elements
```

### SEO: Rendered Content Validation (S003)

```
Purpose: Verify client-rendered content is visible to crawlers
Data needed: Accessibility tree to detect rendered content
Sequence: navigate → wait_for (content) → snapshot → close
Agent checks: Title, H1, meta tags in accessibility tree
Critical: Detects SPA content invisible to search engines
```

### Validate: Browser-Based Accessibility

```
Purpose: Check accessibility rules requiring DOM inspection
Data needed: Accessibility tree for element analysis
Sequence: navigate → snapshot → close
Agent checks: H1 count (H002), interactive elements (H006)
```

---

## Integration Examples

### Example: Local HTML File

```
FILE ANALYSIS
─────────────
URL: file:///C:/Projects/app/output/wireframe.html

1. browser_navigate → file:///[absolute-path]/wireframe.html
2. browser_snapshot → (parse accessibility tree for structure)
3. browser_take_screenshot → (view visual result)
4. browser_close

Agent analyzes snapshot for:
- Heading hierarchy
- Interactive elements
- Content structure
```

### Example: Development Server (SPA)

```
DEV SERVER ANALYSIS
───────────────────
URL: http://localhost:3000/dashboard

1. browser_navigate → http://localhost:3000/dashboard
2. browser_wait_for → { text: "Dashboard" }
3. browser_snapshot → (verify content rendered)
4. browser_close

Agent checks:
- Content visible in accessibility tree (not just source)
- H1 present after hydration
- Meta tags rendered (if dynamic)
```

### Example: Accessibility Snapshot Analysis

```
ACCESSIBILITY ANALYSIS
──────────────────────
1. browser_navigate → [url]
2. browser_snapshot → (returns accessibility tree)

Agent parses returned snapshot for:
- heading: H1 count (H002 rule)
- button: Interactive element count
- link: Navigation elements
- textbox: Form fields

Example snapshot content:
  - heading "Dashboard Overview" [level=1]
  - navigation "Main Nav"
    - link "Home"
    - link "Settings"
  - button "Create New"
  - textbox "Search"
```

---

## Best Practices

### URL Handling

- **Local files**: Always use absolute paths with `file:///` prefix
- **Windows paths**: Convert backslashes: `C:\path` → `file:///C:/path`
- **Dev servers**: Verify server running before analysis
- **Storybook**: Use iframe URL for cleaner analysis

### Wait Strategies

| Content Type    | Wait Strategy          |
| --------------- | ---------------------- |
| Static HTML     | No wait needed         |
| SSR/SSG         | Short wait (500ms)     |
| Client-rendered | Wait for text/element  |
| Animations      | Timed wait (1-2s)      |
| Heavy content   | Wait for specific text |

### Resource Cleanup

- **Always** call `browser_close` after analysis — ook bij errors
- **Handle errors** with try/finally pattern: als een stap faalt, sla door naar `browser_close`
- **Na `browser_close`**: kill orphaned Chrome processen met:
  ```bash
  pkill -f "chrome.*(playwright|mcp-chrome)" 2>/dev/null || true
  ```
- Deze bash cleanup is **verplicht** als laatste stap van elke Playwright-sequentie
- Chrome processen overleven `browser_close` en eten CPU/RAM als ze niet gekilld worden

---

## Cross-Skill References

| Skill                 | Uses Playwright For                         | Primary Data        |
| --------------------- | ------------------------------------------- | ------------------- |
| `frontend-compose`    | Design analysis, reflection                 | Accessibility tree  |
| `frontend-seo`        | Rendered content validation (S003)          | Accessibility tree  |
| `frontend-a11y`       | Accessibility tree analyse, focus validatie | Accessibility tree  |
| `frontend-responsive` | Multi-viewport capture + overflow detectie  | Screenshots + tree  |
| `frontend-perf`       | CWV measurement via PerformanceObserver     | Performance metrics |

---

## Use Cases: Responsive Validation

### Multi-Viewport Capture Sequence

Per route, capture op 6 viewports:

```
RESPONSIVE CAPTURE SEQUENCE
────────────────────────────
Viewports: 320, 375, 768, 1024, 1440, 1920

Per viewport:
1. browser_resize → { width: [vp], height: 900 }
2. browser_wait_for → { time: 1 }
3. browser_take_screenshot → (visual state at viewport)
4. browser_snapshot → (accessibility tree — check verdwijnende elementen)
5. browser_evaluate → overflow check (see below)

After all viewports:
6. browser_close
7. Bash: pkill -f "chrome.*(playwright|mcp-chrome)" 2>/dev/null || true
```

### Overflow Detection

```javascript
// browser_evaluate: check horizontal overflow
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
// browser_evaluate: measure CWV
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
