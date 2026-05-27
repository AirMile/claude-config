# CODEGEN — Shared Code Generation Patterns

Shared patterns for `frontend-design` (Build route and Convert route PHASE 2.1/2.2). Each route contains route-specific logic inline; this file covers only shared, stack-agnostic patterns.

---

## Block Inventory Consultation

**Source:** `project-context.json#components[]`

Consult the block inventory before code generation to avoid regenerating existing UI blocks.

```json
// Voorbeeld component entry
{
  "name": "Button",
  "src": "src/components/ui/Button.tsx",
  "exports": ["Button", "buttonVariants"],
  "variants": ["primary", "ghost", "destructive"],
  "sizes": ["sm", "md", "lg"]
}
```

**Approach:**

1. Search components by name match: spec section "call to action" → search `Button`, `CTA`, `PrimaryAction`
2. Search by structure: spec section "card grid" → search `Card`, `Grid`, `ProductCard`
3. Use `src` path for imports — never rewrite what already exists
4. If component doesn't exist but spec describes it → generate new as inline component or separate file (see Output Structure below)

---

## Token Mapping

**Source:** `project.json#theme`

Available token categories:

| Category    | Token path                    | Tailwind equivalent                             |
| ----------- | ----------------------------- | ----------------------------------------------- |
| Colors      | `theme.colors.primary`        | `bg-primary`, `text-primary`                    |
| Background  | `theme.colors.background`     | `bg-background`                                 |
| Text        | `theme.colors.foreground`     | `text-foreground`                               |
| Border      | `theme.colors.border`         | `border-border`                                 |
| Muted       | `theme.colors.muted`          | `bg-muted`, `text-muted-foreground`             |
| Destructive | `theme.colors.destructive`    | `bg-destructive`, `text-destructive-foreground` |
| Typography  | `theme.typography.fontFamily` | Use CSS var or Tailwind `font-{name}`           |
| Spacing     | `theme.spacing`               | Tailwind spacing scale or CSS var               |

**Rule:** always use token names when available. Fall back to Tailwind defaults if a token is missing. **Never** use hardcoded hex values unless in 1:1 mode (convert only).

**No-hex rule:**

**Never** use raw hex values or arbitrary Tailwind color values outside 1:1 convert mode:

- Forbidden: `bg-[#FF5733]`, `text-[#1a1a2e]`, `border-[#eee]`
- Forbidden: `style={{ backgroundColor: "#..." }}` inline
- Allowed: `bg-primary`, `text-foreground`, `border-border`, `bg-[var(--color-…)]`

The Build route validates this after write via a regex post-pass (see `frontend-design` Build Step 4).

**Dark mode:**

Check `theme.modes.dark`. If present: add `dark:` prefix to all color-related classes.

```tsx
// Good — token + dark mode
<div className="bg-background dark:bg-background text-foreground dark:text-foreground">

// Good — fallback without dark mode config
<div className="bg-white text-gray-900">

// Wrong — hardcoded in non-1:1 mode
<div style={{ backgroundColor: "#1a1a2e" }}>
```

---

## Output Structure Heuristics

Determine the file path based on `project.json#stack.framework`:

| Framework          | Page pattern                      | Component pattern                    |
| ------------------ | --------------------------------- | ------------------------------------ |
| Next.js App Router | `app/{route}/page.tsx`            | `app/{route}/_components/{Name}.tsx` |
| Next.js Pages      | `pages/{route}.tsx`               | `components/{Name}.tsx`              |
| Vite + React       | `src/pages/{Route}Page.tsx`       | `src/components/{Name}.tsx`          |
| SvelteKit          | `src/routes/{route}/+page.svelte` | `src/lib/components/{Name}.svelte`   |
| Nuxt               | `pages/{route}.vue`               | `components/{Name}.vue`              |
| Astro              | `src/pages/{route}.astro`         | `src/components/{Name}.astro`        |
| Remix              | `app/routes/{route}.tsx`          | `app/components/{Name}.tsx`          |

If the framework is not in this table or `stack.framework` is empty: ask the user before code generation.

**Co-location rule:** subcomponents used by only one page → co-locate in `_components/` (Next.js) or next to the page file. Reused components → `src/components/` (or framework equivalent).

---

## Accessibility Scaffold {#a11y}

Minimal a11y structure per page type. Always apply, even without explicit spec instruction.

**Page wrapper:**

```tsx
// Next.js App Router example
export default function DashboardPage() {
  return <main aria-label="Dashboard">{/* content */}</main>;
}
```

**Skip nav (only for pages with multiple sections):**

```tsx
<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-background">
  Skip to main content
</a>
<main id="main-content" aria-label="{page-name}">
```

**Common patterns:**

| Element       | Rule                                                                          |
| ------------- | ----------------------------------------------------------------------------- |
| `<button>`    | Always `aria-label` if text is not clear (`aria-label="Close dialog"`)        |
| `<img>`       | Always `alt`. Decorative: `alt=""`                                            |
| Forms         | `<label htmlFor>` or `aria-label` per input. `role="alert"` for inline errors |
| Navigation    | `<nav aria-label="...">` — distinguish main-nav from secondary-nav            |
| Dialogs       | `role="dialog" aria-modal="true" aria-labelledby="{id}"`                      |
| Loading state | `aria-busy="true"` on container, `aria-live="polite"` for status updates      |

---

## cva Variant Pattern

Use `cva` (class-variance-authority) for components with ≥2 variants. Check availability in `package.json` — do not install automatically, note as missing dependency.

```typescript
import { cva, type VariantProps } from "class-variance-authority";

const componentVariants = cva(
  // base classes (always present)
  "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-lg",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

interface ComponentProps
  extends
    React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof componentVariants> {}
```

---

## State Components (loading / error / empty)

Generate state variants alongside the happy path when the spec or context calls for it.

| State     | Approach                                                                                        |
| --------- | ----------------------------------------------------------------------------------------------- |
| `loading` | Skeleton that mirrors the happy-path layout — same grid/flex, placeholder blocks on text.       |
| `error`   | Error message + retry action. Use `destructive` color token.                                    |
| `empty`   | Contextual empty state: infer from section name what the content would be (e.g. "No items yet") |

All states follow the same `dark:` and responsive logic as the happy path.

---

## Contextual Content

**Never** use "Lorem ipsum". Infer placeholder text from spec or section name:

- Section "user profile" → "Jan Jansen", "jan@example.com"
- Section "recent activity" → "Feature implemented", "2 hours ago"
- Section "stats" → "1,247 users", "+12% this week"

---

## Placeholder Images

Use **only** the project's own placeholder asset. External CDN URLs hallucinate easily and break on deploy.

**Contract:**

- Allowed: `/placeholder.svg?w={width}&h={height}` (or `/placeholder.png` if SVG not supported)
- Forbidden: Unsplash (`images.unsplash.com`), Pexels, picsum.photos, placehold.co, fakeimg.pl, and all other external image hosts
- Note as missing dependency in BUILD PLAN if `public/placeholder.svg` does not exist

**Dimensions per context:**

| Context           | URL                             |
| ----------------- | ------------------------------- |
| Avatar            | `/placeholder.svg?w=40&h=40`    |
| Card image        | `/placeholder.svg?w=400&h=300`  |
| Hero image        | `/placeholder.svg?w=1200&h=600` |
| Product thumbnail | `/placeholder.svg?w=200&h=200`  |

The Build route validates external URLs after write via a regex post-pass (see `frontend-design` Build Step 4).

---

## `cn()` Utility

Use `cn()` for className composition. Create `src/lib/utils.ts` if not present:

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Required: `clsx` and `tailwind-merge` in package.json. Note as missing dependency if absent.
