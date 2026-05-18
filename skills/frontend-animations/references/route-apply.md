# Route: Apply to Codebase

Emits CSS custom properties for spring, iOS-easing, and surface tokens into `theme.cssVars`. Coordinates with frontend-tokens: reads the current cssVars string, appends the new animation section, writes back.

Called automatically at the end of Create and Customize routes. Can also be invoked standalone via `ACTION_SELECT → Apply`.

---

## Step 1 — Read current state

```
Read project.json:
  $CURRENT_PACK     = theme.motion.pack
  $SPRINGS          = theme.motion.spring[]
  $AXES             = theme.motion.axes
  $GLASS_ENABLED    = theme.surfaces.glass.enabled
  $CURRENT_CSSVARS  = theme.cssVars (existing string — do NOT overwrite)
```

If `motion.pack` is empty: abort. Run Create first.

---

## Step 2 — Build animation CSS vars block

Construct the following string based on current token state:

```
/* Animation pack: {pack} — managed by /frontend-animations */

/* Spring tokens */
{for each spring in theme.motion.spring[]:}
--{token}-duration: {cssDuration};
--{token}-bezier: {cssApprox};

/* iOS easings (Expressive/Playful only) */
{if pack is expressive or playful:}
--ease-ios-default: cubic-bezier(0.42, 0, 0.58, 1);
--ease-ios-out: cubic-bezier(0.25, 0.1, 0.25, 1);
--ease-ios-in: cubic-bezier(0.42, 0, 1, 1);
--ease-ios-spring: cubic-bezier(0.32, 0.72, 0, 1);
--ease-ios-snappy: cubic-bezier(0.175, 0.885, 0.32, 1.275);
--ease-ios-bouncy: cubic-bezier(0.5, 1.6, 0.4, 0.8);
--duration-ios-fast: 200ms;
--duration-ios-default: 350ms;
--duration-ios-modal: 500ms;

/* Tempo multiplier (applied to base durations) */
{if axes.tempo !== "normal":}
--duration-instant: {base * multiplier};
--duration-fast: {base * multiplier};
--duration-normal: {base * multiplier};
--duration-slow: {base * multiplier};

/* Glass surface tokens (only when surfaces.glass.enabled = true) */
{if glass_enabled:}
--surface-glass-blur: {blur};
--surface-glass-saturation: {saturation};
--surface-glass-tint: {tint};
--surface-glass-border: {border};
```

Tempo multipliers: slow = 1.25×, normal = 1× (no override), fast = 0.75×.
Base durations: instant=100ms, fast=200ms, normal=300ms, slow=500ms.

---

## Step 3 — Merge into existing cssVars

The existing `theme.cssVars` was written by `/frontend-tokens` and contains color, typography, spacing vars. The animation block is appended — never replaces the existing content.

Algorithm:

1. Remove any existing animation block (identified by the comment `/* Animation pack:` ... next `*/` at the end of a block)
2. Append the new animation block to the end of the `:root { ... }` closing brace, inside it
3. Write back to `theme.cssVars`

```
Before:
  :root {
    --color-primary: ...;
    --font-heading: ...;
    /* ... base tokens ... */
  }

After:
  :root {
    --color-primary: ...;
    --font-heading: ...;
    /* ... base tokens ... */

    /* Animation pack: standard — managed by /frontend-animations */
    --spring-smooth-duration: 500ms;
    --spring-smooth-bezier: cubic-bezier(0.32, 1, 0.68, 1);
    --spring-snappy-duration: 420ms;
    --spring-snappy-bezier: cubic-bezier(0.4, 1.15, 0.7, 1.05);
  }
```

If `theme.cssVars` is empty or missing a `:root {}` block: write the animation vars inside a new `:root {}` block.

---

## Step 4 — Write and report

1. Write the updated `theme.cssVars` back to `project.json` (delta-write: only `theme.cssVars` key)
2. Report:

```
✓ CSS vars emitted
  Springs:     {list of --spring-* vars added}
  iOS easings: {added / not applicable}
  Glass vars:  {added / not applicable}
  Tempo:       {override applied / normal (no override)}
  Location:    project.json#theme.cssVars
```

---

## Standalone invocation

When called from `ACTION_SELECT → Apply` (user explicitly runs Apply):

- If pack unchanged since last Apply: confirm "Already applied — re-emit? Yes / No"
- If pack changed: show diff of what will change, confirm, then emit

---

## Integration: tokens.css file

If the project has `src/styles/tokens.css` (written by dev-build PHASE 0), also append the animation vars block there. Detection: check if file exists before writing.

Same merge algorithm: remove old animation block, append new one inside `:root {}`.
