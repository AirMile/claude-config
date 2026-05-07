# CODEGEN — Shared Code Generation Patterns

Gedeelde patronen voor `frontend-convert` (FASE 2.1/2.2) en `frontend-design` (Build route). Elke skill bevat skill-specifieke logica inline; deze file dekt alleen gedeelde, stackoverstijgende patronen.

---

## Block Inventory Consultatie

**Bron:** `project-context.json#components[]`

Raadpleeg de block inventory vóór code-generatie om te voorkomen dat bestaande UI-blokken opnieuw gegenereerd worden.

```json
// Voorbeeld component entry
{
  "name": "Button",
  "src": "src/components/ui/Button.tsx",
  "exports": ["Button", "buttonVariants"],
  "variants": ["primary", "ghost", "destructive"],
  "sizes": ["sm", "md", "lg"]
}
```

**Aanpak:**

1. Zoek componenten op naam-match: spec-sectie "call to action" → zoek `Button`, `CTA`, `PrimaryAction`
2. Zoek op structuur: spec-sectie "card grid" → zoek `Card`, `Grid`, `ProductCard`
3. Gebruik `src` pad voor imports — nooit herschrijven wat al bestaat
4. Als component niet bestaat maar spec beschrijft het → genereer nieuw als inline component of apart bestand (zie Output Structure hieronder)

---

## Token Mapping

**Bron:** `project.json#theme`

Beschikbare token-categorieën:

| Categorie   | Token pad                     | Tailwind equivalent                             |
| ----------- | ----------------------------- | ----------------------------------------------- |
| Kleuren     | `theme.colors.primary`        | `bg-primary`, `text-primary`                    |
| Achtergrond | `theme.colors.background`     | `bg-background`                                 |
| Tekst       | `theme.colors.foreground`     | `text-foreground`                               |
| Border      | `theme.colors.border`         | `border-border`                                 |
| Muted       | `theme.colors.muted`          | `bg-muted`, `text-muted-foreground`             |
| Destructive | `theme.colors.destructive`    | `bg-destructive`, `text-destructive-foreground` |
| Typography  | `theme.typography.fontFamily` | Gebruik CSS var of Tailwind `font-{name}`       |
| Spacing     | `theme.spacing`               | Tailwind spacing scale of CSS var               |

**Regel:** gebruik altijd token-namen als ze beschikbaar zijn. Val terug op Tailwind defaults als een token ontbreekt. Gebruik **nooit** hardcoded hex-waarden tenzij in 1:1 modus (convert only).

**No-hex regel:**

Gebruik **nooit** raw hex-waarden of arbitrary Tailwind color-values buiten 1:1 convert-modus:

- Verboden: `bg-[#FF5733]`, `text-[#1a1a2e]`, `border-[#eee]`
- Verboden: `style={{ backgroundColor: "#..." }}` inline
- Toegestaan: `bg-primary`, `text-foreground`, `border-border`, `bg-[var(--color-…)]`

De Build route valideert dit na write via een regex post-pass (zie `frontend-design` Build Stap 4).

**Dark mode:**

Check `theme.modes.dark`. Als aanwezig: voeg `dark:` prefix toe aan alle kleur-gerelateerde classes.

```tsx
// Goed — token + dark mode
<div className="bg-background dark:bg-background text-foreground dark:text-foreground">

// Goed — fallback zonder dark mode config
<div className="bg-white text-gray-900">

// Fout — hardcoded in niet-1:1 modus
<div style={{ backgroundColor: "#1a1a2e" }}>
```

---

## Output Structure Heuristics

Bepaal het bestandspad op basis van `project.json#stack.framework`:

| Framework          | Page pattern                      | Component pattern                    |
| ------------------ | --------------------------------- | ------------------------------------ |
| Next.js App Router | `app/{route}/page.tsx`            | `app/{route}/_components/{Name}.tsx` |
| Next.js Pages      | `pages/{route}.tsx`               | `components/{Name}.tsx`              |
| Vite + React       | `src/pages/{Route}Page.tsx`       | `src/components/{Name}.tsx`          |
| SvelteKit          | `src/routes/{route}/+page.svelte` | `src/lib/components/{Name}.svelte`   |
| Nuxt               | `pages/{route}.vue`               | `components/{Name}.vue`              |
| Astro              | `src/pages/{route}.astro`         | `src/components/{Name}.astro`        |
| Remix              | `app/routes/{route}.tsx`          | `app/components/{Name}.tsx`          |

Als framework niet in deze tabel staat of `stack.framework` leeg is: vraag user vóór code-generatie.

**Co-location regel:** subcomponenten die alleen door één page worden gebruikt → co-locate in `_components/` (Next.js) of naast het page-bestand. Hergebruikte componenten → `src/components/` (of framework-equivalent).

---

## Accessibility Scaffold {#a11y}

Minimale a11y-structuur per page-type. Altijd toepassen, ook zonder expliciete spec-instructie.

**Page wrapper:**

```tsx
// Next.js App Router voorbeeld
export default function DashboardPage() {
  return <main aria-label="Dashboard">{/* inhoud */}</main>;
}
```

**Skip nav (alleen voor pages met meerdere secties):**

```tsx
<a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-background">
  Skip to main content
</a>
<main id="main-content" aria-label="{page-name}">
```

**Veelgebruikte patronen:**

| Element       | Regel                                                                          |
| ------------- | ------------------------------------------------------------------------------ |
| `<button>`    | Altijd `aria-label` als tekst niet duidelijk is (`aria-label="Sluit dialoog"`) |
| `<img>`       | Altijd `alt`. Decoratief: `alt=""`                                             |
| Forms         | `<label htmlFor>` of `aria-label` per input. `role="alert"` voor inline-errors |
| Navigatie     | `<nav aria-label="...">` — onderscheid main-nav van secondary-nav              |
| Dialogen      | `role="dialog" aria-modal="true" aria-labelledby="{id}"`                       |
| Loading state | `aria-busy="true"` op container, `aria-live="polite"` voor status-updates      |

---

## cva Variant Pattern

Gebruik `cva` (class-variance-authority) voor componenten met ≥2 varianten. Check beschikbaarheid in `package.json` — installeer niet automatisch, noteer als missing dependency.

```typescript
import { cva, type VariantProps } from "class-variance-authority";

const componentVariants = cva(
  // base classes (altijd aanwezig)
  "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary/90",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4",
        lg: "h-12 px-6 text-lg",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

interface ComponentProps
  extends
    React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof componentVariants> {}
```

---

## State Components (loading / error / empty)

Genereer state-varianten naast de happy path als de spec of context er om vraagt.

| State     | Aanpak                                                                                         |
| --------- | ---------------------------------------------------------------------------------------------- |
| `loading` | Skeleton die happy-path layout spiegelt — zelfde grid/flex, placeholder blokken op tekst.      |
| `error`   | Foutmelding + retry-actie. Gebruik `destructive` color token.                                  |
| `empty`   | Contextual lege staat: infereer uit sectienaam wat de inhoud zou zijn (bijv. "Nog geen items") |

Alle states volgen dezelfde `dark:` en responsive logica als de happy path.

---

## Contextual Content

Gebruik **nooit** "Lorem ipsum". Infereer placeholder-tekst uit spec of sectienaam:

- Sectie "user profile" → "Jan Jansen", "jan@example.com"
- Sectie "recent activity" → "Feature geïmplementeerd", "2 uur geleden"
- Sectie "stats" → "1.247 gebruikers", "+12% deze week"

---

## Placeholder Images

Gebruik **alleen** het project's eigen placeholder-asset. Externe CDN-URLs hallucineren makkelijk en breken bij deployen.

**Contract:**

- Toegestaan: `/placeholder.svg?w={width}&h={height}` (of `/placeholder.png` als SVG niet ondersteund)
- Verboden: Unsplash (`images.unsplash.com`), Pexels, picsum.photos, placehold.co, fakeimg.pl, en alle andere externe image-hosts
- Noteer als missing dependency in BUILD PLAN als `public/placeholder.svg` niet bestaat

**Dimensies per context:**

| Context           | URL                             |
| ----------------- | ------------------------------- |
| Avatar            | `/placeholder.svg?w=40&h=40`    |
| Card image        | `/placeholder.svg?w=400&h=300`  |
| Hero image        | `/placeholder.svg?w=1200&h=600` |
| Product thumbnail | `/placeholder.svg?w=200&h=200`  |

De Build route valideert externe URLs na write via een regex post-pass (zie `frontend-design` Build Stap 4).

---

## `cn()` Utility

Gebruik `cn()` voor className-samenstelling. Maak `src/lib/utils.ts` aan als niet aanwezig:

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

Nodig: `clsx` en `tailwind-merge` in package.json. Noteer als missing dependency als afwezig.
