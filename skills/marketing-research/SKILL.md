---
name: marketing-research
argument-hint: "[onderwerp]"
description: >-
  Marketing-focused trend and audience research. Identifies trend momentum,
  platform sentiment, messaging opportunities, and campaign timing windows.
  Use with /marketing-research [topic] for product launches, content strategy,
  or competitive positioning.
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: marketing
---

# Marketing Research

Research marketing opportunities by analyzing trend signals, platform sentiment, and audience language. Identifies timing windows and produces actor-specific recommendations — no vague "keep monitoring" output.

**Trigger**: `/marketing-research` or `/marketing-research [onderwerp]`

Complementair aan `/thinking-research` (conceptvalidatie) — deze skill zoekt actief naar marketing-kansen, timing-windows, en messaging-aanknopingspunten.

## FASE 0: Scope Definitie

**Bestaand rapport check:**

Zoek naar `.project/thinking/*-marketing-research.md`. Als gevonden, vraag via AskUserQuestion:

```yaml
header: "Bestaand rapport"
question: "Er bestaat al een marketing research rapport voor dit onderwerp. Wat wil je doen?"
options:
  - label: "Laden en doorgaan (Recommended)", description: "Gebruik bestaand rapport als basis voor marketing-content"
  - label: "Opnieuw onderzoeken", description: "Overschrijf het bestaande rapport met nieuw onderzoek"
multiSelect: false
```

Bij "Laden en doorgaan": toon de SCOPE ANKERS uit het bestaande rapport en sluit FASE 0 af. Ga direct naar FASE 3 (Aanbevelingen) of stel next steps voor.

**Als `$1` opgegeven** → gebruik als startpunt.

**Als geen argument:**

Vraag via AskUserQuestion:

```yaml
header: "Onderwerp"
question: "Wat wil je onderzoeken voor marketing?"
options:
  - label: "Product of feature launch", description: "Timing, messaging, doelgroep voor een launch"
  - label: "Content strategie", description: "Welke topics, formats, platforms nu relevant zijn"
  - label: "Competitive positioning", description: "Hoe concurrenten zich positioneren en waar de gap zit"
  - label: "Campagne timing", description: "Wanneer een thema of topic momentum heeft"
multiSelect: false
```

Vraag daarna vrij-tekst input: product/concept + doelgroep + eventueel tijdvenster.

**Scope extractie (twee-staps):**

Extraheer uit de vrij-tekst input 5-10 gestructureerde onderzoekshoeken. Categoriseer ze:

- **Doelgroep**: wie zijn ze, wat zeggen ze, welke taal gebruiken ze?
- **Trending topics**: wat is nu momentum in dit domein?
- **Concurrenten**: hoe positioneren ze zich, wat is hun messaging?
- **Kanalen**: waar is de doelgroep actief?
- **Timing signals**: wanneer is het gesprek het meest actief?

Presenteer als verplicht outputblok — dit is het contract tussen FASE 0 en de rest van
de skill, en de input voor `/marketing-content`:

```
SCOPE ANKERS

Onderwerp: {onderwerp in één zin}
Doelgroep: {wie + 2-3 kenmerken}
Trending topics: [{topic 1}, {topic 2}, ...]
Concurrenten: [{naam 1}, {naam 2}]
Actieve kanalen: [{platform 1}, {platform 2}]
Timing window: {nu actief / seizoensgebonden: {wanneer} / open}
Onderzoekstype: {launch / content / positioning / campagne timing}
```

Bevestig via AskUserQuestion (Ja / Aanpassen).

## FASE 1: Multi-Source Research

Voer WebSearch queries uit parallel, afgeleid van de scope-hoeken. Dek minimaal:

- Trend-signalen per platform (Twitter/X, Reddit, LinkedIn, HN, nieuwsbronnen)
- Competitor messaging en positionering
- Doelgroep taal en pijnpunten (forums, reviews, comments)

Presenteer bevindingen per bron met platform-label:

```
PLATFORM — {platform naam}

Query: "{search query}"

Findings:
- {key finding 1}
- {key finding 2}

Sources: {URLs}
```

## FASE 2: Signal Analysis

Analyseer de verzamelde data op drie assen:

**Platform-temperatuurverschillen:**

| Platform     | Karakter                                        |
| ------------ | ----------------------------------------------- |
| Twitter/X    | Vroege adoptie, emotioneel, snelle cycli        |
| Reddit       | Kritisch, gedetailleerd, nichegemeenschappen    |
| LinkedIn     | Professioneel, lagging indicator, B2B sentiment |
| Hacker News  | Tech/startup, sceptisch, anti-hype              |
| Product Hunt | Launch-moment buzz, vroege adopters             |

Temperatuurverschil = interpreteer actief: "trending op X maar niet op LinkedIn" is een signal, niet een gap.

**Trajectory per topic** — label elk relevant topic:

- `acute_rise`: verschijnt en stijgt snel → time-sensitive window
- `plateau`: hoog maar stabiel → mainstream, commodity-risk
- `zombie`: blijft hangen zonder groei → uitgestorven momentum
- `comeback`: was weg, keert terug → nieuwe trigger, onderzoek aanleiding

**Sentiment-conflict:**

Zoek naar waar de consensus breekt — niet "positief of negatief?" maar "waar klapt het sentiment?" Dat breekpunt is het meest relevante moment voor campagne-timing.

Presenteer:

```
SIGNAL ANALYSIS

Platform temperaturen:
- {platform}: {trajectory label} — {karakter van het gesprek}
- {platform}: {trajectory label} — {karakter van het gesprek}

Temperatuurverschil: {interpretatie van het verschil tussen platforms}

Zwakke signalen: {wat zit in niche-bronnen maar niet in mainstream?}

Sentiment-conflict: {waar klapt de consensus? wat is het eigenlijke conflict?}
```

## FASE 3: Actor-Specifieke Aanbevelingen

Vraag via AskUserQuestion welk actor-type relevant is:

```yaml
header: "Actor type"
question: "Voor wie zijn de aanbevelingen?"
options:
  - label: "Brand / bedrijf (Recommended)", description: "Marketingteam, content strategie, campagnes"
  - label: "Solo creator / personal brand", description: "Content creator, thought leader, freelancer"
  - label: "Agency / consultant", description: "Advies voor klanten, positionering"
multiSelect: false
```

Genereer per relevante scope-hoek een concrete aanbeveling:

- **Actie**: wat specifiek te doen (niet "overweeg X" maar "publiceer Y op Z")
- **Timing-window**: wanneer — gebaseerd op trajectory label
- **Onderbouwing**: welk signaal rechtvaardigt dit
- **Platform**: waar te activeren

Verbod op "blijf monitoren"-adviezen. Elke aanbeveling eindigt met een concrete actie of beslissing. Als het moment nog niet rijp is: zeg dat expliciet met de voorwaarde waaronder het wel rijp wordt.

Presenteer als tabel:

```
AANBEVELINGEN — {actor type}

| # | Actie | Timing | Platform | Onderbouwing |
|---|-------|--------|----------|--------------|
| 1 | {concrete actie} | {nu / over N weken / wacht op X} | {platform} | {signal} |
| 2 | ... | ... | ... | ... |
```

## FASE 4: Rapport + Opslaan

Genereer een markdown rapport:

```markdown
# Marketing Research: {onderwerp}

## Summary

{2-3 zinnen: wat is de kernkans en het kernrisico?}

## Signal Analysis

### Platform Temperaturen

{temperatuurverschillen + trajectories}

### Sentiment Conflict

{waar breekt de consensus?}

### Zwakke Signalen

{wat mainstream niet dekt}

## Doelgroep Taal

{exacte woorden, frames, en pijnpunten die de doelgroep gebruikt}

## Competitive Positioning

{hoe positioneren concurrenten zich en waar zit de gap?}

## Aanbevelingen

| #   | Actie | Timing | Platform | Onderbouwing |
| --- | ----- | ------ | -------- | ------------ |

{tabel uit FASE 3}

## Sources

- [{source title}]({url})
```

Sla op naar `.project/thinking/{onderwerp}-marketing-research.md`.

Toon next steps:

```
Next steps:
- /marketing-content  — tekstvarianten schrijven op basis van deze signalen
- /thinking-decide    — beslissing nemen op basis van deze inzichten
- /marketing-screenshots — marketing screenshots voor launch
- /project-plan       — feature backlog op basis van marktinzichten
```

## Guidelines

**Formatting:**

- NOOIT blockquote syntax (`>`) — onleesbare achtergrond in dark terminals
- NOOIT backticks voor nadruk op gewone woorden — gebruik **bold**
- Backticks alleen voor code, file paths, en command references

**Language:** Follow the Language Policy in CLAUDE.md.
