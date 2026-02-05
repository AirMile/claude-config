# Brand Presets

Voorgedefinieerde kleur- en typografie combinaties voor snelle theme setup.

---

## Anthropic Style

Geïnspireerd door Anthropic's officiële brand identity.

### Main Colors
| Token | Value | Preview |
|-------|-------|---------|
| `dark` | #141413 | Primary text, dark backgrounds |
| `light` | #faf9f5 | Light backgrounds, text on dark |
| `mid-gray` | #b0aea5 | Secondary elements |
| `light-gray` | #e8e6dc | Subtle backgrounds |

### Accent Colors
| Token | Value | Usage |
|-------|-------|-------|
| `accent-primary` | #d97757 | Orange - Primary accent |
| `accent-secondary` | #6a9bcc | Blue - Secondary accent |
| `accent-tertiary` | #788c5d | Green - Tertiary accent |

### Typography
| Token | Primary | Fallback |
|-------|---------|----------|
| `font-heading` | Poppins | Arial, sans-serif |
| `font-body` | Lora | Georgia, serif |
| `font-mono` | Fira Code | Consolas, monospace |

### Semantic Colors
| Token | Value |
|-------|-------|
| `success` | #788c5d |
| `warning` | #d97757 |
| `error` | #c45d4f |
| `info` | #6a9bcc |

---

## Minimal Mono

Minimalistische zwart-wit met één accent kleur.

### Main Colors
| Token | Value |
|-------|-------|
| `dark` | #000000 |
| `light` | #ffffff |
| `mid-gray` | #888888 |
| `light-gray` | #f0f0f0 |

### Accent Colors
| Token | Value | Usage |
|-------|-------|-------|
| `accent-primary` | #333333 | Single accent (dark gray) |
| `accent-secondary` | #666666 | Secondary (medium gray) |
| `accent-tertiary` | #999999 | Tertiary (light gray) |

### Typography
| Token | Primary | Fallback |
|-------|---------|----------|
| `font-heading` | system-ui | -apple-system, sans-serif |
| `font-body` | system-ui | -apple-system, sans-serif |
| `font-mono` | ui-monospace | Consolas, monospace |

### Semantic Colors
| Token | Value |
|-------|-------|
| `success` | #22c55e |
| `warning` | #f59e0b |
| `error` | #ef4444 |
| `info` | #3b82f6 |

---

## Warm Earth

Warme aardtinten met elegante serif typografie.

### Main Colors
| Token | Value |
|-------|-------|
| `dark` | #2d2a24 |
| `light` | #f5f2eb |
| `mid-gray` | #9c9689 |
| `light-gray` | #e8e4db |

### Accent Colors
| Token | Value | Usage |
|-------|-------|-------|
| `accent-primary` | #c17f59 | Terracotta - Primary |
| `accent-secondary` | #7b8f6b | Sage green - Secondary |
| `accent-tertiary` | #a67c52 | Warm brown - Tertiary |

### Typography
| Token | Primary | Fallback |
|-------|---------|----------|
| `font-heading` | Playfair Display | Georgia, serif |
| `font-body` | Source Sans Pro | Arial, sans-serif |
| `font-mono` | Source Code Pro | Consolas, monospace |

### Semantic Colors
| Token | Value |
|-------|-------|
| `success` | #7b8f6b |
| `warning` | #d4a574 |
| `error` | #c45d4f |
| `info` | #6b8fa6 |

---

## Cool Tech

Moderne tech-geïnspireerde kleuren met clean sans-serif.

### Main Colors
| Token | Value |
|-------|-------|
| `dark` | #0a1628 |
| `light` | #f0f4f8 |
| `mid-gray` | #64748b |
| `light-gray` | #e2e8f0 |

### Accent Colors
| Token | Value | Usage |
|-------|-------|-------|
| `accent-primary` | #3b82f6 | Blue - Primary |
| `accent-secondary` | #06b6d4 | Cyan - Secondary |
| `accent-tertiary` | #8b5cf6 | Purple - Tertiary |

### Typography
| Token | Primary | Fallback |
|-------|---------|----------|
| `font-heading` | Inter | Arial, sans-serif |
| `font-body` | Inter | Arial, sans-serif |
| `font-mono` | JetBrains Mono | Consolas, monospace |

### Semantic Colors
| Token | Value |
|-------|-------|
| `success` | #22c55e |
| `warning` | #f59e0b |
| `error` | #ef4444 |
| `info` | #06b6d4 |

---

## Preset Applicatie

### CSS Variables Export

Elk preset genereert de volgende CSS:

```css
:root {
  /* Main Colors */
  --color-dark: [preset.dark];
  --color-light: [preset.light];
  --color-mid-gray: [preset.mid-gray];
  --color-light-gray: [preset.light-gray];

  /* Accent Colors */
  --color-accent-primary: [preset.accent-primary];
  --color-accent-secondary: [preset.accent-secondary];
  --color-accent-tertiary: [preset.accent-tertiary];

  /* Semantic Colors */
  --color-success: [preset.success];
  --color-warning: [preset.warning];
  --color-error: [preset.error];
  --color-info: [preset.info];

  /* Typography */
  --font-heading: [preset.font-heading], [preset.heading-fallback];
  --font-body: [preset.font-body], [preset.body-fallback];
  --font-mono: [preset.font-mono], [preset.mono-fallback];
}
```

### Preset Selectie Voorbeeld

```
📋 ANTHROPIC STYLE PREVIEW

┌─────────────────────────────────────────────────┐
│                                                 │
│  ▓▓ dark: #141413     ░░ light: #faf9f5        │
│                                                 │
│  🟠 accent-primary: #d97757 (orange)           │
│  🔵 accent-secondary: #6a9bcc (blue)           │
│  🟢 accent-tertiary: #788c5d (green)           │
│                                                 │
│  Headings: Poppins (Arial fallback)            │
│  Body: Lora (Georgia fallback)                 │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

*Shared resource voor frontend-theme en frontend-wireframe skills*
