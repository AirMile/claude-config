# Animation Pack Definitions

Source of truth for all packs. Each pack is a complete JSON delta for `theme.motion.*` and `theme.surfaces.*`.

When Create route fires, pick the matching pack below and write its delta (delta-write: only owned keys).

**Pack sources**: none (neutral) · subtle (web-baseline: Linear/GitHub) · standard (Material Design 3) · apple (Apple iOS/macOS) · playful (Apple + Material 3 Expressive accents). Fluent 2 and IBM Carbon are available as opt-in extras via Customize — see `fluent-motion.md` and `carbon-motion.md`.

---

## Pack: None

**Feel:** Static. No transitions beyond color/opacity changes.

```json
{
  "motion": {
    "pack": "none",
    "axes": {
      "expressiveness": "subtle",
      "springiness": "linear",
      "tempo": "normal",
      "surfaces": "flat"
    },
    "spring": [],
    "choreography": {}
  },
  "surfaces": {
    "glass": {
      "enabled": false,
      "blur": "20px",
      "saturation": "180%",
      "tint": "",
      "border": "",
      "vibrancy": false,
      "fallback": "solid"
    },
    "elevation": []
  }
}
```

Extra easings added to `motion.easings[]`: none.

---

## Pack: Subtle

**Source**: Web baseline — observed motion conventions from Linear, GitHub Primer, Vercel, Stripe. Details: `web-baseline.md`.

**Feel:** Calm and professional. Hover-lift, press-scale, smooth fades. Nearest to "no motion" while still feeling designed.

```json
{
  "motion": {
    "pack": "subtle",
    "axes": {
      "expressiveness": "subtle",
      "springiness": "smooth",
      "tempo": "normal",
      "surfaces": "flat"
    },
    "spring": [
      {
        "token": "spring-smooth",
        "stiffness": 220,
        "damping": 28,
        "mass": 1,
        "cssApprox": "cubic-bezier(0.32, 1, 0.68, 1)",
        "cssDuration": "500ms",
        "usage": "Hover lift, accordion"
      }
    ],
    "choreography": {
      "entrance": "entrance.float-in",
      "exit": "exit.fade-out",
      "success": null,
      "attention": null,
      "error": "error.shake"
    }
  },
  "surfaces": {
    "glass": {
      "enabled": false,
      "blur": "20px",
      "saturation": "180%",
      "tint": "",
      "border": "",
      "vibrancy": false,
      "fallback": "solid"
    },
    "elevation": [
      {
        "token": "elevation-1",
        "shadow": "shadow-sm",
        "tint": "none",
        "usage": "Resting cards"
      },
      {
        "token": "elevation-2",
        "shadow": "shadow-md",
        "tint": "surface-raised",
        "usage": "Hover, dropdowns"
      }
    ]
  }
}
```

Extra easings added to `motion.easings[]` (web baseline curves — see `web-baseline.md`):

```json
[
  {
    "token": "ease-expo-out",
    "value": "cubic-bezier(0.16, 1, 0.3, 1)",
    "usage": "Hover enter, panel reveal — the Linear curve"
  },
  {
    "token": "ease-cubic-out",
    "value": "cubic-bezier(0.33, 1, 0.68, 1)",
    "usage": "Dropdown, popover, general interactive feedback — GitHub Primer / Vercel"
  }
]
```

Extra durations added to `motion.durations[]`: none (uses base tokens at 100–200ms range per web-baseline.md conventions).

**Hover:** `translateY(-1px)` · **Press:** `scale(0.98)` · **Entrance:** `opacity + translateY(8px→0)` 150ms ease-expo-out

---

## Pack: Standard _(default for new projects)_

**Source**: Material Design 3 (Google) — the most-deployed motion system on the web. Details: `material-motion.md`.

**Feel:** Polished and purposeful. Material 3 emphasized curves for route transitions and modals; spring-snappy for press feedback. Stagger reveals, modal slides, shared-axis route transitions. Signals the app has been designed without being platform-specific.

```json
{
  "motion": {
    "pack": "standard",
    "axes": {
      "expressiveness": "standard",
      "springiness": "snappy",
      "tempo": "normal",
      "surfaces": "elevated"
    },
    "spring": [
      {
        "token": "spring-smooth",
        "stiffness": 220,
        "damping": 28,
        "mass": 1,
        "cssApprox": "cubic-bezier(0.32, 1, 0.68, 1)",
        "cssDuration": "500ms",
        "usage": "Hover lift, accordion"
      },
      {
        "token": "spring-snappy",
        "stiffness": 300,
        "damping": 25,
        "mass": 1,
        "cssApprox": "cubic-bezier(0.4, 1.15, 0.7, 1.05)",
        "cssDuration": "420ms",
        "usage": "Press, toggle, tap feedback"
      },
      {
        "token": "spring-md-spatial",
        "stiffness": 800,
        "damping": 51,
        "mass": 1,
        "cssApprox": "cubic-bezier(0.2, 0, 0, 1)",
        "cssDuration": "300ms",
        "usage": "Large spatial movements: container morph, drawer, shared-axis"
      },
      {
        "token": "spring-md-effects",
        "stiffness": 380,
        "damping": 31,
        "mass": 1,
        "cssApprox": "cubic-bezier(0.34, 1.26, 0.64, 1)",
        "cssDuration": "400ms",
        "usage": "Effects: elevation change, ripple, color tween"
      }
    ],
    "choreography": {
      "entrance": "entrance.float-in",
      "exit": "exit.fade-out",
      "success": "success.pulse",
      "attention": null,
      "error": "error.shake",
      "routeTransition": "route.fade-slide",
      "listStagger": "list.stagger-reveal",
      "modalReveal": "modal.slide-up"
    }
  },
  "surfaces": {
    "glass": {
      "enabled": false,
      "blur": "20px",
      "saturation": "180%",
      "tint": "",
      "border": "",
      "vibrancy": false,
      "fallback": "solid"
    },
    "elevation": [
      {
        "token": "elevation-1",
        "shadow": "shadow-sm",
        "tint": "none",
        "usage": "Resting cards"
      },
      {
        "token": "elevation-2",
        "shadow": "shadow-md",
        "tint": "surface-raised",
        "usage": "Hover, dropdowns"
      },
      {
        "token": "elevation-3",
        "shadow": "shadow-lg",
        "tint": "surface-overlay",
        "usage": "Modals, popovers"
      },
      {
        "token": "elevation-4",
        "shadow": "shadow-xl",
        "tint": "surface-floating",
        "usage": "Toasts, command-K"
      }
    ]
  }
}
```

Extra easings added to `motion.easings[]` (Material Design 3 curves — see `material-motion.md`):

```json
[
  {
    "token": "ease-md-emphasized",
    "value": "cubic-bezier(0.2, 0, 0, 1)",
    "usage": "Primary transitions: route changes, dialogs, FAB morphs, bottom sheets"
  },
  {
    "token": "ease-md-emphasized-decelerate",
    "value": "cubic-bezier(0.05, 0.7, 0.1, 1)",
    "usage": "Elements entering: shared-axis enter, container expand"
  },
  {
    "token": "ease-md-emphasized-accelerate",
    "value": "cubic-bezier(0.3, 0, 0.8, 0.15)",
    "usage": "Elements exiting: shared-axis exit, container collapse, dismiss"
  },
  {
    "token": "ease-md-standard",
    "value": "cubic-bezier(0.2, 0, 0, 1)",
    "usage": "Utility transitions: color changes, icon swaps, simple state toggles"
  }
]
```

Extra durations added to `motion.durations[]` (Material Design 3 scale — see `material-motion.md`):

```json
[
  {
    "token": "duration-md-short2",
    "value": "100ms",
    "usage": "Small state: checkbox, chip select"
  },
  {
    "token": "duration-md-short3",
    "value": "150ms",
    "usage": "Small element: tooltip, menu item"
  },
  {
    "token": "duration-md-short4",
    "value": "200ms",
    "usage": "Small container: snackbar, simple fade"
  },
  {
    "token": "duration-md-medium1",
    "value": "250ms",
    "usage": "Medium: FAB collapse, nav rail change"
  },
  {
    "token": "duration-md-medium2",
    "value": "300ms",
    "usage": "Standard: card expand, list item"
  },
  {
    "token": "duration-md-long1",
    "value": "450ms",
    "usage": "Complex: shared-axis route, container morph"
  }
]
```

**Hover:** `translateY(-2px)` + shadow bump · **Press:** `scale(0.97)` spring-snappy · **Route:** shared-axis / fade-slide 450ms ease-md-emphasized

---

## Pack: Apple (iOS / macOS)

**Source**: Apple iOS and macOS HIG, WWDC sessions, SwiftUI documentation. Details: `ios-easings.md`.

**Feel:** iOS/macOS precision. Spring physics, iOS easings, glass surfaces, view transitions.

> **Migration note**: Projects created with the previous pack name `"expressive"` are automatically offered a rename to `"apple"` by PHASE 0 of `/design-tokens`. All other theme keys remain byte-identical.

```json
{
  "motion": {
    "pack": "apple",
    "axes": {
      "expressiveness": "expressive",
      "springiness": "snappy",
      "tempo": "normal",
      "surfaces": "glass"
    },
    "spring": [
      {
        "token": "spring-gentle",
        "stiffness": 170,
        "damping": 26,
        "mass": 1,
        "cssApprox": "cubic-bezier(0.33, 1, 0.68, 1)",
        "cssDuration": "600ms",
        "usage": "Modal/drawer reveal"
      },
      {
        "token": "spring-smooth",
        "stiffness": 220,
        "damping": 28,
        "mass": 1,
        "cssApprox": "cubic-bezier(0.32, 1, 0.68, 1)",
        "cssDuration": "500ms",
        "usage": "Hover lift, accordion"
      },
      {
        "token": "spring-snappy",
        "stiffness": 300,
        "damping": 25,
        "mass": 1,
        "cssApprox": "cubic-bezier(0.4, 1.15, 0.7, 1.05)",
        "cssDuration": "420ms",
        "usage": "Press, toggle, tap feedback"
      }
    ],
    "choreography": {
      "entrance": "entrance.float-in",
      "exit": "exit.fade-out",
      "success": "success.pulse",
      "attention": null,
      "error": "error.shake",
      "routeTransition": "route.ios-push",
      "listStagger": "list.stagger-reveal",
      "modalReveal": "modal.ios-sheet",
      "loadingBob": "loading.bob"
    }
  },
  "surfaces": {
    "glass": {
      "enabled": true,
      "blur": "20px",
      "saturation": "180%",
      "tint": "color-mix(in oklch, var(--color-surface) 70%, transparent)",
      "border": "1px solid color-mix(in oklch, var(--color-foreground) 8%, transparent)",
      "vibrancy": false,
      "fallback": "solid"
    },
    "elevation": [
      {
        "token": "elevation-1",
        "shadow": "shadow-sm",
        "tint": "none",
        "usage": "Resting cards"
      },
      {
        "token": "elevation-2",
        "shadow": "shadow-md",
        "tint": "surface-raised",
        "usage": "Hover, dropdowns"
      },
      {
        "token": "elevation-3",
        "shadow": "shadow-lg",
        "tint": "surface-overlay",
        "usage": "Modals, popovers"
      },
      {
        "token": "elevation-4",
        "shadow": "shadow-xl",
        "tint": "surface-floating",
        "usage": "Toasts, command-K"
      }
    ]
  }
}
```

Extra easings added to `motion.easings[]` (all six iOS curves — see `ios-easings.md`):

```json
[
  {
    "token": "ease-ios-default",
    "value": "cubic-bezier(0.42, 0, 0.58, 1)",
    "usage": "Default state changes"
  },
  {
    "token": "ease-ios-out",
    "value": "cubic-bezier(0.25, 0.1, 0.25, 1)",
    "usage": "Sheets sliding in, elements entering"
  },
  {
    "token": "ease-ios-in",
    "value": "cubic-bezier(0.42, 0, 1, 1)",
    "usage": "Items leaving viewport"
  },
  {
    "token": "ease-ios-spring",
    "value": "cubic-bezier(0.32, 0.72, 0, 1)",
    "usage": "Drawer, sheet, page-push — the iconic iOS swipe-in"
  },
  {
    "token": "ease-ios-snappy",
    "value": "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    "usage": "Press feedback, toggle, switch flick"
  },
  {
    "token": "ease-ios-bouncy",
    "value": "cubic-bezier(0.5, 1.6, 0.4, 0.8)",
    "usage": "Modal present, alert appear, success"
  }
]
```

Extra durations added to `motion.durations[]`:

```json
[
  {
    "token": "duration-ios-fast",
    "value": "200ms",
    "usage": "iOS fast system tween"
  },
  {
    "token": "duration-ios-default",
    "value": "350ms",
    "usage": "Standard UIView.animate(duration: 0.35)"
  },
  {
    "token": "duration-ios-modal",
    "value": "500ms",
    "usage": "Sheet present / push navigation"
  }
]
```

**Glass:** enabled — only for navigation bars, sheets, modals over rich backgrounds (see DESIGN.md Glass rules).

---

## Pack: Playful (Whimsical)

**Source**: Apple iOS/macOS (base) + Material Design 3 Expressive accents (bouncy emphasis) + custom whimsy. Details: `ios-easings.md`, `material-motion.md`.

**Feel:** Delight-forward. Bouncy springs, celebration micro-moments, attention choreography. Everything from Apple pack, plus bounce physics and Material 3 spatial spring for dramatic reveals.

```json
{
  "motion": {
    "pack": "playful",
    "axes": {
      "expressiveness": "playful",
      "springiness": "bouncy",
      "tempo": "normal",
      "surfaces": "glass"
    },
    "spring": [
      {
        "token": "spring-gentle",
        "stiffness": 170,
        "damping": 26,
        "mass": 1,
        "cssApprox": "cubic-bezier(0.33, 1, 0.68, 1)",
        "cssDuration": "600ms",
        "usage": "Modal/drawer reveal"
      },
      {
        "token": "spring-smooth",
        "stiffness": 220,
        "damping": 28,
        "mass": 1,
        "cssApprox": "cubic-bezier(0.32, 1, 0.68, 1)",
        "cssDuration": "500ms",
        "usage": "Hover lift, accordion"
      },
      {
        "token": "spring-snappy",
        "stiffness": 300,
        "damping": 25,
        "mass": 1,
        "cssApprox": "cubic-bezier(0.4, 1.15, 0.7, 1.05)",
        "cssDuration": "420ms",
        "usage": "Press, toggle, tap feedback"
      },
      {
        "token": "spring-bouncy",
        "stiffness": 380,
        "damping": 18,
        "mass": 1,
        "cssApprox": "cubic-bezier(0.34, 1.56, 0.64, 1)",
        "cssDuration": "700ms",
        "usage": "Success pulse, attention, confetti trigger"
      },
      {
        "token": "spring-md-spatial",
        "stiffness": 800,
        "damping": 51,
        "mass": 1,
        "cssApprox": "cubic-bezier(0.2, 0, 0, 1)",
        "cssDuration": "300ms",
        "usage": "Dramatic large reveals: hero morph, fullscreen expansion"
      }
    ],
    "choreography": {
      "entrance": "entrance.float-in",
      "exit": "exit.fade-out",
      "success": "success.pulse",
      "successCelebrate": "success.confetti",
      "attention": "attention.wiggle",
      "error": "error.shake",
      "press": "press.squeeze",
      "countUp": "count-up.number",
      "routeTransition": "route.ios-push",
      "listStagger": "list.stagger-reveal",
      "modalReveal": "modal.ios-sheet",
      "loadingBob": "loading.bob",
      "tilt": "surface.tilt"
    }
  },
  "surfaces": {
    "glass": {
      "enabled": true,
      "blur": "20px",
      "saturation": "180%",
      "tint": "color-mix(in oklch, var(--color-surface) 70%, transparent)",
      "border": "1px solid color-mix(in oklch, var(--color-foreground) 8%, transparent)",
      "vibrancy": false,
      "fallback": "solid"
    },
    "elevation": [
      {
        "token": "elevation-1",
        "shadow": "shadow-sm",
        "tint": "none",
        "usage": "Resting cards"
      },
      {
        "token": "elevation-2",
        "shadow": "shadow-md",
        "tint": "surface-raised",
        "usage": "Hover, dropdowns"
      },
      {
        "token": "elevation-3",
        "shadow": "shadow-lg",
        "tint": "surface-overlay",
        "usage": "Modals, popovers"
      },
      {
        "token": "elevation-4",
        "shadow": "shadow-xl",
        "tint": "surface-floating",
        "usage": "Toasts, command-K"
      }
    ]
  }
}
```

Extra easings added to `motion.easings[]` (all six iOS curves + Material 3 emphasized — see `ios-easings.md`, `material-motion.md`):

Same six iOS curves as Apple pack, plus:

```json
[
  {
    "token": "ease-md-emphasized",
    "value": "cubic-bezier(0.2, 0, 0, 1)",
    "usage": "Dramatic spatial entrances — Material 3 Expressive accent"
  }
]
```

Extra durations added to `motion.durations[]`:

Same three iOS durations as Apple pack, plus:

```json
[
  {
    "token": "duration-md-long2",
    "value": "500ms",
    "usage": "Large dramatic reveals — pairs with spring-md-spatial"
  }
]
```

**Usage rules (anti-clichés):**

- `attention.wiggle`: only on user-initiated success/attention moments — never on every hover
- `success.confetti`: opt-in per-component via `design.components[i].motion.onSuccess: "success.confetti"`. Max 30 particles, GPU-only, auto-disabled under `prefers-reduced-motion`
- `press.squeeze`: replaces standard `scale(0.98)` with `scale(0.94 → 1.02 → 1)` spring-bouncy
- `surface.tilt`: pointer-tracking 3D tilt, max 6deg, requestAnimationFrame-throttled, disabled on touch
- `spring-md-spatial`: only for hero-class reveals, not everyday interactions — its high stiffness (k=800) makes small elements feel rigid
- Choreography is **available** via the pack — it only fires where `design.components[i].motion.*` explicitly references it
