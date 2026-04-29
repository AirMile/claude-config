# Playwright Setup

**Status:** stub — full guide te genereren via Context7 query.

## Detection

- Already installed: `@playwright/test` in devDependencies OR `playwright.config.*` exists

## Install (via Context7)

```
mcp__context7__resolve-library-id(libraryName: "playwright")
mcp__context7__query-docs(
  context7CompatibleLibraryID: "{id}",
  query: "installation init typescript {framework}"
)
```

Volg Context7 output voor:

1. `npm init playwright@latest` (interactieve init)
2. Browser download (`npx playwright install`)
3. `playwright.config.ts` met baseURL en projects
4. CI workflow voorbeeld (optional)

## Framework specifics

- **Next.js**: configureer `webServer` in playwright config voor dev server start
- **Vite**: idem maar voor `npm run dev` op port 5173

## Teardown

1. Uninstall `@playwright/test`
2. Verwijder `playwright.config.*`
3. Verwijder `tests/` of `e2e/` directory
4. Verwijder browser binaries: `rm -rf ~/.cache/ms-playwright` (optioneel, vraag user)
5. Verwijder test scripts uit `package.json`

## Notes

Playwright installeert browsers (~300MB). Update `.gitignore` voor `playwright-report/`, `test-results/`.
