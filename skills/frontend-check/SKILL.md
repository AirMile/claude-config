---
name: frontend-check
description: >-
  Check and fix performance (Lighthouse, CWV, bundle), SEO (Google), AEO (AI search),
  responsive design (multi-viewport), darkmode, error states, smoke, and user flows
  in one unified hub. Use with /frontend-check.
argument-hint: "[url]"
disable-model-invocation: true
reads: [backlog.status]
writes: [backlog.status]
metadata:
  author: mileszeilstra
  version: 2.0.0
  category: frontend
---

# Check

Unified check & fix hub for performance, SEO, AEO (AI search optimization), responsive design, darkmode, error states, smoke, and user flows. Scan on all axes, get a combined report, fix by priority, verify with before/after comparison.

**Verwante skills:** `/frontend-design` · `/frontend-tokens` · `/frontend-convert` · `/frontend-install` · `/frontend-wcag`

## References

- `../shared/BACKLOG.md` — Backlog HTML+JSON format, read/write protocol
- `../shared/RULES.md` — P-series (performance), S-series (SEO), H-series (responsive/HTML)
- `../shared/DESIGN.md` — Anti-patterns (AI design tells), motion timing, interaction states
- `../shared/PLAYWRIGHT.md` — Playwright CLI: CWV measurement, multi-viewport captures, overflow detection
- `../shared/PATTERNS.md` — Code splitting, memoization patterns
- `../shared/DEVINFO.md` — Session tracking, cross-skill handoff

---

## FASE 0: Pre-flight

### 0.1 Target Selection

If `$1` provided → use as target URL.

If no argument:

```yaml
header: "Target"
question: "Wat wil je checken?"
options:
  - label: "Draaiende dev server (Recommended)", description: "Lighthouse + captures op dev server"
  - label: "Specifieke URL", description: "Geef een URL op"
  - label: "Production build", description: "Eerst builden, dan analyseren"
  - label: "Snelle smoke check", description: "Alleen health check — alle routes in < 2 min"
multiSelect: false
```

If "Snelle smoke check" → set scope = [Smoke] en skip FASE 0.2.

### 0.2 Scope Selection

```yaml
header: "Scope"
question: "Welke checks wil je draaien?"
options:
  - label: "Alles (Recommended)", description: "Performance + SEO + AEO + Responsive + Darkmode + Error states + Smoke + Flow"
  - label: "Ik kies zelf", description: "Selecteer specifieke checks"
multiSelect: false
```

If "Ik kies zelf":

```yaml
header: "Checks"
question: "Welke checks?"
options:
  - label: "Performance", description: "Lighthouse, CWV, bundle sizes"
  - label: "SEO", description: "Google search optimization"
  - label: "AEO", description: "AI search optimization (ChatGPT, Perplexity, Gemini)"
  - label: "Responsive", description: "Multi-viewport layout audit"
  - label: "Darkmode", description: "Light + dark vergelijking, contrast, missende variants"
  - label: "Error states", description: "404, offline, slow-3G UI rendering"
  - label: "Smoke", description: "Snelle multi-route health check (200 + render + geen errors)"
  - label: "Flow", description: "Execute design.flows[] uit project.json (navigatie-journeys)"
multiSelect: true
```

### 0.2.5 Scope Validatie

Als scope bevat **Flow**:

- Lees `.project/project.json → design.flows`
- Als flows ontbreekt of leeg → stop met melding:
  > "Geen flows gedefinieerd in `design.flows[]`. Run `/frontend-design` eerst om flows toe te voegen, dan opnieuw `/frontend-check scope Flow`."
- Als flows niet-leeg → doorgaan.

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

Filter features with `status === "DOING" && stage === "built"` — these are ready for audit.

Match the target URL/page against backlog items (best-effort: match page name from URL path to feature name).

If match found: set `stage: "testing"`, `data.updated` to today. Write back via Edit (keep `<script>` tags intact).

If no match or no backlog: skip (audit can run on non-backlog pages too).

**Note:** voor scope `Smoke` of `Flow` (cross-cutting checks): skip per-feature matching. Markeer geen specifiek backlog item als `testing`. De checks draaien project-breed; rapporteer findings algemeen.

---

## FASE 1: Scan

Run all selected checks. Each produces findings with severity + category.

### 1.0 Auth Setup (optioneel)

Als scope bevat Flow, Smoke of Darkmode:

```yaml
header: "Auth"
question: "Vereist een of meerdere checks login?"
options:
  - label: "Geen auth nodig (Recommended)", description: "Alle checks op publieke routes"
  - label: "Login eerst", description: "state-save flow — hergebruikt voor alle checks"
multiSelect: false
```

Als "Login eerst" → voer auth setup uit (zie `../shared/PLAYWRIGHT.md` → Use Cases: Auth State Persistence):

```
playwright-cli open [login-url]
playwright-cli snapshot                              ← refs ophalen
playwright-cli fill [email-ref] "[email]"
playwright-cli fill [password-ref] "[password]"
playwright-cli click [submit-ref]
playwright-cli run-code "async p => { await p.waitForLoadState('networkidle'); }"
playwright-cli state-save .project/auth-state.json
```

Auth state wordt hergebruikt voor alle volgende checks. **Cleanup** `.project/auth-state.json` altijd aan einde van FASE 4.

### 1.1 Performance Scan

**Lighthouse** (primary, if available):

```bash
npx lighthouse {url} --output json --chrome-flags="--headless --no-sandbox" --only-categories=performance,best-practices
```

Extract: Performance score, LCP, CLS, INP, FCP, TTFB, opportunities.

**Fallback**: Playwright CLI CWV via PerformanceObserver (see `PLAYWRIGHT.md` → Use Cases: Performance Measurement).

**Network inspection** (Playwright CLI, see `PLAYWRIGHT.md` → Use Cases: Network Inspection):

```
playwright-cli goto {url}
playwright-cli run-code "async p => { await p.waitForLoadState('networkidle'); }"
playwright-cli requests
```

Parse de request-lijst → findings:

- **P005 (CRITICAL)**: failed requests (status 4xx/5xx) — gebruiker krijgt broken page-states
- **P108 (HIGH)**: payloads > 500KB — `request <i>` voor details, candidate voor compression/code-splitting
- **P109 (HIGH)**: missing cache headers op static assets — `response-headers <i>` → check `cache-control`/`etag`

**Runtime errors** (Playwright CLI, see `PLAYWRIGHT.md` → Use Cases: Console Error Inspection):

```
playwright-cli console error
```

→ Filter output tegen PLAYWRIGHT.md → Default Ignore Patterns vóór rapportage; alleen niet-gefilterde regels worden findings.

Elke error = nieuwe finding **P004 (CRITICAL)** "JS Runtime Error" met locatie + message. Een crashende component is een blokkerende bug, ook als Lighthouse-score hoog is.

**Bundle analysis** (if build script available):

`npm run build` → parse output for chunk sizes per route.

**Static code audit**: Scan for images without lazy loading, full library imports, render-blocking CSS, missing font preloading, sync third-party scripts.

### 1.2 SEO Scan

Per route, check:

**Critical:** Page titles (S001), meta descriptions (S002), rendering (S003 — Playwright CLI validate SSR via snapshot **+ content-endpoint check via `requests`/`request <i>` om te bewijzen dat content niet uit een fallback komt door een falende API**), robots config (S004).

**Important:** Open Graph (S101), canonical URLs (S102), sitemap (S103), robots.txt (S104), heading hierarchy (H002/H003), image alt text (R002).

**Enhancement:** Structured data / JSON-LD (S201), Twitter cards (S202), dynamic OG images (S203).

Use Context7 to research framework-specific SEO APIs before recommending fixes.

### 1.3 AEO Scan (AI Search Optimization)

Optimize for AI answer engines (ChatGPT Search, Perplexity, Google AI Overviews, Gemini).

**Crawlability:**

- A001: AI bot access — check robots.txt for ChatGPT-User, PerplexityBot, Google-Extended, Anthropic
- A002: Structured content — semantic HTML (article, section, aside, nav) vs div soup
- A003: Clear content hierarchy — H1 → H2 → H3 with logical grouping

**Answerability:**

- A101: FAQ sections — question-answer pairs that AI can extract
- A102: FAQ Schema (FAQPage JSON-LD) — structured data for Q&A
- A103: HowTo Schema — step-by-step instructions as JSON-LD
- A104: Concise definitions — key terms defined in first paragraph or summary
- A105: TL;DR / summary sections — scannable summaries at top of content

**Citations:**

- A201: Author/source attribution — bylines, credentials, publication dates
- A202: Data citations — sources for statistics, claims, quotes
- A203: About page / E-E-A-T signals — expertise, experience, authority, trust

**Freshness:**

- A301: Last-modified headers / dateModified in schema
- A302: Content timestamps visible on page
- A303: Changelog / update history for evergreen content

### 1.4 Responsive Scan

Capture on 6 viewports (320, 375, 768, 1024, 1440, 1920) using Playwright CLI (see `PLAYWRIGHT.md` → Use Cases: Responsive Validation):

```
playwright-cli open [url]
Per viewport: playwright-cli resize [vp] 900
             → playwright-cli run-code "async page => { await page.waitForTimeout(1000); }"
             → playwright-cli screenshot --filename=.project/screenshots/vp[vp].png
             → playwright-cli snapshot --filename=.project/snapshots/vp[vp].yml  (alleen bij findings)
             → playwright-cli eval "[overflow-script]"
playwright-cli close
```

Analyze: horizontal overflow, touch targets < 44px, truncated text, layout breaks, font size < 16px on mobile, missing viewport meta.

### 1.5 Darkmode Scan

Capture light + dark op de primaire route via `colorScheme`:

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

Vergelijk de twee screenshots + eval voor CSS custom properties:

```js
// playwright-cli eval
() => ({
  hasDarkClass: document.documentElement.classList.contains("dark"),
  colorScheme: getComputedStyle(document.documentElement).colorScheme,
  bgColor: getComputedStyle(document.body).backgroundColor,
});
```

Findings:

- **D001 (CRITICAL)**: dark mode toggle aanwezig maar screenshots zijn identiek — geen dark variant geïmplementeerd
- **D101 (HIGH)**: hardcoded color values die niet switchen (re-use H004 patroon — scan source)
- **D102 (HIGH)**: contrast in dark mode onder WCAG 4.5:1 threshold

### 1.6 Error States Scan

Test hoe de app reageert op fout-scenarios:

```
1. 404: playwright-cli goto {url}/this-route-does-not-exist-404test
          playwright-cli snapshot + screenshot → check of app-404 rendert (niet browser-default)

2. Offline: playwright-cli run-code "async page => {
     await page.context().setOffline(true);
     await page.reload();
     await page.waitForTimeout(2000);
     await page.screenshot({ path: '.project/screenshots/offline.png' });
     await page.context().setOffline(false);
   }"
   → snapshot → check of offline-UI rendert

3. Slow 3G: playwright-cli run-code "async page => {
     await page.context().route('**/*', async route => {
       await new Promise(r => setTimeout(r, 1500));
       await route.continue();
     });
     await page.goto('{url}');
     await page.screenshot({ path: '.project/screenshots/slow-3g.png' });
   }"
   → check of loading skeleton / spinner zichtbaar is
```

Findings:

- **E001 (CRITICAL)**: 404-pagina toont browser-default error (geen custom 404)
- **E002 (CRITICAL)**: offline UI ontbreekt — blanco pagina of JavaScript crash
- **E101 (HIGH)**: geen loading skeleton bij slow connection — FOUC of leeg scherm
- **E102 (HIGH)**: error-pagina zonder navigatie terug naar home

### 1.7 Smoke Scan

Lichtgewicht health check over alle routes. Lees routes in volgorde van precedence:

1. `project.json → context.routing`
2. `design.pages[].name` als routing ontbreekt
3. **Fallback** als beide ontbreken: alleen `/` (de target URL) checken + warn user: "Geen routes-lijst gevonden — alleen entry URL gecheckt. Run `/frontend-design` of vul `project.json → context.routing` om alle routes te smoken."

Per route:

```
playwright-cli goto [route]
playwright-cli run-code "async p => { await p.waitForLoadState('networkidle'); }"
playwright-cli console error
→ Filter output tegen PLAYWRIGHT.md → Default Ignore Patterns vóór rapportage; alleen niet-gefilterde regels worden findings.
playwright-cli requests
→ Check: geen status 4xx/5xx
```

Output per route:

```
[route]  [status: ✓ OK | ✗ FAIL]  [errors: N]  [failed-requests: N]
```

Findings re-use P004 (runtime errors), P005 (failed requests). Geen nieuwe IDs.

Smoke tabel eindrapport:

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

### 1.8 Flow Scan

Lees `.project/project.json → design.flows[]`. Per flow:

1. Map elke step (page name) → URL via `project.json → context.routing`
   - Als geen mapping gevonden: finding F002 + skip step
2. Per step:
   ```
   playwright-cli goto [url]
   playwright-cli run-code "async p => { await p.waitForLoadState('networkidle'); }"
   playwright-cli console error
   → Filter tegen PLAYWRIGHT.md → Default Ignore Patterns
   playwright-cli screenshot --filename=.project/screenshots/flow-[name]-step[N].png
   ```
3. **Stop bij eerste fail** + screenshot van break-point als finding F001
4. Als auth geconfigureerd in 1.0: gebruik `state-load .project/auth-state.json` vóór eerste goto

Findings:

- **F001 (CRITICAL)**: flow brak bij stap N — [reason: 404 / runtime error / content niet gerenderd]
- **F002 (HIGH)**: step-pagina niet gemapped in routing — page name `X` onbekend in context.routing

Flow output per stap:

```
FLOW: [flow-name]
─────────────────
Step 1 [page-name] → [url]  ✓ OK  [screenshot]
Step 2 [page-name] → [url]  ✗ FAIL — runtime error: "Cannot read properties of undefined"
→ STOPPED (first fail)
```

**Constraint v1:** flow voert alleen navigatie uit (geen click-interacties binnen pages). Interactie-stappen vereisen `design.flows[].steps` verrijking met action-data — buiten scope v1.

### 1.9 Finding Format (all checks)

```
FINDING: [ID]
─────────────
Check:    [Performance | SEO | AEO | Responsive | Darkmode | Error states | Smoke | Flow]
Severity: [CRITICAL | HIGH | MEDIUM]
Rule:     [P001 | S001 | D001 | E001 | F001 | etc.]
Impact:   [CWV metric | search visibility | AI citability | viewport | UX]
File:     [path:line | route]
Issue:    [description]
Fix:      [suggestion]
```

---

## FASE 2: Report

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
question: "Welke issues wil je fixen?"
options:
  - label: "Alle CRITICAL + HIGH (Recommended)", description: "[N] fixes met grootste impact"
  - label: "Alleen CRITICAL", description: "[N] fixes, snelle wins"
  - label: "Alles", description: "[N] fixes totaal"
  - label: "Ik kies zelf", description: "Selecteer specifieke findings"
multiSelect: false
```

---

## FASE 3: Fix

Implement fixes in priority order, grouped by audit category.

### Fix Order

1. **JS Runtime Errors** (P004): uncaught exceptions maken CWV-metingen onbetrouwbaar en breken de pagina functioneel
2. **Failed network requests** (P005): 4xx/5xx op kritieke endpoints → broken page-states
3. **Flow breakage** (F001): een gebroken user-journey is erger dan visuele issues
4. **Error states** (E001/E002): broken 404/offline UX — geen fallback = crash voor gebruiker
5. **Responsive**: overflow + touch targets (breaks usability)
6. **Performance**: CLS → LCP → INP → bundle (CWV impact)
7. **Darkmode** (D001): visuele volledigheid, geen regressie in kleur/contrast
8. **SEO**: titles → descriptions → sitemap → robots → structured data
9. **AEO**: semantic HTML → FAQ schema → bot access → E-E-A-T

### Context7 Research

Before framework-specific fixes, use Context7 for current API patterns:

- "[framework] image optimization"
- "[framework] metadata API"
- "[framework] sitemap generation"

### Per Fix

```
FIX: [Finding ID]
═════════════════════════════════════════════════════════════
Audit:  [Performance | SEO | AEO | Responsive | Darkmode | Error states | Smoke | Flow]
Issue:  [description]
File:   [path]

Before: [code snippet]
After:  [code snippet]

Expected: [metric improvement]
═════════════════════════════════════════════════════════════
```

---

## FASE 4: Re-audit & Completion

### 4.1 Re-scan

Re-run the selected audits to measure improvement:

- Lighthouse re-run (if performance selected)
- Re-capture viewports (if responsive selected)
- Re-check SEO/AEO findings
- Re-capture light + dark (if darkmode selected)
- Re-trigger 404/offline/slow-3G (if error-states selected)
- Re-run smoke loop over alle routes (if smoke selected)
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

Resolved: [N]/[total] findings

═════════════════════════════════════════════════════════════
```

### 4.3 Backlog Completion Sync

If a backlog item was tagged as "testing" in FASE 0:

1. Read `.project/backlog.html` → parse JSON
2. Find the feature → set `status: "DONE"`, remove `stage` field, `data.updated` to today
3. Write back via Edit (keep `<script>` tags intact)
4. Sync to `project.json` `features[]`: merge feature with `status: "DONE"`

### 4.4 Completion Report

```
CHECK COMPLETE
═════════════════════════════════════════════════════════════

Checks run:    [Performance, SEO, AEO, Responsive, Darkmode, Error states, Smoke, Flow]
Findings:      [N] total → [N] resolved, [N] remaining
Files modified: [N]

Next steps:
  1. Test met echte netwerk throttling (Chrome DevTools)
  2. Monitor CWV in productie (web-vitals library)
  3. Submit sitemap to Google Search Console
  4. Test AI visibility: search your content on Perplexity/ChatGPT
  5. Test flows opnieuw na elke grote refactor (/frontend-check scope Flow)

═════════════════════════════════════════════════════════════
```

---

## Restrictions

This skill must **NEVER**:

- Apply fixes without measuring first (always scan before fix)
- Run Lighthouse on dev mode when production scores are needed
- Apply memoization everywhere (only for measured re-render issues)
- Hide elements as responsive fix (unless intentional design choice)
- Skip before/after comparison
- Laat `.project/auth-state.json` achter na afloop (bevat session tokens)
- Flow-scan doorzetten na eerste fail (stop + screenshot + finding)

This skill must **ALWAYS**:

- Scan before fixing (measure → fix → re-measure)
- Tag CWV impact per performance finding
- Use Context7 for framework-specific optimization patterns
- Follow mobile-first approach for responsive fixes
- Follow rules from RULES.md (P-series, S-series, H-series, E-series, F-series)
- Update DevInfo at each phase transition
- Use Playwright for render validation (S003), responsive captures, smoke, flow en error states
- Cleanup `.project/auth-state.json` aan einde van elke run als auth gebruikt is
