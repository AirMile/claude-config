# Tailwind CSS Setup

**Status:** stub — full guide te genereren via Context7 query.

## Detection

- Already installed: `tailwindcss` in `package.json` dependencies OR `tailwind.config.{js,ts}` exists

## Install (via Context7)

```
mcp__context7__resolve-library-id(libraryName: "tailwindcss")
mcp__context7__query-docs(
  context7CompatibleLibraryID: "{id}",
  query: "installation {framework} v4 setup postcss config"
)
```

Volg de Context7 output voor:

1. Install commands (`tailwindcss`, `@tailwindcss/postcss` of `@tailwindcss/vite`)
2. PostCSS config of Vite plugin setup
3. CSS entry import (`@import "tailwindcss"` voor v4)
4. Content paths configuratie

## Framework specifics

- **Vite**: prefer `@tailwindcss/vite` plugin
- **Next.js**: PostCSS approach via `postcss.config.mjs`

## Teardown

1. Uninstall `tailwindcss` en gerelateerde packages
2. Verwijder PostCSS / Vite plugin entry
3. Verwijder `@import "tailwindcss"` uit CSS entry
4. Verwijder `tailwind.config.*` indien aanwezig (v3)

## Notes

Tailwind v4 (default in 2026) gebruikt CSS-first config — geen `tailwind.config.js` meer. Check Context7 output voor actuele aanpak.
