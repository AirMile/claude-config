# Dashboard: theme Section (project.json)

> Part of the dashboard schema docs — see [DASHBOARD.md](DASHBOARD.md) for the section map. This file covers the `theme` section of `project.json`: design tokens, motion packs, spring physics, choreography, and glass surfaces. The rest of the `project.json` schema lives in [DASHBOARD-PROJECT.md](DASHBOARD-PROJECT.md).

## theme

**Design system source of truth.** `theme` contains all design tokens (colors, typography, spacing, borderRadius, shadows, modes, motion, interactions, cssVars) plus animation packs, spring physics, choreography, and surface effects. The dashboard UI renders this as the "Design System" section.

**Skill ownership:**

- Base tokens (colors, typography, spacing, shadows, motion.durations, motion.easings, interactions): managed by `/design-tokens`
- Animation packs + springs + choreography + surfaces: managed by `/design-tokens` (Motion Pack route)

```json
{
  "domain": "web",
  "colors": {
    "main": [
      {
        "token": "dark",
        "value": "#1a1a2e",
        "usage": "Primary text, dark backgrounds"
      },
      { "token": "light", "value": "#ffffff", "usage": "Light backgrounds" }
    ],
    "accent": [
      {
        "token": "accent-primary",
        "value": "#3B82F6",
        "usage": "CTAs, links, focus"
      }
    ],
    "semantic": [
      { "token": "success", "value": "#10B981", "usage": "Positive feedback" }
    ]
  },
  "typography": {
    "families": {
      "heading": "Inter, sans-serif",
      "body": "Inter, sans-serif",
      "mono": "JetBrains Mono, monospace"
    },
    "sizes": [{ "token": "text-base", "size": "1rem", "lineHeight": "1.5rem" }]
  },
  "spacing": {
    "base": "4px",
    "scale": [
      { "token": "spacing-4", "value": "16px", "usage": "Component padding" }
    ]
  },
  "breakpoints": [
    { "token": "screen-md", "value": "768px", "target": "Tablets" }
  ],
  "borderRadius": [
    { "token": "rounded-md", "value": "0.375rem", "usage": "Buttons, inputs" }
  ],
  "shadows": [
    {
      "token": "shadow-md",
      "value": "0 4px 6px -1px rgb(0 0 0 / 0.1)",
      "usage": "Cards"
    }
  ],
  "motion": {
    "durations": [
      {
        "token": "duration-fast",
        "value": "200ms",
        "usage": "Tooltip, hover state"
      }
    ],
    "easings": [
      {
        "token": "ease-out",
        "value": "cubic-bezier(0.25, 1, 0.5, 1)",
        "usage": "Elements entering"
      }
    ],
    "pack": "standard",
    "axes": {
      "expressiveness": "standard",
      "springiness": "smooth",
      "tempo": "normal",
      "surfaces": "flat"
    },
    "spring": [
      {
        "token": "spring-snappy",
        "stiffness": 300,
        "damping": 25,
        "mass": 1,
        "cssApprox": "cubic-bezier(0.4, 1.15, 0.7, 1.05)",
        "cssDuration": "420ms",
        "usage": "Press, tap feedback"
      }
    ],
    "choreography": {
      "entrance": "entrance.float-in",
      "exit": "exit.fade-out",
      "success": null
    }
  },
  "interactions": {
    "focusRing": {
      "width": "2px",
      "color": "var(--color-accent-primary)",
      "offset": "2px"
    },
    "hover": {
      "transition": "var(--duration-fast) var(--ease-out)",
      "transform": "translateY(-1px)"
    },
    "active": { "transform": "scale(0.98)" }
  },
  "surfaces": {
    "glass": {
      "enabled": false,
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
  },
  "modes": {
    "light": ":root { --background: #fff; --foreground: #1a1a2e; }",
    "dark": ".dark { --background: #1a1a2e; --foreground: #fff; }"
  },
  "cssVars": ":root { --color-dark: #1a1a2e; --color-light: #fff; --font-heading: Inter, sans-serif; }",
  "godotTheme": {
    "resourcePath": "res://ui/theme/main.tres",
    "darkResourcePath": "res://ui/theme/main_dark.tres",
    "fonts": [
      { "token": "heading", "resource": "res://ui/theme/fonts/inter.tres" }
    ],
    "motionScript": "res://ui/theme/motion_tokens.gd",
    "generatedAt": "2026-06-29T14:00:00Z"
  },
  "setupContext": [
    {
      "source": "vercel-labs/web-interface-guidelines",
      "url": "https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md",
      "fetchedAt": "2026-05-25T14:00:00Z",
      "appliedBy": "design-tokens@3.7.1"
    }
  ]
}
```

`domain` = active rendering domain (`"web" | "game" | "native"`, default `"web"`) — selects which export block and renderer the design skills use. Resolution rules: see [DOMAIN.md](DOMAIN.md). The structured vocabulary tokens above (colors, typography, spacing, borderRadius, shadows, motion springs/choreography) are **domain-neutral** — the single source of truth. The export blocks below are **derived** per domain.
`cssVars` = complete CSS variables export — **web domain** (derived; consumed by `/design-create` and `/design-check`)
`modes` = light/dark mode CSS (object with mode name as key) — **web domain**
`godotTheme` = **game domain** export (derived; written by `/design-tokens` emit-godot route). Points at the generated Godot resources rather than inlining them: `resourcePath`/`darkResourcePath` = the `Theme` `.tres` files written into the Godot project (dark mode is a **separate Theme variant** — Godot has no CSS cascade); `fonts[]` = generated `FontFile` resources per typography token; `motionScript` = a GDScript autoload exposing duration/spring tables for `Tween` use (Godot Theme has no motion slot). Glass/backdrop-filter has no native Godot equivalent → `surfaces.glass` falls back to solid (or a shader, out of scope). Consumed by `/design-create` render-godot route.
`motion.pack` + `motion.axes` + `motion.spring[]` + `motion.choreography{}` + `surfaces{}` = managed by `/design-tokens` (Motion Pack route)
`setupContext[]` = append-only log of external sources used during setup (written by `/design-tokens` Create and `/design-create` Convert); each entry: `{source, url, fetchedAt, appliedBy}`; keyed on `appliedBy` — re-run replaces, does not duplicate
Other fields = structured tokens per category

**Merge strategy:** OVERWRITE — all fields owned and written by `/design-tokens` (tokens + motion pack routes). See [DASHBOARD-PROJECT.md](DASHBOARD-PROJECT.md) § Merge strategy per section.
