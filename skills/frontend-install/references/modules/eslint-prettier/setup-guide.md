# ESLint + Prettier Setup

**Status:** stub — full guide te genereren via Context7 query.

**Conflict check:** Bij Biome al geïnstalleerd, vraag of dat vervangen moet worden. Niet beide tegelijk runnen.

## Detection

- Already installed: `eslint` in devDependencies AND `prettier` in devDependencies
- Config bestaat: `eslint.config.{js,mjs}` of `.eslintrc.*` + `.prettierrc.*`

## Install (via Context7)

Twee parallelle queries:

```
mcp__context7__resolve-library-id(libraryName: "eslint")
mcp__context7__query-docs(
  context7CompatibleLibraryID: "{id}",
  query: "flat config {framework} typescript react"
)

mcp__context7__resolve-library-id(libraryName: "prettier")
mcp__context7__query-docs(
  context7CompatibleLibraryID: "{id}",
  query: "config integration eslint"
)
```

Volg Context7 output voor:

1. Install: `eslint`, `prettier`, `@eslint/js`, `typescript-eslint`, `eslint-config-prettier`, `eslint-plugin-react-hooks` (waar van toepassing)
2. `eslint.config.mjs` (flat config, ESLint 9+)
3. `.prettierrc.json` met team conventies
4. `.prettierignore` met build outputs
5. Scripts in `package.json` (`lint`, `format`)

## Framework specifics

- **Next.js**: gebruikt `eslint-config-next` (al inbegrepen bij `create-next-app`)
- **Vite**: voeg `eslint-plugin-react-refresh` toe

## Teardown

1. Uninstall ESLint en Prettier packages
2. Verwijder configs
3. Verwijder `.prettierignore`
4. Verwijder scripts uit `package.json`

## Notes

ESLint 9 gebruikt flat config (`eslint.config.mjs`). Oude `.eslintrc.*` is deprecated. Check Context7 voor actuele migration path.
