# Code Conventions (shared: greenfield Phase 7d / mature PHASE 4.6)

Elicit per-project code conventions and write `.project/conventions.md`. Canonical format, state table, and load rules: [shared/CONVENTIONS.md](../../shared/CONVENTIONS.md).

## Parameters

The caller's transition marker supplies:

- `variant`: `greenfield` | `mature`

## Skip-Guard (both variants)

```bash
CONV_STATUS=$(head -1 .project/conventions.md 2>/dev/null | sed -n 's/.*conventions-status: \([a-z]*\).*/\1/p')
```

If `.project/conventions.md` exists (any status) → log `Conventions: already decided ({CONV_STATUS}) — skipped` and return to the caller's next phase. The earlier choice — including the explicit "none" sentinel — is persistent; never re-ask.

Before writing in either variant: `mkdir -p .project` (defensive — greenfield Phase 7b normally created it already).

---

## Variant: mature

1. **Discovery scan** over the sources in CONVENTIONS.md § Discovery Sources (`eslint.config.*`, `.eslintrc*`, `.prettierrc*`, `biome.json(c)`, `.editorconfig`, `CONTRIBUTING.md`, `STYLE.md`, `docs/STYLEGUIDE*`). Distill candidate rules: only non-default, opinionated rules — lint configs are signals to distill, not content to copy. Skip rules that repeat `shared/CODING-RULES.md` / `FRONTEND-RULES.md`.

2. **Confirm candidates** — AskUserQuestion:

   ```yaml
   header: "Conventions"
   question: "Found {N} convention candidates in {sources}. Which should become project conventions?"
   options:
     - label: "All candidates (Recommended)"
       description: "{1-line summary of the distilled set}"
     - label: "{candidate group 2}" # split candidates into selectable groups when N > ~6
       description: "..."
     - label: "No project conventions"
       description: "Global rules suffice — writes the persistent 'none' sentinel, never asked again"
   multiSelect: true
   ```

   If discovery found **nothing**: skip this question and run the greenfield single question instead (below).

3. **One anchored open question** per [shared/QUESTIONING.md](../../shared/QUESTIONING.md) — anchor in what discovery found: _"Your eslint config enforces {X} — are there house-style rules the configs don't capture: naming, file structure, error-handling style, or something else?"_ One question, no stacking; "no" / "I don't know" → proceed with confirmed candidates only.

4. **Write** `.project/conventions.md`:
   - "No project conventions" chosen → sentinel file (CONVENTIONS.md § File Format)
   - Otherwise → `set` file with `<!-- source: distilled from {sources} -->`, sections Naming / Structure / Style, max ~120 lines

## Variant: greenfield

No codebase to scan. Single AskUserQuestion:

```yaml
header: "Conventions"
question: "Does this project follow a company/team style guide or personal code conventions?"
options:
  - label: "No conventions yet (Recommended)"
    description: "Global rules (CODING-RULES.md / FRONTEND-RULES.md) suffice — writes the persistent 'none' sentinel"
  - label: "Paste a style guide"
    description: "Paste or point to a company/team style guide — distilled to ≤120 lines"
  - label: "Answer 3 short questions"
    description: "Mini-interview: naming, structure, style preferences"
multiSelect: false
```

- **"No conventions yet"** → write the sentinel file.
- **"Paste a style guide"** → user pastes text or a path/URL; distill to ≤120 lines (only rules that differ from or specialize the global rule files), write `set` with `<!-- source: pasted -->`.
- **"Answer 3 short questions"** → mini-interview per [shared/QUESTIONING.md](../../shared/QUESTIONING.md): one anchored open question each for **naming** (files, components, variables), **structure** (file/folder organization, co-location), **style** (exports, error handling, comments). Escalation ladder applies — 2nd "I don't know" on a topic → switch to AskUserQuestion with hypotheses; unresolved topics are simply omitted from the file. Write `set` with `<!-- source: interview -->`.

---

**Output** (both variants): one log line — `Conventions: written (set, {N} rules)` | `Conventions: none (sentinel written)` | `Conventions: already decided ({status}) — skipped`. Then return to the caller's next phase.
