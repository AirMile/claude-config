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

**Verwante skills:** `/frontend-tokens` · `/frontend-plan` · `/frontend-convert` · `/frontend-inspect` · `/frontend-audit` · `/frontend-wcag`

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

Auto-detect: glob for the page file in framework-standard locations (see 3.1 framework table). If found → existing page flow. If not found → new page flow. No user prompt needed.

**Page found** → proceed to 0.3 (page analysis).
**Page not found** → proceed to 0.2b (theme check), then skip to FASE 1.

### 0.2b Theme Check (always)

Check `.project/project.json` → `theme` section.

- **If theme section populated**: read and store as context for code generation (colors, typography, spacing, cssVars).
- **If theme section empty or project.json missing**: note absence, use Tailwind defaults during code generation.

```
Theme: [Available (project.json#theme) | Not available — using Tailwind defaults]
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

**Visual check (Playwright):**

After the code analysis, take a screenshot of the current page to show the user what it looks like right now.

1. Check Playwright MCP tools available (`browser_navigate`, `browser_take_screenshot`). If unavailable → skip with note: `"Playwright niet beschikbaar — alleen code-analyse uitgevoerd."`, proceed.
2. Start dev server if not running (`npm run dev` or `npx next dev` based on framework) — run in background
3. `browser_navigate` → `http://localhost:3000/[page-name]` (adjust port to project config)
4. `browser_wait_for` → `{ time: 3 }` (allow hydration + client render)
5. `browser_take_screenshot` → capture current state

Show the screenshot alongside the code analysis:

```

CURRENT PAGE: {page-name}
════════════════════════════════════════════════════════════════

[Screenshot of current page state]

Page file: [path to page file]

Components on this page:
{Component} → [Button1], [Button2], {handler}
{Component} → [Link1], [FormField], {handler}

Data layer:
{useHook} → provides {data}
{service} → calls {endpoint}

════════════════════════════════════════════════════════════════

```

This gives the user visual + structural context before deciding what to change. Proceed to FASE 0.5 (intent).

---

## FASE 0.5: Intent (existing pages only)

**Condition:** Only execute this phase if the user indicated the page already exists (0.2 → "Ja"). If the page is new, this phase is skipped entirely.

The page analysis and screenshot from 0.3 are already visible to the user. Ask what they want to do in a single prompt:

```yaml
header: "Wijziging"
question: "Wat wil je aanpassen aan deze pagina?"
options:
  - label: "Functionaliteit toevoegen (Recommended)", description: "Beschrijf wat erbij moet"
  - label: "Onderdelen vervangen", description: "Selecteer wat vervangen moet worden"
  - label: "Herschikken/aanpassen", description: "Layout of styling wijzigen"
  - label: "Opnieuw opbouwen", description: "Pagina from scratch"
multiSelect: false
```

**Handle each intent:**

**If "Functionaliteit toevoegen"**: All existing components are kept. User describes what to add via "Other" text input. Store: kept = all existing, added = user description.

**If "Onderdelen vervangen"**: Ask which components to replace (multi-select):

```yaml
header: "Vervangen"
question: "Welke onderdelen wil je vervangen?"
options:
  - label: "{Component1}", description: "[Button1], [Button2], {handler}"
  - label: "{Component2}", description: "[Link1], [FormField], {handler}"
multiSelect: true
```

Then ask what should replace them. Store: kept = unselected, replaced = selected + replacement description.

**If "Herschikken/aanpassen"**: All existing components are kept. User describes changes via "Other" text input. Store: kept = all existing, changes = user description.

**If "Opnieuw opbouwen"**: Proceed to FASE 1 with empty inventory (from scratch).

**No separate confirmation prompt** — the inventory (kept/added/replaced) is shown at the CHECKPOINT together with the layout proposal. User validates everything in one place.

---

## FASE 1: Requirements (User Stories)

### 1.0 Design Check (new pages only)

**Skip entirely if page already exists** (FASE 0.5 was executed) — the page analysis from 0.3 provides better context than design spec data.

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

### 1.1 Gather Purpose (new pages only)

Skip this step if the page already exists (FASE 0.5 was executed). If not already provided via argument, ask:

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

### 1.2 Clarifying Questions (new pages only)

Skip this step if the page already exists (FASE 0.5 was executed). Ask 2-3 targeted follow-up questions based on the description + project context. These vary by page type. Examples:

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

### 1.4 Validate Requirements (new pages only)

**Skip for existing pages** — user validates stories + layout together at the CHECKPOINT.

```yaml
header: "Requirements"
question: "Kloppen deze user stories en secties?"
options:
  - label: "Ja, ga door (Recommended)", description: "Door naar pagina voorstel met layout"
  - label: "Aanpassen", description: "Ik wil iets wijzigen of toevoegen"
  - label: "Opnieuw", description: "Start requirements opnieuw"
multiSelect: false
```

If "Aanpassen": ask what to change, update stories, re-validate.

---

## CHECKPOINT: Page Proposal (Requirements + Layout)

Na story generatie, genereer meteen een **draft ASCII layout** en presenteer alles samen. De user ziet stories + layout + inventory (als bestaande pagina) in één voorstel.

**Layout sizing rules** — use proportional row heights in ASCII art to reflect actual visual weight:

| Section type    | Rows | Typical height |
| --------------- | ---- | -------------- |
| Nav/Header      | 1-2  | 48-64px        |
| Hero/Banner     | 4-6  | 400-600px      |
| Content section | 3-5  | 200-400px      |
| Cards grid      | 3-4  | 250-350px      |
| Footer          | 1-2  | 48-80px        |

Annotate each section with estimated height (right-aligned). If a Playwright screenshot of the existing page is available (from 0.3), use its visual proportions as reference for sizing.

```
PAGINA VOORSTEL: {naam}
═══════════════════════════════════════════════════════════════

| Aspect       | Waarde                                  |
| ------------ | --------------------------------------- |
| Pagina       | {naam}                                  |
| Doel         | {beschrijving}                          |
| User stories | {N} stories                             |
| Secties      | {lijst met NEW/EXISTING markering}      |
| Hergebruik   | {bestaande componenten/hooks}           |
| Theme        | {theme beschikbaar / Tailwind defaults} |

LAYOUT VOORSTEL:
┌─────────────────────────────────────┐
│ NAV                            64px │
├─────────────────────────────────────┤
│                                     │
│           HERO                      │
│     headline + subtext              │
│     [GET STARTED]                   │
│                              ~480px │
├──────────┬──────────┬───────────────┤
│ CARD 1   │ CARD 2   │ CARD 3        │
│ icon     │ icon     │ icon          │
│ text     │ text     │ text          │
│                              ~320px │
├──────────┴──────────┴───────────────┤
│ FOOTER                         48px │
└─────────────────────────────────────┘

Sections → Stories:
1. Nav        → navigation, branding
2. Hero       → story #1 (headline + CTA)
3. Cards (3x) → story #2 (feature highlights)
4. Footer     → navigation, legal

═══════════════════════════════════════════════════════════════
```

```yaml
header: "Pagina Voorstel"
question: "Hoe wil je verder met dit voorstel?"
options:
  - label: "Goedkeuren (Recommended)", description: "Ga door naar code generatie"
  - label: "Goedkeuren + data koppelen", description: "Genereer code én koppel aan API routes"
  - label: "Layout aanpassen", description: "Beschrijf wat er anders moet aan de layout"
  - label: "Requirements aanpassen", description: "Ik wil user stories wijzigen"
multiSelect: false
```

**If "Goedkeuren":** proceed to FASE 2.5 (finalize) → FASE 3. Skip FASE 4.
**If "Goedkeuren + data koppelen":** proceed to FASE 2.5 → FASE 3 → FASE 4 (data hookup).
**If "Layout aanpassen":** user describes changes, regenerate layout, re-present.
**If "Requirements aanpassen":** return to 1.3 to modify stories.
**If user selects "Other":** supports "3 layout alternatieven" (→ FASE 2.3) and "Inzoomen" (→ FASE 2.4).

---

## FASE 2: Layout Refinement

Steps 2.1-2.2 are handled by the CHECKPOINT above. This phase only executes when the user requests changes, alternatives, or zoom from the CHECKPOINT.

### 2.3 Alternatives (if requested)

Generate 3 structurally different layouts. Apply the same **proportional sizing rules** from the CHECKPOINT (row heights, px annotations).

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

After zoom, return to CHECKPOINT for review.

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

- Follow `shared/RULES.md`: React/Next.js Rules, HTML/CSS Rules, Accessibility Rules (A-series)
- Follow `shared/PATTERNS.md`: Component Patterns, Layout Patterns
- Use `cn()` for className composition — create `src/lib/utils.ts` if not present
- TypeScript strict mode with proper interfaces
- Semantic HTML with aria-labels and keyboard support
- If project.json#theme populated, integrate design tokens into Tailwind config extension
- Import and compose existing components — never regenerate what already works
- Contextual placeholder text (not "Lorem ipsum") when no real data available

**Generate these files:**

1. **Page file** — main page component that imports existing components + new section components
2. **New section components** — only for sections not covered by existing components
3. **Tailwind config extension** — if theme tokens need to be added (only if not already present)
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

Theme: [Integrated from project.json#theme | Tailwind defaults used]

════════════════════════════════════════════════════════════════
```

### 3.5 Functionality Gap Assessment

Identify gaps **before and during** code generation — don't generate placeholder code and then scan for it.

**During generation (3.2), for each interactive element:**

```
CAN I implement this fully?
  YES (API exists, data available, logic is self-contained)
    → Generate working implementation
  NO (needs backend, external service, or complex logic beyond this skill's scope)
    → Generate the UI element with a clear `// GAP: {reason}` comment
    → Track in gaps list for reporting
```

**Rules:**

- NEVER generate empty handlers (`onClick={() => {}}`) or `href="#"` links
- If a button/form needs backend logic: generate the UI + a typed stub function with `// GAP:` comment explaining what's needed
- If data is unavailable: use realistic typed mock data with `// GAP: replace with real data from {source}`

**Code quality (apply during generation, not as post-scan):**

- Use theme tokens, not hardcoded colors (H101)
- Use Tailwind scale, not arbitrary values (R103)
- Use semantic HTML: `<button>` not `<div onClick>` (R001)
- Always include `alt` on images (R002) and `label` on inputs (R004)
- Type all functions and parameters (T002)

**After generation, collect gaps and report:**

```
FUNCTIONALITY GAPS ({N})

Components with incomplete functionality:
  - {Component}: [Button "{label}"] → GAP: needs {API/service/logic}
  - {Component}: <form> → GAP: needs {endpoint} for submission

All generated code compiles and renders — gaps are clearly marked
for follow-up via /dev-define.
```

**Backlog sync (if `.project/backlog.html` exists):**

- Parse JSON from `<script id="backlog-data">` block
- Cross-reference each gap with `data.features`
- Match found? Note: "Feature exists in backlog: {name} ({status})"
- No match? Add to `data.features`:
  `{ "name": "{feature-naam}", "type": "PAGE-GAP", "status": "TODO", "phase": "P4", "description": "{beschrijving}", "dependency": null, "source": "/frontend-compose {page} — {Component} [{element}]" }`
- Set `data.updated` to today, write back via Edit

If no backlog exists: report gaps in completion report only.

### 3.6 Layout Verification

Verify the generated page layout matches the approved ASCII layout from FASE 2. See `../shared/PLAYWRIGHT.md` for tool details and error recovery. See `../shared/VERIFICATION.md` for the generic verification loop pattern.

**Pre-flight:** Check Playwright MCP tools available (`browser_navigate`, `browser_take_screenshot`, `browser_close`). If unavailable → skip with message: `"Playwright niet beschikbaar — open de pagina handmatig om te verifiëren."`, proceed to FASE 4.

**Sequence:**

1. Reuse dev server if already running from FASE 0.3. If not running, start it (`npm run dev` or `npx next dev` based on framework detected in 3.1) — run in background
2. `browser_navigate` → `http://localhost:3000/[page-name]` (adjust port to project config)
3. `browser_wait_for` → `{ time: 3 }` (allow hydration + client render)
4. `browser_take_screenshot` → capture the rendered page

**Analyze screenshot against the approved ASCII layout (including px annotations):**

- Page renders without blank screen or error overlay
- All sections from the ASCII layout are present
- Sections appear in the correct order
- **Section proportions match** — compare visual height ratios against the px annotations from the approved layout (e.g., hero ~480px should be visually dominant over nav ~64px, not similar height)
- Grid structure matches (columns, rows, sidebar placement)
- Responsive basis is intact (no horizontal overflow, no collapsed grids)
- Missing images are OK with placeholder data

**If layout issues detected:** Auto-fix structural problems (wrong grid, missing sections, incorrect order) and re-screenshot. Repeat until clean or max 3 attempts.

**Report:**

```
LAYOUT CHECK
════════════════════════════════════════════════════════════════

URL:     http://localhost:3000/[page-name]
Status:  [✓ Layout matches | ⚠ Issues fixed]

Sections verified:
  ✓ [Section 1] — matches ASCII layout
  ✓ [Section 2] — matches ASCII layout
  ...

[If issues were fixed:]
Fixed:
  - [description of fix]

════════════════════════════════════════════════════════════════
```

**User approval:**

```yaml
header: "Layout Check"
question: "De pagina is gegenereerd. Klopt de layout structuur?"
options:
  - label: "Ja, layout klopt (Recommended)", description: "Ga door naar UI verbetering"
  - label: "Aanpassen", description: "Beschrijf wat er anders moet aan de layout"
multiSelect: false
```

**If "Aanpassen":** User describes what needs to change. Apply layout fixes, take new screenshot, and ask again. Max 3 rounds — after that, proceed to FASE 4 (if data hookup selected at CHECKPOINT) or Completion.

---

## FASE 4: Data Hookup (Optional)

**Only executed when user chose "Goedkeuren + data koppelen" at CHECKPOINT.** Otherwise skip to Completion.

### 4.1 Detect API Availability

Check `package.json` and glob for API route files to detect available endpoints.

- **API routes found** → proceed with data hookup
- **No API routes found** → skip to completion with note: "Geen API routes gevonden — data hookup overgeslagen."

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

### Backlog Sync

Combinatie van de voormalige 0.4 (start) en 3.4 (built) stappen — doe alles in één keer bij completion.

1. Read `.project/backlog.html` (if exists) → parse JSON from `<script id="backlog-data" type="application/json">...</script>`
2. Find feature matching page name: `data.features.find(f => f.name === "{kebab-case-page-name}")`
   - **Found + status TODO**: set `status: "DOING"`, `stage: "built"`, `date: today`
   - **Found + status DOING**: set `stage: "built"`
   - **Not found**: add to `data.features[]`: `{ "name": "{name}", "type": "PAGE", "status": "DOING", "stage": "built", "phase": "P4", "description": "{purpose}", "dependency": null }`
3. Set `data.updated` to today. Write back via Edit (keep `<script>` tags intact)

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
    "to": null,
    "data": {
      "pageFile": "[page file path]",
      "components": ["[list of created component files]"],
      "dataConnected": true,
      "framework": "[detected framework]",
      "theme": "[.project/project.json#theme or null]"
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
  2. /frontend-tokens → design tokens aanpassen/toepassen
  3. /frontend-audit → performance/SEO audit
  4. /frontend-wcag → accessibility audit
  [Als gaps die dev-werk nodig hebben:]
  6. /dev-define {feature} → definieer ontbrekende functionaliteit
  [Als layout/UX complex is:]
  7. /thinking-brainstorm page:{page-name} → brainstorm over UX/layout

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
- Follow `shared/RULES.md` (React/Next.js, HTML/CSS, A-series) and `shared/PATTERNS.md` (Component, Layout)
- Detect and match the project's framework, UI library, and patterns
- Update DevInfo for downstream skill handoff
- Show a completion report with next steps
