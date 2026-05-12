# Vitest Setup

**Status:** stub — full guide to be generated via Context7 query.

## Detection

| State                          | Condition                                                 |
| ------------------------------ | --------------------------------------------------------- |
| `already-installed-configured` | `vitest` in devDependencies AND `vitest.config.*` present |
| `installed-not-configured`     | `vitest` in devDependencies BUT `vitest.config.*` missing |
| `not-installed`                | `vitest` not in devDependencies                           |

## Install (via Context7)

```
mcp__context7__resolve-library-id(libraryName: "vitest")
mcp__context7__query-docs(
  context7CompatibleLibraryID: "{id}",
  query: "installation {framework} setup config jsdom"
)
```

Follow Context7 output for:

1. Install: `vitest`, `@vitest/ui` (optional), `jsdom` or `happy-dom` for DOM tests
2. `vitest.config.ts` with test environment config
3. Test scripts in `package.json` (`test`, `test:ui`, `coverage`)
4. Optional: `@testing-library/react` + `@testing-library/jest-dom` for component tests

## Framework specifics

- **Vite**: can reuse `vite.config` for `defineConfig`
- **Next.js**: requires separate vitest config with React plugin

## Teardown

1. Uninstall `vitest` and testing-library packages
2. Remove `vitest.config.*`
3. Remove test scripts from `package.json`
4. Remove `tests/` directory or `*.test.{ts,tsx}` files (optional, ask user)

## Notes

For monorepo setup with workspaces: Context7 query with `query: "workspace projects monorepo"`.
