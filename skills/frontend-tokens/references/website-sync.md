# PHASE Y: Website Sync (Create/Update only)

**After post-flight validation, check if existing website code uses the theme.**

Skip this phase entirely for View, Delete, or when no website code exists.

## Y.1 Scan for Website Code

```bash
# Glob for frontend source files
# src/**/*.{tsx,jsx,astro,vue}, app/**/*.{tsx,jsx}, *.html
```

- **No source files found** → skip with: `"No website code found — theme saved."` → proceed to Output Format
- **Source files found** → continue to Y.2

## Y.2 Theme Usage Analysis

Scan the codebase for theme integration:

1. **Tailwind config**: check `tailwind.config` for custom theme extensions matching project.json tokens
2. **CSS variables**: grep CSS files for `:root` blocks with CSS custom properties
3. **Component scan**: run T101-T111 from `shared/TOKENS.md § Anti-Hardcoding Violations` against all source files. Also check for theme token usage: `bg-primary`, `text-accent`, `var(--`, theme class references.
   - **On Updates:** additionally scan for OLD token values from the X.6 diff (e.g. if a color changed from `#C89B3C` to `#0AC8B9`, scan for remaining `#C89B3C` in arbitrary Tailwind values like `bg-[#C89B3C]`, `shadow-[...rgba(200,155,60,...)]`) — this is Update-specific and not part of canonical T101-T111.

**Tally results:**

```
WEBSITE SYNC CHECK
════════════════════════════════════════════════
Files scanned:         {N}
Theme integration:     {Tailwind config | CSS vars | None}
Color violations:      [T101-T103, T105 — N findings | clean]
Spacing violations:    [T104 — N findings | clean]
Motion literals:       [T106-T107 — N findings | clean]
Glass-without-flag:    [T108 — N findings | clean]
Typography:            [T109 — N findings | clean]
Radius:                [T110 — N findings | clean]
Shadow:                [T111 — N findings | clean]
Old values found:      {N} files, {M} references (on updates)
Theme token usage:     {N} files, {M} references
════════════════════════════════════════════════
```

## Y.3 Sync Decision

**If code already uses theme correctly** (hardcoded count ≤ 3 AND theme tokens present):

```
✓ Theme in sync — website already uses design tokens.
```

→ Proceed to Output Format.

**If code has hardcoded values** (hardcoded count > 3 OR no theme token usage):

**AskUserQuestion:**

```yaml
header: "Website Sync"
question: "There are {N} files with hardcoded colors/styling that don't use the theme. How do you want to sync?"
options:
  - label: "Full conversion — 100% (Recommended)", description: "Convert every hardcoded value to a theme token. Values that must stay hardcoded (e.g. white icon on a gradient) are listed as explicit exceptions, not skipped silently. Uses plan-mode review before any edits."
  - label: "Best-effort restyle", description: "Replace the obvious hardcoded values across {N} files; leftover drift is reported but not guaranteed to be zero"
  - label: "Extract as theme", description: "Formalize existing colors/values as theme tokens (reverse sync)"
  - label: "No, save theme only", description: "Skip — manual later"
multiSelect: false
```

"Full conversion" continues to the plan-mode gate in Y.4.
"Best-effort restyle" goes directly to edits (old behaviour).
"Show files" is no longer a standalone option — file-level detail is visible in the Full conversion plan-mode review before any edit runs.

**If "Extract as theme":** Run the Extract route (PHASE 2 → Route: Extract) to parse existing hardcoded color/spacing values from component files as theme tokens. After extraction, merge into `project.json#theme` (existing tokens take priority, extracted values fill gaps), re-run Theme Infrastructure Sync (X.6). This formalizes existing design choices rather than overwriting them.

## Y.3.5 Open Worktree Guard

Website Sync modifies component files on main (codebase-mode, no single feature-name). Check for open feature worktrees that could conflict:

```bash
git worktree list --porcelain | grep "^branch " | grep "refs/heads/worktree-"
```

If any `worktree-*` branches appear → **AskUserQuestion**:

```yaml
header: "Open worktrees"
question: "Open worktrees found: {list}. Website Sync modifies component files on main — this may create merge conflicts when these branches are integrated. What do you want to do?"
options:
  - label: "Stop — merge open worktrees first (Recommended)"
    description: "Run /core-finalize for each open worktree, then re-run token sync"
  - label: "Continue anyway"
    description: "Modify component files on main now — you accept potential merge conflicts later"
multiSelect: false
```

No open worktrees → proceed to Y.4.

## Y.4 Restyle Execution (if approved)

### Best-effort restyle

Per component file, replace hardcoded values with theme tokens using `shared/TOKENS.md § Token → Class Mapping`. Quick reference:

| Hardcoded                 | → Theme Token          |
| ------------------------- | ---------------------- |
| `bg-[#3B82F6]`            | `bg-primary`           |
| `text-[#1a1a2e]`          | `text-foreground`      |
| `p-[16px]`                | `p-4`                  |
| `gap-[32px]`              | `gap-8`                |
| `#hex` in inline style    | `var(--color-primary)` |
| `text-[14px]`             | `text-sm`              |
| `rounded-[8px]`           | `rounded-md`           |
| `shadow-[0_4px_12px_...]` | `shadow-md`            |

For the full mapping table (including typography, radius, shadow, and motion tokens), see `shared/TOKENS.md § Token → Class Mapping`. Map each hardcoded value to the closest token by color distance / value match. After restyle, quick scan for remaining hardcoded values. Report count.

### Full conversion (100%) — plan-mode gate

1. **Enumerate** — list every hardcoded value across the affected files (T101-T111 hits), one row per occurrence: `file:line · current value · proposed token`.
2. **Classify** each row:
   - `convert` → maps to a theme token (use `shared/TOKENS.md § Token → Class Mapping`)
   - `exception` → must stay hardcoded; record the reason (e.g. "white icon on gradient bg — token would reduce contrast"). Exceptions form the allowlist.
3. **Plan-mode review** — call EnterPlanMode, present the convert-list and the exception allowlist as the plan, call ExitPlanMode for single-shot approval. The user sees and approves both lists before any edit runs.
4. **Apply** — after approval, edit each `convert` row to its theme token. Leave `exception` rows untouched.

### Verification (Full conversion)

Re-run the T101-T111 scan. The sync is complete only when **every remaining hardcoded value is on the exception allowlist** from step 2. Any unlisted drift → return to the classify step for those rows (convert or justify as a new exception). Report: converted count · allowlisted exceptions (with reasons) · unlisted drift (must be 0).

## Y.5 Restyle Report

```
WEBSITE SYNC
════════════════════════════════════════════════
Files scanned:    {N}
Files restyled:   {M}
Replacements:     {X} hardcoded values → theme tokens

Changed files:
  ✓ {file} — {N} colors restyled
  ✓ {file} — {N} colors + spacing
  ✓ tailwind.config.ts — theme extension added/updated

Exceptions (allowlist): {E} intentional (with reasons)
Remaining:            {R} hardcoded values (manual review recommended)
════════════════════════════════════════════════
```
