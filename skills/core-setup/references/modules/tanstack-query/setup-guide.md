# TanStack Query Setup

**Status:** stub — full guide to be generated via Context7 query.

## Detection

| State           | Condition                                   |
| --------------- | ------------------------------------------- |
| `installed`     | `@tanstack/react-query` in dependencies     |
| `not-installed` | `@tanstack/react-query` not in dependencies |

No separate config file — `installed` counts as `already-installed-configured` for PHASE 5 step 0.

## Install (via Context7)

```
mcp__context7__resolve-library-id(libraryName: "tanstack query")
mcp__context7__query-docs(
  context7CompatibleLibraryID: "{id}",
  query: "installation {framework} provider devtools setup"
)
```

Follow Context7 output for:

1. Install: `@tanstack/react-query` + optional `@tanstack/react-query-devtools`
2. `QueryClient` setup with defaults (staleTime, retry, etc.)
3. `QueryClientProvider` in root layout / app entry
4. Optional: hydration boundary for Next.js Server Components

## Framework specifics

- **Next.js (App Router)**: use `HydrationBoundary` for server-prefetched data
- **Vite (SPA)**: simple `QueryClientProvider` in `main.tsx`

## Teardown

1. Uninstall TanStack Query packages
2. Remove `QueryClientProvider` from root
3. Replace `useQuery` / `useMutation` calls with fetch alternative (manual)

## Notes

For mutations: configure `queryClient.invalidateQueries` patterns. For type-safety: combine with OpenAPI/tRPC client if present in the stack.
