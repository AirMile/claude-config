# Zustand Setup

**Status:** stub — full guide te genereren via Context7 query.

## Detection

| State           | Conditie                       |
| --------------- | ------------------------------ |
| `installed`     | `zustand` in dependencies      |
| `not-installed` | `zustand` niet in dependencies |

Geen apart configuratiebestand — `installed` geldt als `already-installed-configured` voor PHASE 5 stap 0.

## Install (via Context7)

```
mcp__context7__resolve-library-id(libraryName: "zustand")
mcp__context7__query-docs(
  context7CompatibleLibraryID: "{id}",
  query: "installation typescript create store middleware persist"
)
```

Volg Context7 output voor:

1. Install: `zustand`
2. Eerste store template: `src/stores/{store-name}.ts`
3. TypeScript pattern (use of `create<State>()` curried form)
4. Optioneel: persist middleware, devtools middleware

## Framework specifics

- **Next.js**: zorg voor SSR-veilige hydration (zustand v4+ werkt out-of-the-box; check `useStore` boundary)

## Teardown

1. Uninstall `zustand`
2. Delete `src/stores/` (or ask user which files to remove)
3. Refactor components that used `useStore` to an alternative

## Notes

Zustand is minimal (~1kb), no provider needed. For server state: use TanStack Query alongside.
