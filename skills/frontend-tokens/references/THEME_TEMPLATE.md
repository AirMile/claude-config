# Theme Design Tokens

Project design system with colors, typography, spacing, breakpoints, and motion.

> **Color format:** Use OKLCH where possible — perceptually uniform, better dark mode generation. Lower chroma toward white/black. Tint neutrals with brand-hue (chroma ~0.01). Avoid pure black (`#000`) and pure gray (chroma 0).

---

## Colors

### Main Colors

Base colors for backgrounds and text. Use tinted neutrals, never pure black/grey.

| Token        | Value        | Usage                                                                        |
| ------------ | ------------ | ---------------------------------------------------------------------------- |
| `dark`       | {dark}       | Primary text, dark backgrounds (not #000 — use e.g. `oklch(15% 0.01 <hue>)`) |
| `light`      | {light}      | Light backgrounds, text on dark (lightly tinted, not pure #fff)              |
| `mid-gray`   | {mid-gray}   | Secondary elements, borders (tint with brand-hue)                            |
| `light-gray` | {light-gray} | Subtle backgrounds, dividers (tint with brand-hue)                           |

### Accent Colors

Colors for interactive elements and visual accents.

| Token              | Value              | Usage                                     |
| ------------------ | ------------------ | ----------------------------------------- |
| `accent-primary`   | {accent-primary}   | Primary accent (CTAs, links, focus)       |
| `accent-secondary` | {accent-secondary} | Secondary accent (hover states, badges)   |
| `accent-tertiary`  | {accent-tertiary}  | Tertiary accent (highlights, decorations) |

### Semantic Colors

Meaningful colors for feedback and status.

| Token     | Value     | Usage                             |
| --------- | --------- | --------------------------------- |
| `success` | {success} | Positive feedback, confirmations  |
| `warning` | {warning} | Caution messages, alerts          |
| `error`   | {error}   | Error states, destructive actions |
| `info`    | {info}    | Informational messages            |

### Extended Palette (Optional)

Full color scales for detailed design work. Avoid pure gray (chroma 0) — always use a subtle brand tint.

| Scale   | 50     | 100     | 200     | 300     | 400     | 500     | 600     | 700     | 800     | 900     |
| ------- | ------ | ------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- | ------- |
| Primary | {p-50} | {p-100} | {p-200} | {p-300} | {p-400} | {p-500} | {p-600} | {p-700} | {p-800} | {p-900} |
| Neutral | {n-50} | {n-100} | {n-200} | {n-300} | {n-400} | {n-500} | {n-600} | {n-700} | {n-800} | {n-900} |

---

## Typography

### Font Families

| Token          | Primary        | Fallback           | Usage                       |
| -------------- | -------------- | ------------------ | --------------------------- |
| `font-heading` | {heading-font} | {heading-fallback} | Headings (H1-H3, 24pt+)     |
| `font-body`    | {body-font}    | {body-fallback}    | Body text, paragraphs       |
| `font-mono`    | {mono-font}    | {mono-fallback}    | Code blocks, technical text |

### Smart Application Rules

- **Headings** (24pt and larger): Use `font-heading`
- **Body text**: Use `font-body`
- **Code, pre, kbd elements**: Use `font-mono`
- **Buttons, labels**: Use `font-body` with medium weight

### Font Sizes

Use semantic names — stable on resize, direct design→code mapping.

| Token             | Size            | Line Height | Usage                    |
| ----------------- | --------------- | ----------- | ------------------------ |
| `text-display`    | 3rem (48px)     | 1.1         | Hero headings            |
| `text-title-l`    | 2.25rem (36px)  | 1.2         | Page titles              |
| `text-title-m`    | 1.875rem (30px) | 1.25        | Section titles           |
| `text-title-s`    | 1.5rem (24px)   | 1.3         | Card titles              |
| `text-headline-l` | 1.25rem (20px)  | 1.4         | Subsection headers       |
| `text-headline-m` | 1.125rem (18px) | 1.4         | List headers             |
| `text-headline-s` | 1rem (16px)     | 1.5         | Bold emphasis            |
| `text-body-l`     | 1rem (16px)     | 1.6         | Large body (readability) |
| `text-body-m`     | 0.875rem (14px) | 1.5         | Standard body            |
| `text-body-s`     | 0.75rem (12px)  | 1.4         | Captions, labels         |
| `text-code`       | 0.875rem (14px) | 1.6         | Code blocks              |

### Font Weights

| Token           | Value | Usage              |
| --------------- | ----- | ------------------ |
| `font-light`    | 300   | De-emphasized text |
| `font-normal`   | 400   | Body text          |
| `font-medium`   | 500   | Labels, buttons    |
| `font-semibold` | 600   | Subheadings        |
| `font-bold`     | 700   | Headings, emphasis |

---

## Spacing

Base unit: {spacing-base}

| Token        | Value        | Usage                         |
| ------------ | ------------ | ----------------------------- |
| `spacing-0`  | 0            | No spacing                    |
| `spacing-1`  | {spacing-1}  | Tight spacing (icons, inline) |
| `spacing-2`  | {spacing-2}  | Compact spacing               |
| `spacing-3`  | {spacing-3}  | Default element spacing       |
| `spacing-4`  | {spacing-4}  | Component padding             |
| `spacing-6`  | {spacing-6}  | Section spacing               |
| `spacing-8`  | {spacing-8}  | Large gaps                    |
| `spacing-12` | {spacing-12} | Section margins               |
| `spacing-16` | {spacing-16} | Page sections                 |

---

## Breakpoints

| Token        | Value        | Target                   |
| ------------ | ------------ | ------------------------ |
| `screen-sm`  | {screen-sm}  | Small devices (phones)   |
| `screen-md`  | {screen-md}  | Medium devices (tablets) |
| `screen-lg`  | {screen-lg}  | Large devices (desktops) |
| `screen-xl`  | {screen-xl}  | Extra large screens      |
| `screen-2xl` | {screen-2xl} | Wide screens             |

---

## Border Radius

| Token          | Value    | Usage            |
| -------------- | -------- | ---------------- |
| `rounded-none` | 0        | Sharp corners    |
| `rounded-sm`   | 0.125rem | Subtle rounding  |
| `rounded`      | 0.25rem  | Default rounding |
| `rounded-md`   | 0.375rem | Buttons, inputs  |
| `rounded-lg`   | 0.5rem   | Cards, modals    |
| `rounded-xl`   | 0.75rem  | Large cards      |
| `rounded-2xl`  | 1rem     | Hero sections    |
| `rounded-full` | 9999px   | Pills, avatars   |

---

## Shadows

| Token       | Value                                                               | Usage             |
| ----------- | ------------------------------------------------------------------- | ----------------- |
| `shadow-sm` | 0 1px 2px 0 rgb(0 0 0 / 0.05)                                       | Subtle depth      |
| `shadow`    | 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)       | Default elevation |
| `shadow-md` | 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)    | Cards             |
| `shadow-lg` | 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)  | Dropdowns, modals |
| `shadow-xl` | 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1) | Dialogs           |

---

## Motion

### Durations

| Token              | Value | Usage                              |
| ------------------ | ----- | ---------------------------------- |
| `duration-instant` | 100ms | Button press, toggle, color change |
| `duration-fast`    | 200ms | Tooltip, hover state               |
| `duration-normal`  | 300ms | Menu, accordion, state change      |
| `duration-slow`    | 500ms | Modal, drawer, page transition     |

### Easing

| Token         | Value                          | Usage             |
| ------------- | ------------------------------ | ----------------- |
| `ease-out`    | cubic-bezier(0.25, 1, 0.5, 1)  | Elements entering |
| `ease-in`     | cubic-bezier(0.7, 0, 0.84, 0)  | Elements leaving  |
| `ease-in-out` | cubic-bezier(0.65, 0, 0.35, 1) | State toggles     |

> Exit animations = 75% of enter duration. Always respect `prefers-reduced-motion`.

---

## Interactions

### Focus Ring

| Property | Value                       | Usage                        |
| -------- | --------------------------- | ---------------------------- |
| `width`  | 2px                         | Ring thickness               |
| `style`  | solid                       | Ring style                   |
| `color`  | var(--color-accent-primary) | Ring color (matches brand)   |
| `offset` | 2px                         | Gap between element and ring |

> Never `outline: none` without replacement. Minimum 3:1 contrast ratio for focus ring.

### Hover

| Property     | Value                                | Usage                   |
| ------------ | ------------------------------------ | ----------------------- |
| `transition` | var(--duration-fast) var(--ease-out) | Smooth hover transition |
| `transform`  | none                                 | Optional hover lift     |

Hover alternatives: `translateY(-1px)` for subtle lift, `scale(1.02)` for subtle grow. Pick one per project.

### Active

| Property    | Value       | Usage                    |
| ----------- | ----------- | ------------------------ |
| `transform` | scale(0.98) | Press feedback (pressed) |

> Active state must always be faster than hover transition. Use `duration-instant` for active feedback.

---

## Theme Modes

### Light Mode (Default)

```css
:root {
  --background: {light};
  --foreground: {dark};
  --card: {light-gray};
  --card-foreground: {dark};
  --border: {mid-gray};
  --input: {light-gray};
  --ring: {accent-primary};
  --accent: {accent-primary};
  --accent-foreground: {light};
}
```

### Dark Mode

> **Dark mode ≠ inverted light mode.** Never pure black as background — use `oklch(12-18% 0.01 <hue>)`. Use lighter surfaces instead of shadows for depth. Lower font-weight 1 step (400 → 350). Desaturate accents slightly.

```css
.dark {
  --background: {dark};
  --foreground: {light};
  --card: {mid-gray};
  --card-foreground: {light};
  --border: {mid-gray};
  --input: {dark};
  --ring: {accent-primary};
  --accent: {accent-primary};
  --accent-foreground: {dark};
}
```

---

## CSS Variables Export

```css
:root {
  /* Main Colors */
  --color-dark: {dark};
  --color-light: {light};
  --color-mid-gray: {mid-gray};
  --color-light-gray: {light-gray};

  /* Accent Colors */
  --color-accent-primary: {accent-primary};
  --color-accent-secondary: {accent-secondary};
  --color-accent-tertiary: {accent-tertiary};

  /* Semantic Colors */
  --color-success: {success};
  --color-warning: {warning};
  --color-error: {error};
  --color-info: {info};

  /* Typography */
  --font-heading: {heading-font}, {heading-fallback};
  --font-body: {body-font}, {body-fallback};
  --font-mono: {mono-font}, {mono-fallback};

  /* Spacing */
  --spacing-base: {spacing-base};

  /* Motion */
  --duration-instant: 100ms;
  --duration-fast: 200ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;
  --ease-out: cubic-bezier(0.25, 1, 0.5, 1);
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
}
```

---

## Usage Examples

### CSS Variables

```css
.button {
  background: var(--color-accent-primary);
  color: var(--color-light);
  padding: var(--spacing-3) var(--spacing-4);
  font-family: var(--font-body);
  border-radius: var(--rounded-md);
}

.heading {
  font-family: var(--font-heading);
  color: var(--color-dark);
}
```

### Tailwind Classes

```html
<button class="bg-accent-primary text-light px-4 py-3 font-body rounded-md">
  Click me
</button>
```

---

_Generated by /theme command_

---

## Theme JSON Schema

The `theme` section in `project.json` follows this schema:

```json
{
  "colors": {
    "main": [{ "token": "dark", "value": "#hex", "usage": "description" }],
    "accent": [
      { "token": "accent-primary", "value": "#hex", "usage": "description" }
    ],
    "semantic": [
      { "token": "success", "value": "#hex", "usage": "description" }
    ]
  },
  "typography": {
    "families": {
      "heading": "Font, fallback",
      "body": "Font, fallback",
      "mono": "Font, fallback"
    },
    "sizes": [
      {
        "token": "text-display",
        "size": "3rem",
        "lineHeight": "1.1",
        "usage": "Hero headings"
      }
    ]
  },
  "spacing": {
    "base": "4px",
    "scale": [{ "token": "spacing-4", "value": "16px", "usage": "description" }]
  },
  "breakpoints": [
    { "token": "screen-md", "value": "768px", "target": "Tablets" }
  ],
  "borderRadius": [
    { "token": "rounded-md", "value": "0.375rem", "usage": "description" }
  ],
  "shadows": [{ "token": "shadow-md", "value": "...", "usage": "Cards" }],
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
    ]
  },
  "interactions": {
    "focusRing": {
      "width": "2px",
      "style": "solid",
      "color": "var(--color-accent-primary)",
      "offset": "2px"
    },
    "hover": {
      "transition": "var(--duration-fast) var(--ease-out)",
      "transform": "none"
    },
    "active": { "transform": "scale(0.98)" }
  },
  "modes": { "light": ":root { css }", "dark": ".dark { css }" },
  "cssVars": ":root { full css vars export }"
}
```

See `shared/DASHBOARD.md` for the complete `project.json` schema.

---

## Read/Write Protocol

### Reading

1. Read `.project/project.json`
2. Parse as JSON
3. Use `theme` section (may be empty/undefined)

### Writing

1. Read `.project/project.json` (or create new with empty schema if it doesn't exist)
2. Parse JSON
3. Mutate ONLY the `theme` section (do NOT overwrite other sections)
4. Write back as `JSON.stringify(data, null, 2)`

### Creating a new file

If `.project/project.json` does not exist, create with the empty schema from `shared/DASHBOARD.md`, then populate the `theme` section with the generated tokens.
