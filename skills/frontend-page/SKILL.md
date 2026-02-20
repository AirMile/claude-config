---
name: frontend-page
description: >-
  Create a new page from user stories to working code in 4 phases: requirements,
  ASCII layout, code generation, and optional data hookup. Framework-aware output
  for Next.js, Vite, Remix, Astro. Use with /frontend-page or /frontend-page [page-name].
argument-hint: "[page-name]"
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: frontend
---

# Page

Create a new page from concept to working code. Gather requirements via user stories, design the layout as ASCII art in the terminal, generate the full page, and optionally hook up real data.

**Pipeline:** `/frontend-theme` (optional) → `/frontend-page` → `/frontend-iterate` → quality skills

## References

- `../shared/RULES.md` — React/TypeScript coding rules
- `../shared/PATTERNS.md` — Component patterns (compound, render props, etc.)
- `../shared/DEVINFO.md` — Session tracking, cross-skill handoff

---

## FASE 0: Pre-flight

### 0.1 Argument Check

- **Argument provided** (`/frontend-page dashboard`): use as page name, proceed to 0.2.
- **No argument** (`/frontend-page`): ask for page name and purpose:

```yaml
header: "Pagina"
question: "Welke pagina wil je maken? Geef een naam en beschrijf kort het doel."
options:
  - label: "Dashboard", description: "Overzicht met metrics, grafieken, status"
  - label: "Landing page", description: "Marketing pagina met hero en CTA"
  - label: "Formulier", description: "Data invoer met validatie"
multiSelect: false
# User can choose "Other" for custom page name + description
```

### 0.2 Project Context Scan

Spawn an **Explore agent** (`subagent_type="Explore"`, thoroughness: "very thorough") to scan the project. This keeps the main context clean.

**Agent prompt:**

```
Scan this project and report back with a structured summary:

1. Framework: Check package.json for next, vite, remix, astro, nuxt, sveltekit.
   Report framework name + version + router type (App Router vs Pages for Next.js).

2. Existing pages: Glob for page files:
   - app/**/page.{tsx,jsx}
   - src/pages/**/*.{tsx,jsx,vue,svelte,astro}
   - src/routes/**/*.{tsx,jsx,svelte}
   List all routes found.

3. Existing components: Glob for component files:
   - src/components/**/*.{tsx,jsx,vue,svelte}
   - components/**/*.{tsx,jsx,vue,svelte}
   List component names (no content, just names).

4. API routes: Glob for:
   - app/api/**/*.{ts,js}
   - src/api/**/*.{ts,js}
   - pages/api/**/*.{ts,js}
   List endpoint paths.

5. Data models: Glob for:
   - src/types/**/*.{ts,d.ts}
   - types/**/*.{ts,d.ts}
   - src/models/**/*.{ts,js}
   List type/interface names from these files.

6. UI library: Check package.json for tailwindcss, @mui/material,
   @chakra-ui/react, @mantine/core, shadcn. Check for tailwind.config.*.

7. State management: Check for zustand, redux, jotai, recoil, @tanstack/react-query, swr.

8. Theme: Check if .workspace/config/THEME.md exists. If yes, report token categories.

9. Utility: Check if src/lib/utils.ts exists with cn() function.

Return a structured summary with sections for each point above.
Do NOT read file contents beyond what's needed for detection.
```

### 0.3 Display Context

Show the scan results to the user:

```
PROJECT CONTEXT
════════════════════════════════════════════════════════════════

Project:     [name from package.json]
Framework:   [Next.js 14 App Router | Vite + React | etc.]
UI Library:  [Tailwind CSS | MUI | None detected]
State:       [React Query | SWR | Zustand | None detected]

Pages ({N}):       /products, /cart, /checkout, ...
Components ({N}):  Button, Card, Header, Footer, ...
API routes ({N}):  GET /api/products, POST /api/cart, ...
Data models ({N}): User, Product, Order, ...

Theme:     [Available (THEME.md) | Not available]
cn() util: [Available | Will create]

════════════════════════════════════════════════════════════════
```

---

## FASE 1: Requirements (User Stories)

### 1.1 Gather Purpose

If not already provided via argument, ask:

```yaml
header: "Beschrijving"
question: "Beschrijf wat deze pagina moet doen en voor wie het is. Geef een concreet voorbeeld."
options:
  - label: "Ik typ het uit", description: "Vrije beschrijving van de pagina"
multiSelect: false
```

**Good input examples:**

- "Dashboard voor marketing managers om campagne ROI te monitoren"
- "Checkout flow met payment options en order summary"
- "Settings pagina waar users profiel en notificaties aanpassen"

### 1.2 Clarifying Questions

Ask 2-3 targeted follow-up questions based on the description + project context. These vary by page type. Examples:

**For a dashboard:**

```yaml
header: "Key Metrics"
question: "Welke belangrijkste informatie moet direct zichtbaar zijn? (noem max 5)"
options:
  - label: "Ik typ het", description: "Beschrijf de metrics"
multiSelect: false
```

**For a form:**

```yaml
header: "Formulier Velden"
question: "Welke velden zijn nodig? (noem de belangrijkste)"
options:
  - label: "Ik typ het", description: "Beschrijf de velden"
multiSelect: false
```

**For a list/overview:**

```yaml
header: "Lijst Features"
question: "Welke features zijn nodig?"
options:
  - label: "Zoeken + Filters (Recommended)", description: "Tekst search en filter op eigenschappen"
  - label: "Zoeken + Filters + Sorteren", description: "Plus sorteer opties"
  - label: "Alles", description: "Zoeken, filters, sorteren, pagination, bulk acties"
multiSelect: false
```

### 1.3 Formulate User Stories

Based on answers + project context, formulate user stories:

```
USER STORIES
════════════════════════════════════════════════════════════════

Page: [name]

1. Als [role] wil ik [action] zodat [result]
2. Als [role] wil ik [action] zodat [result]
3. Als [role] wil ik [action] zodat [result]
...

SECTIONS (derived from stories):
- [Section 1]: [what it contains]
- [Section 2]: [what it contains]
- [Section 3]: [what it contains]

REUSABLE (from project):
- [existing component] → can be reused for [section]
- [API endpoint] → provides data for [section]

════════════════════════════════════════════════════════════════
```

### 1.4 Validate Requirements

```yaml
header: "Requirements"
question: "Kloppen deze user stories en secties?"
options:
  - label: "Ja, ga door (Recommended)", description: "Start met ASCII layout"
  - label: "Aanpassen", description: "Ik wil iets wijzigen of toevoegen"
  - label: "Opnieuw", description: "Start requirements opnieuw"
multiSelect: false
```

If "Aanpassen": ask what to change, update stories, re-validate.

---

## FASE 2: ASCII Layout

### 2.1 Generate Initial Layout

Generate an ASCII layout from the validated user stories. Use box-drawing characters for clarity.

**Level 1 — Global structure:**

```
┌─────────────────────────────┐
│         HEADER              │
├─────────────────────────────┤
│         HERO                │
│   headline + CTA            │
├────────┬────────┬───────────┤
│ CARD 1 │ CARD 2 │ CARD 3    │
├────────┴────────┴───────────┤
│      TESTIMONIALS           │
├─────────────────────────────┤
│         FOOTER              │
└─────────────────────────────┘
```

Map each section to its user story and annotate key elements.

### 2.2 User Review

Present the layout via AskUserQuestion:

```yaml
header: "Layout"
question: "Hoe wil je verder met deze layout?"
options:
  - label: "Goedkeuren (Recommended)", description: "Ga door naar code generatie"
  - label: "Aanpassen", description: "Beschrijf wat er anders moet"
  - label: "3 alternatieven", description: "Toon 3 structureel verschillende layouts"
  - label: "Inzoomen", description: "Meer detail voor een specifieke sectie"
multiSelect: false
```

### 2.3 Alternatives (if requested)

Generate 3 structurally different layouts:

- **Variant A**: e.g., sidebar layout with filters
- **Variant B**: e.g., full-width stacked sections
- **Variant C**: e.g., split-screen with media panel

Present all 3 via AskUserQuestion with markdown previews so the user can visually compare.

```yaml
header: "Layout Keuze"
question: "Welke layout spreekt je het meest aan?"
options:
  - label: "Variant A"
    description: "Sidebar layout"
    markdown: "[ASCII art A]"
  - label: "Variant B"
    description: "Full-width stacked"
    markdown: "[ASCII art B]"
  - label: "Variant C"
    description: "Split-screen"
    markdown: "[ASCII art C]"
multiSelect: false
```

### 2.4 Zoom In (if requested)

Show level 2 detail for a specific section:

```
┌─────────────────────────────────────┐
│  ┌──────────────┐  ┌─────────────┐  │
│  │ H1: Manage   │  │             │  │
│  │ your team    │  │   [IMAGE]   │  │
│  │              │  │   640x400   │  │
│  │ subtitle     │  │             │  │
│  │ [GET STARTED]│  └─────────────┘  │
│  └──────────────┘                   │
└─────────────────────────────────────┘
```

After zoom, return to 2.2 for review.

### 2.5 Finalize Layout

Once approved, confirm the final layout with section-to-story mapping:

```
APPROVED LAYOUT
════════════════════════════════════════════════════════════════

Sections → Stories:
1. Header      → navigation, branding
2. Hero        → story #1 (headline + CTA)
3. Cards (3x)  → story #2 (feature highlights)
4. Testimonials → story #3 (social proof)
5. Footer      → navigation, legal

════════════════════════════════════════════════════════════════
```

---

## FASE 3: Code Generation

### 3.1 Determine Output Structure

Based on the project context scan from FASE 0:

| Framework          | Page file                | Component dir            |
| ------------------ | ------------------------ | ------------------------ |
| Next.js App Router | `app/[page]/page.tsx`    | `src/components/[page]/` |
| Next.js Pages      | `src/pages/[page].tsx`   | `src/components/[page]/` |
| Vite + React       | `src/pages/[page].tsx`   | `src/components/[page]/` |
| Remix              | `app/routes/[page].tsx`  | `app/components/[page]/` |
| Astro              | `src/pages/[page].astro` | `src/components/[page]/` |

### 3.2 Generate Complete Page

Generate the full page in one pass based on the approved layout and requirements.

**Rules:**

- Follow `shared/RULES.md` for React/TypeScript coding standards
- Follow `shared/PATTERNS.md` for component patterns
- Use `cn()` for className composition — create `src/lib/utils.ts` if not present
- TypeScript strict mode with proper interfaces
- Semantic HTML with aria-labels and keyboard support
- If THEME.md exists, integrate design tokens into Tailwind config extension
- Use existing components from the project where they match requirements
- Contextual placeholder text (not "Lorem ipsum") when no real data available

**Generate these files:**

1. **Page file** — main page component with layout structure
2. **Section components** — one per major layout section (only if complex enough to warrant extraction)
3. **Tailwind config extension** — if THEME.md tokens need to be added (only if not already present)
4. **cn() utility** — `src/lib/utils.ts` if not present

**Code patterns:**

```typescript
// Page file example (Next.js App Router)
import { HeroSection } from '@/components/[page]/HeroSection';
import { FeatureCards } from '@/components/[page]/FeatureCards';

export default function [Page]Page() {
  return (
    <main className="min-h-screen">
      <HeroSection />
      <FeatureCards />
      {/* ... */}
    </main>
  );
}
```

```typescript
// Section component example
import { cn } from '@/lib/utils';

interface HeroSectionProps {
  className?: string;
}

export function HeroSection({ className }: HeroSectionProps) {
  return (
    <section className={cn('relative py-20 px-6', className)}>
      <h1 className="text-4xl font-bold tracking-tight">
        Manage your team effortlessly
      </h1>
      <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
        Streamline collaboration and boost productivity with our platform.
      </p>
      <button className="mt-8 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
        Get Started
      </button>
    </section>
  );
}
```

### 3.3 Show Generation Summary

```
CODE GENERATED
════════════════════════════════════════════════════════════════

Files created:
  ✓ app/dashboard/page.tsx          (page)
  ✓ src/components/dashboard/HeroSection.tsx
  ✓ src/components/dashboard/FeatureCards.tsx
  ✓ src/components/dashboard/Testimonials.tsx
  ✓ src/lib/utils.ts                (cn utility — new)

Theme: [Integrated from THEME.md | Tailwind defaults used]
Existing components reused: [Header, Footer | None]

════════════════════════════════════════════════════════════════
```

---

## FASE 4: Data Hookup (Optional)

### 4.1 Detect API Availability

Check the project context scan from FASE 0 for API routes and data models.

- **API routes found** → offer data hookup
- **No API routes found** → skip this phase entirely

```yaml
header: "Data"
question: "Er zijn API routes gevonden. Wil je de pagina koppelen aan echte data?"
options:
  - label: "Ja, koppel data (Recommended)", description: "Service layer + hooks + loading/error states"
  - label: "Nee, later via /frontend-iterate", description: "Houd placeholder data voor nu"
multiSelect: false
```

If "Nee" or no APIs found: skip to completion.

### 4.2 Generate Data Layer

Detect the project's data fetching approach from package.json:

- `@tanstack/react-query` → use React Query hooks
- `swr` → use SWR hooks
- Neither → use plain fetch with useEffect (or Server Components if Next.js App Router)

**Generate:**

1. **Service layer**: `src/services/[entity].ts`

```typescript
const API_BASE = "/api";

export async function getProducts(): Promise<Product[]> {
  const res = await fetch(`${API_BASE}/products`);
  if (!res.ok) throw new Error("Failed to fetch products");
  return res.json();
}
```

2. **Custom hooks**: `src/hooks/use[Entity].ts`

```typescript
import { useQuery } from "@tanstack/react-query";
import { getProducts } from "@/services/products";

export function useProducts() {
  return useQuery({ queryKey: ["products"], queryFn: getProducts });
}
```

3. **Loading states**: Skeleton components matching real component dimensions

4. **Error states**: Inline error display with retry action

### 4.3 Update Page Components

Replace placeholder data in page components with hook calls. Add loading and error states.

### 4.4 Show Data Summary

```
DATA HOOKUP COMPLETE
════════════════════════════════════════════════════════════════

Services created:
  ✓ src/services/products.ts

Hooks created:
  ✓ src/hooks/useProducts.ts

Components updated:
  ✓ FeatureCards.tsx — connected to GET /api/products
  ✓ Added Skeleton loading state
  ✓ Added error state with retry

Pattern: [React Query | SWR | Server Components | Plain fetch]

════════════════════════════════════════════════════════════════
```

---

## Completion

### Update DevInfo

Update `.workspace/session/devinfo.json` with handoff data for downstream skills:

```json
{
  "handoff": {
    "from": "frontend-page",
    "to": "frontend-iterate",
    "data": {
      "pageFile": "[page file path]",
      "components": ["[list of created component files]"],
      "dataConnected": true,
      "framework": "[detected framework]",
      "theme": "[THEME.md path or null]"
    }
  }
}
```

### Completion Report

```
PAGE COMPLETE
═══════════════════════════════════════════════════════════════

Page:        [name]
Framework:   [detected framework]
Fases:       4/4 ✓ (Requirements → Layout → Code → Data)

Files ({N}):
  Page:       [page file path]
  Components: [component paths]
  Services:   [service paths or "—"]
  Hooks:      [hook paths or "—"]

Next steps:
  1. npm run dev → open http://localhost:3000/[page]
  2. /frontend-iterate → visual refinement in browser
  3. /frontend-test → generate component tests
  4. /frontend-a11y → accessibility audit

═══════════════════════════════════════════════════════════════
```

---

## Restrictions

This skill must **NEVER**:

- Generate code without approved layout (skip FASE 2)
- Use "Lorem ipsum" placeholder text — always use contextual, realistic content
- Modify existing pages — only creates new pages (use `/frontend-iterate` for changes)
- Skip the project context scan
- Generate framework-incompatible code

This skill must **ALWAYS**:

- Scan the project via Explore agent before asking requirements
- Formulate user stories and get validation before layout
- Show ASCII layout and get approval before generating code
- Follow `shared/RULES.md` and `shared/PATTERNS.md`
- Detect and match the project's framework, UI library, and patterns
- Update DevInfo for downstream skill handoff
- Show a completion report with next steps
