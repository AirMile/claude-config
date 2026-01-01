# Theme Design Tokens

Project design systeem met colors, typography, spacing, en breakpoints.

---

## Colors

### Primary

| Token | Value | Usage |
|-------|-------|-------|
| `primary-50` | {primary-50} | Subtle backgrounds |
| `primary-100` | {primary-100} | Hover backgrounds |
| `primary-200` | {primary-200} | Active backgrounds |
| `primary-300` | {primary-300} | Borders |
| `primary-400` | {primary-400} | Icons |
| `primary-500` | {primary-500} | **Main brand color** |
| `primary-600` | {primary-600} | Hover states |
| `primary-700` | {primary-700} | Active states |
| `primary-800` | {primary-800} | Dark accents |
| `primary-900` | {primary-900} | Text on light |

### Secondary

| Token | Value | Usage |
|-------|-------|-------|
| `secondary-50` | {secondary-50} | Subtle backgrounds |
| `secondary-100` | {secondary-100} | Hover backgrounds |
| `secondary-200` | {secondary-200} | Active backgrounds |
| `secondary-300` | {secondary-300} | Borders |
| `secondary-400` | {secondary-400} | Icons |
| `secondary-500` | {secondary-500} | **Secondary brand color** |
| `secondary-600` | {secondary-600} | Hover states |
| `secondary-700` | {secondary-700} | Active states |
| `secondary-800` | {secondary-800} | Dark accents |
| `secondary-900` | {secondary-900} | Text on light |

### Neutral (Gray Scale)

| Token | Value | Usage |
|-------|-------|-------|
| `neutral-50` | {neutral-50} | Page backgrounds |
| `neutral-100` | {neutral-100} | Card backgrounds |
| `neutral-200` | {neutral-200} | Dividers |
| `neutral-300` | {neutral-300} | Borders |
| `neutral-400` | {neutral-400} | Placeholder text |
| `neutral-500` | {neutral-500} | Secondary text |
| `neutral-600` | {neutral-600} | Body text |
| `neutral-700` | {neutral-700} | Headings |
| `neutral-800` | {neutral-800} | Dark text |
| `neutral-900` | {neutral-900} | Darkest text |

### Semantic Colors

| Token | Value | Usage |
|-------|-------|-------|
| `success` | {success} | Positive feedback |
| `warning` | {warning} | Caution messages |
| `error` | {error} | Error states |
| `info` | {info} | Informational |

---

## Typography

### Font Families

| Token | Value |
|-------|-------|
| `font-heading` | {font-heading} |
| `font-body` | {font-body} |
| `font-mono` | {font-mono} |

### Font Sizes

| Token | Value | Line Height |
|-------|-------|-------------|
| `text-xs` | 0.75rem (12px) | 1rem |
| `text-sm` | 0.875rem (14px) | 1.25rem |
| `text-base` | 1rem (16px) | 1.5rem |
| `text-lg` | 1.125rem (18px) | 1.75rem |
| `text-xl` | 1.25rem (20px) | 1.75rem |
| `text-2xl` | 1.5rem (24px) | 2rem |
| `text-3xl` | 1.875rem (30px) | 2.25rem |
| `text-4xl` | 2.25rem (36px) | 2.5rem |
| `text-5xl` | 3rem (48px) | 1 |

### Font Weights

| Token | Value |
|-------|-------|
| `font-light` | 300 |
| `font-normal` | 400 |
| `font-medium` | 500 |
| `font-semibold` | 600 |
| `font-bold` | 700 |

---

## Spacing

Base unit: {spacing-base}

| Token | Value |
|-------|-------|
| `spacing-0` | 0 |
| `spacing-1` | {spacing-1} |
| `spacing-2` | {spacing-2} |
| `spacing-3` | {spacing-3} |
| `spacing-4` | {spacing-4} |
| `spacing-5` | {spacing-5} |
| `spacing-6` | {spacing-6} |
| `spacing-8` | {spacing-8} |
| `spacing-10` | {spacing-10} |
| `spacing-12` | {spacing-12} |
| `spacing-16` | {spacing-16} |

---

## Breakpoints

| Token | Value | Target |
|-------|-------|--------|
| `screen-sm` | {screen-sm} | Small devices |
| `screen-md` | {screen-md} | Tablets |
| `screen-lg` | {screen-lg} | Desktops |
| `screen-xl` | {screen-xl} | Large screens |
| `screen-2xl` | {screen-2xl} | Extra large |

---

## Border Radius

| Token | Value |
|-------|-------|
| `rounded-none` | 0 |
| `rounded-sm` | 0.125rem |
| `rounded` | 0.25rem |
| `rounded-md` | 0.375rem |
| `rounded-lg` | 0.5rem |
| `rounded-xl` | 0.75rem |
| `rounded-2xl` | 1rem |
| `rounded-full` | 9999px |

---

## Shadows

| Token | Value |
|-------|-------|
| `shadow-sm` | 0 1px 2px 0 rgb(0 0 0 / 0.05) |
| `shadow` | 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1) |
| `shadow-md` | 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1) |
| `shadow-lg` | 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1) |
| `shadow-xl` | 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1) |

---

## Theme Modes

### Light Mode (Default)

```css
:root {
  --background: {light-background};
  --foreground: {light-foreground};
  --card: {light-card};
  --card-foreground: {light-card-foreground};
  --border: {light-border};
  --input: {light-input};
  --ring: {light-ring};
}
```

### Dark Mode

```css
.dark {
  --background: {dark-background};
  --foreground: {dark-foreground};
  --card: {dark-card};
  --card-foreground: {dark-card-foreground};
  --border: {dark-border};
  --input: {dark-input};
  --ring: {dark-ring};
}
```

---

## Usage Examples

### CSS Variables

```css
.button {
  background: var(--primary-500);
  padding: var(--spacing-3) var(--spacing-4);
  font-family: var(--font-body);
  border-radius: var(--rounded-md);
}
```

### Tailwind Classes

```html
<button class="bg-primary-500 px-4 py-3 font-body rounded-md">
  Click me
</button>
```

---

*Generated by /theme command*
