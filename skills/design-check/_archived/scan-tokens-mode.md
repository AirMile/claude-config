# 1.10 Token Architecture Scan + 1.11 Dark Mode Compliance + 1.12 Responsive Coverage

## 1.10 Token Architecture Scan

Only if "Token Architecture" is selected. Static code analysis — no Playwright required.

**Step 1: Project.json check**

```bash
# Read .project/project.json → check theme section
```

Three states:

- **`.project/project.json` missing**: stop with `"No project workspace found — run /core-setup first."` Skip all sub-checks.
- **`project.json` present, `theme` empty**: T101-T108 still run against source files. Reason: `shared/TOKENS.md § Fallback Values` defines fallback CSS vars that `dev-build` also uses on empty-theme projects — hardcoded values are therefore still violations. Skip TA001 only (requires semantic CSS vars). Show: `"Theme empty — auditing against fallback tokens (TA001 skipped, requires project theme)."`
- **`theme` populated**: all checks run (T101-T108 + TA001). Continue.

**Step 2: Anti-Hardcoding Violations scan (T101-T111)**

See `shared/TOKENS.md § Anti-Hardcoding Violations` for the canonical rule table (T101-T111) and `§ Token → Class Mapping` for fix suggestions.

Run each pattern against `.tsx`, `.jsx`, `.vue`, `.svelte`, `.css`, `.scss` (skip test files, JSON, config files — per `shared/TOKENS.md` check scope):

| Rule | Grep pattern                                                                   | Files        |
| ---- | ------------------------------------------------------------------------------ | ------------ |
| T101 | `#[0-9a-fA-F]{3,8}` in className/JSX/CSS                                       | source + CSS |
| T102 | `bg-\[#`, `text-\[#`, `border-\[#`                                             | source       |
| T103 | `style=\{\{.*color.*#`                                                         | source       |
| T104 | `[pmg]-\[\d+px\]`, `gap-\[\d+px\]`, `space-[xy]-\[\d+px\]`                     | source       |
| T105 | `oklch(`, `hsl(`, `rgb(` literals                                              | source + CSS |
| T106 | `transition:.*\d+ms`, `duration.*\d+ms` literals                               | source + CSS |
| T107 | `cubic-bezier(` literals                                                       | source + CSS |
| T108 | `backdrop-filter` when `theme.surfaces.glass.enabled !== true` in project.json | source + CSS |
| T109 | `text-\[\d+`, `leading-\[\d+`, `tracking-\[`, `font-\[\d+`                     | source       |
| T110 | `rounded-\[\d+`                                                                | source       |
| T111 | `shadow-\[`                                                                    | source       |

Per finding: emit canonical ID, file:line, matched pattern, severity, and fix from `shared/TOKENS.md § Token → Class Mapping`.

**Step 3: CSS Architecture scan (TA001)**

See `shared/TOKENS.md § CSS Architecture Violations` for TA001 definition.

Grep `.css`, `.scss`, `globals.*`, `theme.css` for semantic CSS variables defined with raw values instead of `var()` references:

```bash
grep -n "--color-[a-z].*:\s*\(#\|oklch\|rgb\|hsl\)" {css-files}
```

- **TA001 (HIGH)**: semantic CSS variable uses raw color value instead of a `var(--color-{primitive})` reference
  `"{file}:{line} — --color-{token}: {raw-value} — use var(--color-{nearest-primitive})"`

**Token Architecture Check Output:**

```
TOKEN ARCHITECTURE
  Token source:        [.project/project.json (theme present) | not available]
  Color violations:    [T101-T103, T105 — N findings | clean]
  Spacing violations:  [T104 — N findings | clean]
  Motion literals:     [T106-T107 — N findings | clean]
  Glass-without-flag:  [T108 — N findings | clean]
  CSS architecture:    [TA001 — N findings | clean]
  Findings: [N] (H:[N] M:[N])
```

---

## 1.11 Dark Mode Compliance Scan

Check `theme.modes.dark` in `.project/project.json`. If missing: skip with message `"Dark mode not configured — scan not applicable."`.

Scan all `.tsx`, `.jsx`, `.vue` component files:

1. Grep for Tailwind color classes: `bg-[a-z]`, `text-[a-z]`, `border-[a-z]`
   (Exclude: `bg-transparent`, `bg-inherit`, `text-inherit`, `text-current`, `border-transparent`)
2. Check per color class if a `dark:` counterpart is present on the same element
3. Also scan for inline `style={{ color: ..., background: ... }}` values

**Skip** if component exclusively uses CSS vars (`var(--color-*)`, `var(--background)`, etc.) — these are already dark-mode-aware via the theme.

**Findings:**

- DC001 (MEDIUM): color class without `dark:` counterpart
  → `{component}: {className} — expected dark:{alternative}`
- DC002 (LOW): component contains color classes, no `dark:` prefix present at all
  → `{component}: 0 dark: classes found (N color classes without dark variant)`

**Dark Mode Compliance Check Output:**

```
DARK MODE COMPLIANCE
  Dark mode configured: [yes | no — scan skipped]
  Components checked:   [N]
  Missing dark: classes:[N components | clean]
  Findings: [N] (M:[N] L:[N])
```

---

## 1.12 Responsive Coverage Scan

Check if project has multi-viewport context: `theme.breakpoints` in project.json OR `tailwind.config` defines custom screens. If missing: skip with message `"No multi-viewport context — scan not applicable."`.

Scan all `.tsx`, `.jsx`, `.vue` component files:

1. Grep for layout classes without responsive prefix: `flex`, `grid`, `hidden`, `block`, `w-full`, `columns-`, `gap-[0-9]`, `p-[0-9]`, `px-[0-9]`, `py-[0-9]`
2. Check if the component uses ≥1 responsive prefix (`sm:`, `md:`, `lg:`, `xl:`, `2xl:`)
3. Flag layout-heavy components (≥5 layout classes) without any responsive variant

**Findings:**

- RC001 (MEDIUM): layout classes present but no responsive prefixes
  → `{component}: {N} layout classes, 0 responsive prefixes — candidate for responsive adjustment`
- RC002 (LOW): spacing/typography without responsive variant in layout-heavy component
  → `{component}: {className} — consider md: or lg: variant for readability`

**Responsive Coverage Check Output:**

```
RESPONSIVE COVERAGE
  Multi-viewport context:[yes | no — scan skipped]
  Components checked:    [N]
  Missing responsive:    [N components | clean]
  Findings: [N] (M:[N] L:[N])
```
