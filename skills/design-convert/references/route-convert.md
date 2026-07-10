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

**Patch fast-path:** if `$PATCH_MODE = true`, skip PHASE 0.1 through 0.4b Steps 1-2 and jump directly to **PHASE 0.4b Step 3**.

> **Todo**: In patch fast-path, use `EnterPlanMode` (same rationale as the main-flow Todo below) before jumping to PHASE 0.4b Step 3; use `ExitPlanMode` after Step 4 (Confirm), before PHASE 2 Patch Guard.

---

**Step 0: External setup context**

> **Todo**: Read `.claude/skills/shared/VERCEL-CONTEXT.md` — follow the Load Protocol, then apply the guidelines as a bias layer throughout this route.

---

## PHASE 0: Convert Pre-flight

**If `$PATCH_MODE = true`:** skip PHASE 0.1 through 0.4b Steps 1-2 — jump to **PHASE 0.4b Step 3**.

### 0.1 Visual Input Resolution

Determine the input type from the argument or conversation:

| Input                                             | Detection                                              | Action                                                                                              |
| ------------------------------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Figma URL, MCP connected                          | URL contains `figma.com` AND figma MCP tools available | MCP capture (see "For Figma URLs (MCP)" below); set `$INPUT_SOURCE = "figma-mcp"`                   |
| Figma/Canva URL (`figma.com`, `canva.com`)        | URL contains `figma.com` or `canva.com` — no figma MCP | CLI: `playwright-cli open [url]` → `playwright-cli screenshot`; set `$INPUT_SOURCE = "design-tool"` |
| File path (`/home/...`, `C:\...`, `.png`, `.jpg`) | Contains path separator or image extension             | Read file with Read tool (multimodal); set `$INPUT_SOURCE = "file"`                                 |
| URL (`http://`, `https://`)                       | Starts with protocol                                   | CLI: `playwright-cli open [url]` → `playwright-cli screenshot`; set `$INPUT_SOURCE = "url"`         |
| Image in chat                                     | No path/URL, image data present                        | Analyze directly from conversation; set `$INPUT_SOURCE = "chat-image"`                              |
| None                                              | No argument, no image                                  | Ask user (see below)                                                                                |

**No input provided:**

```yaml
header: "Visual Input"
question: "What do you want to convert? Paste a screenshot, provide a file path, a website URL, or a Figma/Canva share link."
options:
  - label: "I'll paste a screenshot or image", description: "Paste wireframe, sketch, or screenshot in the next message"
  - label: "Figma or Canva link", description: "Share link from Figma (via figma MCP when connected) or Canva (via Playwright)"
  - label: "File path", description: "Path to screenshot, export, or image file"
  - label: "Website URL", description: "URL of a live website to capture and convert"
multiSelect: false
```

**For Figma URLs (MCP):** requires the remote Figma MCP server (`mcp.figma.com`) to be connected — check that `mcp__figma__*` tools are available (load via ToolSearch if deferred). If unavailable, do NOT degrade silently — follow the fallback ladder: REST API (still ground truth) beats screenshot estimation. Check whether a Figma API token is available (`$FIGMA_TOKEN` env var), then ask:

```yaml
header: "Figma MCP"
question: "The Figma MCP server is not connected. How to proceed?"
options:
  - label: "Fix the connection first (Recommended)", description: "Stop here — run /mcp to (re)authenticate figma, then re-run this conversion"
  - label: "REST API fallback", description: "Exact values via api.figma.com — ground truth without MCP" # include only when $FIGMA_TOKEN was found
  - label: "Screenshot fallback", description: "Vision estimation — values will be marked 'estimated'. Best source: a frame PNG exported from Figma (right-click frame → Export)"
multiSelect: false
```

On "Fix the connection first": exit the skill. On "REST API fallback": follow the REST procedure below. On "Screenshot fallback": ask the user to export the frame as PNG and provide the file path (pixel-perfect, preferred); only if they can't, fall back to the design-tool row (Playwright capture of figma.com — last resort, canvas rendering is unreliable).

**REST API fallback (`$INPUT_SOURCE = "figma-rest"`):** parse the file key and node id from the URL — `figma.com/design/{key}/...?node-id={id}` (the id uses `-` in URLs, `:` in API calls).

```
curl -sH "X-Figma-Token: $FIGMA_TOKEN" "https://api.figma.com/v1/images/{key}?ids={id}&format=png&scale=2"
  → returns JSON with an image URL — download it to .project/tmp/source-capture.png → Read it → $SOURCE_IMAGE
curl -sH "X-Figma-Token: $FIGMA_TOKEN" "https://api.figma.com/v1/files/{key}/nodes?ids={id}" > .project/tmp/source-node.json
  → node tree with exact fills, typography, layout → $SOURCE_STRUCTURE
```

Downstream, `figma-rest` behaves like `figma-mcp`: 0.2 derives structure from `$SOURCE_STRUCTURE`, and the mode files (PHASE 1) take ground-truth values (labeled `computed`) from the node-tree JSON instead of `get_design_context` / `get_variable_defs`.

**Do not offer `.fig` file parsing as a fallback** — the format is a proprietary binary (fig-kiwi); community parsers are reverse-engineered and break on format updates. A user who can export `.fig` can also export a frame PNG or create an API token.

1. The link must target a specific frame (`node-id` param in the URL). If it points to a whole file/canvas: ask the user for a frame link (right-click frame → _Copy link to selection_). If the frame name suggests a draft or duplicate (contains "V2", "test", "copy"/"kopie", "old", or the metadata shows sibling frames with near-identical names): confirm with the user that this frame is the final version before proceeding.
2. `get_screenshot` on the node link → save to `.project/tmp/source-capture.png` → Read it. This becomes `$SOURCE_IMAGE`.
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

> **Todo**: Use the `EnterPlanMode` tool now — Phases 0.2 (Visual Analysis), 0.3 (Mode), 0.4 (Scope), and the mode file's PHASE 1 all benefit from Opus-level vision and design reasoning. `AskUserQuestion` modals and Bash reads remain available inside plan mode; only Write/Edit are blocked, which is fine until Phase 2. Skip `EnterPlanMode` if plan mode is already active (see `shared/PLAN-MODE.md § Entry`).

### 0.2 Visual Analysis

Analyze the source image. Extract:

```
SOURCE ANALYSIS
════════════════════════════════════════════════════════════

Type:       [Full page | Section/component | Multiple components]
Sections:   [enumerated list of visual sections top-to-bottom]
Layout:     [single column | multi-column | grid | sidebar + content | etc.]
Responsive: [single viewport | mobile + desktop | mobile + tablet + desktop | unknown]
Sizing:     [per key element: fixed (explicit px/rem) | fill (flex:1 / width:100%) | hug (fit-content/auto)]
Fidelity:   [low | medium | high]
            low    = handdrawn/monochrome, placeholder boxes, no typography detail
            medium = Figma/Canva draft, rough colors, partial components, not pixel-accurate
            high   = polished mockup or live-site screenshot, pixel-accurate
Key colors: [dominant colors as hex, max 5]
Dark mode:  [light only | dark only | both visible | unknown]
Typography: [heading style, body style — approximate]
Components: [identifiable UI patterns: cards, nav, hero, form, table, etc.]
Variants:   [component name → detected variant axes: size=sm/md/lg, state=default/hover/disabled, type=primary/ghost]
            [or: no variants detectable]
States:     [no separate state frames | loading | error | empty | success]
            Detect only frames/artboards that explicitly show a non-default state. Store as $STATES.
Properties: [design properties with direct CSS mapping — note only what is visibly present:
              fill → background-color/color: [value(s)]
              stroke → border: [value(s)]
              corner-radius → border-radius: [value(s)]
              shadow → box-shadow: [value(s)]
              opacity → opacity: [value(s)]
              rotation → transform: rotate([value(s)])]
Motion intent: [detected motion/animation cues — note what is present:
                transitions: [elements with visible transition/animation frames]
                hover states: [if hover variants shown: element → effect]
                animated: [elements labeled "animated" or with motion arrows/paths]
                glass/blur: [backdrop-filter surfaces visible?]
                spring/bounce: [bouncy or elastic motion implied?]
                → store as $MOTION_INTENT (description string or "none detected")]

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

### 0.25 Target Page Identity Check

Only when `$INPUT_SOURCE ∈ {figma-mcp, figma-rest}` AND `$ANALYSIS` Type = `Full page` — a full-page frame is the only case where "which page does this become" is ambiguous; single components/sections always go straight to the scope selection in 0.4.

**Why this exists:** a full-page Figma frame containing Hero/Footer/Contact pattern-matches "looks like a homepage" structurally, but that is not proof it IS the homepage — a per-category landing page (product/service/sector page) has the exact same anatomy. Skipping this check once caused a real Figma-derived page (named "Brandbeveiliging" in the source file) to silently overwrite an unrelated, already-shipped homepage via the 0.4 audit path below — nothing had been committed in between, so the original homepage content was only recoverable from the conversation transcript, not from disk. A homepage-shaped frame must never be allowed to imply it targets the homepage without this check.

1. Read the frame's own top-level name (from `$SOURCE_STRUCTURE` / the frame node metadata captured in 0.1).
2. Classify it:
   - **Generic** — matches `home`, `homepage`, `landing`, `index`, `main`, or the project name itself (case-insensitive) → no extra check, set `$TARGET_PAGE_CONFIRMED = "homepage"` and proceed to 0.3.
   - **Specific** — anything else (a product/service/sector/category name) → this is a signal the frame may represent its OWN page, not the existing homepage. Continue to step 3.
3. Run a lightweight existing-route check (framework-appropriate; for Next.js App Router: `find app -maxdepth 2 -name "page.tsx"`) to see whether a route matching the frame name already exists. Use the result as context in step 4, not as a silent decision.
4. **AskUserQuestion — mandatory when step 2 classified the frame as Specific; no recommendation heuristic in 0.3/0.4 may substitute for this:**
   ```yaml
   header: "Doelpagina"
   question: "This Figma frame is named '{frameName}'. Which page should it become?"
   options:
     - label: "New page at /{kebab-frameName}", description: "No matching route found yet — recommended when the frame name is a distinct product/category" # append (Recommended) when step 3 found no existing route
     - label: "This IS the existing homepage", description: "Confirm explicitly that this frame should replace app/page.tsx (or the project's detected homepage route)"
     - label: "A different existing page", description: "I'll specify the target route myself"
   multiSelect: false
   ```
5. Store the answer as `$TARGET_PAGE_CONFIRMED` (`new` | `homepage` | `other:{route}`):
   - `new` → the target route is `/{kebab-frameName}` (or a route the user names). Scope in 0.4 defaults to a normal "Full page" build against that new route — do **not** offer "Audit existing page vs design" (there is nothing existing at that route to audit against), and skip its auto-nudge signals entirely.
   - `homepage` → proceed exactly as the rest of this file already describes; 0.4's audit-option/auto-nudge logic applies unchanged.
   - `other:{route}` → same as `homepage`, but every later reference to "the homepage" / `app/page.tsx` in 0.3–0.5 means the given route instead.

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

> **Todo**: Read '.claude/skills/design-convert/references/convert-mode-{$MODE}.md' — it defines this mode's theme requirement (applied in 0.6), PHASE 1 procedure with its `ExitPlanMode` point, codegen rules (applied in 2.2), and verification thresholds (applied in PHASE 3).

### 0.4 Scope Detection

Based on the visual analysis (0.2), confirm the output scope:

```yaml
header: "Scope"
question: "What should the output be?"
options:
  - label: "Full page (Recommended)", description: "Page file + section components"
  - label: "Single component", description: "Generate only this component"
  - label: "Multiple separate components", description: "Each visual block as a separate component"
  - label: "Update existing component", description: "Patch based on new screenshot — only changed sections"
  - label: "Audit existing page vs design", description: "Reconcile an already-built page against the full Figma design — sweep every section, flag wrong values (colors/text/spacing/radii), then patch only the mismatches. Needs a ground-truth source (Figma MCP/REST or URL)."
multiSelect: false
```

**Availability guard:** only offer "Audit existing page vs design" when `$INPUT_SOURCE ∈ {figma-mcp, figma-rest, url}` — other sources have no per-section exact value to reconcile against; omit the option entirely for `file`/`chat-image`/`design-tool` sources (their path is patch). **Additionally, when 0.25 ran** (full-page figma-mcp/figma-rest source): omit the audit option entirely when `$TARGET_PAGE_CONFIRMED = "new"` — the user already confirmed this frame targets a page that doesn't exist yet, so there is nothing to audit against.

**Recommended marker (auto-nudge):** show `(Recommended)` after the audit option instead of "Full page" when `$INPUT_SOURCE ∈ {figma-mcp, figma-rest}` AND `$ANALYSIS` Type = `Full page` AND either signal below fires. Otherwise keep `(Recommended)` on "Full page" as today.

- **Phrase signal (weaker):** the conversation implies an already-built page needing reconciliation (phrases like "already built", "existing page", "does it match", "check against the design", "reconcile"; NL: "bestaande pagina", "al gedaan", "klopt het", "controleer", "tweaks").
- **Backlog-status signal (stronger, prefer this when available):** a page name can already be derived from context (a `$CONVERT_TARGET` set via the backlog-transition lookup in `SKILL.md` PHASE 0.3 Step 3, or a source frame/name that matches an existing `backlog.json` feature by name) AND that feature's `status` is `DONE` or `stage` is `"built"`. This is an objective fact, not a phrasing guess — trust it over the phrase signal when both are checkable, and don't skip it just because the phrase signal didn't fire.

On "Update existing component": skip PHASE 0.5 and go to PHASE 0.4b.

On "Audit existing page vs design": set `$SCOPE = "audit"` and continue normally through PHASE 0.5, 0.5b, and 0.6 (the audit needs the backlog match, worktree, and the light component scan to map Figma sections to code) — then PHASE 1 dispatches to the audit procedure instead of a mode file (see PHASE 1 below). When `$TARGET_PAGE_CONFIRMED = "other:{route}"` (0.25): the audit target is `{route}`, not `app/page.tsx` — carry `{route}` into 0.5's page-file lookup and into `convert-audit.md` Step A.1 in place of the default homepage assumption.

On "Full page" when `$TARGET_PAGE_CONFIRMED = "new"` (0.25): the target page file is `/{kebab-frameName}` (or the user-specified route) — 0.5's backlog/name derivation uses that route's name, not the homepage.

**Visual review (optional).** Once the target name is resolved (after 0.5 for page scope, or from the scope selection for component scope), if the board server is running (`/project-app`) and the entity already exists in `project.json#design`, print its review URL as a plain `http://` URL on its own line so it renders clickable in the Claude Code chat:

```
http://localhost:9876/{project-dir}/review/{target-name}
```

There the user can confirm the detected sections/components as a wireframe and leave open-questions before conversion proceeds; answers persist to `design.{pages|components}[].reviewNotes[]`. Skip the line if the entity is not yet in the design spec.

### 0.4b Patch Detection

Only for scope = patch.

> **Todo**: Read '.claude/skills/design-convert/references/convert-patch-detection.md'

### 0.5 Backlog Task Lookup (page scope only)

If scope is a full page (not a single component):

1. Read `.project/backlog.json` (if exists) → parse JSON
2. See `shared/BACKLOG.md → Lifecycle Protocol → Read`. Filter: `(type === "PAGE" || type === "COMPONENT") && transition === "converting"` — if found, auto-select as task (show: `Backlog: ✓ Task picked up — {taskName}`).
3. If `$CONVERT_TARGET` is set: use it as the page name to match (skip name derivation). Otherwise derive from scope selection. Find feature: `data.features.find(f => f.name === "{kebab-case-page-name}")`
   - **Found**: use as task reference. Do NOT modify `status` or add `stage` during build — the page stays `TODO` until PHASE 4 completion. Skip write.
   - **Not found**: store `$NEW_BACKLOG_ENTRY = { "name": "{name}", "type": "PAGE", "status": "TODO", "phase": "P4", "description": "Converted from visual input", "dependencies": [] }`. **Do not write yet** — Phase 4 completion (4.2) writes the entry along with the DONE sync.

If scope is a component: skip this step.

**Single-page projects:** if the project has no multi-page `backlog.json` structure yet (e.g. a one-page marketing site with no prior PAGE/COMPONENT entries), deriving `$CONVERT_TARGET` here is not load-bearing for the rest of the run — the page file is still locatable directly (it's the only page), and 0.5's name-and-entry bookkeeping can be deferred to PHASE 4 completion (4.2) without any functional loss. Don't block on this step for such projects.

### 0.5b Worktree Setup

Feature-name: use backlog-matched feature name from 0.5 (page scope), or component name derived from scope selection (component scope). Follow `shared/WORKTREE-CREATE.md → Auto-create worktree`. Skip if no clear feature-name is available or if already in a worktree (procedure detects).

### 0.5c Reversibility Checkpoint & Commit Baseline

**Step 1 — Reversibility checkpoint (optional, before the baseline below).** `convert-completion.md §4.5b` only commits once the run finishes cleanly — no help if something goes wrong _mid-run_, before that point is reached (this is exactly how the original homepage-overwrite incident went unnoticed until it was too late to recover from disk). Close that gap here, before PHASE 1/2 write anything.

Trigger this check only when **all** of the following hold — each is cheap to evaluate and already known at this point in the flow:

- `$IS_WORKTREE = false` (no worktree was created in 0.5b) — inside a worktree, dirty work on the main branch is untouched by this run regardless, so there's nothing to protect and no need to double up with `WORKTREE-CREATE.md`'s own dirty-work guard.
- The working tree is dirty: `git status --porcelain` is non-empty.
- This run targets an **already-existing** page/file, not a brand-new one: `$SCOPE = "audit"`, OR (`$SCOPE` = full page AND `$TARGET_PAGE_CONFIRMED ∈ {"homepage", "other:*"}` from §0.25). Skip when `$TARGET_PAGE_CONFIRMED = "new"` or scope is component/patch — those write new files, not over existing ones, so the overwrite risk this guards against doesn't apply.

When triggered:

```yaml
header: "Reversibility"
question: "The working tree has uncommitted changes, and this run will overwrite existing files ({target}). Commit a checkpoint first so the run stays reversible?"
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
- **"Continue without a checkpoint"**: no commit; proceed straight to Step 2.
- **"Cancel"**: stop the route cleanly, no further PHASE 0 steps.
- Trigger conditions not met → skip straight to Step 2, unchanged from before.

**Step 2 — Commit baseline.** Per `shared/SCOPED-COMMIT.md → §1 Baseline` (SHA form) — captured **after** both the worktree switch (0.5b) and any checkpoint above, so it always points at a real, currently-reachable commit:

```bash
mkdir -p .project/session
git rev-parse HEAD > .project/session/pre-convert-sha.txt 2>/dev/null || true
```

This baseline is what `convert-completion.md §4.5b Scoped Commit` diffs against at the end of the run — without it, a direct-on-main convert run (no worktree) leaves no commit and no recoverable "before" state if something goes wrong mid-run. Non-git projects: the `git rev-parse` fails silently (`|| true`), §4.5b's commit step then no-ops via its own guard.

### 0.6 Theme & Project Context

**Theme check:**

Check `.project/project.json` → `theme` section. Apply the **Theme Requirement** section from the loaded `convert-mode-{$MODE}.md` (mandatory with abort for sketch/inspiration, optional for copy).

```
Theme: [Available | Not available]
Mode:  [1:1 copy | Inspiration | Sketch → high-fi (fidelity: {$FIDELITY})]
```

**Motion default:** if `theme.motion` is populated (durations/easings/pack, managed via `/design-tokens`), it is the default motion language for codegen — `$MOTION_INTENT` from the source supplements it but never overrides pack conventions. Design-tool sources rarely encode motion, so the pack is what keeps animation consistent across converted pages. If `theme.motion` is empty and the source or user intent implies animated output: recommend running `/design-tokens` (Motion Pack) once before converting — do not invent per-page motion values.

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
3. Match against sections identified in the source image

```
PROJECT CONTEXT
════════════════════════════════════════════════════════════

Framework:  [detected]
Theme:      [Available (project.json#theme) | Not available]
Existing:   [N] components found
  Reusable: [component names that match source sections]

════════════════════════════════════════════════════════════
```

---

## PHASE 1: Mode Procedure

Execute the **PHASE 1** section of the loaded `convert-mode-{$MODE}.md`:

- **copy** → Fidelity Extraction (ground-truth computed styles for URL sources, exact-value table)
- **inspiration** → Inspiration Brief (questioning round per `shared/QUESTIONING.md`) + Token Mapping
- **sketch** → Fidelity Filter + Token Mapping

Every mode ends PHASE 1 with a user-confirmed table and its own `ExitPlanMode` point — after that, all remaining phases (codegen, verification, completion) run in Sonnet.

**Patch paths (any scope = patch) skip PHASE 1 entirely** — their plan-mode exit happened in patch detection Step 4.

**Audit path (`$SCOPE = audit`) replaces PHASE 1 + code generation entirely** — read `references/convert-audit.md`. It runs section discovery, per-section ground-truth extraction, and the discrepancy report, ending with a confirmed `$PATCH_SECTIONS` and its own `ExitPlanMode` point; then PHASE 2.0 Patch Guard applies the accepted fixes and PHASE 3 verifies (including the exact-value check in 3.2c). Do not run a mode file's PHASE 1 for audit — no `$MODE` selection is needed.

---

## PHASE 2: Code Generation

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

Per section in `$PATCH_SECTIONS`:

1. Read the relevant lines in the existing component file (Read tool).
2. Generate only the changed JSX/classes/structure based on `$SOURCE_IMAGE`.
   For `$SCOPE = audit` on **value-level** mismatches: each `$PATCH_SECTIONS` entry carries `{file, property, oldValue, figmaValue}` from the discrepancy report — the Edit is a direct value swap (find the exact old value string, replace with the Figma value), no regeneration and no reliance on `$SOURCE_IMAGE`. If `$PATCH_SECTIONS` is empty (audit "Report only" was chosen): skip straight to PHASE 3.
   For `$SCOPE = audit` on a **structural mismatch** (convert-audit.md Step D escalation fired): `$PATCH_SECTIONS` carries section-level work items, not property diffs — this step's "direct value swap, Edit only" rule does not apply. Treat each item as normal codegen instead: new sections → Write a new component file + import it; reordered/rewritten sections → full-file Edit; retired sections → remove the import/usage from the page file only (leave the component file on disk unless the user asked to delete it).
3. Apply via **Edit tool** — never Write — for value-level patches. Structural-mismatch items follow the codegen rule above instead. Find the exact string, replace only that block (value-level) or the full section (structural).
4. Show a brief summary per edit:
   ```
   PATCH: [section-name]
   ─────────────────────────
   File: [path:line]
   Change: [description — e.g. "CTA text + variant updated"]
   ```

After all edits: go to PHASE 3 (verification) with the new screenshot as target. Skip 2.1 and 2.2.

### 2.1 Plan Output Structure

Based on scope (page vs component), framework, and reusable components:

```
GENERATION PLAN
════════════════════════════════════════════════════════════

Output:
  Page file:    [path]
  Components:   [list with paths]
  Reusing:      [existing components to import]

Strategy per section:
  [Section 1] → [new component | reuse existing]
  [Section 2] → [new component | reuse existing]
  ...

{If $VARIANTS is non-empty:}
Variant components:   (mechanism: React+Tailwind → cva; else native binding per shared/CODEGEN.md)
  [ComponentName] → [cva | native] ([variant axes: type × size])
  [ComponentName] → [cva | native] ([variant axes: state])

{If $STATES is non-empty:}
State components:
  [ComponentName] → loading: skeleton | error: ErrorBoundary | empty: EmptyState

════════════════════════════════════════════════════════════
```

**Template reuse check:** if an already-converted page implements the same section structure (e.g. sibling pages generated from one design template — sector/product variants), plan the run as **reuse + content variation**: import that page's section components and vary only content/assets. Note in the plan when the remaining siblings would be better served by `/design-content` than by full conversions. Never regenerate near-identical components side by side.

### 2.2 Generate Code

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

{If cva used but not present in package.json:}
Dependencies:
  ⚠ cva not found in package.json — install: npm install class-variance-authority

Mode:       [1:1 copy | Inspiration with theme tokens | Sketch → high-fi (fidelity: {$FIDELITY})]
Theme:      [Integrated from project.json#theme | Extracted from source]
Dark mode:  [✓ dark: classes applied | — no dark mode in theme]
Responsive: [✓ responsive prefixes applied | — single viewport (TODO comment placed)]
States:     [✓ state components generated: [loading|error|empty] | — no state frames detected]

════════════════════════════════════════════════════════════
```

---

## PHASE 3: Visual Verification Loop

> **Todo**: Read '.claude/skills/design-convert/references/convert-verification-loop.md'

**Known gap:** that file's round-based screenshot-diff loop is written for generation scopes (copy/sketch/inspiration), where "does the render match the source image" is the right question. For `$SCOPE = audit` — especially after a structural-mismatch escalation (convert-audit.md Step C/D) — the more useful check is closer to a smoke-test (does it render, no console errors, do the changed sections show what was intended) than a pixel-diff loop, since the "source" being matched against is no longer one screenshot but a set of per-section edits. Until this file gets a scope-aware branch, use judgment: run its procedure as-is for generation scopes, and a lighter Playwright render-and-eyeball pass for audit/structural scopes.

---

## PHASE 4: Completion + Finalize (REQUIRED after PHASE 3)

PHASE 4 is mandatory — the convert route is not complete without it. Load and execute `convert-completion.md` immediately after PHASE 3 ends, **before reporting completion to the user**.

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
- Reach PHASE 2 with plan mode still active — every path has exactly one `ExitPlanMode` point (mode file 1.2, patch detection Step 4, or audit Step D)
- Skip the visual verification loop when Playwright is available
- Regenerate components that already exist in the codebase — import and reuse
- Exceed 3 verification rounds

This route must **ALWAYS**:

- Resolve visual input before any code generation
- Confirm mode (1:1 vs inspiration vs sketch) with user
- Confirm the mode's PHASE 1 output (token mapping / fidelity table) with the user
- Follow `shared/FRONTEND-RULES.md` (React/Next.js, HTML/CSS, A-series) and `shared/PATTERNS.md` (Component, Layout)
- Detect and match the project's framework
- Run the Playwright verification loop (unless tools unavailable)
- Update DevInfo for downstream skill handoff
- Show a completion report with next steps
