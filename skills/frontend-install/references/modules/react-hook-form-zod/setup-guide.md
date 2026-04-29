# React Hook Form + Zod Setup

**Status:** stub — full guide te genereren via Context7 query.

## Detection

- Already installed: `react-hook-form` AND `zod` in dependencies
- Bridge: `@hookform/resolvers` voor zod resolver

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

- **shadcn-ui aanwezig**: gebruik `<Form>` componenten uit shadcn die RHF wrappen
- **Server Actions (Next.js)**: combineer met server-side zod parse voor double validation

## Teardown

1. Uninstall alle drie packages
2. Vervang form code door alternatief (HTML forms, andere lib)

## Notes

Zod is dual-use: gebruikt voor RHF resolver én voor server-side validation. Houd schemas in shared `lib/schemas/` voor herbruikbaarheid.
