# Zustand Setup

**Status:** stub — full guide to be generated via Context7 query.

## Detection

| State           | Condition                     |
| --------------- | ----------------------------- |
| `installed`     | `zustand` in dependencies     |
| `not-installed` | `zustand` not in dependencies |

No separate config file — `installed` counts as `already-installed-configured` for PHASE 5 step 0.

## Install (via Context7)

```
mcp__context7__resolve-library-id(libraryName: "zustand")
mcp__context7__query-docs(
  context7CompatibleLibraryID: "{id}",
  query: "installation typescript create store middleware persist"
)
```

Follow Context7 output for:

1. Install: `zustand`
2. First store template: `src/stores/{store-name}.ts`
3. TypeScript pattern (use of `create<State>()` curried form)
4. Optional: persist middleware, devtools middleware

## Framework specifics

- **Next.js**: ensure SSR-safe hydration (zustand v4+ works out-of-the-box; check `useStore` boundary)

## Teardown

1. Uninstall `zustand`
2. Delete `src/stores/` (or ask user which files to remove)
3. Refactor components that used `useStore` to an alternative

## Notes

Zustand is minimal (~1kb), no provider needed. For server state: use TanStack Query alongside.
