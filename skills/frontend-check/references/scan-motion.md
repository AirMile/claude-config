# Scan: Motion

Animation pack compliance audit. Fires when scope includes "Motion".

**Prerequisites:** Read `project.json#theme.motion.pack` and `theme.surfaces.glass.enabled` before running any check. If `motion.pack` is empty → report "No animation pack set — run `/frontend-animations` first" and skip checks M002/M006/M007.

---

## Static Checks (no Playwright)

### M001 — Hardcoded duration / easing literals (T106 / T107)

**Severity:** MEDIUM

Grep `.tsx`, `.jsx`, `.vue`, `.svelte`, `.css`, `.scss` for:

- `transition:\s*\d+ms` — hardcoded milliseconds duration (e.g. `transition: 300ms`)
- `transition:\s*\d+(\.\d+)?s\b` — hardcoded seconds duration (e.g. `transition: 0.3s`)
- `transition:\s*all\b` — transition-all shorthand (e.g. `transition: all 0.3s ease`) — catches the most common hardcoding pattern
- `transition-duration:\s*\d+(\.\d+)?(s|ms)\b` — hardcoded transition-duration property
- `cubic-bezier\(` — hardcoded easing literal
- `animation-duration:\s*\d+` — hardcoded animation duration

Skip: test files, `*.config.*`, `tokens.css`, generated `theme.cssVars` output. Also skip `transition-property: all;` without a duration on the same line (not a violation — setting property list only).

**Pass:** No matches.
**Fail:** List each file:line with the matched literal and the suggested token:

- Hardcoded duration → `var(--duration-fast)` / `var(--duration-md-medium1)` (pack-appropriate)
- `transition: all 0.3s` → split into `transition-property: transform, opacity` + `transition-duration: var(--duration-fast)` + `transition-timing-function: var(--ease-out)`
- Hardcoded `cubic-bezier(...)` → `var(--ease-ios-spring)` / `var(--ease-md-emphasized)` (nearest canonical)

---

### M002 — Interactive elements missing transitions (pack ≠ none)

**Severity:** MEDIUM (skipped if `motion.pack` is empty or `"none"`)

Grep for `<button`, `<a `, `role="button"`, `onClick`, `.card` patterns. For each matching element in `.tsx`/`.jsx`/`.vue`/`.svelte`: check if `transition` or `transition-*` class / CSS property is present on the same element or its immediate wrapper.

**Pass:** ≥80% of interactive elements have a transition class.
**Fail:** List elements without transitions. Suggest: `className="... transition-transform duration-fast ease-out"`.

---

### M003 — `backdrop-filter` without `surfaces.glass.enabled`

**Severity:** HIGH (T108)

Grep for `backdrop-filter` in all component/page files.

- If `theme.surfaces.glass.enabled !== true` AND any match found → FAIL
- If `theme.surfaces.glass.enabled = true` → run M004 instead

**Fail message:** "`backdrop-filter` used but `theme.surfaces.glass.enabled` is false. Enable via `/frontend-animations → Apple pack` (or Playful) or remove the backdrop-filter."

---

### M004 — Glass surface > 60vh (P110)

**Severity:** MEDIUM (only runs when `surfaces.glass.enabled = true`)

For each element with `backdrop-filter` found: check if it has a height class > 60vh:

- `h-screen`, `h-dvh`, `min-h-screen`, `h-[80vh]` or similar on the same element

**Pass:** No backdrop-filter on elements > 60vh.
**Fail:** List elements. Suggest: "Scope glass to overlays and nav bars — not full-page backgrounds."

---

### M005 — Missing `prefers-reduced-motion` fallback on `@keyframes` (A105)

**Severity:** HIGH

Grep `.css`/`.scss`/style tags for `@keyframes`. For each `@keyframes` block found: check if `@media (prefers-reduced-motion: reduce)` wraps a corresponding `animation` property or uses `animation-duration: 0.01ms`.

**Pass:** Every `@keyframes` has a reduced-motion counterpart.
**Fail:** List keyframe names without reduced-motion fallback. Suggest the canonical wrapper from `shared/PATTERNS.md § prefers-reduced-motion Fallback`.

---

## Runtime Checks (Playwright)

Use existing Playwright setup from `shared/PLAYWRIGHT.md`. Run after static checks.

### M006 — Pack compliance (interactive elements animate)

**Severity:** MEDIUM (skipped if `motion.pack` empty or `"none"`)

```
1. Navigate to target URL
2. For each interactive element type (button, card, link):
   - Hover over element
   - Capture computed style: transition, transform
   - Verify: transition-duration is NOT "0s" or "0ms"
3. Count: elements with transitions / total interactive elements
```

**Pass:** ≥80% ratio.
**Fail:** Report ratio. List element selectors without transitions.

---

### M007 — Reduced-motion runtime check

**Severity:** HIGH

```javascript
// Use existing snippet from shared/PLAYWRIGHT.md:696-718
await page.emulateMedia({ reducedMotion: "reduce" });
await page.goto(targetUrl);

// Check 1: no auto-playing animations
const runningAnimations = await page.evaluate(() => {
  return [...document.querySelectorAll("*")]
    .filter((el) => {
      const s = getComputedStyle(el);
      return (
        s.animationPlayState === "running" &&
        parseFloat(s.animationDuration) > 0.02
      );
    })
    .map((el) => el.tagName + "." + el.className.split(" ")[0]);
});

// Check 2: transitions are suppressed (< 50ms)
const longTransitions = await page.evaluate(() => {
  return [...document.querySelectorAll('button, a, [role="button"]')]
    .filter((el) => {
      const d = parseFloat(getComputedStyle(el).transitionDuration);
      return d > 0.05; // > 50ms = not suppressed
    })
    .map((el) => el.tagName + (el.id ? "#" + el.id : ""));
});
```

**Pass:** `runningAnimations.length === 0` AND `longTransitions.length === 0`.
**Fail:** Report running animations and/or long transitions under reduced-motion. Suggest canonical reduced-motion wrapper.

---

## Report Format

```
MOTION AUDIT — pack: {pack or "none"} · glass: {enabled/disabled}
═══════════════════════════════════════════════════════════════════

Static checks:
  [✓|✗] M001  Hardcoded duration/easing literals    {n violations or "clean"}
  [✓|✗] M002  Interactive elements have transitions  {ratio or "skipped"}
  [✓|✗] M003  backdrop-filter without glass flag     {n violations or "clean"}
  [✓|✗] M004  Glass surface ≤ 60vh                  {n violations or "clean / n/a"}
  [✓|✗] M005  prefers-reduced-motion on @keyframes  {n violations or "clean"}

Runtime checks:
  [✓|✗] M006  Pack compliance (transitions active)  {ratio or "skipped"}
  [✓|✗] M007  Reduced-motion runtime                {pass / violations}

Issues: {n HIGH} HIGH · {n MEDIUM} MEDIUM
Fix:    /frontend-animations → Customize / Apply to codebase
```
