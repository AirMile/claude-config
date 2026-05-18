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

If a backlog item was tagged as "testing" in PHASE 0 **and** no unresolved CRITICAL findings remain after re-audit:

1. Read `.project/backlog.html` → parse JSON
2. Find the feature → set `status: "DONE"`, remove `stage` and `transition` fields, `data.updated` to today
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

## PHASE 4.5: Team handoff

Runs only when: feature-name is known (backlog feature targeted, not URL-only) and current branch matches `worktree-*` pattern.

**Optional PR offer** — show first, only if ALL true:

1. Current branch matches `worktree-*` pattern
2. `TEAM_MODE === "team"` — read via `shared/PROJECT-MODE.md` read pattern (absent → skip)
3. `gh` on PATH AND `gh auth status` exit 0
4. Clean tree (`git status --porcelain` empty)
5. Feature `shipped: true` (set in 4.3)

If all true → AskUserQuestion:

```yaml
header: "PR openen"
question: "Push + PR openen voor worktree-{feature-name}?"
options:
  - label: "Ja, push + PR (Recommended)"
    description: "Push branch en open PR via gh. Worktree blijft tot merge."
  - label: "Nee, skip PR"
    description: "Skip PR; toon finalize prompt instead."
multiSelect: false
```

On "Ja" → follow `shared/PR.md`. Print PR URL. Suppress finalize prompt below.
On "Nee" or any precondition fail → fall through to finalize prompt (PHASE 5).

---

## PHASE 5: Finalize

Runs only when: feature-name is known (backlog feature targeted, not URL-only) and current branch matches `worktree-*` pattern.

Follow `shared/FINALIZE.md → Finalize Offer Decision`.

On any "Keep open" → print `💡 Run /core-finalize {feature-name} when ready`.
