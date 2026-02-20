# Frontend Build — Reference Appendix

Detailed reference material for the frontend-build skill.
Extracted from SKILL.md for progressive disclosure (Anthropic skill spec).

---

## Output Structure

```
.workspace/wireframes/[page]/hifi/
├── preview.html              # Progressieve high-fi preview (alle components)
├── components.json           # Component lijst met status tracking

src/pages/[page].tsx            # DE werkende pagina (of app/[page]/page.tsx)

src/components/[page]/
├── index.ts                  # Barrel exports
│
├── organisms/
│   ├── Header/
│   │   ├── Header.tsx
│   │   └── Header.types.ts
│   └── Sidebar/
│       └── ...
│
├── molecules/
│   ├── Navigation/
│   ├── MetricCard/
│   └── UserMenu/
│
└── atoms/
    ├── Button/
    ├── Badge/
    └── NavLink/

src/lib/
└── utils.ts                  # cn() helper

tailwind.config.js            # Extended with theme
```

---

## Error Recovery

### Theme Parse Failure

```
RECOVERY: Theme Parse
─────────────────────
1. Show parse error location in THEME.md
2. Offer to fix syntax
3. Fallback: use Tailwind defaults for .hf-* classes
```

### Wireframe Parse Failure

```
RECOVERY: Wireframe Parse
─────────────────────────
1. Show invalid HTML location
2. Try alternate wireframe (refined.html, agent-a/v2.html)
3. Fallback: manual component list input
```

### High-Fi Preview Failure

```
RECOVERY: Preview
─────────────────
1. Check .hf-* class system intact
2. Verify CSS variables present
3. Regenerate preview.html from final.html
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
3. Flag complex errors for manual fix
```

### Component Generation Failure

```
RECOVERY: Generation
────────────────────
1. Keep high-fi preview (visual approval staat)
2. Retry React generation
3. Fallback: output alleen .tsx (skip page placement, handmatig importeren)
```

---

## DevInfo Integration

### Session Update

Update devinfo at each phase transition:

```json
{
  "currentSkill": {
    "name": "frontend-build",
    "phase": "COMPONENT_LOOP",
    "startedAt": "ISO timestamp"
  },
  "progress": {
    "completedTasks": 4,
    "totalTasks": 11,
    "currentTask": "Creating Avatar component"
  },
  "files": {
    "created": [
      { "path": "src/components/dashboard/atoms/Button/Button.tsx", "skill": "frontend-build" },
      { "path": ".workspace/wireframes/dashboard/hifi/preview.html", "skill": "frontend-build" }
    ]
  }
}
```

### Workflow Completion

```json
{
  "workflow": {
    "name": "frontend-pipeline",
    "status": "completed",
    "completedAt": "ISO timestamp"
  },
  "handoff": {
    "from": "frontend-build",
    "to": null,
    "data": {
      "summary": "8 components created for dashboard (3 skipped)",
      "hifiPreview": ".workspace/wireframes/dashboard/hifi/preview.html",
      "pageFile": "src/pages/dashboard.tsx",
      "outputDirectory": "src/components/dashboard/",
      "tailwindExtended": true
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

### Next.js Pages Router

- No client directive needed
- Standard React component structure

### Vite React

- No client directive needed
- Configure path aliases in `vite.config.ts`

---

## Notes

- Tailwind classes are applied directly in components — no separate CSS files
- Use `cn()` helper for conditional classes and merging
- Keep components focused: split if >100 lines
- Compound components keep related UI together
- All components accept `className` prop for overrides
- Generated code is a starting point — expect refinement
- De `.hf-*` classes in de HTML preview zijn een benadering van Tailwind — de React output gebruikt echte Tailwind classes
- De preview pagina behoudt edit mode uit de wireframe template — components zijn draggable/editable

---
