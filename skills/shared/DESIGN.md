# Design Quality Guide

Visuele design principes die AI-gegenereerde sameness bestrijden. Complementeert RULES.md (coding standards) en PATTERNS.md (component patterns) met design-inhoudelijke guidance.

> **Scope:** Alle frontend skills. Lees dit bestand bij elke design-beslissing.

---

## Anti-Patterns (AI Design Tells)

Patronen die schreeuwen "een AI heeft dit gemaakt". Vermijd deze actief.

### Typography

| Vermijd                                             | Waarom                                 | Alternatief                                                                            |
| --------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------- |
| Inter, Roboto, Open Sans als default                | Overal gebruikt, maakt design generiek | Instrument Sans, Plus Jakarta Sans, Outfit, Figtree, Onest                             |
| System fonts zonder bewuste keuze                   | Voelt als "geen moeite gedaan"         | Kies bewust: system fonts zijn prima als het een app is waar performance > personality |
| Te veel font sizes dicht bij elkaar (14/15/16/18px) | Geen duidelijke hiërarchie             | Max 5 sizes met sterke ratio (1.25–1.5)                                                |
| Monospace voor decoratie                            | Overdone tech-aesthetic                | Gebruik monospace alleen voor code                                                     |

### Color

| Vermijd                                  | Waarom                             | Alternatief                                            |
| ---------------------------------------- | ---------------------------------- | ------------------------------------------------------ |
| Pure black `#000` / pure gray (chroma 0) | Bestaat niet in natuur, voelt hard | Tinted neutrals: `oklch(15% 0.01 <hue>)`               |
| Grijs op gekleurde achtergrond           | Ziet er dood en uitgewassen uit    | Donkere tint van de achtergrondkleur, of transparantie |
| Paars-blauw gradient als accent          | AI-standaard bij uitstek           | Kies een eigen kleur met intentie                      |
| Gradient text                            | Moeilijk leesbaar, overdone        | Gebruik kleur of weight voor nadruk                    |
| Puur witte achtergronden overal          | Klinisch, geen warmte              | Licht getinte achtergrond `oklch(98% 0.005 <hue>)`     |

### Layout

| Vermijd                         | Waarom                                | Alternatief                                               |
| ------------------------------- | ------------------------------------- | --------------------------------------------------------- |
| Cards in cards                  | Visuele ruis, onduidelijke hiërarchie | Spacing + typografie voor hiërarchie binnen cards         |
| Identieke card grids voor alles | Repetitief, geen visuele spanning     | Varieer layout: list, masonry, featured + grid            |
| Alles gecentreerd               | Voelt als template, geen rhythm       | Left-align tekst, centreer alleen hero's en CTA's         |
| Glassmorphism zonder reden      | Decoratie zonder functie              | Gebruik depth alleen waar het informatie-hiërarchie dient |
| Hero met metriek-kaarten        | Overal hetzelfde dashboard-patroon    | Ontwerp vanuit de specifieke use case                     |

### Motion

| Vermijd                 | Waarom                          | Alternatief                                          |
| ----------------------- | ------------------------------- | ---------------------------------------------------- |
| Bounce/elastic easing   | Voelt 2015, tacky               | Smooth deceleration: `ease-out-quart`                |
| Animatie zonder doel    | Afleidend, vertraagt interactie | Animeer alleen als het informatie toevoegt           |
| Alles tegelijk animeren | Animation fatigue               | Stagger, of animeer alleen het belangrijkste element |

---

## Color

### OKLCH als Kleurruimte

Gebruik OKLCH in plaats van HSL. OKLCH is perceptueel uniform — gelijke stappen in lightness _zien_ er gelijk uit.

```css
/* Structuur: oklch(lightness chroma hue) */
--primary: oklch(60% 0.15 250);
--primary-light: oklch(85% 0.08 250); /* Lager chroma bij hogere lightness */
--primary-dark: oklch(35% 0.12 250);
```

**Key insight:** Verlaag chroma richting wit/zwart. Hoog chroma bij extreme lightness ziet er schel uit.

### Tinted Neutrals

Voeg altijd een hint van je brand-hue toe aan grijstinten (chroma ~0.01):

```css
/* Warm neutrals */
--gray-100: oklch(95% 0.01 60);
--gray-900: oklch(15% 0.01 60);

/* Cool neutrals (tech, professioneel) */
--gray-100: oklch(95% 0.01 250);
--gray-900: oklch(15% 0.01 250);
```

### 60-30-10 Regel

| Aandeel | Rol                                         | Voorbeeld      |
| ------- | ------------------------------------------- | -------------- |
| 60%     | Neutral — achtergronden, whitespace         | Surface colors |
| 30%     | Secundair — tekst, borders, inactive states | Gray scale     |
| 10%     | Accent — CTA's, highlights, focus           | Brand color    |

Accent werkt _omdat_ het zeldzaam is. Overmatig gebruik doodt de kracht.

### Dark Mode ≠ Inverted Light Mode

| Light Mode             | Dark Mode                                     |
| ---------------------- | --------------------------------------------- |
| Shadows voor diepte    | Lichtere surfaces voor diepte (geen shadows)  |
| Donkere tekst op licht | Lichte tekst op donker — verlaag font-weight  |
| Levendige accenten     | Licht desatureren                             |
| Witte achtergronden    | Nooit pure black — `oklch(12-18% 0.01 <hue>)` |

---

## Typography

### Font Keuze

Eén goed gekozen font in meerdere weights is vaak beter dan twee concurrerende typefaces. Voeg een tweede font alleen toe voor echt contrast (display headline + body serif).

**Google Fonts alternatieven voor overgebruikte fonts:**

| In plaats van  | Probeer                                    |
| -------------- | ------------------------------------------ |
| Inter          | Instrument Sans, Plus Jakarta Sans, Outfit |
| Roboto         | Onest, Figtree, Urbanist                   |
| Open Sans      | Source Sans 3, Nunito Sans, DM Sans        |
| Editorial feel | Fraunces, Newsreader, Lora                 |

### Modular Scale

Kies één ratio en commit:

| Ratio | Naam           | Karakter              |
| ----- | -------------- | --------------------- |
| 1.125 | Minor Second   | Subtiel, compact UI   |
| 1.25  | Major Third    | Veelzijdig, populair  |
| 1.333 | Perfect Fourth | Sterk contrast        |
| 1.5   | Perfect Fifth  | Dramatisch, editorial |

5 sizes zijn genoeg: `xs` (0.75rem), `sm` (0.875rem), `base` (1rem), `lg` (1.25-1.5rem), `xl+` (2-4rem).

### Fluid Typography

```css
/* clamp(minimum, preferred, maximum) */
font-size: clamp(1rem, 0.5rem + 2vw, 2.5rem);
```

Gebruik fluid type voor headings en hero text. **Niet** voor buttons, labels, en UI-elementen — die moeten consistent zijn.

### OpenType Features

```css
.data-table {
  font-variant-numeric: tabular-nums;
} /* Uitgelijnde getallen */
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

| Duur      | Gebruik                                                  |
| --------- | -------------------------------------------------------- |
| 100–150ms | Directe feedback: button press, toggle, kleurverandering |
| 200–300ms | State changes: menu, tooltip, hover                      |
| 300–500ms | Layout changes: accordion, modal, drawer                 |
| 500–800ms | Entrance: page load, hero reveals                        |

**Exit = 75% van enter duur.**

### Easing Curves

| Curve       | Gebruik                   | CSS                              |
| ----------- | ------------------------- | -------------------------------- |
| ease-out    | Elementen die binnenkomen | `cubic-bezier(0.25, 1, 0.5, 1)`  |
| ease-in     | Elementen die verdwijnen  | `cubic-bezier(0.7, 0, 0.84, 0)`  |
| ease-in-out | State toggles             | `cubic-bezier(0.65, 0, 0.35, 1)` |

Definieer als tokens:

```css
--ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1); /* Default — smooth */
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1); /* Snappy, confident */
--ease-in-quart: cubic-bezier(0.5, 0, 0.75, 0); /* Exit */
```

### Animeer Alleen transform en opacity

Alles anders veroorzaakt layout recalculation. Voor height-animaties: `grid-template-rows: 0fr → 1fr`.

### Stagger

```css
animation-delay: calc(var(--i, 0) * 50ms);
```

Cap totale stagger tijd — 10 items × 50ms = 500ms max.

### Reduced Motion (verplicht)

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

Bewaar functionele animaties (progress bars, spinners) maar zonder ruimtelijke beweging.

---

## Interaction States

Elk interactief element heeft 8 mogelijke states:

| State    | Wanneer                   | Visueel                           |
| -------- | ------------------------- | --------------------------------- |
| Default  | In rust                   | Basis styling                     |
| Hover    | Pointer over (niet touch) | Subtiele lift of kleurshift       |
| Focus    | Keyboard/programmatisch   | Zichtbare ring (`:focus-visible`) |
| Active   | Wordt ingedrukt           | Ingedrukt, donkerder              |
| Disabled | Niet interactief          | Verlaagde opacity, geen pointer   |
| Loading  | Bezig                     | Spinner of skeleton               |
| Error    | Ongeldige state           | Rode border + icoon + message     |
| Success  | Voltooid                  | Groene check + bevestiging        |

**Minimaal 5 states per interactief element.** Ontwerp hover en focus altijd apart — keyboard users zien nooit hover.

### Focus Rings

```css
button:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

Nooit `outline: none` zonder vervanging. Minimaal 3:1 contrast.

---

## Spatial Design

### 4pt Spacing Systeem

8pt is te grof (12px ontbreekt). Gebruik 4pt: `4, 8, 12, 16, 24, 32, 48, 64, 96`.

Naam tokens semantisch (`--space-sm`, `--space-lg`), niet naar waarde (`--spacing-8`). Gebruik `gap` i.p.v. margins voor siblings.

### Hiërarchie via Meerdere Dimensies

Vertrouw niet alleen op grootte. Combineer altijd 2-3:

| Tool   | Sterk                   | Zwak                 |
| ------ | ----------------------- | -------------------- |
| Size   | 3:1 ratio of meer       | <2:1 ratio           |
| Weight | Bold vs Regular         | Medium vs Regular    |
| Color  | Hoog contrast           | Vergelijkbare tinten |
| Space  | Omringd door whitespace | Vol                  |

### Container Queries voor Componenten

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

Viewport queries voor page layout, container queries voor componenten.

---

## UX Writing

### Button Labels

Specifiek werkwoord + object. Nooit "OK", "Submit", of "Yes/No":

| Slecht | Goed           |
| ------ | -------------- |
| OK     | Save changes   |
| Submit | Create account |
| Yes    | Delete message |
| Cancel | Keep editing   |

Destructieve acties: benoem de destructie ("Delete 5 items", niet "Delete selected").

### Error Messages

Beantwoord altijd: (1) Wat? (2) Waarom? (3) Hoe oplossen?

| Situatie         | Template                                                 |
| ---------------- | -------------------------------------------------------- |
| Format error     | "[Field] needs to be [format]. Example: [example]"       |
| Missing required | "Please enter [what's missing]"                          |
| Network error    | "Couldn't reach [thing]. Check connection and [action]." |
| Server error     | "Something went wrong on our end. [Alternative action]"  |

**Beschuldig nooit de gebruiker.** "Please enter a date in MM/DD/YYYY format" niet "You entered an invalid date".

### Empty States

Gebruik als onboarding moment: (1) Erken kort, (2) Leg de waarde uit, (3) Geef een duidelijke actie.

### Consistency

Kies één term en houd je eraan:

| Inconsistent                     | Consistent |
| -------------------------------- | ---------- |
| Delete / Remove / Trash          | Delete     |
| Settings / Preferences / Options | Settings   |
| Sign in / Log in                 | Sign in    |

### Undo > Confirm

Undo is beter dan confirmation dialogs — gebruikers klikken door confirmations heen. Gebruik confirm alleen voor echt onomkeerbare of high-cost acties.
