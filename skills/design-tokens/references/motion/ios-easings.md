# iOS / Apple Easing Reference

Canonical cubic-bezier values for the Apple and Playful packs. These match Apple's documented animation curves from iOS/macOS HIG, WWDC sessions, and SwiftUI documentation.

Used by the Create route when setting `motion.pack = "apple"` or `"playful"`. Values are added to `motion.easings[]` in `project.json`.

**Other sources:** For Material Design 3, see `material-motion.md`. For Fluent 2, see `fluent-motion.md`. For IBM Carbon, see `carbon-motion.md`. For Linear/GitHub/Vercel baseline, see `web-baseline.md`.

---

## The Six iOS Easings

| Token              | cubic-bezier                              | iOS / macOS source                                          | Use                                                            |
| ------------------ | ----------------------------------------- | ----------------------------------------------------------- | -------------------------------------------------------------- |
| `ease-ios-default` | `cubic-bezier(0.42, 0, 0.58, 1)`          | `UIView.AnimationCurve.easeInOut`                           | Default state changes, system transitions                      |
| `ease-ios-out`     | `cubic-bezier(0.25, 0.1, 0.25, 1)`        | `UIView.AnimationCurve.easeOut`                             | Sheets sliding in, elements entering view                      |
| `ease-ios-in`      | `cubic-bezier(0.42, 0, 1, 1)`             | `UIView.AnimationCurve.easeIn`                              | Items leaving viewport                                         |
| `ease-ios-spring`  | `cubic-bezier(0.32, 0.72, 0, 1)`          | iOS swipe / push (UIScrollView deceleration, sheet present) | Drawer, sheet, page-push transitions — the iconic iOS swipe-in |
| `ease-ios-snappy`  | `cubic-bezier(0.175, 0.885, 0.32, 1.275)` | SwiftUI `.snappy` (iOS 17+)                                 | Press feedback, toggle, switch flick                           |
| `ease-ios-bouncy`  | `cubic-bezier(0.5, 1.6, 0.4, 0.8)`        | SwiftUI `.bouncy(duration: 0.5, extraBounce: 0.2)`          | Modal present, alert appear, success moments                   |

## The Three iOS Durations

| Token                  | Value   | iOS equivalent                            | Use                                |
| ---------------------- | ------- | ----------------------------------------- | ---------------------------------- |
| `duration-ios-fast`    | `200ms` | `.fast` system tween                      | Quick feedback, icon state changes |
| `duration-ios-default` | `350ms` | Standard `UIView.animate(duration: 0.35)` | Most UI transitions                |
| `duration-ios-modal`   | `500ms` | Sheet present / push navigation           | Modal/sheet reveal                 |

---

## CSS Variables

These are emitted to `theme.cssVars` by the Apply route:

```css
/* iOS easings (Expressive / Playful pack) */
--ease-ios-default: cubic-bezier(0.42, 0, 0.58, 1);
--ease-ios-out: cubic-bezier(0.25, 0.1, 0.25, 1);
--ease-ios-in: cubic-bezier(0.42, 0, 1, 1);
--ease-ios-spring: cubic-bezier(0.32, 0.72, 0, 1);
--ease-ios-snappy: cubic-bezier(0.175, 0.885, 0.32, 1.275);
--ease-ios-bouncy: cubic-bezier(0.5, 1.6, 0.4, 0.8);

/* iOS durations */
--duration-ios-fast: 200ms;
--duration-ios-default: 350ms;
--duration-ios-modal: 500ms;
```

---

## Usage Examples

### iOS Sheet / Drawer (enter)

```css
.sheet {
  transform: translateY(100%);
  transition: transform var(--duration-ios-modal) var(--ease-ios-spring);
}
.sheet[data-open="true"] {
  transform: translateY(0);
}
```

### iOS Sheet (exit — 75% of enter duration, ease-in)

```css
.sheet[data-open="false"] {
  transform: translateY(100%);
  transition-duration: calc(var(--duration-ios-modal) * 0.75);
  transition-timing-function: var(--ease-ios-in);
}
```

### iOS Press Feedback

```css
.ios-button {
  transition: transform var(--duration-ios-fast) var(--ease-ios-snappy);
}
.ios-button:active {
  transform: scale(0.96);
}
```

### iOS Default State Change

```css
.toggle-indicator {
  transition: background-color var(--duration-ios-default)
    var(--ease-ios-default);
}
```

### React / motion.dev — iOS spring approximation

When `motion.dev` is detected in `package.json`, use the real spring rather than the cubic-bezier. For the "iOS spring" feel, use `spring-gentle` or `spring-smooth` from `spring-math.md`:

```tsx
import { motion } from "motion/react";

<motion.div
  initial={{ y: "100%" }}
  animate={{ y: 0 }}
  exit={{ y: "100%" }}
  transition={{ type: "spring", stiffness: 220, damping: 28, mass: 1 }}
>
  {children}
</motion.div>;
```

---

## Provenance

- `ease-ios-default` / `ease-ios-out` / `ease-ios-in`: Apple Developer Documentation — `UIView.AnimationCurve` enum values, approximated to cubic-bezier form
- `ease-ios-spring`: Measured from iOS sheet presentation (UIScrollView deceleration coefficient 0.998, approximated). Commonly cited in WWDC sessions on animation. Cross-verified against the [iOS Animations wiki](https://github.com/nicklockwood/SwiftFormat) community reference.
- `ease-ios-snappy`: SwiftUI `.snappy` timing curve, iOS 17+. Documented in WWDC '23 "Animate symbols in your app"
- `ease-ios-bouncy`: SwiftUI `.bouncy(duration: 0.5, extraBounce: 0.2)`, parameterized to cubic-bezier approximation

**Note:** iOS uses physics-based springs natively. These cubic-bezier values are best-effort approximations for CSS contexts. When `motion.dev` / Framer Motion is available, use real spring physics (see `spring-math.md`) for closer fidelity.
