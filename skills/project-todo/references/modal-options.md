# Project Todo — Modal Option Templates

Static AskUserQuestion option sets for PHASE 1b (Priority + Category/Type) and PHASE 1c (Web Type). The decision logic — when to ask which question — lives in SKILL.md; this file only holds the reusable templates.

---

## Priority

Used by: batch flow (question 1, applies to all items), WEB single-item (question 1), GAME single-item (question 1). Adjust the question wording to context: batch → "What priority does this batch of items have?", game → "What priority does this feature have?".

```yaml
header: "Priority"
question: "What priority does this item have?"
options:
  - label: "P1 (Recommended)", description: "Highest priority"
  - label: "P2", description: "Important but not blocking"
  - label: "P3", description: "When there's time"
  - label: "P4", description: "Park for later"
multiSelect: false
```

## Category — WEB

Used by: WEB single-item (question 2, same AskUserQuestion call as Priority).

```yaml
header: "Category"
question: "Which category fits best?"
options:
  - label: "Dev (Recommended)", description: "Backend, API, logic, data, bugs, refactor"
  - label: "Design", description: "Pages and components"
  - label: "Design & Quality", description: "Tokens, accessibility, performance, missing page functionality"
multiSelect: false
```

## Type — GAME

Used by: GAME single-item (second AskUserQuestion call) and batch-flow type questions in GAME MODE.

```yaml
header: "Type"
question: "What type of item is this?"
options:
  - label: "MECHANIC (Recommended)", description: "New gameplay mechanic (ability, movement, combat)"
  - label: "SYSTEM", description: "Supporting system (spawning, scoring, saving)"
  - label: "CONTENT", description: "Levels, enemies, items, dialogue"
  - label: "POLISH", description: "Juice, particles, screen shake, sound"
  - label: "UI", description: "HUD, menus, feedback indicators"
multiSelect: false
```

## Type — WEB · Dev category

```yaml
header: "Type"
question: "What type of item is this?"
options:
  - label: "FEATURE (Recommended)", description: "New functionality"
  - label: "CHANGE", description: "Modification to existing functionality"
  - label: "BUG", description: "Bug fix or correction"
  - label: "API", description: "Backend endpoint or service"
multiSelect: false
```

## Type — WEB · Design category

```yaml
header: "Type"
question: "Which design entity?"
options:
  - label: "PAGE (Recommended)", description: "New page/route — lands on Design track ('To design')"
  - label: "COMPONENT", description: "Reusable UI component — lands on Design track"
  - label: "PAGE-GAP", description: "Missing functionality on existing page — lands on Dev track"
multiSelect: false
```

## Type — WEB · Design & Quality category

```yaml
header: "Type"
question: "What type of design/quality item is this?"
options:
  - label: "THEME (Recommended)", description: "Design tokens — colors, typography, spacing via /design-tokens"
  - label: "A11Y", description: "Accessibility improvement via /design-check --scope=a11y"
  - label: "PERF", description: "Performance or SEO optimization via /design-check"
multiSelect: false
```
