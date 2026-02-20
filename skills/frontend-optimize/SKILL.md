---
name: frontend-optimize
description: >-
  Audit and fix performance (Lighthouse, CWV, bundle), SEO (Google), AEO (AI search),
  and responsive design (multi-viewport) in one unified scan. Use with /frontend-optimize.
argument-hint: "[url]"
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: frontend
---

# Optimize

Unified audit & fix for performance, SEO, AEO (AI search optimization), and responsive design. Scan on all axes, get a combined report, fix by priority, verify with before/after comparison.

**Pipeline:** `/frontend-page` → `/frontend-iterate` → `/frontend-optimize`

## References

- `../shared/RULES.md` — P-series (performance), S-series (SEO), H-series (responsive/HTML)
- `../shared/PLAYWRIGHT.md` — CWV measurement, multi-viewport captures, overflow detection
- `../shared/PATTERNS.md` — Code splitting, memoization patterns
- `../shared/DEVINFO.md` — Session tracking, cross-skill handoff

---

## FASE 0: Pre-flight

### 0.1 Target Selection

If `$1` provided → use as target URL.

If no argument:

```yaml
header: "Target"
question: "Wat wil je optimaliseren?"
options:
  - label: "Draaiende dev server (Recommended)", description: "Lighthouse + captures op dev server"
  - label: "Specifieke URL", description: "Geef een URL op"
  - label: "Production build", description: "Eerst builden, dan analyseren"
multiSelect: false
```

### 0.2 Scope Selection

```yaml
header: "Scope"
question: "Welke audits wil je draaien?"
options:
  - label: "Alles (Recommended)", description: "Performance + SEO + AEO + Responsive"
  - label: "Ik kies zelf", description: "Selecteer specifieke audits"
multiSelect: false
```

If "Ik kies zelf":

```yaml
header: "Audits"
question: "Welke audits?"
options:
  - label: "Performance", description: "Lighthouse, CWV, bundle sizes"
  - label: "SEO", description: "Google search optimization"
  - label: "AEO", description: "AI search optimization (ChatGPT, Perplexity, Gemini)"
  - label: "Responsive", description: "Multi-viewport layout audit"
multiSelect: true
```

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

---

## FASE 1: Scan

Run all selected audits. Each produces findings with severity + category.

### 1.1 Performance Scan

**Lighthouse** (primary, if available):

```bash
npx lighthouse {url} --output json --chrome-flags="--headless --no-sandbox" --only-categories=performance,best-practices
```

Extract: Performance score, LCP, CLS, INP, FCP, TTFB, opportunities.

**Fallback**: Playwright CWV via PerformanceObserver (see `PLAYWRIGHT.md`).

**Bundle analysis** (if build script available):

`npm run build` → parse output for chunk sizes per route.

**Static code audit**: Scan for images without lazy loading, full library imports, render-blocking CSS, missing font preloading, sync third-party scripts.

### 1.2 SEO Scan

Per route, check:

**Critical:** Page titles (S001), meta descriptions (S002), rendering (S003 — Playwright validate SSR), robots config (S004).

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

Capture on 6 viewports (320, 375, 768, 1024, 1440, 1920) using Playwright:

Per viewport: `browser_resize` → `browser_wait_for` (settle) → `browser_take_screenshot` → `browser_snapshot` → `browser_evaluate` (overflow detection).

Analyze: horizontal overflow, touch targets < 44px, truncated text, layout breaks, font size < 16px on mobile, missing viewport meta.

### 1.5 Finding Format (all audits)

```
FINDING: [ID]
─────────────
Audit:    [Performance | SEO | AEO | Responsive]
Severity: [CRITICAL | HIGH | MEDIUM]
Rule:     [P001 | S001 | A001 | H117 | etc.]
Impact:   [CWV metric | search visibility | AI citability | viewport]
File:     [path:line]
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

COMBINED PRIORITIES (top 10):
  1. [finding] — [audit] — [impact]
  2. [finding] — [audit] — [impact]
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

1. **Responsive**: overflow + touch targets (breaks usability)
2. **Performance**: CLS → LCP → INP → bundle (CWV impact)
3. **SEO**: titles → descriptions → sitemap → robots → structured data
4. **AEO**: semantic HTML → FAQ schema → bot access → E-E-A-T

### Context7 Research

Before framework-specific fixes, use Context7 for current API patterns:

- "[framework] image optimization"
- "[framework] metadata API"
- "[framework] sitemap generation"

### Per Fix

```
FIX: [Finding ID]
═════════════════════════════════════════════════════════════
Audit:  [Performance | SEO | AEO | Responsive]
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

### 4.3 Completion Report

```
OPTIMIZE COMPLETE
═════════════════════════════════════════════════════════════

Audits run:    [Performance, SEO, AEO, Responsive]
Findings:      [N] total → [N] resolved, [N] remaining
Files modified: [N]

Next steps:
  1. Test met echte netwerk throttling (Chrome DevTools)
  2. Monitor CWV in productie (web-vitals library)
  3. Submit sitemap to Google Search Console
  4. Test AI visibility: search your content on Perplexity/ChatGPT

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

This skill must **ALWAYS**:

- Scan before fixing (measure → fix → re-measure)
- Tag CWV impact per performance finding
- Use Context7 for framework-specific optimization patterns
- Follow mobile-first approach for responsive fixes
- Follow rules from RULES.md (P-series, S-series, H-series)
- Update DevInfo at each phase transition
- Use Playwright for render validation (S003) and responsive captures
