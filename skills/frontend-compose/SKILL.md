---
name: frontend-compose
description: >-
  Compose a view from existing building blocks and new components. Inventories
  built features, selects what belongs on the view, then generates user stories,
  ASCII layout, and code. Reuses existing components from the dev pipeline.
  Use with /frontend-compose or /frontend-compose [page-name].
argument-hint: "[page-name]"
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.1.0
  category: frontend
---

# Compose

Compose a view by inventorying existing building blocks (components, hooks, services from the dev pipeline) and combining them with new functionality. Selects what belongs on this view, formulates user stories, designs the layout as ASCII art, generates code that reuses existing components, and optionally hooks up real data.

**Pipeline:** `/frontend-theme` (optional) → `/frontend-compose` → `/frontend-iterate` → quality skills

## References

- `../shared/RULES.md` — React/TypeScript coding rules
- `../shared/PATTERNS.md` — Component patterns (compound, render props, etc.)
- `../shared/DESIGN.md` — Anti-patterns, color, typography, motion, UX writing
- `../shared/DEVINFO.md` — Session tracking, cross-skill handoff
- `../shared/BACKLOG.md` — Backlog HTML+JSON format, read/write protocol

---

## FASE 0: Pre-flight

### 0.1 Argument Check

- **Argument provided** (`/frontend-compose dashboard`): use as page name, proceed to 0.2.
- **No argument** (`/frontend-compose`):

Check `.project/project.json` → `design.pages` for pages with status `DEF` or `IDEA`.

**If defined pages found:**

```yaml
header: "Pagina"
question: "Welke pagina wil je bouwen?"
options:
  # Dynamisch gegenereerd uit design.pages waar status = DEF of IDEA
  - label: "{page.name}", description: "{page.purpose} — {page.sections.length} secties"
  # Max 4 pagina's, rest via "Other"
multiSelect: false
# User can choose "Other" for a page not in the design spec
```

**If no design pages found (or no project.json):**

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

### 0.2 Bestaat deze pagina al?

```yaml
header: "Pagina Status"
question: "Bestaat de {page-name} pagina al in het project?"
options:
  - label: "Ja, pagina bestaat", description: "Ik wil de bestaande pagina aanpassen"
  - label: "Nee, nieuwe pagina (Recommended)", description: "Pagina moet nog gemaakt worden"
multiSelect: false
```

**If "Ja"** → proceed to 0.3 (page analysis).
**If "Nee"** → proceed to 0.3b (theme check), then skip to FASE 1.

### 0.2b Theme Check (always)

Check if `.project/config/THEME.md` exists (output from `/frontend-theme`).

- **If found**: read and store as context for code generation (colors, typography, spacing, breakpoints).
- **If not found**: note absence, use Tailwind defaults during code generation.

```
Theme: [Available (THEME.md) | Not available — using Tailwind defaults]
```

### 0.3 Page Analysis (only if page exists)

Spawn an Explore agent (`subagent_type="Explore"`, thoroughness: "very thorough") to analyze the existing page. This keeps recursive import tracing out of the main context — important because the skill continues with wireframing and building after this.

Agent prompt:

```
Analyze the existing page "{page-name}" in this project.

1. Find the page file: Glob for the page name in:
   - app/**/page.{tsx,jsx} (Next.js App Router)
   - src/pages/**/*.{tsx,jsx} (Vite/Next Pages)
   - src/routes/**/*.{tsx,jsx} (Remix)
   - src/pages/**/*.astro (Astro)

2. Trace all imports from the page file recursively:
   - For each imported component: scan for onClick/onSubmit handlers,
     buttons, links, form elements, interactive elements.
     Report: component name + user-facing actions
     (e.g., "ProductCard: [Add to cart] button, [View details] link").
   - For each imported hook: report what data/state it provides.
   - For each imported service: report which API endpoints it calls.

3. Report the full picture of what this page currently does.

Return a structured summary. Focus ONLY on this page and its imports.

```

Show the results:

```

CURRENT PAGE: {page-name}
════════════════════════════════════════════════════════════════

Page file: [path to page file]

Components on this page:
{Component} → [Button1], [Button2], {handler}
{Component} → [Link1], [FormField], {handler}

Data layer:
{useHook} → provides {data}
{service} → calls {endpoint}

════════════════════════════════════════════════════════════════

```

Proceed to FASE 0.5 (page inventory).

### 0.4 Backlog Stage

Read `.project/backlog.html` (if exists) → parse JSON from `<script id="backlog-data" type="application/json">...</script>`.

Find feature matching the page name: `data.features.find(f => f.name === "{kebab-case-page-name}")`.

- **Found + status TODO**: set `status: "DOING"`, `stage: "building"`, `date: "{YYYY-MM-DD}"`. Write back via Edit.
- **Found + status DOING**: set `stage: "building"`. Write back via Edit.
- **Not found**: add to `data.features[]`: `{ "name": "{name}", "type": "PAGE", "status": "DOING", "stage": "building", "phase": "P4", "description": "{purpose}", "dependency": null }`. Write back.

Set `data.updated` to today. Keep `<script>` tags intact.

---

## FASE 0.5: Current Page Inventory

**Condition:** Only execute this phase if the user indicated the page already exists (0.2 → "Ja"). If the page is new, this phase is skipped entirely.

### 0.5.1 Present Current Page Contents

Show what's currently on the page, based on the page analysis from 0.3:

```

CURRENT PAGE: {page-name}
════════════════════════════════════════════════════════════════

Components on this page:
{Component} → [Button1], [Button2], {handler}
{Component} → [Link1], [FormField], {handler}

Data layer:
{useHook} → provides {data}
{service} → calls {endpoint}

════════════════════════════════════════════════════════════════

```

### 0.5.2 Check What to Keep

Present the current components as a multi-select checklist. Everything is pre-selected (kept by default).

```yaml
header: "Behouden"
question: "Welke onderdelen wil je behouden op deze pagina? (deselecteer wat weg mag)"
options:
  - label: "{Component1}", description: "[Button1], [Button2], {handler}"
  - label: "{Component2}", description: "[Link1], [FormField], {handler}"
  - label: "{useHook}", description: "provides {data}"
multiSelect: true
# All options pre-selected. User deselects what should be removed.
```

### 0.5.3 Ask What to Add

```yaml
header: "Toevoegen"
question: "Wat wil je toevoegen aan deze pagina?"
options:
  - label: "Ik beschrijf het (Recommended)", description: "Beschrijf welke functionaliteit erbij moet"
  - label: "Niks toevoegen", description: "Alleen de geselecteerde onderdelen herschikken/aanpassen"
  - label: "Opnieuw opbouwen", description: "Alles weggooien, pagina from scratch"
multiSelect: false
```

**If "Ik beschrijf het"**: user describes what to add, proceed to 0.5.4.

**If "Niks toevoegen"**: proceed to FASE 1 with only the kept components (useful for removing/reorganizing).

**If "Opnieuw opbouwen"**: proceed to FASE 1 with empty inventory (from scratch).

### 0.5.4 Confirm Changes

```
PAGINA PLAN: {page-name}
════════════════════════════════════════════════════════════════

Blijft:
  ✓ {Component}    → [Button1], [Button2]
  ✓ {useHook}      → provides {data}

Verwijderen:
  ✗ {Component}    → was: [OldButton], {handler}

Toevoegen:
  + {description}  → {expected actions}
  + {description}  → {expected actions}

════════════════════════════════════════════════════════════════
```

```yaml
header: "Plan"
question: "Klopt dit overzicht?"
options:
  - label: "Ja, ga door (Recommended)", description: "Start met user stories"
  - label: "Aanpassen", description: "Ik wil het plan wijzigen"
multiSelect: false
```

If "Aanpassen": ask what to change, update plan, re-confirm.

---

## FASE 1: Requirements (User Stories)

### 1.0 Design Check

Check `.project/project.json` → `design.pages` for the requested page name.

**If design data exists AND requested page is defined there:**

Show the existing design spec:

```
DESIGN DATA BESCHIKBAAR
════════════════════════════════════════════════════════════════
Page:     {design.pages[name].name}
Purpose:  {design.pages[name].purpose}
Sections: {design.pages[name].sections joined}
Flows:    {design.pages[name].flows joined}
Status:   {design.pages[name].status}
════════════════════════════════════════════════════════════════
```

```yaml
header: "Design Spec"
question: "Er is al een design spec voor deze pagina. Wil je die als basis gebruiken?"
options:
  - label: "Ja, gebruik design spec (Recommended)", description: "Pre-fill requirements uit design data"
  - label: "Nee, opnieuw definiëren", description: "Negeer design spec, begin from scratch"
multiSelect: false
```

**If "Ja":** Pre-fill user stories from `design.pages[name].purpose` + `sections` + `flows`. Jump to 1.3 (Formulate User Stories) with pre-generated stories based on design data. User ALWAYS verifies and can adjust — never skip verification.

**If "Nee":** Proceed as normal (1.1 and further).

**If design data does not exist or page not defined:** Proceed as normal.

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

Based on answers + project context + page inventory (from FASE 0.5), formulate user stories.

**If inventory exists** (FASE 0.5 was executed):

- Stories for existing components focus on **placement and composition** (not re-defining functionality)
- Stories for new parts define full functionality as usual
- The REUSABLE section is pre-filled from the confirmed inventory

**If no inventory** (FASE 0.5 was skipped):

- All stories define full functionality (current behavior)

```
USER STORIES
════════════════════════════════════════════════════════════════

Page: [name]

[If inventory exists:]
Existing (placement):
1. Als [role] wil ik [existing component] zien op deze pagina zodat [result]
2. Als [role] wil ik [existing component] kunnen gebruiken om [action]

New (to build):
3. Als [role] wil ik [new action] zodat [result]
4. Als [role] wil ik [new action] zodat [result]

[If no inventory:]
1. Als [role] wil ik [action] zodat [result]
2. Als [role] wil ik [action] zodat [result]
...

SECTIONS (derived from stories):
- [Section 1]: [what it contains] [EXISTING | NEW]
- [Section 2]: [what it contains] [EXISTING | NEW]
- [Section 3]: [what it contains] [NEW]

REUSABLE (from inventory / project scan):
- [existing component] → reuse for [section]
- [existing hook] → provides data for [section]
- [API endpoint] → already available for [section]

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

## CHECKPOINT: Page Requirements Samenvatting

Na requirements validatie, presenteer een compleet overzicht:

| Aspect       | Waarde                                     |
| ------------ | ------------------------------------------ |
| Pagina       | {naam}                                     |
| Doel         | {beschrijving}                             |
| User stories | {N} stories                                |
| Secties      | {lijst met NEW/EXISTING markering}         |
| Hergebruik   | {bestaande componenten/hooks}              |
| Theme        | {THEME.md beschikbaar / Tailwind defaults} |

Vraag via AskUserQuestion: "Klopt dit overzicht voordat we doorgaan naar layout?"

- "Ga door (Recommended)" — door naar ASCII layout
- "Aanpassen" — terug naar relevante vraag

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

Detect the framework from `package.json` and existing page file patterns:

| Framework          | Page file                | Component dir            |
| ------------------ | ------------------------ | ------------------------ |
| Next.js App Router | `app/[page]/page.tsx`    | `src/components/[page]/` |
| Next.js Pages      | `src/pages/[page].tsx`   | `src/components/[page]/` |
| Vite + React       | `src/pages/[page].tsx`   | `src/components/[page]/` |
| Remix              | `app/routes/[page].tsx`  | `app/components/[page]/` |
| Astro              | `src/pages/[page].astro` | `src/components/[page]/` |

### 3.2 Generate Complete Page

Generate the page based on the approved layout, requirements, and page inventory.

**For each section in the approved layout, determine the generation strategy:**

```
IF section maps to existing component from page inventory:
  → Import the existing component
  → Pass page-specific props if needed
  → DO NOT regenerate the component

IF section is new (not in inventory):
  → Generate new section component (standard behavior)
```

**Rules:**

- Follow `shared/RULES.md` for React/TypeScript coding standards
- Follow `shared/PATTERNS.md` for component patterns
- Use `cn()` for className composition — create `src/lib/utils.ts` if not present
- TypeScript strict mode with proper interfaces
- Semantic HTML with aria-labels and keyboard support
- If THEME.md exists, integrate design tokens into Tailwind config extension
- Import and compose existing components — never regenerate what already works
- Contextual placeholder text (not "Lorem ipsum") when no real data available

**Generate these files:**

1. **Page file** — main page component that imports existing components + new section components
2. **New section components** — only for sections not covered by existing components
3. **Tailwind config extension** — if THEME.md tokens need to be added (only if not already present)
4. **cn() utility** — `src/lib/utils.ts` if not present

**Code patterns:**

```typescript
// Page file example (Next.js App Router)
// Existing components imported from their original location
import { ProductCard } from '@/components/ProductCard';
import { useProducts } from '@/hooks/useProducts';
// New sections generated for this page
import { HeroSection } from '@/components/[page]/HeroSection';
import { CheckoutForm } from '@/components/[page]/CheckoutForm';

export default function [Page]Page() {
  return (
    <main className="min-h-screen">
      <HeroSection />
      {/* Existing component, composed into page layout */}
      <section className="grid grid-cols-3 gap-6 px-6 py-12">
        {products.map(p => <ProductCard key={p.id} product={p} />)}
      </section>
      {/* New component, generated for this page */}
      <CheckoutForm />
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
  ✓ app/dashboard/page.tsx                    (page)
  ✓ src/components/dashboard/HeroSection.tsx  (new)
  ✓ src/components/dashboard/CheckoutForm.tsx (new)

Existing components imported:
  ✓ src/components/ProductCard.tsx            (reused)
  ✓ src/hooks/useProducts.ts                 (reused)

Theme: [Integrated from THEME.md | Tailwind defaults used]

════════════════════════════════════════════════════════════════
```

### 3.4 Backlog Completion Sync

1. Read `.project/backlog.html` → parse JSON
2. Find feature matching page name → set `stage: "built"`, `data.updated` to today
3. Write back via Edit (keep `<script>` tags intact)
4. Sync to `project.json` `features[]` array: merge feature with `status: "DOING"`, `stage: "built"`

### 3.5 Functionality Gap Detection

Na code generatie, scan alle aangemaakte/gewijzigde component-bestanden:

1. **Scan voor placeholders:**
   - Lege click handlers: `onClick={() => {}}`, `onClick={handleX}` waar handleX niets doet
   - TODO comments: `// TODO`, `// FIXME`, `{/* TODO */}`
   - Placeholder functies: functies die alleen `console.log` doen of leeg zijn
   - Forms zonder submit handler of met placeholder submit
   - Links met `href="#"` of `href="javascript:void(0)"`

2. **Als gaps gevonden, rapporteer in completion:**

   ```
   FUNCTIONALITY GAPS

   Componenten met ontbrekende functionaliteit:
   - {Component}: [Button "{label}"] → geen handler
   - {Component}: <form> → placeholder submit
   ```

3. **Als `.project/backlog.html` bestaat** (zie `shared/BACKLOG.md`):
   - Parse JSON uit `<script id="backlog-data">` blok
   - Cross-reference gap met `data.features`
   - Match? Noteer: "Feature bestaat in backlog: {name} ({status})"
   - Geen match? Voeg toe aan `data.features`:
     `{ "name": "{feature-naam}", "type": "PAGE-GAP", "status": "TODO", "phase": "P4", "description": "{beschrijving}", "dependency": null, "source": "/frontend-compose {page} — {Component} [{element}]" }`
   - Zet `data.updated` naar huidige datum, schrijf JSON terug via Edit tool

4. **Als `.project/backlog.html` NIET bestaat:**
   - Rapporteer gaps alleen in completion report (geen backlog om aan toe te voegen)

Gaps verschijnen altijd in het completion report. Toevoegen aan backlog is automatisch maar non-blocking.

### 3.6 Visual Verification

Verify the generated page renders correctly in the browser. See `../shared/PLAYWRIGHT.md` for tool details and error recovery.

**Pre-flight:** Check Playwright MCP tools available (`browser_navigate`, `browser_take_screenshot`, `browser_close`). If unavailable → skip with message: `"Playwright niet beschikbaar — open de pagina handmatig om te verifiëren."`, proceed to FASE 4.

**Sequence:**

1. Start dev server if not running (`npm run dev` or `npx next dev` based on framework detected in 3.1) — run in background
2. `browser_navigate` → `http://localhost:3000/[page-name]` (adjust port to project config)
3. `browser_wait_for` → `{ time: 3 }` (allow hydration + client render)
4. `browser_take_screenshot` → visually verify the page
5. `browser_close`

**Analyze screenshot for:**

- Page renders without blank screen or error overlay
- Layout matches the approved ASCII layout from FASE 2
- Sections are visible and in the correct order
- No obvious broken styling (missing images are OK with placeholder data)

**Report:**

```
VISUAL CHECK
════════════════════════════════════════════════════════════════

URL:     http://localhost:3000/[page-name]
Status:  [✓ Renders correctly | ⚠ Issues detected]

[If issues detected:]
Issues:
  - [description of visual problem]
  - [description of visual problem]

[Auto-fix issues (missing imports, typos, wrong classes, layout problems)
 and re-check. Repeat until clean or max 3 attempts.
 Only escalate to user if the fix is unclear or subjective.]

════════════════════════════════════════════════════════════════
```

---

## FASE 4: Data Hookup (Optional)

### 4.1 Detect API Availability

Check `package.json` and glob for API route files to detect available endpoints.

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

### Dashboard Sync

**Goal:** Sync geïnstalleerde packages naar project.json.

Zie `shared/DASHBOARD.md` voor schema en merge-strategieën.

1. Read `.project/project.json` (skip als niet bestaat)
2. Als packages geïnstalleerd tijdens code generatie (FASE 3) of data hookup (FASE 4):
   - Merge naar `stack.packages` (voeg toe als niet aanwezig, update versie als nieuwer)
3. Write `.project/project.json`

### Design Sync

Update `.project/project.json` → `design.pages` to reflect the built page:

1. Read `project.json` → `design` section (skip if design section doesn't exist)
2. Find page by name in `design.pages`:
   - **Exists:** Update `status` to `"BLT"`, merge new sections discovered during build into `sections` array
   - **Does not exist:** Add new page entry with `name`, `purpose` (from FASE 1), `sections` (from generated components), `status: "BLT"`, empty `flows` and `notes`
3. Write `project.json` (only mutate `design` section)

### Update DevInfo

Update `.project/session/devinfo.json` with handoff data for downstream skills:

```json
{
  "handoff": {
    "from": "frontend-compose",
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

[Als functionality gaps gedetecteerd:]
Gaps ({N}):
  - [Component]: [gap] → /dev-define {feature-naam}
  - [Component]: [gap] → backlog: {feature-naam} ({status})

Next steps:
  1. npm run dev → open http://localhost:3000/[page]
  2. /frontend-iterate → visual refinement in browser
  3. /frontend-wcag → accessibility audit
  [Als gaps die dev-werk nodig hebben:]
  4. /dev-define {feature} → definieer ontbrekende functionaliteit
  [Als layout/UX complex is:]
  5. /thinking-brainstorm page:{page-name} → brainstorm over UX/layout

═══════════════════════════════════════════════════════════════
```

---

## Restrictions

This skill must **NEVER**:

- Generate code without approved layout (skip FASE 2)
- Use "Lorem ipsum" placeholder text — always use contextual, realistic content
- Regenerate components that already exist in the codebase — import and compose them instead
- Skip the project context scan
- Generate framework-incompatible code

This skill must **ALWAYS**:

- Analyze existing page via Explore agent when modifying an existing page
- Formulate user stories and get validation before layout
- Show ASCII layout and get approval before generating code
- Follow `shared/RULES.md` and `shared/PATTERNS.md`
- Detect and match the project's framework, UI library, and patterns
- Update DevInfo for downstream skill handoff
- Show a completion report with next steps
