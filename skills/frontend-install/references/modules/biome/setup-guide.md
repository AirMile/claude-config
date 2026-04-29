# Biome Setup

**Status:** stub — full guide te genereren via Context7 query.

**Conflict check:** Bij ESLint/Prettier al geïnstalleerd, vraag of die vervangen moeten worden. Biome is een unified replacement.

## Detection

- Already installed: `@biomejs/biome` in devDependencies OR `biome.json` exists

## Install (via Context7)

```
mcp__context7__resolve-library-id(libraryName: "biome")
mcp__context7__query-docs(
  context7CompatibleLibraryID: "{id}",
  query: "installation init config {framework} react"
)
```

Volg Context7 output voor:

1. Install: `npm install -D --save-exact @biomejs/biome`
2. Init: `npx biome init`
3. `biome.json` config (linter rules + formatter)
4. Scripts in `package.json` (`lint`, `format`, `check`)

## Framework specifics

- **React/Next.js/Vite**: enable React-specific rules in `biome.json` linter config

## Teardown

1. Uninstall `@biomejs/biome`
2. Verwijder `biome.json`
3. Verwijder lint/format scripts uit `package.json`
4. Optioneel: re-install ESLint/Prettier (apart traject)

## Notes

Biome is veel sneller dan ESLint+Prettier (Rust-based). Geen plugins ecosystem zo groot als ESLint, maar volstaat voor de meeste projecten.
