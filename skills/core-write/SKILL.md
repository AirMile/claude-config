---
name: core-write
description: >-
  Write a text from scratch in a Miles writing style with guided context-gathering.
  Detects style automatically based on text type (blog/post/note → personal, README/docs → clear, portfolio/showcase → portfolio, analyse/rapport → insights).
  Supports Quick (one question round), Standard (two rounds), and Full (with outline approval) flows.
  Use with /core-write [what to write].
argument-hint: "[what to write]"
user-invocable: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: core
---

# Write

Schrijfhulp die tekst genereert in een Miles-stijl. Verzamelt context via vragen, kiest het juiste begeleidingsniveau automatisch, en past de gekozen stijl strikt toe.

## 1. Parse Input

Analyseer het argument op:

- **Onderwerp** — waarover gaat de tekst
- **Type tekst** — blog, post, note, README, docs, portfolio-page, etc.
- **Context-rijkheid** — hoeveel is al gegeven (zie Step 3)

Als geen argument: vraag type tekst en onderwerp voordat je verdergaat.

## 2. Auto-Detect Style

Match keywords in het argument tegen bekende types:

| Keywords in argument                                      | Stijl     | Voorbeeld                       |
| --------------------------------------------------------- | --------- | ------------------------------- |
| blog, post, note, essay, artikel, journal                 | personal  | "blog over mijn eerste project" |
| README, docs, documentatie, uitleg, handleiding, tutorial | clear     | "README voor draftgap"          |
| portfolio, showcase, CV, demo-page, project-page          | portfolio | "portfolio-tekst voor draftgap" |
| rapport, analyse, insights, deep dive, review, verslag    | insights  | "analyse van mijn ontwikkeling" |

Geen match gevonden? Vraag:

```yaml
header: "Style"
question: "Welke schrijfstijl?"
options:
  - label: "Personal"
    description: "Persoonlijke ik-voice. Schrijf alsof je het iemand vertelt aan tafel. Voor blogs, posts, notes."
  - label: "Clear"
    description: "Objectief in Miles-stijl. Sprekend-vertellend, geen 'ik'. Voor README's, docs, uitleg."
  - label: "Portfolio"
    description: "Direct, actief, toont niet claimt. Professioneel maar natuurlijk. Voor demo/showcase."
  - label: "Insights"
    description: "Analytisch, data-verweven, zelfverzekerd. Claim-bewijs-conclusie."
multiSelect: false
```

Match gevonden? Laat weten welke stijl is gedetecteerd en vraag bevestiging:

```yaml
header: "Stijl"
question: "Gedetecteerde stijl: {X}. Klopt dat?"
options:
  - label: "Ja, gebruik {X}"
    description: ""
  - label: "Andere stijl kiezen"
    description: ""
multiSelect: false
```

## 3. Bepaal Flow-Niveau

Beoordeel context-rijkheid van het argument op basis van hoeveel er al bekend is:

**Sparse** (< 5 inhoudswoorden, bijv. "blog over X"):
→ Vraag flow-niveau via AskUserQuestion:

```yaml
header: "Begeleiding"
question: "Hoe uitgebreid wil je worden begeleid?"
options:
  - label: "Standard (Recommended)"
    description: "Twee korte vragenrondes (audience + doel, daarna kernpunten + angle), dan direct draft."
  - label: "Quick"
    description: "Één vragenronde (kernpunten + lengte), meteen draft. Voor als je al weet wat je wil."
  - label: "Full"
    description: "Twee rondes + outline-goedkeuring + iteratieronde achteraf. Voor belangrijke teksten."
multiSelect: false
```

**Medium** (5–15 woorden met duidelijk onderwerp + angle of audience):
→ Default **Standard**, sla flow-vraag over.

**Rich** (15+ woorden met meerdere context-elementen al ingevuld):
→ Default **Quick**, sla flow-vraag over.

**Keyword-override** (altijd van toepassing):

- "uitgebreid", "begeleid", "diep" in argument → forceer **Full**
- "snel", "kort", "draft" in argument → forceer **Quick**

## 4. Context Verzamelen

### Quick

Eén AskUserQuestion-block (kan alles tegelijk):

```yaml
header: "Context"
question: "Vul kort in zodat ik kan beginnen:"
options:
  - label: "Kernpunten + lengte"
    description: "Wat moet er sowieso in? (3-5 punten). Hoe lang? (kort/medium/lang)"
multiSelect: false
```

Accepteer ook vrije tekst via "Other". Ga na beantwoording direct naar Step 5.

### Standard

**Ronde 1 — AskUserQuestion:**

```yaml
header: "Audience"
question: "Wie is de lezer en wat is het doel?"
options:
  - label: "Audience + doel"
    description: "Wie leest dit? Developers / managers / vrienden / iedereen? Doel: informeren / overtuigen / vermaken?"
multiSelect: false
```

Lengte-voorkeur als aparte optie of via "Other":

```yaml
header: "Lengte"
question: "Hoe lang moet de tekst zijn?"
options:
  - label: "Kort (< 300 woorden)"
    description: ""
  - label: "Medium (300–700 woorden)"
    description: ""
  - label: "Lang (700+ woorden)"
    description: ""
multiSelect: false
```

**Ronde 2 — AskUserQuestion:**

```yaml
header: "Inhoud"
question: "Wat moet er sowieso in?"
options:
  - label: "Kernpunten"
    description: "3-5 dingen die zeker in de tekst moeten. Gebruik 'Other' voor een lijstje."
  - label: "Angle / invalshoek"
    description: "Is er een specifieke hoek, stelling of boodschap die centraal moet staan?"
multiSelect: true
```

Ga na beide rondes naar Step 5.

### Full

Zelfde als Standard (Ronde 1 + 2) plus na context:

**Outline-fase:**

Genereer een outline: tussenkoppen + één zin per sectie. Toon aan gebruiker en vraag:

```yaml
header: "Outline"
question: "Klopt de structuur?"
options:
  - label: "Goed, schrijf de draft"
    description: ""
  - label: "Aanpassen"
    description: "Zeg wat anders moet, ik pas de outline aan en vraag opnieuw."
multiSelect: false
```

Pas outline aan tot akkoord, dan naar Step 5.

**Iteratie-fase** (na draft):

```yaml
header: "Draft"
question: "Hoe is de draft?"
options:
  - label: "Goed zo"
    description: ""
  - label: "Iteratieronde"
    description: "Zeg wat anders moet. Ik pas aan en toon de nieuwe versie."
multiSelect: false
```

## 5. Schrijf Draft

```
Read("../shared/styles/_anti-patterns.md")
Read("../shared/styles/style-{style}.md")
```

Schrijf de volledige tekst met alle regels uit beide bestanden strikt toegepast.

Behoud:

- Taal van de context-input (NL → NL, EN → EN)
- Tech termen in Engels

## 5b. Self-Check

Verifieer de draft voor output. Stilzwijgend:

1. Loop de draft zin voor zin langs. Markeer:
   - Zinnen > 25 woorden
   - Em dashes
   - Elk verboden woord uit `_anti-patterns.md` of de stijl-specifieke lijst
   - Drie zinnen van vergelijkbare lengte achter elkaar (geen burstiness)
   - Stijl-specifieke overtredingen (panoramische opener bij personal, marketing-speak bij clear, etc.)
2. Gevonden overtredingen: herschrijf die zinnen ter plekke. Geen overtredings-lijst outputten.
3. Herhaal maximaal één keer als een herschrijving nieuwe problemen introduceert. Na twee passes: accepteer resterende imperfectie.

Self-check is stil. Output blijft tekst-only (Step 6).

## 6. Output

Output ALLEEN de tekst. Geen commentaar, geen "hier is je draft", geen wrapping.
