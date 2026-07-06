# Source Visual: SaaS Pricing Page

This file simulates the output of PHASE 0.2 (Visual Analysis) — what Claude would extract from a screenshot or URL.

## Layout

- Full-width header with logo on the left, navigation on the right
- Hero section: title "Simple, transparent pricing" centered, subtitle below
- Toggle: Monthly / Yearly (yearly shows "-20%" badge)
- 3 pricing tiers side by side (grid): Starter, Professional (highlighted), Enterprise
- Each tier: name, price, description, feature list with checkmarks, CTA button
- Feature comparison table below: rows per feature, columns per tier
- Footer with links

## Colors (extracted)

- Background: `#F7FAFC` (light gray)
- Header/footer: `#2D3748` (dark blue-gray)
- Highlighted tier background: `#EBF4FF` (light blue)
- CTA primary: `#3182CE` (blue)
- CTA highlighted: `#2B6CB0` (darker blue)
- Primary text: `#1A202C`
- Secondary text: `#718096`
- Checkmarks: `#38A169` (green)
- Badge: `#F6E05E` background, `#744210` text

## Typography

- Heading: 36px, font-weight 800, letter-spacing -0.025em
- Subtitle: 18px, font-weight 400, line-height 1.6
- Tier name: 24px, font-weight 700
- Price: 48px, font-weight 800
- Feature text: 16px, font-weight 400
- CTA button: 16px, font-weight 600, uppercase

## Components

- `PricingToggle` — monthly/yearly switch with animated indicator
- `PricingTier` — card with name, price, features, CTA (3x)
- `FeatureTable` — comparison table with checkmarks/crosses
