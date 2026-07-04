# PHASE 3: Fix + PHASE 4: Re-audit & Completion

## PHASE 3: Fix

Implement fixes in priority order, grouped by audit category.

### Fix Order

1. **JS Runtime Errors** (P004): uncaught exceptions make CWV measurements unreliable and break pages functionally
2. **Failed network requests** (P005): 4xx/5xx on critical endpoints → broken page states
3. **Flow breakage** (F001): a broken user journey is worse than visual issues
4. **Error states** (E001/E002): broken 404/offline UX — no fallback = crash for user
5. **Responsive**: overflow + touch targets (breaks usability)
6. **Performance**: CLS → LCP → INP → bundle (CWV impact)
7. **Darkmode** (D001/D102): visual completeness, no regression in color/contrast, computed contrast below WCAG 4.5:1
8. **SEO**: titles → descriptions → sitemap → robots → structured data
9. **AEO**: semantic HTML → FAQ schema → bot access → E-E-A-T
10. **A11Y runtime** (focus-trap, aria-snapshot, axe, console warnings): focus management → ARIA states → keyboard traps → live regions
11. **Motion** (M006/M007): missing reduced-motion fallbacks

_Note: generation-time bans (token literals, dark/responsive coverage, static A11Y patterns) are enforced during `/design-convert` Convert — not fixed here._

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

Motion:
  Reduced-motion violations: [before] → [after]

Resolved: [N]/[total] findings

═════════════════════════════════════════════════════════════
```

### 4.3 Worktree commit + result payload (replaces the stock Backlog Completion Sync)

> **design-ship: do NOT write `status: "DONE"`, `shipped`, `shippedAt`, `shippedSha`, or
> `lastCheckedSha` to the backlog.** The feature has not merged yet — those writes belong to the
> design-ship main chat (PHASE 4, after the visual review and the merge). Writing them here would
> mark an unmerged worktree as shipped.

Instead:

1. **Commit your fixes in the worktree** (if any files changed):

   ```bash
   git add {modified source files}   # codebase files only — session state stays local
   git commit -m "fix({feature}): design-check fixes toegepast"
   ```

   Commit message language follows `CLAUDE.md → Language`.

2. **Return the completion verdict in your result** (design-ship PHASE 4 consumes it):
   - `readyForDone: true` when no unresolved CRITICAL findings remain; else `false`
   - `criticalRemaining[]` — unresolved CRITICAL finding IDs + one-line descriptions

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
  5. Re-test flows after every major refactor (/design-check scope Flow)

═════════════════════════════════════════════════════════════
```

> **Todo**: mark PHASE 4 → `completed`.

---

## PHASE 5: Finalize

> **design-ship: SKIP entirely.** Never run `FINALIZE.md`, never merge, never remove the
> worktree — the main chat owns finalize in design-ship PHASE 4. Kill any dev server you
> started (contract rule), then return your result.
