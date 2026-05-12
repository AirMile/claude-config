# React Hook Form + Zod Setup

**Status:** stub — full guide to be generated via Context7 query.

## Detection

| State           | Condition                                      |
| --------------- | ---------------------------------------------- |
| `installed`     | `react-hook-form` AND `zod` in dependencies    |
| `not-installed` | `react-hook-form` or `zod` not in dependencies |

No separate config file — `installed` counts as `already-installed-configured` for PHASE 5 step 0.
Bridge package `@hookform/resolvers` is optional; its presence does not change state.

## Install (via Context7)

```
mcp__context7__resolve-library-id(libraryName: "react-hook-form")
mcp__context7__query-docs(
  context7CompatibleLibraryID: "{id}",
  query: "zod resolver typescript form schema validation"
)
```

Follow Context7 output for:

1. Install: `react-hook-form`, `zod`, `@hookform/resolvers`
2. Example form template with:
   - Zod schema definition
   - `useForm({ resolver: zodResolver(schema) })`
   - Field components with `register` + error display
3. Inferred TypeScript types via `z.infer<typeof schema>`

## Framework specifics

- **shadcn-ui present**: use `<Form>` components from shadcn that wrap RHF
- **Server Actions (Next.js)**: combine with server-side zod parse for double validation

## Teardown

1. Uninstall all three packages
2. Replace form code with alternative (HTML forms, other lib)

## Notes

Zod is dual-use: used for RHF resolver and for server-side validation. Keep schemas in shared `lib/schemas/` for reusability.
