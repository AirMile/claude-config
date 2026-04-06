# Theme Design Tokens

Project design systeem met colors, typography, spacing, breakpoints, en motion.

> **Kleurformat:** Gebruik OKLCH waar mogelijk — perceptueel uniform, betere dark mode generatie. Verlaag chroma richting wit/zwart. Tint neutrals met brand-hue (chroma ~0.01). Vermijd pure black (`#000`) en pure gray (chroma 0).

---

## Colors

### Main Colors

Basis kleuren voor achtergronden en tekst. Gebruik tinted neutrals, nooit pure zwart/grijs.

| Token        | Value        | Usage                                                                            |
| ------------ | ------------ | -------------------------------------------------------------------------------- |
| `dark`       | {dark}       | Primary text, dark backgrounds (niet #000 — gebruik bv. `oklch(15% 0.01 <hue>)`) |
| `light`      | {light}      | Light backgrounds, text on dark (licht getint, niet puur #fff)                   |
| `mid-gray`   | {mid-gray}   | Secondary elements, borders (tint met brand-hue)                                 |
| `light-gray` | {light-gray} | Subtle backgrounds, dividers (tint met brand-hue)                                |

### Accent Colors

Kleuren voor interactieve elementen en visuele accenten.

| Token              | Value              | Usage                                     |
| ------------------ | ------------------ | ----------------------------------------- |
| `accent-primary`   | {accent-primary}   | Primary accent (CTAs, links, focus)       |
| `accent-secondary` | {accent-secondary} | Secondary accent (hover states, badges)   |
| `accent-tertiary`  | {accent-tertiary}  | Tertiary accent (highlights, decorations) |

### Semantic Colors

Betekenisvolle kleuren voor feedback en status.

| Token     | Value     | Usage                             |
| --------- | --------- | --------------------------------- |
| `success` | {success} | Positive feedback, confirmations  |
| `warning` | {warning} | Caution messages, alerts          |
| `error`   | {error}   | Error states, destructive actions |
| `info`    | {info}    | Informational messages            |

### Extended Palette (Optional)

Volledige kleurschalen voor gedetailleerd design werk. Vermijd pure gray (chroma 0) — gebruik altijd een subtiele brand-tint.

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

| Token       | Size            | Line Height | Usage                |
| ----------- | --------------- | ----------- | -------------------- |
| `text-xs`   | 0.75rem (12px)  | 1rem        | Captions, labels     |
| `text-sm`   | 0.875rem (14px) | 1.25rem     | Small text, metadata |
| `text-base` | 1rem (16px)     | 1.5rem      | Body text            |
| `text-lg`   | 1.125rem (18px) | 1.75rem     | Lead paragraphs      |
| `text-xl`   | 1.25rem (20px)  | 1.75rem     | H4, subheadings      |
| `text-2xl`  | 1.5rem (24px)   | 2rem        | H3                   |
| `text-3xl`  | 1.875rem (30px) | 2.25rem     | H2                   |
| `text-4xl`  | 2.25rem (36px)  | 2.5rem      | H1                   |
| `text-5xl`  | 3rem (48px)     | 1           | Display headings     |

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

> Exit animaties = 75% van enter duur. Respecteer altijd `prefers-reduced-motion`.

---

## Interactions

### Focus Ring

| Property | Value                       | Usage                        |
| -------- | --------------------------- | ---------------------------- |
| `width`  | 2px                         | Ring thickness               |
| `style`  | solid                       | Ring style                   |
| `color`  | var(--color-accent-primary) | Ring color (matches brand)   |
| `offset` | 2px                         | Gap between element and ring |

> Nooit `outline: none` zonder vervanging. Minimaal 3:1 contrast ratio voor focus ring.

### Hover

| Property     | Value                                | Usage                   |
| ------------ | ------------------------------------ | ----------------------- |
| `transition` | var(--duration-fast) var(--ease-out) | Smooth hover transition |
| `transform`  | none                                 | Optional hover lift     |

Hover alternatieven: `translateY(-1px)` voor subtle lift, `scale(1.02)` voor subtle grow. Kies één per project.

### Active

| Property    | Value       | Usage                      |
| ----------- | ----------- | -------------------------- |
| `transform` | scale(0.98) | Press feedback (ingedrukt) |

> Active state moet altijd sneller zijn dan hover transition. Gebruik `duration-instant` voor active feedback.

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

> **Dark mode ≠ inverted light mode.** Nooit pure black als background — gebruik `oklch(12-18% 0.01 <hue>)`. Gebruik lichtere surfaces i.p.v. shadows voor diepte. Verlaag font-weight 1 stap (400 → 350). Desatureer accenten licht.

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
