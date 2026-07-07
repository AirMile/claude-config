# Performance Scan

Loaded when scope contains **Performance**.

**Lighthouse** (primary, if available):

```bash
npx lighthouse {url} --output json --chrome-flags="--headless --no-sandbox" --only-categories=performance,accessibility,best-practices
```

Extract: Performance score, LCP, CLS, INP, FCP, TTFB, opportunities.

**Fallback**: Playwright CLI CWV via PerformanceObserver (see `PLAYWRIGHT.md` → Use Cases: Performance Measurement).

**Network inspection** (prefer Claude-in-Chrome when a live local Chrome is connected — see `shared/CLAUDE-IN-CHROME.md`; fall back to Playwright CLI, see `PLAYWRIGHT.md` → Use Cases: Network Inspection):

```
navigate {url}                                              # fallback: playwright-cli goto {url}
(wait for load)                                             # fallback: playwright-cli run-code "async p => { await p.waitForLoadState('networkidle'); }"
read_network_requests                                       # fallback: playwright-cli requests
```

Parse the request list → findings:

- **P005 (CRITICAL)**: failed requests (status 4xx/5xx) — user gets broken page states
- **P108 (HIGH)**: payloads > 500KB — `request <i>` for details, candidate for compression/code-splitting
- **P109 (HIGH)**: missing cache headers on static assets — `response-headers <i>` → check `cache-control`/`etag`

**Runtime errors** (prefer Claude-in-Chrome — see `shared/CLAUDE-IN-CHROME.md`; fall back to Playwright CLI, see `PLAYWRIGHT.md` → Use Cases: Console Error Inspection):

```
read_console_messages                                       # fallback: playwright-cli console error
```

→ Filter output against PLAYWRIGHT.md → Default Ignore Patterns before reporting; only unfiltered lines become findings.

Each error = new finding **P004 (CRITICAL)** "JS Runtime Error" with location + message. A crashing component is a blocking bug, even if Lighthouse score is high.

**Bundle analysis** (if build script available):

`npm run build` → parse output for chunk sizes per route.

**Static code audit**: Scan for images without lazy loading, full library imports, render-blocking CSS, missing font preloading, sync third-party scripts.
