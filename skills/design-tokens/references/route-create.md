# Route: Create (New Theme)

**Domain guard (web-bias steps):** Step 0 (Vercel web-interface guidelines) and any Tailwind
version/format detection below are **web-only** — they bias CSS/HTML choices that do not apply to
`game`/`native`. If `$DOMAIN !== "web"` (resolved in PREFLIGHT per `shared/DOMAIN.md`), **skip Step 0
and Tailwind detection** and generate tokens from `shared/DESIGN.md` (the domain-neutral canon)
only. The token values stay unit-clean; the domain emit (`emit-godot.md`) handles conversion.

**Step 0: External setup context** _(web domain only — skip for game/native)_

WebFetch `https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md` and hold the result in working memory for the duration of this Create route.

Use these guidelines as a **bias layer** when making generative choices in Steps 1–7 (colors, typography, motion, interactions). Concretely:

- **Colors/Dark Mode** → apply `color-scheme: dark` awareness; OKLCH L-inversion is consistent with guidelines
- **Typography** → prefer Title Case for headings, `tabular-nums` for numeric UI, `text-wrap: balance` where relevant
- **Motion** → never generate `transition: all`; animate only `transform`/`opacity`; always include a `prefers-reduced-motion` counterpart
- **Interactions** → use `focus-visible:ring-*` pattern for focus rings; icon-only buttons need `aria-label` in generated examples

**Conflict rule**: `skills/shared/DESIGN.md` is the project canon. If Vercel's guidelines conflict with DESIGN.md, DESIGN.md wins.

**Soft-fail**: if the WebFetch fails (network unavailable), print `⚠ Vercel guidelines unavailable — continuing with DESIGN.md only` and proceed normally.

---

**Step 0.5: Brand intake check**

Before starting, check if the user already provided a file path or URL in their trigger message. If a path/URL was provided → skip this question and go directly to `route-styleguide.md` with that source.

Otherwise:

**AskUserQuestion:**

```yaml
header: "Brand doc"
question: "Do you have a brand styleguide, PDF, or brand URL you want to extract from first? (saves time by pre-filling many steps)"
options:
  - label: "No — generate / enter from scratch (Recommended)", description: "Continue with the guided Create flow"
  - label: "Yes — PDF or image", description: "Extract colors, fonts, radius from a local file first, then fill gaps in Create"
  - label: "Yes — URL", description: "Extract from a web page or hosted brand doc, then fill gaps in Create"
multiSelect: false
```

**If "Yes (PDF/image)" or "Yes (URL)":**

1. Ask for the path or URL.
2. Divert to `references/route-styleguide.md`.
3. After that route writes extracted tokens, set `$EXTRACTED_SECTIONS` = list of sections written (e.g. `["colors", "typography", "borderRadius"]`).
4. Return here to Step 1 with `$EXTRACTED_SECTIONS` active.

**Per-step skip logic (when `$EXTRACTED_SECTIONS` is set):**

At the start of each step, check if that section is in `$EXTRACTED_SECTIONS`. If yes:

```
✓ {Section} already extracted from styleguide ({N} tokens).
   Press Enter to accept or type 'change' to override.
```

- Enter (default) → skip the AskUserQuestion for that step, use extracted values.
- "change" → show the normal AskUserQuestion for that step.

**If "No":** proceed to Step 1 normally.

---

**Step 1: Colors**

> **Todo** (optional research): before generating, offer the colour-landscape research route.
> Read `.claude/skills/design-tokens/references/route-research.md` and follow its opt-in question.
> On opt-in it returns `$LANDSCAPE` (competitor pins, free lanes, candidate accents, caveats) that
> feeds the palette suggestion and the colour explorer below. On "No", continue directly.

**AskUserQuestion:**

```yaml
header: "Colors"
question: "How would you like to define colors?"
options:
  - label: "Generate for me (Recommended)", description: "Describe what you're building, Claude picks suitable colors"
  - label: "Enter manually", description: "I'll provide hex values"
  - label: "Extract from config", description: "Pull from Tailwind/CSS"
multiSelect: false
```

**If "Generate for me":**

```
Briefly describe what you're building:

→ Example: "Healthcare dashboard for doctors"
→ Example: "E-commerce for luxury watches"
→ Example: "SaaS landing page for project management"
```

Based on the description, Claude generates a context-aware color palette:

- Main colors (dark, light, mid-gray, light-gray)
- Accent colors (primary, secondary, tertiary) suited to the industry/audience
- Semantic colors (success, warning, error, info)

> **Todo** (interactive explorer): render `.claude/skills/design-tokens/references/token-explorer.html`
> to `.project/previews/design-tokens-explorer.html`, populating the `explorer-data` JSON block
> (`color` section from the candidate accents + `$LANDSCAPE.pins`/`.lanes`/`.caveats` when research
> ran; `type`/`spacing`/`motion` sections from the options offered in Steps 2/3/6). Present that
> `file://` path **with `#color`** via `.claude/skills/shared/HTML-PRESENT.md` (auto-opens) so the user
> compares accents live in dark & light before confirming.
>
> **Reuse across chooser steps**: the same explorer file serves Step 2 (Typography), Step 3 (Spacing),
> and Step 6 (Motion) — at each, (re)populate the relevant `explorer-data` section and present the
> path with the matching hash (`#type` / `#spacing` / `#motion`) so every "pick between options" step
> is a live comparison, not a blind choice.

```yaml
header: "Color palette"
question: "Does this color palette look right?"
options:
  - label: "Yes, continue (Recommended)", description: "Go to Step 2"
  - label: "Adjust", description: "Modify colors"
multiSelect: false
```

**Token Layer Explanation (after color confirmation)**

The generated colors follow a three-layer structure:

- **Primitives** (`main` and `accent` groups): direct hex/OKLCH values.
  CSS output: `--color-dark: #1a1a2e`, `--color-accent-primary: #3B82F6`
- **Semantics** (`semantic` group): reference a primitive via `var()`.
  CSS output: `--color-success: var(--color-accent-primary)` (not: `--color-success: #10B981`)
  Reason: if `accent-primary` changes, semantic tokens update automatically.

Follow this structure when building `cssVars` in Step 8.

**Color format** _(web domain)_

Detect Tailwind version from `package.json` before generating colors:

- `"tailwindcss": "^4.*"` → use **OKLCH** (`oklch(L C H)`, e.g. `oklch(0.15 0.02 260)`)
- Tailwind 3 or no Tailwind → use **hex** (`#RRGGBB`)
- **game/native** → store colors as **hex** (`#RRGGBB`); the Godot emitter converts hex → `Color(r,g,b,a)` (see `emit-godot.md § Value conversion`).

OKLCH advantage: L-component directly adjustable for dark mode (same C/H = same hue, only lightness changes). Hex does not have this.

**If "Enter manually":**

```
Provide your primary colors (hex values):

1. Primary (main color for actions/buttons)
   → Example: #3B82F6

2. Secondary (supporting color)
   → Example: #10B981

3. Neutral (gray for text/borders)
   → Example: #6B7280
```

**If "Extract":** → Jump to Route: Extract

**Step 2: Typography**

> **Todo** (explorer): populate the `type` section of `token-explorer.html` with the font options and present it with `#type` (see Step 1 § Reuse across chooser steps) so the user compares fonts live before choosing.

**AskUserQuestion:**

```yaml
header: "Typography"
question: "Which fonts do you use?"
options:
  - label: "System fonts (Recommended)", description: "system-ui, sans-serif"
  - label: "Custom fonts", description: "Specify your own font families"
  - label: "Extract", description: "Pull from existing CSS"
multiSelect: false
```

**If "Custom fonts":**

```
Provide your font families:

1. Headings font
   → Example: "Inter", "Poppins"

2. Body font
   → Example: "Inter", system-ui

3. Mono font (optional, for code)
   → Example: "Fira Code", monospace

Type 's' for popular combinations
```

**Google Fonts detection (runs after user provides font names):**

> **Todo**: Read `.claude/skills/design-tokens/references/google-fonts-list.md` to get the known-Google-Fonts list.

For each provided font name: case-insensitive match against the list.

- **Found** → silent pass; proceed.
- **Not found** → flag as "non-Google" and show:

```yaml
header: "Font hosting"
question: "'{name}' is not on Google Fonts. How do you want to host it?"
options:
  - label: "Local font — next/font/local (Recommended)", description: "Step-by-step guide: download → unzip → src/app/fonts/ → layout.tsx"
  - label: "I'll handle it myself", description: "Record the font name in tokens only"
  - label: "Pick a similar Google Font", description: "Suggest comparable fonts from Google Fonts"
multiSelect: false
```

If "Local font — next/font/local":

> **Todo**: Read `.claude/skills/design-tokens/references/local-font-setup.md` and render the checklist for this project.

If "Pick a similar Google Font": suggest 2–3 alternatives by visual category (geometric sans / humanist / serif / mono) and ask user to pick one.

**Step 3: Spacing**

> **Todo** (explorer): populate the `spacing` section of `token-explorer.html` with the base-scale options and present it with `#spacing` (see Step 1 § Reuse across chooser steps) so the user feels 4px vs 8px on real components before choosing.

**AskUserQuestion:**

```yaml
header: "Spacing"
question: "Spacing scale preference?"
options:
  - label: "4px base (Recommended)", description: "4, 8, 12, 16, 20, 24, 32, 48, 64"
  - label: "8px base", description: "8, 16, 24, 32, 40, 48, 64, 80, 96"
  - label: "Custom", description: "Custom spacing scale"
multiSelect: false
```

**Step 4: Breakpoints**

**AskUserQuestion:**

```yaml
header: "Breakpoints"
question: "Responsive breakpoints?"
options:
  - label: "Tailwind defaults (Recommended)", description: "sm:640, md:768, lg:1024, xl:1280"
  - label: "Bootstrap style", description: "sm:576, md:768, lg:992, xl:1200"
  - label: "Custom", description: "Custom breakpoints"
multiSelect: false
```

**Step 5: Dark Mode**

**AskUserQuestion:**

```yaml
header: "Dark Mode"
question: "Would you like to add dark mode to your theme?"
options:
  - label: "Yes, auto-generate (Recommended)", description: "Automatically generate dark colors based on your light palette"
  - label: "Manual", description: "Enter dark mode colors manually"
  - label: "No, light mode only", description: "Skip dark mode (can be added later via Modes)"
multiSelect: false
```

**If "Yes, auto-generate":**

- Invert background/foreground: `dark` <> `light`
- Adjust `mid-gray` and `light-gray` for dark context
- Retain accent colors but increase lightness (~10-15%) for readability on dark background
- **If OKLCH colors:** adjust only the L-component (e.g. `oklch(0.15 0.02 260)` → `oklch(0.90 0.02 260)` for background-inversion); C and H stay the same for color consistency
- Genereer `.dark` CSS block naast `:root`
- Show preview (same as Mode Comparison)

**If "Manual":**

```
Provide your dark mode colors (hex values):

1. Background (dark background)
   → Example: #1a1a2e

2. Foreground (light text on dark)
   → Example: #f5f5f5

3. Card background (slightly lighter than background)
   → Example: #2d2d44

4. Border color
   → Example: #3d3d5c
```

**If "No":**

- Skip dark mode
- `modes` only contains `light` key
- → Go to Step 6

**Step 6: Motion**

> **Todo** (explorer): populate the `motion` section of `token-explorer.html` with the duration/easing options and present it with `#motion` (see Step 1 § Reuse across chooser steps) so the user *feels* snappy vs smooth (entrance/hover/press + easing curve) before choosing. Deep spring/choreography preview stays in the Motion-Pack route (`motion/preview-template.html`).

**AskUserQuestion:**

```yaml
header: "Motion"
question: "Motion tokens for animations and transitions?"
options:
  - label: "Smooth (Recommended)", description: "100/200/300/500ms + ease-out-quart — neutral, suitable for most apps"
  - label: "Snappy", description: "75/150/200/350ms + ease-out-expo — direct, suits calculators/dashboards"
  - label: "Custom", description: "Specify custom durations and easing curves"
  - label: "No motion tokens", description: "Skip (can be added later via Update)"
multiSelect: false
```

**If "Smooth":**

Generate: durations (100/200/300/500ms), easings: `ease-out` (cubic-bezier(0.25, 1, 0.5, 1)), `ease-in` (cubic-bezier(0.7, 0, 0.84, 0)), `ease-in-out` (cubic-bezier(0.65, 0, 0.35, 1)).

**If "Snappy":**

Generate: durations (75/150/200/350ms), easings: `ease-out` (cubic-bezier(0.16, 1, 0.3, 1)), `ease-in` (cubic-bezier(0.7, 0, 0.84, 0)), `ease-in-out` (cubic-bezier(0.65, 0, 0.35, 1)).

**If "Custom":**

```
Provide your motion preferences:

1. Durations (e.g. 75/150/200/350ms or 100/200/300/500ms)
2. Easing curves (cubic-bezier values for ease-out, ease-in, ease-in-out)
```

**If "No motion tokens":**

- Skip motion, `motion` section becomes empty object
- → Go to Step 7

**Step 7: Interactions**

**AskUserQuestion:**

```yaml
header: "Interactions"
question: "Interaction tokens for hover, focus, and active states?"
options:
  - label: "Defaults (Recommended)", description: "Focus ring (2px accent), subtle hover transition, scale active"
  - label: "Custom", description: "Specify custom interaction styles"
  - label: "No interaction tokens", description: "Skip (can be added later via Update)"
multiSelect: false
```

**If "Defaults":**

Generate standard interaction tokens:

- Focus ring: `width: 2px`, `style: solid`, `color: var(--color-accent-primary)`, `offset: 2px`
- Hover: `transition: var(--duration-fast) var(--ease-out)`, `transform: none`
- Active: `transform: scale(0.98)`

```yaml
header: "Interaction Tokens"
question: "Do these interaction tokens look right?"
options:
  - label: "Yes, continue (Recommended)", description: "Go to Step 8"
  - label: "Custom", description: "Specify custom focus/hover/active styles"
multiSelect: false
```

**If "Custom":**

```
Provide your interaction preferences:

1. Focus ring
   → Color: accent-primary / custom
   → Width: 2px / custom
   → Offset: 2px / custom

2. Hover effect
   → Transition speed: instant / fast / normal
   → Transform: none / translateY(-1px) / scale(1.02)

3. Active/press effect
   → Transform: scale(0.98) / scale(0.95) / none
```

**If "No interaction tokens":**

- Skip interactions, `interactions` section becomes empty object
- → Go to Step 8

**CHECKPOINT: Design Tokens Summary**

Present all collected tokens as an overview before they are saved:

**Step 8: Confirmation**

```
THEME SUMMARY

| Category | Value |
|----------|-------|
| **Primary** | {color} |
| **Secondary** | {color} |
| **Neutral** | {color} |
| **Headings** | {font} |
| **Body** | {font} |
| **Spacing** | {scale} |
| **Breakpoints** | {list} |
| **Dark Mode** | {Yes (auto) / Yes (custom) / No} |
| **Motion** | {Defaults / Custom / None} |
| **Interactions** | {Defaults / Custom / None} |
| **Setup context** | {Vercel guidelines (fetched {date}) / Not applied} |
```

**AskUserQuestion:**

```yaml
header: "Confirm"
question: "Create theme with these settings?"
options:
  - label: "Yes, create (Recommended)", description: "Write to .project/project.json (theme section)"
  - label: "Adjust", description: "Go back to make changes"
  - label: "Cancel", description: "Stop without creating"
multiSelect: false
```

The confirmation above is the single gate: "Adjust" loops back to the affected step; "Cancel" stops; "Yes" proceeds to the writes below.

**If "Yes":**

1. Consult `skills/design-tokens/references/THEME_TEMPLATE.md` for token categories and naming conventions
2. Build the theme JSON object according to the schema in `references/THEME_TEMPLATE.md § Theme JSON Schema`
3. Populate `colors` (main, accent, semantic) with structured token objects
4. Populate `typography` with families and sizes. Use semantic names for `sizes`:
   `text-display` (largest heading), `text-title-l/m/s`, `text-headline-l/m/s`, `text-body-l/m/s`, `text-code`
   instead of size-based names like `text-xs/sm/base/lg`. Assign each name a concrete rem value suited to the project.
5. Populate `spacing` with base and scale
6. Populate `breakpoints`, `borderRadius`, `shadows`
7. **If dark mode chosen:** Populate `modes` with both `light` and `dark` CSS strings
8. **If no dark mode:** Populate `modes` with only the `light` key
9. **If motion chosen:** Populate `motion` with durations and easings
10. **If interactions chosen:** Populate `interactions` with focusRing, hover, active
11. Generate `cssVars` — full CSS variables string (all tokens incl. motion/interaction as `:root { ... }`)
12. Read `.project/project.json` (or create new with empty schema)
13. Set `theme` section → Write back as formatted JSON
14. **If Step 0 succeeded:** append-or-replace an entry in `theme.setupContext[]` (key on `appliedBy`):
    ```json
    {
      "source": "vercel-labs/web-interface-guidelines",
      "url": "https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md",
      "fetchedAt": "<ISO-8601>",
      "appliedBy": "design-tokens@3.7.1"
    }
    ```
    Write back. Skip this step if Step 0 soft-failed.
15. → Go to PHASE X: Post-flight Validation
16. → Go to X.6: Theme Infrastructure Sync
17. → Go to PHASE Y: Website Sync

---

**Step 9: Motion Pack handoff**

Runs after PHASE Y (Website Sync) completes, only if `theme.motion.pack` is absent or empty.

**AskUserQuestion:**

```yaml
header: "Motion Pack"
question: "Theme is saved. Want to set up an animation pack now (spring physics, choreography, glass surfaces)?"
options:
  - label: "Yes — pick a pack now (Recommended)", description: "Continue inline to Motion Pack setup — no second /design-tokens invocation needed"
  - label: "Skip — finish here", description: "Can be added later via /design-tokens → Motion Pack"
multiSelect: false
```

**If "Yes":** divert directly to `references/motion/route-create.md`. Backlog Write (X.7) runs once at the end of that route — do NOT run it again here.

**If "Skip":** run Backlog Write (X.7) now and finish. Output Format shows: `Next steps: /design-tokens → Motion Pack to add spring physics and choreography.`
