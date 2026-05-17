# Route: Create (New Theme)

**Step 1: Colors**

**AskUserQuestion:**

```yaml
header: "Colors"
question: "How would you like to define colors?"
options:
  - label: "Generate for me (Recommended)", description: "Describe what you're building, Claude picks suitable colors"
  - label: "Enter manually", description: "I'll provide hex values"
  - label: "Extract from config", description: "Pull from Tailwind/CSS"
  - label: "Explain question", description: "Explain what design tokens are"
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

**Color format**

Detect Tailwind version from `package.json` before generating colors:

- `"tailwindcss": "^4.*"` → use **OKLCH** (`oklch(L C H)`, e.g. `oklch(0.15 0.02 260)`)
- Tailwind 3 or no Tailwind → use **hex** (`#RRGGBB`)

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

**Step 3: Spacing**

**AskUserQuestion:**

```yaml
header: "Spacing"
question: "Spacing scale preference?"
options:
  - label: "4px base (Recommended)", description: "4, 8, 12, 16, 20, 24, 32, 48, 64"
  - label: "8px base", description: "8, 16, 24, 32, 40, 48, 64, 80, 96"
  - label: "Custom", description: "Custom spacing scale"
  - label: "Explain question", description: "Explain what a spacing scale is"
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
  - label: "Explain question", description: "Explain how breakpoints work"
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
  - label: "Explain question", description: "Explain what interaction tokens are"
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

**If "Yes":**

1. Consult `skills/frontend-tokens/references/THEME_TEMPLATE.md` for token categories and naming conventions
2. Build the theme JSON object according to the schema (see "Theme JSON Schema" above)
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
14. → Go to PHASE X: Post-flight Validation
15. → Go to X.6: Theme Infrastructure Sync
16. → Go to PHASE Y: Website Sync
