# Frontend Convert — Reference Appendix

Detailed reference material for the frontend-convert skill.
Extracted from SKILL.md for progressive disclosure (Anthropic skill spec).

---

## Output Structure

```
.workspace/convert/[page]/
+-- components.json           # Component lijst met status tracking
+-- reference.png             # Design screenshot (origineel of captured)
+-- reference-snapshot.md     # Accessibility snapshot (als URL input)
+-- reference.html            # Opgeslagen HTML (als URL/HTML input)

src/pages/[page].tsx            # DE werkende pagina (of app/[page]/page.tsx)

src/components/[page]/
+-- index.ts                  # Barrel exports
|
+-- organisms/
|   +-- Header/
|   |   +-- Header.tsx
|   |   +-- Header.types.ts
|   +-- Sidebar/
|       +-- ...
|
+-- molecules/
|   +-- Navigation/
|   +-- MetricCard/
|   +-- UserMenu/
|   +-- DataTable/
|
+-- atoms/
    +-- Button/
    +-- Badge/
    +-- NavLink/
    +-- Avatar/
    +-- Logo/

src/lib/
+-- utils.ts                  # cn() helper

tailwind.config.js            # Extended with design tokens
```

---

## Error Recovery

### Input Read Failure

```
RECOVERY: Input Read
────────────────────
Screenshot:
  1. Check file path en permissions
  2. Check image format (convert if needed)
  3. Fallback: vraag user om opnieuw te uploaden

HTML:
  1. Check encoding (UTF-8, Latin-1)
  2. Try HTML tidy/repair
  3. Fallback: vraag user om schone versie

URL:
  1. Retry met timeout increase
  2. Try met andere User-Agent
  3. Fallback: vraag user om screenshot of saved HTML
```

### Vision Analysis Failure

```
RECOVERY: Vision Analysis
─────────────────────────
1. Retry met meer specifieke prompt
2. Vraag user om design in kleinere delen op te splitsen
3. Fallback: user beschrijft components handmatig
```

### Token Extraction Failure

```
RECOVERY: Token Extraction
──────────────────────────
1. Show parse error in CSS
2. Try alternate CSS parser
3. Fallback: use Tailwind defaults + manual input
4. Fallback: vraag user om kleuren/fonts op te geven
```

### TypeScript Errors

```
RECOVERY: Type Errors
─────────────────────
1. Parse error message
2. Auto-fix common issues:
   - Missing imports
   - Wrong prop types
   - Missing 'use client'
   - Missing className in interface
3. Flag complex errors for manual fix
```

### Component Generation Failure

```
RECOVERY: Generation
────────────────────
1. Retry met vereenvoudigde component (minder variants)
2. Genereer zonder hover/active states, voeg later toe
3. Fallback: genereer basis JSX, user voegt Tailwind toe
```

### Design Mismatch

```
RECOVERY: Design Mismatch
─────────────────────────
Wanneer de gegenereerde component significant afwijkt van het design:

1. Toon side-by-side vergelijking (design vs code beschrijving)
2. Identificeer specifieke afwijkingen (kleur, spacing, layout)
3. Bied gerichte fixes aan per afwijking
4. Fallback: user beschrijft exact wat er anders moet
```

---

## DevInfo Integration

### Session Update

Update devinfo at each phase transition:

```json
{
  "currentSkill": {
    "name": "frontend-convert",
    "phase": "COMPONENT_LOOP",
    "startedAt": "ISO timestamp"
  },
  "progress": {
    "completedTasks": 4,
    "totalTasks": 11,
    "currentTask": "Converting Avatar component"
  },
  "files": {
    "created": [
      { "path": "src/components/landing/atoms/Button/Button.tsx", "skill": "frontend-convert" },
      { "path": ".workspace/convert/landing/components.json", "skill": "frontend-convert" }
    ]
  }
}
```

### Phase Tracking

Update devinfo bij elke fase transitie:
- `PREFLIGHT` -> input detected, project validated
- `DISCOVER` -> components identified
- `SETUP` -> tokens extracted, tailwind configured
- `COMPONENT_LOOP` -> per-component progress
- `POSTFLIGHT` -> validation complete
- `COMPLETE` -> handoff ready

### Workflow Completion

```json
{
  "workflow": {
    "name": "frontend-convert",
    "status": "completed",
    "completedAt": "ISO timestamp"
  },
  "handoff": {
    "from": "frontend-convert",
    "to": null,
    "data": {
      "inputType": "screenshot",
      "inputSource": "design/landing-v3.png",
      "summary": "8 components converted for landing (3 skipped)",
      "pageFile": "src/pages/landing.tsx",
      "outputDirectory": "src/components/landing/",
      "tailwindExtended": true,
      "designTokens": {
        "colors": 8,
        "fonts": 2,
        "source": "vision analysis"
      }
    }
  }
}
```

---

## Framework Notes

### Next.js App Router

- Add `'use client'` directive for interactive components (state, event handlers)
- Server components: no directive needed
- Compound components: always need `'use client'`
- Page file location: `app/[page]/page.tsx`

### Next.js Pages Router

- No client directive needed
- Standard React component structure
- Page file location: `src/pages/[page].tsx`

### Vite React

- No client directive needed
- Configure path aliases in `vite.config.ts`:

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

---

## Input-Specific Guidelines

### Screenshot Best Practices

- **Resolutie:** Minimaal 800px breed, bij voorkeur 1440px+ voor desktop designs
- **Format:** PNG preferred (lossless), JPG acceptable
- **Content:** Volledige pagina screenshot, geen cropped secties
- **Annotaties:** Geen annotaties of markup op het design (clean screenshot)
- **Retina:** 2x screenshots worden correct geinterpreteerd

**Beperkingen van screenshot input:**
- Kleuren zijn een schatting (color space, gamma correctie)
- Font identificatie is een best-guess (sans-serif, serif, mono)
- Exacte pixel spacing is niet gegarandeerd
- Hover/active states zijn niet zichtbaar tenzij getoond
- Content tekst moet handmatig worden overgenomen

### HTML Best Practices

- **Encoding:** UTF-8 preferred
- **CSS:** Inline of embedded preferred (external links worden gefetcht)
- **Assets:** Relatieve paden worden geresolved t.o.v. het HTML bestand
- **JavaScript:** Wordt genegeerd (alleen visuele structuur relevant)
- **Frameworks:** Webflow, Bootstrap, Tailwind HTML worden herkend

**Voordelen van HTML input:**
- Exacte kleuren en fonts (uit CSS)
- Precise spacing waarden
- Hover/active states uit CSS :hover/:active
- Responsive breakpoints uit media queries
- Component structuur uit semantic HTML

### URL Best Practices

- **Publiek:** URL moet zonder authenticatie bereikbaar zijn
- **Performance:** Pagina moet binnen 10 seconden laden
- **JavaScript:** Client-side rendered content wordt meegenomen via Playwright
- **Responsive:** Desktop viewport (1440px) wordt standaard gebruikt

**Voordelen van URL input:**
- Meest complete informatie (HTML + CSS + computed styles)
- Live interactie states detecteerbaar
- Responsive behavior zichtbaar
- Exacte design tokens uit computed styles

---

## Notes

- Design CSS waarden worden DIRECT vertaald naar Tailwind classes -- geen tussenlaag
- Tailwind classes worden direct in components toegepast -- geen separate CSS files
- Use `cn()` helper voor conditional classes en merging
- Keep components focused: split als >100 regels
- Compound components houden gerelateerde UI samen
- Alle components accepteren `className` prop voor overrides
- Generated code is een starting point -- expect refinement
- Bij screenshot input: kleuren en fonts zijn schattingen, review is extra belangrijk
- Bij HTML input: exacte waarden beschikbaar, hogere fidelity
- Bij URL input: meest complete data, maar afhankelijk van site beschikbaarheid
- Design tokens worden opgeslagen in Tailwind config, NIET in aparte CSS variabelen

---
