# ANTI-SLOP — Universal Frontend Ban Catalogue

Universal static-analysis rules removed from `design-check` (runtime-only) and promoted to generation-time bans. Loaded by Convert PHASE 2 when `design.banPacks[]` contains the pack name.

Each entry: `code` · `pack` · `description` · `grep-pattern` (or natural-language rule) · `fix`.

---

## Pack: tokens

Prevent raw literals that should use design tokens.

| Code | Description | Pattern to forbid | Fix |
|------|-------------|-------------------|-----|
| T101 | Hex color literal in component | `#[0-9a-fA-F]{3,8}` in className or style | Use `bg-<token>` / `text-<token>` from theme |
| T102 | HSL/RGB/OKLCH literal in component | `hsl(\|rgb(\|oklch(` in className or style | Use CSS custom property via `var(--color-*)` |
| T103 | Raw `ms` duration literal | `\b[0-9]+ms\b` in className or style | Use `var(--duration-*)` tokens |
| T104 | Raw `cubic-bezier` literal | `cubic-bezier(` in className or style | Use `var(--ease-*)` tokens |
| T105 | Hardcoded `text-` size literal | `text-\[` (arbitrary text size) | Use theme typography scale |
| T106 | Hardcoded `rounded-` literal | `rounded-\[` (arbitrary radius) | Use `rounded-<token>` from theme |
| T107 | Hardcoded `shadow-` literal | `shadow-\[` (arbitrary shadow) | Use `shadow-<token>` from theme |
| T108 | Hardcoded `font-` weight literal | `font-\[` (arbitrary weight) | Use theme font-weight scale |
| T109 | Hardcoded spacing literal (px) | `p-\[.*px\]\|m-\[.*px\]\|gap-\[.*px\]` | Use Tailwind spacing scale |
| T110 | `backdrop-filter` without glass flag | `backdrop-filter\|backdrop-blur` without `surfaces.glass.enabled` | Check `theme.surfaces.glass.enabled` first |
| T111 | Raw color in CSS custom property | `--[a-z-]+:\s*#\|rgb\|hsl` in `<style>` | Reference `--color-*` tokens |

---

## Pack: a11y

Prevent accessibility violations detectable at generation time.

| Code | Description | Rule | Fix |
|------|-------------|------|-----|
| A001 | Interactive element without accessible name | `<button>` or `<a>` with no text content AND no `aria-label` | Add `aria-label` or visible text |
| A002 | Icon-only button without label | `<button>` containing only `<svg>` or icon component, no `aria-label` | Add `aria-label="[action]"` |
| A003 | `<img>` without `alt` attribute | `<img` without `alt=` | Add descriptive `alt` or `alt=""` for decorative |
| A004 | `<input>` without associated label | `<input` without `id` matched by `<label htmlFor>` or `aria-label` | Add label association |
| A005 | `role="button"` on non-interactive element | `role="button"` on `<div>` or `<span>` | Use `<button>` instead |
| A006 | Missing `lang` attribute on `<html>` | `<html` without `lang=` | Add `lang="nl"` (or project locale) |
| A101 | `onClick` without keyboard handler | `onClick` without `onKeyDown` or `onKeyUp` on non-button element | Add keyboard handler or use `<button>` |
| A102 | Focus trap opened without restore | `dialog` or `modal` open logic without focus-restore on close | Add `ref.focus()` on close |
| A103 | ARIA state not synced | `aria-expanded` or `aria-selected` without dynamic value | Bind to component state |
| A104 | Form error without `aria-describedby` | `<input>` with visible error message but no `aria-describedby` | Link error element via `aria-describedby` |
| A201 | `<section>` without heading | `<section>` with no `<h*>` child and no `aria-label` | Add heading or `aria-label` |
| A202 | Heading hierarchy skip | `<h3>` appearing before `<h2>` in same section | Fix heading order |
| A203 | Live region missing | Dynamic content updates (counters, status, toasts) without `aria-live` | Add `aria-live="polite"` wrapper |
| R001 | Skip-link missing | Page without `<a href="#main-content">` as first focusable element | Add skip-link |
| R004 | Focus indicator removed | `outline-none` or `ring-0` without `focus-visible:` replacement | Keep `focus-visible:ring-*` |
| R005 | `tabIndex` positive value | `tabIndex={[1-9][0-9]*}` | Use `tabIndex={0}` or `-1` only |

---

## Pack: dark

Prevent dark-mode compliance failures (only relevant when `theme.modes.dark` is set).

| Code | Description | Pattern to forbid | Fix |
|------|-------------|-------------------|-----|
| DC001 | Background class without `dark:` counterpart | `bg-[^d][^ ]+` without `dark:bg-` | Add `dark:bg-<token>` |
| DC002 | Text color class without `dark:` counterpart | `text-[^d][^ ]+` without `dark:text-` | Add `dark:text-<token>` |

Skip this pack entirely if `theme.modes.dark` is absent in `project.json`.

---

## Pack: responsive

Prevent responsive coverage failures.

| Code | Description | Pattern to forbid | Fix |
|------|-------------|-------------------|-----|
| RC001 | Layout class without responsive prefix | `flex\|grid\|block\|hidden` on containers without `sm:\|md:\|lg:` variant | Add responsive counterpart |
| RC002 | Font size without responsive scaling | `text-xl\|text-2xl\|text-3xl` without `md:\|lg:` size change | Add responsive size |

---

## Pack: motion

Prevent motion compliance failures detectable at generation time.

| Code | Description | Pattern to forbid | Fix |
|------|-------------|-------------------|-----|
| M001 | Raw ms literal in transition | `duration-[0-9]+\b` without `var(--duration-*)` | Use `duration-[var(--duration-fast)]` |
| M003 | `backdrop-filter` without glass surface flag | `backdrop-filter\|backdrop-blur` without `theme.surfaces.glass.enabled === true` | Conditionalize on glass flag |
| M005 | `@keyframes` without reduced-motion fallback | `@keyframes` block without `@media (prefers-reduced-motion: reduce)` | Add fallback block |

---

## Usage in Convert PHASE 2

When `design.banPacks` contains pack name(s): load matching sections above and inject into codegen prompt as:

```
FORBIDDEN PATTERNS — do not emit these in generated code:
[code]: [description] — [pattern to forbid]
```

Loaded N patterns from design.banPacks: [pack names].
Loaded M patterns from design.principles[].forbid: [principle names].

If generated code violates a pattern: note in PHASE 3 sanity-grep, regenerate that section with "you emitted forbidden pattern [code]: [pattern]. Replace with: [fix]."
