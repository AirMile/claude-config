# Zustand Setup

**Status:** stub — full guide te genereren via Context7 query.

## Detection

| State           | Conditie                       |
| --------------- | ------------------------------ |
| `installed`     | `zustand` in dependencies      |
| `not-installed` | `zustand` niet in dependencies |

Geen apart configuratiebestand — `installed` geldt als `already-installed-configured` voor FASE 5 stap 0.

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
2. Verwijder `src/stores/` (of vraag user welke files weg moeten)
3. Refactor componenten die `useStore` gebruikten naar alternatief

## Notes

Zustand is minimaal (~1kb), geen provider nodig. Voor server state: gebruik TanStack Query parallel.
