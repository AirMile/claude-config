# PHASE X: Post-flight Validation + X.6 Theme Infrastructure Sync

## PHASE X: Post-flight Validation

**Run these checks AFTER every write operation (Create/Update/Extract/Modes).**

```
POST-FLIGHT CHECK
════════════════════════════════════════════════
```

**1. File Validation**

```
File: [✓|✗] .project/project.json - [exists|missing|empty]
Theme: [✓|✗] theme sectie - [populated|empty|missing]
Format: [✓|✗] JSON - [valid|corrupt]
```

**2. Content Validation**

```
Sections:
  [✓|✗] colors - [present|missing] (main, accent, semantic)
  [✓|✗] typography - [present|missing] (families, sizes)
  [✓|✗] spacing - [present|missing] (base, scale)
  [✓|✗] breakpoints - [present|missing]
  [✓|✗] borderRadius - [present|missing]
  [✓|✗] shadows - [present|missing]
  [✓|✗] motion - [present|skipped|missing] (durations, easings)
  [✓|✗] interactions - [present|skipped|missing] (focusRing, hover, active)
  [✓|✗] modes - [light only|light+dark|missing]
  [✓|✗] cssVars - [present|missing]
```

**3. Value Validation**

```
Colors:
  [✓|✗] All color values valid (#RRGGBB hex or oklch(L C H) format)
  [✓|✗] No empty values
  [✓|✗] Each color has token, value, usage
  [✓|⚠] Semantic tokens use var() refs — not raw hex (warning only: existing setups may have raw values)
  [✓|⚠] Semantic completeness — success, warning, error, info defined and mutually distinct (⚠ if one is missing or two use the same primitive ref)
Typography:
  [✓|✗] Font families have fallbacks
  [✓|✗] Sizes have token, size, lineHeight
Spacing:
  [✓|✗] All values numeric with unit
  [✓|✗] Scale entries have token, value, usage
Modes:
  [✓|✗] Light mode :root CSS present and valid
  [✓|✗] Dark mode .dark CSS present (if configured)
  [✓|✗] Dark mode contrast ratios acceptable (AA minimum)
  [✓|✗] No unfilled placeholders in mode CSS blocks
Motion base (if configured):
  [✓|✗] Duration values end with 'ms' or 's'
  [✓|✗] Each duration has token, value, usage
  [✓|✗] Easing values are valid cubic-bezier or keyword
Motion pack (if set):
  [✓|✗] motion.pack is a valid value (none|subtle|standard|apple|playful)
  [✓|✗] motion.axes has expressiveness, springiness, tempo, surfaces
  [✓|✗] motion.spring[] entries each have token, stiffness, damping, mass, cssApprox, cssDuration
  [✓|✗] motion.choreography has entrance, exit keys (success/attention/error optional)
Surfaces (if glass enabled):
  [✓|✗] surfaces.glass.blur is a valid CSS length
  [✓|✗] surfaces.glass.tint uses color-mix() or valid CSS color
  [✓|✗] surfaces.elevation[] entries each have token, shadow, tint, usage
Interactions (if configured):
  [✓|✗] Focus ring has width, color, offset
  [✓|✗] Hover transition references valid motion tokens
  [✓|✗] Active transform is valid CSS transform
```

**4. Export Validation**

```
CSS Export:
  [✓|✗] cssVars field present and non-empty
  [✓|✗] :root block syntax valid
  [✓|✗] Matches structured token data
  [✓|✗] All variables populated (no {placeholders})
```

**5. JSON Integrity**

```
Integrity:
  [✓|✗] project.json is valid JSON
  [✓|✗] Other sections unchanged (concept, stack, data, endpoints, decisions)
  [✓|✗] Theme sectie matches schema
```

**Post-flight Summary:**

```
════════════════════════════════════════════════
POST-FLIGHT RESULT
════════════════════════════════════════════════
File:         [✓ PASS | ✗ FAIL]
Content:      [✓ PASS | ✗ FAIL] - {N}/{M} sections
Values:       [✓ PASS | ⚠ WARNINGS | ✗ FAIL]
Modes:        [✓ PASS | ⚠ Light only | ✗ FAIL] - {light|light+dark}
Motion base:  [✓ PASS | ⚠ Skipped | ✗ FAIL]
Motion pack:  [✓ PASS | ⚠ None set | ✗ FAIL]
Surfaces:     [✓ PASS | ⚠ Disabled | ✗ FAIL]
Interactions: [✓ PASS | ⚠ Skipped | ✗ FAIL]
Export:       [✓ PASS | ✗ FAIL]
Integrity:    [✓ PASS | ✗ FAIL]

Status: [→ Complete | ⚠ Warnings: {list} | ✗ Recovery needed]
════════════════════════════════════════════════
```

**On Failure:**

**AskUserQuestion:**

```yaml
header: "Post-flight Failed"
question: "Validation found problems: {issues}. What now?"
options:
  - label: "Auto-fix (Recommended)", description: "Attempt automatic repair"
  - label: "Fix manually", description: "Review and fix problems"
  - label: "Ignore", description: "Accept output despite problems"
multiSelect: false
```

---

## X.6 Theme Infrastructure Sync (Create/Update only)

**Always runs after successful post-flight validation.** Ensures theme tokens are available in the project's styling infrastructure, not just in project.json.

**On Updates:** diff the old token values (before the update) against the new values. Use this diff to:

1. Only update changed CSS variables in the CSS/config file (not regenerate everything)
2. Show a list of changed tokens in the infrastructure sync output
3. Pass the old values to PHASE Y so it can also scan for old hex codes / rgba values in components

**Styling approach detectie:**

1. **Detect styling approach** from `package.json` + CSS files:
   - `tailwindcss` present → check for Tailwind 4 CSS-first OR classic config (see step 2)
   - Neither → CSS variables project

2. **Tailwind project:**
   - **Tailwind 4 (CSS-first):** Grep CSS files (globals.css, index.css) for `@theme inline`. If found: update the `:root` CSS variables in that file directly — this IS the Tailwind config in v4
     - Follow the same two-block order: primitives first, semantics with var() refs after
   - **Tailwind 3 (config-based):** Fall back to `tailwind.config.{js,ts,mjs}` when no `@theme inline` is present
   - Generate/update theme tokens:
     - `colors`: map color tokens to Tailwind color keys
     - `spacing`: map custom spacing tokens (skip if standard 4px scale)
     - `borderRadius`: map radius tokens
     - `boxShadow`: map shadow tokens
     - `fontFamily`: map typography families
   - Write back (preserve existing non-theme extensions)

3. **Non-Tailwind project:**
   - Generate/update CSS variables file (e.g., `src/styles/theme.css`) from `theme.cssVars`
   - CSS output must contain two consecutive blocks within `:root { ... }`:
     1. **Primitives** (main + accent colors, spacing, typography, motion): direct values
        `--color-dark: #1a1a2e;`
        `--color-accent-primary: #3B82F6;`
     2. **Semantics** (semantic colors): var() references to primitives
        `--color-success: var(--color-accent-primary);`
   - Generate semantics as `var(--color-{best-matching-primitive})` — match on color group or user intent
   - Check if it's imported in the main CSS entry point — if not, warn

4. **No project detected** (no package.json, no source files):
   - Skip with: `"No project detected — theme saved to project.json only."`

```
THEME INFRASTRUCTURE
════════════════════════════════════════════════
Approach: {Tailwind | CSS Variables | Skipped (no project)}
Config:   {tailwind.config updated | theme.css generated | —}
Tokens:   {N} color, {M} spacing, {P} typography, {Q} motion, {R} interaction tokens synced
════════════════════════════════════════════════
```

---

## X.7 Backlog Write

Runs only if a backlog task was picked up in PHASE 0 step 4 (`taskName` is set — via dashboard pickup **or** manual-link confirmation) **and** post-flight passed (status → Complete or Warnings).

1. Re-read `.project/backlog.json`.
2. Parse the JSON.
3. Find `features[].name === taskName`.
4. Set `status = "DONE"` and delete the `transition` field.
5. Write the updated JSON back to `.project/backlog.json` (see `shared/BACKLOG.md § Writing`).
6. Output: `Backlog: ✓ Task "{taskName}" → DONE`.

If post-flight failed before reaching X.7: skip the write (per `shared/BACKLOG.md § Abort` — `transition` stays, user can re-copy prompt to retry).

Mirror update: also set `features[].status = "DONE"` and `completedAt: "{today}"` in `.project/project.json` if a matching entry exists (convenience; `backlog.json` is the source of truth).
