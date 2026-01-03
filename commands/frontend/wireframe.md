---
description: Generate low-fidelity HTML wireframes using parallel design agents with visual reflection
---

# Wireframe

Generate multiple low-fidelity wireframe sketches using 3 parallel design agents, each with a unique philosophy. Agents visually review their own work via screenshots and iterate to create improved versions.

## When to Use

- Planning page layouts before coding
- Exploring different layout options
- Before starting `/style` workflow
- Need diverse design perspectives

## Process Overview

```
FASE 1: Requirements & Research
    ↓
FASE 2: Round 1 - 3 agents create v1 wireframes (parallel)
    ↓
FASE 3: Visual Reflection (sequential thinking)
    ↓
FASE 4: Round 2 - 3 agents create v2 wireframes (parallel)
    ↓
FASE 5: Open first wireframe + Ask for selection
```

## Resources

This skill includes pre-researched reference files for fast execution:

| File | Description |
|------|-------------|
| `references/html-template.html` | **MUST USE** for consistent navigation across all wireframes |
| `references/mobile-patterns.md` | Touch targets, navigation, layouts, forms for mobile |
| `references/desktop-patterns.md` | Navigation, grids, interactions, data display for desktop |
| `references/page-types.md` | Structures for landing, dashboard, form, list, detail, settings |
| `references/game-ui-patterns.md` | Main menu, pause, options, HUD, inventory, combat, dialogue |

## FASE 1: Requirements & Reference Lookup

### Step 1.1: Gather Requirements (Sequential Modals)

Use 3 sequential AskUserQuestion modals to gather requirements:

**Modal 1: Paginatype**

```
Use AskUserQuestion tool:
- header: "Paginatype"
- question: "Welk type pagina wil je ontwerpen?"
- options:
  1. label: "Landing (Aanbevolen)", description: "Homepage of marketing pagina met hero en CTA"
  2. label: "Dashboard", description: "Overzichtspagina met statistieken en widgets"
  3. label: "Formulier", description: "Data invoer pagina met validatie"
  4. label: "Lijst", description: "Overzicht van items met filtering en sortering"
  5. label: "Detail", description: "Detailweergave van een enkel item"
  6. label: "Instellingen", description: "Configuratie en voorkeuren pagina"
  7. label: "Game Menu", description: "Hoofdmenu, pauze, of opties scherm"
  8. label: "Game HUD", description: "In-game overlay met stats en controls"
  9. label: "Vraag uitleggen", description: "Leg uit wat elk paginatype betekent"
- multiSelect: false
```

**Modal 2: Platform**

```
Use AskUserQuestion tool:
- header: "Platform"
- question: "Voor welk platform ontwerp je?"
- options:
  1. label: "Beide (Aanbevolen)", description: "Responsive design voor mobile en desktop"
  2. label: "Mobile first", description: "Primair mobile, desktop secondary"
  3. label: "Desktop first", description: "Primair desktop, mobile secondary"
  4. label: "Alleen mobile", description: "Uitsluitend mobiele apparaten"
  5. label: "Alleen desktop", description: "Uitsluitend desktop browsers"
  6. label: "Vraag uitleggen", description: "Leg platformkeuzes uit"
- multiSelect: false
```

**Modal 3: Componenten (MultiSelect)**

```
Use AskUserQuestion tool:
- header: "Componenten"
- question: "Welke componenten zijn nodig?"
- options:
  1. label: "Header", description: "Top navigatiebalk met logo en menu"
  2. label: "Nav", description: "Navigatiemenu (horizontaal of verticaal)"
  3. label: "Hero", description: "Hero sectie met titel, subtitel en CTA"
  4. label: "Cards", description: "Content cards in grid layout"
  5. label: "Footer", description: "Footer met links en copyright"
  6. label: "Sidebar", description: "Zijnavigatie of filteropties"
  7. label: "Form", description: "Invoerformulier met velden"
  8. label: "Table", description: "Datatabel met rijen en kolommen"
  9. label: "Modal", description: "Pop-up dialoog venster"
  10. label: "Tabs", description: "Tab navigatie voor content switching"
  11. label: "Vraag uitleggen", description: "Leg componentopties uit"
- multiSelect: true
```

**Optional follow-up:**

```
Use AskUserQuestion tool:
- header: "Extra Wensen"
- question: "Zijn er specifieke constraints of voorkeuren?"
- options:
  1. label: "Nee, ga door (Aanbevolen)", description: "Geen extra constraints"
  2. label: "Accessibility focus", description: "Extra aandacht voor toegankelijkheid"
  3. label: "Performance focus", description: "Minimale elementen voor snelheid"
  4. label: "Branding consistent", description: "Moet passen bij bestaande huisstijl"
  5. label: "Vraag uitleggen", description: "Leg constraint opties uit"
- multiSelect: true
```

### Step 1.2: Atomic Design Classification

Determine the atomic level of the wireframe using AskUserQuestion:

```
Use AskUserQuestion tool:
- header: "Design Niveau"
- question: "Welk atomic design niveau maken we?"
- options:
  1. label: "Atom", description: "Enkele UI primitief (button, input, badge, icon)"
  2. label: "Molecule", description: "Kleine componentgroep (zoekbalk, formulierveld, nav item)"
  3. label: "Organism (Aanbevolen)", description: "Complexe sectie (header, card grid, sidebar)"
  4. label: "Template", description: "Pagina layout zonder content"
  5. label: "Page", description: "Complete pagina met content"
  6. label: "Vraag uitleggen", description: "Leg atomic design niveaus uit"
- multiSelect: false

Response handling:
- Atom → Focus agents on variants, states, accessibility
- Molecule → Focus agents on composition, spacing, alignment
- Organism → Focus agents on layout, hierarchy, responsiveness
- Template → Focus agents on grid, regions, content slots
- Page → Focus agents on full design, real content
```

**Impact of level on agent behavior:**

| Level | Agent Focus | Output |
|-------|-------------|--------|
| Atom | Variants, states, accessibility | Single component with all states |
| Molecule | Composition, spacing, alignment | Component group with states |
| Organism | Layout, hierarchy, responsiveness | Section with internal structure |
| Template | Grid, regions, content slots | Page layout with placeholders |
| Page | Full design, real content | Complete page wireframe |

### Step 1.3: Load Reference Patterns

Based on requirements, read the relevant reference files:

**For mobile wireframes:**

```
Read: .claude/resources/wireframe/references/mobile-patterns.md
```

**For desktop wireframes:**

```
Read: .claude/resources/wireframe/references/desktop-patterns.md
```

**For page-specific patterns:**

```
Read: .claude/resources/wireframe/references/page-types.md
```

**For game UI (menus, HUD, inventory, etc.):**

```
Read: .claude/resources/wireframe/references/game-ui-patterns.md
```

Extract relevant patterns and summarize key guidelines for agents.

### Step 1.4: Component Architecture Questions

Based on atomic level, use conditional AskUserQuestion modals:

**For Atoms/Molecules - Modal: Varianten**

```
Use AskUserQuestion tool:
- header: "Component Varianten"
- question: "Welke varianten zijn nodig?"
- options:
  1. label: "Size varianten", description: "small, medium, large"
  2. label: "Kleur varianten", description: "primary, secondary, danger, etc."
  3. label: "State varianten (Aanbevolen)", description: "default, hover, disabled, error"
  4. label: "Alle bovenstaande", description: "Volledige variant dekking"
  5. label: "Vraag uitleggen", description: "Leg component varianten uit"
- multiSelect: true
```

**For Atoms/Molecules - Modal: Component Type**

```
Use AskUserQuestion tool:
- header: "Component Type"
- question: "Welk type component is dit?"
- options:
  1. label: "Presentational (Aanbevolen)", description: "Pure UI component zonder logic (dumb)"
  2. label: "Container", description: "Component met state/logic (smart)"
  3. label: "Compound", description: "Parent met child components (composition)"
  4. label: "Vraag uitleggen", description: "Leg component types uit"
- multiSelect: false
```

**For Organisms/Templates/Pages - Modal: Compositie**

```
Use AskUserQuestion tool:
- header: "Compositie Aanpak"
- question: "Hoe moeten secties samengesteld worden?"
- options:
  1. label: "Composable slots (Aanbevolen)", description: "Flexibele slots voor content injectie"
  2. label: "Vaste structuur", description: "Voorgedefinieerde secties zonder variatie"
  3. label: "Hybrid", description: "Mix van vaste en flexibele delen"
  4. label: "Vraag uitleggen", description: "Leg compositie aanpakken uit"
- multiSelect: false
```

**For Organisms/Templates/Pages - Modal: Hergebruik**

```
Use AskUserQuestion tool:
- header: "Bestaande Componenten"
- question: "Welke bestaande atoms/molecules hergebruiken?"
- options:
  1. label: "Scan codebase (Aanbevolen)", description: "Automatisch beschikbare componenten detecteren"
  2. label: "Geen hergebruik", description: "Alles nieuw maken"
  3. label: "Handmatig specificeren", description: "Ik geef specifieke componenten op"
  4. label: "Vraag uitleggen", description: "Leg component hergebruik uit"
- multiSelect: false
```

## FASE 2: Round 1 - First Designs

**CRITICAL:** Spawn 3 agents IN PARALLEL using the Task tool. Send a single message with 3 Task tool calls.

```
3 design agents parallel gestart...

- UX Agent: User-first design maken
- Minimal Agent: Minimalistisch design maken
- Rich Agent: Feature-rich design maken
```

### Agent Calls

**IMPORTANT:** Each agent MUST read the HTML template from `references/html-template.html` and use it EXACTLY for the navigation structure.

**Task 1 - UX Agent:**

```
Task(
  subagent_type="general-purpose",
  description="Create UX wireframe v1",
  prompt="""
You are a UX-focused wireframe designer. Your philosophy: "User first"

DESIGN FOCUS:
- Optimal user flow and task completion
- Clear visual hierarchy for scannability
- Accessible touch targets (min 44x44px)
- Minimal cognitive load
- Clear affordances and feedback states

ATOMIC DESIGN LEVEL: [Insert level from FASE 1.2]
COMPONENT TYPE: Presentational (dumb) - pure UI, no logic

COMPOSITION PRINCIPLES:
- Use slot-based composition over prop-heavy components
- Break into atoms → molecules → organisms
- Each section should be a separate composable unit
- Avoid god-components with many props
- Example: <Card><Card.Header/><Card.Body/><Card.Footer/></Card>

REQUIREMENTS:
[Insert gathered requirements from FASE 1]

REFERENCE PATTERNS:
[Insert relevant patterns from mobile-patterns.md / desktop-patterns.md / page-types.md]

HTML TEMPLATE:
1. First, READ the file: .claude/resources/wireframe/references/html-template.html
2. Use this template EXACTLY for the navigation and base structure
3. Replace placeholders:
   - {{PAGE_NAME}} → [actual page name]
   - {{AGENT_NAME}} → UX
   - {{VERSION}} → v1
   - {{ACTIVE_UX_V1}} → class="active"
   - All other {{ACTIVE_*}} → (empty)
   - {{COMPONENT_STYLES}} → your wireframe CSS
   - {{WIREFRAME_CONTENT}} → your wireframe HTML

STORYBOOK-READY STRUCTURE:
- Add data-component="ComponentName" to each component root
- Add data-variant="default|hover|disabled" for states
- Add data-atomic="atom|molecule|organism" to indicate level
- Use semantic class names that map to component names

OUTPUT:
Create file: .workspace/wireframes/[page-name]/ux/v1.html

IMPORTANT:
- Use ONLY low-fidelity grayscale colors from the template comments
- Keep the navigation structure EXACTLY as in the template
- Write the complete HTML file using the Write tool
- Include data-* attributes for Storybook mapping
"""
)
```

**Task 2 - Minimal Agent:**

```
Task(
  subagent_type="general-purpose",
  description="Create Minimal wireframe v1",
  prompt="""
You are a minimalist wireframe designer. Your philosophy: "Less is more"

DESIGN FOCUS:
- Maximum whitespace
- Only essential elements
- Clean typography hierarchy
- Reduction to core functionality
- Zen-like simplicity

ATOMIC DESIGN LEVEL: [Insert level from FASE 1.2]
COMPONENT TYPE: Presentational (dumb) - pure UI, no logic

COMPOSITION PRINCIPLES:
- Fewer components, each doing one thing well
- Prefer composition over configuration
- Single-purpose atoms that combine cleanly
- No unnecessary wrapper elements
- Example: Simple <Button> instead of <Button icon={} loading={} variant={} size={} ...>

REQUIREMENTS:
[Insert gathered requirements from FASE 1]

REFERENCE PATTERNS:
[Insert relevant patterns from mobile-patterns.md / desktop-patterns.md / page-types.md]

HTML TEMPLATE:
1. First, READ the file: .claude/resources/wireframe/references/html-template.html
2. Use this template EXACTLY for the navigation and base structure
3. Replace placeholders:
   - {{PAGE_NAME}} → [actual page name]
   - {{AGENT_NAME}} → Minimal
   - {{VERSION}} → v1
   - {{ACTIVE_MIN_V1}} → class="active"
   - All other {{ACTIVE_*}} → (empty)
   - {{COMPONENT_STYLES}} → your wireframe CSS
   - {{WIREFRAME_CONTENT}} → your wireframe HTML

STORYBOOK-READY STRUCTURE:
- Add data-component="ComponentName" to each component root
- Add data-variant="default|hover|disabled" for states
- Add data-atomic="atom|molecule|organism" to indicate level
- Use semantic class names that map to component names

OUTPUT:
Create file: .workspace/wireframes/[page-name]/minimal/v1.html

IMPORTANT:
- Use ONLY low-fidelity grayscale colors from the template comments
- Keep the navigation structure EXACTLY as in the template
- Write the complete HTML file using the Write tool
- Include data-* attributes for Storybook mapping
"""
)
```

**Task 3 - Rich Agent:**

```
Task(
  subagent_type="general-purpose",
  description="Create Rich wireframe v1",
  prompt="""
You are a feature-rich wireframe designer. Your philosophy: "Power users first"

DESIGN FOCUS:
- All options visible and accessible
- Information density
- Efficiency for repeat users
- Advanced features surfaced
- Comprehensive controls

ATOMIC DESIGN LEVEL: [Insert level from FASE 1.2]
COMPONENT TYPE: Presentational (dumb) - pure UI, no logic

COMPOSITION PRINCIPLES:
- Use compound components for complex UI
- Prefer composition: <DataTable><Toolbar/><Filters/><Body/><Pagination/></DataTable>
- NOT: <DataTable pagination sortable filterable columns={60} ... />
- Each sub-component should be independently usable
- Smart/Dumb: Keep all logic in container, keep UI pure

REQUIREMENTS:
[Insert gathered requirements from FASE 1]

REFERENCE PATTERNS:
[Insert relevant patterns from mobile-patterns.md / desktop-patterns.md / page-types.md]

HTML TEMPLATE:
1. First, READ the file: .claude/resources/wireframe/references/html-template.html
2. Use this template EXACTLY for the navigation and base structure
3. Replace placeholders:
   - {{PAGE_NAME}} → [actual page name]
   - {{AGENT_NAME}} → Rich
   - {{VERSION}} → v1
   - {{ACTIVE_RICH_V1}} → class="active"
   - All other {{ACTIVE_*}} → (empty)
   - {{COMPONENT_STYLES}} → your wireframe CSS
   - {{WIREFRAME_CONTENT}} → your wireframe HTML

STORYBOOK-READY STRUCTURE:
- Add data-component="ComponentName" to each component root
- Add data-variant="default|hover|disabled" for states
- Add data-atomic="atom|molecule|organism" to indicate level
- Use semantic class names that map to component names

OUTPUT:
Create file: .workspace/wireframes/[page-name]/rich/v1.html

IMPORTANT:
- Use ONLY low-fidelity grayscale colors from the template comments
- Keep the navigation structure EXACTLY as in the template
- Write the complete HTML file using the Write tool
- Include data-* attributes for Storybook mapping
"""
)
```

Wacht tot alle 3 agents klaar zijn voor FASE 3.

## FASE 3: Visual Reflection

### Step 3.1: Open Wireframes for Review

Open de v1 wireframes in de browser voor visuele inspectie:

```bash
start .workspace/wireframes/[page-name]/ux/v1.html
```

```
V1 wireframes staan klaar in je browser.
Gebruik de navigatiebalk om te wisselen tussen UX, Minimal en Rich versies.
```

**Note:** Als screenshots nodig zijn voor documentatie of vergelijking, maak ze handmatig met je browser's screenshot tools.

### Step 3.2: Visual Reflection with Sequential Thinking

Analyseer ELKE wireframe met sequential thinking door de HTML structuur en CSS te reviewen:

**Reflection prompt:**

```
Analyseren van [agent] v1 wireframe...

1. Wat TOONT de structuur? (beschrijf layout en elementen objectief)
2. Is de visuele hierarchie duidelijk? Wat trekt eerst/tweede/derde aandacht?
3. Hoe is de whitespace balans? Te druk? Te leeg?
4. Zijn touch targets visueel duidelijk en correct gedimensioneerd?
5. Wat voelt verkeerd of kan verbeterd worden?
6. Wat werkt goed en moet behouden blijven?

Conclusie: Specifieke verbeteringen voor v2...
```

Bewaar reflection bevindingen voor FASE 4.

## FASE 4: Round 2 - Improved Designs

**CRITICAL:** Spawn 3 agents IN PARALLEL opnieuw, nu inclusief de reflection inzichten.

```
Ronde 2 gestart met visuele feedback...

- UX Agent: Verbeteren op basis van reflectie
- Minimal Agent: Verbeteren op basis van reflectie
- Rich Agent: Verbeteren op basis van reflectie
```

### Agent Calls for v2

**Task 1 - UX Agent v2:**

```
Task(
  subagent_type="general-purpose",
  description="Create UX wireframe v2",
  prompt="""
You are a UX-focused wireframe designer. Your philosophy: "User first"

VISUAL REFLECTION FROM V1:
[Insert sequential thinking analysis of UX v1 screenshot]

IMPROVEMENTS TO MAKE:
[List specific improvements identified]

ATOMIC DESIGN LEVEL: [Same as v1]
COMPONENT TYPE: Presentational (dumb) - pure UI, no logic

COMPOSITION PRINCIPLES (maintain from v1):
- Use slot-based composition over prop-heavy components
- Break into atoms → molecules → organisms
- Each section should be a separate composable unit

REQUIREMENTS:
[Same requirements as v1]

HTML TEMPLATE:
1. First, READ the file: .claude/resources/wireframe/references/html-template.html
2. Use this template EXACTLY for the navigation and base structure
3. Replace placeholders:
   - {{PAGE_NAME}} → [actual page name]
   - {{AGENT_NAME}} → UX
   - {{VERSION}} → v2
   - {{ACTIVE_UX_V2}} → class="active"
   - All other {{ACTIVE_*}} → (empty)

STORYBOOK-READY: Keep data-component, data-variant, data-atomic attributes

OUTPUT:
Create file: .workspace/wireframes/[page-name]/ux/v2.html

Maintain your UX-first philosophy while addressing the identified issues.
"""
)
```

**Task 2 - Minimal Agent v2:**

```
Task(
  subagent_type="general-purpose",
  description="Create Minimal wireframe v2",
  prompt="""
You are a minimalist wireframe designer. Your philosophy: "Less is more"

VISUAL REFLECTION FROM V1:
[Insert sequential thinking analysis of Minimal v1 screenshot]

IMPROVEMENTS TO MAKE:
[List specific improvements identified]

ATOMIC DESIGN LEVEL: [Same as v1]
COMPONENT TYPE: Presentational (dumb) - pure UI, no logic

COMPOSITION PRINCIPLES (maintain from v1):
- Fewer components, each doing one thing well
- Prefer composition over configuration
- Single-purpose atoms that combine cleanly

REQUIREMENTS:
[Same requirements as v1]

HTML TEMPLATE:
1. First, READ the file: .claude/resources/wireframe/references/html-template.html
2. Use this template EXACTLY for the navigation and base structure
3. Replace placeholders:
   - {{PAGE_NAME}} → [actual page name]
   - {{AGENT_NAME}} → Minimal
   - {{VERSION}} → v2
   - {{ACTIVE_MIN_V2}} → class="active"
   - All other {{ACTIVE_*}} → (empty)

STORYBOOK-READY: Keep data-component, data-variant, data-atomic attributes

OUTPUT:
Create file: .workspace/wireframes/[page-name]/minimal/v2.html

Maintain your minimalist philosophy while addressing the identified issues.
"""
)
```

**Task 3 - Rich Agent v2:**

```
Task(
  subagent_type="general-purpose",
  description="Create Rich wireframe v2",
  prompt="""
You are a feature-rich wireframe designer. Your philosophy: "Power users first"

VISUAL REFLECTION FROM V1:
[Insert sequential thinking analysis of Rich v1 screenshot]

IMPROVEMENTS TO MAKE:
[List specific improvements identified]

ATOMIC DESIGN LEVEL: [Same as v1]
COMPONENT TYPE: Presentational (dumb) - pure UI, no logic

COMPOSITION PRINCIPLES (maintain from v1):
- Use compound components for complex UI
- Prefer composition: <DataTable><Toolbar/><Filters/><Body/><Pagination/></DataTable>
- Each sub-component should be independently usable

REQUIREMENTS:
[Same requirements as v1]

HTML TEMPLATE:
1. First, READ the file: .claude/resources/wireframe/references/html-template.html
2. Use this template EXACTLY for the navigation and base structure
3. Replace placeholders:
   - {{PAGE_NAME}} → [actual page name]
   - {{AGENT_NAME}} → Rich
   - {{VERSION}} → v2
   - {{ACTIVE_RICH_V2}} → class="active"
   - All other {{ACTIVE_*}} → (empty)

STORYBOOK-READY: Keep data-component, data-variant, data-atomic attributes

OUTPUT:
Create file: .workspace/wireframes/[page-name]/rich/v2.html

Maintain your feature-rich philosophy while addressing the identified issues.
"""
)
```

Wacht tot alle 3 agents klaar zijn voor FASE 5.

## FASE 5: Open & Select

### Step 5.1: Open First Wireframe

Open de eerste wireframe in de standaard browser:

```bash
start .workspace/wireframes/[page-name]/ux/v1.html
```

**Verstuur notificatie:**

```bash
powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "6 wireframes klaar"
```

### Step 5.2: Ask for Selection

Toon eerst samenvatting:

```
6 WIREFRAME DESIGNS GEMAAKT

| Stijl | Filosofie | Versies |
|-------|-----------|---------|
| **UX Focus** | user flow, toegankelijkheid, duidelijkheid | v1 (initieel), v2 (gereflecteerd) |
| **Minimal** | whitespace, alleen essentials, eenvoud | v1 (initieel), v2 (gereflecteerd) |
| **Feature Rich** | power users, informatiedichtheid | v1 (initieel), v2 (gereflecteerd) |

Gebruik de navigatiebalk in de browser om tussen versies te wisselen.

**Atomic Design Niveau:** [niveau uit FASE 1.2]
**Component Type:** Presentational (dumb)
```

Gebruik dan AskUserQuestion voor richting selectie:

```
Use AskUserQuestion tool:
- header: "Richting Kiezen"
- question: "Welke richting werkt het beste voor jou?"
- options:
  1. label: "Eén design kiezen (Aanbevolen)", description: "Selecteer één wireframe om mee verder te gaan"
  2. label: "Elementen combineren", description: "Mix de beste delen van meerdere designs"
  3. label: "Synthese aanvragen", description: "Laat AI de beste elementen samenvoegen"
  4. label: "Storybook stories genereren", description: "Maak component stories voor gekozen design"
  5. label: "Vraag uitleggen", description: "Leg de opties uit"
- multiSelect: false
```

**Follow-up modal (als optie 1 geselecteerd):**

```
Use AskUserQuestion tool:
- header: "Design Selectie"
- question: "Welk wireframe design kies je?"
- options:
  1. label: "UX v2 (Aanbevolen)", description: "User-first design met reflectie verbeteringen"
  2. label: "UX v1", description: "User-first design initieel"
  3. label: "Minimal v2", description: "Minimalistisch design met reflectie verbeteringen"
  4. label: "Minimal v1", description: "Minimalistisch design initieel"
  5. label: "Rich v2", description: "Feature-rich design met reflectie verbeteringen"
  6. label: "Rich v1", description: "Feature-rich design initieel"
  7. label: "Vraag uitleggen", description: "Beschrijf de verschillen tussen designs"
- multiSelect: false
```

### Step 5.3: Generate Storybook Stories (Optional)

If user selects "Storybook stories genereren" or requests Storybook generation after selection:

```
STORYBOOK GENERATIE

Genereren van stories voor: [gekozen design]
Atomic niveau: [niveau]

Te maken stories:
```

**Generate story file based on wireframe data-* attributes:**

```tsx
// [component-name].stories.tsx
import type { Meta, StoryObj } from '@storybook/react';

export default {
  title: '[Atoms|Molecules|Organisms]/[ComponentName]',
  component: [ComponentName],
} satisfies Meta<typeof [ComponentName]>;

type Story = StoryObj<typeof [ComponentName]>;

// Canonical states
export const Default: Story = { args: {} };
export const Loading: Story = { args: { loading: true } };
export const Empty: Story = { args: { data: [] } };
export const Error: Story = { args: { error: 'Something went wrong' } };

// Variants from wireframe
[Generate based on data-variant attributes found]
```

**Smart/Dumb Component Split:**
```
COMPONENT ARCHITECTUUR

Gebaseerd op wireframe, voorgestelde opsplitsing:

PRESENTATIONAL (Dumb) - Pure UI:
[Lijst met componenten met data-component attributen]
→ Locatie: src/components/ui/

CONTAINER (Smart) - Logic wrapper:
[Suggereer container voor elke presentational]
→ Locatie: src/components/features/

Voorbeeld:
- MetricCard (dumb) → MetricCardContainer (smart)
- DataTable (dumb) → DataTableContainer (smart)
```

## Output Structure

```
.workspace/
└── wireframes/
    └── [page-name]/
        ├── ux/
        │   ├── v1.html         # UX focus - initial
        │   └── v2.html         # UX focus - after reflection
        ├── minimal/
        │   ├── v1.html         # Minimal - initial
        │   └── v2.html         # Minimal - after reflection
        ├── rich/
        │   ├── v1.html         # Feature rich - initial
        │   └── v2.html         # Feature rich - after reflection
        └── storybook/          # Generated after selection (optional)
            ├── [Component].stories.tsx
            └── components.md   # Component architecture guide
```

## Wireframe Styling Guidelines

Gebruik ALLEEN low-fidelity grayscale uit de template:
- Achtergronden: #f5f5f5, #fafafa, #e0e0e0, #ddd, #ccc
- Borders: #999, #aaa, #bbb, #ccc
- Tekst: #333, #666, #888
- Selected/Active: achtergrond #888 of #999, tekst #fff
- Placeholder afbeeldingen: solid #ddd

## Notificaties

**Notificeer wanneer Claude wacht op user input NA een langdurige fase.**

| Moment | Na Fase | Bericht |
|--------|---------|--------
