# Frontend Compose — Reference Appendix

Detailed reference material for the frontend-compose skill.
Extracted from SKILL.md for progressive disclosure (Anthropic skill spec).

---

## Output Structure

```
.workspace/
└── wireframes/
    └── [page-name]/
        ├── requirements.md              # Verzamelde requirements + project context
        ├── agent-a/
        │   ├── v1.html
        │   ├── v1-screenshot.png        # Playwright screenshot
        │   ├── v1-snapshot.md           # Accessibility tree
        │   ├── v2.html
        │   ├── v2-screenshot.png
        │   └── v2-snapshot.md
        ├── agent-b/
        │   ├── v1.html
        │   ├── v1-screenshot.png
        │   ├── v1-snapshot.md
        │   ├── v2.html
        │   ├── v2-screenshot.png
        │   └── v2-snapshot.md
        ├── refined/
        │   ├── refined.html             # Auto-combined best elements
        │   ├── refined-screenshot.png   # Initial refined screenshot
        │   ├── refined-snapshot.md      # Accessibility tree
        │   ├── iteration-1.png          # After first tweak (if any)
        │   ├── iteration-2.png          # After second tweak (if any)
        │   └── ...                      # Additional iterations
        ├── final.html                   # Final wireframe (handoff to /build)
        ├── final-screenshot.png         # Final wireframe screenshot
        └── storybook/                   # Optional
            └── components.md
```

---

## Error Recovery

> Zie ook: `skills/shared/VALIDATION.md` voor algemene patterns.

### Agent Failures

| Failure               | Recovery                                   |
| --------------------- | ------------------------------------------ |
| 1 agent timeout       | Retry that agent only                      |
| Both agents timeout   | Fall back to single sequential agent       |
| Task tool unavailable | Single agent makes 2 variants sequentially |

### Output Failures

| Failure            | Recovery                              |
| ------------------ | ------------------------------------- |
| Empty file         | Retry agent with verbose prompt       |
| Invalid HTML       | Parse error, fix common issues, retry |
| Missing navigation | Re-apply template, keep content       |
| Theme not applied  | Re-inject CSS variables               |

### Graceful Degradation Sequence

```
Level 1: 2 parallel agents, 2 rounds + refine → 5 wireframes (default)
Level 2: 2 sequential agents, 2 rounds + refine → 5 wireframes
Level 3: 1 agent, 2 variants, 1 round + refine → 3 wireframes
Level 4: 1 agent, 2 variants sequential → 2 wireframes
Level 5: Template only, user fills in → 1 template
```

**Always preserve:** Any successfully generated wireframes.

> **Note:** Rollback wordt afgehandeld door Claude Code's ingebouwde "Rewind" functie.

---

## DevInfo Integration

> Zie ook: `skills/shared/DEVINFO.md`

### Session Updates

Update devinfo at each phase:

- `PREFLIGHT` → session started
- `FASE1` → requirements captured (including project context)
- `FASE2` → files created (v1)
- `FASE3` → reflection complete
- `FASE4` → files created (v2)
- `FASE5` → refined version created
- `FASE6` → user review complete
- `COMPLETE` → handoff ready

### Completion Handoff

```json
{
  "handoff": {
    "from": "frontend-compose",
    "to": "frontend-build",
    "data": {
      "selectedWireframe": ".workspace/wireframes/[page]/final.html",
      "finalScreenshot": ".workspace/wireframes/[page]/final-screenshot.png",
      "refinement": {
        "iterations": 3,
        "basis": "agent-a/v2",
        "combinedElements": {
          "header": "agent-b/v2",
          "contentGrid": "agent-a/v2",
          "footer": "agent-b/v1"
        }
      },
      "atomicLevel": "organism",
      "platform": "desktop",
      "components": [
        { "name": "Header", "atomic": "organism" },
        { "name": "MetricCard", "atomic": "molecule" }
      ],
      "themeApplied": true,
      "themeFile": ".workspace/config/THEME.md",
      "projectContext": {
        "framework": "Next.js 14",
        "uiLibrary": "Tailwind CSS",
        "existingComponents": ["Button", "Card", "Header"]
      }
    }
  }
}
```

---

## Cross-Skill Integration

### Input Contract (wireframe ← theme)

Expects from /theme (if theme integration selected):

- `.workspace/config/THEME.md` exists
- CSS export section valid
- Handoff data in devinfo

### Output Contract (wireframe → style)

Guarantees at completion:

- `.workspace/wireframes/[page]/final.html` exists (refined wireframe)
- `.workspace/wireframes/[page]/final-screenshot.png` exists
- All 4 wireframe variants preserved in agent folders (agent-a/, agent-b/)
- Refined version at `refined/refined.html`
- Contains data-component, data-variant, data-atomic attributes
- Navigation links functional (including Refined link)
- Handoff data in devinfo with refinement history and project context

### Suggested Next

```
✅ WIREFRAMES COMPLETE

Refined: User-selected elements from 4 variants
Components: [N] identified
Atomic level: [level]

Next suggested: /build [page]
```

---

## Wireframe Styling Guidelines

Gebruik ALLEEN low-fidelity grayscale (of theme tokens als geselecteerd):

**Grayscale defaults:**

- Achtergronden: #f5f5f5, #fafafa, #e0e0e0
- Borders: #999, #aaa, #bbb, #ccc
- Tekst: #333, #666, #888
- Selected/Active: #888 bg, #fff text
- Placeholder images: solid #ddd

---

## Edit Mode Features

Alle wireframes bevatten een ingebouwde Edit Mode met de volgende features:

**Sub-modes:**

- **Layout mode** (blauw): Drag componenten om te verplaatsen, resize vanuit randen (interact.js edge detection, margin 20px)
- **Text mode** (oranje): Klik op tekst elementen om direct te bewerken (contenteditable)

**Toolbar knoppen:**

- **+ Add**: Voeg een nieuw component toe via click-to-place (crosshair cursor, Esc om te annuleren)
- **Undo**: Herstel laatste actie (ook via Ctrl+Z / Cmd+Z). Snapshot-based, max 20 stappen
- **Redo**: Herstel ongedaan gemaakte actie (Ctrl+Shift+Z / Ctrl+Y / Cmd+Shift+Z). Nieuwe acties wissen redo history
- **Download HTML**: Exporteert schone HTML (stript transform, data-x/y, inline resize styles)
- **Reset**: Herlaad de originele wireframe

**Delete component:** Elk component heeft een × knop op de edit handle (alleen zichtbaar in Layout mode). Vraagt om bevestiging.

**Beperkingen:**

- Undo/Redo werkt alleen voor Layout-acties (drag, resize, add, delete) — niet voor tekst edits
- Maximaal 20 undo stappen
- Nieuwe acties wissen de redo stack (branch invalidation)
- Bij "Reset" gaat alle undo/redo history verloren

---

## Resources

- `skills/frontend-compose/references/html-template.html` - Single-view template
- `skills/frontend-compose/references/html-template-responsive.html` - **Dual-view responsive template (recommended)**
- `skills/frontend-compose/references/mobile-patterns.md` - Mobile patterns
- `skills/frontend-compose/references/desktop-patterns.md` - Desktop patterns
- `skills/frontend-compose/references/page-types.md` - Page type patterns
- `skills/shared/VALIDATION.md` - Validation templates
- `skills/shared/DEVINFO.md` - Session tracking
- `skills/shared/RULES.md` - Coding standards (H002, H006)

---
