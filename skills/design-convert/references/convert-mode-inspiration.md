# Convert Mode: Inspiration

Loaded after PHASE 0.3 when `$MODE = inspiration`. Defines this mode's theme requirement, PHASE 1 procedure (Inspiration Brief + Token Mapping) with its `ExitPlanMode` point, codegen rules, and verification thresholds. Goal: adopt what the user values in the source, render it entirely in the project's own theme tokens.

## Theme Requirement

Theme is **mandatory**. Check `project.json → theme`. If empty: abort with `"This mode requires a theme. Run /design-tokens first or choose 1:1 copy."` If populated: read and store tokens — mandatory for mapping.

## PHASE 1: Inspiration Brief + Token Mapping

### 1.0 Questioning Round

Follow `shared/QUESTIONING.md` (form choice, anchoring, escalation ladder). Runs inside the already-active plan mode. Goal: a brief stating what to adopt from the source and where to deviate — token mapping and codegen are biased by it.

When `SEED_CONTEXT.present` (loaded in route-convert PHASE 0.6): anchor the questions and deviation defaults in the seed concept — prefer adopting source traits that serve the product and dropping sections irrelevant to it. Q3 (Intent) stays skipped when the seed already answers what the version should communicate.

**Q1 — Adopt (enumerable, multiSelect):** compose descriptions anchored in `$ANALYSIS` and `$MOTION_INTENT` — name concrete sections/traits, no generic placeholders:

```yaml
header: "Adopt"
question: "Which aspects of the source should carry over into your version?"
options:
  - label: "Layout & structure (Recommended)", description: "Section order, grid, composition — {name 2-3 sections from $ANALYSIS}"
  - label: "Typography rhythm", description: "Heading/body hierarchy and scale contrast, mapped to your theme fonts"
  - label: "Density & spacing character", description: "{e.g. 'airy, generous whitespace' or 'compact, information-dense' — read from $ANALYSIS}"
  - label: "Motion & interaction feel", description: "{from $MOTION_INTENT — omit this option if 'none detected'}"
multiSelect: true
```

If the user answers via "Other" with specific sections: ask which sections, store them under `adopt`.

**Q2 — Deviations (enumerable):** options composed per instance, anchored in `$ANALYSIS`. Shape (adapt labels to the actual source):

```yaml
header: "Deviate"
question: "Where should your version deviate from the source?"
options:
  - label: "Replace source palette entirely with theme (Recommended)", description: "All colors from project tokens — source palette is reference only"
  - label: "Keep the source's {light|dark} character", description: "Pick theme tokens that preserve the source's overall {light|dark} feel"
  - label: "Drop sections irrelevant to {project}", description: "{name the candidate sections from $ANALYSIS}"
  - label: "No deviations beyond tokens", description: "Stay as close to the source as tokens allow"
multiSelect: true
```

**Q3 — Intent (conditional anchored open question):** only when context is thin — no `$CONVERT_TARGET` backlog description and no seed context (`shared/QUESTIONING.md § Before Asking`: don't ask what you already know). One open question, anchored in the dominant trait from `$ANALYSIS`, with 2-3 example directions. Example shape: _"The source leads with {dominant trait} — what should your version communicate first: {direction 1}, {direction 2}, or something else?"_ Escalation ladder applies on "I don't know".

**Result:** store and show the brief:

```
INSPIRATION BRIEF
════════════════════════════════════════════════
Adopt:    [layout & structure, motion feel, ...]
Deviate:  [theme palette replaces source, drop testimonials, ...]
Intent:   [one line — or "—" if Q3 skipped]
════════════════════════════════════════════════
```

Store as `$INSPIRATION_BRIEF = { adopt: [], deviate: [], intent: "" }`.

### 1.1 Extract and Map

Extract visual properties from the source image and map them to the closest theme tokens (from project.json), **biased by the brief**: adopted aspects map source → token; non-adopted aspects take pure theme defaults with no source influence.

**If `$INPUT_SOURCE = "figma-mcp"`:** feed the Source column with exact values from `get_variable_defs` / `get_design_context` (exact hex, px, font weights — no "~approx." estimates). The mapping logic is unchanged: each source value maps to the closest project token. When Figma variables carry semantic names (e.g. `brand/primary`), use them to disambiguate the target token. If `get_variable_defs` returns empty (common in agency files without variables): map from the exact values in `get_design_context` — not an error. For `$INPUT_SOURCE = "figma-rest"`: same procedure, with exact values read from the node-tree JSON captured in 0.1.

```
TOKEN MAPPING
════════════════════════════════════════════════════════════

Colors:
  Source                    → Theme Token
  #333333 (heading)         → foreground (#1a1a2e)
  #FF5733 (heading accent)  → primary-500 (#3B82F6)
  #F5F5F5 (bg)              → background (#ffffff)
  #666666 (body text)       → muted-foreground (#6B7280)

Typography:
  Source              → Theme Token
  Bold sans-serif     → heading (Inter, 700)
  Regular sans-serif  → body (Inter, 400)

Spacing:
  Source (approx.)    → Theme Token
  ~16px sections      → spacing-4 (16px)
  ~32px large gaps    → spacing-8 (32px)

{If $INTERACTION_SPEC is set and "Motion & interaction feel" was adopted:}
Interactions:
  Source interaction                    → Choreography token
  card hover scale(1.04) + lift         → surface.tilt
  section entrance fade+rise, stagger   → list.stagger-reveal
  badge fade-in on hover                → (no pack equivalent — keep explicit delta)

════════════════════════════════════════════════════════════
```

**Two-tone headings** map to two tokens, not one. Where the source (or `$ANALYSIS`'s `inline accent segments` line) shows a heading with a colored word, give it its own row — `heading accent → primary-500` — and emit it as a `<span>` inside the heading. Mapping the whole heading to one token is the token-mode form of the same defect copy mode gets from a one-color-per-role fidelity table.

**Interaction mapping** (only when `$INTERACTION_SPEC` is set): map each row to the nearest `theme.motion.choreography` entry — the pack vocabulary keeps converted pages consistent. Rows with no pack equivalent keep their explicit delta (the documented-spec exception in route-convert 0.6). If "Motion & interaction feel" was **not** adopted in Q1: drop `$INTERACTION_SPEC` and use pack defaults only — adopting the source's motion is the user's call, same as any other trait.

### 1.2 Confirm Mapping

**There is exactly one gate here.** Branch on plan-mode state — asking both is the double confirmation `SKILL-PATTERNS.md` warns about:

**Plan mode active (the normal path — entered at route-convert 0.1)** → `ExitPlanMode` **is** this confirmation. Write SOURCE ANALYSIS + INSPIRATION BRIEF + TOKEN MAPPING into the plan file, then call it. Its rejection path is the "Adjust" branch: the correction arrives as prose, apply it, update the plan file, call `ExitPlanMode` again. Do not also ask the modal below.

> **Todo**: after approval, all remaining phases (codegen, verification, completion) run in Sonnet. Do NOT re-enter plan mode later in this run.

**Plan mode not active** (patch fast-path already exited, or the user started the skill outside it — see `shared/PLAN-MODE.md § Exit`) → there is no approval gate yet, so ask:

```yaml
header: "Token Mapping"
question: "Is this mapping from source design to your project tokens correct?"
options:
  - label: "Yes, continue (Recommended)", description: "Use this mapping for code generation"
  - label: "Adjust", description: "I want to change specific mappings"
multiSelect: false
```

If "Adjust": ask which mappings to change, update, re-confirm.

## Codegen Rules (applied in PHASE 2.2)

- Use only theme tokens (from project.json) and standard Tailwind classes. Match source layout and structure, not visual details. No arbitrary values.
- Inject `$INSPIRATION_BRIEF` into the generation prompt as a header: `ADOPT: {list} / DEVIATE: {list} / INTENT: {line}` — adopted aspects guide structure and feel; deviations override source traits.
- Content: when `SEED_CONTEXT.present`, draw headings, labels, and CTA copy from the seed concept so the result reads as the actual product — never generic placeholder text.
- Figma sources (`figma-mcp`/`figma-rest`): Figma-emitted code is a **value source, not a code source**. Never copy absolute pixel offsets — reconstruct element groups with flex/grid + gap. Repeated visual patterns (buttons, cards, badges) become one shared component even when the file has no Figma components.
- Interactions: implement the confirmed interaction mapping via choreography tokens / pack CSS vars — implementation patterns in `convert-generate-template.md § Motion`. Explicit deltas (no-equivalent rows) are the one sanctioned exception to the no-arbitrary-values rule, scoped to motion properties only.
- Gold standard: `../examples/PricingPage-inspiration.tsx` (zero arbitrary values).

## Verification Thresholds (applied in PHASE 3)

- `$VERIFY_PIXEL_RATIO = 0.03` (layout-level match — exact pixels are not the goal).
- Code quality check 3.2b runs the inspiration-only rules: arbitrary color values (H101) and arbitrary spacing (R103) are violations.
