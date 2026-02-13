---
name: thinking-plan
description: Intelligent planning with research and structured markdown output. Use with /thinking-plan to create implementation plans with phases, dependencies, and estimates.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: thinking
---

# Plan

Creëert een plan van aanpak door informatie te verzamelen van user, codebase, Context7, en web search. Output is een visuele draft gevolgd door een markdown plan bestand.

## Trigger

`/thinking-plan` of `/thinking-plan [taak beschrijving]`

## Process

### FASE 1: Taak Ontvangen

**Als geen beschrijving gegeven:**
Vraag: "Wat wil je bouwen of wijzigen?"

**Als beschrijving gegeven:**
Bevestig begrip met korte samenvatting.

### FASE 2: Informatie Analyse

Gebruik sequential thinking (mcp**sequential-thinking**sequentialthinking) om te bepalen welke informatie nodig is:

```
Analyse checklist:
├─ 🧑 User: Zijn er onduidelijkheden die clarification nodig hebben?
├─ 📁 Codebase: Is er relevante bestaande code om te analyseren?
├─ 📚 Context7: Zijn er framework/library docs nodig?
└─ 🌐 Web: Is er externe informatie nodig (tutorials, examples, issues)?
```

**Output:** Lijst van benodigde research per categorie.

### FASE 3: Research Executie

**3a. User Clarification (indien nodig)**

Gebruik AskUserQuestion voor onduidelijkheden:

- Verzamel requirements
- Clarify scope
- Bepaal preferences

**3b. Parallel Research**

Spawn agents gebaseerd op FASE 2 analyse:

**Codebase research (indien nodig):**

```
Task tool met subagent_type: code-explorer
├─ Focus: similar-features
├─ Focus: architecture
└─ Focus: implementation
```

**Context7 research (indien nodig):**

```
Task tool met subagent_type:
├─ architecture-researcher
├─ best-practices-researcher
└─ testing-researcher
```

**Web research (indien nodig):**

```
Task tool met subagent_type:
├─ plan-web-patterns (best practices, modern approaches)
├─ plan-web-pitfalls (issues, constraints, anti-patterns)
├─ plan-web-examples (real-world implementations)
├─ plan-web-ecosystem (libraries, tools, packages)
└─ plan-web-architecture (system design, scalability)
```

### FASE 3.5: Quick Draft

Genereer een compact, scanbaar overzicht:

```
┌────────────────────────────────────────────────────────────┐
│ 📋 DRAFT: {Titel}                                          │
├────────────────────────────────────────────────────────────┤
│ DOEL                                                       │
│ {Eén zin beschrijving}                                     │
├────────────────────────────────────────────────────────────┤
│ STAPPEN ({N})                        RISICO   EFFORT       │
│ ─────────────────────────────────────────────────────────  │
│ 1. {Stap}                            {L/M/H}  {S/M/L}      │
│ 2. {Stap}                            {L/M/H}  {S/M/L}      │
│ ...                                                        │
├────────────────────────────────────────────────────────────┤
│ DEPENDENCIES         │ BRONNEN                             │
│ • {dep 1}            │ • {bron 1}                          │
│ • {dep 2}            │ • {bron 2}                          │
├────────────────────────────────────────────────────────────┤
│ ⚠️ RISICO'S                                                │
│ • {risico 1}                                               │
│ • {risico 2}                                               │
└────────────────────────────────────────────────────────────┘
```

**Draft kenmerken:**

- Past op één scherm
- Inline risico/effort indicators
- Alleen essentials, geen lange teksten

### FASE 4: Draft Review

Vraag user feedback met AskUserQuestion:

```yaml
header: "Draft"
question: "Akkoord met dit plan?"
options:
  - label: "Goedkeuren (Recommended)"
    description: "Maak volledig plan.md bestand"
  - label: "Analyseren"
    description: "Laat agents het plan analyseren op risico's en alternatieven"
  - label: "Aanpassen"
    description: "Wijzig specifieke onderdelen"
  - label: "Afwijzen"
    description: "Annuleer planning"
multiSelect: false
```

**Response handling:**

- "Goedkeuren" → FASE 5
- "Analyseren" → FASE 4.5 (Plan Analyse)
- "Aanpassen" → vraag wat moet wijzigen, update draft, herhaal FASE 4
- "Afwijzen" → stop, geen bestanden aanmaken

### FASE 4.5: Plan Analyse (Optioneel)

Spawn 3 analyse agents parallel:

```
Task tool met subagent_type:
├─ analyze-risk-finder      → "Wat kan er fout gaan?"
├─ analyze-alternatives-explorer → "Welke alternatieven zijn er?"
└─ analyze-simplification-advisor → "Wat kunnen we weglaten/vereenvoudigen?"
```

**Input voor agents:**

- Draft plan
- Research resultaten
- Task context

**Output format:**

```
┌────────────────────────────────────────────────────────────┐
│ 🔍 PLAN ANALYSE                                            │
├────────────────────────────────────────────────────────────┤
│ ⚠️ RISICO'S (analyze-risk-finder)                          │
│ • {risico 1}: {impact} - {mitigatie}                       │
│ • {risico 2}: {impact} - {mitigatie}                       │
├────────────────────────────────────────────────────────────┤
│ 🔄 ALTERNATIEVEN (analyze-alternatives-explorer)           │
│ • {alternatief 1}: {trade-off}                             │
│ • {alternatief 2}: {trade-off}                             │
├────────────────────────────────────────────────────────────┤
│ ✂️ VEREENVOUDIGINGEN (analyze-simplification-advisor)      │
│ • {wat kan weg}: {waarom}                                  │
│ • {wat kan later}: {waarom}                                │
└────────────────────────────────────────────────────────────┘
```

**Na analyse tonen:** Vraag opnieuw met AskUserQuestion:

```yaml
header: "Analyse"
question: "Wat wil je doen met deze feedback?"
options:
  - label: "Plan aanpassen (Recommended)"
    description: "Verwerk analyse feedback in het plan"
  - label: "Doorgaan zonder wijzigingen"
    description: "Behoud origineel plan, ga naar generatie"
  - label: "Opnieuw analyseren"
    description: "Vraag om meer specifieke analyse"
multiSelect: false
```

**Response handling:**

- "Plan aanpassen" → verwerk feedback, update draft, terug naar FASE 4
- "Doorgaan zonder wijzigingen" → FASE 5
- "Opnieuw analyseren" → vraag specifieke focus, herhaal FASE 4.5

### FASE 5: Plan Generatie

Spawn plan-synthesizer agent met:

- Alle research resultaten
- Goedgekeurde draft
- Output path: `.workspace/plans/YYYY-MM-DD-{slug}.md`

**Plan structuur:**

```markdown
# Plan: {Titel}

**Datum:** {YYYY-MM-DD}
**Status:** draft | approved | in-progress | completed

## Doel

{Wat moet bereikt worden}

## Context

{Relevante achtergrond uit research}

## Stappen

- [ ] **Stap 1:** {beschrijving}
  - Risico: {L/M/H}
  - Effort: {S/M/L}

- [ ] **Stap 2:** {beschrijving}
      ...

## Afhankelijkheden

| Package/Tool | Versie   | Doel       |
| ------------ | -------- | ---------- |
| {naam}       | {versie} | {waarvoor} |

## Risico's & Mitigatie

| Risico   | Impact  | Mitigatie |
| -------- | ------- | --------- |
| {risico} | {H/M/L} | {aanpak}  |

## Bronnen

- [{titel}]({url})
- ...

## Notities

{Eventuele extra context of overwegingen}
```

### FASE 6: Final Action

Vraag user wat te doen met AskUserQuestion:

```yaml
header: "Plan"
question: "Wat wil je met dit plan doen?"
options:
  - label: "Uitvoeren (Recommended)"
    description: "Start implementatie met /2-code"
  - label: "Opslaan naar Obsidian Project"
    description: "Sla plan op in Obsidian Projects/ folder"
  - label: "Alleen opslaan"
    description: "Plan is opgeslagen in .workspace/plans/, geen verdere actie"
multiSelect: false
```

**Response handling:**

- "Uitvoeren" → Roep /dev:build aan met plan als input
- "Opslaan naar Obsidian Project" → see below
- "Alleen opslaan" → Bevestig locatie en stop

**If "Opslaan naar Obsidian Project":**

1. List available projects: `mcp__obsidian__list_directory(path="Projects/")`
2. Use **AskUserQuestion** to let user pick a project folder (or create new)
3. Write plan to `Projects/{project}/plans/{slug}.md` via `mcp__obsidian__write_note()`
4. Add frontmatter: `type: plan, status: draft, created: {date}`
5. Confirm:

   ```
   PLAN SAVED TO OBSIDIAN

   File: Projects/{project}/plans/{slug}.md
   Status: draft

   Next steps:
   - /thinking:plan - Nog een planronde
   - /dev:build - Start implementatie
   ```

## Agents

### Bestaande (hergebruikt)

| Agent                          | Doel                              |
| ------------------------------ | --------------------------------- |
| code-explorer                  | Codebase verkenning (3 focuses)   |
| architecture-researcher        | Context7: architecture patterns   |
| best-practices-researcher      | Context7: framework conventions   |
| testing-researcher             | Context7: test strategies         |
| analyze-risk-finder            | Plan analyse: wat kan fout gaan   |
| analyze-alternatives-explorer  | Plan analyse: welke alternatieven |
| analyze-simplification-advisor | Plan analyse: wat kan weg/later   |

### Nieuw

| Agent                 | Doel                                   |
| --------------------- | -------------------------------------- |
| plan-web-patterns     | Web: best practices, modern approaches |
| plan-web-pitfalls     | Web: issues, anti-patterns, gotchas    |
| plan-web-examples     | Web: real-world implementations        |
| plan-web-ecosystem    | Web: libraries, tools, packages        |
| plan-web-architecture | Web: system design, scalability        |
| plan-synthesizer      | Combineert research → plan.md          |

## Examples

**Voorbeeld 1: Simpele feature**

```
User: /thinking-plan dark mode toggle

→ FASE 2: Codebase (theming), Context7 (React), Web (examples)
→ FASE 3: 8 agents parallel
→ FASE 3.5: Compact draft met 5 stappen
→ FASE 4: User goedkeurt
→ FASE 5: plan.md aangemaakt
→ FASE 6: User kiest "Uitvoeren"
```

**Voorbeeld 2: Complexe integratie met analyse**

```
User: /thinking-plan Stripe payment integratie

→ FASE 2: Alle categorieën nodig
→ FASE 3a: Clarification (welke features? subscriptions?)
→ FASE 3b: 11 agents parallel
→ FASE 3.5: Draft met security warnings
→ FASE 4: User kiest "Analyseren"
→ FASE 4.5: 3 analyse agents parallel
   ├─ Risk: "Webhook failures kunnen betalingen missen"
   ├─ Alternatieven: "Paddle als alternatief voor EU VAT"
   └─ Simplify: "Start zonder subscriptions, voeg later toe"
→ FASE 4: User kiest "Plan aanpassen" → draft updated
→ FASE 5: Uitgebreid plan met analyse verwerkt
→ FASE 6: User kiest "Alleen opslaan"
```

## Output Locatie

Alle plannen: `.workspace/plans/`
