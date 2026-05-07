# shadcn-ui Setup

**Status:** stub — full guide te genereren via Context7 query.

**Prerequisite:** Tailwind CSS moet geïnstalleerd zijn. Check `tailwindcss` in dependencies; zo niet, run eerst Tailwind module.

## Detection

| State                          | Conditie                                   |
| ------------------------------ | ------------------------------------------ |
| `already-installed-configured` | `components.json` aanwezig in project root |
| `not-installed`                | `components.json` niet aanwezig            |

shadcn-ui installeert geen NPM package — de CLI copieert componenten. Geen `installed-not-configured` toestand: als `components.json` er is, is shadcn geïnitialiseerd.

## Install (via Context7)

```
mcp__context7__resolve-library-id(libraryName: "shadcn")
mcp__context7__query-docs(
  context7CompatibleLibraryID: "{id}",
  query: "init {framework} components.json setup"
)
```

Volg de Context7 output voor:

1. `npx shadcn@latest init` (interactieve init)
2. Path aliases setup in `tsconfig.json` / `vite.config`
3. Eerste componenten toevoegen via `npx shadcn@latest add button`

## Framework specifics

- **Next.js**: heeft eerste-class support in init wizard
- **Vite**: vereist extra path-alias config

## Teardown

1. Verwijder `components.json`
2. Verwijder `components/ui/` directory
3. Verwijder Radix dependencies die alleen door shadcn gebruikt werden
4. Verwijder utility helpers (`lib/utils.ts`)

## Notes

shadcn-ui is geen library in traditionele zin — het kopieert componenten naar je project. Geen runtime dependency, wel design tokens via Tailwind theme.
