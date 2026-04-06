---
name: game-feature
description: >-
  Capture game feature ideas during playtesting or brainstorming. Combines quick
  backlog entry with optional light thinking rounds. Use with /game-feature
  when you have a new game feature idea to add to the backlog.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: game
---

# Feature

Capture new game feature ideas, optionally flesh them out through 1-2 quick thinking rounds, and add them to the backlog. The bridge between "I have a game feature idea" and a backlog item ready for `/game-define`.

**Trigger**: `/game-feature` or `/game-feature [beschrijving]`

## When to Use

- User has a new game feature idea during playtesting or brainstorming
- User wants to quickly capture a game feature without full `/game-plan`
- User wants to think through a game mechanic idea before adding to backlog

NOT for: concept-level ideation (`/thinking-concept`), iterating on existing features (`/thinking-brainstorm`, `/thinking-critique`).

## Workflow

### FASE 0: Input + Backlog Check

1. **Beschrijving bepalen:**
   - Argument meegegeven (`/game-feature dash-ability toevoegen`) -> gebruik als startbeschrijving
   - Geen argument (`/game-feature`) -> AskUserQuestion:
     ```yaml
     header: "Feature"
     question: "Wat wil je toevoegen aan het spel?"
     options:
       - label: "Ik typ het hieronder"
         description: "Beschrijf de game feature in eigen woorden"
     multiSelect: false
     ```

2. **Backlog check:**
   - Read `.project/backlog.html`
   - **Niet gevonden** -> maak aan:
     1. `mkdir -p .project`
     2. Read `{skills_path}/shared/references/backlog-template.html` -> Write naar `.project/backlog.html`
     3. Vervang placeholder JSON in `<script id="backlog-data">` met minimaal data-object:
        ```json
        {
          "project": "{project directory name}",
          "generated": "{YYYY-MM-DD}",
          "updated": "{YYYY-MM-DD}",
          "source": "/game-feature",
          "overview": "",
          "features": [],
          "notes": ""
        }
        ```
   - **Gevonden** -> parse JSON, check duplicaten:
     - Genereer kebab-case naam uit beschrijving
     - Zoek `data.features.find(f => f.name === naam)`
     - Gevonden -> toon waarschuwing:

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

       - "Toch toevoegen" -> suffix toevoegen (bijv. `dash-ability-2`)
       - "Feature verdiepen" -> suggest `/thinking-brainstorm {naam}` en stop
       - "Annuleren" -> stop

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

Formuleer 2-3 vragen specifiek voor DIT game feature-idee. Presenteer alle vragen in een message, elk als een separate AskUserQuestion:

```yaml
# Question 1
header: "Gameplay"
question: "{specifieke vraag over hoe deze mechanic voelt/werkt voor de speler}"
options:
  - label: "{concrete optie A} (Recommended)", description: "{wat dit betekent}"
  - label: "{concrete optie B}", description: "{wat dit betekent}"
multiSelect: false

# Question 2
header: "Balancing"
question: "{specifieke vraag over balancing, tuning, of interactie met bestaande mechanics}"
options:
  - label: "{concrete optie A} (Recommended)", description: "{wat dit betekent}"
  - label: "{concrete optie B}", description: "{wat dit betekent}"
multiSelect: false

# Question 3 (optional)
header: "Technisch"
question: "{specifieke vraag over technische aanpak of Godot-specifieke keuzes}"
options:
  - label: "{concrete optie A} (Recommended)", description: "{wat dit betekent}"
  - label: "{concrete optie B}", description: "{wat dit betekent}"
multiSelect: false
```

**Question rules:**

- Elke vraag = specifiek voor DIT game feature-idee, niet generiek
- Concrete, clickable opties
- Recommended option = meest waarschijnlijke keuze
- Maximum 3 vragen per ronde
- Focus op gameplay feel, balancing, en technische aanpak

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
  - label: "MECHANIC (Recommended)"
    description: "Nieuwe gameplay mechanic (ability, movement, combat)"
  - label: "SYSTEM"
    description: "Ondersteunend systeem (spawning, scoring, saving)"
  - label: "CONTENT"
    description: "Levels, vijanden, items, dialoog"
  - label: "POLISH"
    description: "Juice, particles, screen shake, geluid"
  - label: "UI"
    description: "HUD, menu's, feedback indicators"
multiSelect: false
```

### FASE 2: Schrijf naar Backlog + Thinking

1. Read `.project/backlog.html` -> parse JSON uit `<script id="backlog-data" type="application/json">...</script>`

2. **Genereer naam:** kebab-case uit beschrijving (bijv. "Dash ability met cooldown" -> `dash-ability`)

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

     ## Gameplay

     {antwoord op gameplay-vraag}

     ## Balancing

     {antwoord op balancing-vraag}

     ## Technisch

     {antwoord op technische vraag, als gesteld}
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
       "source": "/game-feature"
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
2. Read `.project/backlog.html` -> parse JSON
3. Zoek de zojuist toegevoegde feature -> zet `assignee` op de naam
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
  Toegewezen aan: {teammate}    <- alleen tonen als assignee gezet
  Thinking: .project/features/{naam}/thinking.md    <- alleen als thinking rounds gedaan

  Backlog: .project/backlog.html
  Next steps:
  - /thinking-brainstorm {naam} - Verdiep het idee met variaties
  - /thinking-critique {naam} - Toets het idee kritisch
  - /game-define {naam} - Begin met requirements en architectuur
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
