---
name: thinking-research
description: Multi-source research on concepts and ideas. Combines web search, documentation lookup, and codebase analysis into structured findings. Use with /thinking-research after /thinking-concept, /thinking-brainstorm, or /thinking-critique.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.3.0
  category: thinking
---

## Overview

Researches concepts and ideas through multiple external sources: web search for market/competitor/trend data, Context7 for technical documentation, and optionally codebase analysis. Works with any concept input — from thinking pipeline output, existing documents, or direct input.

Flow: extract research questions → auto-select technique → execute multi-source research → synthesize → loop or generate report.

## Workflow

### Step 1: Parse Input

**Auto-detect concept file:**

1. Check if `.project/project-concept.md` exists (primary) or `.project/project.json` has non-empty `concept.content` (legacy fallback)
2. If found AND no inline input provided:
   - Show concept name and ask confirmation:
     ```yaml
     header: "Concept Laden"
     question: "Wil je dit concept onderzoeken?"
     options:
       - label: "Ja, onderzoek dit (Recommended)", description: "Gebruik concept uit project.json"
       - label: "Ander concept", description: "Ik wil een ander concept plakken"
     multiSelect: false
     ```

**Scope check** — alleen als er scope-context bestaat (backlog, features, of pagina-bestanden):

Check `.project/backlog.html`, `.project/features/`, en `app/**/page.tsx` / `src/pages/**/*.tsx`. Als minstens één gevonden:

```yaml
header: "Scope"
question: "Waarover wil je research doen?"
options:
  - label: "Concept (Recommended)", description: "Werk met concept uit project.json"
  - label: "Feature uit backlog", description: "Focus op een specifieke feature"
  - label: "Pagina / UX flow", description: "Focus op layout, UX of user flow"
  - label: "Los idee", description: "Standalone idee, niet gekoppeld aan het project"
multiSelect: false
```

Scope-specifieke input:

- **Feature**: Lees backlog (zie `shared/BACKLOG.md`), toon features TODO/DEF, laad `01-define.md` of feature-beschrijving
- **Pagina/UX**: Glob voor pagina-bestanden, laad als context
- **Los idee**: Negeer geladen concept, vraag gebruiker om beschrijving

Output-pad volgt scope:

- concept → `.project/project-concept.md` + update project.json metadata (name, pitch)
- feature → `.project/features/{naam}/research.md`
- pagina/UX of los idee → `.project/thinking/{onderwerp}-research.md`

**Obsidian fallback** — als geen `.project/` folder bestaat:

Search Obsidian met het inline argument. Bij match in `Ideas/`: vraag of dit als startpunt dient. Track `obsidian_source_path` voor save-back.

**Overige input** — als geen concept gevonden of gebruiker wil ander input:

Accepteer input van gebruiker (thinking output, document, beschrijving, of chat context). Bij onduidelijkheid: stel 2-3 gerichte vragen. Bevestig het concept samengevat voordat je doorgaat.

### Step 2: Extract Research Foundation

Extract eerst vier categorieën uit het concept, distilleer dan research vragen.

**2a. Extract foundation (4 categorieën, kort, één regel per item):**

- **Assumptions** — wat nemen we voor waar aan dat we mogelijk moeten valideren?
- **Knowledge gaps** — wat weten we simpelweg niet? (markt, concurrenten, prijzen, gebruikersgedrag)
- **Decisions** — welke keuzes moeten we maken en welke info hebben we daarvoor nodig? (tech stack, pricing, doelgroep)
- **Risks** — wat kan dit concept laten falen? (technisch, juridisch, schaalbaarheid, adoptie)

**2b. Distilleer 3-5 research vragen** met de hoogste impact op haalbaarheid. Vragen kunnen uit elke categorie komen — meestal een mix. Elke vraag moet beantwoordbaar zijn via web search, documentatie, of codebase analyse en specifiek voor DIT concept.

**2c. Bewaar assumptions** apart (ook degene die niet in research vragen terechtkomen) — die worden in Step 5/7 gemarkeerd als Validated / Invalidated / Still Open.

Presenteer:

```
RESEARCH FOUNDATION

Concept: {concept title}

Assumptions:
- {assumption 1}
- {assumption 2}

Knowledge Gaps:
- {gap 1}
- {gap 2}

Decisions Needed:
- {decision 1}

Risks:
- {risk 1}
- {risk 2}

RESEARCH QUESTIONS (gedistilleerd uit bovenstaande)

1. {specific research question — highest priority}
2. {specific research question}
3. {specific research question}
4. {specific research question} (optional)
5. {specific research question} (optional)
```

Bevestig via AskUserQuestion (Ja/Aanpassen).

### Step 3: Select Research Technique

Read `references/research-techniques.md`. Selecteer automatisch de meest relevante techniek op basis van:

- Welke techniek adresseert de hoogst-geprioriteerde onbeantwoorde vragen?
- Welke technieken zijn al toegepast? (sluit uit)

Toon de keuze kort:

```
RESEARCH TECHNIQUE: {Technique Name}

{1-2 zinnen waarom deze techniek gekozen is}
```

Ga direct door naar Step 4.

### Step 4: Execute Research

Read de geselecteerde techniek uit `references/research-techniques.md`.

**Execute research sources parallel waar mogelijk:**

- **WebSearch**: 2-4 gerichte queries afgeleid van de techniek
- **Context7**: `resolve-library-id` → `query-docs` voor technische vragen
- **Codebase**: `Grep`/`Glob` als het concept een bestaand project betreft

Presenteer bevindingen per bron:

```
WEB|DOCS|CODE — {SOURCE NAME}

Query: "{search query}"

Findings:
- {key finding 1}
- {key finding 2}

Sources: {URLs or file paths}
```

Bied aan om dieper in te gaan als bevindingen onverwachte hoeken onthullen.

**Guidelines:**

- Cross-reference tussen bronnen
- Flag tegenspraken en aannames die uitgedaagd worden
- Kwantitatieve data waar beschikbaar
- Altijd bronnen citeren

### Step 5: Synthesize Findings

Map bevindingen naar de research vragen uit Step 2:

```
SYNTHESIS — {Technique Name}

### Q1: {research question}
**Status:** {Answered / Partially answered / Needs more research}
- {key finding with source reference}
**Implication:** {what this means for the concept}

### Q2: {research question}
...

### Assumption Tracking
- {assumption}: **Validated** — {evidence + source}
- {assumption}: **Invalidated** — {evidence + source}
- {assumption}: **Still Open** — {what's needed to validate}

### Decision Tracking
- {decision}: **Ready** — {recommended option + rationale}
- {decision}: **Blocked** — {what's still needed}

### Risk Tracking
- {risk}: **Severity High/Med/Low** — {mitigation OR "still open"}

### New Insights
- {unexpected finding or new angle discovered}
```

Ga door naar Step 6.

### Step 6: Next Action

Bouw eerst een open-items overzicht op basis van Step 5 tracking:

```
Open items overview:
- Unanswered questions: {n}
- Still-Open assumptions: {n}
- Blocked decisions: {n}
- Unaddressed High/Med risks: {n}

Total open items: {sum}
```

**Beslislogica:**

- **Total = 0** of geen relevante technieken over \u2192 ga direct naar Step 7
- **Total > 0** \u2192 toon AskUserQuestion. Bepaal de aanbevolen techniek door:
  1. Selecteer het meest urgente type open item in volgorde: **High-severity risks > Blocked decisions > Still-Open assumptions > Unanswered questions**
  2. Match het type met de `Addresses:` mapping uit `references/research-techniques.md`
  3. Eerste optie blijft "Genereer rapport (Recommended)" zodat de gebruiker altijd kan afsluiten

Toon de redenering kort v\u00f3\u00f3r de vraag:

```
Recommendation: {Technique} \u2014 addresses {N} open {item type}(s)
```

Vraag via AskUserQuestion:

```yaml
header: "Volgende Stap"
question: "Hoe wil je verder?"
options:
  - label: "Genereer rapport (Recommended)", description: "Cre\u00eber het eindresultaat met alle bevindingen"
  - label: "{Technique}", description: "{rationale \u2014 addresses {N} open {item type}}"
multiSelect: false
```

### Step 7: Generate Final Report

Genereer een gestructureerd markdown rapport:

```markdown
# Research: {concept title}

## Summary

{2-3 sentence executive summary}

## Key Findings

### {Finding Category}

{findings with evidence and source references}
**Implication:** {what this means for the concept}

## Assumptions

**Validated:**

- {assumption} — {evidence}

**Invalidated:**

- {assumption} — {evidence, what to reconsider}

**Still Open:**

- {assumption} — {what's needed to validate}

## Decisions

**Ready to decide:**

- {decision} — {info gathered, recommended option, rationale}

**Still blocked:**

- {decision} — {what's still needed before you can choose}

## Risk Assessment

| Risk   | Severity     | Likelihood   | Mitigation                     |
| ------ | ------------ | ------------ | ------------------------------ |
| {risk} | High/Med/Low | High/Med/Low | {strategy or "needs research"} |

## Recommendations

1. {actionable recommendation}

## Open Questions

- {unanswered or emerged question}

## Sources

- [{source title}]({url})
```

Inclusief Competitive Landscape tabel en/of Technical Feasibility assessment als relevant.

### Step 8: Save & Sync

**Scope = concept (default):**

Auto-save zonder extra vragen:

1. Schrijf rapport naar `.project/thinking/{concept-name}-research.md` (volledig rapport als user-archief)
2. Voeg `## Research Findings` sectie toe aan `.project/project-concept.md` (dit is wat dev-plan/dev-define als context zien)
3. Bevestig:

```
RESEARCH SAVED

Report: .project/thinking/{concept-name}-research.md
Concept: project-concept.md updated with key findings
Applied techniques: {list}

Wil je ook naar Obsidian opslaan? Zo ja, laat het weten.

Next steps:
- /thinking-critique - Kritisch analyseren met research context
- /thinking-brainstorm - Creatief uitbreiden met nieuwe inzichten
- /thinking-decide - Beslissing nemen op basis van research
- /dev-plan - Omzetten naar web feature backlog
```

**Scope = feature of pagina:**

1. Schrijf naar scope-pad (`.project/features/{naam}/research.md` of `.project/thinking/{onderwerp}-research.md`)
2. Vraag optioneel of key findings ook in `project-concept.md` verwerkt moeten worden

De markdown is de bron van waarheid — geen `project.json` `thinking[]` append. Skills die research willen consumeren (zoals `/dev-define`) lezen rechtstreeks uit `.project/thinking/*.md` of `.project/features/{naam}/research.md`.

**Scope = los idee:**

1. Schrijf naar `.project/thinking/{onderwerp}-research.md`
2. Bied Obsidian save aan als optie

De markdown is de bron van waarheid — geen `project.json` `thinking[]` append.

**Obsidian save flow** (wanneer gevraagd):

Als `obsidian_source_path` bekend: schrijf naast het originele idee. Anders: detecteer categorie, schrijf naar `Ideas/{subfolder}/{title} - Research.md` met frontmatter, en update `Home.md` recent ideas.

---

## Guidelines

**Flow:**

- Geen AskUserQuestion tussen research execution stappen — gewoon uitvoeren en presenteren
- Na synthese altijd naar Step 6 voor volgende actie
- Eén techniek per keer: selecteer → uitvoeren → synthetiseren → beslissen

**Flexibiliteit:**

- Gebruiker kan research focus op elk moment bijsturen
- Bij onverwachte bevindingen: bied aan om dat pad te verkennen

**Formatting:**

- NOOIT blockquote syntax (`>`) — onleesbare achtergrond in dark terminals
- NOOIT backticks voor nadruk op gewone woorden — gebruik **bold**
- Backticks alleen voor code, file paths, en command references

**Language:** Follow the Language Policy in CLAUDE.md.
