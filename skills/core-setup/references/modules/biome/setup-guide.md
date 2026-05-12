# Biome Setup

**Status:** stub — full guide to be generated via Context7 query.

**Conflict check:** If ESLint/Prettier is already installed, ask whether it should be replaced. Biome is a unified replacement.

## Detection

| State                          | Condition                                                            |
| ------------------------------ | -------------------------------------------------------------------- |
| `already-installed-configured` | `@biomejs/biome` in devDependencies AND `biome.json` present         |
| `installed-not-configured`     | `@biomejs/biome` in devDependencies BUT `biome.json` missing         |
| `not-installed`                | `@biomejs/biome` not in devDependencies AND `biome.json` not present |

## Install (via Context7)

```
mcp__context7__resolve-library-id(libraryName: "biome")
mcp__context7__query-docs(
  context7CompatibleLibraryID: "{id}",
  query: "installation init config {framework} react"
)
```

Follow Context7 output for:

1. Install: `npm install -D --save-exact @biomejs/biome`
2. Init: `npx biome init`
3. `biome.json` config (linter rules + formatter)
4. Scripts in `package.json` (`lint`, `format`, `check`)

## Framework specifics

- **React/Next.js/Vite**: enable React-specific rules in `biome.json` linter config

## Teardown

1. Uninstall `@biomejs/biome`
2. Remove `biome.json`
3. Remove lint/format scripts from `package.json`
4. Optional: re-install ESLint/Prettier (separate process)

## Notes

Biome is much faster than ESLint+Prettier (Rust-based). Plugin ecosystem is not as large as ESLint, but sufficient for most projects.
