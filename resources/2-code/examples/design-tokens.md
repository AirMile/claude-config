# Design Tokens

Last updated: 2025-10-31

Auto-extracted design tokens from project configuration files (Tailwind, CSS variables, theme files).

---

## Colors

### Brand Colors
```css
--color-primary: #3B82F6      /* Blue 500 */
--color-primary-dark: #2563EB  /* Blue 600 */
--color-primary-light: #60A5FA /* Blue 400 */

--color-secondary: #10B981     /* Green 500 */
--color-secondary-dark: #059669 /* Green 600 */
--color-secondary-light: #34D399 /* Green 400 */

--color-accent: #F59E0B        /* Amber 500 */
--color-accent-dark: #D97706   /* Amber 600 */
--color-accent-light: #FBBF24  /* Amber 400 */
```

### Semantic Colors
```css
--color-success: #10B981       /* Green 500 */
--color-warning: #F59E0B       /* Amber 500 */
--color-error: #EF4444         /* Red 500 */
--color-info: #3B82F6          /* Blue 500 */
```

### Neutral Colors
```css
--color-white: #FFFFFF
--color-black: #000000

--color-gray-50: #F9FAFB
--color-gray-100: #F3F4F6
--color-gray-200: #E5E7EB
--color-gray-300: #D1D5DB
--color-gray-400: #9CA3AF
--color-gray-500: #6B7280
--color-gray-600: #4B5563
--color-gray-700: #374151
--color-gray-800: #1F2937
--color-gray-900: #111827
```

### Background Colors
```css
--bg-primary: #FFFFFF          /* Light mode */
--bg-secondary: #F9FAFB        /* Light mode secondary */
--bg-tertiary: #F3F4F6         /* Light mode tertiary */

--bg-primary-dark: #111827     /* Dark mode */
--bg-secondary-dark: #1F2937   /* Dark mode secondary */
--bg-tertiary-dark: #374151    /* Dark mode tertiary */
```

### Text Colors
```css
--text-primary: #111827        /* Light mode */
--text-secondary: #6B7280      /* Light mode secondary */
--text-tertiary: #9CA3AF       /* Light mode tertiary */

--text-primary-dark: #F9FAFB   /* Dark mode */
--text-secondary-dark: #D1D5DB /* Dark mode secondary */
--text-tertiary-dark: #9CA3AF  /* Dark mode tertiary */
```

---

## Typography

### Font Families
```css
--font-sans: 'Inter', system-ui, -apple-system, sans-serif
--font-serif: 'Georgia', serif
--font-mono: 'Fira Code', 'Monaco', monospace
--font-display: 'Poppins', sans-serif
```

### Font Sizes
```css
--text-xs: 0.75rem      /* 12px */
--text-sm: 0.875rem     /* 14px */
--text-base: 1rem       /* 16px */
--text-lg: 1.125rem     /* 18px */
--text-xl: 1.25rem      /* 20px */
--text-2xl: 1.5rem      /* 24px */
--text-3xl: 1.875rem    /* 30px */
--text-4xl: 2.25rem     /* 36px */
--text-5xl: 3rem        /* 48px */
--text-6xl: 3.75rem     /* 60px */
```

### Font Weights
```css
--font-thin: 100
--font-extralight: 200
--font-light: 300
--font-normal: 400
--font-medium: 500
--font-semibold: 600
--font-bold: 700
--font-extrabold: 800
--font-black: 900
```

### Line Heights
```css
--leading-none: 1
--leading-tight: 1.25
--leading-snug: 1.375
--leading-normal: 1.5
--leading-relaxed: 1.625
--leading-loose: 2
```

---

## Spacing

### Base Spacing Scale (4px base)
```css
--spacing-0: 0
--spacing-1: 0.25rem    /* 4px */
--spacing-2: 0.5rem     /* 8px */
--spacing-3: 0.75rem    /* 12px */
--spacing-4: 1rem       /* 16px */
--spacing-5: 1.25rem    /* 20px */
--spacing-6: 1.5rem     /* 24px */
--spacing-8: 2rem       /* 32px */
--spacing-10: 2.5rem    /* 40px */
--spacing-12: 3rem      /* 48px */
--spacing-16: 4rem      /* 64px */
--spacing-20: 5rem      /* 80px */
--spacing-24: 6rem      /* 96px */
--spacing-32: 8rem      /* 128px */
```

### Component-specific Spacing
```css
--spacing-card-padding: 1.5rem       /* 24px */
--spacing-section-padding: 4rem      /* 64px */
--spacing-container-padding: 1rem    /* 16px */
--spacing-button-padding-x: 1.5rem   /* 24px */
--spacing-button-padding-y: 0.5rem   /* 8px */
```

---

## Border Radius

```css
--radius-none: 0
--radius-sm: 0.125rem    /* 2px */
--radius-base: 0.25rem   /* 4px */
--radius-md: 0.375rem    /* 6px */
--radius-lg: 0.5rem      /* 8px */
--radius-xl: 0.75rem     /* 12px */
--radius-2xl: 1rem       /* 16px */
--radius-3xl: 1.5rem     /* 24px */
--radius-full: 9999px    /* Fully rounded */
```

---

## Shadows

```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05)
--shadow-base: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)
--shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25)
--shadow-inner: inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)
```

---

## Transitions

```css
--transition-fast: 150ms ease-in-out
--transition-base: 200ms ease-in-out
--transition-slow: 300ms ease-in-out
--transition-slower: 500ms ease-in-out

--ease-in: cubic-bezier(0.4, 0, 1, 1)
--ease-out: cubic-bezier(0, 0, 0.2, 1)
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1)
```

---

## Z-Index Layers

```css
--z-dropdown: 1000
--z-sticky: 1020
--z-fixed: 1030
--z-modal-backdrop: 1040
--z-modal: 1050
--z-popover: 1060
--z-tooltip: 1070
```

---

## Breakpoints (Responsive)

```css
--breakpoint-sm: 640px
--breakpoint-md: 768px
--breakpoint-lg: 1024px
--breakpoint-xl: 1280px
--breakpoint-2xl: 1536px
```

---

## Component-Specific Tokens

### Buttons
```css
--button-height-sm: 2rem       /* 32px */
--button-height-base: 2.5rem   /* 40px */
--button-height-lg: 3rem       /* 48px */

--button-padding-x-sm: 0.75rem
--button-padding-x-base: 1rem
--button-padding-x-lg: 1.5rem
```

### Inputs
```css
--input-height-sm: 2rem
--input-height-base: 2.5rem
--input-height-lg: 3rem

--input-padding-x: 0.75rem
--input-border-width: 1px
--input-border-color: var(--color-gray-300)
--input-focus-ring: 0 0 0 3px rgba(59, 130, 246, 0.1)
```

### Cards
```css
--card-padding: 1.5rem
--card-border-radius: var(--radius-lg)
--card-shadow: var(--shadow-base)
--card-bg: var(--bg-primary)
```

### Navigation
```css
--navbar-height: 4rem          /* 64px */
--sidebar-width: 16rem         /* 256px */
--footer-height: 6rem          /* 96px */
```

---

## Usage Example

```jsx
// React Component
const Button = styled.button`
  padding: var(--button-padding-x-base) var(--button-padding-y);
  background-color: var(--color-primary);
  color: var(--color-white);
  border-radius: var(--radius-md);
  font-weight: var(--font-semibold);
  transition: var(--transition-base);

  &:hover {
    background-color: var(--color-primary-dark);
  }
`;
```

```css
/* CSS Usage */
.card {
  padding: var(--card-padding);
  background: var(--card-bg);
  border-radius: var(--card-border-radius);
  box-shadow: var(--card-shadow);
}
```

---

*Auto-generated by /2-code skill from Tailwind config, CSS variables, and theme files*
