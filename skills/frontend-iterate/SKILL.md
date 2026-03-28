---
name: frontend-iterate
description: Iterative browser-based development with inspect overlay. Injects element inspector into dev server (Vite or Next.js) for visual element-picking. Paste reference in chat for targeted edits with live HMR. Use with /frontend-iterate.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 2.7.0
  category: frontend
---

# Frontend Iterate

User clicks elements in browser, copies a reference, pastes in chat. Claude makes targeted edits with live HMR feedback.

## References

- `references/inspect-overlay-plugin.ts` — Vite plugin
- `references/inspect-overlay-client.js` — Universal vanilla JS overlay (Vite + Next.js)
- `references/setup-guide.md` — Installation instructions (loaded on-demand)
- `../shared/DESIGN.md` — Anti-patterns, color, typography, motion

## FASE 1: Pre-flight

### 1.1 Framework & Overlay Detection

Check `package.json` dependencies:

- `next` present → **Next.js**
- `vite` present → **Vite**
- Neither → abort: "Only Vite and Next.js projects are supported."

Check styling approach:

- `tailwindcss` in dependencies → **Tailwind** (class: line = utility classes)
- Otherwise → **Non-Tailwind** (class: line may not contain utilities, rely on file context for edits)

Check overlay installed:

- **Vite**: Grep `vite.config` for `inspectOverlay`
- **Next.js**: Check for `inspect-overlay-client.js` in `public/_inspect/`

**Not found → install:**

```
Read("references/setup-guide.md")
```

Follow the setup guide, then continue to 1.2.

### 1.2 Context Loading

Load project context for informed edits:

- **Theme** (optional): Read `.project/config/THEME.md` if it exists
  - Provides design tokens, color palette, typography scale, spacing system
  - Used to validate edits against the design system
  - If not found: no problem, rely on `class:` from clipboard

Report and enter iterate mode:

```
✓ Iterate mode actief.
  Theme: {loaded from THEME.md | not available}
  Styling: {Tailwind | Non-Tailwind}
  Plak referenties of beschrijf wijzigingen.
```

## FASE 2: Iterate

Respond to user input in three patterns.

### Pattern A: Rich Clipboard Pasted

User pastes clipboard output from overlay click:

```
src/components/Header.tsx:10:4
  class: flex items-center gap-4 px-6
  size: 1200 x 64 @1440w
  parent: flex row, gap 16px, 4 children
  font: 16px/1.5 Inter
  color: #1a1a1a
```

Or multi-select with `--- 1/N ---` separators (from Shift+click pins).

**Parsing priority:**

1. **File reference** (first line) — two formats:
   - **Full mode**: `src/components/Header.tsx:10:4` → read file at that line ±30 lines context
   - **Degraded mode**: `div.flex.items-center "Header Text"` (no `/` or `:line`) → grep for a unique segment of the `class:` line (pick 4+ consecutive classes), confirm match with the text content from the first line
2. **`class:` line is the source of truth** — use existing utility classes to understand the element. Edit by modifying these classes, not by writing new arbitrary values
3. **Computed styles** (`font:`, `color:`, `size:`) — use as verification of what classes do, not as values to hardcode. Map back to utility classes: `color: #737373` means `text-neutral-500` is active, don't write `text-[#737373]`
4. **`size:` + viewport** — map `@{width}w` to Tailwind breakpoint:
   `<640` = default (mobile-first), `≥640` = sm:, `≥768` = md:, `≥1024` = lg:, `≥1280` = xl:, `≥1536` = 2xl:
   Apply edits to the matching breakpoint prefix. E.g., captured at `@1440w` → changes apply at `xl:` or lower
5. **`parent:` context** — layout type, gap, and child count of the parent container. Use to choose the right edit approach: flex → gap/flex-basis, grid → col-span/grid-template, block → width/max-width/padding

**Workflow:**

1. Parse clipboard, locate file (full mode: read at line; degraded mode: grep to find file)
2. If clipboard pasted WITHOUT instruction: echo understanding first — element type, file location, active breakpoint. E.g., "Header.tsx:10 — flex container, xl breakpoint." If clipboard + instruction in same message: proceed directly to edit.
3. Make targeted edit using existing class patterns
4. Report: filepath, line, what changed

For multi-select: apply instruction across all referenced elements sequentially.

### Pattern B: File Reference Only

User pastes `src/components/Header.tsx:10` (or with column) without style context.

1. Read file, focus on referenced line ±30 lines context
2. Wait for instruction
3. Make targeted edit
4. Report: filepath, line, what changed

### Pattern C: Description Without Reference

User describes an element (e.g., "make the header background darker").

1. **Locate element** — try in order:
   a. Grep component files for keywords from the description (e.g., "header" → `Header`, `header`, `<header`)
   b. If 0 or too many matches: use `browser_snapshot` to find the element in the DOM, extract class names or text content, then grep for those
2. If ambiguous (2+ candidate files) — show matches and ask user to pick
3. Read matched file, find the element by class/text context
4. Wait for instruction
5. Make targeted edit, report: filepath, line, what changed

### Guidelines

- **`class:` over computed values** — always prefer existing utility classes over hardcoded values.
- **Theme-aware** — if THEME.md is loaded, use its tokens for new values (e.g., use `text-primary` over `text-blue-500` if the theme defines primary).
- **Viewport-aware** — scope edits to the captured breakpoint prefix from `@{width}w`. Edit at `@1440w` → modify `xl:` or lower prefixed classes. Only edit unprefixed (base) classes when the user explicitly targets all screen sizes. This prevents desktop edits from breaking mobile.
- **Responsive conflict check** — after layout edits (flex, grid, width, gap, padding), scan the element's existing classes for other breakpoint variants of the same property. If the edit conflicts (e.g., adding `xl:gap-6` when `md:gap-8` already exists), warn before applying.
- **Layout-context aware** — use `parent:` line to choose the right edit approach for size/spacing. Don't guess — the layout type determines the tool: flex → gap/flex-basis, grid → col-span/grid-template, block → width/max-width/padding.
- Minimal, targeted edits. No surrounding refactors.
- One instruction at a time. Multi-select: apply the same instruction across all pinned elements. Different instructions on different elements → sequential.
- Trust HMR for cosmetic edits. For layout edits, use Smart Verification (see below).
- New reference pasted → new iteration immediately.
- **Smart Verification** — after applying an edit, autonomously decide whether to verify with `browser_snapshot`:

  **Auto-verify** (layout/structure edits where the visual result is unpredictable):
  - Flex/grid structure changes (`flex-direction`, `grid-template`, `grid-cols`, `order`, `flex-wrap`)
  - Adding, removing, or reordering DOM elements
  - Width/height changes that cause reflow (`w-full` → `w-1/2`, responsive widths)
  - Multiple breakpoint edits in one pass
  - Position changes (`relative` → `absolute`, `sticky`, `fixed`)
  - Display changes (`hidden` → `block`, `flex` → `grid`)

  **Skip verification** (cosmetic edits where HMR feedback is sufficient):
  - Color, background, border, shadow, opacity
  - Font-size, font-weight, letter-spacing, line-height
  - Padding, margin, gap (unless layout-breaking)
  - Rounding, text-align, cursor
  - Text content changes

  **Verification flow** (when triggered):
  1. `browser_snapshot` → analyze accessibility tree
  2. Check: is the element still present? Is the structure intact? Are sibling elements unaffected?
  3. Report inline: `✓ Layout verified — [element] intact at [location]` or `⚠ Layout issue — [description of problem]`
  4. On issue: propose fix immediately

  No `browser_take_screenshot` (too heavy for iteration speed). No pre-flight (browser already open via dev server + HMR). Snapshot only — fast structural check.

- "done" or "klaar" → acknowledge and show context-aware next steps:

  ```
  Iterate sessie afgesloten.

  Volgende stappen:
  - /frontend-wcag → accessibility audit
  - /frontend-audit → performance optimalisatie
  [Als structurele layout-wijzigingen gemaakt (secties verplaatst, grid gewijzigd):]
  - /thinking-brainstorm page:{page} → verken alternatieve layouts
  - /thinking-critique page:{page} → analyseer UX keuzes
  [Als elementen met lege handlers opgemerkt:]
  - /dev-define {feature} → definieer ontbrekende functionaliteit
  ```
