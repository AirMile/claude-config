# 1.10 Token Architecture Scan + 1.11 Dark Mode Compliance + 1.12 Responsive Coverage

## 1.10 Token Architecture Scan

Only if "Token Architecture" is selected. Static code analysis — no Playwright required.

**Step 1: Project.json check**

```bash
# Read .project/project.json → check theme.colors.semantic[]
```

If `project.json` is missing or `theme` is empty: stop scan with message `"No design tokens found in project.json — Token Architecture scan not runnable. Run /frontend-tokens first."` If `theme.colors.semantic[]` is present: store as `$SEMANTIC_TOKENS`.

**Step 2: Scan CSS files for semantic raw hex**

Grep CSS files (`.css`, `.scss`, globals, theme.css) for semantic token names with raw hex values:

```bash
# For each token in $SEMANTIC_TOKENS:
# grep -n "--color-{token}:\s*#\|--color-{token}:\s*oklch\|--color-{token}:\s*rgb"
```

- **T001 (HIGH)**: semantic CSS variable has raw hex instead of `var()` reference
  `"--color-{token}: {raw-value} — use var(--color-{nearest-primitive})"`

**Step 3: Scan component files for hardcoded colors**

Grep `src/**/*.{tsx,jsx,astro,vue}` for hardcoded color values that bypass the token system:

- Arbitrary Tailwind: `bg-[#hex]`, `text-[#hex]`, `border-[#hex]`
- Inline styles: `style={{ color: '#hex', background: '#hex' }}`

- **T101 (MEDIUM)**: hardcoded color value in component
  `"{file}:{line} — {pattern}: use var(--color-{nearest-token}) or theme class"`
  Only report if `project.json` has a populated theme.

**Token Architecture Check Output:**

```
TOKEN ARCHITECTURE
  Token source:     [.project/project.json (N semantic tokens)]
  CSS compliance:   [N/M semantic tokens use var() refs | N violations]
  Hardcoded colors: [N components with hardcoded values | clean]
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
