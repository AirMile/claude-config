# COMPONENT-BUILD — Procedure file for dev-build

Loaded by `dev-build/SKILL.md` when `IS_COMPONENT_BUILD = true`. Do NOT load for FEATURE-type builds.

---

## Detection

Determine `COMPONENT_SCOPE`:

- Check `feature.json#architecture.scope` or top-level `scope` field
- Fallback: check `project.json#design.components[]` — match on name → read `scope`
- Fallback: ask user via AskUserQuestion: `"What is the scope of this component?"` (atomic/section/layout)

Determine `COMPONENT_OUTPUT_PATH` based on scope and framework:

- `atomic` → `src/components/ui/{Name}.tsx`
- `section` → `src/components/{Name}.tsx`
- `layout` → `src/components/{Name}.tsx` (+ auto-patch `app/layout.tsx` after build)

Store as `IS_COMPONENT_BUILD = true`, `COMPONENT_SCOPE`, `COMPONENT_OUTPUT_PATH`.

---

## Phase 2 steps

### Output path routing

Override `feature.json files[]` paths with the definitive output paths based on `COMPONENT_SCOPE`:

| Scope     | Main component file            | Demo page                             |
| --------- | ------------------------------ | ------------------------------------- |
| `atomic`  | `src/components/ui/{Name}.tsx` | `app/_dev/components/{name}/page.tsx` |
| `section` | `src/components/{Name}.tsx`    | `app/_dev/components/{name}/page.tsx` |
| `layout`  | `src/components/{Name}.tsx`    | `app/_dev/components/{name}/page.tsx` |

Generate the demo page alongside the component file. The demo page shows a variant matrix of all `variants × sizes × states`:

```tsx
// app/_dev/components/{name}/page.tsx (gitignored via _dev/)
export default function {Name}Demo() {
  return (
    <main aria-label="{Name} demo">
      {variants.map(v => sizes.map(s => states.map(state => (
        <{Name} key={`${v}-${s}-${state}`} variant={v} size={s} {...stateProps[state]}>
          {v}/{s}/{state}
        </{Name}>
      ))))}
    </main>
  );
}
```

Add `app/_dev/` to `.gitignore` if not already there (check first):

```bash
grep -q "_dev/" .gitignore 2>/dev/null || echo "app/_dev/" >> .gitignore
```

### Variant visual spec (G1 — only if component has >1 variant)

Condition: `feature.json.requirements` contains `cva(...)` with more than one variant key or more than one value per key. Skip for 1-variant components.

**Pre-flight (Playwright runner)**: Check `package.json` for `@playwright/test` devDep. If missing:

```yaml
header: "Playwright runner"
question: "Variant visual specs require @playwright/test. How to proceed?"
options:
  - label: "Run /core-setup playwright (Recommended)"
    description: "Installs daemon + runner + base config"
  - label: "Skip variant specs"
    description: "Skip this step, continue with build"
multiSelect: false
```

On **Skip** → jump to "Layout auto-patch" section below.

Generate `.project/playwright-runs/component-{name}.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

const variants = { variants_array }; // e.g. ['default', 'destructive', 'outline']
const sizes = { sizes_array }; // e.g. ['sm', 'md', 'lg'] — [] if no size variant

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:3000/_dev/components/{name}");
  await page.waitForLoadState("networkidle");
});

for (const variant of variants) {
  for (const size of sizes.length ? sizes : [null]) {
    const label = size ? `${variant}-${size}` : variant;
    test(`{name} — ${label}`, async ({ page }) => {
      const selector = size
        ? `[data-variant="${variant}"][data-size="${size}"]`
        : `[data-variant="${variant}"]`;
      await expect(page.locator(selector).first()).toHaveScreenshot(
        `{name}-${label}.png`,
        { maxDiffPixelRatio: 0.02 },
      );
    });
  }
}
```

Generate `.project/playwright-runs/playwright.config.ts` (see `shared/PLAYWRIGHT.md → Runner Mode`).

First run (create baseline):
`npx playwright test .project/playwright-runs/component-{name}.spec.ts --update-snapshots`

Subsequent runs (regression check):
`npx playwright test .project/playwright-runs/component-{name}.spec.ts`
→ FAIL = visual regression in a specific variant/size combination.

Display after first successful run:

```
VARIANT VISUAL SPEC
  Component:  {Name}
  Variants:   {N} ({variant names})
  Sizes:      {M} ({size names}) / n/a
  Spec:       .project/playwright-runs/component-{name}.spec.ts
  Baselines:  .project/playwright-runs/__screenshots__/ ({N×M} PNGs)
```

### Layout auto-patch (only if `COMPONENT_SCOPE === "layout"`)

After generating the component file: add import + render to `app/layout.tsx` (or framework equivalent). Conflict detection: check if the component name is already imported. On conflict → show diff and ask user via AskUserQuestion: "Patch (Recommended)" | "Apply manually". No conflict → patch directly. Display:

```
AUTO-PATCH layout.tsx: import {Name} from "{path}" added + <{Name} /> in render.
```

---

## Phase 3A steps

### COMPONENT design sync

After successful build: update `project.json#design.components[]` — find by name, set `status: "BLT"`. Not found → add with status `"BLT"`, scope `COMPONENT_SCOPE`. Also update `project-context.json#components[]` inventory: check by name → new: push `{ name, src: COMPONENT_OUTPUT_PATH, exports: ["{Name}"], variants, sizes }` → existing: update `src`.

### PAGE suggestions via COMPONENT links

Follow [Discovery — Page-Discovery](../shared/SKILL-PATTERNS.md#page-discovery) for the canonical protocol.

**Trigger (COMPONENT→route):** scan `<Link href="...">` and `router.push(...)` in generated files. Candidate if route does not appear in `design.pages[]` or `backlog.html`. Resolution: per route AskUserQuestion "Yes, add PAGE todo (Recommended)" / "Skip".

**Source:** `"/dev-build"` · **Direction:** `"dev→frontend"` · **Type:** `PAGE`
