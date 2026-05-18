# Spring Physics Reference

Conversion algorithm, canonical spring tokens, and per-library mapping table.

---

## Spring Tokens per Source

### Apple pack — custom iOS-tuned springs

| Token           | k (stiffness) | c (damping) | m (mass) | ζ (ratio) | Duration | cssApprox                            | Use                         |
| --------------- | ------------- | ----------- | -------- | --------- | -------- | ------------------------------------ | --------------------------- |
| `spring-gentle` | 170           | 26          | 1        | 1.00      | 600ms    | `cubic-bezier(0.33, 1, 0.68, 1)`     | Modal/drawer reveal         |
| `spring-smooth` | 220           | 28          | 1        | 0.95      | 500ms    | `cubic-bezier(0.32, 1, 0.68, 1)`     | Hover lift, accordion       |
| `spring-snappy` | 300           | 25          | 1        | 0.72      | 420ms    | `cubic-bezier(0.4, 1.15, 0.7, 1.05)` | Press, toggle, tap feedback |
| `spring-bouncy` | 380           | 18          | 1        | 0.46      | 700ms    | `cubic-bezier(0.34, 1.56, 0.64, 1)`  | Success pulse, Playful pack |

`ζ < 1` = underdamped (some overshoot). `ζ = 1` = critically damped (no overshoot, fastest settle). `ζ > 1` = overdamped (slow, no overshoot).

### Material Design 3 — documented spring presets (Standard / Playful pack)

Source: m3.material.io/styles/motion — publicly specified spring parameters.

| Token               | k (stiffness) | c (damping) | m (mass) | ζ (ratio) | Duration | cssApprox                           | Use                                      |
| ------------------- | ------------- | ----------- | -------- | --------- | -------- | ----------------------------------- | ---------------------------------------- |
| `spring-md-spatial` | 800           | 51          | 1        | 0.90      | 300ms    | `cubic-bezier(0.2, 0, 0, 1)`        | Large spatial: container morph, drawer   |
| `spring-md-effects` | 380           | 31          | 1        | 0.80      | 400ms    | `cubic-bezier(0.34, 1.26, 0.64, 1)` | Effects: elevation change, ripple, color |

> **Damping coefficient c**: `c = 2 × ζ × sqrt(k × m)`. Spatial: `c = 2 × 0.9 × sqrt(800) ≈ 50.9`, rounded to 51. Effects: `c = 2 × 0.8 × sqrt(380) ≈ 31.2`, rounded to 31.
>
> **Motion library usage** (React / motion.dev): `{ type: "spring", stiffness: 800, damping: 51, mass: 1 }` (spatial), `{ stiffness: 380, damping: 31, mass: 1 }` (effects).

---

## CSS Variables

Emitted to `theme.cssVars` by the Apply route:

```css
/* Spring CSS approximations (static fallback for CSS-only targets) */
--spring-gentle-duration: 600ms;
--spring-gentle-bezier: cubic-bezier(0.33, 1, 0.68, 1);
--spring-smooth-duration: 500ms;
--spring-smooth-bezier: cubic-bezier(0.32, 1, 0.68, 1);
--spring-snappy-duration: 420ms;
--spring-snappy-bezier: cubic-bezier(0.4, 1.15, 0.7, 1.05);
--spring-bouncy-duration: 700ms;
--spring-bouncy-bezier: cubic-bezier(0.34, 1.56, 0.64, 1);
```

---

## Conversion Algorithm

From spring parameters `(stiffness k, damping c, mass m)` → duration and cubic-bezier approximation.

```
ω0 = sqrt(k / m)                        // natural frequency (rad/s)
ζ  = c / (2 * sqrt(k * m))              // damping ratio

// Settlement duration (when amplitude < 1% of initial displacement)
if ζ < 1 (underdamped):
  ωd = ω0 * sqrt(1 - ζ²)               // damped frequency
  duration_ms = (-ln(0.01 * sqrt(1 - ζ²)) / (ζ * ω0)) * 1000

if ζ >= 1 (critically/over-damped):
  duration_ms = (ln(100) / ω0) * 1000

// Cubic-bezier approximation (P1, P2 control points)
// For ζ < 1 (underdamped — overshoot > 1.0 on Y axis):
P1x = 0.5 * (1 - ζ)
P1y = 1 + (1 - ζ) * 0.5               // Y > 1 = overshoot
P2x = 0.75
P2y = 1 + (1 - ζ) * 0.25

// For ζ >= 1 (no overshoot):
P1 = (0.33, 1), P2 = (0.68, 1)        // standard ease-out shape, Y clamped ≤ 1
```

**Caveat:** Cubic-bezier can only approximate springs — the actual spring curve is non-polynomial. The approximation is sufficient for CSS transitions on modal-class elements. For interactive elements where frame-by-frame accuracy matters (drag, gesture follow), use a motion library.

---

## Per-Library Mapping Table

Detect stack from `package.json` before generating code. Pass the raw `{stiffness, damping, mass}` values — never the `cssApprox`.

| Stack                      | Detection                 | Import                                      | Spring API                                                            |
| -------------------------- | ------------------------- | ------------------------------------------- | --------------------------------------------------------------------- |
| React + motion.dev         | `"motion"` in deps        | `import { motion } from "motion/react"`     | `transition={{ type: "spring", stiffness: k, damping: c, mass: m }}`  |
| React + Framer Motion v10  | `"framer-motion"` in deps | `import { motion } from "framer-motion"`    | Same as above                                                         |
| Vue 3 + motion-v           | `"motion-v"` in deps      | `import { Motion } from "motion-v"`         | `:transition="{ type: 'spring', stiffness: k, damping: c, mass: m }"` |
| Svelte + svelte/motion     | `"svelte"` in deps        | `import { spring } from "svelte/motion"`    | `spring(value, { stiffness: k/10000, damping: c/100 })` ¹             |
| SolidJS + @motionone/solid | `"solid-js"` in deps      | `import { Motion } from "@motionone/solid"` | Same as motion.dev format                                             |
| Vanilla / Astro / SSR      | No SPA framework          | CSS only                                    | Use `--spring-{token}-bezier` + `--spring-{token}-duration`           |
| Tailwind v4                | `"tailwindcss": "^4"`     | CSS `@theme` block                          | Extend with custom `--animate-*` properties                           |

¹ Svelte's `spring()` uses a different parameter scale: `stiffness` is 0–1, `damping` is 0–1. Convert: `svelte_stiffness = k / 10000`, `svelte_damping = c / 100` (rough approximation for common spring ranges).

---

## Code Examples

### React — motion.dev

```tsx
import { motion } from "motion/react";

// spring-snappy (stiffness: 300, damping: 25, mass: 1)
<motion.button
  whileTap={{ scale: 0.94 }}
  transition={{ type: "spring", stiffness: 300, damping: 25, mass: 1 }}
>
  Press
</motion.button>

// spring-gentle for modal
<motion.div
  initial={{ y: "100%", opacity: 0 }}
  animate={{ y: 0, opacity: 1 }}
  exit={{ y: "100%", opacity: 0 }}
  transition={{ type: "spring", stiffness: 170, damping: 26, mass: 1 }}
>
  {children}
</motion.div>
```

### Vue — motion-v

```vue
<Motion
  :initial="{ y: '100%', opacity: 0 }"
  :animate="{ y: '0%', opacity: 1 }"
  :transition="{ type: 'spring', stiffness: 170, damping: 26, mass: 1 }"
>
  <slot />
</Motion>
```

### Svelte — svelte/motion

```svelte
<script>
  import { spring } from "svelte/motion";
  // spring-snappy: k=300, c=25 → stiffness≈0.03, damping≈0.25
  const scale = spring(1, { stiffness: 0.03, damping: 0.25 });
</script>

<button on:mousedown={() => scale.set(0.94)} on:mouseup={() => scale.set(1)}
  style="transform: scale({$scale})">Press</button>
```

### CSS only (vanilla / static render)

```css
.press-element {
  transition: transform var(--spring-snappy-duration)
    var(--spring-snappy-bezier);
}
.press-element:active {
  transform: scale(0.94);
}

@media (prefers-reduced-motion: reduce) {
  .press-element {
    transition: none;
  }
}
```
