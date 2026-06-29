# Web Baseline Motion Reference

Observed-in-the-wild motion conventions from high-craft productivity SaaS products. Primary source for the Subtle pack.

**Disclaimer**: Unlike Apple, Material, Fluent, and Carbon, there is no formal motion specification for these products. Values below were captured via DevTools → Computed Styles inspection of public-facing assets and confirmed against any published design tokens or engineering blog posts where available. They represent observed best practice, not an official standard.

Products surveyed: Linear, Vercel, GitHub (Primer), Stripe Dashboard, Loom, Notion, Raycast web.

Cross-links: For Material 3, see `material-motion.md`. For Fluent 2, see `fluent-motion.md`. For Carbon, see `carbon-motion.md`. For Apple iOS, see `ios-easings.md`.

---

## Signature Curves

These are the two curves that dominate high-craft web SaaS. They share a philosophy: fast exit, slow ease-in, no bounce. The goal is to feel responsive without calling attention to the motion itself.

| Token            | cubic-bezier                     | Observed in                           | Character                                                |
| ---------------- | -------------------------------- | ------------------------------------- | -------------------------------------------------------- |
| `ease-expo-out`  | `cubic-bezier(0.16, 1, 0.3, 1)`  | Linear, Raycast web, Loom             | Very fast start, long graceful tail. The "Linear curve". |
| `ease-cubic-out` | `cubic-bezier(0.33, 1, 0.68, 1)` | GitHub Primer, Vercel, Notion, shadcn | Slightly less aggressive than expo-out. Most versatile.  |

Both share the `y1 = 1` control point — the curve peaks above the value axis briefly, giving elements a sense of momentum without actual overshoot. This is different from bounce (`y > 1.0`): the curve only exceeds 1 at the control point, not the output value.

### Extended set (observed, lower frequency)

| Token           | cubic-bezier                          | Observed in      | Character                                           |
| --------------- | ------------------------------------- | ---------------- | --------------------------------------------------- |
| `ease-stripe`   | `cubic-bezier(0.4, 0, 0.2, 1)`        | Stripe Dashboard | Material M2 standard. Symmetric, fast, business.    |
| `ease-sine-out` | `cubic-bezier(0.39, 0.575, 0.565, 1)` | Vercel hover     | Gentle, barely perceptible. Good for opacity fades. |

---

## Duration Conventions

Web SaaS products converge on a tight range. Anything over 300ms feels "heavy" in a productivity context — users are moving fast and animation must keep up.

| Use case                       | Range     | Rationale                                            |
| ------------------------------ | --------- | ---------------------------------------------------- |
| Icon swap, badge update        | 80–100ms  | Below perception threshold — feels instant           |
| Button press, checkbox, toggle | 100–150ms | Just perceptible enough to feel responsive, not slow |
| Hover lift, tooltip, dropdown  | 150–200ms | Standard interactive feedback                        |
| Panel expand, modal, sheet     | 200–250ms | Largest transitions still under 300ms                |
| Page/route transition          | 200–300ms | Typically fade or subtle slide; never full push      |

> **The 200ms rule**: If a transition feels slow on first use, it will feel slow every time. SaaS users trigger the same interactions dozens of times per session. When in doubt, subtract 50ms.

---

## The Hover Pattern (Linear-style)

Fast-out on hover-enter, even faster snap back on hover-exit. The asymmetry makes the UI feel alive without any spring physics.

```css
.interactive-card {
  transition:
    transform 150ms cubic-bezier(0.16, 1, 0.3, 1),
    /* ease-expo-out — hover enter */ box-shadow 150ms
      cubic-bezier(0.16, 1, 0.3, 1);
}
.interactive-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

/* Snap back faster — no easing needed, just linear or ease-in */
.interactive-card:not(:hover) {
  transition:
    transform 80ms linear,
    box-shadow 80ms linear;
}
```

```tsx
// React — motion.dev, hover variant with fast-snap pattern
function LinearCard({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      whileHover={{ y: -2, boxShadow: "var(--shadow-md)" }}
      transition={{
        type: "tween",
        duration: 0.15,
        ease: [0.16, 1, 0.3, 1], // ease-expo-out
      }}
      className="rounded-xl border border-border bg-surface p-4"
    >
      {children}
    </motion.div>
  );
}
```

---

## The Dropdown / Popover Pattern (GitHub Primer-style)

Scale + fade from origin point. `ease-cubic-out` on open, faster fade-only on close.

```css
.popover {
  transform-origin: top left;
  animation: popover-in 150ms cubic-bezier(0.33, 1, 0.68, 1) both; /* ease-cubic-out */
}
.popover[data-closing="true"] {
  animation: popover-out 80ms ease-in both;
}

@keyframes popover-in {
  from {
    opacity: 0;
    transform: scale(0.95) translateY(-4px);
  }
}
@keyframes popover-out {
  to {
    opacity: 0;
    transform: scale(0.97);
  }
}

@media (prefers-reduced-motion: reduce) {
  .popover,
  .popover[data-closing="true"] {
    animation: fade-only 100ms ease both;
  }
  @keyframes fade-only {
    from {
      opacity: 0;
    }
  }
}
```

---

## The Route Fade (Vercel-style)

SaaS products rarely use spatial route transitions (no slide-in from right). Content fades out, new content fades in. Fast, non-intrusive.

```tsx
function VercelPageTransition({
  children,
  routeKey,
}: {
  children: React.ReactNode;
  routeKey: string;
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={routeKey}
        initial={{ opacity: 0 }}
        animate={{
          opacity: 1,
          transition: { duration: 0.15, ease: [0.33, 1, 0.68, 1] },
        }}
        exit={{ opacity: 0, transition: { duration: 0.08, ease: "easeIn" } }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

---

## The Skeleton Shimmer (Vercel/Notion-style)

Loading state before content appears. CSS-only, GPU-accelerated.

```css
.skeleton {
  background: linear-gradient(
    90deg,
    var(--color-surface-raised) 25%,
    color-mix(
        in oklch,
        var(--color-surface-raised) 60%,
        var(--color-foreground)
      )
      50%,
    var(--color-surface-raised) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

@keyframes shimmer {
  from {
    background-position: 200% 0;
  }
  to {
    background-position: -200% 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .skeleton {
    animation: none;
    background: var(--color-surface-raised);
  }
}
```

---

## CSS Variables

Emitted to `theme.cssVars` by the Apply route when Subtle pack is active:

```css
/* Web baseline easings (Subtle pack) */
--ease-expo-out: cubic-bezier(0.16, 1, 0.3, 1);
--ease-cubic-out: cubic-bezier(0.33, 1, 0.68, 1);

/* Extended set (Customize opt-in) */
--ease-stripe: cubic-bezier(0.4, 0, 0.2, 1);
--ease-sine-out: cubic-bezier(0.39, 0.575, 0.565, 1);
```

---

## Pack mapping

The Subtle pack pulls `ease-expo-out` and `ease-cubic-out` from this baseline. Both curves are also available in Standard, Apple, and Playful packs as part of the base easing set — they are generic enough to compose with any pack without semantic conflict.

The Subtle pack duration range is 100–200ms, which aligns with the 200ms rule above. Standard pack prefers the Material 3 duration scale but uses the same curves for hover/press feedback.
