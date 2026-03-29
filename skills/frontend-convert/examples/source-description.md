# Source Visual: SaaS Pricing Page

Dit bestand simuleert de output van FASE 0.2 (Visual Analysis) — wat Claude uit een screenshot of URL zou extraheren.

## Layout

- Full-width header met logo links, navigatie rechts
- Hero sectie: titel "Simple, transparent pricing" gecentreerd, subtitel eronder
- Toggle: Monthly / Yearly (yearly toont "-20%" badge)
- 3 pricing tiers naast elkaar (grid): Starter, Professional (highlighted), Enterprise
- Elke tier: naam, prijs, beschrijving, feature lijst met checkmarks, CTA button
- Feature vergelijkingstabel eronder: rijen per feature, kolommen per tier
- Footer met links

## Kleuren (geextraheerd)

- Achtergrond: `#F7FAFC` (lichtgrijs)
- Header/footer: `#2D3748` (donker blauw-grijs)
- Highlighted tier achtergrond: `#EBF4FF` (licht blauw)
- CTA primary: `#3182CE` (blauw)
- CTA highlighted: `#2B6CB0` (donkerder blauw)
- Tekst primair: `#1A202C`
- Tekst secundair: `#718096`
- Checkmarks: `#38A169` (groen)
- Badge: `#F6E05E` achtergrond, `#744210` tekst

## Typografie

- Heading: 36px, font-weight 800, letter-spacing -0.025em
- Subtitel: 18px, font-weight 400, line-height 1.6
- Tier naam: 24px, font-weight 700
- Prijs: 48px, font-weight 800
- Feature tekst: 16px, font-weight 400
- CTA button: 16px, font-weight 600, uppercase

## Componenten

- `PricingToggle` — monthly/yearly switch met animated indicator
- `PricingTier` — card met naam, prijs, features, CTA (3x)
- `FeatureTable` — vergelijkingstabel met checkmarks/crosses
