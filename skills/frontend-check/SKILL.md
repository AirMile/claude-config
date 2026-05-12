---
name: frontend-check
description: >-
  Check and fix performance (Lighthouse, CWV, bundle), SEO (Google), AEO (AI search),
  accessibility (WCAG 2.1 AA), responsive design (multi-viewport), darkmode, error states,
  smoke, and user flows in one unified hub. Use with /frontend-check.
argument-hint: "[url | source-path | feature-name] [--scope=performance|seo|aeo|responsive|a11y|...]"
reads:
  [backlog.status, feature.requirements, feature.files, feature.architecture]
writes: [backlog.status]
metadata:
  author: mileszeilstra
  version: 2.3.0
  category: frontend
---

# Check

Unified check & fix hub for performance, SEO, AEO (AI search optimization), responsive design, darkmode, error states, smoke, and user flows. Scan on all axes, get a combined report, fix by priority, verify with before/after comparison.

**Related skills:** `/frontend-design` · `/frontend-tokens` · `/frontend-convert` · `/core-setup`

## References

- `../shared/BACKLOG.md` — Backlog HTML+JSON format, read/write protocol
- `../shared/RULES.md` — General (R009), P-series (performance), S-series (SEO), A-series (accessibility), H-series (responsive/HTML)
- `../shared/DESIGN.md` — Anti-patterns (AI design tells), motion timing, interaction states
- `../shared/PLAYWRIGHT.md` — Playwright CLI: CWV measurement, multi-viewport captures, overflow detection
- `../shared/PATTERNS.md` — Code splitting, memoization patterns
- `../shared/DEVINFO.md` — Session tracking, cross-skill handoff

---

## Process

**Phase tracking** — first action of the skill: call `TaskCreate` with these 5 items (status `pending`), then use `TaskUpdate` to set each phase to `in_progress` at the start and `completed` at the end. During context compaction the task list stays visible — no risk of forgotten phases.

1. PHASE 0: Pre-flight
2. PHASE 1: Scan
3. PHASE 2: Report
4. PHASE 3: Fix
5. PHASE 4: Re-audit & Completion

## PHASE 0: Pre-flight

> **Todo**: call `TaskCreate` with the 5 phase items (see above). Mark PHASE 0 → `in_progress` via `TaskUpdate`.

### 0.1 Target Selection

Detect input type via fixed order:

**1. URL** — `$1` starts with `http://` or `https://` → `targetType = "url"`, `urlTarget = $1`

**2. Feature-name** — `$1` has no path separator (`/` or `\`) and no extension, and appears in `.project/backlog.html#data.features[].name`:

- Read `.project/features/{$1}/feature.json`
- If not found → fallback to step 3 (source-path)
- `targetType = "feature"`, `featureName = $1`
- Build targets:
  - `routeTargets = feature.json#architecture.routes[].path` — resolve to full URLs via dev-server base (read from `project.json#devServer` or default `http://localhost:3000`)
  - `fileTargets = feature.json#files[].path` — component/page files for static scopes
- Show confirmation:
  ```
  FEATURE TARGET: {featureName}
  Routes: {N} ({route-list})
  Files:  {N} ({file-list})
  ```

**3. Source-path** — `$1` has path separator or extension, no http-prefix → `targetType = "path"`, `fileTargets = [$1]`

**4. No argument** → AskUserQuestion:

```yaml
header: "Target"
question: "What do you want to check?"
options:
  - label: "Running dev server (Recommended)", description: "Lighthouse + captures on dev server"
  - label: "Specific URL", description: "Enter a URL"
  - label: "Feature", description: "Audit a specific feature — auto-scope on files[] + routes[]"
  - label: "Production build", description: "Build first, then analyze"
  - label: "Quick smoke check", description: "Health check only — all routes in < 2 min"
multiSelect: false
```

- "Quick smoke check" → `scope = [Smoke]`, skip PHASE 0.2
- "Feature" → AskUserQuestion (free text): "Which feature? (kebab-case name)" → feature-target flow from step 2

### 0.2 Scope Selection

**Auto-scope** — if `targetType` is known, detect the optimal scope and confirm first:

| Target type              | Auto-scope                                                                                               |
| ------------------------ | -------------------------------------------------------------------------------------------------------- |
| `url`                    | Performance + SEO + AEO + Responsive + Darkmode                                                          |
| `path` (component)       | A11Y + Token Architecture + Dark mode compliance                                                         |
| `feature` with routes    | Performance + SEO + AEO + Responsive + Darkmode + A11Y (over routes) + Token Architecture (over files[]) |
| `feature` without routes | A11Y + Token Architecture + Dark mode compliance (over files[])                                          |

If `targetType` is `url`, `path`, or `feature` → show auto-scope confirmation:

```yaml
header: "Scope"
question: "Auto-scope: {detected-scopes}. Continue or adjust?"
options:
  - label: "Continue (Recommended)"
    description: "Use detected scope"
  - label: "Adjust"
    description: "Manually choose which checks to run"
multiSelect: false
```

"Adjust" or no arg (manual target) → full scope selection:

```yaml
header: "Scope"
question: "Which checks do you want to run?"
options:
  - label: "Everything (Recommended)", description: "Performance + SEO + AEO + A11Y + Responsive + Darkmode + Error states + Smoke + Flow + Token Architecture + Dark mode compliance + Responsive coverage"
  - label: "I'll choose myself", description: "Select specific checks"
multiSelect: false
```

If "I'll choose myself":

```yaml
header: "Checks"
question: "Which checks?"
options:
  - label: "Performance", description: "Lighthouse, CWV, bundle sizes"
  - label: "SEO", description: "Google search optimization"
  - label: "AEO", description: "AI search optimization (ChatGPT, Perplexity, Gemini)"
  - label: "A11Y", description: "Accessibility audit (WCAG 2.1 AA) — static scan + optional Playwright"
  - label: "Responsive", description: "Multi-viewport layout audit"
  - label: "Darkmode", description: "Light + dark comparison, contrast, missing variants"
  - label: "Error states", description: "404, offline, slow-3G UI rendering"
  - label: "Smoke", description: "Quick multi-route health check (200 + render + no errors)"
  - label: "Flow", description: "Execute design.flows[] from project.json (navigation journeys)"
  - label: "Token Architecture", description: "Audit design token usage — semantic var() refs, hardcoded colors"
  - label: "Dark mode compliance", description: "Static code audit — dark: classes present where dark mode is configured"
  - label: "Responsive coverage", description: "Static code audit — responsive prefixes present in multi-viewport components"
multiSelect: true
```

### 0.2.5 Scope Validation

If scope contains **Flow**:

- Read `.project/project.json → design.flows`
- If flows is missing or empty → stop with message:
  > "No flows defined in `design.flows[]`. Run `/frontend-design` first to add flows, then re-run `/frontend-check scope Flow`."
- If flows is non-empty → continue.

### 0.3 Project Detection

Detect framework, bundler, CSS approach, rendering strategy (SSR/SSG/CSR).

```
PRE-FLIGHT COMPLETE
═════════════════════════════════════════════════════════════
Target:     [URL]
Framework:  [Next.js 14 App Router | Vite + React | etc.]
Bundler:    [Webpack | Vite | Turbopack]
Renderer:   [SSR | SSG | CSR | mixed]
CSS:        [Tailwind | CSS Modules | styled-components]
Audits:     [Performance, SEO, AEO, Responsive]
═════════════════════════════════════════════════════════════
```

### 0.4 Backlog Stage (optional)

Read `.project/backlog.html` (if exists) → parse JSON from `<script id="backlog-data" type="application/json">...</script>`.

**If `targetType === "feature"`**: match directly on `featureName` (no URL-matching). Find `data.features.find(f => f.name === featureName)` → set `stage: "testing"`, `data.updated` to today. Write back.

**All other target types**: filter features with `status === "DOING" && stage === "built"`. Match target URL/page against backlog items (best-effort: match page name from URL path to feature name). If match found: set `stage: "testing"`, `data.updated` to today. Write back via Edit (keep `<script>` tags intact).

If no match or no backlog: skip (audit can run on non-backlog pages too).

**Note:** for scope `Smoke` or `Flow` (cross-cutting checks): skip per-feature matching. Do not mark any specific backlog item as `testing`. The checks run project-wide; report findings generally.

---

## PHASE 1: Scan

> **Todo**: mark PHASE 0 → `completed`, PHASE 1 → `in_progress`.

Run all selected checks. Each produces findings with severity + category.

### 1.0 Auth Setup (optional)

If scope contains Flow, Smoke, or Darkmode:

```yaml
header: "Auth"
question: "Does one or more checks require login?"
options:
  - label: "No auth needed (Recommended)", description: "All checks on public routes"
  - label: "Login first", description: "state-save flow — reused for all checks"
multiSelect: false
```

If "Login first" → perform auth setup (see `../shared/PLAYWRIGHT.md` → Use Cases: Auth State Persistence):

```
playwright-cli open [login-url]
playwright-cli snapshot                              ← fetch refs
playwright-cli fill [email-ref] "[email]"
playwright-cli fill [password-ref] "[password]"
playwright-cli click [submit-ref]
playwright-cli run-code "async p => { await p.waitForLoadState('networkidle'); }"
playwright-cli state-save .project/auth-state.json
```

Auth state is reused for all subsequent checks. **Cleanup** `.project/auth-state.json` always at end of PHASE 4.

### 1.1 Performance Scan

**Lighthouse** (primary, if available):

```bash
npx lighthouse {url} --output json --chrome-flags="--headless --no-sandbox" --only-categories=performance,accessibility,best-practices
```

Extract: Performance score, LCP, CLS, INP, FCP, TTFB, opportunities.

**Fallback**: Playwright CLI CWV via PerformanceObserver (see `PLAYWRIGHT.md` → Use Cases: Performance Measurement).

**Network inspection** (Playwright CLI, see `PLAYWRIGHT.md` → Use Cases: Network Inspection):

```
playwright-cli goto {url}
playwright-cli run-code "async p => { await p.waitForLoadState('networkidle'); }"
playwright-cli requests
```

Parse the request list → findings:

- **P005 (CRITICAL)**: failed requests (status 4xx/5xx) — user gets broken page states
- **P108 (HIGH)**: payloads > 500KB — `request <i>` for details, candidate for compression/code-splitting
- **P109 (HIGH)**: missing cache headers on static assets — `response-headers <i>` → check `cache-control`/`etag`

**Runtime errors** (Playwright CLI, see `PLAYWRIGHT.md` → Use Cases: Console Error Inspection):

```
playwright-cli console error
```

→ Filter output against PLAYWRIGHT.md → Default Ignore Patterns before reporting; only unfiltered lines become findings.

Each error = new finding **P004 (CRITICAL)** "JS Runtime Error" with location + message. A crashing component is a blocking bug, even if Lighthouse score is high.

**Bundle analysis** (if build script available):

`npm run build` → parse output for chunk sizes per route.

**Static code audit**: Scan for images without lazy loading, full library imports, render-blocking CSS, missing font preloading, sync third-party scripts.

### 1.2 SEO Scan

Per route, check:

**Critical:** Page titles (S001), meta descriptions (S002), rendering (S003 — Playwright CLI validate SSR via snapshot **+ content-endpoint check via `requests`/`request <i>` to prove content doesn't come from a fallback due to a failing API**), robots config (S004).

**Important:** Open Graph (S101), canonical URLs (S102), sitemap (S103), robots.txt (S104), heading hierarchy (H002/H003), image alt text (R002).

**Enhancement:** Structured data / JSON-LD (S201), Twitter cards (S202), dynamic OG images (S203).

Use Context7 to research framework-specific SEO APIs before recommending fixes.

### 1.3 AEO Scan (AI Search Optimization)

Optimize for AI answer engines (ChatGPT Search, Perplexity, Google AI Overviews, Gemini).

**Crawlability:**

- AE001: AI bot access — check robots.txt for ChatGPT-User, PerplexityBot, Google-Extended, Anthropic
- AE002: Structured content — semantic HTML (article, section, aside, nav) vs div soup
- AE003: Clear content hierarchy — H1 → H2 → H3 with logical grouping

**Answerability:**

- AE101: FAQ sections — question-answer pairs that AI can extract
- AE102: FAQ Schema (FAQPage JSON-LD) — structured data for Q&A
- AE103: HowTo Schema — step-by-step instructions as JSON-LD
- AE104: Concise definitions — key terms defined in first paragraph or summary
- AE105: TL;DR / summary sections — scannable summaries at top of content

**Citations:**

- AE201: Author/source attribution — bylines, credentials, publication dates
- AE202: Data citations — sources for statistics, claims, quotes
- AE203: About page / E-E-A-T signals — expertise, experience, authority, trust

**Freshness:**

- AE301: Last-modified headers / dateModified in schema
- AE302: Content timestamps visible on page
- AE303: Changelog / update history for evergreen content

### 1.4 A11Y Scan (Accessibility — WCAG 2.1 AA)

Only if scope "A11Y" is selected. If argument was a source-path → use as scan scope. Otherwise: project-wide scan.

**Stack detection (quick):** detect framework, component library, existing a11y setup (eslint-plugin-jsx-a11y, axe-core, @testing-library).

**Multi-route live check (optional):** if `.project/project.json → context.routing` contains routes, offer to run the live check over all routes:

```yaml
header: "Live scope"
question: "context.routing contains {N} routes. Do you want to run the live check over all routes?"
options:
  - label: "Yes, all routes (Recommended)", description: "Live check per route from context.routing"
  - label: "No, entry URL only", description: "Faster — only the main page"
multiSelect: false
```

If "All routes": store routing list as `a11y_live_routes`. If "Entry URL" or no routing: `a11y_live_routes = [target URL]`.

#### Static Analysis (always runs)

Scan source files (scope or project-wide) organized by priority:

**Critical (MUST_DO):**

| Rule ID | What to scan                                                                                   |
| ------- | ---------------------------------------------------------------------------------------------- |
| A001    | Icon-only buttons without aria-label, images-as-buttons without alt                            |
| A002    | div/span with onClick without role + tabIndex + onKeyDown                                      |
| A003    | Dialog/modal components without focus trap (check for `<dialog>`, FocusTrap, or equivalent)    |
| A004    | Dialog onClose without focus restoration to trigger                                            |
| A005    | CSS `:focus { outline: none }` or Tailwind `outline-none` without `focus-visible:` replacement |
| A006    | aria-expanded/aria-selected/aria-pressed not synchronized with component state                 |
| R001    | Non-semantic interactive elements (div-as-button, div-as-link)                                 |
| R004    | Form inputs without associated labels (`<label>` with htmlFor or wrapping)                     |
| R005    | Interactive elements missing keyboard handlers                                                 |

**High (SHOULD_DO):**

| Rule ID | What to scan                                                     |
| ------- | ---------------------------------------------------------------- |
| A101    | Form error messages not linked via aria-describedby              |
| A102    | Required fields without aria-required                            |
| A103    | Dynamic error display without aria-live                          |
| A104    | Loading states without aria-busy                                 |
| H004    | Hardcoded color values where contrast is questionable            |
| H006    | Small click targets (check className patterns for narrow sizing) |

**Medium (AVOID):**

| Rule ID | What to scan                                                                     |
| ------- | -------------------------------------------------------------------------------- |
| A201    | tabindex > 0 usage                                                               |
| A202    | aria-label on non-interactive elements (div, span, p)                            |
| A203    | `:focus { outline: none }` or `outline-none` without `focus-visible` replacement |

#### Live Check (Playwright — optional)

```yaml
header: "Live Check"
question: "Do you also want to run a browser-based check? (requires running dev server)"
options:
  - label: "Yes, with Playwright (Recommended)"
    description: "Check accessibility tree, focus order, ARIA in browser"
  - label: "No, static analysis only"
    description: "Faster, but less complete"
```

If yes:

```
LIVE CHECK (Playwright CLI)
═══════════════════════════════════════════════════

Dev server: [http://localhost:3000]
Routes:     [a11y_live_routes — 1 or more]

Per route in a11y_live_routes:
1. playwright-cli open [url]
2. playwright-cli snapshot
3. playwright-cli console warning
   → Filter output against PLAYWRIGHT.md → Default Ignore Patterns before reporting
4. playwright-cli close
5. Log: [route] → [N] findings

Parse snapshot for:
[ ] All interactive elements have accessible names
[ ] Heading hierarchy correct (H002/H003)
[ ] Form inputs have labels
[ ] No orphaned ARIA roles

Parse console output for:
[ ] React a11y warnings
[ ] axe-core / @axe-core/react warnings (if installed)
[ ] Library-specific a11y notices (Radix, Headless UI)

═══════════════════════════════════════════════════
```

**Emulation passes (C4 — daemon):** run two extra contexts per route for motion and contrast.

```
EMULATION PASSES (Playwright CLI)
────────────────────────────────
Per route in a11y_live_routes:

  prefers-reduced-motion:
  1. playwright-cli run-code "const ctx = await browser.newContext({ reducedMotion: 'reduce' }); const p = await ctx.newPage(); await p.goto('{url}'); await p.waitForLoadState('networkidle');"
  2. playwright-cli snapshot
     → Check: no auto-play animations, no infinite CSS-transitions visible in tree
  3. playwright-cli screenshot .project/playwright-runs/a11y-{route-slug}-reduced-motion.png

  forced-colors (Windows High Contrast):
  1. playwright-cli run-code "const ctx = await browser.newContext({ forcedColors: 'active' }); const p = await ctx.newPage(); await p.goto('{url}'); await p.waitForLoadState('networkidle');"
  2. playwright-cli screenshot .project/playwright-runs/a11y-{route-slug}-forced-colors.png
     → Visual: icons/borders visible? No white-on-white or black-on-black?
```

**Aria-snapshot runner path (C3):** create a baseline of the accessibility tree per route. Fails on regression in subsequent runs.

Generate `.project/playwright-runs/a11y-check-{slug}.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

const routes = { a11y_live_routes };

for (const route of routes) {
  test(`aria-snapshot — ${route}`, async ({ page }) => {
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("main")).toMatchAriaSnapshot();
  });
}
```

Generate `.project/playwright-runs/playwright.config.ts` (see `shared/PLAYWRIGHT.md → Runner Mode`).

First run: `npx playwright test .project/playwright-runs/a11y-check-{slug}.spec.ts --update-snapshots`
→ Baseline created in `.project/playwright-runs/__screenshots__/`

Subsequent runs: without `--update-snapshots` → FAIL on structural a11y regression (disappeared landmarks, changed heading hierarchy).

On FAIL: `npx playwright show-trace .project/playwright-runs/test-results/aria-snapshot-*/trace.zip`

**Focus Management Test** (only if static scan found a modal/dialog):

```
FOCUS MANAGEMENT TEST (per modal/dialog)
────────────────────────────────────────
Per dialog:
1. playwright-cli snapshot
2. playwright-cli click [trigger-ref]
3. playwright-cli snapshot
   → A003: is focus within modal bounds?
4. playwright-cli press Tab (×5)
   playwright-cli snapshot
   → A003: does focus stay within modal?
5. playwright-cli press Escape
6. playwright-cli snapshot
   → A004: is focus back on the trigger?

Output per dialog:
  A003 Focus trap: [PASS | FAIL — focus escaped to [element] after N tabs]
  A004 Focus restoration: [PASS | FAIL — focus on [element] instead of trigger]
```

**Full Keyboard Test** (optional, on request):

```yaml
header: "Keyboard test"
question: "Do you also want to run a full-page keyboard navigation test?"
options:
  - label: "No, modal focus test only (Recommended)", description: "Faster — tests only modals"
  - label: "Yes, full keyboard check", description: "Tab through entire page — takes longer"
multiSelect: false
```

**A11Y Scan Output:**

```
A11Y SCAN
  Framework:        [name]
  Scope:            [Project-wide | File: path | Component: name]
  Files scanned:    [N]
  Score:            [X/Y checks passed]
  CRITICAL:         [N] (A001, A002, R004, ...)
  HIGH:             [N]
  MEDIUM:           [N]
  Findings: [N] (C:[N] H:[N] M:[N])
```

#### Fix instructions per rule

**A001** — Icon-only button: `<button aria-label="Close">...</button>`. Image: `<img alt="description" />`.
**A002** — div-as-button: replace with `<button>`, or add `role="button"`, `tabIndex={0}`, `onKeyDown` (Enter/Space).
**A003** — Focus trap: use native `<dialog>`, `FocusTrap` from Headless UI/Radix, or implement tab-cycling.
**A004** — Focus restoration: store trigger-ref before open (`triggerRef.current.focus()` on close).
**A005** — Focus indicator: replace `outline-none` with `focus-visible:ring-2` or equivalent.
**A006** — ARIA state sync: bind `aria-expanded`, `aria-selected`, `aria-pressed` to component state.
**R001** — Semantic elements: replace `<div onClick>` with `<button>`, `<a href>` with `<Link>`.
**R004** — Form labels: add `<label htmlFor="id">` or use wrapping label.
**R005** — Keyboard handlers: add `onKeyDown` for Enter/Space on custom interactive elements.
**A101** — Error linkage: add `aria-describedby="error-id"` on input.
**A102** — Required: add `aria-required="true"` on required inputs.
**A103** — Live region: wrap dynamic errors in `<div aria-live="polite">`.
**A104** — Loading: add `aria-busy="true"` on loading containers.
**A201** — tabindex: replace `tabIndex={N}` (N > 0) with logical DOM order.

### 1.5 Responsive Scan

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

### 1.6 Darkmode Scan

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

### 1.7 Error States Scan

Test how the app responds to error scenarios:

```
1. 404: playwright-cli goto {url}/this-route-does-not-exist-404test
          playwright-cli snapshot + screenshot → check if app-404 renders (not browser-default)

2. Offline: playwright-cli run-code "async page => {
     await page.context().setOffline(true);
     await page.reload();
     await page.waitForTimeout(2000);
     await page.screenshot({ path: '.project/screenshots/offline.png' });
     await page.context().setOffline(false);
   }"
   → snapshot → check if offline-UI renders

3. Slow 3G: playwright-cli run-code "async page => {
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

### 1.8 Smoke Scan

Lightweight health check over all routes. Read routes in order of precedence:

1. `project.json → context.routing`
2. `design.pages[].name` if routing is missing
3. **Fallback** if both are absent: only check `/` (the target URL) + warn user: "No routes list found — only entry URL checked. Run `/frontend-design` or fill `project.json → context.routing` to smoke all routes."

Per route:

```
playwright-cli goto [route]
playwright-cli run-code "async p => { await p.waitForLoadState('networkidle'); }"
playwright-cli console error
→ Filter output against PLAYWRIGHT.md → Default Ignore Patterns before reporting; only unfiltered lines become findings.
playwright-cli requests
→ Check: no status 4xx/5xx
```

Output per route:

```
[route]  [status: ✓ OK | ✗ FAIL]  [errors: N]  [failed-requests: N]
```

Findings re-use P004 (runtime errors), P005 (failed requests). No new IDs.

Smoke table final report:

```
SMOKE CHECK
───────────────────────────────────────────────
Route               Status   Errors   Req fails
/                   ✓ OK     0        0
/dashboard          ✗ FAIL   2        1
/settings           ✓ OK     0        0
───────────────────────────────────────────────
Routes: [N] total, [M] failing
```

### 1.9 Flow Scan

Read `.project/project.json → design.flows[]`. Per flow:

1. Map each step (page name) → URL via `project.json → context.routing`
   - If no mapping found: finding F002 + skip step
2. Per step:
   ```
   playwright-cli goto [url]
   playwright-cli run-code "async p => { await p.waitForLoadState('networkidle'); }"
   playwright-cli console error
   → Filter against PLAYWRIGHT.md → Default Ignore Patterns
   playwright-cli screenshot --filename=.project/screenshots/flow-[name]-step[N].png
   ```
3. **Stop at first fail** + screenshot of break-point as finding F001
4. If auth configured in 1.0: use `state-load .project/auth-state.json` before first goto

Findings:

- **F001 (CRITICAL)**: flow broke at step N — [reason: 404 / runtime error / content not rendered]
- **F002 (HIGH)**: step page not mapped in routing — page name `X` unknown in context.routing

Flow output per step:

```
FLOW: [flow-name]
─────────────────
Step 1 [page-name] → [url]  ✓ OK  [screenshot]
Step 2 [page-name] → [url]  ✗ FAIL — runtime error: "Cannot read properties of undefined"
→ STOPPED (first fail)
```

**Codegen option for flows with interaction:**

If flow steps require interaction (click, fill, etc.) beyond navigation:

```yaml
header: "Flow interactions"
question: "Flow '{name}' may have interaction steps. How to proceed?"
options:
  - label: "Generate spec via codegen (Recommended)"
    description: "npx playwright codegen {url} — navigate the flow yourself, Playwright records it as a spec in .project/playwright-runs/flow-{name}.spec.ts"
  - label: "Navigation only (v1)"
    description: "Only execute goto steps — clicks and fills are skipped"
  - label: "Walk manually"
    description: "I'll walk the flow myself and provide feedback via PHASE 2 manual walkthrough"
multiSelect: false
```

If "codegen chosen": instruct user to run `npx playwright codegen {base_url}` in a separate terminal and navigate the flow. Save generated spec as `.project/playwright-runs/flow-{name}.spec.ts`. Then run via runner: `npx playwright test .project/playwright-runs/flow-{name}.spec.ts --config=.project/playwright-runs/playwright.config.ts --trace on`.

**Trace on Flow failure (F001):**

If runner spec was run: trace automatically available. Add to F001 finding:

```
Trace: npx playwright show-trace .project/playwright-runs/test-results/flow-{name}-*/trace.zip
```

If daemon-only: add to report: `"Repeat with codegen → runner for interactive debug timeline"`.

**Constraint v1:** flow only performs navigation (no click interactions within pages) unless codegen option was chosen. Interaction steps require `design.flows[].steps` enrichment with action data for a complete script without codegen.

### 1.10 Token Architecture Scan

Only if "Token Architecture" is selected. Static code analysis — no Playwright required.

**Step 1: Project.json check**

```bash
# Read .project/project.json → check theme.colors.semantic[]
```

If `project.json` is missing or `theme` is empty: stop scan with message `"No design tokens found in project.json — Token Architecture scan not runnable. Run /frontend-tokens first."` If `theme.colors.semantic[]` is present: store as `$SEMANTIC_TOKENS`.

**Step 2: Scan CSS files for semantic raw hex**

Grep CSS files (`.css`, `.scss`, globals, theme.css) for semantic token names with raw hex values:

```bash
# For each token in $SEMANTIC_TOKENS:
# grep -n "--color-{token}:\s*#\|--color-{token}:\s*oklch\|--color-{token}:\s*rgb"
```

- **T001 (HIGH)**: semantic CSS variable has raw hex instead of `var()` reference
  `"--color-{token}: {raw-value} — use var(--color-{nearest-primitive})"`

**Step 3: Scan component files for hardcoded colors**

Grep `src/**/*.{tsx,jsx,astro,vue}` for hardcoded color values that bypass the token system:

- Arbitrary Tailwind: `bg-[#hex]`, `text-[#hex]`, `border-[#hex]`
- Inline styles: `style={{ color: '#hex', background: '#hex' }}`

- **T101 (MEDIUM)**: hardcoded color value in component
  `"{file}:{line} — {pattern}: use var(--color-{nearest-token}) or theme class"`
  Only report if `project.json` has a populated theme.

**Token Architecture Check Output:**

```
TOKEN ARCHITECTURE
  Token source:     [.project/project.json (N semantic tokens)]
  CSS compliance:   [N/M semantic tokens use var() refs | N violations]
  Hardcoded colors: [N components with hardcoded values | clean]
  Findings: [N] (H:[N] M:[N])
```

---

### 1.11 Dark Mode Compliance Scan

Check `theme.modes.dark` in `.project/project.json`. If missing: skip with message `"Dark mode not configured — scan not applicable."`.

Scan all `.tsx`, `.jsx`, `.vue` component files:

1. Grep for Tailwind color classes: `bg-[a-z]`, `text-[a-z]`, `border-[a-z]`
   (Exclude: `bg-transparent`, `bg-inherit`, `text-inherit`, `text-current`, `border-transparent`)
2. Check per color class if a `dark:` counterpart is present on the same element
3. Also scan for inline `style={{ color: ..., background: ... }}` values

**Skip** if component exclusively uses CSS vars (`var(--color-*)`, `var(--background)`, etc.) — these are already dark-mode-aware via the theme.

**Findings:**

- DC001 (MEDIUM): color class without `dark:` counterpart
  → `{component}: {className} — expected dark:{alternative}`
- DC002 (LOW): component contains color classes, no `dark:` prefix present at all
  → `{component}: 0 dark: classes found (N color classes without dark variant)`

**Dark Mode Compliance Check Output:**

```
DARK MODE COMPLIANCE
  Dark mode configured: [yes | no — scan skipped]
  Components checked:   [N]
  Missing dark: classes:[N components | clean]
  Findings: [N] (M:[N] L:[N])
```

---

### 1.12 Responsive Coverage Scan

Check if project has multi-viewport context: `theme.breakpoints` in project.json OR `tailwind.config` defines custom screens. If missing: skip with message `"No multi-viewport context — scan not applicable."`.

Scan all `.tsx`, `.jsx`, `.vue` component files:

1. Grep for layout classes without responsive prefix: `flex`, `grid`, `hidden`, `block`, `w-full`, `columns-`, `gap-[0-9]`, `p-[0-9]`, `px-[0-9]`, `py-[0-9]`
2. Check if the component uses ≥1 responsive prefix (`sm:`, `md:`, `lg:`, `xl:`, `2xl:`)
3. Flag layout-heavy components (≥5 layout classes) without any responsive variant

**Findings:**

- RC001 (MEDIUM): layout classes present but no responsive prefixes
  → `{component}: {N} layout classes, 0 responsive prefixes — candidate for responsive adjustment`
- RC002 (LOW): spacing/typography without responsive variant in layout-heavy component
  → `{component}: {className} — consider md: or lg: variant for readability`

**Responsive Coverage Check Output:**

```
RESPONSIVE COVERAGE
  Multi-viewport context:[yes | no — scan skipped]
  Components checked:    [N]
  Missing responsive:    [N components | clean]
  Findings: [N] (M:[N] L:[N])
```

---

### 1.13 Finding Format (all checks)

```
FINDING: [ID]
─────────────
Check:    [Performance | SEO | AEO | A11Y | Responsive | Darkmode | Error states | Smoke | Flow]
Severity: [CRITICAL | HIGH | MEDIUM]
Rule:     [P001 | S001 | D001 | E001 | F001 | etc.]
Impact:   [CWV metric | search visibility | AI citability | viewport | UX]
File:     [path:line | route]
Issue:    [description]
Fix:      [suggestion]
```

---

## PHASE 2: Report

> **Todo**: mark PHASE 1 → `completed`, PHASE 2 → `in_progress`.

Combined report across all audit axes:

```
OPTIMIZATION REPORT
═════════════════════════════════════════════════════════════

PERFORMANCE
  Lighthouse: [score]/100
  CWV: LCP [val] | CLS [val] | INP [val]
  Bundle: [size] gzipped ([N] routes over budget)
  Network: [N] failed | [N] over 500KB | [N] missing cache
  JS errors: [N] runtime errors detected
  Findings: [N] (C:[N] H:[N] M:[N])

SEO
  Score: [N]/[total] checks passed
  Critical missing: [titles, descriptions, etc.]
  Findings: [N] (C:[N] H:[N] M:[N])

AEO
  AI bot access: [allowed | blocked | partial]
  Structured content: [semantic | div-heavy]
  FAQ/HowTo schema: [present | missing]
  E-E-A-T signals: [strong | weak | missing]
  Findings: [N] (C:[N] H:[N] M:[N])

A11Y
  Lighthouse a11y: [score]/100
  Files scanned:  [N]
  Critical:       [A001, A002, R004, ...]
  Focus traps:    [PASS | FAIL — N dialogs]
  Findings: [N] (C:[N] H:[N] M:[N])

RESPONSIVE
  Overflow viewports: [list]
  Touch target violations: [N]
  Findings: [N] (C:[N] H:[N] M:[N])

DARKMODE
  Theme support: [yes | no]
  Light vs dark: [different | identical — no dark variants]
  Findings: [N] (C:[N] H:[N])

ERROR STATES
  404 page: [custom app-404 | browser-default]
  Offline UI: [present | missing]
  Loading state: [skeleton | spinner | nothing]
  Findings: [N] (C:[N] H:[N])

SMOKE
  Routes checked: [N]
  Failing: [N] ([list of routes])
  Findings: [N]

FLOW
  Flows checked: [N]/[total in design.flows]
  Failing: [list — flow-name: broke at step N]
  Findings: [N]

TOKEN ARCHITECTURE
  Token source:     [project.json theme (N semantic tokens) | not available]
  CSS compliance:   [N/N semantic tokens correct | N violations]
  Hardcoded colors: [N components | clean]
  Findings: [N] (H:[N] M:[N])

DARK MODE COMPLIANCE
  Dark mode configured: [yes | no — scan skipped]
  Components checked:   [N]
  Missing dark: classes:[N components | clean]
  Findings: [N] (M:[N] L:[N])

RESPONSIVE COVERAGE
  Multi-viewport context:[yes | no — scan skipped]
  Components checked:    [N]
  Missing responsive:    [N components | clean]
  Findings: [N] (M:[N] L:[N])

COMBINED PRIORITIES (top 10):
  1. [finding] — [check] — [impact]
  2. [finding] — [check] — [impact]
  ...

Total: [N] findings (C:[N] H:[N] M:[N])

═════════════════════════════════════════════════════════════
```

### Scope Selection

```yaml
header: "Fix Scope"
question: "Which issues do you want to fix?"
options:
  - label: "All CRITICAL + HIGH (Recommended)", description: "[N] fixes with the biggest impact"
  - label: "CRITICAL only", description: "[N] fixes, quick wins"
  - label: "Everything", description: "[N] fixes total"
  - label: "I'll choose myself", description: "Select specific findings"
multiSelect: false
```

---

## PHASE 3: Fix

> **Todo**: mark PHASE 2 → `completed`, PHASE 3 → `in_progress`.

Implement fixes in priority order, grouped by audit category.

### Fix Order

1. **JS Runtime Errors** (P004): uncaught exceptions make CWV measurements unreliable and break pages functionally
2. **Failed network requests** (P005): 4xx/5xx on critical endpoints → broken page states
3. **Flow breakage** (F001): a broken user journey is worse than visual issues
4. **Error states** (E001/E002): broken 404/offline UX — no fallback = crash for user
5. **Responsive**: overflow + touch targets (breaks usability)
6. **Performance**: CLS → LCP → INP → bundle (CWV impact)
7. **Darkmode** (D001): visual completeness, no regression in color/contrast
8. **Dark mode compliance** (DC001): missing dark: classes in components
9. **Responsive coverage** (RC001): missing responsive prefixes in layout components
10. **SEO**: titles → descriptions → sitemap → robots → structured data
11. **AEO**: semantic HTML → FAQ schema → bot access → E-E-A-T
12. **A11Y** (A001-A203): accessible names → semantic elements → keyboard handlers → focus management → ARIA states → form errors → live regions
13. **Token Architecture** (T001/T101): refactor semantic raw hex to var() references, replace hardcoded component colors with token classes

### Context7 Research

Before framework-specific fixes, use Context7 for current API patterns:

- "[framework] image optimization"
- "[framework] metadata API"
- "[framework] sitemap generation"

### Per Fix

```
FIX: [Finding ID]
═════════════════════════════════════════════════════════════
Audit:  [Performance | SEO | AEO | A11Y | Responsive | Darkmode | Error states | Smoke | Flow]
Issue:  [description]
File:   [path]

Before: [code snippet]
After:  [code snippet]

Expected: [metric improvement]
═════════════════════════════════════════════════════════════
```

---

## PHASE 4: Re-audit & Completion

> **Todo**: mark PHASE 3 → `completed`, PHASE 4 → `in_progress`.

### 4.1 Re-scan

Re-run the selected audits to measure improvement:

- Lighthouse re-run (if performance selected)
- Re-capture viewports (if responsive selected)
- Re-check SEO/AEO findings
- Re-run A11Y static analysis (if a11y selected)
- Re-capture light + dark (if darkmode selected)
- Re-trigger 404/offline/slow-3G (if error-states selected)
- Re-run smoke loop over all routes (if smoke selected)
- Re-execute design.flows[] (if flow selected)

### 4.2 Before/After

```
BEFORE/AFTER
═════════════════════════════════════════════════════════════

Performance:
  Lighthouse: [before] → [after] ([+/-] pts)
  LCP: [before] → [after]
  CLS: [before] → [after]
  INP: [before] → [after]
  Bundle: [before] → [after]

SEO:
  Score: [before] → [after]
  Critical: [before] → [after]

AEO:
  Bot access: [before] → [after]
  Schema: [before] → [after]

Responsive:
  Overflow: [before] → [after]
  Touch violations: [before] → [after]

Token Architecture:
  CSS compliance: [before] → [after]
  Hardcoded colors: [before] → [after]

Resolved: [N]/[total] findings

═════════════════════════════════════════════════════════════
```

### 4.3 Backlog Completion Sync

If a backlog item was tagged as "testing" in PHASE 0:

1. Read `.project/backlog.html` → parse JSON
2. Find the feature → set `status: "DONE"`, remove `stage` field, `data.updated` to today
3. **If `f.type === "PAGE" || f.type === "COMPONENT"` (frontend track)**: also set `f.shipped = true` and `f.shippedAt = "{YYYY-MM-DD}"` (terminal — no refactor step for frontend cards). If the audit fixes triggered a git commit: also set `f.shippedSha = "{audit-commit-sha}"`. On a clean PASS without commit: omit `shippedSha`.
4. **If `targetType === "feature"`**: also add `audit` field to the feature:
   ```json
   {
     "lastRun": "{YYYY-MM-DD}",
     "scopes": ["{scope-list}"],
     "findings": { "critical": N, "warnings": N, "passed": N }
   }
   ```
5. Write back via Edit (keep `<script>` tags intact)
6. Sync to `project.json` `features[]`: merge feature with `status: "DONE"` (and `shipped: true` for PAGE/COMPONENT)

### 4.4 Completion Report

```
CHECK COMPLETE
═════════════════════════════════════════════════════════════

Checks run:    [Performance, SEO, AEO, Responsive, Darkmode, Error states, Smoke, Flow]
Findings:      [N] total → [N] resolved, [N] remaining
Files modified: [N]

Next steps:
  1. Test with real network throttling (Chrome DevTools)
  2. Monitor CWV in production (web-vitals library)
  3. Submit sitemap to Google Search Console
  4. Test AI visibility: search your content on Perplexity/ChatGPT
  5. Re-test flows after every major refactor (/frontend-check scope Flow)

═════════════════════════════════════════════════════════════
```

> **Todo**: mark PHASE 4 → `completed`.

---

## Restrictions

This skill must **NEVER**:

- Apply fixes without measuring first (always scan before fix)
- Run Lighthouse on dev mode when production scores are needed
- Apply memoization everywhere (only for measured re-render issues)
- Hide elements as responsive fix (unless intentional design choice)
- Skip before/after comparison
- Leave `.project/auth-state.json` behind after completion (contains session tokens)
- Continue flow scan after first fail (stop + screenshot + finding)

This skill must **ALWAYS**:

- Scan before fixing (measure → fix → re-measure)
- Tag CWV impact per performance finding
- Use Context7 for framework-specific optimization patterns
- Follow mobile-first approach for responsive fixes
- Follow rules from RULES.md (P-series, S-series, H-series, E-series, F-series)
- Update DevInfo at each phase transition
- Use Playwright for render validation (S003), responsive captures, smoke, flow and error states
- Clean up `.project/auth-state.json` at the end of every run where auth was used
