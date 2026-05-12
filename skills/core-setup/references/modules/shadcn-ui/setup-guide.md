# shadcn-ui Setup

**Status:** stub — generate full guide via Context7 query.

**Prerequisite:** Tailwind CSS must be installed. Check `tailwindcss` in dependencies; if not, run the Tailwind module first.

## Detection

| State                          | Condition                                 |
| ------------------------------ | ----------------------------------------- |
| `already-installed-configured` | `components.json` present in project root |
| `not-installed`                | `components.json` not present             |

shadcn-ui does not install an NPM package — the CLI copies components. No `installed-not-configured` state: if `components.json` is present, shadcn is initialized.

## Install (via Context7)

```
mcp__context7__resolve-library-id(libraryName: "shadcn")
mcp__context7__query-docs(
  context7CompatibleLibraryID: "{id}",
  query: "init {framework} components.json setup"
)
```

Follow the Context7 output for:

1. `npx shadcn@latest init` (interactive init)
2. Path aliases setup in `tsconfig.json` / `vite.config`
3. Add first components via `npx shadcn@latest add button`

## Framework specifics

- **Next.js**: has first-class support in init wizard
- **Vite**: requires extra path-alias config

## Teardown

1. Remove `components.json`
2. Remove `components/ui/` directory
3. Remove Radix dependencies that were only used by shadcn
4. Remove utility helpers (`lib/utils.ts`)

## Notes

shadcn-ui is not a library in the traditional sense — it copies components into your project. No runtime dependency, but design tokens via Tailwind theme.
