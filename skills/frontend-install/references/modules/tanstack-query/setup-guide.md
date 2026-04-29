# TanStack Query Setup

**Status:** stub — full guide te genereren via Context7 query.

## Detection

- Already installed: `@tanstack/react-query` in dependencies

## Install (via Context7)

```
mcp__context7__resolve-library-id(libraryName: "tanstack query")
mcp__context7__query-docs(
  context7CompatibleLibraryID: "{id}",
  query: "installation {framework} provider devtools setup"
)
```

Volg Context7 output voor:

1. Install: `@tanstack/react-query` + optioneel `@tanstack/react-query-devtools`
2. `QueryClient` setup met defaults (staleTime, retry, etc.)
3. `QueryClientProvider` in root layout / app entry
4. Optional: hydration boundary voor Next.js Server Components

## Framework specifics

- **Next.js (App Router)**: gebruik `HydrationBoundary` voor server-prefetched data
- **Vite (SPA)**: simpel `QueryClientProvider` in `main.tsx`

## Teardown

1. Uninstall TanStack Query packages
2. Verwijder `QueryClientProvider` uit root
3. Vervang `useQuery` / `useMutation` calls door fetch alternatief (handmatig)

## Notes

Voor mutations: configureer `queryClient.invalidateQueries` patterns. Voor type-safety: combineer met OpenAPI/tRPC client als die in de stack zit.
