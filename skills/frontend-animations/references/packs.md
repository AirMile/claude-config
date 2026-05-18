# Animation Pack Definitions

Source of truth for all packs. Each pack is a complete JSON delta for `theme.motion.*` and `theme.surfaces.*`.

When Create route fires, pick the matching pack below and write its delta (delta-write: only owned keys).

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

Extra easings added to `motion.easings[]`: none (uses base `ease-out` / `ease-in` / `ease-in-out`).

**Hover:** `translateY(-1px)` · **Press:** `scale(0.98)` · **Entrance:** `opacity + translateY(8px→0)` 300ms ease-out

---

## Pack: Standard _(default for new projects)_

**Feel:** Polished. Stagger reveals, modal slides, route fades. Signals the app has been designed.

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

Extra easings added to `motion.easings[]`: none (uses base curves).

**Hover:** `translateY(-2px)` + shadow bump · **Press:** `scale(0.97)` spring-snappy · **Modal:** slide-up 350ms spring-smooth

---

## Pack: Expressive (Apple)

**Feel:** iOS/macOS precision. Spring physics, iOS easings, glass surfaces, view transitions.

```json
{
  "motion": {
    "pack": "expressive",
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

Extra easings added to `motion.easings[]` (all six iOS curves + three iOS durations):

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

**Feel:** Delight-forward. Bouncy springs, celebration micro-moments, attention choreography. Everything from Expressive, plus more.

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

Same extra easings and durations as Expressive pack (all six iOS curves + three iOS durations).

**Usage rules (anti-clichés):**

- `attention.wiggle`: only on user-initiated success/attention moments — never on every hover
- `success.confetti`: opt-in per-component via `design.components[i].motion.onSuccess: "success.confetti"`. Max 30 particles, GPU-only, auto-disabled under `prefers-reduced-motion`
- `press.squeeze`: replaces standard `scale(0.98)` with `scale(0.94 → 1.02 → 1)` spring-bouncy
- `surface.tilt`: pointer-tracking 3D tilt, max 6deg, requestAnimationFrame-throttled, disabled on touch
- Choreography is **available** via the pack — it only fires where `design.components[i].motion.*` explicitly references it
