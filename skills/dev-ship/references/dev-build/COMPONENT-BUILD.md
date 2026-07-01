# COMPONENT-BUILD — Component Steps

Referenced from `SKILL.md § COMPONENT-only steps` (only when `IS_COMPONENT_BUILD = true`).

---

## Phase 2 steps (COMPONENT builds only)

### Output path routing

Determine output path from `feature.json#architecture` or fall back to:

| Scope   | Output path                          |
| ------- | ------------------------------------ |
| atomic  | `src/components/ui/{PascalName}.tsx` |
| section | `src/components/{PascalName}.tsx`    |
| layout  | `src/components/{PascalName}.tsx`    |

Derive `PascalName` from `feature.name` (kebab → PascalCase).

### Component file

Generate a functional component with:

- TypeScript props interface (`{Name}Props`) — types from `feature.json#architecture.interfaces` or inferred from requirements
- State hooks if requirements mention state
- Event handlers (stubs with `console.warn` if logic not yet defined)
- Semantic HTML structure: one wrapping element, appropriate ARIA role
- Token-based Tailwind classes for presentable defaults — T101/T102 enforced (no hex literals)

Example skeleton:

```tsx
import { type FC } from "react";

interface {Name}Props {
  // props from feature.json#architecture.interfaces
}

export const {Name}: FC<{Name}Props> = ({ ...props }) => {
  return (
    <div
      role="{appropriate-role}"
      aria-label="{name}"
      className="bg-background text-foreground rounded-md p-4"
    >
      {/* TODO: implement component content */}
    </div>
  );
};
```

### Demo page

**Only when `feature.pageHint[]` is empty or absent.** With `pageHint` set, skip the demo page — the component will be imported by `/design-create`'s page-compose (pre-selected via pageHint) when those pages are designed. `/dev-verify` will locate the render context via import grep instead.

When generating: `app/_dev/components/{name}/page.tsx` (gitignored) showing the component in its default state + any states from `feature.json#requirements`.

### Layout auto-patch (scope: layout only)

If `feature.json#architecture.scope === "layout"`: add import + render to `app/layout.tsx` (or `app/(group)/layout.tsx` per `appliesTo`). Detect existing import first — show conflict warning on duplicate.
