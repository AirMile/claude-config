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
3. **Component scan**: grep component files for:
   - Hardcoded color values: `#hex`, `rgb()`, `hsl()`, `bg-[#`, `text-[#`
   - Theme token usage: `bg-primary`, `text-accent`, `var(--`, theme class references
   - Hardcoded spacing: `p-[16px]`, `gap-[24px]`, arbitrary Tailwind values
   - **On Updates:** also scan for OLD token values from the X.6 diff. If a color changed from `#C89B3C` to `#0AC8B9`, scan for remaining `#C89B3C` references in component files and arbitrary Tailwind values (`bg-[#C89B3C]`, `shadow-[...rgba(200,155,60,...)]`, etc.)

**Tally results:**

```
WEBSITE SYNC CHECK
════════════════════════════════════════════════
Files scanned:         {N}
Theme integration:     {Tailwind config | CSS vars | None}
Hardcoded colors:      {N} files, {M} values
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
question: "There are {N} files with hardcoded colors/styling that don't use the theme. Would you like to restyle?"
options:
  - label: "Yes, restyle all (Recommended)", description: "Replace hardcoded values with theme tokens in all {N} files"
  - label: "Extract as theme", description: "Formalize existing colors/values as theme tokens (reverse sync)"
  - label: "Show files", description: "View which files are affected before deciding"
  - label: "No, save theme only", description: "Skip — manual later"
multiSelect: false
```

**If "Extract as theme":** Run the Extract route (PHASE 2 → Route: Extract) to parse existing hardcoded color/spacing values from component files as theme tokens. After extraction, merge into `project.json#theme` (existing tokens take priority, extracted values fill gaps), re-run Theme Infrastructure Sync (X.6). This formalizes existing design choices rather than overwriting them.

**If "Show files":** Show file list with hardcoded value count per file, then re-ask with "Yes, restyle all" / "Select specific" / "No" options.

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

**Step 1: Replace hardcoded values**

Per component file, replace hardcoded values with theme tokens:

| Hardcoded              | → Theme Token          |
| ---------------------- | ---------------------- |
| `bg-[#3B82F6]`         | `bg-primary`           |
| `text-[#1a1a2e]`       | `text-foreground`      |
| `p-[16px]`             | `p-4`                  |
| `gap-[32px]`           | `gap-8`                |
| `#hex` in inline style | `var(--color-primary)` |

Map each hardcoded value to the closest theme token by color distance / value match.

**Step 2: Verification**

After restyle, quick scan for remaining hardcoded values. Report count.

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

Remaining:            {R} hardcoded values (manual review recommended)
════════════════════════════════════════════════
```
