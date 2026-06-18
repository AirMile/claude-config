---
name: frontend-tokens
description: >-
  Design token + motion pack management — color, typography, spacing, motion
  packs (Apple/Material/Fluent/Carbon), spring physics, choreography, glass
  surfaces. Use with /frontend-tokens, or whenever a backlog task with type
  THEME and transition "defining" is detected.
reads: [backlog.status, project.theme]
writes: [project.theme, backlog.status, devinfo.tokenDrift]
metadata:
  author: claude-config
  version: 4.2.0
  category: frontend
---

# Tokens

Manages the full design system: vocabulary tokens (colors, typography, spacing, breakpoints, borderRadius, shadows, base motion, interactions, modes, cssVars) **and** motion packs (animation pack, spring physics, choreography, glass surfaces). Output lives in `.project/project.json → theme`.

**Keywords:** animation, motion, pack, spring, iOS, Apple, Material, Fluent, Carbon, glass, vibrancy, choreography, micro-interactions, easing, playful, transitions, hover, press, entrance, delight, styleguide, PDF, brand intake

**Related skills:** `/frontend-design` · `/frontend-check`

## References — Tokens

- `references/THEME_TEMPLATE.md` — Token categories, naming conventions, JSON schema, Read/Write protocol
- `references/phase-1-action-select.md` — Action selection menus (Tokens + Motion routes)
- `../shared/DASHBOARD.md` — project.json full schema
- `../shared/DESIGN.md` — Color advice, typography, motion anti-patterns, glass surface rules
- `../shared/BACKLOG.md` — Backlog lifecycle protocol
- External: `vercel-labs/web-interface-guidelines` — setup-context for Create route (see `references/route-create.md § Step 0`)

## References — Motion

- `references/motion/packs.md` — Pack definitions + source credits (source of truth)
- `references/motion/route-create.md` — Pick pack
- `references/motion/route-customize.md` — Axis-by-axis customisation
- `references/motion/route-apply.md` — Emit CSS vars to codebase
- `references/motion/ios-easings.md` — Apple iOS/macOS easing curves (Apple pack)
- `references/motion/material-motion.md` — Material Design 3 curves + duration scale (Standard pack)
- `references/motion/fluent-motion.md` — Microsoft Fluent 2 curves (Customize opt-in)
- `references/motion/carbon-motion.md` — IBM Carbon entrance/exit curves (Customize opt-in)
- `references/motion/web-baseline.md` — Linear/GitHub/Vercel curves (Subtle pack)
- `references/motion/spring-math.md` — Spring physics conversion + library mapping
- `references/motion/choreography.md` — Named compositions per pack
- `references/motion/preview-template.html` — Preview HTML template

---

## State Machine

```
[*] → PREFLIGHT

PREFLIGHT → ACTION_SELECT   (pass)
PREFLIGHT → ERROR           (fail)

ACTION_SELECT → TOKENS_CREATE         (route: Create)
ACTION_SELECT → TOKENS_VIEW           (route: View)
ACTION_SELECT → TOKENS_STYLEGUIDE     (route: Extract from styleguide — PDF / image / URL)
ACTION_SELECT → TOKENS_UPDATE         (routes: Update / Extract from code / Modes / Delete)
ACTION_SELECT → TOKENS_FILL_IN        (route: Fill-In — missing sections)
ACTION_SELECT → MOTION_CREATE      (route: Motion Pack — pick pack)
ACTION_SELECT → MOTION_CUSTOMIZE   (route: Motion — axis-by-axis)
ACTION_SELECT → MOTION_PREVIEW     (route: Motion — generate preview HTML)
ACTION_SELECT → MOTION_APPLY       (route: Motion — emit CSS vars)
ACTION_SELECT → MOTION_VIEW        (route: Motion — display pack summary)
ACTION_SELECT → MOTION_DELETE      (route: Motion — remove pack)

TOKENS_* / MOTION_* → POSTFLIGHT → COMPLETE → [*]
TOKENS_CREATE → MOTION_CREATE         (optional inline handoff via Step 9 — skips ACTION_SELECT)
VIEW / MOTION_VIEW / MOTION_PREVIEW → [*]   (read-only, no state change)
POSTFLIGHT → RECOVER → PREFLIGHT   (on failure)
```

---

## PHASE 0: Pre-flight Validation

```
PRE-FLIGHT CHECK
════════════════════════════════════════════════
```

1. **Directory** — verify `.project/` exists or create it.
   → `Directory: [✓|✗] .project/ — [exists | created | error]`
2. **Session** — read `.project/session/devinfo.json`.
   → `Session: [✓] [New session | Continuing from {skill}]`
3. **Conflict** (Create/Update) — read `.project/project.json` → check `theme` section.
   → `Conflicts: [✓ empty | ⚠ has data | ✗ file missing]`
   **Setup context age** (all routes except Create): if `theme.setupContext[]` has an entry with `appliedBy` starting with `"frontend-tokens@"`, compute `now − fetchedAt`. If > 180 days → print one non-blocking line: `⚠ Setup context is from {date} ({n} days old). Vercel guidelines may have evolved — consider re-running Create or syncing manually.`
4. **Backlog** — per `shared/BACKLOG.md → Lifecycle Protocol → Read`.
   - **Primary filter** (dashboard flow): `type === "THEME" && transition === "defining"` → pick up silently, set `taskName`.
   - **Fallback** (manual run — no transition match): if exactly one `type === "THEME" && status === "TODO"` task exists, AskUserQuestion: "Backlog has an open THEME task '{name}'. Link this run and mark it DONE on success?" → "Yes — link task" (set `taskName`) / "No — standalone run". (Skip the question when 0 such tasks, or when the primary filter already matched.)
   → `Backlog: [✓ Task picked up — {taskName} | ✓ Linked manual task — {taskName} | ✓ Standalone run]`
5. **Pack rename check** — if `theme.motion.pack === "expressive"`:
   > "Your project uses the old pack name `expressive`. This has been renamed to `apple`. Rename now? (Yes — updates only `theme.motion.pack`, all other keys stay identical)"
   > If confirmed: write `theme.motion.pack = "apple"` and continue.
6. **MIGRATE_OFFER** — if `theme.motion.pack` is absent but `motion.durations[]` or `motion.easings[]` exist:

   > "Your project has base motion tokens but no animation pack. Pick a pack now?
   > Options: Yes — let me recommend / No, start fresh / Skip (keep pack-less)"

   If user picks "Yes — let me recommend":
   - Strong signals (use directly): `ease-ios-*` or spring tokens → Apple · `ease-md-*` or Material tokens → Standard · `ease-fluent-*` → Customize from Fluent · `ease-carbon-*` → Customize from Carbon.
   - Weak signals (ease-out/in/in-out alone are Tailwind defaults — they don't reveal project character): ask one question before recommending:
     > "What character fits the project? Restrained corporate / Premium with motion / Playful / Material-style / Don't know — show me options."
   - Map: Restrained → Subtle · Premium → Apple · Playful → Playful · Material → Standard · Don't know → show pack summary table from `references/motion/packs.md`.

7. **Stack detection** — read `package.json` → detect motion library:
   - `motion` or `framer-motion` → `$HAS_MOTION_LIB=true`, `$STACK_TYPE=motion.dev`
   - `motion-v` → `$STACK_TYPE=motion-v`
   - `svelte` → `$STACK_TYPE=svelte`
   - None → `$HAS_MOTION_LIB=false`, `$STACK_TYPE=css`

```
════════════════════════════════════════════════
Status: [→ Ready | ⚠ Warning: {issue} | ✗ Cannot proceed]
════════════════════════════════════════════════
```

On failure → AskUserQuestion: `"Fix and retry (Recommended)"` / `"Continue anyway"` / `"Cancel"`.

---

## PHASE 1: Action Selection

> **Todo**: Read `.claude/skills/frontend-tokens/references/phase-1-action-select.md`

---

## PHASE 2: Action Execution

### Tokens routes

#### Route: Fill-In (Missing Sections)

> **Todo**: Read `.claude/skills/frontend-tokens/references/route-fill-in.md`

#### Route: Create (New Theme)

> **Todo**: Read `.claude/skills/frontend-tokens/references/route-create.md`

#### Route: View

> **Todo**: Read `.claude/skills/frontend-tokens/references/route-view.md`

#### Token Drift Check (shared helper)

> **Todo**: Read `.claude/skills/frontend-tokens/references/token-drift.md`

#### Route: Extract from styleguide (PDF / image / URL)

> **Todo**: Read `.claude/skills/frontend-tokens/references/route-styleguide.md`

#### Routes: Update, Extract from code, Modes, Delete

> **Todo**: Read `.claude/skills/frontend-tokens/references/route-secondary.md`

### Motion routes

#### Route: Create / Pick Pack

> **Todo**: Read `.claude/skills/frontend-tokens/references/motion/route-create.md`

#### Route: Customize (axis-by-axis)

> **Todo**: Read `.claude/skills/frontend-tokens/references/motion/route-customize.md`

#### Route: Preview

Generate `.project/animation-preview.html` from `references/motion/preview-template.html` populated with current `theme.motion` + `theme.surfaces` values. Open path for user.

> **Todo**: Read `.claude/skills/frontend-tokens/references/motion/preview-template.html` and populate with current values.

#### Route: Apply to codebase

> **Todo**: Read `.claude/skills/frontend-tokens/references/motion/route-apply.md`

#### Route: View (Motion)

Display current pack state:

```
Pack:           {name}
Source:         {source — see motion/packs.md}
Axes:           expressiveness={x} · springiness={x} · tempo={x} · surfaces={x}
Springs:        {n} tokens
Easings:        {list}
Choreography:   entrance={x} · exit={x} · success={x} · attention={x} · error={x}
Glass surfaces: enabled={true/false} · blur={x} · vibrancy={true/false}
Stack:          {stack type}
```

#### Route: Delete (Motion)

Reset `motion.pack = ""`, `motion.axes = {}`, `motion.spring = []`, `motion.choreography = {}`, `surfaces.glass.enabled = false`. Prompt confirmation first.

---

## PHASE X: Post-flight Validation + X.6 Theme Infrastructure Sync

> **Todo**: Read `.claude/skills/frontend-tokens/references/postflight-validation.md`

---

## PHASE Y: Website Sync (Create/Update only)

> **Todo**: Read `.claude/skills/frontend-tokens/references/website-sync.md`

---

## Output Format

After successful Create/Update/Extract/Modes:

```
THEME [CREATED/UPDATED/DELETED]

Location: .project/project.json (theme section)

| Category      | Tokens                                                      |
| ------------- | ----------------------------------------------------------- |
| Colors        | {N} (main: {n}, accent: {n}, semantic: {n})                 |
| Typography    | {N} (families: {n}, sizes: {n})                             |
| Spacing       | {N}                                                         |
| Breakpoints   | {N}                                                         |
| Border Radius | {N}                                                         |
| Shadows       | {N}                                                         |
| Motion        | {N} (durations: {n}, easings: {n})                          |
| Motion Pack   | {pack name / none} (springs: {n}, choreography: {n})        |
| Surfaces      | glass={enabled/disabled}                                    |
| Interactions  | {N} (focusRing, hover, active)                              |
| Modes         | {light/dark/both}                                           |
| CSS Vars      | {present/missing}                                           |

{Backlog: ✓ Task "{taskName}" → DONE}

Next steps:
  1. /frontend-design {page} → build a page with these tokens
  2. /frontend-design → convert a sketch or design with these tokens
  3. /frontend-tokens → motion pack → set spring physics, choreography, glass (if not yet done)
  4. /frontend-tokens → Extract from styleguide (if you have a brand PDF or URL with remaining tokens)
  5. /frontend-check → check performance and SEO
  6. /frontend-check --scope=a11y → accessibility audit
```

---

## Restrictions

- Never create or overwrite a theme without user confirmation
- Never skip pre-flight or post-flight validation
- Only mutate `theme` in project.json — leave all other sections untouched
- Run Website Sync (PHASE Y) after Create/Update; follow Backlog lifecycle protocol throughout
