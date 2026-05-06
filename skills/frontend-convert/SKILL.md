---
name: frontend-convert
description: >-
  Convert visual input (screenshots, Figma exports, URLs, inspiration images)
  into working pages or components. Three modes: 1:1 faithful copy,
  inspiration-based using project theme tokens, or patch (surgical Edit on
  existing component — only changed sections). Self-verifies with Playwright CLI
  comparison loop. Use with /frontend-convert.
argument-hint: "[file-path|url]"
disable-model-invocation: true
writes: [devinfo.handoff]
metadata:
  author: mileszeilstra
  version: 2.5.1
  category: frontend
---

# Convert

Convert visual input into working code. Accepts screenshots, Figma exports, website URLs, or images pasted in chat. Two modes: faithful 1:1 reproduction or inspiration-based conversion using the project's theme tokens (from project.json). Self-verifies by comparing source image against Playwright CLI screenshot of generated output.

**Verwante skills:** `/frontend-tokens` · `/frontend-design` · `/frontend-install` · `/frontend-check` · `/frontend-wcag`

## References

- `../shared/RULES.md` — React/TypeScript coding rules
- `../shared/PATTERNS.md` — Component patterns (compound, render props, etc.)
- `../shared/DESIGN.md` — Anti-patterns, color, typography, motion, UX writing
- `../shared/PLAYWRIGHT.md` — Playwright CLI, screenshot capture
- `../shared/DEVINFO.md` — Session tracking, cross-skill handoff
- `../shared/BACKLOG.md` — Backlog HTML+JSON format, read/write protocol
- `./examples/` — Before/after conversie voorbeelden (1:1 en inspiratie modus)

---

## FASE 0: Pre-flight

### 0.1 Visual Input Resolution

Determine the input type from the argument or conversation:

| Input                                             | Detection                                  | Action                                                         |
| ------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------- |
| File path (`/home/...`, `C:\...`, `.png`, `.jpg`) | Contains path separator or image extension | Read file with Read tool (multimodal)                          |
| URL (`http://`, `https://`, `figma.com`)          | Starts with protocol or known domain       | CLI: `playwright-cli open [url]` → `playwright-cli screenshot` |
| Image in chat                                     | No path/URL, image data present            | Analyze directly from conversation                             |
| None                                              | No argument, no image                      | Ask user (see below)                                           |

**No input provided:**

```yaml
header: "Visual Input"
question: "Wat wil je converteren? Plak een screenshot in chat, geef een bestandspad, of geef een URL."
options:
  - label: "Ik plak een screenshot", description: "Plak afbeelding in het volgende bericht"
  - label: "Bestandspad", description: "Pad naar screenshot/export/afbeelding"
  - label: "URL", description: "Website URL, Figma share link, of Canva link"
multiSelect: false
```

**For URLs:** Navigate with Playwright CLI, wait 3 seconds for render, take full-page screenshot. This captured screenshot becomes the source image for all subsequent phases.

```
playwright-cli open [url]
playwright-cli run-code "async page => { await page.waitForTimeout(3000); }"
playwright-cli screenshot --full-page --filename=.project/source-capture.png
playwright-cli close
Read .project/source-capture.png
```

Store the resolved source image reference as `$SOURCE_IMAGE` for the verification loop.

### 0.2 Visual Analysis

Analyze the source image. Extract:

```
SOURCE ANALYSIS
════════════════════════════════════════════════════════════

Type:       [Full page | Section/component | Multiple components]
Sections:   [enumerated list of visual sections top-to-bottom]
Layout:     [single column | multi-column | grid | sidebar + content | etc.]
Responsive: [single viewport | mobile + desktop | mobile + tablet + desktop | unknown]
Sizing:     [per key element: fixed (explicit px/rem) | fill (flex:1 / width:100%) | hug (fit-content/auto)]
Key colors: [dominant colors as hex, max 5]
Dark mode:  [light only | dark only | both visible | unknown]
Typography: [heading style, body style — approximate]
Components: [identifiable UI patterns: cards, nav, hero, form, table, etc.]
Variants:   [component naam → gedetecteerde variant-assen: size=sm/md/lg, state=default/hover/disabled, type=primary/ghost]
            [of: geen varianten detecteerbaar]
States:     [geen aparte state-frames | loading | error | empty | success]
            Detecteer alleen frames/artboards die expliciet een non-default state tonen. Sla op als $STATES.
Properties: [design properties met directe CSS-mapping — noteer alleen wat zichtbaar aanwezig is:
              fill → background-color/color: [waarde(n)]
              stroke → border: [waarde(n)]
              corner-radius → border-radius: [waarde(n)]
              shadow → box-shadow: [waarde(n)]
              opacity → opacity: [waarde(n)]
              rotation → transform: rotate([waarde(n)])]

════════════════════════════════════════════════════════════
```

### 0.3 Mode Selection

```yaml
header: "Modus"
question: "Hoe wil je dit visuele ontwerp converteren?"
options:
  - label: "1:1 kopie (Recommended)", description: "Zo getrouw mogelijk nabouwen — kleuren, fonts, spacing uit het origineel"
  - label: "Inspiratie", description: "Layout/structuur overnemen, project theme tokens toepassen"
multiSelect: false
```

Store as `$MODE` (copy | inspiration).

### 0.4 Scope Detection

Based on the visual analysis (0.2), confirm the output scope:

```yaml
header: "Scope"
question: "Wat moet de output zijn?"
options:
  - label: "Volledige pagina (Recommended)", description: "Pagina-bestand + sectie-componenten"
  - label: "Eén component", description: "Alleen dit component genereren"
  - label: "Meerdere losse componenten", description: "Elk visueel blok als apart component"
  - label: "Bestaand component bijwerken", description: "Patch op basis van nieuwe screenshot — alleen gewijzigde secties"
multiSelect: false
```

Bij "Bestaand component bijwerken": sla FASE 0.5 over en ga naar FASE 0.4b.

### 0.4b Patch Detection

Alleen bij scope = patch.

#### Stap 1: Component locatie

Als het componentpad niet al bekend is (bijv. via argument of via bestandsselectie in VSCode):

```yaml
header: "Component"
question: "Welk bestand wil je bijwerken?"
options:
  - label: "Ik typ het pad", description: "Relatief of absoluut pad naar het .tsx/.jsx bestand"
multiSelect: false
```

Lees het bestand via Read tool. Als het bestand niet bestaat: stop met melding en val terug naar scope "Eén component".

#### Stap 2: Before-screenshot

Render het huidige component via Playwright (als dev server beschikbaar):

```
playwright-cli goto http://localhost:[port]/[page met dit component]
playwright-cli run-code "async page => { await page.waitForTimeout(2000); }"
playwright-cli screenshot --filename=.project/patch-before.png
```

Als Playwright niet beschikbaar: sla before-screenshot over en ga direct naar stap 3 zonder visuele diff.

#### Stap 3: Visual diff

Vergelijk `$SOURCE_IMAGE` (nieuw) met `patch-before.png` (huidig):

```
PATCH ANALYSE
════════════════════════════════════════════════════════════
Gewijzigd:
  [Sectie/element dat visueel veranderd is — beschrijving]
  [Sectie/element 2 — indien van toepassing]

Ongewijzigd:
  [Secties die identiek zijn — worden niet aangeraakt]
════════════════════════════════════════════════════════════
```

#### Stap 4: Confirm

```yaml
header: "Patch Scope"
question: "Klopt deze analyse van wat er gewijzigd is?"
options:
  - label: "Ja, ga door (Recommended)", description: "Patch alleen de gewijzigde secties"
  - label: "Aanpassen", description: "Ik wil de scope wijzigen"
  - label: "Toch volledig herschrijven", description: "Val terug naar normale generatie"
multiSelect: false
```

Sla op als `$PATCH_SECTIONS`. Als "Toch volledig herschrijven": herstel scope naar "Eén component" en ga door met normale FASE 0.5.

### 0.5 Backlog Stage (page scope only)

If scope is a full page (not a single component):

1. Read `.project/backlog.html` (if exists) → parse JSON from `<script id="backlog-data" type="application/json">...</script>`
2. Find feature matching page name: `data.features.find(f => f.name === "{kebab-case-page-name}")`
   - **Found + status TODO**: set `status: "DOING"`, `stage: "building"`, `date: "{YYYY-MM-DD}"`. Write back via Edit.
   - **Found + status DOING**: set `stage: "building"`. Write back via Edit.
   - **Not found**: add to `data.features[]`: `{ "name": "{name}", "type": "PAGE", "status": "DOING", "stage": "building", "phase": "P4", "description": "Converted from visual input", "dependencies": [] }`. Write back.
3. Set `data.updated` to today. Keep `<script>` tags intact.

If scope is a component: skip this step.

### 0.6 Theme & Project Context

**Theme check:**

Check `.project/project.json` → `theme` section.

- **Theme populated + inspiration mode:** Read and store tokens. Mandatory for mapping.
- **Theme populated + copy mode:** Read as reference. Use for shared utilities (cn(), Tailwind config) but not for color/font values.
- **No theme + inspiration mode:** Abort with suggestion: `"Inspiration mode vereist een theme. Run eerst /frontend-tokens of kies 1:1 kopie."`
- **No theme + copy mode:** Proceed with extracted values from source image.

```
Theme: [Available | Not available]
Mode:  [1:1 copy | Inspiration]
```

**Framework detection:**

Detect from `package.json`:

| Framework          | Detection             | Page path                | Component dir            |
| ------------------ | --------------------- | ------------------------ | ------------------------ |
| Next.js App Router | `next` + `app/` dir   | `app/[page]/page.tsx`    | `src/components/[page]/` |
| Next.js Pages      | `next` + `src/pages/` | `src/pages/[page].tsx`   | `src/components/[page]/` |
| Vite + React       | `vite` in deps        | `src/pages/[page].tsx`   | `src/components/[page]/` |
| Remix              | `@remix-run/react`    | `app/routes/[page].tsx`  | `app/components/[page]/` |
| Astro              | `astro` in deps       | `src/pages/[page].astro` | `src/components/[page]/` |

**Light component scan:**

Quick scan for reusable components in the project. No deep inventory — just check what exists:

1. Glob for `src/components/**/*.{tsx,jsx}` (or framework equivalent)
2. List component names and their approximate purpose (from filename + exports)
3. Match against sections identified in the source image

```
PROJECT CONTEXT
════════════════════════════════════════════════════════════

Framework:  [detected]
Theme:      [Available (project.json#theme) | Not available]
Existing:   [N] components found
  Reusable: [component names that match source sections]

════════════════════════════════════════════════════════════
```

---

## FASE 1: Token Mapping (Inspiration mode only)

**Skip this phase entirely if `$MODE` = copy.**

### 1.1 Extract and Map

Extract visual properties from the source image and map them to the closest theme tokens (from project.json):

```
TOKEN MAPPING
════════════════════════════════════════════════════════════

Colors:
  Source              → Theme Token
  #FF5733 (accent)    → primary-500 (#3B82F6)
  #333333 (heading)   → foreground (#1a1a2e)
  #F5F5F5 (bg)        → background (#ffffff)
  #666666 (body text) → muted-foreground (#6B7280)

Typography:
  Source              → Theme Token
  Bold sans-serif     → heading (Inter, 700)
  Regular sans-serif  → body (Inter, 400)

Spacing:
  Source (approx.)    → Theme Token
  ~16px sections      → spacing-4 (16px)
  ~32px large gaps    → spacing-8 (32px)

════════════════════════════════════════════════════════════
```

### 1.2 Confirm Mapping

```yaml
header: "Token Mapping"
question: "Klopt deze mapping van bron-design naar je project tokens?"
options:
  - label: "Ja, ga door (Recommended)", description: "Gebruik deze mapping voor code generatie"
  - label: "Aanpassen", description: "Ik wil specifieke mappings wijzigen"
multiSelect: false
```

If "Aanpassen": ask which mappings to change, update, re-confirm.

---

## FASE 2: Code Generation

### 2.0 Patch Guard (scope = patch only)

Als `$SCOPE` ≠ patch: sla deze sectie over en ga direct naar 2.1.

Per sectie in `$PATCH_SECTIONS`:

1. Lees de betreffende regels in het bestaande componentbestand (Read tool).
2. Genereer alleen de gewijzigde JSX/klassen/structuur op basis van `$SOURCE_IMAGE`.
3. Pas toe via **Edit tool** — nooit Write. Zoek de exacte string, vervang alleen dat blok.
4. Toon per edit een korte samenvatting:
   ```
   PATCH: [sectie-naam]
   ─────────────────────────
   Bestand: [pad:regel]
   Wijziging: [beschrijving — bijv. "CTA tekst + variant gewijzigd"]
   ```

Na alle edits: ga naar FASE 3 (verificatie) met de nieuwe screenshot als target. Sla 2.1 en 2.2 over.

### 2.1 Plan Output Structure

Based on scope (page vs component), framework, and reusable components:

```
GENERATION PLAN
════════════════════════════════════════════════════════════

Output:
  Page file:    [path]
  Components:   [list with paths]
  Reusing:      [existing components to import]

Strategy per section:
  [Section 1] → [new component | reuse existing]
  [Section 2] → [new component | reuse existing]
  ...

{Als $VARIANTS niet leeg:}
Variant components:
  [ComponentName] → cva ([variant-assen: type × size])
  [ComponentName] → cva ([variant-assen: state])

{Als $STATES niet leeg:}
State components:
  [ComponentName] → loading: skeleton | error: ErrorBoundary | empty: EmptyState

════════════════════════════════════════════════════════════
```

### 2.2 Generate Code

Generate the page and components based on the source image.

**Rules:**

- Follow `shared/RULES.md`: React/Next.js Rules, HTML/CSS Rules, Accessibility Rules (A-series)
- Follow `shared/PATTERNS.md`: Component Patterns, Layout Patterns
- Use `cn()` for className composition — create `src/lib/utils.ts` if not present
- TypeScript strict mode with proper interfaces
- Semantic HTML with aria-labels and keyboard support
- Import existing components — never regenerate what already works

**Component states:**

Als `$STATES` niet leeg: genereer state-varianten naast de happy path.

- **Loading**: gebruik een skeleton die de happy path layout spiegelt — zelfde grid/flex structuur, placeholder blokken op tekstposities. Geen generieke spinner tenzij de source dat expliciet toont.
- **Error**: toon foutmelding met retry-actie als dat logisch is voor de context. Gebruik `error`-semantische kleur als het theme die definieert.
- **Empty**: contextual lege staat — infereer uit de sectienaam wat er zou staan (bijv. "Nog geen projecten" voor een projectenlijst).

Alle states volgen dezelfde `dark:` en responsive logica als de happy path.

**Mode-specific** (zie `./examples/` voor gold standard voorbeelden per modus):

- **1:1 copy:** Match source colors, fonts, spacing as closely as possible. Use arbitrary Tailwind values (`bg-[#FF5733]`, `text-[20px]`) when no standard class matches. Prioritize visual fidelity. Referentie: `./examples/PricingPage-1to1.tsx`
- **Inspiration:** Use only theme tokens (from project.json) and standard Tailwind classes. Match source layout and structure, not visual details. No arbitrary values. Referentie: `./examples/PricingPage-inspiration.tsx`

**Dark mode classes:**

Check `theme.modes.dark` in `project.json`. Als aanwezig (`$HAS_DARK_MODE = true`): voeg `dark:` Tailwind prefix toe aan alle background-, text-color-, en border-classes.

- `bg-white dark:bg-[var(--color-dark)]` of via theme alias: `bg-background dark:bg-background`
- `text-gray-900 dark:text-[var(--color-light)]`
- `border-gray-200 dark:border-[var(--color-mid-gray)]`

Als `theme.modes.dark` ontbreekt: geen `dark:` classes — niet toevoegen op goed geluk.

**Responsive layout:**

Als `$RESPONSIVE_VIEWPORTS` meerdere viewports toont: gebruik Tailwind responsive prefixes systematisch (mobile-first).

- Geen prefix = mobile/default
- `md:` = tablet (768px+)
- `lg:` = desktop (1024px+)

Voorbeelden: `flex-col md:flex-row`, `hidden md:block`, `px-4 md:px-8 lg:px-16`, `text-sm lg:text-base`

Als single viewport: genereer voor die viewport. Voeg `{/* TODO: responsive — alleen [mobile|desktop] frame beschikbaar */}` toe bovenaan het component.

**Contextual content:** Never use "Lorem ipsum." Infer contextual placeholder text from the source image or describe what real content would go there.

**Variant-aware components:**

Als `$VARIANTS` niet leeg is: gebruik `cva` (class-variance-authority) voor elk component met ≥2 gedetecteerde varianten. Check eerst of `cva` beschikbaar is in `package.json`; installeer niet automatisch — voeg toe aan Generation Summary als missing dependency.

Structuur:

```typescript
import { cva, type VariantProps } from "class-variance-authority";

const buttonVariants = cva("base-classes-hier", {
  variants: {
    variant: { primary: "...", ghost: "...", destructive: "..." },
    size: { sm: "...", md: "...", lg: "..." },
  },
  defaultVariants: { variant: "primary", size: "md" },
});

interface ButtonProps
  extends
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}
```

Zonder gedetecteerde varianten (`$VARIANTS` leeg): genereer normaal zonder `cva`.

### 2.3 Generation Summary

```
CODE GENERATED
════════════════════════════════════════════════════════════

Files created:
  ✓ [page file path]              (page)
  ✓ [component path]              (new)
  ✓ [component path]              (new)

Existing components imported:
  ✓ [component path]              (reused)

{Als cva gebruikt maar niet aanwezig in package.json:}
Dependencies:
  ⚠ cva niet gevonden in package.json — installeer: npm install class-variance-authority

Mode:       [1:1 copy | Inspiration with theme tokens]
Theme:      [Integrated from project.json#theme | Extracted from source]
Dark mode:  [✓ dark: classes toegepast | — geen dark mode in theme]
Responsive: [✓ responsive prefixes toegepast | — single viewport (TODO comment geplaatst)]
States:     [✓ state components gegenereerd: [loading|error|empty] | — geen state frames gedetecteerd]

════════════════════════════════════════════════════════════
```

---

## FASE 3: Visual Verification Loop

Self-verify by comparing the source image against a Playwright CLI screenshot of the generated output. Max 3 rounds. See `../shared/VERIFICATION.md` for the generic loop pattern, round management, and code quality checks.

### 3.0 Pre-flight

Check Playwright CLI beschikbaar: `playwright-cli --version`. If unavailable: skip with message `"Playwright CLI niet beschikbaar — open de pagina handmatig om te verifiëren."`, proceed to FASE 4.

### 3.1 Dev Server

Detect or start dev server:

1. Check if dev server already running on expected port (try `playwright-cli open http://localhost:[port]`)
2. If not running: start in background (`npm run dev` / `npx next dev` based on framework)
3. Wait for server ready

### 3.2 Verification Round

```
VERIFICATION ROUND [N]/3
────────────────────────
```

**Sequence:**

1. `playwright-cli goto http://localhost:[port]/[page-path]`
2. `playwright-cli run-code "async page => { await page.waitForTimeout(3000); }"` (allow hydration)
3. `playwright-cli screenshot --filename=.project/verify-round-[N].png`
4. `Read .project/verify-round-[N].png` → capture generated page
5. `playwright-cli console error` → check for runtime JS errors (zie `../shared/PLAYWRIGHT.md` → Console Error Inspection)
   → Filter output tegen PLAYWRIGHT.md → Default Ignore Patterns vóór rapportage; alleen niet-gefilterde regels worden findings.

**Compare source image vs generated screenshot. Analyze:**

- Layout structure (sections in correct order, proportions roughly match)
- Spacing (gaps between sections, padding within sections)
- Color accuracy (1:1 mode: exact match matters; inspiration: theme tokens applied correctly)
- Typography (heading sizes, weight, alignment)
- Component rendering (all sections visible, no blank areas, no error overlays)
- Missing elements (anything in source not present in output)
- **Runtime errors** (van stap 5 — JS errors duiden op gebroken hydration of missende imports, ook als visueel niets opvalt; rapporteer als **P004** findings — zie RULES.md)

**Assessment:**

```
ROUND [N] ASSESSMENT
═════════════════════════
Match quality: [High | Medium | Low]
Runtime errors (P004): [None | [N] errors — see below]

Discrepancies:
  [1. specific issue — file:line — suggested fix]
  [2. specific issue — file:line — suggested fix]
  [3. specific issue — file:line — suggested fix]

JS errors (uit console):
  [- TypeError: foo is undefined at HeroSection:14]
  [- Failed to load module: ./Icon — verify import path]

Action: [✓ Acceptable — stop | → Fix and re-check]
═════════════════════════
```

Runtime errors zijn altijd fixable in deze fase — los op vóór visuele discrepancies (een component dat crasht kan visuele issues veroorzaken die elders niet bestaan).

**Decision logic:**

- **No significant discrepancies** → stop loop, proceed to FASE 4
- **Fixable discrepancies AND rounds remaining** → apply targeted edits, increment round, repeat from 3.2
- **Round 3 reached** → stop loop regardless, report remaining discrepancies

### 3.2b Code Quality Check (eerste ronde only)

Na de eerste visuele verificatie, scan alle gegenereerde bestanden:

**Altijd checken (beide modes):**

- Ontbrekende alt text: `<img>` of `<Image>` zonder `alt` prop (R002)
- Ontbrekende labels: `<input>`/`<select>` zonder `<label>` of `aria-label` (R004)
- Div-soup: `<div onClick>` zonder `role="button"` — gebruik `<button>` (R001)
- Implicit any: functies/parameters zonder type annotation (T002)

**Alleen in inspiratie modus:**

- Arbitrary color values: `bg-[#hex]`, `text-[#hex]`, `border-[#hex]` etc. — moet theme tokens gebruiken (H101)
- Arbitrary spacing: `p-[16px]`, `gap-[24px]`, `mt-[32px]` etc. — moet standaard Tailwind scale gebruiken (R103)
- Referentie: vergelijk met `./examples/PricingPage-inspiration.tsx` — geen enkele arbitrary value

Bij violations: neem mee als fixes in stap 3.3 samen met visuele discrepancies. Voeg toe aan het ROUND assessment:

```
Code quality:  [PASS | [N] violations]
  [- arbitrary color: bg-[#2D3748] → bg-surface-dark (H101)]
  [- missing alt: <img> in HeroSection:14 (R002)]
```

### 3.3 Fix and Re-check

Apply targeted edits for identified discrepancies. Focus on:

1. Layout/structure issues first (wrong flex direction, missing grid columns)
2. Spacing/sizing second (padding, gaps, widths)
3. Visual details last (colors, border radius, shadows)

After edits, return to 3.2 for next round.

### 3.4 Final Assessment

After the loop exits (either by quality threshold or max rounds):

```
VISUAL VERIFICATION COMPLETE
════════════════════════════════════════════════════════════

Rounds:         [N]/3
Final match:    [High | Medium | Low]
Source:         [source image description]
Generated:      [page URL]

[If remaining discrepancies:]
Remaining:
  - [discrepancy — recommended manual fix]

════════════════════════════════════════════════════════════
```

Close browser: `playwright-cli close`

---

## FASE 4: Completion

### 4.1 Update DevInfo

Update `.project/session/devinfo.json`:

```json
{
  "handoff": {
    "from": "frontend-convert",
    "to": null,
    "data": {
      "inputType": "screenshot | url | image",
      "mode": "copy | inspiration",
      "pageFile": "[page file path]",
      "components": ["[list of created component files]"],
      "verificationRounds": 2,
      "finalMatchQuality": "high",
      "framework": "[detected framework]",
      "theme": "[.project/project.json#theme or null]"
    }
  }
}
```

### 4.2 Backlog Completion Sync (page scope only)

If page scope and backlog exists:

1. Read `.project/backlog.html` → parse JSON
2. Find feature matching page name → set `stage: "built"`, `data.updated` to today
3. Write back via Edit (keep `<script>` tags intact)

### 4.3 Completion Report

```
CONVERT COMPLETE
═══════════════════════════════════════════════════════════

Source:       [file path | URL | pasted image]
Mode:         [1:1 copy | Inspiration]
Framework:    [detected framework]
Verification: [N] rounds, [High | Medium | Low] match
Code quality: [PASS | [N] violations fixed]

Files ([N]):
  Page:       [page file path]
  Components: [component paths]

Next steps:
  1. /frontend-tokens → design tokens aanpassen/toepassen
  2. /frontend-check → performance/SEO audit
  3. /frontend-wcag → accessibility audit

═══════════════════════════════════════════════════════════
```

---

## Restrictions

This skill must **NEVER**:

- Generate code without first analyzing the source image
- Use "Lorem ipsum" — always use contextual content from the source or realistic placeholders
- Run inspiration mode without theme (project.json#theme empty)
- Skip the visual verification loop when Playwright is available
- Regenerate components that already exist in the codebase — import and reuse
- Exceed 3 verification rounds

This skill must **ALWAYS**:

- Resolve visual input before any code generation
- Confirm mode (1:1 vs inspiration) with user
- Confirm token mapping with user in inspiration mode
- Follow `shared/RULES.md` (React/Next.js, HTML/CSS, A-series) and `shared/PATTERNS.md` (Component, Layout)
- Detect and match the project's framework
- Run the Playwright verification loop (unless tools unavailable)
- Update DevInfo for downstream skill handoff
- Show a completion report with next steps
