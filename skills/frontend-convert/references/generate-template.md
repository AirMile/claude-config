# 2.2 Generate Code

Generate the page and components based on the source image.

**Rules:**

- Follow `shared/FRONTEND-RULES.md`: React/Next.js Rules, HTML/CSS Rules, Accessibility Rules (A-series)
- Follow `shared/PATTERNS.md`: Component Patterns, Layout Patterns
- Use `cn()` for className composition — create `src/lib/utils.ts` if not present
- TypeScript strict mode with proper interfaces
- Semantic HTML with aria-labels and keyboard support
- Import existing components — never regenerate what already works

**Component states:**

If `$STATES` is non-empty: generate state variants alongside the happy path.

- **Loading**: use a skeleton that mirrors the happy path layout — same grid/flex structure, placeholder blocks at text positions. No generic spinner unless the source explicitly shows one.
- **Error**: show error message with retry action if that makes sense for the context. Use `error`-semantic color if the theme defines one.
- **Empty**: contextual empty state — infer from the section name what would go there (e.g. "No projects yet" for a projects list).

All states follow the same `dark:` and responsive logic as the happy path.

**Mode-specific** (see `./examples/` for gold standard examples per mode):

- **1:1 copy:** Match source colors, fonts, spacing as closely as possible. Use arbitrary Tailwind values (`bg-[#FF5733]`, `text-[20px]`) when no standard class matches. Prioritize visual fidelity. Reference: `./examples/PricingPage-1to1.tsx`
- **Inspiration:** Use only theme tokens (from project.json) and standard Tailwind classes. Match source layout and structure, not visual details. No arbitrary values. Reference: `./examples/PricingPage-inspiration.tsx`

**Dark mode classes:**

Check `theme.modes.dark` in `project.json`. If present (`$HAS_DARK_MODE = true`): add `dark:` Tailwind prefix to all background-, text-color-, and border-classes.

- `bg-white dark:bg-[var(--color-dark)]` or via theme alias: `bg-background dark:bg-background`
- `text-gray-900 dark:text-[var(--color-light)]`
- `border-gray-200 dark:border-[var(--color-mid-gray)]`

If `theme.modes.dark` is missing: no `dark:` classes — do not add them speculatively.

**Responsive layout:**

If `$RESPONSIVE_VIEWPORTS` shows multiple viewports: use Tailwind responsive prefixes systematically (mobile-first).

- No prefix = mobile/default
- `md:` = tablet (768px+)
- `lg:` = desktop (1024px+)

Examples: `flex-col md:flex-row`, `hidden md:block`, `px-4 md:px-8 lg:px-16`, `text-sm lg:text-base`

If single viewport: generate for that viewport. Add `{/* TODO: responsive — only [mobile|desktop] frame available */}` at the top of the component.

**Contextual content:** Never use "Lorem ipsum." Infer contextual placeholder text from the source image or describe what real content would go there.

**Variant-aware components:**

If `$VARIANTS` is non-empty: use `cva` (class-variance-authority) for each component with ≥2 detected variants. Check first if `cva` is available in `package.json`; do not install automatically — add to Generation Summary as missing dependency.

Structure:

```typescript
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva("base-classes-here", {
  variants: {
    variant: { primary: "...", ghost: "...", destructive: "..." },
    size: { sm: "...", md: "...", lg: "..." },
  },
  defaultVariants: { variant: "primary", size: "md" },
});

interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}
```

Without detected variants (`$VARIANTS` empty): generate normally without `cva`.
