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

_Note: generation-time bans (token literals, dark/responsive coverage, static A11Y patterns) are enforced during `/frontend-design` Convert — not fixed here._

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

### 4.3 Backlog Completion Sync

After re-audit, update backlog if a feature was targeted:

1. Read `.project/backlog.html` → parse JSON
2. Find the feature (by `featureName` or best-effort URL match from PHASE 0.4).
3. Set `f.lastCheckedSha` = current HEAD SHA. Set `data.updated` to today.
4. **If no unresolved CRITICAL findings AND `f.type === "PAGE"` (page track)**: set `status: "DONE"`, `shipped: true`, `shippedAt: "{YYYY-MM-DD}"`, remove `stage` and `transition`. If audit fixes produced a commit: set `shippedSha = "{audit-commit-sha}"`.
5. **If `f.type === "COMPONENT"` (component track)**: do NOT auto-set `status: "DONE"` — components ship with the page/feature that consumes them. Only update `lastCheckedSha`.
6. Write back via Edit (keep `<script>` tags intact).
7. Sync to `project.json` `features[]` if status changed.

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
4. Clean tree (`git status --porcelain -- ':!.project'` empty — session-state files in `.project/` are excluded from this check)
5. Feature `shipped: true` (set in 4.3)

If all true → AskUserQuestion:

```yaml
header: "Open PR"
question: "Push + open a PR for worktree-{feature-name}?"
options:
  - label: "Yes, push + PR (Recommended)"
    description: "Push the branch and open a PR via gh. Worktree stays until merged."
  - label: "No, skip PR"
    description: "Skip the PR; show finalize prompt instead."
multiSelect: false
```

On "Yes" → follow `shared/PR.md`. Print PR URL. Suppress finalize prompt below.
On "Nee" or any precondition fail → fall through to finalize prompt (PHASE 5).

---

## PHASE 5: Finalize

Runs only when: feature-name is known (backlog feature targeted, not URL-only) and current branch matches `worktree-*` pattern.

Follow `shared/FINALIZE.md → Finalize Offer Decision`.

On any "Keep open" → print `💡 Run /core-finalize {feature-name} when ready`.
