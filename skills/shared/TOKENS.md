# Design Token Contract

Canonical token names, fallback values, and anti-hardcoding rules for generated UI code.

Skills that generate UI code MUST use token names — never hardcoded color values or hex literals.
Token names are the stable contract. Values are supplied later by `/frontend-tokens`.

> **Producer:** `/frontend-tokens` (writes `project.json#theme`)
> **Consumers:** `dev-build`, `dev-verify`, `dev-refactor`, `dev-define`, `project-plan`, `frontend-design`, `frontend-convert`, `frontend-check`

---

## Canonical Token Names

Use these names in generated Tailwind classes and CSS variables:

| Category      | Token names                                                                                                              |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Colors        | `primary`, `foreground`, `background`, `surface`, `border`, `muted`, `accent`                                            |
| Semantic      | `success`, `warning`, `error`, `info`                                                                                    |
| Typography    | `text-display`, `text-title-l`, `text-title-m`, `text-title-s`, `text-body-l`, `text-body-m`, `text-body-s`, `text-code` |
| Spacing       | `spacing-1` through `spacing-12` (4px base: spacing-1=4px, spacing-4=16px, spacing-8=32px)                               |
| Motion        | `duration-instant` (100ms), `duration-fast` (200ms), `duration-normal` (300ms), `duration-slow` (500ms)                  |
| Motion easing | `ease-out`, `ease-in`, `ease-in-out`                                                                                     |

These map 1:1 to what `/frontend-tokens` produces in `project.json#theme`. Match naming exactly.

---

## Fallback Values (theme empty)

When `project.json#theme` is empty or absent, use these defaults in generated code.
OKLCH values compatible with Tailwind v4 and plain CSS variables projects.

```css
:root {
  /* Primitives */
  --color-foreground: oklch(0.2 0.02 260);
  --color-background: oklch(0.99 0 260);
  --color-accent-primary: oklch(0.55 0.18 260);
  --color-surface: oklch(0.96 0.005 260);
  --color-border: oklch(0.88 0.005 260);
  --color-muted: oklch(0.55 0.005 260);

  /* Semantics — reference primitives, not raw hex */
  --color-primary: var(--color-accent-primary);
  --color-success: oklch(0.62 0.15 145);
  --color-warning: oklch(0.72 0.16 75);
  --color-error: oklch(0.55 0.2 25);
  --color-info: oklch(0.6 0.13 230);

  /* Typography */
  --font-heading: system-ui, sans-serif;
  --font-body: system-ui, sans-serif;
  --font-mono: ui-monospace, monospace;

  /* Motion */
  --duration-instant: 100ms;
  --duration-fast: 200ms;
  --duration-normal: 300ms;
  --duration-slow: 500ms;
  --ease-out: cubic-bezier(0.25, 1, 0.5, 1);
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);

  /* Typography sizes (fluid clamp scaling) */
  --text-display: clamp(2.5rem, 5vw + 1rem, 4rem);
  --text-title-l: clamp(2rem, 3vw + 1rem, 3rem);
  --text-title-m: clamp(1.5rem, 2vw + 0.75rem, 2.25rem);
  --text-title-s: 1.25rem;
  --text-body-l: 1.125rem;
  --text-body-m: 1rem;
  --text-body-s: 0.875rem;
  --text-code: 0.9375rem;

  /* Spacing scale (4px base) */
  --spacing-1: 0.25rem; /* 4px */
  --spacing-2: 0.5rem; /* 8px */
  --spacing-3: 0.75rem; /* 12px */
  --spacing-4: 1rem; /* 16px */
  --spacing-5: 1.25rem; /* 20px */
  --spacing-6: 1.5rem; /* 24px */
  --spacing-7: 1.75rem; /* 28px */
  --spacing-8: 2rem; /* 32px */
  --spacing-9: 2.5rem; /* 40px */
  --spacing-10: 3rem; /* 48px */
  --spacing-11: 4rem; /* 64px */
  --spacing-12: 6rem; /* 96px */
}
```

**Tailwind v3 config snippet** (expose CSS vars as utility classes — add to `theme.extend`):

```ts
colors: {
  primary:    'var(--color-primary)',
  foreground: 'var(--color-foreground)',
  background: 'var(--color-background)',
  surface:    'var(--color-surface)',
  border:     'var(--color-border)',
  muted:      'var(--color-muted)',
  accent:     'var(--color-accent-primary)',
  success:    'var(--color-success)',
  warning:    'var(--color-warning)',
  error:      'var(--color-error)',
  info:       'var(--color-info)',
},
fontSize: {
  display:  ['var(--text-display)',  { lineHeight: '1.1' }],
  'title-l': ['var(--text-title-l)', { lineHeight: '1.2' }],
  'title-m': ['var(--text-title-m)', { lineHeight: '1.25' }],
  'title-s': ['var(--text-title-s)', { lineHeight: '1.3' }],
  'body-l':  ['var(--text-body-l)',  { lineHeight: '1.6' }],
  'body-m':  ['var(--text-body-m)',  { lineHeight: '1.6' }],
  'body-s':  ['var(--text-body-s)',  { lineHeight: '1.5' }],
  code:      ['var(--text-code)',    { lineHeight: '1.5' }],
},
spacing: {
  1: 'var(--spacing-1)',  2: 'var(--spacing-2)',  3: 'var(--spacing-3)',
  4: 'var(--spacing-4)',  5: 'var(--spacing-5)',  6: 'var(--spacing-6)',
  7: 'var(--spacing-7)',  8: 'var(--spacing-8)',  9: 'var(--spacing-9)',
  10: 'var(--spacing-10)', 11: 'var(--spacing-11)', 12: 'var(--spacing-12)',
},
transitionDuration: {
  instant: 'var(--duration-instant)',
  fast:    'var(--duration-fast)',
  normal:  'var(--duration-normal)',
  slow:    'var(--duration-slow)',
},
transitionTimingFunction: {
  out:    'var(--ease-out)',
  in:     'var(--ease-in)',
  'in-out': 'var(--ease-in-out)',
},
```

For Tailwind v4 (CSS-first): `--color-*` custom properties in `:root` are picked up automatically via `@theme inline`. Typography/spacing/motion tokens require explicit `@theme` blocks — see Section G (roadmap).

---

## Anti-Hardcoding Violations

Detect and reject these patterns in generated and reviewed UI code:

| ID   | Pattern                                   | Severity | Fix                                 |
| ---- | ----------------------------------------- | -------- | ----------------------------------- |
| T101 | `#[0-9a-fA-F]{3,8}` in JSX/className/CSS  | HIGH     | `var(--color-{nearest-token})`      |
| T102 | `bg-\[#`, `text-\[#`, `border-\[#` in JSX | HIGH     | `bg-{token}`, `text-{token}`, etc.  |
| T103 | `style={{\s*color:\s*['"\`]#` in JSX      | HIGH     | className with token class          |
| T104 | `p-\[\d+px\]`, `gap-\[\d+px\]` arbitrary  | MEDIUM   | `p-{n}` / `gap-{n}` nearest spacing |
| T105 | `oklch(`, `hsl(`, `rgb(` literals in JSX  | HIGH     | `var(--color-{nearest-token})`      |

**Check scope:** only `.tsx`, `.jsx`, `.vue`, `.svelte`, `.css`, `.scss`. Skip test files, JSON, config files.

---

## Token → Class Mapping

When replacing hardcoded values, map to nearest token by visual role (not exact hex equality):

| Hardcoded                             | → Tailwind class  | → CSS var                 |
| ------------------------------------- | ----------------- | ------------------------- |
| `bg-[#0d1117]`, `bg-[#1a1a2e]`        | `bg-background`   | `var(--color-background)` |
| `bg-[#f9fafb]`, `bg-white`            | `bg-surface`      | `var(--color-surface)`    |
| `bg-[#3B82F6]`, `bg-blue-500`         | `bg-primary`      | `var(--color-primary)`    |
| `text-[#1a1a2e]`, `text-gray-900`     | `text-foreground` | `var(--color-foreground)` |
| `text-[#6b7280]`, `text-gray-500`     | `text-muted`      | `var(--color-muted)`      |
| `border-[#e5e7eb]`, `border-gray-200` | `border-border`   | `var(--color-border)`     |
| `p-[16px]`                            | `p-4`             | —                         |
| `gap-[32px]`                          | `gap-8`           | —                         |
| `style={{ color: '#...' }}`           | className + token | —                         |

---

## Fallback Policy Matrix

| Situation                             | Theme state | Behavior                                       |
| ------------------------------------- | ----------- | ---------------------------------------------- |
| `dev-build` generates UI/component    | Empty       | Use fallback CSS vars above, write token names |
| `dev-build` generates UI/component    | Full        | Read `theme.cssVars`, write token names        |
| `dev-build` generates API/logic only  | Any         | No token check needed                          |
| `dev-verify` `hasUI` or `isComponent` | Any         | Run T101–T103 grep; violations = FAIL item     |
| `dev-refactor` Quality-lens           | Any         | Flag T101–T105 violations, suggest token names |
| `frontend-convert` inspiration mode   | Empty       | **Abort** — run `/frontend-tokens` first       |
| `frontend-convert` 1:1 copy mode      | Empty       | Allow hardcoded, warn                          |
| `frontend-design` brief mode          | Empty       | Note "Tailwind defaults", suggest tokens       |
| `frontend-check` audit                | Empty       | Skip Token Architecture scan, explain why      |

---

## Bootstrap Procedure

Canonical steps for installing fallback token files into a target project. Referenced by `dev-build` PHASE 0 and `core-setup` Phase 3 — do not duplicate the steps in those skills.

**Guards (run first, skip silently if any guard fails):**

1. Stack contains Tailwind v3: `tailwind.config.{js,ts,mjs,cjs}` exists. If not found → skip.
2. `src/styles/tokens.css` does not yet exist → skip if already present (idempotent).

**Steps (only if both guards pass):**

3. Detect CSS entry-point in priority order:
   - `src/app/globals.css` (Next.js App Router)
   - `src/styles/globals.css` (Next.js Pages)
   - `src/index.css` (Vite + React/Vue)
   - `src/style.css` (Vite generic)
   - No match → log "no CSS entry found", abort.
4. Write `src/styles/tokens.css` with the full `:root {}` block from the Fallback Values section above.
5. Prepend `@import './styles/tokens.css';` to the detected CSS entry — only if not already present.
6. Patch `tailwind.config.*`: merge the `theme.extend` block from the Tailwind v3 config snippet above — only missing keys (idempotent).
7. Log: `"Token fallback installed: src/styles/tokens.css + tailwind.config.* extended"`

**Tailwind v4:** not supported yet. Detect via `package.json` (`"tailwindcss": "^4"`). If found → log "Tailwind v4 detected — manual token setup required (see roadmap)" and skip.

> **Callers:** `dev-build/SKILL.md` PHASE 0, `core-setup/references/mode-greenfield.md` Phase 3.
