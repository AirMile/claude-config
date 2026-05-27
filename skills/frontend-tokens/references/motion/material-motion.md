# Material Design 3 Motion Reference

Canonical motion values from Material Design 3 (Material You). Primary source for the Standard pack.

Provenance: Material Design specification at m3.material.io/styles/motion — publicly documented by Google.

Used by the Create route when `motion.pack = "standard"` and optionally via Customize → "Add easings from other systems". Values are added to `motion.easings[]`, `motion.durations[]`, and `motion.spring[]` in `project.json`.

Cross-links: For Apple iOS, see `ios-easings.md`. For Fluent 2, see `fluent-motion.md`. For Carbon, see `carbon-motion.md`. For Linear/GitHub/Vercel, see `web-baseline.md`.

---

## The Four M3 Easing Curves

Material Design 3 defines two easing families: **Emphasized** (for elements that need user attention — entrances, route transitions, modals) and **Standard** (for simple state changes and background elements).

| Token                           | cubic-bezier                      | M3 source                                        | Use                                                                    |
| ------------------------------- | --------------------------------- | ------------------------------------------------ | ---------------------------------------------------------------------- |
| `ease-md-emphasized`            | `cubic-bezier(0.2, 0, 0, 1)`      | M3 Emphasized — easeInOut variant                | Primary transitions: route changes, dialogs, FAB morphs, bottom sheets |
| `ease-md-emphasized-decelerate` | `cubic-bezier(0.05, 0.7, 0.1, 1)` | M3 Emphasized Decelerate — element enters        | Elements entering the screen: shared-axis enter, container expand      |
| `ease-md-emphasized-accelerate` | `cubic-bezier(0.3, 0, 0.8, 0.15)` | M3 Emphasized Accelerate — element exits         | Elements exiting: shared-axis exit, container collapse, dismiss        |
| `ease-md-standard`              | `cubic-bezier(0.2, 0, 0, 1)`      | M3 Standard — same value, different intent label | Utility transitions: color changes, icon swaps, simple state toggles   |

> **Note on `ease-md-emphasized` vs `ease-md-standard`**: The M3 spec lists these as identical bezier values (`0.2, 0, 0, 1`) but with different semantic intent. Keep both tokens — the semantic distinction matters for audit rules and choreography decisions, even when the CSS value matches.

### Legacy M2 curve (interop)

| Token            | cubic-bezier                   | Source                              | Use                                                         |
| ---------------- | ------------------------------ | ----------------------------------- | ----------------------------------------------------------- |
| `ease-md-legacy` | `cubic-bezier(0.4, 0, 0.2, 1)` | Material Design 2 "standard" easing | Interop with M2 component libraries (MUI v4, older Android) |

---

## M3 Duration Scale

Material Design 3 defines a 14-step duration scale with named tokens. The Standard pack uses the middle range (short2 → long1); the full scale is available via Customize.

| Token                     | Value   | M3 label     | Typical use                                              |
| ------------------------- | ------- | ------------ | -------------------------------------------------------- |
| `duration-md-short1`      | `50ms`  | Short 1      | Micro-interactions: icon badge flip, ripple start        |
| `duration-md-short2`      | `100ms` | Short 2      | Small state changes: checkbox toggle, chip select        |
| `duration-md-short3`      | `150ms` | Short 3      | Small element transitions: tooltip appear, menu item     |
| `duration-md-short4`      | `200ms` | Short 4      | Small container transitions: snackbar, simple fade       |
| `duration-md-medium1`     | `250ms` | Medium 1     | Medium transitions: FAB collapse, navigation rail change |
| `duration-md-medium2`     | `300ms` | Medium 2     | Standard page sections: card expand, list item           |
| `duration-md-medium3`     | `350ms` | Medium 3     | Larger sections: dialog content, search bar expand       |
| `duration-md-medium4`     | `400ms` | Medium 4     | Prominent transitions: full-width dialog, modal          |
| `duration-md-long1`       | `450ms` | Long 1       | Complex transitions: shared-axis route, container morph  |
| `duration-md-long2`       | `500ms` | Long 2       | Large complex: full-screen modal, onboarding step        |
| `duration-md-long3`       | `550ms` | Long 3       | Splash transitions, persistent surface reveals           |
| `duration-md-long4`       | `600ms` | Long 4       | Hero animations                                          |
| `duration-md-extra-long1` | `700ms` | Extra Long 1 | Rich motion: scroll-driven hero, complex choreography    |
| `duration-md-extra-long2` | `800ms` | Extra Long 2 | Rare: cinematic entrance, onboarding splash              |

**Standard pack uses**: `duration-md-short2`, `duration-md-short3`, `duration-md-short4`, `duration-md-medium1`, `duration-md-medium2`, `duration-md-long1`.

---

## M3 Spring Tokens

Material Design 3 defines two spring presets with documented physics.

| Token               | Stiffness | Damping ratio (ζ) | Mass | Approx duration | cssApprox                           | Use                                              |
| ------------------- | --------- | ----------------- | ---- | --------------- | ----------------------------------- | ------------------------------------------------ |
| `spring-md-spatial` | `800`     | `0.90`            | `1`  | ~300ms          | `cubic-bezier(0.2, 0, 0, 1)`        | Large spatial movements: container morph, drawer |
| `spring-md-effects` | `380`     | `0.80`            | `1`  | ~400ms          | `cubic-bezier(0.34, 1.26, 0.64, 1)` | Effects: elevation change, color tween, ripple   |

> Conversion to damping coefficient c: `c = 2 * ζ * sqrt(k * m)`. Spatial: c ≈ 50.9. Effects: c ≈ 31.2.
> For React (motion.dev): `{ type: "spring", stiffness: 800, damping: 51, mass: 1 }` (spatial), `{ stiffness: 380, damping: 31, mass: 1 }` (effects).

---

## M3 Transition Patterns

### Container Transform

Morphs a source element (e.g., FAB, card) into a destination surface (e.g., fullscreen dialog). The signature M3 pattern.

```css
/* CSS approach — requires shared layout context or JS position calculation */
.container-transform-source {
  transition:
    border-radius var(--duration-md-long1) var(--ease-md-emphasized),
    transform var(--duration-md-long1) var(--ease-md-emphasized),
    opacity calc(var(--duration-md-long1) * 0.5)
      var(--ease-md-emphasized-decelerate);
  transform-origin: top left;
}
```

```tsx
// React — motion.dev
import { motion, AnimateSharedLayout, LayoutGroup } from "motion/react";

function ContainerTransform({ items }: { items: Item[] }) {
  const [selected, setSelected] = React.useState<string | null>(null);

  return (
    <LayoutGroup>
      {items.map((item) => (
        <motion.div
          key={item.id}
          layoutId={item.id}
          onClick={() => setSelected(item.id)}
          transition={{ duration: 0.45, ease: [0.2, 0, 0, 1] }}
          className="card cursor-pointer rounded-xl overflow-hidden"
        >
          {/* card content */}
        </motion.div>
      ))}
      {selected && (
        <motion.div
          layoutId={selected}
          transition={{ duration: 0.45, ease: [0.2, 0, 0, 1] }}
          className="fixed inset-4 z-50 rounded-2xl bg-surface"
          onClick={() => setSelected(null)}
        >
          {/* expanded content */}
        </motion.div>
      )}
    </LayoutGroup>
  );
}
```

---

### Shared Axis (X / Y / Z)

Route transitions between related screens. Axis signals the navigation relationship:

- **X (horizontal)**: Peer navigation (tabs, swipe left/right)
- **Y (vertical)**: Parent/child or scroll-contextual navigation
- **Z (depth)**: Forward/back or settings/detail

```tsx
// Shared Axis X — horizontal peer navigation
function SharedAxisX({ direction }: { direction: "forward" | "back" }) {
  const offset = direction === "forward" ? 80 : -80;

  return {
    enter: {
      initial: { opacity: 0, x: offset },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: -offset },
      transition: {
        duration: 0.45, // duration-md-long1
        ease: [0.2, 0, 0, 1], // ease-md-emphasized
        opacity: { duration: 0.15, ease: [0.3, 0, 0.8, 0.15] }, // ease-md-emphasized-accelerate for exit opacity
      },
    },
  };
}
```

```css
/* CSS-only — requires View Transitions API */
@view-transition {
  navigation: auto;
}

::view-transition-old(root) {
  animation: md-slide-out var(--duration-md-long1)
    var(--ease-md-emphasized-accelerate) both;
}
::view-transition-new(root) {
  animation: md-slide-in var(--duration-md-long1)
    var(--ease-md-emphasized-decelerate) both;
}

@keyframes md-slide-out {
  to {
    transform: translateX(-80px);
    opacity: 0;
  }
}
@keyframes md-slide-in {
  from {
    transform: translateX(80px);
    opacity: 0;
  }
}
```

---

### Fade Through

For transitions between incongruent elements (different content categories). Outgoing fades out completely before incoming fades in — no spatial movement.

```tsx
function FadeThrough({
  children,
  key,
}: {
  children: React.ReactNode;
  key: string;
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={key}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{
          exit: { duration: 0.09, ease: [0.3, 0, 0.8, 0.15] }, // ease-md-emphasized-accelerate, short
          enter: { duration: 0.21, ease: [0.05, 0.7, 0.1, 1], delay: 0.09 }, // ease-md-emphasized-decelerate
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

---

## CSS Variables

Emitted to `theme.cssVars` by the Apply route when Standard pack is active:

```css
/* Material Design 3 easings (Standard pack) */
--ease-md-emphasized: cubic-bezier(0.2, 0, 0, 1);
--ease-md-emphasized-decelerate: cubic-bezier(0.05, 0.7, 0.1, 1);
--ease-md-emphasized-accelerate: cubic-bezier(0.3, 0, 0.8, 0.15);
--ease-md-standard: cubic-bezier(0.2, 0, 0, 1);
--ease-md-legacy: cubic-bezier(0.4, 0, 0.2, 1);

/* M3 duration scale (Standard pack subset) */
--duration-md-short2: 100ms;
--duration-md-short3: 150ms;
--duration-md-short4: 200ms;
--duration-md-medium1: 250ms;
--duration-md-medium2: 300ms;
--duration-md-long1: 450ms;

/* Full scale (available via Customize) */
--duration-md-short1: 50ms;
--duration-md-medium3: 350ms;
--duration-md-medium4: 400ms;
--duration-md-long2: 500ms;
--duration-md-long3: 550ms;
--duration-md-long4: 600ms;
--duration-md-extra-long1: 700ms;
--duration-md-extra-long2: 800ms;

/* M3 spring approximations (CSS-only targets) */
--spring-md-spatial-bezier: cubic-bezier(0.2, 0, 0, 1);
--spring-md-spatial-duration: 300ms;
--spring-md-effects-bezier: cubic-bezier(0.34, 1.26, 0.64, 1);
--spring-md-effects-duration: 400ms;
```

---

## Usage Examples

```tsx
// Button with M3 Standard pack transitions
function MaterialButton({ children, onClick }: ButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      transition={{
        duration: 0.2, // duration-md-short4
        ease: [0.2, 0, 0, 1], // ease-md-emphasized
      }}
      className="px-6 py-3 rounded-full bg-primary text-primary-foreground
                 transition-shadow duration-[200ms] ease-[cubic-bezier(0.2,0,0,1)]"
    >
      {children}
    </motion.button>
  );
}

// Page transition — Shared Axis Z (forward navigation)
function PageTransitionZ({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.08 }}
      transition={{
        duration: 0.45,
        ease: [0.05, 0.7, 0.1, 1], // ease-md-emphasized-decelerate for enter
      }}
    >
      {children}
    </motion.div>
  );
}
```

```css
/* CSS-only Material button */
.md-button {
  transition:
    transform var(--duration-md-short4) var(--ease-md-emphasized),
    box-shadow var(--duration-md-short4) var(--ease-md-emphasized);
}
.md-button:hover {
  transform: translateY(-1px);
}
.md-button:active {
  transform: scale(0.98);
}

@media (prefers-reduced-motion: reduce) {
  .md-button {
    transition: none;
  }
}
```
