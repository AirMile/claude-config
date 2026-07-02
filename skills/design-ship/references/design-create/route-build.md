# Route: Build (In-Claude-Code Code Generation)

> **design-ship copy** — executed by AGENT 1 (build) under the non-interactive contract. Steps
> 0–5 (plan mode, entity/candidate selection, spec gate, design levers, page composition, design
> directions) are **front-loaded in design-ship PHASE 0** (main chat): your prompt already carries
> `$TARGET`, `$TARGET_TYPE`, `$SPEC`, `$DESIGN_LEVERS`, `$COMPOSITION`, `$DESIGN_DIRECTION`,
> `$CHOSEN_LAYOUT`, and `SEED_CONTEXT`. **Start at Step 7** (after loading
> `.claude/skills/shared/VERCEL-CONTEXT.md` below). Steps 0–5 remain in this file for context
> only — do not re-run them, do not re-ask the design direction.

Generates working code for PAGE or COMPONENT features with `status: DEF` and no visual reference material. Flow: plan mode entry → entity selection → spec gate (review/edit, or save-spec-only off-ramp — exits plan mode and writes spec) → design levers → page composition → design directions → BUILD PLAN → ExitPlanMode → worktree → code generation → post-write checks → render smoke check → completion sync. See `.claude/skills/shared/CODEGEN.md` for the shared code-gen patterns also used by the Convert route.

This route is the single entry for working on an existing entity's spec **and** code: the Step 2.5 spec gate absorbs the old standalone "Edit spec" action (route-page/route-component field editing) and offers a "save spec only — don't build" off-ramp that exits plan mode and writes the spec before any worktree or codegen.

**Trigger:** only reachable if `$HAS_BUILD_CANDIDATES = true` (detected in PHASE 1).

**External setup context (fires on Build entry):**

> **Todo**: Read `.claude/skills/shared/VERCEL-CONTEXT.md` — follow the Load Protocol, then apply the guidelines as a bias layer in Step 7.

---

#### Step 0: Backlog task pickup

See `shared/BACKLOG.md → Lifecycle Protocol → Read`. Filter: `(type === "PAGE" || type === "COMPONENT") && transition === "designing"` — if found, auto-select as task (show: `Backlog: ✓ Task picked up — {taskName}`) and skip entity/candidate selection modals.

On successful code generation: remove `transition`, set `status: "DOING"`, `stage: "built"`. Handled by completion sync 10d (`build-completion-sync.md`) — this description is informational only.

#### Step 0b: Enter Plan Mode

> **Todo**: Use the `EnterPlanMode` tool now — Steps 1–7 (entity/candidate/spec decisions, design levers, page composition, design directions, BUILD PLAN) all benefit from Opus-level reasoning under the `opusplan` router. `AskUserQuestion` modals, `Read`, `Glob`, `Grep`, and `WebFetch` keep working inside plan mode; only Write/Edit and git-writes are blocked — which is fine until codegen. The worktree is created after `ExitPlanMode` (Step 7b); the only disk writes (spec, design.\*, backlog) are deferred to the off-ramp exit or completion sync 10f. Skip `EnterPlanMode` if plan mode is already active (see `shared/PLAN-MODE.md § Entry`).

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

#### Step 2.5: Spec gate (review / edit / save-only — runs before worktree)

This gate is the single entry that absorbs the old standalone "Edit spec" action. It runs inside plan mode (entered in Step 0b), before any worktree exists, so a spec-only outcome never creates an empty worktree. Resolve the spec, show it, then let the user decide whether to build.

**Resolve the spec source (entity-agnostic):**

**If `$TARGET_TYPE = PAGE`:**

1. Look up `.project/features/{$TARGET}/feature.json` → read as spec source (primary).
2. Fallback: `design.pages[]` filtered by name matching `$TARGET`.
3. If both empty → ask three structured questions (form choice, anchoring, and escalation per `shared/QUESTIONING.md`):
   1. **Purpose + sections**: "What does this page do? List the sections needed (one per line)."
   2. **Primary action**: "What is the single most important action a user performs here?" — free text
   3. **States**: multi-select — `default` / `loading` / `empty` / `error` / `authenticated-only`
      → save answers as `$INLINE_SPEC`.

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
      → save answers as `$INLINE_SPEC`.

Show spec:

```
SPEC: {$TARGET} (COMPONENT)
Purpose:  {purpose}
Scope:    {scope}
Variants: {variants joined}
Props:    {props joined}
States:   {states joined}
```

**Visual review (optional).** If the project board server is running (`/project-viewer`), the spec is also viewable as a wireframe + read-only spec + editable open-questions form at:

```
http://localhost:9876/{project-dir}/review/{$TARGET}
```

Print this as a plain `http://` URL on its own line so it renders clickable in the Claude Code chat. It reflects the **persisted** spec in `project.json#design`, so it is most useful when `$TARGET` was already captured (Design route / a TODO backlog card); a freshly captured `$INLINE_SPEC` not yet written shows "no spec found" until completion sync. Answers the reviewer leaves there persist to `design.{pages|components}[].reviewNotes[]`.

**Gate:**

```yaml
header: "Spec — {$TARGET}"
question: "Spec for {$TARGET}. What do you want to do?"
options:
  - label: "Build it (Recommended)", description: "Spec is correct — continue to design directions + code"
  - label: "Edit spec", description: "Change purpose, scope, variants, props, states, …"
  - label: "Save spec only — don't build", description: "Write the spec (status DEF) and stop, no code"
multiSelect: false
```

Routing:

- **"Edit spec"** → load the field-edit flow for the entity type and re-present the gate afterwards:
  - PAGE → `route-page.md` "Edit existing" field menu.
  - COMPONENT → `route-component.md` "Edit existing" field menu.

  > **Todo**: Read `.claude/skills/design-create/references/route-page.md` (PAGE) or `route-component.md` (COMPONENT) for the field-edit menu.

  Apply the edits to the in-memory spec, then loop back to the gate (re-show spec).

- **"Save spec only — don't build"** → exit plan mode first (the resolved spec is the plan output — use `ExitPlanMode`; skip if the skill was started in plan mode by the user), then hand the spec to the Design route's write machinery:

  > **Todo**: Read `.claude/skills/design-create/references/route-design.md` and run **PHASE 3 (Confirm)** → **PHASE X (post-flight write/validate)** → **Completion**.

  This is exactly the old "Edit spec" outcome: the spec is written to `design.*` (status `DEF`), checkpointed, and backlog-synced by the Design route. Build stops here — no `$INLINE_SPEC` deferral, no worktree. This is the single `ExitPlanMode` for the off-ramp run.

- **"Build it"** → store the resolved spec as `$SPEC` (and `$INLINE_SPEC` if captured fresh — its write to `design.*` stays deferred to completion sync 10f, since plan mode blocks writes from Step 0b onward), then continue to Step 4.

#### Step 4: Build context (seed + design levers)

The spec is already resolved and confirmed in the Step 2.5 gate (`$SPEC` / `$INLINE_SPEC`). This step loads the build-specific context needed for the design directions.

**Step 4.0a — Seed context.** Run the `shared/SEED.md` Reader once → `SEED_CONTEXT`. Store the full `SEED_CONTEXT.markdown` — it grounds the design directions (Step 5) and the generated copy/labels (Step 7) in what the product actually is. Skip silently if `SEED_CONTEXT.present` is `false`.

```
Seed: [✓ loaded ({SEED_CONTEXT.name}) | — not present]
```

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

If `theme` is empty: show `⚠ No theme tokens — Build falls back to Tailwind defaults; consider /design-tokens first.` and continue. Store as `$DESIGN_LEVERS`.

> Spec is already resolved in Step 2.5 (`$SPEC` / `$INLINE_SPEC`). The deferred write of a freshly captured `$INLINE_SPEC` to `design.*` happens in completion sync 10f — plan mode blocks writes here.

#### Step 4b: Page Composition (PAGE entities only — skip for COMPONENT)

> **Todo**: Read `.claude/skills/design-create/references/page-compose.md` and follow the composition flow. Store result as `$COMPOSITION`. Runs inside plan mode — smart-todo design/backlog writes are collected in `$PENDING_DESIGN_WRITES` and flushed in completion sync 10f (see page-compose.md Step 3).

---

#### Step 5: Design Directions

This is the moment Claude determines the design: theme levers + spec → 2-3 concrete, token-anchored design directions. Each direction is a complete visual stance, not just a wireframe choice.

**Inputs:** `$DESIGN_LEVERS` (Step 4.0), the confirmed spec, `$COMPOSITION` (PAGE only), `SEED_CONTEXT` (Step 4.0a — the product concept biases which hierarchy/density stance fits), and `shared/DESIGN.md` (anti-patterns, 60-30-10, hierarchy, motion timing) — re-read the principles before composing.

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

#### Step 7: Build plan & plan-mode exit (entity-aware)

Consult `.claude/skills/shared/CODEGEN.md` for full patterns. Output path determined by entity type and scope:

| Entity              | Output path                                          | Sub-output                          |
| ------------------- | ---------------------------------------------------- | ----------------------------------- |
| PAGE                | `app/{route}/page.tsx`                               | `app/{route}/_components/{Sub}.tsx` |
| COMPONENT (atomic)  | `src/components/ui/{Name}.tsx`                       | —                                   |
| COMPONENT (section) | `src/components/{Name}.tsx`                          | —                                   |
| COMPONENT (layout)  | `src/components/{Name}.tsx` + patch `app/layout.tsx` | Demo page (see below)               |

**Auto-patch for layout components:** if `scope: layout`, Build adds an import + render statement to `app/layout.tsx`. For `appliesTo: route-group:X`: patch in `app/(X)/layout.tsx`. Detect existing imports before patching — show conflict warning on duplicate and ask for confirmation.

**Demo page for COMPONENT:** how the demo is exposed depends on the framework's routing model — detect from `project.json#stack.framework`:

- **File-based routing** (Next.js, Nuxt, SvelteKit): generate a gitignored demo page at the framework's dev path (e.g. Next `app/_dev/components/{name}/page.tsx`) showing all variants × sizes × states. Dropping the file auto-creates the route `/_dev/components/{name}` — no router edit needed. Template below (adapt to the framework's component language).
- **Explicit-router** (Angular, Vue Router): a component file does NOT create a route. Do NOT generate a throwaway dev route by default — verification falls back to the non-browser smoke in Step 8b. (Optional: if the user wants to inspect the component in a browser, generate a demo component + register a lazy dev route, then hand off to /design-check.)

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

> **Todo**: Use the `ExitPlanMode` tool once the BUILD PLAN is composed — present the BUILD PLAN plus the chosen design direction ({$DESIGN_DIRECTION.name}) as the plan output. Plan rejection covers "adjust plan". **After user approval the FIRST action is Step 7b (worktree setup) — not codegen.** The remaining steps then run in Sonnet in this order: Step 7b (worktree) → Step 7c (codegen) → post-write checks → smoke → completion sync → Step 12 (finalize). Do NOT re-enter plan mode later in this run. Skip this exit if plan mode is no longer active or the skill was started in plan mode by the user (see `shared/PLAN-MODE.md § Exit`).

#### Step 7b: Worktree setup

Follow `shared/WORKTREE.md → Auto-create worktree` with `feature-name = $TARGET`. Runs now — after `ExitPlanMode` — because Auto-create performs git and filesystem writes and may show collision `AskUserQuestion`s, both of which require plan mode to be exited. Creates an isolated worktree for this build so generated code lands on a separate branch. Skip if already in a worktree (procedure detects).

#### Step 7c: Generate and write

**Pre-write gate** — before the first Write/Edit, assert the worktree is live: current branch is `worktree-{$TARGET}`, OR a `shared/WORKTREE.md` skip-condition demonstrably applied (already in a worktree / no feature-name / batch-mode). If neither holds, Step 7b was skipped in error — run it now before generating. Never write source files straight onto the default branch when a worktree should exist.

After the worktree is set up (Step 7b) — generate and write:

- Inject a `DESIGN DIRECTION:` header (full `$DESIGN_DIRECTION` — name, hierarchy, tokens, motion, surfaces) into the generation prompt — these token decisions are binding

- Semantic HTML layout (PAGE) or variant component (COMPONENT) based on spec + `$CHOSEN_LAYOUT`. Variant mechanism follows the stack: React+Tailwind → cva; otherwise native binding (Angular `[ngClass]`/`@Input()`, Vue `:class`, Svelte `class:`) — see `shared/CODEGEN.md § cva Variant Pattern`
- Reuse existing components where applicable (import via their paths in `components[]`)
- Styling via theme tokens — never raw hex values. Tailwind stacks: utility classes, no arbitrary color values (`bg-[#…]`). CSS/SCSS stacks (e.g. Angular Material): CSS custom properties (`var(--token)`)
- Images: only `/placeholder.svg?w={W}&h={H}` (PAGE only) — never external CDN URLs
- Content: when `SEED_CONTEXT.present`, draw headings, labels, and CTA copy from the seed concept so placeholder text reads as the actual product — never generic "Lorem ipsum" or "Feature one/two/three"
- Accessibility: `<main>`, `<section>`, `aria-label`, skip-nav (PAGE); correct ARIA attributes (COMPONENT)

#### Step 8: Post-write checks

**Token post-pass** — across generated files. Always run (framework-agnostic):

- `#[0-9a-fA-F]{3,8}` raw hex in `class`/`className`/`[ngClass]`/`:class` or inline-style props (outside `//` and `/* */` comments)
- External placeholder URLs (`images.unsplash.com`, `picsum.photos`, `placehold.co`, `fakeimg.pl`)

**Tailwind-only** (run only when `stack.styling` uses Tailwind — skip for CSS/SCSS stacks like Angular Material, where these patterns can't occur):

- Arbitrary Tailwind color values (`bg-[#`, `text-[#`, `border-[#`)
- Arbitrary spacing/size values (`p-[16px]`, `gap-[24px]`, `mt-[32px]`, `w-[340px]`) — must use the standard Tailwind scale or spacing tokens (R103). Build output has no visual source that justifies arbitrary values — token-pure, same bar as convert's inspiration mode (convert-verification-loop.md 3.2b)

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

Single-round render check — catches crashes and broken imports, NOT visual quality (that stays /design-check's job). If `playwright-cli` or a dev server is unavailable (detection per `shared/PLAYWRIGHT.md`): skip silently, set `$SMOKE = "SKIPPED"`.

**Determine the smoke target first.** PAGE → its route pattern (browser path below). COMPONENT with an auto-created demo route (file-based routing, Step 7) → demo route `/_dev/components/{name}` (browser path below). COMPONENT **without** a demo route (explicit-router frameworks — Angular, Vue Router) → use the **non-browser fallback** below; skip the Playwright steps.

Browser path:

1. Route: PAGE → its route pattern; COMPONENT → demo route `/_dev/components/{name}`.
2. `playwright-cli goto {url}` (store the full URL as `$SMOKE_URL`) → wait `networkidle` → screenshot to `.project/tmp/smoke-render-{$TARGET}.png` (store as `$SMOKE_SHOT`) → `playwright-cli console error`.
3. Filter console output per `shared/PLAYWRIGHT.md → Default Ignore Patterns`.
4. Renders + no unfiltered errors → `$SMOKE = "PASS"`.
5. Crash/blank/console errors → apply ONE targeted fix (import/crash only), re-run steps 2-3 once. Still failing → `$SMOKE = "FAIL"`, store first error as `$SMOKE_ERROR`, continue (non-blocking). No multi-round loop.

**Non-browser fallback (no demo route):** run the framework's build/compile plus the component's unit/component test, rendering through the framework test harness (Angular TestBed, Vue Test Utils, etc. — typically via the project's test command). Both green → `$SMOKE = "PASS"`. Compile or test failure → `$SMOKE = "FAIL"`, store first error as `$SMOKE_ERROR` (non-blocking). Set `$SMOKE_SHOT = null` — no screenshot. Browser-based a11y/visual checks (axe-core) stay /design-check's job once the component lands on a real route.

`$SMOKE_SHOT` backs `devinfo.handoff.buildScreenshot` if a build-incomplete handoff is later written (schema: `shared/DEVINFO.md § devinfo.handoff`).

#### Step 9: Verification status

Build runs no inline verification handoff — never prompt to run `/design-check`. Always set `$VERIFY_STATUS = "SKIPPED"` (`$VERIFY_ERROR` stays unset). `/design-check` remains a separate, user-initiated skill — the gate to DONE for pages — surfaced in the Step 11 "Next:" line.

Step 10 reads `$VERIFY_STATUS` to set `feature.audit.buildSmokeStatus`.

#### Step 10: Completion sync (backlog + block inventory + drift cleanup)

> **Todo**: Read '.claude/skills/design-ship/references/design-create/build-completion-sync.md' and execute steps 10a–10f. Runs unconditionally after Step 8 succeeds; only 10d reads `$VERIFY_STATUS`/`$SMOKE`.

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
Worktree:         {worktree-{$TARGET}} — MERGED (Step 12) | not in a worktree
Next:             /design-content {$TARGET} — fill copy (placeholders → real text)   (PAGE/COMPONENT, when $VERIFY_STATUS != FAIL)
                  /design-check {$TARGET}  — runtime audit, moves PAGE to DONE on PASS   (after content filled)
```

If the smoke check rendered a live page (`$SMOKE != "SKIPPED"` and `$SMOKE_URL` is set), present that live page in the browser — the real, interactive build, not a screenshot:

> **Todo**: if `$SMOKE != "SKIPPED"` and `$SMOKE_URL` is set: present `$SMOKE_URL` (an `http://` URL) via `.claude/skills/shared/HTML-PRESENT.md` (auto-opens in the browser). Set `$PREVIEW_OPENED = true`. Otherwise skip — no preview, no error.

> **Todo**: Apply the Next-Step Clipboard Offer (binary Ja/Nee) —
> read '.claude/skills/shared/NEXT-STEP-OFFER.md'.
> Recommended command: /design-content {$TARGET} → fill copy and content for the built page.

The report is **not** the end of the build — Step 12 (worktree finalize) runs after it, exactly as the Convert route's §4.4 report is followed by §4.5–4.6.

#### Step 12: Finalize worktree (auto-close)

> **design-ship: SKIP this entire step.** The worktree intentionally stays open — AGENT 2
> (content) and AGENT 3 (check) work in it next, and the main chat merges it in design-ship
> PHASE 4 after the visual review. Never run `FINALIZE.md`, never merge, never
> `git worktree remove`. End your run after the Step 11 report (skip its HTML preview and
> clipboard offer per the non-interactive contract) and return your result.

The Build route owns the **full** worktree lifecycle: Step 7b opens the worktree, this step closes it. There is no separate frontend-verify skill (`/design-check` is the post-merge quality pass — the `dev-refactor` role, not the `dev-verify` role), so the build must finalize its own worktree rather than leave it dangling. Mirrors `dev-verify`'s PHASE Finalize and the Convert route's `convert-completion.md §4.5–4.6`.

**Skip if no worktree was created this run** — detect: `current branch != worktree-{$TARGET}` (Step 7b was skipped because already on a feature branch, or the Step 2.5 gate exited "save spec only" before reaching Step 7b). Then print `Worktree: not in a worktree` and end the build.

Otherwise:

1. **Dev-server cwd pre-check** — before any cleanup, detect Node processes holding cwd in the worktree and offer to stop them (identical to `convert-completion.md §4.5`):

   ```bash
   WT_PATH=$(git rev-parse --show-toplevel)
   CWD_PROCS=$(lsof +D "$WT_PATH" 2>/dev/null | awk 'NR>1 && $4=="cwd" && $1~/(node|next|ts-node|ng|vite)/ {print $2}' | sort -u)
   ```

   `CWD_PROCS` non-empty → AskUserQuestion ("Dev server active — stop {N} process(es) before cleanup?"): "Yes, stop them" → `kill -TERM $CWD_PROCS 2>/dev/null; sleep 2; kill -KILL $CWD_PROCS 2>/dev/null || true` | "Keep running" → continue. **Recommendation flips on `$PREVIEW_OPENED`:** if a live preview was opened this run (`$PREVIEW_OPENED = true`), mark "Keep running" as Recommended (killing it closes the page the user is viewing); otherwise "Yes, stop them" is Recommended.

2. **Auto-finalize** — detect `TEAM_MODE` + PR state, then run `shared/FINALIZE.md` directly (no confirmation modal for the merge/cleanup decision):

   ```bash
   TEAM_MODE=$(jq -r '.team.mode // "solo"' .project/project.json 2>/dev/null || echo "solo")
   PR_INFO=$(gh pr list --head "$(git branch --show-current)" --state all --json number,url,state --limit 1 2>/dev/null)
   PR_STATE=$(echo "$PR_INFO" | jq -r '.[0].state // empty' 2>/dev/null || echo "")
   PR_NUMBER=$(echo "$PR_INFO" | jq -r '.[0].number // empty' 2>/dev/null || echo "")
   PR_URL=$(echo "$PR_INFO" | jq -r '.[0].url // empty' 2>/dev/null || echo "")
   ```

   Dispatch (no `AskUserQuestion` for the merge/cleanup decision — the Build route owns the full worktree lifecycle):

   | TEAM_MODE | PR_STATE                 | Action                                                                                                                |
   | --------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
   | solo      | empty / `CLOSED` / no-gh | Run `shared/FINALIZE.md` mode=`solo` (Branch Resolution → Uncommitted Check → Solo-Merge → Cleanup → Output Report).  |
   | solo      | `MERGED`                 | Run `shared/FINALIZE.md` mode=`cleanup-only`.                                                                         |
   | solo      | `OPEN`                   | **Halt** — print `"PR #${PR_NUMBER} is open: ${PR_URL}. Run /core-finalize $TARGET after review."` Exit.              |
   | team      | `MERGED`                 | Run `shared/FINALIZE.md` mode=`cleanup-only`.                                                                         |
   | team      | `OPEN`                   | **Halt** — print `"PR #${PR_NUMBER} is open: ${PR_URL}. Run /core-finalize $TARGET after review."` Exit.              |
   | team      | empty / `CLOSED`         | **Halt** — print `"Team project: no PR found. Push + open PR via /team-review."` Exit.                                |
   | team      | no-gh                    | **Halt** — print `"Team mode but \`gh\` is not available — run \`gh auth login\` or toggle solo in backlog ⚙."` Exit. |

   The design-track backlog sync (PAGE ships only when already `DONE`, COMPONENT left untouched — `FINALIZE.md` never promotes `DOING → DONE`) is handled inside `shared/FINALIZE.md`.

3. **Session-reorientation guard (cleanup path only)** — before `git worktree remove`, if `pwd` is inside the worktree, `cd {main-repo-path}` first; after successful cleanup print the `🏠 Worktree removed` banner (per `dev-verify/references/finalize.md`).

For COMPONENT scope this is the canonical close point — do not skip even if `/design-check` was not run. The code lands on the default branch via the merge; `/design-check` (later, on main) is the gate that promotes a consuming PAGE to `DONE`.

---

## Restrictions

This route must **NEVER**:

- Reach codegen with plan mode still active — there are two `ExitPlanMode` locations but they are mutually exclusive: exactly one fires per run: the Step 2.5 "save spec only" off-ramp exit (spec-only runs), or the Step 7 BUILD PLAN exit (build runs). A run never hits both.
- Write `.project/` or source files between Step 0b (`EnterPlanMode`) and the Step 7 `ExitPlanMode` — defer to completion sync 10f. (The Step 2.5 "save spec only" off-ramp calls its own `ExitPlanMode` first, then writes the spec via the Design route's PHASE 3 → PHASE X — that write is outside the plan-mode window, so it is allowed.)
- Create a worktree before the Step 7 `ExitPlanMode` — worktree creation (Step 7b) runs only after plan mode exits and only on the "Build it" path; a spec-only outcome must not leave an empty worktree
- ~~End the build with an open worktree without running Step 12 auto-finalize~~ — **inverted in design-ship**: the worktree MUST stay open (Step 12 is skipped); design-ship PHASE 4 owns the finalize after content + check + visual review.
- Present design directions that reference levers the theme doesn't have
- Run more than one smoke fix-round (multi-round verification is /design-check's job)
