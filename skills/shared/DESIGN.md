# Design Quality Guide

Visual design principles that combat AI-generated sameness. Complements RULES.md (coding standards) and PATTERNS.md (component patterns) with design-specific guidance.

> **Scope:** All frontend skills. Read this file for every design decision.

---

## Anti-Patterns (AI Design Tells)

Patterns that scream "an AI made this". Actively avoid these.

### Typography

| Avoid                                              | Why                                   | Alternative                                                                                 |
| -------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------- |
| Inter, Roboto, Open Sans as default                | Used everywhere, makes design generic | Instrument Sans, Plus Jakarta Sans, Outfit, Figtree, Onest                                  |
| System fonts without deliberate choice             | Feels like "no effort made"           | Choose deliberately: system fonts are fine when it's an app where performance > personality |
| Too many font sizes close together (14/15/16/18px) | No clear hierarchy                    | Max 5 sizes with strong ratio (1.25–1.5)                                                    |
| Monospace for decoration                           | Overdone tech-aesthetic               | Use monospace only for code                                                                 |

### Color

| Avoid                                    | Why                                   | Alternative                                        |
| ---------------------------------------- | ------------------------------------- | -------------------------------------------------- |
| Pure black `#000` / pure gray (chroma 0) | Does not exist in nature, feels harsh | Tinted neutrals: `oklch(15% 0.01 <hue>)`           |
| Gray on colored background               | Looks dead and washed out             | Dark tint of the background color, or transparency |
| Purple-blue gradient as accent           | The quintessential AI default         | Choose your own color with intention               |
| Gradient text                            | Hard to read, overdone                | Use color or weight for emphasis                   |
| Pure white backgrounds everywhere        | Clinical, no warmth                   | Lightly tinted background `oklch(98% 0.005 <hue>)` |

### Layout

| Avoid                                                       | Why                                   | Alternative                                                                              |
| ----------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------- |
| Cards in cards                                              | Visual noise, unclear hierarchy       | Spacing + typography for hierarchy within cards                                          |
| Identical card grids for everything                         | Repetitive, no visual tension         | Vary layout: list, masonry, featured + grid                                              |
| Everything centered                                         | Feels like a template, no rhythm      | Left-align text, center only heroes and CTAs                                             |
| Glassmorphism without `theme.surfaces.glass.enabled = true` | Decoration without function           | Use depth only where it serves information hierarchy — opt in via `/frontend-animations` |
| Hero with metric cards                                      | The same dashboard pattern everywhere | Design from the specific use case                                                        |

### Motion

| Avoid                                      | Why                            | Alternative                                                                               |
| ------------------------------------------ | ------------------------------ | ----------------------------------------------------------------------------------------- |
| Bounce/elastic easing outside Playful pack | Feels 2015, tacky              | Smooth deceleration: `ease-out-quart` — or opt in via `/frontend-animations` Playful pack |
| Animation without purpose                  | Distracting, slows interaction | Animate only when it adds information                                                     |
| Animate everything at once                 | Animation fatigue              | Stagger, or animate only the most important element                                       |

---

## Color

### OKLCH as Color Space

Use OKLCH instead of HSL. OKLCH is perceptually uniform — equal steps in lightness _look_ equal.

```css
/* Structure: oklch(lightness chroma hue) */
--primary: oklch(60% 0.15 250);
--primary-light: oklch(85% 0.08 250); /* Lower chroma at higher lightness */
--primary-dark: oklch(35% 0.12 250);
```

**Key insight:** Reduce chroma toward white/black. High chroma at extreme lightness looks garish.

### Tinted Neutrals

Always add a hint of your brand hue to gray tones (chroma ~0.01):

```css
/* Warm neutrals */
--gray-100: oklch(95% 0.01 60);
--gray-900: oklch(15% 0.01 60);

/* Cool neutrals (tech, professional) */
--gray-100: oklch(95% 0.01 250);
--gray-900: oklch(15% 0.01 250);
```

### 60-30-10 Rule

| Share | Role                                       | Example        |
| ----- | ------------------------------------------ | -------------- |
| 60%   | Neutral — backgrounds, whitespace          | Surface colors |
| 30%   | Secondary — text, borders, inactive states | Gray scale     |
| 10%   | Accent — CTAs, highlights, focus           | Brand color    |

Accent works _because_ it is rare. Overuse kills its power.

### Dark Mode ≠ Inverted Light Mode

| Light Mode         | Dark Mode                                     |
| ------------------ | --------------------------------------------- |
| Shadows for depth  | Lighter surfaces for depth (no shadows)       |
| Dark text on light | Light text on dark — reduce font-weight       |
| Vivid accents      | Slightly desaturate                           |
| White backgrounds  | Never pure black — `oklch(12-18% 0.01 <hue>)` |

---

## Typography

### Font Choice

One well-chosen font in multiple weights is often better than two competing typefaces. Add a second font only for real contrast (display headline + body serif).

**Google Fonts alternatives for overused fonts:**

| Instead of     | Try                                        |
| -------------- | ------------------------------------------ |
| Inter          | Instrument Sans, Plus Jakarta Sans, Outfit |
| Roboto         | Onest, Figtree, Urbanist                   |
| Open Sans      | Source Sans 3, Nunito Sans, DM Sans        |
| Editorial feel | Fraunces, Newsreader, Lora                 |

### Modular Scale

Choose one ratio and commit:

| Ratio | Name           | Character           |
| ----- | -------------- | ------------------- |
| 1.125 | Minor Second   | Subtle, compact UI  |
| 1.25  | Major Third    | Versatile, popular  |
| 1.333 | Perfect Fourth | Strong contrast     |
| 1.5   | Perfect Fifth  | Dramatic, editorial |

5 sizes are enough: `xs` (0.75rem), `sm` (0.875rem), `base` (1rem), `lg` (1.25-1.5rem), `xl+` (2-4rem).

### Fluid Typography

```css
/* clamp(minimum, preferred, maximum) */
font-size: clamp(1rem, 0.5rem + 2vw, 2.5rem);
```

Use fluid type for headings and hero text. **Not** for buttons, labels, and UI elements — those must be consistent.

### OpenType Features

```css
.data-table {
  font-variant-numeric: tabular-nums;
} /* Aligned numbers */
.fraction {
  font-variant-numeric: diagonal-fractions;
}
abbr {
  font-variant-caps: all-small-caps;
}
code {
  font-variant-ligatures: none;
}
```

---

## Motion

### Timing

| Duration  | Use                                                 |
| --------- | --------------------------------------------------- |
| 100–150ms | Direct feedback: button press, toggle, color change |
| 200–300ms | State changes: menu, tooltip, hover                 |
| 300–500ms | Layout changes: accordion, modal, drawer            |
| 500–800ms | Entrance: page load, hero reveals                   |

**Exit = 75% of enter duration.**

### Easing Curves

| Curve       | Use               | CSS                              |
| ----------- | ----------------- | -------------------------------- |
| ease-out    | Elements entering | `cubic-bezier(0.25, 1, 0.5, 1)`  |
| ease-in     | Elements leaving  | `cubic-bezier(0.7, 0, 0.84, 0)`  |
| ease-in-out | State toggles     | `cubic-bezier(0.65, 0, 0.35, 1)` |

Define as tokens:

```css
--ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1); /* Default — smooth */
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1); /* Snappy, confident */
--ease-in-quart: cubic-bezier(0.5, 0, 0.75, 0); /* Exit */
```

### Animate Only transform and opacity

Everything else causes layout recalculation. For height animations: `grid-template-rows: 0fr → 1fr`.

### Stagger

```css
animation-delay: calc(var(--i, 0) * 50ms);
```

Cap total stagger time — 10 items × 50ms = 500ms max.

### Reduced Motion (required)

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Preserve functional animations (progress bars, spinners) but without spatial movement.

---

## Interaction States

Every interactive element has 8 possible states:

| State    | When                     | Visual                          |
| -------- | ------------------------ | ------------------------------- |
| Default  | At rest                  | Base styling                    |
| Hover    | Pointer over (not touch) | Subtle lift or color shift      |
| Focus    | Keyboard/programmatic    | Visible ring (`:focus-visible`) |
| Active   | Being pressed            | Pressed, darker                 |
| Disabled | Not interactive          | Reduced opacity, no pointer     |
| Loading  | In progress              | Spinner or skeleton             |
| Error    | Invalid state            | Red border + icon + message     |
| Success  | Completed                | Green check + confirmation      |

**Minimum 5 states per interactive element.** Always design hover and focus separately — keyboard users never see hover.

### Focus Rings

```css
button:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

Never `outline: none` without a replacement. Minimum 3:1 contrast.

---

## Spatial Design

### 4pt Spacing System

8pt is too coarse (12px is missing). Use 4pt: `4, 8, 12, 16, 24, 32, 48, 64, 96`.

Name tokens semantically (`--space-sm`, `--space-lg`), not by value (`--spacing-8`). Use `gap` instead of margins for siblings.

### Hierarchy via Multiple Dimensions

Don't rely on size alone. Always combine 2–3:

| Tool   | Strong                   | Weak              |
| ------ | ------------------------ | ----------------- |
| Size   | 3:1 ratio or more        | <2:1 ratio        |
| Weight | Bold vs Regular          | Medium vs Regular |
| Color  | High contrast            | Similar tones     |
| Space  | Surrounded by whitespace | Dense             |

### Container Queries for Components

```css
.card-container {
  container-type: inline-size;
}

@container (min-width: 400px) {
  .card {
    grid-template-columns: 120px 1fr;
  }
}
```

Viewport queries for page layout, container queries for components.

---

## UX Writing

### Button Labels

Specific verb + object. Never "OK", "Submit", or "Yes/No":

| Bad    | Good           |
| ------ | -------------- |
| OK     | Save changes   |
| Submit | Create account |
| Yes    | Delete message |
| Cancel | Keep editing   |

Destructive actions: name the destruction ("Delete 5 items", not "Delete selected").

### Error Messages

Always answer: (1) What? (2) Why? (3) How to fix?

| Situation        | Template                                                 |
| ---------------- | -------------------------------------------------------- |
| Format error     | "[Field] needs to be [format]. Example: [example]"       |
| Missing required | "Please enter [what's missing]"                          |
| Network error    | "Couldn't reach [thing]. Check connection and [action]." |
| Server error     | "Something went wrong on our end. [Alternative action]"  |

**Never blame the user.** "Please enter a date in MM/DD/YYYY format" not "You entered an invalid date".

### Empty States

Use as an onboarding moment: (1) Acknowledge briefly, (2) Explain the value, (3) Provide a clear action.

### Consistency

Choose one term and stick with it:

| Inconsistent                     | Consistent |
| -------------------------------- | ---------- |
| Delete / Remove / Trash          | Delete     |
| Settings / Preferences / Options | Settings   |
| Sign in / Log in                 | Sign in    |

### Undo > Confirm

Undo is better than confirmation dialogs — users click through confirmations. Use confirm only for truly irreversible or high-cost actions.

---

## Glass Surfaces (Apple-style opt-in)

Glassmorphism is an **opt-in design system choice**, not a default. Enable via `/frontend-animations` → Expressive pack (sets `theme.surfaces.glass.enabled = true`).

When enabled, apply iOS HIG rules strictly:

| Rule                 | Guidance                                                                                     |
| -------------------- | -------------------------------------------------------------------------------------------- |
| **Overlay only**     | Glass surfaces on sheets, navigation bars, popovers, modals — never on body backgrounds      |
| **Text contrast**    | Minimum 4.5:1 against the least-favorable backdrop color the glass can sit over              |
| **Fallback**         | Always emit `@supports (backdrop-filter: blur())` with solid `var(--color-surface)` fallback |
| **Scale limit**      | No `backdrop-filter` on elements > 60vh tall (mobile performance)                            |
| **One per viewport** | At most one actively blurring surface visible at a time                                      |
| **Reduced motion**   | Glass surfaces retain blur; only transitions are suppressed under `prefers-reduced-motion`   |

```css
.glass-card {
  background: var(--surface-glass-tint);
  border: var(--surface-glass-border);
  border-radius: var(--rounded-lg);

  @supports (backdrop-filter: blur()) {
    backdrop-filter: blur(var(--surface-glass-blur))
      saturate(var(--surface-glass-saturation));
  }
}
```

When `theme.surfaces.glass.enabled = false` (default), treat any `backdrop-filter` usage as a T108 violation.

---

## Animation Packs

Managed by `/frontend-animations`. Packs are composites — they set motion vocabulary, spring physics, choreography richness, and surface style as one coherent choice.

| Pack                     | Feel       | Key traits                                                      |
| ------------------------ | ---------- | --------------------------------------------------------------- |
| **None**                 | Static     | No transitions beyond color changes                             |
| **Subtle**               | Calm       | hover-lift 1px, press-scale 0.98, fades, ease-out               |
| **Standard** _(default)_ | Polished   | + stagger reveals, modal slides, route fades                    |
| **Expressive**           | Apple-like | iOS easings, spring physics, glass surfaces, view transitions   |
| **Playful**              | Whimsical  | + bouncy springs, success-pulse, attention.wiggle, celebrations |

**Anti-clichés for Playful pack:**

- Wiggle/bounce only on user-initiated success or attention moments — never on every hover
- `success.confetti`: max 30 particles, GPU `transform/opacity` only, auto-disabled under `prefers-reduced-motion`
- No "AI sparkle" purple gradient bursts on success
- No drop-shadows on text (still banned regardless of pack)
- Particle effects: max one moment per page, auto-cleanup after 2s

**All choreography tokens** auto-wrap in `@media (prefers-reduced-motion: reduce)` with opacity-only fade fallback. Spring physics degrade to `var(--ease-out)` at `0.01ms` duration.
