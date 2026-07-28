# Edit Discipline — frontend edit checklist

Distilled checklist for **surgical edits to existing frontend code** — a small, targeted change
to one or a few files, not a fresh build. Distilled from [FRONTEND-RULES.md](FRONTEND-RULES.md),
[ANTI-SLOP.md](ANTI-SLOP.md), Tailwind v4, and Motion docs; cite rule IDs, don't restate them.
Single source of truth — do not fork a second copy per caller.

**When to load**: the caller has already located the file(s) to edit and at least one has a
frontend extension (`.tsx`/`.jsx`/`.vue`/`.svelte`/`.css`/`.scss` or equivalent). Not relevant to
backend, config, or non-UI logic changes — skip entirely there.

**Prerequisite**: a theme digest (color tokens, typography, spacing scale, radius, shadows,
`motion`, `interactions`, `cssVars` variable names — schema:
[DASHBOARD-THEME.md](DASHBOARD-THEME.md)) should already be loaded before this checklist is
applied; several rules below reference "the digest" directly. No theme (`.project/` or `theme`
key absent) → follow existing file conventions instead, note it, and continue — never scaffold a
theme to satisfy this checklist.

Minimal, surgical edits only — then hold the diff against this checklist:

## Tokens

- No raw color/px/ms literals where a theme token exists — use the digest's `cssVars` names or
  token values (R003, R103; ANTI-SLOP `tokens` pack).
- No arbitrary Tailwind values (`text-[13px]`, `bg-[#...]`) when a scale token covers it; check
  the theme digest (or the project's `@theme` block) first.

## Scope

- Edit only the targeted element/region and its own state variants — no sibling/parent
  restyling, no "while I'm here" cleanup.
- Shared component? Decide component-vs-callsite (does the change belong in the reused source,
  affecting every instance, or only at this one callsite) **before** editing — this is the
  load-bearing judgment call for shared components; when ambiguous, ask.
- No `!important`, no ID selectors, no `z-[999]` — stay on the file's z-index scale (H201, H203,
  H111). Don't change typographic personality (letter-spacing, family, weight) unrequested (H207).

## States & responsive

- Changed a color utility and `theme.modes.dark` exists → update the `dark:` counterpart in the
  same edit (ANTI-SLOP `dark` pack).
- The touched property has `hover:` / `focus-visible:` / `active:` / `disabled:` variants →
  update each or explicitly confirm they stand. Never drop the focus ring (A005).
- Unprefixed utilities apply at **all** widths: fix one viewport with its breakpoint prefix (or
  `max-*:`), keep a base value, and remember prefixed fixes cascade upward (mobile-first, R104).
- Width/size changes inside flex/grid affect siblings — check `flex-shrink`/`min-w-0` fallout.

## Motion

- Animation stays inside `theme.motion`: the active pack, its durations/easings/springs — reuse
  the file's shared `transition`/`variants` objects, no ad-hoc curves (H122; ANTI-SLOP `motion`
  pack).
- Animate `transform`/`opacity` only, never `transition: all`; keep `prefers-reduced-motion`
  handling intact (H105, H107).
- Motion library: an overriding `transition` prop **replaces** the inherited default — merge,
  don't clobber; keep stable keys under `AnimatePresence`; don't add a local `animate` to a child
  that inherits variant propagation.

## A11y

- Semantic elements and ARIA bindings survive restyling; icon-only controls keep their
  `aria-label` (R001, A001, A006). Contrast ≥ 4.5:1 text / 3:1 UI; touch targets ≥ 44px (H004-6).

## Used by

`dev-inspect` (PHASE 2, always — the skill is frontend-only by construction), `dev-tweak` (PHASE 2,
conditional — only when a located file has a frontend extension; the theme digest and this
checklist load together, or not at all). Not read by `TWEAK-DISCIPLINE.md` or `game-tweak` — the
checklist assumes a web frontend stack (Tailwind/CSS tokens, Motion library) that doesn't apply to
Godot/GDScript.
