# ESLint + Prettier Setup

**Status:** stub — full guide to be generated via Context7 query.

**Conflict check:** If Biome is already installed, ask whether it should be replaced. Do not run both simultaneously.

## Detection

| State                          | Condition                                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------- |
| `already-installed-configured` | `eslint` AND `prettier` in devDependencies AND `eslint.config.*` or `.eslintrc.*` present |
| `installed-not-configured`     | `eslint` AND `prettier` in devDependencies BUT config file missing                        |
| `not-installed`                | `eslint` or `prettier` not in devDependencies                                             |

## Install (via Context7)

Two parallel queries:

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

Follow Context7 output for:

1. Install: `eslint`, `prettier`, `@eslint/js`, `typescript-eslint`, `eslint-config-prettier`, `eslint-plugin-react-hooks` (where applicable)
2. `eslint.config.mjs` (flat config, ESLint 9+)
3. `.prettierrc.json` with team conventions
4. `.prettierignore` with build outputs
5. Scripts in `package.json` (`lint`, `format`)

## Framework specifics

- **Next.js**: uses `eslint-config-next` (already included with `create-next-app`)
- **Vite**: add `eslint-plugin-react-refresh`

## Teardown

1. Uninstall ESLint and Prettier packages
2. Remove configs
3. Remove `.prettierignore`
4. Remove scripts from `package.json`

## Notes

ESLint 9 uses flat config (`eslint.config.mjs`). Old `.eslintrc.*` is deprecated. Check Context7 for current migration path.
