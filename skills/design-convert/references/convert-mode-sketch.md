# Convert Mode: Sketch → High-Fi

Loaded after PHASE 0.3 when `$MODE = sketch`. Defines this mode's theme requirement, PHASE 1 procedure (Fidelity Filter + Token Mapping) with its `ExitPlanMode` point, codegen rules, and verification thresholds. Goal: interpret layout-intent from a wireframe/rough mockup, fill in all visual detail from tokens and `shared/DESIGN.md` principles.

## Theme Requirement

Theme is **mandatory**. Check `project.json → theme`. If empty: abort with `"This mode requires a theme. Run /design-tokens first or choose 1:1 copy."` If populated: read and store tokens — mandatory for mapping.

## PHASE 1: Fidelity Filter + Token Mapping

### 1.0 Fidelity Filter

Before mapping, determine which properties from `$ANALYSIS` are **authoritative** (take from source) vs **overridden** (fill in from tokens + `shared/DESIGN.md`):

| Property         | low fidelity       | medium fidelity         |
| ---------------- | ------------------ | ----------------------- |
| Layout/structure | from sketch        | from sketch             |
| Spacing          | tokens only        | tokens (sketch as hint) |
| Colors           | tokens only        | tokens (sketch as hint) |
| Typography       | tokens + DESIGN.md | tokens (sketch as hint) |
| A11y scaffold    | shared/CODEGEN.md  | shared/CODEGEN.md       |

**"sketch as hint"**: use the rough value to guide token selection (e.g. a dark section in the sketch → pick a dark background token) but never copy raw hex/font values directly.

### 1.1 Extract and Map

Extract visual properties from the source image (applying the fidelity filter) and map them to the closest theme tokens (from project.json). Use the same TOKEN MAPPING table format as inspiration mode: per category (Colors, Typography, Spacing) a `Source → Theme Token` table. For `tokens only` properties the Source column reads `(filtered — tokens only)`.

If `$INTERACTION_SPEC` is set (e.g. the user pasted an interaction spec alongside the sketch): add the Interactions mapping category, same rules as inspiration mode — map to `theme.motion.choreography` tokens, keep explicit deltas only where the pack has no equivalent.

### 1.2 Confirm Mapping

```yaml
header: "Token Mapping"
question: "Is this mapping from sketch to your project tokens correct?"
options:
  - label: "Yes, continue (Recommended)", description: "Use this mapping for code generation"
  - label: "Adjust", description: "I want to change specific mappings"
multiSelect: false
```

If "Adjust": ask which mappings to change, update, re-confirm.

> **Todo**: Use the `ExitPlanMode` tool once the mapping is confirmed — present SOURCE ANALYSIS + TOKEN MAPPING as the plan output. After user approval, all remaining phases (codegen, verification, completion) run in Sonnet. Do NOT re-enter plan mode later in this run. Skip this exit if plan mode is no longer active (patch path already exited) or the skill was started in plan mode by the user (see `shared/PLAN-MODE.md § Exit`).

## Codegen Rules (applied in PHASE 2.2)

- Layout and structure from the sketch; all colors, spacing, and typography from theme tokens and `shared/DESIGN.md` principles. Never copy raw hex/font values from the sketch.
- Content: when `SEED_CONTEXT.present` (loaded in route-convert PHASE 0.6), draw headings, labels, and CTA copy from the seed concept so placeholder text reads as the actual product — never generic "Lorem ipsum" or "Feature one/two/three". Fall back to source-derived text only when the seed is absent.
- No arbitrary values — same token discipline as inspiration mode.
- Gold standard: `../examples/PricingPage-inspiration.tsx` (token-only output).

## Verification Thresholds (applied in PHASE 3)

- `$VERIFY_PIXEL_RATIO = 0.03` (the sketch is intent, not ground truth — verify structure, not pixels).
- Code quality check 3.2b: arbitrary color (H101) and arbitrary spacing (R103) rules apply, same as inspiration mode.
