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

**Verwante skills:** `/frontend-design` · `/frontend-tokens` · `/frontend-convert` · `/core-setup`

## References

- `../shared/BACKLOG.md` — Backlog HTML+JSON format, read/write protocol
- `../shared/RULES.md` — Algemeen (R009), P-series (performance), S-series (SEO), A-series (accessibility), H-series (responsive/HTML)
- `../shared/DESIGN.md` — Anti-patterns (AI design tells), motion timing, interaction states
- `../shared/PLAYWRIGHT.md` — Playwright CLI: CWV measurement, multi-viewport captures, overflow detection
- `../shared/PATTERNS.md` — Code splitting, memoization patterns
- `../shared/DEVINFO.md` — Session tracking, cross-skill handoff

---

## Process

**Fase tracking** — eerste actie van de skill: roep `TaskCreate` aan met deze 5 items (status `pending`), daarna gebruik `TaskUpdate` om per fase `in_progress` te zetten aan begin en `completed` aan einde. Bij context compaction blijft de task list zichtbaar — geen risico op vergeten fases.

1. FASE 0: Pre-flight
2. FASE 1: Scan
3. FASE 2: Report
4. FASE 3: Fix
5. FASE 4: Re-audit & Completion

## FASE 0: Pre-flight

> **Todo**: roep `TaskCreate` aan met de 5 fase-items (zie boven). Markeer FASE 0 → `in_progress` via `TaskUpdate`.

### 0.1 Target Selection

Detecteer input-type via vaste volgorde:

**1. URL** — `$1` start met `http://` of `https://` → `targetType = "url"`, `urlTarget = $1`

**2. Feature-name** — `$1` heeft geen pad-separator (`/` of `\`) én geen extensie, én komt voor in `.project/backlog.html#data.features[].name`:

- Lees `.project/features/{$1}/feature.json`
- Als niet gevonden → fallback naar stap 3 (source-path)
- `targetType = "feature"`, `featureName = $1`
- Bouw targets:
  - `routeTargets = feature.json#architecture.routes[].path` — resolven naar volledige URLs via dev-server base (lees uit `project.json#devServer` of default `http://localhost:3000`)
  - `fileTargets = feature.json#files[].path` — component/page bestanden voor statische scopes
- Toon bevestiging:
  ```
  FEATURE TARGET: {featureName}
  Routes: {N} ({route-lijst})
  Files:  {N} ({file-lijst})
  ```

**3. Source-path** — `$1` heeft pad-separator of extensie, geen http-prefix → `targetType = "path"`, `fileTargets = [$1]`

**4. Geen argument** → AskUserQuestion:

```yaml
header: "Target"
question: "Wat wil je checken?"
options:
  - label: "Draaiende dev server (Recommended)", description: "Lighthouse + captures op dev server"
  - label: "Specifieke URL", description: "Geef een URL op"
  - label: "Feature", description: "Audit een specifieke feature — auto-scope op files[] + routes[]"
  - label: "Production build", description: "Eerst builden, dan analyseren"
  - label: "Snelle smoke check", description: "Alleen health check — alle routes in < 2 min"
multiSelect: false
```

- "Snelle smoke check" → `scope = [Smoke]`, skip FASE 0.2
- "Feature" → AskUserQuestion (vrije tekst): "Welke feature? (kebab-case naam)" → feature-target flow van stap 2

### 0.2 Scope Selection

**Auto-scope** — als `targetType` bekend is, detecteer de optimale scope en bevestig eerst:

| Target-type             | Auto-scope                                                                                               |
| ----------------------- | -------------------------------------------------------------------------------------------------------- |
| `url`                   | Performance + SEO + AEO + Responsive + Darkmode                                                          |
| `path` (component)      | A11Y + Token Architecture + Dark mode compliance                                                         |
| `feature` met routes    | Performance + SEO + AEO + Responsive + Darkmode + A11Y (over routes) + Token Architecture (over files[]) |
| `feature` zonder routes | A11Y + Token Architecture + Dark mode compliance (over files[])                                          |

Als `targetType` is `url`, `path`, of `feature` → toon auto-scope bevestiging:

```yaml
header: "Scope"
question: "Auto-scope: {detected-scopes}. Doorgaan of aanpassen?"
options:
  - label: "Ga door (Recommended)"
    description: "Gebruik gedetecteerde scope"
  - label: "Aanpassen"
    description: "Kies handmatig welke checks"
multiSelect: false
```

"Aanpassen" of geen arg (handmatig target) → volledige scope-selectie:

```yaml
header: "Scope"
question: "Welke checks wil je draaien?"
options:
  - label: "Alles (Recommended)", description: "Performance + SEO + AEO + A11Y + Responsive + Darkmode + Error states + Smoke + Flow + Token Architecture + Dark mode compliance + Responsive coverage"
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
  - label: "A11Y", description: "Accessibility audit (WCAG 2.1 AA) — statische scan + optioneel Playwright"
  - label: "Responsive", description: "Multi-viewport layout audit"
  - label: "Darkmode", description: "Light + dark vergelijking, contrast, missende variants"
  - label: "Error states", description: "404, offline, slow-3G UI rendering"
  - label: "Smoke", description: "Snelle multi-route health check (200 + render + geen errors)"
  - label: "Flow", description: "Execute design.flows[] uit project.json (navigatie-journeys)"
  - label: "Token Architecture", description: "Audit design token gebruik — semantic var() refs, hardcoded kleuren"
  - label: "Dark mode compliance", description: "Statische code audit — dark: classes aanwezig waar dark mode geconfigureerd is"
  - label: "Responsive coverage", description: "Statische code audit — responsive prefixes aanwezig bij multi-viewport componenten"
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

**Als `targetType === "feature"`**: direct matchen op `featureName` (geen URL-matching). Zoek `data.features.find(f => f.name === featureName)` → zet `stage: "testing"`, `data.updated` to today. Write back.

**Alle andere target-types**: filter features with `status === "DOING" && stage === "built"`. Match target URL/page against backlog items (best-effort: match page name from URL path to feature name). If match found: set `stage: "testing"`, `data.updated` to today. Write back via Edit (keep `<script>` tags intact).

If no match or no backlog: skip (audit can run on non-backlog pages too).

**Note:** voor scope `Smoke` of `Flow` (cross-cutting checks): skip per-feature matching. Markeer geen specifiek backlog item als `testing`. De checks draaien project-breed; rapporteer findings algemeen.

---

## FASE 1: Scan

> **Todo**: markeer FASE 0 → `completed`, FASE 1 → `in_progress`.

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

Alleen als scope "A11Y" geselecteerd is. Als argument een source-path was → gebruik als scan scope. Anders: project-wide scan.

**Stack detection (snel):** detecteer framework, component library, bestaande a11y setup (eslint-plugin-jsx-a11y, axe-core, @testing-library).

**Multi-route live check (optioneel):** als `.project/project.json → context.routing` routes bevat, bied dan aan om de live check over alle routes te draaien:

```yaml
header: "Live scope"
question: "context.routing bevat {N} routes. Wil je de live check over alle routes draaien?"
options:
  - label: "Ja, alle routes (Recommended)", description: "Live check per route uit context.routing"
  - label: "Nee, alleen entry URL", description: "Sneller — alleen de hoofdpagina"
multiSelect: false
```

Als "Alle routes": sla routing-lijst op als `a11y_live_routes`. Als "Entry URL" of geen routing: `a11y_live_routes = [target URL]`.

#### Static Analysis (always runs)

Scan source files (scope of project-wide) georganiseerd naar prioriteit:

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
question: "Wil je ook een browser-based check uitvoeren? (vereist draaiende dev server)"
options:
  - label: "Ja, met Playwright (Recommended)"
    description: "Check accessibility tree, focus order, ARIA in browser"
  - label: "Nee, alleen static analysis"
    description: "Sneller, maar minder compleet"
```

Als ja:

```
LIVE CHECK (Playwright CLI)
═══════════════════════════════════════════════════

Dev server: [http://localhost:3000]
Routes:     [a11y_live_routes — 1 of meerdere]

Per route in a11y_live_routes:
1. playwright-cli open [url]
2. playwright-cli snapshot
3. playwright-cli console warning
   → Filter output tegen PLAYWRIGHT.md → Default Ignore Patterns vóór rapportage
4. playwright-cli close
5. Log: [route] → [N] findings

Parse snapshot voor:
[ ] All interactive elements have accessible names
[ ] Heading hierarchy correct (H002/H003)
[ ] Form inputs have labels
[ ] No orphaned ARIA roles

Parse console output voor:
[ ] React a11y warnings
[ ] axe-core / @axe-core/react warnings (als geïnstalleerd)
[ ] Library-specific a11y notices (Radix, Headless UI)

═══════════════════════════════════════════════════
```

**Emulatie passes (C4 — daemon):** draai per route twee extra contexts voor motion en contrast.

```
EMULATIE PASSES (Playwright CLI)
────────────────────────────────
Per route in a11y_live_routes:

  prefers-reduced-motion:
  1. playwright-cli run-code "const ctx = await browser.newContext({ reducedMotion: 'reduce' }); const p = await ctx.newPage(); await p.goto('{url}'); await p.waitForLoadState('networkidle');"
  2. playwright-cli snapshot
     → Controleer: geen auto-play animaties, geen oneindige CSS-transitions zichtbaar in tree
  3. playwright-cli screenshot .project/playwright-runs/a11y-{route-slug}-reduced-motion.png

  forced-colors (Windows High Contrast):
  1. playwright-cli run-code "const ctx = await browser.newContext({ forcedColors: 'active' }); const p = await ctx.newPage(); await p.goto('{url}'); await p.waitForLoadState('networkidle');"
  2. playwright-cli screenshot .project/playwright-runs/a11y-{route-slug}-forced-colors.png
     → Visueel: iconen/borders zichtbaar? Geen white-on-white of black-on-black?
```

**Aria-snapshot runner-pad (C3):** maak een baseline van de accessibility tree per route. Faalt bij regressie in volgende runs.

Genereer `.project/playwright-runs/a11y-check-{slug}.spec.ts`:

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

Genereer `.project/playwright-runs/playwright.config.ts` (zie `shared/PLAYWRIGHT.md → Runner Mode`).

Eerste run: `npx playwright test .project/playwright-runs/a11y-check-{slug}.spec.ts --update-snapshots`
→ Baseline aangemaakt in `.project/playwright-runs/__screenshots__/`

Volgende runs: zonder `--update-snapshots` → FAIL bij structurele a11y-regressie (verdwenen landmarks, gewijzigde heading-hiërarchie).

Bij FAIL: `npx playwright show-trace .project/playwright-runs/test-results/aria-snapshot-*/trace.zip`

**Focus Management Test** (alleen als statische scan modal/dialog gevonden heeft):

```
FOCUS MANAGEMENT TEST (per modal/dialog)
────────────────────────────────────────
Per dialog:
1. playwright-cli snapshot
2. playwright-cli click [trigger-ref]
3. playwright-cli snapshot
   → A003: is focus binnen modal-bounds?
4. playwright-cli press Tab (×5)
   playwright-cli snapshot
   → A003: blijft focus binnen modal?
5. playwright-cli press Escape
6. playwright-cli snapshot
   → A004: is focus terug op de trigger?

Output per dialog:
  A003 Focus trap: [PASS | FAIL — focus escape naar [element] na N tabs]
  A004 Focus restoration: [PASS | FAIL — focus op [element] i.p.v. trigger]
```

**Full Keyboard Test** (optioneel, op verzoek):

```yaml
header: "Keyboard test"
question: "Wil je ook een full-page keyboard navigation test draaien?"
options:
  - label: "Nee, alleen modal focus test (Recommended)", description: "Sneller — test alleen modals"
  - label: "Ja, volledige keyboard check", description: "Tab door hele pagina — duurt langer"
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

#### Fix-instructies per rule

**A001** — Icon-only button: `<button aria-label="Close">...</button>`. Image: `<img alt="description" />`.
**A002** — div-as-button: vervang door `<button>`, of voeg `role="button"`, `tabIndex={0}`, `onKeyDown` (Enter/Space) toe.
**A003** — Focus trap: gebruik native `<dialog>`, `FocusTrap` uit Headless UI/Radix, of implementeer tab-cycling.
**A004** — Focus restoration: sla trigger-ref op vóór open (`triggerRef.current.focus()` bij close).
**A005** — Focus indicator: vervang `outline-none` door `focus-visible:ring-2` of equivalent.
**A006** — ARIA state sync: bind `aria-expanded`, `aria-selected`, `aria-pressed` aan component state.
**R001** — Semantic elements: vervang `<div onClick>` door `<button>`, `<a href>` door `<Link>`.
**R004** — Form labels: voeg `<label htmlFor="id">` toe of gebruik wrapping label.
**R005** — Keyboard handlers: voeg `onKeyDown` toe voor Enter/Space op custom interactive elements.
**A101** — Error linkage: voeg `aria-describedby="error-id"` toe op input.
**A102** — Required: voeg `aria-required="true"` toe op verplichte inputs.
**A103** — Live region: wrap dynamische errors in `<div aria-live="polite">`.
**A104** — Loading: voeg `aria-busy="true"` toe op laadcontainers.
**A201** — tabindex: vervang `tabIndex={N}` (N > 0) door logische DOM-volgorde.

### 1.5 Responsive Scan

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

### 1.6 Darkmode Scan

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

### 1.7 Error States Scan

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

### 1.8 Smoke Scan

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

### 1.9 Flow Scan

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

**Codegen-optie voor flows met interactie:**

Als flow-stappen interactie vereisen (klik, fill, etc.) die verder gaan dan navigatie:

```yaml
header: "Flow interacties"
question: "Flow '{name}' kan interactie-stappen hebben. Hoe aanpakken?"
options:
  - label: "Genereer spec via codegen (Recommended)"
    description: "npx playwright codegen {url} — navigeer de flow zelf, Playwright legt op als spec in .project/playwright-runs/flow-{name}.spec.ts"
  - label: "Alleen navigatie (v1)"
    description: "Voer alleen goto-stappen uit — klikken en fills worden overgeslagen"
  - label: "Handmatig lopen"
    description: "Ik loop de flow zelf en geef feedback via FASE 2 manual walkthrough"
multiSelect: false
```

Als "codegen gekozen": instrueer user om `npx playwright codegen {base_url}` in een aparte terminal te draaien en de flow te navigeren. Sla gegenereerde spec op als `.project/playwright-runs/flow-{name}.spec.ts`. Draai daarna via runner: `npx playwright test .project/playwright-runs/flow-{name}.spec.ts --config=.project/playwright-runs/playwright.config.ts --trace on`.

**Trace bij Flow-failure (F001):**

Als runner-spec gedraaid: trace automatisch beschikbaar. Voeg toe aan F001-finding:

```
Trace: npx playwright show-trace .project/playwright-runs/test-results/flow-{name}-*/trace.zip
```

Als daemon-only: voeg in rapport toe: `"Herhaal met codegen → runner voor interactieve debug-timeline"`.

**Constraint v1:** flow voert alleen navigatie uit (geen click-interacties binnen pages) tenzij codegen-optie gekozen. Interactie-stappen vereisen `design.flows[].steps` verrijking met action-data voor volledig script zonder codegen.

### 1.10 Token Architecture Scan

Alleen als "Token Architecture" geselecteerd is. Statische code-analyse — geen Playwright vereist.

**Stap 1: Project.json check**

```bash
# Read .project/project.json → check theme.colors.semantic[]
```

Als `project.json` ontbreekt of `theme` leeg is: stop scan met melding `"Geen design tokens gevonden in project.json — Token Architecture scan niet uitvoerbaar. Run /frontend-tokens eerst."` Als `theme.colors.semantic[]` aanwezig: sla op als `$SEMANTIC_TOKENS`.

**Stap 2: CSS files scannen op semantic raw hex**

Grep CSS files (`.css`, `.scss`, globals, theme.css) voor semantic token-namen met raw hex waarden:

```bash
# Voor elke token in $SEMANTIC_TOKENS:
# grep -n "--color-{token}:\s*#\|--color-{token}:\s*oklch\|--color-{token}:\s*rgb"
```

- **T001 (HIGH)**: semantic CSS variabele heeft raw hex i.p.v. `var()` referentie
  `"--color-{token}: {raw-waarde} — gebruik var(--color-{nearest-primitive})"`

**Stap 3: Component files scannen op hardcoded kleuren**

Grep `src/**/*.{tsx,jsx,astro,vue}` voor hardcoded kleurwaarden die token systeem bypassen:

- Arbitraire Tailwind: `bg-[#hex]`, `text-[#hex]`, `border-[#hex]`
- Inline styles: `style={{ color: '#hex', background: '#hex' }}`

- **T101 (MEDIUM)**: hardcoded kleurwaarde in component
  `"{file}:{line} — {patroon}: gebruik var(--color-{nearest-token}) of theme class"`
  Alleen rapporteren als `project.json` een gevuld theme heeft.

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

Check `theme.modes.dark` in `.project/project.json`. Als ontbreekt: skip met melding `"Dark mode niet geconfigureerd — scan niet van toepassing."`.

Scan alle `.tsx`, `.jsx`, `.vue` component files:

1. Grep op Tailwind kleurclasses: `bg-[a-z]`, `text-[a-z]`, `border-[a-z]`
   (Exclude: `bg-transparent`, `bg-inherit`, `text-inherit`, `text-current`, `border-transparent`)
2. Check per kleurclass of een `dark:` tegenhanger aanwezig is op hetzelfde element
3. Scan ook op inline `style={{ color: ..., background: ... }}` waarden

**Skip** als component uitsluitend CSS vars gebruikt (`var(--color-*)`, `var(--background)`, etc.) — die zijn al dark-mode-aware via het theme.

**Findings:**

- DC001 (MEDIUM): kleurclass zonder `dark:` tegenhanger
  → `{component}: {className} — verwacht dark:{alternatief}`
- DC002 (LOW): component bevat kleurclasses, geen enkele `dark:` prefix aanwezig
  → `{component}: 0 dark: classes gevonden (N kleurclasses zonder dark variant)`

**Dark Mode Compliance Check Output:**

```
DARK MODE COMPLIANCE
  Dark mode configured: [yes | no — scan overgeslagen]
  Components checked:   [N]
  Missing dark: classes:[N components | clean]
  Findings: [N] (M:[N] L:[N])
```

---

### 1.12 Responsive Coverage Scan

Check of project multi-viewport context heeft: `theme.breakpoints` in project.json OF `tailwind.config` definieert custom screens. Als ontbreekt: skip met melding `"Geen multi-viewport context — scan niet van toepassing."`.

Scan alle `.tsx`, `.jsx`, `.vue` component files:

1. Grep op layout-classes zonder responsive prefix: `flex`, `grid`, `hidden`, `block`, `w-full`, `columns-`, `gap-[0-9]`, `p-[0-9]`, `px-[0-9]`, `py-[0-9]`
2. Check of het component ≥1 responsive prefix gebruikt (`sm:`, `md:`, `lg:`, `xl:`, `2xl:`)
3. Flag layout-zware components (≥5 layout-classes) zonder enige responsive variant

**Findings:**

- RC001 (MEDIUM): layout-classes aanwezig maar geen responsive prefixes
  → `{component}: {N} layout-classes, 0 responsive prefixes — kandidaat voor responsive aanpassing`
- RC002 (LOW): spacing/typography zonder responsive variant in layout-zwaar component
  → `{component}: {className} — overweeg md: of lg: variant voor leesbaarheid`

**Responsive Coverage Check Output:**

```
RESPONSIVE COVERAGE
  Multi-viewport context:[yes | no — scan overgeslagen]
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

## FASE 2: Report

> **Todo**: markeer FASE 1 → `completed`, FASE 2 → `in_progress`.

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
  Token source:     [project.json theme (N semantic tokens) | niet beschikbaar]
  CSS compliance:   [N/N semantic tokens correct | N violations]
  Hardcoded colors: [N components | clean]
  Findings: [N] (H:[N] M:[N])

DARK MODE COMPLIANCE
  Dark mode configured: [yes | no — scan overgeslagen]
  Components checked:   [N]
  Missing dark: classes:[N components | clean]
  Findings: [N] (M:[N] L:[N])

RESPONSIVE COVERAGE
  Multi-viewport context:[yes | no — scan overgeslagen]
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

> **Todo**: markeer FASE 2 → `completed`, FASE 3 → `in_progress`.

Implement fixes in priority order, grouped by audit category.

### Fix Order

1. **JS Runtime Errors** (P004): uncaught exceptions maken CWV-metingen onbetrouwbaar en breken de pagina functioneel
2. **Failed network requests** (P005): 4xx/5xx op kritieke endpoints → broken page-states
3. **Flow breakage** (F001): een gebroken user-journey is erger dan visuele issues
4. **Error states** (E001/E002): broken 404/offline UX — geen fallback = crash voor gebruiker
5. **Responsive**: overflow + touch targets (breaks usability)
6. **Performance**: CLS → LCP → INP → bundle (CWV impact)
7. **Darkmode** (D001): visuele volledigheid, geen regressie in kleur/contrast
8. **Dark mode compliance** (DC001): ontbrekende dark: classes in components
9. **Responsive coverage** (RC001): ontbrekende responsive prefixes in layout-components
10. **SEO**: titles → descriptions → sitemap → robots → structured data
11. **AEO**: semantic HTML → FAQ schema → bot access → E-E-A-T
12. **A11Y** (A001-A203): accessible names → semantic elements → keyboard handlers → focus management → ARIA states → form errors → live regions
13. **Token Architecture** (T001/T101): refactor semantic raw hex naar var() referenties, vervang hardcoded component kleuren door token classes

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

## FASE 4: Re-audit & Completion

> **Todo**: markeer FASE 3 → `completed`, FASE 4 → `in_progress`.

### 4.1 Re-scan

Re-run the selected audits to measure improvement:

- Lighthouse re-run (if performance selected)
- Re-capture viewports (if responsive selected)
- Re-check SEO/AEO findings
- Re-run A11Y static analysis (if a11y selected)
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

Token Architecture:
  CSS compliance: [before] → [after]
  Hardcoded colors: [before] → [after]

Resolved: [N]/[total] findings

═════════════════════════════════════════════════════════════
```

### 4.3 Backlog Completion Sync

If a backlog item was tagged as "testing" in FASE 0:

1. Read `.project/backlog.html` → parse JSON
2. Find the feature → set `status: "DONE"`, remove `stage` field, `data.updated` to today
3. **Als `f.type === "PAGE" || f.type === "COMPONENT"` (frontend track)**: zet ook `f.shipped = true` en `f.shippedAt = "{YYYY-MM-DD}"` (terminaal — geen refactor-stap voor frontend cards). Als de audit-fixes een git-commit triggerden: zet ook `f.shippedSha = "{audit-commit-sha}"`. Bij een clean PASS zonder commit: laat `shippedSha` weg.
4. **Als `targetType === "feature"`**: voeg ook `audit` veld toe aan de feature:
   ```json
   {
     "lastRun": "{YYYY-MM-DD}",
     "scopes": ["{scope-lijst}"],
     "findings": { "critical": N, "warnings": N, "passed": N }
   }
   ```
5. Write back via Edit (keep `<script>` tags intact)
6. Sync to `project.json` `features[]`: merge feature with `status: "DONE"` (en `shipped: true` voor PAGE/COMPONENT)

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

> **Todo**: markeer FASE 4 → `completed`.

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
