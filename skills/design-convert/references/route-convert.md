# Route: Convert

Convert visual input into working code. Accepts low/medium-fi wireframes, Figma/Canva mockups, screenshots, website URLs, or images pasted in chat. Three modes: faithful 1:1 reproduction, inspiration-based using project theme tokens, or sketch → high-fi (interpret layout-intent from wireframe/mockup, fill in details with tokens and DESIGN.md principles). Self-verifies by comparing source image against Playwright CLI screenshot of generated output.

**Incoming variable contract — all paths that reach this route:**

| Var                   | Direct arg | Backlog match                 | Design Mode A   | Patch handoff |
| --------------------- | ---------- | ----------------------------- | --------------- | ------------- |
| `$ROUTE = "convert"`  | ✓          | ✓                             | ✓               | ✓             |
| `$CONVERT_TARGET`     |            | ✓ (entity name)               | ✓ (entity name) |               |
| `$BACKLOG_ROUTE_HINT` |            | ✓ (`"transition=converting"`) |                 |               |
| `$PATCH_MODE = true`  |            |                               |                 | ✓             |
| `$SOURCE_IMAGE`       |            |                               |                 | ✓             |
| `$SCOPE = "patch"`    |            |                               |                 | ✓             |
| `$PATCH_FILE`         |            |                               |                 | ✓             |
| `$BEFORE_SCREENSHOT`  |            |                               |                 | ✓ (nullable)  |

**Assertion (PHASE 0 entry):** if `$PATCH_MODE = true` AND `$SOURCE_IMAGE` is unset → abort with `"Patch mode requires $SOURCE_IMAGE — handoff incomplete"`.

**Patch fast-path:** if `$PATCH_MODE = true`, skip PHASE 0.1 through 0.4b Steps 1-2 and jump directly to **PHASE 0.4b Step 3**. The fast-path skips PHASE 1 and 2.1, but **not** the reversibility checkpoint — PHASE 2.0 Patch Guard runs §2.1b before its first Edit.

> **Todo**: In patch fast-path, use `EnterPlanMode` (same rationale as the main-flow Todo below) before jumping to PHASE 0.4b Step 3; use `ExitPlanMode` after Step 4 (Confirm), before PHASE 2 Patch Guard.

---

**Step 0b: Task tracking.** Skip for `$PATCH_MODE = true` (single fast-path, no phase-tracking value). Otherwise call `TaskCreate` now — before PHASE 0.1, and before the `EnterPlanMode` call at 0.2 — with these 6 items. Each description names the phase's mandatory Read: the task list is the one artefact that survives plan mode, so a phase whose reference file is not in its task is a phase that gets improvised.

1. PHASE 0 — pre-flight, source capture, mode + scope + preserve list (0.1-0.6c)
2. PHASE 1 — mode procedure; Read `references/convert-mode-{$MODE}.md` — resolve `{$MODE}` at 0.3 and `TaskUpdate` this line to the real filename (audit path: `references/convert-audit.md`)
3. PHASE 2 — codegen; Read `references/convert-generate-template.md`
4. PHASE 3 — verification; Read `references/convert-verification-loop.md`
5. PHASE 3.5 — refine with the user; Read `references/convert-refine-round.md`
6. PHASE 4 — completion; Read `references/convert-completion.md`

Task 2 carries an unresolved `{$MODE}` at seed time. The moment 0.3 sets `$MODE`, `TaskUpdate` that task's description to the concrete filename (`references/convert-mode-copy.md`). A task naming a path that does not exist on disk names no file at all — it gets ticked off without ever being opened.

**Content branch (`$ASPECT = "content"`, set at 0.4c):** the moment 0.4c sets it, `TaskUpdate` task 2 to `references/convert-content-scope.md` (chains into `convert-content-generate.md` → `convert-content-review.md` → `convert-content-apply.md` — PHASE 2c's own sequence) and mark tasks 3 and 3.5 `completed` with a one-line note `"not applicable — content branch"` (PHASE 2/3/3.5 are skipped entirely, see PHASE 1's content-fill note below).

Transitions: PHASE 0 → `in_progress` at 0.1 and PHASE 0 → `completed` at the end of 0.6c; PHASE 1 → `in_progress` / PHASE 1 → `completed` around the mode procedure; PHASE 2 → `in_progress` / PHASE 2 → `completed` around codegen; PHASE 3 → `in_progress` / PHASE 3 → `completed` around the verification loop; PHASE 3.5 → `in_progress` / PHASE 3.5 → `completed` around the refine round; PHASE 4 → `in_progress` / PHASE 4 → `completed` around completion.

<!-- Rationale: three real runs. One skipped PHASE 4 entirely — the verification report reads as a natural stopping point and nothing forced the run back. One seeded a task list with phase names but no reference paths, and improvised PHASE 3 and PHASE 4 from memory. A third seeded the paths correctly but left `{$MODE}` unresolved in task 2, marked it completed without reading any mode file, and generated the whole page with no fidelity table. Naming the file inside the task only works when the name resolves. -->

---

## PHASE 0: Convert Pre-flight

**If `$PATCH_MODE = true`:** skip PHASE 0.1 through 0.4b Steps 1-2 — jump to **PHASE 0.4b Step 3**.

### 0.1 Visual Input Resolution

Determine the input type from the argument or conversation:

| Input                                             | Detection                                                    | Action                                                                                              |
| ------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Figma Make URL                                    | URL contains `figma.com/make/` — check before the rows below | Live-preview capture (`convert-source-fallbacks.md`); set `$INPUT_SOURCE = "figma-make"`            |
| Figma URL, MCP connected                          | URL contains `figma.com` AND figma MCP tools available       | MCP capture (see "For Figma URLs (MCP)" below); set `$INPUT_SOURCE = "figma-mcp"`                   |
| Figma/Canva URL (`figma.com`, `canva.com`)        | URL contains `figma.com` or `canva.com` — no figma MCP       | CLI: `playwright-cli open [url]` → `playwright-cli screenshot`; set `$INPUT_SOURCE = "design-tool"` |
| File path (`/home/...`, `C:\...`, `.png`, `.jpg`) | Contains path separator or image extension                   | Read file with Read tool (multimodal); set `$INPUT_SOURCE = "file"`                                 |
| URL (`http://`, `https://`)                       | Starts with protocol                                         | CLI: `playwright-cli open [url]` → `playwright-cli screenshot`; set `$INPUT_SOURCE = "url"`         |
| Image in chat                                     | No path/URL, image data present                              | Analyze directly from conversation; set `$INPUT_SOURCE = "chat-image"`                              |
| None                                              | No argument, no image                                        | Ask user (see below)                                                                                |

**No input provided:**

```yaml
header: "Visual Input"
question: "What do you want to convert? Paste a screenshot, provide a file path, a website URL, or a Figma/Canva share link."
options:
  - label: "I'll paste a screenshot or image", description: "Paste wireframe, sketch, or screenshot in the next message"
  - label: "Figma, Figma Make or Canva link", description: "Share link from Figma (via figma MCP when connected), Figma Make (live preview), or Canva (via Playwright)"
  - label: "File path", description: "Path to screenshot, export, or image file"
  - label: "Website URL", description: "URL of a live website or published prototype (e.g. *.figma.site) — interactions are captured live"
multiSelect: false
```

**For Figma URLs (MCP):** requires the remote Figma MCP server (`mcp.figma.com`) to be connected — check that `mcp__figma__*` tools are available (load via ToolSearch if deferred).

> **Todo**: MCP not connected, OR the URL contains `figma.com/make/` → Read `.claude/skills/design-convert/references/convert-source-fallbacks.md` and follow it (no-MCP ladder incl. the REST fallback, and the Figma Make procedure). MCP answers normally on a `/design/` URL → skip that file entirely and continue with the three steps below.

1. The link must target a specific frame (`node-id` param in the URL). If it points to a whole file/canvas: ask the user for a frame link (right-click frame → _Copy link to selection_). If the frame name suggests a draft or duplicate (contains "V2", "test", "copy"/"kopie", "old", or the metadata shows sibling frames with near-identical names): confirm with the user that this frame is the final version before proceeding.
2. `get_screenshot` on the node link → Read the returned image. This becomes `$SOURCE_IMAGE`. The MCP returns the image inline; there is no file to write, so `$SOURCE_IMAGE` lives in context only on this path — PHASE 3.5 shows the _rendered_ screenshot rather than a source/output pair, and §4.5's `source-capture*.png` cleanup is a no-op here.
3. `get_metadata` on the same link → store the sparse XML layer outline (frame names, positions, sizes) as `$SOURCE_STRUCTURE` — used in 0.2.
   If `get_metadata` overflows the token limit and the tool dumps the outline to a file (common on full-page frames): store the file path as `$SOURCE_STRUCTURE_FILE` and Read it when needed — do NOT substitute a single whole-frame `get_design_context` (that collapses every section's fills into one result and loses per-section ground truth). The audit path (see `references/convert-audit.md`) reads this dump to harvest per-section child node-ids and calls `get_design_context` per section.

The MCP path provides ground-truth design data downstream: the mode files (PHASE 1) read exact values via `get_design_context` / `get_variable_defs` instead of estimating from pixels — this removes the vision-estimation burden, so the route runs reliably on Sonnet.

**For URLs:** Navigate with Playwright CLI, wait 3 seconds for render, take full-page screenshot. This captured screenshot becomes the source image for all subsequent phases.

```
mkdir -p .project/tmp
playwright-cli open [url]
playwright-cli run-code "async page => { await page.waitForTimeout(3000); }"
playwright-cli screenshot --full-page --filename=.project/tmp/source-capture.png
playwright-cli close
Read .project/tmp/source-capture.png
```

Store the resolved source image reference as `$SOURCE_IMAGE` for the verification loop.

> **Todo**: Use the `EnterPlanMode` tool now, before Visual Analysis (0.2). Skip only if plan mode is already active (see `shared/PLAN-MODE.md § Entry`).
>
> **The plan file must carry this skill's spine, not replace it.** The harness injects its own plan-mode workflow that claims to supersede other instructions. It governs _how_ the plan is produced — never _what_ the run does after approval. Left unguarded this swaps the whole procedure below for the plan file: a real run improvised PHASE 3 and PHASE 4 wholesale, skipping the exact-value check and the `.project/`-never-staged rule because both live in files the plan never named.
>
> The plan file therefore ends with a verbatim block naming each remaining phase and its mandatory Read:
>
> ```
> Remaining phases (route-convert.md — execute after approval):
>   PHASE 2.0b  $FORBID_LIST from project.json design.principles
>   PHASE 2.2   Read references/convert-generate-template.md
>               ^ $PRESERVE is a STOP boundary — see 2.1
>   PHASE 3     Read references/convert-verification-loop.md
>               ^ never improvise — see the PHASE 3 Todo
>   PHASE 3.5   Read references/convert-refine-round.md
>               ^ show the user a screenshot before PHASE 4 runs
>   PHASE 4     Read references/convert-completion.md
> ```
>
> A plan without this block is incomplete — do not call `ExitPlanMode`.

### 0.2 Visual Analysis

Analyze the source image. Extract:

```
SOURCE ANALYSIS
════════════════════════════════════════════════════════════

Type:       [Full page | Section/component | Multiple components]
Sections:   [enumerated list of visual sections top-to-bottom]
Layout:     [single column | multi-column | grid | sidebar + content | etc.]
Responsive: [1 viewport | mobile+desktop | mobile+tablet+desktop | unknown]
            → $RESPONSIVE_VIEWPORTS (drives which tiers get a source-frame
              vision-compare vs. an overflow/wrap-only check in §3.2e)
Sizing:     [per key element: fixed (px/rem) | fill (flex:1 / 100%)
            | hug (fit-content/auto)]
Fidelity:   [low | medium | high]
            low    = handdrawn/mono, placeholder boxes, no type detail
            medium = Figma/Canva draft, rough colors, not pixel-accurate
            high   = polished mockup or live screenshot, pixel-accurate
Key colors: [dominant colors as hex, max 5]
Dark mode:  [light only | dark only | both visible | unknown]
Typography: [heading style, body style — approximate]
            accent segments: [present ({heading}, {word}) | none]
            ^ a heading where one word carries a different color. Note it
              even on vision-estimated sources — it is their only cue, and
              the detail most often flattened into a single color.
Components: [UI patterns: cards, nav, hero, form, table, etc.]
Variants:   [component → axes: size=sm/md/lg, state=default/hover,
            type=primary/ghost | no variants detectable]
States:     [no separate state frames | loading | error | empty | success]
            Only frames that explicitly show a non-default state. → $STATES
Properties: [design properties with a direct CSS mapping — only what is
             visibly present:
              fill → background-color/color: [value(s)]
              stroke → border: [value(s)]
              corner-radius → border-radius: [value(s)]
              shadow → box-shadow: [value(s)]
              opacity → opacity: [value(s)]
              rotation → transform: rotate([value(s)])]
Motion:     [detected motion cues — note what is present:
             transitions: [elements with transition/animation frames]
             hover states: [if hover variants shown: element → effect]
             animated: [elements labeled "animated" or with motion paths]
             glass/blur: [backdrop-filter surfaces visible?]
             spring/bounce: [bouncy or elastic motion implied?]
             → $MOTION_INTENT (description, or "none detected")]

════════════════════════════════════════════════════════════
```

**If `$INPUT_SOURCE = "figma-mcp"` or `"figma-rest"`:** derive `Sections`, `Layout`, and `Sizing` from `$SOURCE_STRUCTURE` (layer names, positions, dimensions) instead of estimating from pixels; use the screenshot for colors, typography character, and fidelity assessment. Figma sources are typically `high` fidelity.

Also read the file's **structural hygiene** from `$SOURCE_STRUCTURE` and append one line to the analysis block:

```
Hygiene:    [components: yes|none · naming: semantic|generic · variables: yes|none]
```

- `naming: generic` (many "Container"/"Frame N"/"Text" layers): layer names are unreliable — derive section boundaries from the screenshot, use `$SOURCE_STRUCTURE` only for positions/sizes.
- `components: none`: the file does not mark repeated elements — codegen must identify and dedupe repeated visual patterns itself (see the mode file's codegen rules).

Store fidelity as `$FIDELITY` (low | medium | high).

**Interaction probe (real-DOM sources):** when `$INPUT_SOURCE ∈ {url, figma-make}`, run the Candidate Discovery eval from `shared/PLAYWRIGHT.md § Use Cases: Interaction State Capture` against the (still open, or re-opened) source page. `hits > 0` counts as an interaction cue below — this is what catches an interactive page when the user shared only a link and said nothing about interactions. Static sources: skip the probe (no DOM to scan).

**Interaction capture (conditional):** when any interaction cue fires — the probe above found `hits > 0` · `$INPUT_SOURCE = "figma-make"` · the user provided/pasted written interaction documentation · `$MOTION_INTENT` includes hover-variant frames or labeled/animated elements · the user explicitly asks for interactions to be converted:

> **Todo**: Read '.claude/skills/design-convert/references/convert-interactions.md' — capture a structured `$INTERACTION_SPEC` (spec-text parsing, live observation for real-DOM sources, or vision estimation). No cue fired → skip that file entirely; `$MOTION_INTENT` stays a loose supplement and motion follows the pack (0.6), unchanged.

**Sibling frames — one template, N content records.**

Fires when the user supplied more than one frame link, or `$SOURCE_STRUCTURE` shows sibling frames whose section names and layer structure match this one. Confirm the set with the user (name each frame), then plan the run as a template, not as N pages:

- **Extraction**: one agent per frame (§ 1.0), all dispatched in one message.
- **Codegen**: ONE set of section components plus an N-row data module. Fields that differ per frame become props; fields absent on some frames become optional.
- **Verification**: the full pixel-diff loop on frame 1. Every other frame still gets §3.2c (exact values) and §3.2e (overflow) — those are cheap and are the only checks that would catch a template that breaks on different content. Skipping them ships N-1 unverified pages.

Sibling node-ids are usually a fixed stride apart (`174:2`, `174:285`, …). Probing a candidate id with `get_screenshot` is cheap; asking the user for the remaining links is cheaper still when the stride is unclear.

### 0.25 Target Page Identity Check

Only when `$INPUT_SOURCE ∈ {figma-mcp, figma-rest}` AND `$ANALYSIS` Type = `Full page` — a full-page frame is the only case where "which page does this become" is ambiguous; single components/sections always go straight to the scope selection in 0.4.

**Why this exists:** a full-page frame containing Hero/Footer/Contact pattern-matches "looks like a homepage", but a per-category landing page has the same anatomy. Skipping this check once let a frame named "Brandbeveiliging" silently overwrite an already-shipped homepage, unrecoverable from disk. A homepage-shaped frame never implies it targets the homepage.

1. Read the frame's own top-level name (from `$SOURCE_STRUCTURE` / the frame node metadata captured in 0.1).
2. Classify it:
   - **Generic** — matches `home`, `homepage`, `landing`, `index`, `main`, or the project name itself (case-insensitive) → no extra check, set `$TARGET_PAGE_CONFIRMED = "homepage"` and proceed to 0.3.
   - **Specific** — anything else (a product/service/sector/category name) → this is a signal the frame may represent its OWN page, not the existing homepage. Continue to step 3.
3. Run a lightweight existing-route check (framework-appropriate; for Next.js App Router: `find app -maxdepth 2 -name "page.tsx"`) to see whether a route matching the frame name already exists. Use the result as context in step 4, not as a silent decision.

3b. **Route match found → compare before recommending.** The frame name alone cannot tell you whether the existing route is unrelated or was already built from this very design. Read that route's page file, list its section imports, and compare their names and visible copy against the frame's text nodes in `$SOURCE_STRUCTURE`. Record the overlap:

- **≥2 sections match** → this route was built from this design. Set `$EXISTING_BUILD = true`; step 4's modal leads with that fact and recommends updating the existing page, not creating a new one. Carry `$EXISTING_BUILD` into 0.4 — it is the strongest form of the backlog-status signal there.
- **0-1 sections match** → same-named but unrelated route. `$EXISTING_BUILD = false`; step 4 runs as written.
  <!-- Rationale: a real run found a fully-built /certificeringen whose CTA copy, six benefit cards and three certification blocks were verbatim the frame's — but only via separate exploration. The skill step itself had classified on the frame name alone and would have recommended a new page. -->

4. **AskUserQuestion — mandatory when step 2 classified the frame as Specific; no recommendation heuristic in 0.3/0.4 may substitute for this:**
   ```yaml
   header: "Doelpagina"
   question: "This Figma frame is named '{frameName}'. Which page should it become?" # $EXISTING_BUILD → prefix: "/{route} already exists and shares {n} sections with this frame."
   options:
     - label: "New page at /{kebab-frameName}", description: "No matching route found yet — recommended when the frame name is a distinct product/category" # append (Recommended) only when step 3 found no existing route AND $EXISTING_BUILD is false
     - label: "This IS the existing homepage", description: "Confirm explicitly that this frame should replace app/page.tsx (or the project's detected homepage route)"
     - label: "A different existing page", description: "I'll specify the target route myself" # append (Recommended) when $EXISTING_BUILD is true, prefilled with the matched route
   multiSelect: false
   ```
5. Store the answer as `$TARGET_PAGE_CONFIRMED` (`new` | `homepage` | `other:{route}`):
   - `new` → the target route is `/{kebab-frameName}` (or a route the user names). Scope in 0.4 defaults to a normal "Full page" build against that new route — do **not** offer "Audit existing page vs design" (there is nothing existing at that route to audit against), and skip its auto-nudge signals entirely.
   - `homepage` → proceed exactly as the rest of this file already describes; 0.4's audit-option/auto-nudge logic applies unchanged.
   - `other:{route}` → same as `homepage`, but every later reference to "the homepage" / `app/page.tsx` in 0.3–0.5 means the given route instead.

### 0.26 Resume Detection

Skip entirely when `$TARGET_PAGE_CONFIRMED = "new"` (0.25), or no candidate name is resolvable yet
(neither `$CONVERT_TARGET` from a backlog-transition pickup nor a confirmed target from 0.25) — a
brand-new page has no prior state to resume. Runs before 0.3, so its result is available when the
batched 0.25/0.3/0.4 modal (see the batching note below) is assembled — computing it after that
modal is built would mean the modal's own copy can't reflect it.

1. Resolve the candidate name: `$CONVERT_TARGET` if set, else `$TARGET_PAGE_CONFIRMED` (`homepage` /
   `other:{route}`).
2. Read `.project/project.json#design.{pages|components}[]` for the matching entry. Compute:
   - `$UNBUILT` = `sectionState[]` entries where `build !== "built"` (absent `sectionState[]`, or no
     matching entry at all → treat as a first-ever run: `$UNBUILT` = all of 0.2's `$ANALYSIS.Sections`
     once known, `$RESUME_STATE = null`).
   - `$BUILT_NO_CONTENT` = `sectionState[]` entries where `build === "built" && content !== "filled"`.
3. Both empty → `$RESUME_STATE = null`. No behavior change downstream.
4. Otherwise → `$RESUME_STATE = { unbuilt: [...names], builtNoContent: [...names] }`. Print one status
   line before the batched modal:
   ```
   Resume: {name} — {built}/{total} sections built, {filled}/{total} content-filled
   ```
   When `$RESUME_STATE` is set, append `" — {len(unbuilt)} section(s) not yet built"` to the "Full
   page" option's description in the 0.4 modal below — the recommended marker on "Full page" itself
   is unchanged (there is still more of the page to build), but the description now tells the user
   this run won't silently redo finished sections. The actual protection against overwriting finished
   work lives in 0.4c's section-picker default (below), not in this modal's text.

### 0.3 Mode Selection

**Audit-first override:** check the audit-recommendation signals now (same conditions as 0.4's "Recommended marker" below: `$INPUT_SOURCE ∈ {figma-mcp, figma-rest}` AND `$ANALYSIS` Type = `Full page` AND `$TARGET_PAGE_CONFIRMED ∈ {homepage, other:*}` (0.25) AND the phrase- or backlog-status signal fires). If they fire, **skip this step** and go straight to 0.4 with Scope pre-recommended to Audit — Mode is never selected for that scope (see convert-audit.md's Extraction-overrides-`$MODE` note), so asking it first only to discard the answer wastes a modal. If the user picks a scope other than Audit at 0.4, return here before proceeding.

Default recommendation is based on `$FIDELITY`: low/medium → Sketch → high-fi; high → 1:1 copy or Inspiration.

```yaml
header: "Mode"
question: "How do you want to convert this visual design?"
options:
  - label: "Sketch → high-fi", description: "Interpret layout-intent from wireframe/mockup — fill in colors, spacing, typography from project tokens and DESIGN.md. Best for low/medium-fidelity input."
  - label: "1:1 copy", description: "Reproduce as faithfully as possible — colors, fonts, spacing from the original"
  - label: "Inspiration", description: "Adopt layout/structure of a polished mockup, apply project theme tokens"
multiSelect: false
```

Note: show `(Recommended)` after the option that matches `$FIDELITY` (low/medium → Sketch; high → 1:1 copy).

Store as `$MODE` (sketch | copy | inspiration).

> **Todo**: Read '.claude/skills/design-convert/references/convert-mode-{$MODE}.md' — it defines this mode's theme requirement (applied in 0.6), PHASE 1 procedure with its `ExitPlanMode` point, codegen rules (applied in 2.2), and verification thresholds (applied in PHASE 3). Resolve `{$MODE}`to the real filename and Read it now, before 0.4 — not "at PHASE 1". Then`TaskUpdate` task 2 (Step 0b) to that same filename.

**Batching 0.25, 0.3 and 0.4.** These three questions land back-to-back and none of them depends on the previous answer, so ask them in **one** `AskUserQuestion` call with up to three questions rather than three consecutive modals. Keep each question's own option set and its `(Recommended)` marker exactly as specified — batching changes the number of round-trips, never the choices. 0.26 (Resume Detection) runs before this batch and only enriches the "Full page" option's description — it never adds a question of its own. The audit follow-up (`convert-audit-scope.md`) and the scope follow-up (`convert-scope-followup.md`, 0.4c) both stay separate: they only exist once "Audit" or "Full page"/"Single component" has been picked, respectively.

### 0.4 Scope Detection

Based on the visual analysis (0.2), confirm the output scope:

```yaml
header: "Scope"
question: "What should the output be? (Multiple separate components? Pick 'Full page' or 'Single component' and name the rest under Other.)"
options:
  - label: "Full page (Recommended)", description: "Page file + section components"
  - label: "Single component", description: "Generate only this component"
  - label: "Update existing component", description: "Patch based on new screenshot — only changed sections"
  - label: "Audit existing page vs design", description: "Reconcile an already-built page against the full Figma design — sweep every section, flag wrong values (colors/text/spacing/radii), then patch only the mismatches. Needs a ground-truth source (Figma MCP/REST or URL)."
multiSelect: false
```

**Availability guard for the audit option** (inline — it decides whether the file below is worth reading at all):

- `$INPUT_SOURCE ∉ {figma-mcp, figma-rest, url}` → omit the audit option entirely. Other sources have no per-section exact value to reconcile against; their path is patch.
- `$TARGET_PAGE_CONFIRMED = "new"` (0.25) → omit it too: the user already confirmed this frame targets a route that does not exist yet, so there is nothing to audit against.

> **Todo**: audit option still on the table after the guard → Read `.claude/skills/design-convert/references/convert-audit-scope.md` BEFORE presenting the modal: it decides whether the audit option outranks "Full page" as the recommended default, and what an accepted audit reconciles. Guard omitted the option → skip that file.

On "Update existing component": skip PHASE 0.5 and go to PHASE 0.4b.

On "Full page" when `$TARGET_PAGE_CONFIRMED = "new"` (0.25): the target page file is `/{kebab-frameName}` (or the user-specified route) — 0.5's backlog/name derivation uses that route's name, not the homepage.

**Visual review (optional).** Once the target name is resolved (after 0.5 for page scope, or from the scope selection for component scope), if the board server is running (`/project-app`) and the entity already exists in `project.json#design`, print its review URL as a plain `http://` URL on its own line so it renders clickable in the Claude Code chat:

```
http://localhost:9876/{project-dir}/review/{target-name}
```

There the user can confirm the detected sections/components as a wireframe and leave open-questions before conversion proceeds; answers persist to `design.{pages|components}[].reviewNotes[]`. Skip the line if the entity is not yet in the design spec.

### 0.4c Scope Follow-up

Only for `$SCOPE ∈ {"Full page", "Single component"}` — patch already has 0.4b, audit already has its
own follow-up (`convert-audit-scope.md`); neither needs this one.

> **Todo**: Read `.claude/skills/design-convert/references/convert-scope-followup.md` and follow it.
> It sets `$ASPECT` (`build` | `content`) and `$BUILD_SECTIONS[]`, and decides where the run goes
> next: straight into PHASE 0.5 as today (`$ASPECT = build`), or past PHASE 0.5/1/2 into **PHASE 2c
> Content Fill** (`$ASPECT = content`).

### 0.4b Patch Detection

Only for scope = patch.

> **Todo**: Read '.claude/skills/design-convert/references/convert-patch-detection.md'

### 0.5 Backlog Task Lookup (page scope only)

**`$ASPECT = "content"` (0.4c): skip this step and 0.5b/0.5c is entered directly** — the target name is
already resolved (0.26's `$RESUME_STATE` lookup, or `$CONVERT_TARGET`), so there is nothing left for
this step to derive. Continue at 0.5b — content-fill still Edits app code, so it still needs the same
worktree/baseline safety net.

If scope is a full page (not a single component):

1. Read `.project/backlog.json` (if exists) → parse JSON
2. See `shared/BACKLOG.md → Lifecycle Protocol → Read`. Filter: `(type === "PAGE" || type === "COMPONENT") && transition === "converting"` — if found, auto-select as task (show: `Backlog: ✓ Task picked up — {taskName}`).
3. If `$CONVERT_TARGET` is set: use it as the page name to match (skip name derivation). Otherwise derive from scope selection. Find feature: `data.features.find(f => f.name === "{kebab-case-page-name}")`
   - **Found**: use as task reference. Do NOT modify `status` or add `stage` during build — the page stays `TODO` until PHASE 4 completion. Skip write.
   - **Not found**: store `$NEW_BACKLOG_ENTRY = { "name": "{name}", "type": "PAGE", "status": "TODO", "phase": "P4", "description": "Converted from visual input", "source": "/design-convert", "origin": "user", "dependencies": [] }` (`source`/`origin` per `shared/BACKLOG.md § Card provenance` — converting the user's own visual input is `user`). **Do not write yet** — Phase 4 completion (4.2) writes the entry along with the DONE sync.

If scope is a component: skip this step.

**Single-page projects:** if the project has no multi-page `backlog.json` structure yet (e.g. a one-page marketing site with no prior PAGE/COMPONENT entries), deriving `$CONVERT_TARGET` here is not load-bearing for the rest of the run — the page file is still locatable directly (it's the only page), and 0.5's name-and-entry bookkeeping can be deferred to PHASE 4 completion (4.2) without any functional loss. Don't block on this step for such projects.

### 0.5b Worktree Setup

Feature-name: use backlog-matched feature name from 0.5 (page scope), or component name derived from scope selection (component scope). Follow `shared/WORKTREE-CREATE.md → Auto-create worktree`. Skip if no clear feature-name is available or if already in a worktree (procedure detects).

Print the outcome either way — a step whose only successful path is silence gets skipped without anyone noticing:

```
Worktree:   [created {branch} | already in one ({branch}) | skipped — {reason}]
```

### 0.5c Commit Baseline

Per `shared/SCOPED-COMMIT.md → §1 Baseline` (SHA form) — captured **after** the worktree switch (0.5b), so it always points at a real, currently-reachable commit:

```bash
mkdir -p .project/session
git rev-parse HEAD > .project/session/pre-convert-sha.txt 2>/dev/null || true
```

This baseline is what `convert-completion.md §4.5b Scoped Commit` diffs against at the end of the run — without it, a direct-on-main convert run (no worktree) leaves no commit and no recoverable "before" state if something goes wrong mid-run. Non-git projects: the `git rev-parse` fails silently (`|| true`), §4.5b's commit step then no-ops via its own guard.

The baseline only helps once the run finishes cleanly. The mid-run gap — an overwrite that happens before PHASE 4 is ever reached — is closed by the reversibility checkpoint at **§2.1b**, deliberately placed there rather than here: at this point the run does not yet know which files it will touch.

### 0.6 Theme & Project Context

**Theme check:**

Check `.project/project.json` → `theme` section. Apply the **Theme Requirement** section from the loaded `convert-mode-{$MODE}.md` (mandatory with abort for sketch/inspiration, optional for copy).

```
Theme: [Available | Not available]
Mode:  [1:1 copy | Inspiration | Sketch → high-fi (fidelity: {$FIDELITY})]
```

**Motion default:** if `theme.motion` is populated (durations/easings/pack, managed via `/design-tokens`), it is the default motion language for codegen. Two levels of source motion, treated differently:

- **Documented interaction spec** (`$INTERACTION_SPEC` rows with `source: spec-text` or `observed` — exact scales, durations, easings): this is **ground truth**, same status as an exact color from Figma. Copy mode reproduces the values exactly; inspiration/sketch map each interaction to the nearest pack choreography token and keep the explicit delta only where the pack has no equivalent.
- **Vague motion vibes** (`$MOTION_INTENT` string, or `$INTERACTION_SPEC` rows marked `estimated`): supplements the pack but never overrides pack conventions — the pack is what keeps animation consistent across converted pages.

If `theme.motion` is empty and the source or user intent implies animated output: recommend running `/design-tokens` (Motion Pack) once before converting — do not invent per-page motion values. Exception: a documented interaction spec is implementable without a pack (its values are explicit); note in the Generation Summary that a pack would make future pages consistent with it.

**Dark-mode fallback:** if `$ANALYSIS` dark mode is `dark only` or `both visible` AND `theme.modes.dark` is missing AND `$MODE` ≠ copy:

```yaml
header: "Dark mode"
question: "The source shows a dark variant, but your theme has no dark mode configured. How to proceed?"
options:
  - label: "Convert as light mode using theme (Recommended)", description: "Generate the light variant only — add dark mode later via /design-tokens"
  - label: "Add dark mode first", description: "Stop here, run /design-tokens, then re-run this conversion"
  - label: "Cancel", description: "Stop without changes"
multiSelect: false
```

**Seed context (sketch & inspiration modes only):**

If `$MODE ∈ {sketch, inspiration}`: run the `shared/SEED.md` Reader once → `SEED_CONTEXT`. Store the full `SEED_CONTEXT.markdown` for use in PHASE 1 (inspiration brief / fidelity filter) and PHASE 2 codegen — it grounds copy, labels, and CTA text in what the product actually is, so generated content is on-concept instead of generic placeholder text. For `$MODE = copy` (or any patch path): skip — pure reproduction takes all content from the source.

```
Seed: [✓ loaded ({SEED_CONTEXT.name}) | — not present | — skipped (copy mode)]
```

**Framework detection:**

Detect from `package.json`:

| Framework          | Detection             | Page path                | Component dir            |
| ------------------ | --------------------- | ------------------------ | ------------------------ |
| Next.js App Router | `next` + `app/` dir   | `app/[page]/page.tsx`    | `src/components/[page]/` |
| Next.js Pages      | `next` + `src/pages/` | `src/pages/[page].tsx`   | `src/components/[page]/` |
| Vite + React       | `vite` in deps        | `src/pages/[page].tsx`   | `src/components/[page]/` |
| Remix              | `@remix-run/react`    | `app/routes/[page].tsx`  | `app/components/[page]/` |
| Astro              | `astro` in deps       | `src/pages/[page].astro` | `src/components/[page]/` |

**Light component scan:**

Quick scan for reusable components in the project. No deep inventory — just check what exists:

1. Glob for `src/components/**/*.{tsx,jsx}` (or framework equivalent)
2. List component names and their approximate purpose (from filename + exports)
3. Match against sections identified in the source image — when `$BUILD_SECTIONS` is set (0.4c), match
   only against those sections; a leak in a section not selected this run isn't silently missed,
   since 0.6b re-runs fresh on every run and will catch it whenever that section is later selected.

```
PROJECT CONTEXT
════════════════════════════════════════════════════════════

Framework:  [detected]
Theme:      [Available (project.json#theme) | Not available]
Existing:   [N] components found
  Matched:  [component names that match source sections]
  Shared:   [of those, the ones used on >1 page]

════════════════════════════════════════════════════════════
```

For every matched component, also resolve **where else it is used** — grep the
framework's page files for its import. That count is what makes 0.6b's question
answerable; without it the user is asked to preserve components with no way to
see which ones a restyle would leak into.

### 0.6b Preserve List

Runs when the scan above matched ≥1 existing component to a source section, or
`$EXISTING_BUILD = true` (0.25). No matches → skip silently, set `$PRESERVE = []`.

Every match is a fork the run must not take on its own. The design is one input;
the codebase's own visual language is the other, and only the user knows which
one wins per component. Shared layout (header/footer) and wired-up forms are the
usual answer — rebuilding those from a page-level frame changes every other page
that mounts them.

**Classify each match before asking** — the answer space is not the same for all
of them:

- **Prop-driven and shared** (a hero, a CTA banner: the page passes title/image/
  CTA in, the component owns only the styling). Content and styling are separate
  axes here, so "keep it or rebuild it" is not a real question — the design's
  _content_ always lands via props, and the only decision is whether the shared
  _styling_ may move. Offer these the third option below as their default.
- **Shared, not prop-driven** (its content lives inside it). Keep-as-is is the
  recommended answer: a page-level frame is not a mandate to restyle other pages.
- **Used only on this page.** Rebuild freely; nothing leaks.

```yaml
header: "Keep as-is"
question: "These components overlap with the design. Per component: keep its current styling, rebuild it from the design, or change only this page's props?"
options:
  - label: "{Component} — props only (Recommended)", description: "{path} — prop-driven, also on {/x, /y}. This page gets the design's content; the shared styling stays untouched."
  - label: "{Component} — keep as-is (Recommended)", description: "{path} — also on {/x, /y}; rebuilding changes those pages too"
  - label: "{Component} — only here", description: "{path} — safe to rebuild from the design"
multiSelect: true
```

Order shared components (used on >1 page) first — those are the ones where a
page-level design decision leaks site-wide. More than 4 matches → name the
remainder in one prose line above the modal; the built-in Other reaches them.

A "props only" answer puts the file in `$PRESERVE` **and** records that this
page's props are in scope: 2.1's STOP boundary still applies to its class names,
colors, spacing and radii, while the page file may pass whatever the design
specifies. A design detail reachable only by restyling the component (a badge
rendered as a pill where the code renders a checklist) is reported in the
Generation Summary, not silently applied.

Store the selected paths as `$PRESERVE[]`. It is read again at 2.1, 2.2, the
verification loop's 3.2c, and the PHASE 3.5 refine round.

<!-- Rationale: a real run restyled three existing sections from the frame, one
of which mounted on four pages, and had to be reverted after the user twice
answered a modal with free text saying which components to leave alone. The
reuse rule existed (see Restrictions) but had no decision point, no variable,
and no gate — so nothing in the flow ever asked. -->

---

### 0.6c Content-Source Check (page scope, existing route only)

Runs when scope is a full page AND the target route already exists. Skip for
component/patch scope and for `$TARGET_PAGE_CONFIRMED = "new"` — nothing is
rendering data there yet.

The verification loop compares pixels, not truth. A page whose sections render
CMS/API data screenshots as `Match quality: High` while showing seed or demo
records: the layout is right and only the content is fictional. Nothing later in
this route looks at the data, so nothing catches it.

1. Read the target page file's imports. Data-backed when it imports a CMS/ORM
   client (`@/sanity`, `contentlayer`, `prisma`, `@/lib/api`, …) or awaits a
   fetch in the page body. No such import → print
   `Content source: static (no CMS)` and skip to 0.6b.
2. Query that source for the records the page renders — the project's own client
   or a read-only HTTP query, whichever is cheaper. **Never write here.**
3. Report count and provenance:

   ```
   Content source: {client} · {n} records
   Placeholder-looking: {m}
     [ids prefixed demo-/test-/example-/seed-, lorem-ipsum
      body text, or stock-photo asset hosts]
   ```

4. `m > 0`, or the count sits far below what the design's sections imply → ask:

   ```yaml
   header: "Content"
   question: "This page renders {client} data and {m} of {n} records look like placeholders. Verify the conversion against those?"
   options:
     - label: "Fill real content first (Recommended)", description: "Against demo records the verification loop proves nothing — the layout passes while the page shows fiction"
     - label: "Convert against placeholders", description: "Build the markup now; real content follows later via /design-convert --content {name}, or the Fill-content aspect at re-entry (0.4c)"
     - label: "Cancel", description: "Stop without changes"
   multiSelect: false
   ```

Store the answer as `$CONTENT_STATUS`. `placeholders` → PHASE 3.4's final
assessment carries `Content: placeholders — layout verified, content not`, and
4.4b lists it as an open gap. A `Match quality: High` claimed over demo data is
a false statement the report must not make silently.

<!-- Rationale: a real run converted a projects page whose CMS held three
fictional demo records. The loop would have signed off a page of invented
content as High — the pixels were correct. It surfaced only because the executor
queried the dataset on its own initiative. The skill already knows about CMS
content (convert-audit.md Step A tags contentSource: "cms"), but only on the
audit path; the generation path had no data check at all. -->

## PHASE 1: Mode Procedure

**Two confirmations are mandatory here, and both are load-bearing:** `$MODE` (1:1 copy vs inspiration vs sketch) is chosen by the user at 0.3 — never inferred from the source's fidelity alone — and this phase's output table is confirmed by the user before PHASE 2 starts. They are stated here rather than only in the Restrictions block at the end of this file, because a rule that lives 150 lines past the phase it governs gets read after the phase has already run.

Execute the **PHASE 1** section of the loaded `convert-mode-{$MODE}.md`:

- **copy** → Fidelity Extraction (ground-truth computed styles for URL sources, exact-value table)
- **inspiration** → Inspiration Brief (questioning round per `shared/QUESTIONING.md`) + Token Mapping
- **sketch** → Fidelity Filter + Token Mapping

Every mode ends PHASE 1 with a user-confirmed table and its own `ExitPlanMode` point — after that, all remaining phases (codegen, verification, completion) run in Sonnet.

**Patch paths (any scope = patch) skip PHASE 1 entirely** — their plan-mode exit happened in patch detection Step 4.

**Content-fill paths (`$ASPECT = "content"`, 0.4c) skip PHASE 1 and PHASE 2 entirely** — go straight to **PHASE 2c Content Fill** below. Its own confirmation gate (`convert-content-review.md`) plays the same role PHASE 1's confirmed table plays for codegen, and its own `ExitPlanMode` point precedes `convert-content-apply.md`'s writes.

**Audit path (`$SCOPE = audit`) replaces PHASE 1 + code generation entirely** — read `references/convert-audit.md`. It runs section discovery, per-section ground-truth extraction, and the discrepancy report, ending with a confirmed `$PATCH_SECTIONS` and its own `ExitPlanMode` point; then PHASE 2.0 Patch Guard applies the accepted fixes and PHASE 3 verifies (including the exact-value check in 3.2c). Do not run a mode file's PHASE 1 for audit — no `$MODE` selection is needed.

---

## PHASE 2: Code Generation

### 2.0a PHASE 1 Gate

**STOP** when `$SCOPE ∉ {patch, audit}` and no user-confirmed PHASE 1 artifact exists — the fidelity table (copy) or the token mapping (sketch/inspiration).

Without it, codegen runs off the screenshot alone: the exact values `convert-mode-{$MODE}.md § 1.0` extracts never entered the run, 3.2c has no ground truth to compare against, and the first time anyone notices is when the user starts correcting the rendered page section by section. Nothing downstream errors on its absence, which is precisely why this gate is explicit.

Return to PHASE 1, read the mode file, produce the table, and run its 1.2 confirm before continuing.

### 2.0b Forbidden Patterns Load

Before any generation, load project-specific bans:

1. Read `design.principles[*].forbid[]` from `project.json`. Collect all strings into `$FORBID_LIST`.
2. If `design.banPacks[]` is non-empty: read `shared/ANTI-SLOP.md`, load entries for each named pack, append to `$FORBID_LIST`.
3. Show count:
   ```
   Forbidden patterns: [N] loaded ([pack names if any] + [M principle rules])
   ```
   If $FORBID_LIST is empty: skip silently (no bans active).

`$FORBID_LIST` is injected into the codegen prompt in 2.2 as a "FORBIDDEN PATTERNS" section. After generation (2.3), run a sanity grep: scan each generated file for forbidden patterns. If a violation is found: note in Generation Summary, then regenerate that file with `"you emitted forbidden pattern [code]: do not use [pattern]. Replace with: [fix]."` in the prompt.

### 2.0 Patch Guard (scope = patch or audit only)

If `$SCOPE ∉ {patch, audit}`: skip this section and go directly to 2.1.

**Reversibility checkpoint first.** These scopes never reach 2.1, so run **§2.1b** here before the first Edit, using `$PATCH_SECTIONS`' `file` values as the write set. Patch and audit edit existing files by definition — this is the scope the checkpoint matters most for.

Per section in `$PATCH_SECTIONS`:

1. Read the relevant lines in the existing component file (Read tool). Skip for `contentSource: "cms"` entries (see step 2a below) — there is no component file line to read, the content lives in the CMS.
2. Generate only the changed JSX/classes/structure based on `$SOURCE_IMAGE`.
   For `$SCOPE = audit` on **value-level** mismatches: each `$PATCH_SECTIONS` entry carries `{file, property, oldValue, figmaValue}` from the discrepancy report — the Edit is a direct value swap (find the exact old value string, replace with the Figma value), no regeneration and no reliance on `$SOURCE_IMAGE`. If `$PATCH_SECTIONS` is empty (audit "Report only" was chosen): skip straight to PHASE 3.
   For `$SCOPE = audit` on a **segment mismatch flagged `needsMarkup: true`** (convert-audit.md Step D): this is the one value-level case that is _not_ a value swap. The design has a two-tone heading and the code renders it as a single colored element — there is no old value string to replace, the accent segment has no element of its own. Wrap that segment in a `<span>` carrying the Figma color and leave the rest of the heading untouched: `Protect your <span className="text-[#FF5733]">building</span>`. Adding this one element is in scope; restructuring the surrounding markup is not. Skipping it because "Edit only, no regeneration" reads as forbidding it is how this mismatch survives an audit that reported it.
   For `$SCOPE = audit` on a **structural mismatch** (convert-audit.md Step D escalation fired): `$PATCH_SECTIONS` carries section-level work items, not property diffs — this step's "direct value swap, Edit only" rule does not apply. Treat each item as normal codegen instead: new sections → Write a new component file + import it; reordered/rewritten sections → full-file Edit; retired sections → remove the import/usage from the page file only (leave the component file on disk unless the user asked to delete it).

2a. **CMS-backed sections** (`contentSource: "cms"`, tagged in `convert-audit.md` Step A): a CMS write has none of PHASE 4's rollback safety net — that machinery (scoped commit, worktree, recoverable before-state) protects code, not external state. Before mutating:

- Capture the before-values in the report (what's being overwritten, not just what it becomes).
- Confirm the target dataset/environment explicitly with the user (production vs preview/staging) — never assume which one a query/client points at.
- Prefer emitting a runnable migration/patch script the user reviews and runs, over a direct mutation, unless the user has explicitly opted into direct writes for this run.
- Wrong **images** get a different disposition than wrong **text**: text is generally fixable straight from the Figma ground truth; a wrong stock photo needs a real asset this route doesn't have — flag it `needs asset from user` rather than substituting a different placeholder.
- Then mutate via the project's CMS client/API (not the Edit tool — there is no file to Edit).

3. Apply via **Edit tool** — never Write — for value-level patches on `contentSource: "code"` sections. Structural-mismatch items follow the codegen rule above instead; CMS-backed sections follow 2a instead. Find the exact string, replace only that block (value-level) or the full section (structural).
4. Show a brief summary per edit — this is the artifact that makes the change auditable after the fact, don't skip it even when the diff feels obvious:
   ```
   PATCH: [section-name]
   ─────────────────────────
   File: [path:line]                    (or: CMS document/field, for 2a)
   Change: [description — e.g. "CTA text + variant updated"]
   ```

After all edits: for any `contentSource: "cms"` section, re-fetch/hard-reload before the PHASE 3 render — Next.js ISR/data-cache (or equivalent) can serve the pre-mutation response and make a real fix read as failed. Then go to PHASE 3 (verification) with the new screenshot as target. Skip 2.1 and 2.2.

### 2.1 Plan Output Structure

Based on scope (page vs component), framework, and reusable components:

```
GENERATION PLAN
════════════════════════════════════════════════════════════

Output:
  Page file:    [path]
  Components:   [list with paths]
  Reusing:      [existing components to import]
  Preserved:    [$PRESERVE paths — styling untouched] | none

Strategy per section:
  [Section 1] → [new component | reuse existing | PRESERVE]
  [Section 2] → [new component | reuse existing | PRESERVE]
  ...
  {When $BUILD_SECTIONS (0.4c) is a strict subset of $ANALYSIS.Sections: list ONLY the sections in
   $BUILD_SECTIONS here — sections outside it are not generated and not stubbed this run.}

{Per shared component NOT in $PRESERVE that this run will restyle:}
Leaks:
  ⚠ restyling [Component] also changes [/a, /b]

{If $VARIANTS is non-empty:}
Variant components:   (React+Tailwind → cva; else native, per CODEGEN.md)
  [ComponentName] → [cva | native] ([axes: type × size])
  [ComponentName] → [cva | native] ([axes: state])

{If $STATES is non-empty:}
State components:
  [ComponentName] → loading: skeleton | error: boundary | empty: state

════════════════════════════════════════════════════════════
```

**Existing components are imported, not regenerated.** A section whose visual
pattern already has a component in the codebase gets that component imported and
given props — it does not get a second, near-identical implementation written
from the frame. This is stated here as well as in the Restrictions block at the
end of the file, for the same reason PHASE 1 restates its two gates: a rule that
lives 300 lines past the phase it governs is read after that phase has run. The
`Strategy per section` line above is where the decision becomes visible; a
`new component` on a section that matched the 0.6 scan needs a reason in the plan.

**`$PRESERVE` is a hard boundary.** **STOP** before editing any file in
`$PRESERVE`: those files may gain a prop, a call site, or a new import — their
existing class names, colors, spacing, and radii stay exactly as they are. If the
design cannot be reached without restyling a preserved file, say so in the
Generation Summary and leave it alone. Reaching the design is not worth silently
overriding the answer the user gave at 0.6b.

**Template reuse check:** if an already-converted page implements the same section structure (e.g. sibling pages generated from one design template — sector/product variants), plan the run as **reuse + content variation**: import that page's section components and vary only content/assets. Note in the plan when the remaining siblings would be better served by `/design-convert --content` than by full conversions. Never regenerate near-identical components side by side.

### 2.1b Reversibility Checkpoint

Runs after the GENERATION PLAN above is printed and **before 2.2 writes anything**. This is the first point in the route where the run knows its own blast radius: the plan names every file it will write, edit or delete, and `$PRESERVE` (0.6b) is resolved. §0.5c cannot do this — neither exists yet there.

Trigger this check only when **all** of the following hold:

- `$IS_WORKTREE = false` (no worktree was created in 0.5b) — inside a worktree, dirty work on the main branch is untouched by this run regardless, so there's nothing to protect and no need to double up with `WORKTREE-CREATE.md`'s own dirty-work guard.
- The working tree is dirty: `git status --porcelain` is non-empty.
- **The plan's write/edit/delete set intersects the dirty set.** Compute the intersection from the `Output`/`Strategy per section` lines above — never infer it from `$TARGET_PAGE_CONFIRMED`. A run that creates a brand-new page still overwrites as much as an audit does the moment it reuses, generalises or retires an existing component, and "new page" is exactly the case that reads as safe. Empty intersection → skip the modal, print `Checkpoint: skipped (dirty files don't overlap this run's targets)`, and go straight to 2.2. A dirty tree elsewhere in the repo is not at risk from this run, and asking about it spends a modal on nothing.

<!-- Rationale: a real run converted a new /diensten/buitenwerkzaamheden page and,
in the same pass, deleted two shipped components and edited ten existing pages. The
0.5c version of this check skipped itself on `$TARGET_PAGE_CONFIRMED = "new"` before
its own dirty-intersection test could run. The intersection happened to be empty that
time; had the user been mid-edit in one of the deleted files, it was gone. -->

When triggered:

```yaml
header: "Reversibility"
question: "The working tree has uncommitted changes, and this run will overwrite or delete existing files ({target}). Commit a checkpoint first so the run stays reversible?"
options:
  - label: "Checkpoint first (Recommended)"
    description: "Commit the current working tree as a WIP checkpoint — any overwrite after this becomes a `git revert`/`checkout` away from undone"
  - label: "Continue without a checkpoint"
    description: "Proceed as-is — overwrites of uncommitted work won't be recoverable via git"
  - label: "Cancel"
    description: "Stop this run without making any changes"
multiSelect: false
```

- **"Checkpoint first"**: `git add -A && git commit -m "chore: wip checkpoint before /design-convert {target}"`. Deliberately `-A` + `chore` — this is a safety WIP point the user can later `git reset --soft` away, not a scoped feature commit (contrast with §4.5b's scoped, filtered commit at the end).
- **"Continue without a checkpoint"**: no commit; proceed to 2.2.
- **"Cancel"**: stop the route cleanly, no code generated.
- Trigger conditions not met → proceed to 2.2.

`{target}` names the intersecting files, not the page — the user is deciding about work that is already on disk, so the paths at risk are the useful thing to show.

### 2.2 Generate Code

> **Todo**: Read `.claude/skills/shared/VERCEL-CONTEXT.md` — follow the Load Protocol, then apply the guidelines as a bias layer for the generation below. Loaded here, not at route entry: it is a codegen bias layer only, so a run that stops in PHASE 0/1, or an audit that reports without patching, never pays for it.

> **Todo**: Read '.claude/skills/design-convert/references/convert-generate-template.md'

### 2.3 Generation Summary

```
CODE GENERATED
════════════════════════════════════════════════════════════

Files created:
  ✓ [page file path]              (page)
  ✓ [component path]              (new)
  ✓ [component path]              (new)

Existing components imported:
  ✓ [component path]              (reused)

Preserved (styling untouched):
  ✓ [component path]              (0.6b)

{If cva used but not present in package.json:}
Dependencies:
  ⚠ cva missing — npm install class-variance-authority

Mode:       [1:1 copy | Inspiration | Sketch→high-fi ({$FIDELITY})]
Theme:      [From project.json#theme | Extracted from source]
Dark mode:  [✓ dark: classes applied | — no dark mode in theme]
Responsive: [✓ prefixes applied | — single viewport (TODO placed)]
States:     [✓ generated: [loading|error|empty] | — none detected]

════════════════════════════════════════════════════════════
```

---

## PHASE 2c: Content Fill (`$ASPECT = "content"` only, from 0.4c)

Reached only via 0.4c's "Fill content" branch — never from a fresh full/component build. Fills real,
on-brand copy into sections already `build: "built"` in `sectionState[]` (`$BUILD_SECTIONS` here is
the `content`-scoped picker's selection, drawn from `$BUILT_NO_CONTENT`, not from `$UNBUILT`). Skips
PHASE 1 and PHASE 2 entirely — nothing renders differently pixel-wise from a copy swap in the way
PHASE 3's screenshot-diff checks, so PHASE 3 is skipped too; `convert-content-review.md`'s
before/after table is this branch's equivalent "show the user the result" step, replacing PHASE 3.5.

1. Read `.claude/skills/design-convert/references/convert-content-scope.md` — archetype
   classification + content brief for `$TARGETS = [{name: $CONVERT_TARGET, sections:
$BUILD_SECTIONS}]` (single-target shape — this branch is always single-target, since it arrived
   via an already-resolved convert run; `route-content.md`'s own batch-mode PHASE 0 is not re-entered
   here).
2. Read `.claude/skills/design-convert/references/convert-content-generate.md` — produces
   `$COPY_MAP`.
3. Read `.claude/skills/design-convert/references/convert-content-review.md` — before/after table,
   Apply all / Edit per item / Regenerate / Cancel.

   > **Todo**: Use the `ExitPlanMode` tool once the review approves a course of action (Apply all, or
   > Edit-per-item's final confirm) — before `convert-content-apply.md` writes anything. Plan mode was
   > entered at PHASE 0.2, before this branch existed; this is this branch's one `ExitPlanMode` point,
   > the same role PHASE 1's confirmed table plays for codegen.

4. Read `.claude/skills/design-convert/references/convert-content-apply.md` §5.1 (Apply copy) and
   §5.2 (Glossary write) only — §5.4 (backlog sync) and §5.5 (completion report) are NOT run here;
   `convert-completion.md` (PHASE 4, unchanged entry point) is this branch's single completion
   authority, so the run's backlog/devinfo/commit/report logic is never duplicated between the two
   paths that can reach content-fill (this branch, and the standalone `route-content.md`).

On "Cancel" (convert-content-review.md §4.6): stop the route cleanly, same as any other cancel path
in this file — no PHASE 4.

After step 4: proceed directly to **PHASE 4** (`convert-completion.md`) — skip PHASE 3 and PHASE 3.5.

---

## PHASE 3: Visual Verification Loop

> **Todo**: Read '.claude/skills/design-convert/references/convert-verification-loop.md' — this is not a generic screenshot loop you can reconstruct from memory or project instructions. It carries the §3.2 seven-point discrepancy checklist (including "no blank areas" and "missing elements" — the two checks that catch a broken/fabricated asset path), the round-1 runner baseline spec, and §3.2c (a computed-style diff against `$EXTRACTED_STYLES` — the only mechanism that can confirm which colors actually shipped). A self-designed substitute will not contain these. Do not improvise this phase.

The loop is scope-aware (see its § Scope selection): generation scopes (copy/sketch/inspiration) run the full round-based screenshot-diff loop; `$SCOPE = audit` runs a lighter pass (render + console + 3.2c exact-value re-check — no pixel-diff rounds), and structural-audit adds a section-presence check.

---

## PHASE 3.5: Refine With the User (REQUIRED before PHASE 4)

PHASE 3 checks the output against the **source**. It cannot check it against the
user's intent — proportion, weight, which of two defensible readings of a frame
is the right one. `Match quality: High` at 3.4 means the values are right, not
that the page is done, and treating it as done is how a run reaches PHASE 4 with
the bookkeeping finished and the page still wrong.

Skip only when 3.0 resolved no browser vehicle (nothing was rendered, so there is
nothing to show). Every other path runs it, including patch and audit. **PHASE 2c
(content-fill) never reaches this phase at all** — it jumps straight from PHASE 2c to PHASE 4;
`convert-content-review.md`'s before/after table already served this phase's "show the user before
PHASE 4" role.

> **Todo**: Read '.claude/skills/design-convert/references/convert-refine-round.md'

---

## PHASE 4: Completion + Finalize (REQUIRED after PHASE 3.5)

PHASE 4 is mandatory — the convert route is not complete without it. Load and execute `convert-completion.md` immediately after PHASE 3.5 ends, **before reporting completion to the user**. PHASE 4 writes the backlog, the handoff, and the commit: it runs after the user has accepted the result at 3.5, never before.

Without PHASE 4:

- backlog is never synced to DONE (4.2)
- the run's output is never committed, leaving no recoverable "before" state on disk (4.5b)
- worktree remains unmerged on disk and `/diensten`-style routes are unreachable on main (4.6)
- next session opens with stale handoff data (4.1)

  4.4 only prepares report fields and (optionally) opens a live preview — it is **not** the end of the workflow. The user-visible `CONVERT BUILD COMPLETE` report is printed at the end of 4.5b, after 4.4b (user confirms the result) and the scoped commit. If you find yourself about to end the skill after 4.4 without having committed and shown that report: re-read convert-completion.md from §4.4b onward.

> **Todo**: Read '.claude/skills/design-convert/references/convert-completion.md'

---

## Restrictions

This route must **NEVER**:

- Generate code without first analyzing the source image
- Use "Lorem ipsum" — always use contextual content from the source or realistic placeholders
- Run sketch or inspiration mode without theme (project.json#theme empty)
- Reach PHASE 2 (or PHASE 2c) with plan mode still active — every path has exactly one `ExitPlanMode` point (mode file 1.2, patch detection Step 4, audit Step D, or PHASE 2c's content-review approval)
- Skip the `EnterPlanMode` call at PHASE 0.2 (or the patch fast-path's own call) when plan mode isn't already active — the check above only catches "still active at PHASE 2," not "never entered"
- Skip the visual verification loop when 3.0 resolves any browser vehicle, or substitute an improvised check for the procedure in `convert-verification-loop.md`
- Run a production build while the verification dev server is running — see `convert-verification-loop.md § 3.1`
- Reference an asset path that does not exist on disk or as a captured live URL — see `convert-mode-copy.md § Codegen Rules`
- Regenerate components that already exist in the codebase — import and reuse (restated at 2.1, which is where the decision is made)
- Restyle a file in `$PRESERVE` — the 0.6b answer outranks the design (STOP gate at 2.1)
- Exceed 3 verification rounds in PHASE 3 — PHASE 3.5's refine rounds are uncapped and are not verification rounds
- Reach PHASE 4 without PHASE 3.5 having shown the user a screenshot, whenever 3.0 resolved a browser vehicle — PHASE 2c's own `convert-content-review.md` before/after table is that branch's equivalent and satisfies this rule for content-fill runs

This route must **ALWAYS**:

- Resolve visual input before any code generation
- Confirm mode and the PHASE 1 output table with the user — both gates are stated at PHASE 1 itself and enforced by the 2.0a STOP
- Follow `shared/FRONTEND-RULES.md` (React/Next.js, HTML/CSS, A-series) and `shared/PATTERNS.md` (Component, Layout)
- Detect and match the project's framework
- Run the verification loop on whichever vehicle 3.0 resolves — only its rung 4 skips it
- Send the result as an image in PHASE 3.5 before any PHASE 4 bookkeeping runs
- Update DevInfo for downstream skill handoff
- Show a completion report with next steps
