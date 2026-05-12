# React Hook Form + Zod Setup

**Status:** stub — full guide te genereren via Context7 query.

## Detection

| State           | Conditie                                        |
| --------------- | ----------------------------------------------- |
| `installed`     | `react-hook-form` EN `zod` in dependencies      |
| `not-installed` | `react-hook-form` of `zod` niet in dependencies |

Geen apart configuratiebestand — `installed` geldt als `already-installed-configured` voor PHASE 5 stap 0.
Bridge package `@hookform/resolvers` is optioneel; aanwezigheid verandert state niet.

## Install (via Context7)

```
mcp__context7__resolve-library-id(libraryName: "react-hook-form")
mcp__context7__query-docs(
  context7CompatibleLibraryID: "{id}",
  query: "zod resolver typescript form schema validation"
)
```

Volg Context7 output voor:

1. Install: `react-hook-form`, `zod`, `@hookform/resolvers`
2. Voorbeeld form template met:
   - Zod schema definitie
   - `useForm({ resolver: zodResolver(schema) })`
   - Field components met `register` + error display
3. Inferred TypeScript types via `z.infer<typeof schema>`

## Framework specifics

- **shadcn-ui present**: use `<Form>` components from shadcn that wrap RHF
- **Server Actions (Next.js)**: combineer met server-side zod parse voor double validation

## Teardown

1. Uninstall alle drie packages
2. Vervang form code door alternatief (HTML forms, andere lib)

## Notes

Zod is dual-use: gebruikt voor RHF resolver én voor server-side validation. Houd schemas in shared `lib/schemas/` voor herbruikbaarheid.
