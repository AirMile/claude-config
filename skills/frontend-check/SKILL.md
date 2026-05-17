---
name: frontend-check
description: Check and fix performance, SEO, accessibility, and user flows. Use with /frontend-check.
argument-hint: "[url | source-path | feature-name] [--scope=performance|seo|aeo|responsive|a11y|...]"
reads:
  [backlog.status, feature.requirements, feature.files, feature.architecture]
writes: [backlog.status]
metadata:
  author: claude-config
  version: 2.3.0
  category: frontend
---

# Check

Unified check & fix hub for performance, SEO, AEO (AI search optimization), responsive design, darkmode, error states, smoke, and user flows. Scan on all axes, get a combined report, fix by priority, verify with before/after comparison.

**Related skills:** `/frontend-design` · `/frontend-tokens` · `/frontend-convert` · `/core-setup`

## References

- `../shared/BACKLOG.md` — Backlog HTML+JSON format, read/write protocol
- `../shared/CODING-RULES.md` — General (R009)
- `../shared/FRONTEND-RULES.md` — P-series (performance), A-series (accessibility), H-series (responsive/HTML), E-series, F-series
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

See `shared/BACKLOG.md → Lifecycle Protocol → Read`. Filter: `(type === "PAGE" || type === "COMPONENT") && transition === "auditing"` — if found, auto-select as task (show: `Backlog: ✓ Task picked up — {taskName}`).

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

> **Todo**: Read '.claude/skills/frontend-check/references/scan-a11y.md'

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

### 1.8 Smoke Scan + 1.9 Flow Scan

> **Todo**: Read '.claude/skills/frontend-check/references/scan-smoke-flow.md'

### 1.10 Token Architecture Scan + 1.11 Dark Mode Compliance + 1.12 Responsive Coverage

> **Todo**: Read '.claude/skills/frontend-check/references/scan-tokens-mode.md'

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

### Worktree setup (before fix)

Before writing any code fixes, follow `shared/WORKTREE.md → Auto-create worktree`:

- Feature-name = targeted feature (from `targetType === "feature"` argument, or the backlog feature matched in PHASE 0)
- If no feature match (URL/path targeting without backlog entry): skip worktree, fix on current branch
- If already in a worktree: skip (procedure detects)

---

## PHASE 3: Fix

> **Todo**: mark PHASE 2 → `completed`, PHASE 3 → `in_progress`.

> **Todo**: Read '.claude/skills/frontend-check/references/fix-reaudit.md'

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
- Follow rules from `shared/FRONTEND-RULES.md` (P-series, H-series, E-series, F-series, A-series)
- Update DevInfo at each phase transition
- Use Playwright for render validation (S003), responsive captures, smoke, flow and error states
- Clean up `.project/auth-state.json` at the end of every run where auth was used
