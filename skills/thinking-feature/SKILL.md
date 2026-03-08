---
name: thinking-feature
description: >-
  Capture and develop new feature ideas for existing products. Combines quick
  backlog entry with optional light thinking rounds. Use with /thinking-feature
  when you have a new feature idea to add to the backlog.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 2.0.0
  category: thinking
---

# Feature

Capture new feature ideas, optionally flesh them out through 1-2 quick thinking rounds, and add them to the backlog. The bridge between "I have a feature idea" and a backlog item ready for `/dev-define`.

**Trigger**: `/thinking-feature` or `/thinking-feature [beschrijving]`

## When to Use

- User has a new feature idea for an existing product
- User wants to quickly capture a feature without full `/dev-plan`
- User wants to think through a feature idea before adding to backlog

NOT for: concept-level ideation (`/thinking-idea`), iterating on existing features (`/thinking-brainstorm`, `/thinking-critique`).

## Workflow

### FASE 0: Input + Backlog Check

1. **Beschrijving bepalen:**
   - Argument meegegeven (`/thinking-feature contactformulier toevoegen`) → gebruik als startbeschrijving
   - Geen argument (`/thinking-feature`) → AskUserQuestion:
     ```yaml
     header: "Feature"
     question: "Wat wil je toevoegen?"
     options:
       - label: "Ik typ het hieronder"
         description: "Beschrijf de feature in eigen woorden"
     multiSelect: false
     ```

2. **Backlog check:**
   - Read `.project/backlog.html`
   - **Niet gevonden** → maak aan:
     1. `mkdir -p .project`
     2. Read `{skills_path}/shared/references/backlog-template.html` → Write naar `.project/backlog.html`
     3. Vervang placeholder JSON in `<script id="backlog-data">` met minimaal data-object:
        ```json
        {
          "project": "{project directory name}",
          "generated": "{YYYY-MM-DD}",
          "updated": "{YYYY-MM-DD}",
          "source": "/thinking-feature",
          "overview": "",
          "features": [],
          "notes": ""
        }
        ```
   - **Gevonden** → parse JSON, check duplicaten:
     - Genereer kebab-case naam uit beschrijving
     - Zoek `data.features.find(f => f.name === naam)`
     - Gevonden → toon waarschuwing:

       ```
       LET OP: Feature "{naam}" bestaat al in de backlog (status: {status}).
       ```

       AskUserQuestion:

       ```yaml
       header: "Duplicaat"
       question: "Deze feature bestaat al. Wat wil je doen?"
       options:
         - label: "Toch toevoegen (Recommended)"
           description: "Voeg toe met een andere naam"
         - label: "Feature verdiepen"
           description: "Gebruik /thinking-brainstorm of /thinking-critique op de bestaande feature"
         - label: "Annuleren"
           description: "Stop, niets toevoegen"
       multiSelect: false
       ```

       - "Toch toevoegen" → suffix toevoegen (bijv. `contact-form-2`)
       - "Feature verdiepen" → suggest `/thinking-brainstorm {naam}` en stop
       - "Annuleren" → stop

### FASE 1: Uitwerken

**Vraag 1: Diepte**

```yaml
header: "Aanpak"
question: "Hoe wil je dit feature-idee uitwerken?"
options:
  - label: "Snel toevoegen (Recommended)"
    description: "Priority + type, direct naar backlog"
  - label: "Kort doordenken"
    description: "2-3 gerichte vragen om het idee aan te scherpen"
multiSelect: false
```

**If "Snel toevoegen":** ga naar FASE 1b (priority + type).

**If "Kort doordenken":** ga naar FASE 1a (thinking rounds).

### FASE 1a: Thinking Rounds (optioneel)

**Goal:** Het feature-idee aanscherpen door 2-3 gerichte vragen.

Formuleer 2-3 vragen specifiek voor DIT feature-idee. Presenteer alle vragen in één message, elk als een separate AskUserQuestion:

```yaml
# Question 1
header: "Scope"
question: "{specifieke vraag over de scope van deze feature}"
options:
  - label: "{concrete optie A} (Recommended)", description: "{wat dit betekent}"
  - label: "{concrete optie B}", description: "{wat dit betekent}"
multiSelect: false

# Question 2
header: "Doel"
question: "{specifieke vraag over het doel of de waarde}"
options:
  - label: "{concrete optie A} (Recommended)", description: "{wat dit betekent}"
  - label: "{concrete optie B}", description: "{wat dit betekent}"
multiSelect: false

# Question 3 (optional)
header: "Aanpak"
question: "{specifieke vraag over implementatie-aanpak}"
options:
  - label: "{concrete optie A} (Recommended)", description: "{wat dit betekent}"
  - label: "{concrete optie B}", description: "{wat dit betekent}"
multiSelect: false
```

**Question rules:**

- Elke vraag = specifiek voor DIT feature-idee, niet generiek
- Concrete, clickable opties
- Recommended option = meest waarschijnlijke keuze
- Maximum 3 vragen per ronde
- Focus op scope, doel, en aanpak — niet op implementatiedetails

Na de antwoorden: verwerk de inzichten in een aangescherpte beschrijving van het feature-idee.

### FASE 1b: Priority + Type

Twee vragen via AskUserQuestion:

**Vraag: Priority**

```yaml
header: "Priority"
question: "Welke prioriteit heeft deze feature?"
options:
  - label: "P1 (Recommended)"
    description: "Hoogste prioriteit"
  - label: "P2"
    description: "Belangrijk maar niet blokkerend"
  - label: "P3"
    description: "Als er tijd is"
  - label: "P4"
    description: "Parkeren voor later"
multiSelect: false
```

**Vraag: Type**

```yaml
header: "Type"
question: "Wat voor type item is dit?"
options:
  - label: "FEATURE (Recommended)"
    description: "Nieuwe functionaliteit"
  - label: "API"
    description: "Backend endpoint of service"
  - label: "UI"
    description: "Visuele component of styling"
  - label: "REFACTOR"
    description: "Code quality of architectuur verbetering"
multiSelect: false
```

### FASE 2: Schrijf naar Backlog + Thinking

1. Read `.project/backlog.html` → parse JSON uit `<script id="backlog-data" type="application/json">...</script>`

2. **Genereer naam:** kebab-case uit beschrijving (bijv. "Contactformulier met validatie" → `contact-form`)

3. **Push naar `data.features[]`:**

   ```json
   {
     "name": "{kebab-case-naam}",
     "type": "{gekozen type}",
     "status": "TODO",
     "phase": "{gekozen priority}",
     "description": "{beschrijving — aangescherpt als thinking rounds gedaan}",
     "dependency": null
   }
   ```

4. **Update metadata:** zet `data.updated` naar huidige datum (`YYYY-MM-DD`)

5. **Schrijf terug:** Edit `backlog.html` — vervang JSON tussen `<script id="backlog-data" type="application/json">` en `</script>` tags. Houd de `<script>` tags intact.

6. **Schrijf thinking output** (als FASE 1a doorlopen):
   - Maak `.project/features/{naam}/` directory aan
   - Schrijf naar `.project/features/{naam}/thinking.md`:

     ```markdown
     # {Feature Naam}

     ## Beschrijving

     {aangescherpte beschrijving}

     ## Scope

     {antwoord op scope-vraag}

     ## Doel

     {antwoord op doel-vraag}

     ## Aanpak

     {antwoord op aanpak-vraag, als gesteld}
     ```

7. **Log naar project.json thinking array:**
   - Read `.project/project.json` (of maak `{}` als niet bestaat)
   - Push naar `thinking` array (initialiseer als `[]` indien nodig):
     ```json
     {
       "type": "feature-idea",
       "date": "{today}",
       "title": "{feature naam}",
       "summary": "{beschrijving, max 200 chars}",
       "file": ".project/features/{naam}/thinking.md",
       "newFeature": "{naam}",
       "source": "/thinking-feature"
     }
     ```
   - Als geen thinking rounds gedaan (snel toevoegen), `file` weglaten
   - Write `.project/project.json`

### FASE 2b: Toewijzing (optioneel)

AskUserQuestion:

```yaml
header: "Toewijzing"
question: "Wil je dit item toewijzen?"
options:
  - label: "Nee (Recommended)"
    description: "Geen toewijzing — ik pak dit zelf"
  - label: "Teammate toewijzen"
    description: "Wijs toe aan een teammate"
multiSelect: false
```

**Nee**: ga door naar FASE 3.

**Teammate toewijzen**:

1. AskUserQuestion: "Naam van de teammate?" (vrije tekst)
2. Read `.project/backlog.html` → parse JSON
3. Zoek de zojuist toegevoegde feature → zet `assignee` op de naam
4. Write backlog terug (zelfde patroon als FASE 2 stap 5)
5. Toon task brief in terminal output:

```
TASK BRIEF — {naam}
Toegewezen aan: {teammate}

## {naam}
**Type:** {type} | **Prioriteit:** {phase}

### Beschrijving
{beschrijving}

### Volgende stap
Deze feature moet eerst gedefinieerd worden.
Bespreek met {teammate} wat de scope en requirements zijn.
```

6. Toon bericht: "Kopieer bovenstaande tekst en stuur naar {teammate}."

### FASE 3: Output

```
FEATURE TOEGEVOEGD

  {naam}                {phase} · {type}
  {beschrijving}
  Toegewezen aan: {teammate}    ← alleen tonen als assignee gezet
  Thinking: .project/features/{naam}/thinking.md    ← alleen als thinking rounds gedaan

  Backlog: .project/backlog.html
  Next steps:
  - /thinking-brainstorm {naam} - Verdiep het idee met variaties
  - /thinking-critique {naam} - Toets het idee kritisch
  - /dev-define {naam} - Begin met requirements en bouwen
```

## Restrictions

- Schrijf GEEN implementatiecode
- Wijzig GEEN bestaande features in de backlog
- Sla de priority en type vragen niet over
- Voeg maar 1 item tegelijk toe
- Thinking rounds: max 3 vragen, niet meer

### Terminal Formatting

- NEVER use blockquote syntax (`>`) for displaying content — causes unreadable white background in dark terminals
- NEVER use inline code backticks for emphasis on regular words — use **bold** or plain text
- Backticks only for actual code, file paths, and command references

### Language

Follow the Language Policy in CLAUDE.md.
