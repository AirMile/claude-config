# Route: Build (In-Claude-Code Code Generation)

Generates working code for PAGE or COMPONENT features with `status: DEF` and no visual reference material. Flow: entity selection → spec lookup + design levers → page composition → design directions (plan mode) → code generation → post-write checks → render smoke check → completion sync. See `../../shared/CODEGEN.md` for the shared code-gen patterns also used by the Convert route.

**Trigger:** only reachable if `$HAS_BUILD_CANDIDATES = true` (detected in PHASE 1).

**External setup context (fires on Build entry):**

> **Todo**: Read `.claude/skills/shared/VERCEL-CONTEXT.md` — follow the Load Protocol, then apply the guidelines as a bias layer in Step 7.

---

#### Step 0: Backlog task pickup

See `shared/BACKLOG.md → Lifecycle Protocol → Read`. Filter: `(type === "PAGE" || type === "COMPONENT") && transition === "designing"` — if found, auto-select as task (show: `Backlog: ✓ Task picked up — {taskName}`) and skip entity/candidate selection modals.

On successful code generation: remove `transition`, set `status: "DOING"`, `stage: "built"`. Handled by completion sync 10d (`build-completion-sync.md`) — this description is informational only.

#### Step 1: Entity selection

Build candidates come from two sources (merge, deduplicate on name):

1. `design.pages[]` / `design.components[]` with `status: "DEF"` and no visual reference in `.project/wireframes/` or `.screenshots[]`.
2. `backlog.json` features with `(type === "PAGE" || type === "COMPONENT") && transition === "designing"`.

Show only type options for which candidates are available:

```yaml
header: "Build — what to build?"
question: "Which type do you want to generate?"
# If both PAGE and COMPONENT candidates:
options:
  - label: "PAGE (Recommended)", description: "{X} page(s) ready to build"
  - label: "COMPONENT", description: "{Y} component(s) ready to build"
# If only PAGE candidates: skip choice, proceed directly with PAGE
# If only COMPONENT candidates: skip choice, proceed directly with COMPONENT
multiSelect: false
```

Store chosen entity type as `$TARGET_TYPE` (PAGE or COMPONENT).

#### Step 2: Choose candidate

**If `$TARGET_TYPE = PAGE`:** show merged candidate list (design.pages[] DEF + backlog PAGE with transition=designing):

```yaml
header: "Build — choose page"
question: "Which page do you want to build?"
options:
  - label: "{name}", description: "{description} — {route-pattern}"
  # max 4, rest via Other
multiSelect: false
```

Store as `$TARGET_PAGE`.

**If `$TARGET_TYPE = COMPONENT`:** show merged candidate list:

```yaml
header: "Build — choose component"
question: "Which component do you want to build?"
options:
  - label: "{name}", description: "{purpose} — {scope}"
  # max 4, rest via Other
multiSelect: false
```

Store as `$TARGET_COMPONENT`. Store `$TARGET` = `$TARGET_PAGE` or `$TARGET_COMPONENT`.

#### Step 3: Worktree setup

Follow `shared/WORKTREE.md → Auto-create worktree` with `feature-name = $TARGET`. Creates an isolated worktree for this build so generated code lands on a separate branch. Skip if already in a worktree (procedure detects).

#### Step 3b: Enter Plan Mode

> **Todo**: Use the `EnterPlanMode` tool now — Steps 4–7 (spec questioning, design levers, page composition, design directions, BUILD PLAN) all benefit from Opus-level design reasoning. `AskUserQuestion` modals and file reads remain available inside plan mode; only Write/Edit are blocked, which is fine until codegen. Skip `EnterPlanMode` if plan mode is already active (see `shared/PLAN-MODE.md § Entry`).

#### Step 4: Spec lookup (entity-agnostic)

**Step 4.0 — Design levers pre-flight.** Read `project.json#theme` and summarize the levers available for direction composition (Step 5). Warn-only — never abort:

```
DESIGN LEVERS — {$TARGET}
═══════════════════════════════════════════════
Dark mode:    [✓ theme.modes.dark | —]
Motion:       [{motion.pack} pack, {N} choreography entries | —]
Glass:        [✓ surfaces.glass.enabled | —]
Semantic:     [{N} semantic colors: {names} | —]
Type scale:   [{N} sizes | Tailwind defaults]
Spacing:      [{scale summary} | Tailwind defaults]
═══════════════════════════════════════════════
```

If `theme` is empty: show `⚠ No theme tokens — Build falls back to Tailwind defaults; consider /frontend-tokens first.` and continue. Store as `$DESIGN_LEVERS`.

**If `$TARGET_TYPE = PAGE`:**

1. Look up `.project/features/{$TARGET}/feature.json` → read as spec source (primary).
2. Fallback: `design.pages[]` filtered by name matching `$TARGET`.
3. If both empty → ask three structured questions (form choice, anchoring, and escalation per `shared/QUESTIONING.md`):
   1. **Purpose + sections**: "What does this page do? List the sections needed (one per line)."
   2. **Primary action**: "What is the single most important action a user performs here?" — free text
   3. **States**: multi-select — `default` / `loading` / `empty` / `error` / `authenticated-only`
      → save answers as `$INLINE_SPEC` (write to `design.pages[]` is deferred to completion sync 10f — plan mode blocks writes).

Show spec:

```
SPEC: {$TARGET} (PAGE)
Purpose:  {purpose}
Sections: {sections joined}
Routes:   {route-patterns}
```

**If `$TARGET_TYPE = COMPONENT`:**

1. Look up `.project/features/{$TARGET}/feature.json` → read as spec source (primary).
2. Fallback: `design.components[]` filtered by name matching `$TARGET`.
3. If both empty → ask three structured questions (form choice, anchoring, and escalation per `shared/QUESTIONING.md`):
   1. **States**: multi-select — `default` / `hover` / `disabled` / `loading` / `error` / `active` / `checked`
   2. **Props**: "Which props does this component accept? (one per line, e.g. `label`, `onClick`, `disabled?`)"
   3. **Required interaction**: single-select — `keyboard only` / `pointer only` / `both`
      → save answers as `$INLINE_SPEC` (write to `design.components[]` is deferred to completion sync 10f — plan mode blocks writes).

Show spec:

```
SPEC: {$TARGET} (COMPONENT)
Purpose:  {purpose}
Scope:    {scope}
Variants: {variants joined}
Props:    {props joined}
States:   {states joined}
```

```yaml
header: "Spec Confirmation"
question: "Is this spec correct?"
options:
  - label: "Continue (Recommended)", description: "Spec is correct, proceed to codegen"
  - label: "Update spec", description: "Change purpose, scope, variants or props"
multiSelect: false
```

#### Step 4b: Page Composition (PAGE entities only — skip for COMPONENT)

> **Todo**: Read `.claude/skills/frontend-design/references/page-compose.md` and follow the composition flow. Store result as `$COMPOSITION`. Runs inside plan mode — smart-todo design/backlog writes are collected in `$PENDING_DESIGN_WRITES` and flushed in completion sync 10f (see page-compose.md Step 3).

---

#### Step 5: Design Directions

This is the moment Claude determines the design: theme levers + spec → 2-3 concrete, token-anchored design directions. Each direction is a complete visual stance, not just a wireframe choice.

**Inputs:** `$DESIGN_LEVERS` (Step 4.0), the confirmed spec, `$COMPOSITION` (PAGE only), and `shared/DESIGN.md` (anti-patterns, 60-30-10, hierarchy, motion timing) — re-read the principles before composing.

**Skip-path (state machine: DESIGN_DIRECTION → BUILD_CODE):** if `$TARGET_TYPE = COMPONENT` AND the spec has ≤1 variant AND no sections (single-variant/stateless): compose ONE direction internally, show it as a one-line `Direction: {summary}` and go directly to Step 7 — no AskUserQuestion. All PAGE targets and multi-variant COMPONENTs continue below (DESIGN_DIRECTION → ALTERNATIVES_SELECT).

**Compose 2-3 directions.** Each direction is a named combination of three axes:

1. **Layout archetype** — PAGE: `single column` / `sidebar` / `hero + grid` / `split screen` / `dashboard grid`. COMPONENT: structural shape (inline / stacked / grouped).
2. **Hierarchy & density** — what dominates (display heading, data, imagery), airy vs compact, alignment stance (left-aligned editorial vs centered hero).
3. **Concrete token usage** — name ACTUAL tokens from `$DESIGN_LEVERS`: which accent goes where ("primary on CTA + active nav only"), semantic colors in play, type-scale steps for H1/body, surface treatment (glass only if enabled), choreography entries (only if motion pack ≠ none).

Composition rules:

- Directions differ on archetype OR hierarchy/density — never three accent-swaps of the same layout.
- Only use levers that exist: no dark-mode rationale without `theme.modes.dark`, no glass without `surfaces.glass.enabled`, no choreography without a motion pack.
- ≥3 concrete token decisions per direction, named by token name — generic phrases ("modern look") are forbidden.
- `shared/DESIGN.md` anti-patterns apply. Vary between runs — two consecutive builds must not converge on the same direction.

Present via AskUserQuestion with `preview` — an ASCII layout mockup per option, rendered side-by-side. **Previews require `multiSelect: false`.** Keep mockups ≤16 lines × ≤44 cols; annotate token decisions inside or below the frame:

```yaml
header: "Design direction"
question: "Which design direction fits {$TARGET}?"
multiSelect: false # required — previews only render for single-select
options:
  - label: "{Direction 1 name} (Recommended)"
    description: "{archetype} — {hierarchy stance} — {headline token decision}"
    preview: |
      ┌──────────────────────────────────────┐
      │ nav                 [primary] Action │
      ├──────────┬───────────────────────────┤
      │ sidebar  │ H1 — text-4xl/display     │
      │ bg-muted │ body — muted-foreground   │
      │          │ ┌────────┐ ┌────────┐     │
      │ • item   │ │ stat   │ │ stat   │     │
      │ • active │ │ card   │ │ card   │     │
      │   ▔▔▔▔   │ └────────┘ └────────┘     │
      │          │ table — tabular-nums      │
      └──────────┴───────────────────────────┘
      accent: primary on CTA + active nav only
      motion: choreography.stagger on card grid
  - label: "{Direction 2 name}"
    description: "{...}"
    preview: |
      {ASCII mockup 2 — different archetype or hierarchy}
  - label: "{Direction 3 name}" # omit if only 2 meaningful directions exist
    description: "{...}"
    preview: |
      {ASCII mockup 3}
```

If the user answers via "Other": treat the free text as direction adjustments, recompose once, re-present.

Store `$DESIGN_DIRECTION = { name, archetype, hierarchy, tokens[], motion, surfaces }` and `$CHOSEN_LAYOUT = $DESIGN_DIRECTION.archetype` (consumed by the Step 7 BUILD PLAN).

---

#### Step 7: Generate (entity-aware)

Consult `../../shared/CODEGEN.md` for full patterns. Output path determined by entity type and scope:

| Entity              | Output path                                          | Sub-output                          |
| ------------------- | ---------------------------------------------------- | ----------------------------------- |
| PAGE                | `app/{route}/page.tsx`                               | `app/{route}/_components/{Sub}.tsx` |
| COMPONENT (atomic)  | `src/components/ui/{Name}.tsx`                       | —                                   |
| COMPONENT (section) | `src/components/{Name}.tsx`                          | —                                   |
| COMPONENT (layout)  | `src/components/{Name}.tsx` + patch `app/layout.tsx` | Demo page (see below)               |

**Auto-patch for layout components:** if `scope: layout`, Build adds an import + render statement to `app/layout.tsx`. For `appliesTo: route-group:X`: patch in `app/(X)/layout.tsx`. Detect existing imports before patching — show conflict warning on duplicate and ask for confirmation.

**Demo page for COMPONENT:** generate `app/_dev/components/{name}/page.tsx` (gitignored) showing all variants × sizes × states — used for verification in Step 9.

```tsx
// Auto-generated — gitignored
export default function {Name}Demo() {
  return (
    <main aria-label="{Name} demo">
      {variants.map((v) =>
        sizes.map((s) =>
          states.map((state) => (
            <{Name} key={`${v}-${s}-${state}`} variant={v} size={s} {...stateProps[state]}>
              {v}/{s}/{state}
            </{Name}>
          )),
        ),
      )}
    </main>
  );
}
```

**Thinking checkpoint** — present before code generation, wait for user confirmation:

```
BUILD PLAN: {$TARGET} ({$TARGET_TYPE})
═══════════════════════════════════════════════════════════════
Direction:    {$DESIGN_DIRECTION.name} — {one-line summary}
Structure:    {output paths — one line per file}
Layout:       {$CHOSEN_LAYOUT}
Tokens used:  {token names to be used}
Blocks reused: {imports from components[] — or "none"}
Images:       {placeholder strategy or "n/a"}
A11y plan:    {semantic structure + aria-labels}
Caveats:      {missing deps, missing tokens, auto-patch layout, etc. — or "none"}
═══════════════════════════════════════════════════════════════
```

> **Todo**: Use the `ExitPlanMode` tool once the BUILD PLAN is composed — present the BUILD PLAN plus the chosen design direction ({$DESIGN_DIRECTION.name}) as the plan output. Plan rejection covers "adjust plan". After user approval, codegen and all remaining steps (post-write checks, smoke, completion sync) run in Sonnet. Do NOT re-enter plan mode later in this run. Skip this exit if plan mode is no longer active or the skill was started in plan mode by the user (see `shared/PLAN-MODE.md § Exit`).

After approval — generate and write immediately:

- Inject a `DESIGN DIRECTION:` header (full `$DESIGN_DIRECTION` — name, hierarchy, tokens, motion, surfaces) into the generation prompt — these token decisions are binding

- Semantic HTML layout (PAGE) or cva component (COMPONENT) based on spec + `$CHOSEN_LAYOUT`
- Reuse existing components where applicable (import via their paths in `components[]`)
- Tailwind/CSS classes via theme tokens — no raw hex values, no arbitrary color values (`bg-[#…]`)
- Images: only `/placeholder.svg?w={W}&h={H}` (PAGE only) — never external CDN URLs
- Accessibility: `<main>`, `<section>`, `aria-label`, skip-nav (PAGE); correct ARIA attributes (COMPONENT)

#### Step 8: Post-write checks

**Token post-pass** — across generated files:

- `#[0-9a-fA-F]{3,8}` in `className` or inline-style props (outside `//` and `/* */` comments)
- Arbitrary Tailwind color values (`bg-[#`, `text-[#`, `border-[#`)
- Arbitrary spacing/size values (`p-[16px]`, `gap-[24px]`, `mt-[32px]`, `w-[340px]`) — must use the standard Tailwind scale or spacing tokens (R103). Build output has no visual source that justifies arbitrary values — token-pure, same bar as convert's inspiration mode (convert-verification-loop.md 3.2b)
- External placeholder URLs (`images.unsplash.com`, `picsum.photos`, `placehold.co`, `fakeimg.pl`)

On match → show violation + AskUserQuestion:

```yaml
header: "Code violation"
question: "Found: {violation-type} in {file}:{line}. How to proceed?"
options:
  - label: "Auto-fix (Recommended)", description: "Map to nearest theme token, standard scale step, or /placeholder.svg"
  - label: "Fix manually", description: "I'll fix it myself"
  - label: "Ignore", description: "Intentionally deviate from the token rule"
multiSelect: false
```

**Unknown-import scan** — for each `from ['"](.+?)['"]` in generated files:

- Relative (`./`, `../`, `@/`): verify file exists in project structure
- Bare: verify presence in `package.json`
- On unresolved → show list, note as missing dependency in completion report

#### Step 8b: Render smoke check

Single-round render check — catches crashes and broken imports, NOT visual quality (that stays /frontend-check's job). If `playwright-cli` or a dev server is unavailable (detection per `shared/PLAYWRIGHT.md`): skip silently, set `$SMOKE = "SKIPPED"`.

1. Route: PAGE → its route pattern; COMPONENT → demo route `/_dev/components/{name}`.
2. `playwright-cli goto {url}` → wait `networkidle` → screenshot to `.project/tmp/smoke-render-{$TARGET}.png` (store as `$SMOKE_SHOT`) → `playwright-cli console error`.
3. Filter console output per `shared/PLAYWRIGHT.md → Default Ignore Patterns`.
4. Renders + no unfiltered errors → `$SMOKE = "PASS"`.
5. Crash/blank/console errors → apply ONE targeted fix (import/crash only), re-run steps 2-3 once. Still failing → `$SMOKE = "FAIL"`, store first error as `$SMOKE_ERROR`, continue (non-blocking). No multi-round loop.

`$SMOKE_SHOT` backs `devinfo.handoff.buildScreenshot` if a build-incomplete handoff is later written (schema: `shared/DEVINFO.md § devinfo.handoff`).

#### Step 9: Hand off to /frontend-check (optional)

After Step 8 passes, offer a one-question handoff. If `$SMOKE = "FAIL"`: present "Yes" as strongly recommended and include `$SMOKE_ERROR` in the question text.

```yaml
header: "Verify"
question: "Build complete. Run /frontend-check on {$TARGET}?"
options:
  - label: "Yes (Recommended)", description: "Smoke, a11y, responsive, darkmode via /frontend-check"
  - label: "Skip", description: "Mark build done — verify later"
multiSelect: false
```

If "Yes": invoke `/frontend-check {$TARGET}` (feature-target mode picks up `files[]` + routes from `feature.json`). Capture frontend-check's exit status:

- All critical findings resolved or none found → `$VERIFY_STATUS = "PASS"`
- Critical findings remain after user chose "Fix manually" or "Open in convert" → `$VERIFY_STATUS = "FAIL"`, store short reason in `$VERIFY_ERROR`

If "Skip": `$VERIFY_STATUS = "SKIPPED"`. Note in devinfo that verification is pending.

Step 10 reads `$VERIFY_STATUS` to set `feature.audit.buildSmokeStatus`.

#### Step 10: Completion sync (backlog + block inventory + drift cleanup)

> **Todo**: Read '.claude/skills/frontend-design/references/build-completion-sync.md' and execute steps 10a–10f. Runs unconditionally after Step 8 succeeds; only 10d reads `$VERIFY_STATUS`/`$SMOKE`.

#### Step 11: Completion report

```
BUILD COMPLETE: {$TARGET} ({$TARGET_TYPE})

Files:
  {generated-file-1}
  {generated-file-2}

Tokens used:      {N token references}
Components:       {reused components}
Block inventory:  +{$INV_NEW} new, ~{$INV_UPDATED} updated, !{$INV_CONFLICTS} conflict
Linked:           {uses/usedIn sync — or "n/a"}
Missing deps:     {list or "none"}
Smoke:            {$SMOKE} ({$SMOKE_SHOT} | skipped — Playwright unavailable)
Verification:     {$VERIFY_STATUS}
Verify error:     {$VERIFY_ERROR}   (only shown when $VERIFY_STATUS = "FAIL")
Gaps:             {N linked | M created | K pending | "none"}
Page deps:        +{$COMP_FEAT_COUNT} feature deps, {$COMP_COMP_COUNT} component deps   (PAGE only)
pageHint:         {$PAGEHINT_COUNT} features updated   (PAGE only)
Next:             /frontend-check {$TARGET} — moves PAGE to DONE on PASS   (PAGE only, when $VERIFY_STATUS != FAIL)
```

---

## Restrictions

This route must **NEVER**:

- Reach Step 7 codegen with plan mode still active — exactly one `ExitPlanMode` point (Step 7 BUILD PLAN)
- Write `.project/` or source files between Step 3b and the Step 7 exit — defer to completion sync 10f
- Present design directions that reference levers the theme doesn't have
- Run more than one smoke fix-round (multi-round verification is /frontend-check's job)
