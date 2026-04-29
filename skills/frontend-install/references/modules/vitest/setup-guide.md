# Vitest Setup

**Status:** stub — full guide te genereren via Context7 query.

## Detection

- Already installed: `vitest` in devDependencies OR `vitest.config.*` exists

## Install (via Context7)

```
mcp__context7__resolve-library-id(libraryName: "vitest")
mcp__context7__query-docs(
  context7CompatibleLibraryID: "{id}",
  query: "installation {framework} setup config jsdom"
)
```

Volg Context7 output voor:

1. Install: `vitest`, `@vitest/ui` (optioneel), `jsdom` of `happy-dom` voor DOM tests
2. `vitest.config.ts` met test environment config
3. Test scripts in `package.json` (`test`, `test:ui`, `coverage`)
4. Optional: `@testing-library/react` + `@testing-library/jest-dom` voor component tests

## Framework specifics

- **Vite**: kan `vite.config` hergebruiken voor `defineConfig`
- **Next.js**: vereist aparte vitest config met React plugin

## Teardown

1. Uninstall `vitest` en testing-library packages
2. Verwijder `vitest.config.*`
3. Verwijder test scripts uit `package.json`
4. Verwijder `tests/` directory of `*.test.{ts,tsx}` bestanden (optioneel, vraag user)

## Notes

Voor monorepo setup met workspaces: Context7 query met `query: "workspace projects monorepo"`.
