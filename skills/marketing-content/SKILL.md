---
name: marketing-content
argument-hint: "[onderwerp]"
description: >-
  Turn marketing research signals into concrete text variants per format and
  platform. Grounded in trend trajectories, sentiment conflicts, and audience
  language from /marketing-research output. Use with /marketing-content [topic]
  for social posts, email subjects, ad headlines, or landing page sections.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: marketing
---

# Marketing Content

Zet research-signalen om in concrete tekstvarianten per format en platform. Elke variant
is traceerbaar naar een specifiek signaal — geen generieke output.

**Trigger**: `/marketing-content` of `/marketing-content [onderwerp]`

Tweede stap in de marketing pipeline: `/marketing-research` → **`/marketing-content`** → `/marketing-promo`

## FASE 0: Input & Context

**Research auto-detect:**

Zoek naar `.project/thinking/*-marketing-research.md`. Als gevonden:

- Laad de SCOPE ANKERS sectie (onderwerp, doelgroep, kanalen, trajectory labels)
- Laad de Signal Analysis sectie (platform temperaturen, sentiment-conflict)
- Laad de Doelgroep Taal sectie (exacte woorden en frames van de doelgroep)
- Bevestig aan de gebruiker welk research-bestand geladen is

Als niet gevonden: vraag vrij-tekst beschrijving van het onderwerp en doelgroep.

**Format selectie** via AskUserQuestion:

```yaml
header: "Format"
question: "Welk type content wil je genereren?"
options:
  - label: "Social post (Recommended)", description: "Twitter/X, LinkedIn, Instagram"
  - label: "Email subject line", description: "3-5 varianten voor A/B test"
  - label: "Ad headline", description: "Google/Meta — max 30 tekens"
  - label: "Landing page sectie", description: "Hero headline + subline"
multiSelect: true
```

**Platform selectie** (alleen als Social post gekozen) via AskUserQuestion:

```yaml
header: "Platform"
question: "Voor welk platform?"
options:
  - label: "Twitter/X (Recommended)", description: "Max 280 tekens, directe toon"
  - label: "LinkedIn", description: "Professioneel, meer context toegestaan"
  - label: "Instagram", description: "Visueel, caption + hashtags"
multiSelect: true
```

**Tone/voice selectie** via AskUserQuestion:

```yaml
header: "Tone"
question: "Welke toon past bij dit merk of deze campagne?"
options:
  - label: "Informatief (Recommended)", description: "Helder, feitelijk, educatief — bouwt vertrouwen"
  - label: "Urgent", description: "Actiegericht, tijdgebonden — duwt naar beslissing"
  - label: "Provocatief", description: "Scherp, prikkelend, uitdagend — verovert aandacht"
  - label: "Inspirerend", description: "Motiverend, aspirationeel — raakt emotie"
multiSelect: false
```

Gebruik de gekozen tone als stijlconstraint in FASE 2: elke variant moet de geselecteerde
toon consistent reflecteren, ook als het trajectory-label een andere richting suggereert.

## FASE 1: Messaging Angles Distilleren

Map de sterkste research-signalen naar messaging frames:

| Signaal            | Messaging frame                                        |
| ------------------ | ------------------------------------------------------ |
| `acute_rise`       | Urgentie — "dit is het moment"                         |
| `comeback`         | Contrast — "het is terug, en nu anders"                |
| `plateau`          | Differentiatie — "wat maakt jou anders dan mainstream" |
| `zombie`           | Contra-indicator — vermijd, of gebruik als contrast    |
| sentiment-conflict | Provocatie — "niet iedereen is het eens over..."       |
| doelgroep taal     | Spiegel — gebruik hun exacte woorden terug             |

Selecteer de 3 sterkste angles op basis van beschikbare signalen. Als er geen research
beschikbaar is: gebruik Competitor Differentiation, Audience Mirror, en Problem/Solution
als default angles.

Presenteer:

```
MESSAGING ANGLES

1. {angle naam} — {frame} — gebaseerd op: {signaal + bron}
2. {angle naam} — {frame} — gebaseerd op: {signaal + bron}
3. {angle naam} — {frame} — gebaseerd op: {signaal + bron}
```

## FASE 2: Varianten Genereren

Per gekozen format: genereer 3-5 varianten, gespreid over de messaging angles.

**Lengte- en toonregels per format:**

| Format               | Lengte         | Toon                             |
| -------------------- | -------------- | -------------------------------- |
| Twitter/X post       | Max 280 tekens | Direct, geen opmaak              |
| LinkedIn post        | 150-300 tekens | Professioneel, opener toegestaan |
| Instagram caption    | 100-150 + tags | Visueel ondersteunend, emojis ok |
| Email subject line   | Max 50 tekens  | Nieuwsgierigheid of urgentie     |
| Ad headline          | Max 30 tekens  | Actiegericht, één kernboodschap  |
| Landing page hero    | 6-10 woorden   | Belofte of probleemstelling      |
| Landing page subline | 15-25 woorden  | Uitleg van de belofte            |

Elke variant bevat:

- De tekst (lengte-regel gerespecteerd)
- **Angle**: welk messaging frame
- **Signal**: welk research signaal rechtvaardigt dit
- **Trajectory**: `acute_rise` / `plateau` / `comeback` / `zombie` (als van toepassing)

Verbod op generieke tekst. Als een variant niet traceerbaar is naar een concreet signaal
of een van de angles, schrijf hem niet.

Presenteer per format:

```
{FORMAT} — {platform}

Variant 1:
"{tekst}"
Angle: {frame} | Signal: {signaal} | Trajectory: {label}

Variant 2:
...
```

## FASE 3: Opslaan

Sla op naar `.project/thinking/{onderwerp}-marketing-content.md`.

Toon next steps:

```
Next steps:
- /marketing-promo    — screenshots + visuals voor launch
- /marketing-research — nieuwe research ronde voor ander onderwerp
```

## Guidelines

**Formatting:**

- NOOIT blockquote syntax (`>`) — onleesbare achtergrond in dark terminals
- NOOIT backticks voor nadruk op gewone woorden — gebruik **bold**
- Backticks alleen voor code, file paths, en command references

**Language:** Follow the Language Policy in CLAUDE.md.
