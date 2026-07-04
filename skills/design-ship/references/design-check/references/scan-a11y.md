# 1.4 A11Y Scan (Accessibility — WCAG 2.1 AA)

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

## Static Analysis (always runs)

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

## Live Check (Playwright — optional)

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

## Fix instructions per rule

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
