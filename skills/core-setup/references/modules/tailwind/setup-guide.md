# Tailwind CSS Setup

**Status:** stub — generate full guide via Context7 query.

## Detection

| State                          | Condition                                                           |
| ------------------------------ | ------------------------------------------------------------------- |
| `already-installed-configured` | `tailwindcss` in dependencies AND `tailwind.config.{js,ts}` present |
| `installed-not-configured`     | `tailwindcss` in dependencies BUT `tailwind.config.*` missing       |
| `not-installed`                | `tailwindcss` not in dependencies                                   |

## Install (via Context7)

```
mcp__context7__resolve-library-id(libraryName: "tailwindcss")
mcp__context7__query-docs(
  context7CompatibleLibraryID: "{id}",
  query: "installation {framework} v4 setup postcss config"
)
```

Follow the Context7 output for:

1. Install commands (`tailwindcss`, `@tailwindcss/postcss` or `@tailwindcss/vite`)
2. PostCSS config or Vite plugin setup
3. CSS entry import (`@import "tailwindcss"` for v4)
4. Content paths configuration

## Framework specifics

- **Vite**: prefer `@tailwindcss/vite` plugin
- **Next.js**: PostCSS approach via `postcss.config.mjs`

## Teardown

1. Uninstall `tailwindcss` and related packages
2. Remove PostCSS / Vite plugin entry
3. Remove `@import "tailwindcss"` from CSS entry
4. Remove `tailwind.config.*` if present (v3)

## Notes

Tailwind v4 (default in 2026) uses CSS-first config — no `tailwind.config.js` anymore. Check Context7 output for current approach.
