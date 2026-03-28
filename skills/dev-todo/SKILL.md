---
name: dev-todo
description: >-
  Add new backlog items (features, changes, bugs, refactors) with optional
  thinking rounds. Use with /dev-todo or /dev-todo [beschrijving] when capturing
  a new idea for the project backlog.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 3.1.0
  category: dev
---

# Todo

Capture new backlog items, optionally flesh them out through 1-2 quick thinking rounds, and add them to the backlog. The bridge between "I have an idea" and a backlog item ready for `/dev-define`.

**Trigger**: `/dev-todo` or `/dev-todo [beschrijving]`

## When to Use

- User has a new feature, change, bug fix, or improvement for an existing product
- User wants to quickly capture an item without full `/dev-plan`
- User wants to think through an idea before adding to backlog

NOT for: concept-level ideation (`/thinking-idea`), iterating on existing items (`/thinking-brainstorm`, `/thinking-critique`).

## Workflow

### FASE 0: Input + Backlog Check

1. **Beschrijving bepalen:**
   - Argument meegegeven (`/dev-todo contactformulier toevoegen`) → gebruik als startbeschrijving
   - Geen argument (`/dev-todo`) → vraag de gebruiker direct: "Wat wil je toevoegen aan de backlog?" Wacht op hun antwoord.

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
          "source": "/dev-todo",
          "overview": "",
          "features": [],
          "notes": ""
        }
        ```
   - **Gevonden** → parse JSON, check duplicaten:
     - Genereer kebab-case naam uit beschrijving
     - Zoek `data.features.find(f => f.name === naam)`
     - Gevonden → toon waarschuwing en AskUserQuestion:

       ```yaml
       header: "Duplicaat"
       question: "Item '{naam}' bestaat al (status: {status}). Wat wil je doen?"
       options:
         - label: "Toch toevoegen (Recommended)"
           description: "Voeg toe met een andere naam"
         - label: "Item verdiepen"
           description: "Gebruik /thinking-brainstorm of /thinking-critique op het bestaande item"
         - label: "Annuleren"
           description: "Stop, niets toevoegen"
       multiSelect: false
       ```

       - "Toch toevoegen" → suffix toevoegen (bijv. `contact-form-2`)
       - "Item verdiepen" → suggest `/thinking-brainstorm {naam}` en stop
       - "Annuleren" → stop

### FASE 1: Uitwerken

**Vraag: Diepte**

```yaml
header: "Aanpak"
question: "Hoe wil je dit idee uitwerken?"
options:
  - label: "Snel toevoegen (Recommended)"
    description: "Priority + type, direct naar backlog"
  - label: "Kort doordenken"
    description: "2-3 gerichte vragen om het idee aan te scherpen"
multiSelect: false
```

**"Snel toevoegen":** ga naar FASE 1b.
**"Kort doordenken":** ga naar FASE 1a.

### FASE 1a: Thinking Rounds (optioneel)

Formuleer 2-3 vragen specifiek voor DIT idee. Presenteer alle vragen in één AskUserQuestion call via het `questions` array:

- Elke vraag = specifiek voor DIT idee, niet generiek
- Concrete, clickable opties (2-4 per vraag)
- Recommended option = meest waarschijnlijke keuze
- Maximum 3 vragen
- Focus op scope, doel, en aanpak — niet op implementatiedetails

Na de antwoorden: verwerk de inzichten in een aangescherpte beschrijving van het item. Ga door naar FASE 1b.

### FASE 1b: Priority + Type

Eén AskUserQuestion call met twee vragen:

```yaml
# Vraag 1
header: "Priority"
question: "Welke prioriteit heeft dit item?"
options:
  - label: "P1 (Recommended)", description: "Hoogste prioriteit"
  - label: "P2", description: "Belangrijk maar niet blokkerend"
  - label: "P3", description: "Als er tijd is"
  - label: "P4", description: "Parkeren voor later"
multiSelect: false

# Vraag 2
header: "Type"
question: "Wat voor type item is dit?"
options:
  - label: "FEATURE (Recommended)", description: "Nieuwe functionaliteit"
  - label: "CHANGE", description: "Wijziging aan bestaande functionaliteit"
  - label: "BUG", description: "Bug fix of correctie"
  - label: "API", description: "Backend endpoint of service"
multiSelect: false
```

### FASE 2: Schrijf naar Backlog + Thinking

1. Read `.project/backlog.html` → parse JSON uit `<script id="backlog-data" type="application/json">...</script>`

2. **Genereer naam:** kebab-case uit beschrijving (bijv. "Contactformulier met validatie" → `contact-form`)

3. **Insert in `data.features[]`** — voeg het nieuwe object toe na het laatste item met `status: "DOING"` of `status: "TODO"`, of aan het begin als er geen actieve items zijn:

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

5. **Schrijf terug:** Edit het JSON-blok in `backlog.html`. Zoek een uniek anker in de bestaande features array (bijv. het eerstvolgende item na de insert-positie) en gebruik Edit om het nieuwe object ervoor te plaatsen. Houd de `<script>` tags intact.

6. **Schrijf thinking output** (alleen als FASE 1a doorlopen):
   - Maak `.project/features/{naam}/` directory aan
   - Schrijf naar `.project/features/{naam}/thinking.md`:

     ```markdown
     # {Item Naam}

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
   - Append naar `thinking` array (initialiseer als `[]` indien nodig):
     ```json
     {
       "type": "todo",
       "date": "{today}",
       "title": "{item naam}",
       "summary": "{beschrijving, max 200 chars}",
       "file": ".project/features/{naam}/thinking.md",
       "newFeature": "{naam}",
       "source": "/dev-todo"
     }
     ```
   - Als geen thinking rounds gedaan (snel toevoegen), `file` weglaten
   - Write `.project/project.json`

### FASE 3: Output

```
TODO TOEGEVOEGD

  {naam}                {phase} · {type}
  {beschrijving}
  Thinking: .project/features/{naam}/thinking.md    ← alleen als thinking rounds gedaan

  Backlog: .project/backlog.html
  Next steps:
  - /thinking-brainstorm {naam} - Verdiep het idee met variaties
  - /thinking-critique {naam} - Toets het idee kritisch
  - /dev-define {naam} - Begin met requirements en bouwen

  Tip: wijs toe aan een teammate door assignee toe te voegen in de backlog UI
```

## Restrictions

- Schrijf GEEN implementatiecode
- Wijzig GEEN bestaande items in de backlog
- Sla de priority en type vragen niet over
- Voeg maar 1 item tegelijk toe
- Thinking rounds: max 3 vragen, niet meer

### Terminal Formatting

- NEVER use blockquote syntax (`>`) for displaying content — causes unreadable white background in dark terminals
- NEVER use inline code backticks for emphasis on regular words — use **bold** or plain text
- Backticks only for actual code, file paths, and command references

### Language

Follow the Language Policy in CLAUDE.md.
