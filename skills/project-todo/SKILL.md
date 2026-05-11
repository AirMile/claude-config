---
name: project-todo
description: >-
  Add new backlog items (features, changes, bugs, refactors, pages, components,
  scenes, scripts, a11y, performance) — single or smart-split multi-item for
  cross-domain descriptions. Auto-detects stack (web/game) and initialises
  project.json if missing. Use with /project-todo or /project-todo [beschrijving]
  when capturing a new idea for the project backlog.
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: project
---

# Todo

Capture new backlog items, optionally flesh them out through 1-2 quick thinking rounds, and add them to the backlog. The bridge between "I have an idea" and a backlog item ready for `/dev-define` (web) or `/game-define` (game).

**Trigger**: `/project-todo` or `/project-todo [beschrijving]`

## When to Use

- User has a new feature, change, bug fix, improvement, mechanic, or content idea for an existing project
- User wants to quickly capture an item without full `/project-plan`
- User wants to think through an idea before adding to backlog

NOT for: concept-level ideation (`/thinking-concept`), iterating on existing items (`/thinking-brainstorm`, `/thinking-critique`).

## Workflow

### Pre-FASE 0: Project Onboarding

Check of `.project/project.json` bestaat.

- **Bestaat** → ga direct door naar Stack Detection.
- **Bestaat niet** → AskUserQuestion:

  ```yaml
  header: "Project setup"
  question: "Geen .project/project.json gevonden. Hoe wil je verder?"
  options:
    - label: "Run /core-setup eerst (Recommended)"
      description: "Stop hier — voer /core-setup uit voor volledige projectinitialisatie"
    - label: "Snel scaffold + item toevoegen"
      description: "Maak minimale project.json aan en ga door"
    - label: "Annuleren"
  multiSelect: false
  ```

  - **"Run /core-setup eerst"** → output `Voer /core-setup uit om het project te initialiseren.`, stop.
  - **"Snel scaffold"** → vraag eerst het project type via AskUserQuestion:

    ```yaml
    header: "Project type"
    question: "Wat voor project is dit?"
    options:
      - label: "Web (Recommended)"
        description: "Web/CLI/library — backend + frontend"
      - label: "Game (Godot)"
        description: "Godot game project met GDScript"
    multiSelect: false
    ```

    Schrijf daarna twee bestanden en ga door:
    1. `.project/project.json` (minimal):

       ```json
       {
         "name": "{directory naam van het project}",
         "created": "{YYYY-MM-DD}",
         "stack": {},
         "features": []
       }
       ```

       - "Web" → `"stack": {}`
       - "Game (Godot)" → `"stack": { "engine": "godot" }`

    2. `.project/session/setup-pending.json` (zodat `/core-setup` later de rest afmaakt):
       ```json
       {
         "source": "/project-todo",
         "mode": "greenfield",
         "createdAt": "{YYYY-MM-DD}"
       }
       ```

    Toon: `PROJECT.JSON AANGEMAAKT — run /core-setup later voor volledige setup.`

  - **"Annuleren"** → stop.

### Stack Detection (pre-FASE 0)

1. Probeer `.project/project.json` te lezen
2. Check velden:
   - `stack.engine === "godot"` OF `concept.platform === "game"` → **GAME MODE**
   - Geen match of geen project.json → **WEB MODE**
3. Toon gedetecteerde mode:
   ```
   STACK: web    (→ /dev-define pipeline)
   STACK: game   (→ /game-define pipeline)
   ```

### FASE 0: Input + Backlog Check

1. **Beschrijving bepalen:**
   - Argument meegegeven (`/project-todo dash-ability toevoegen`) → gebruik als startbeschrijving
   - Geen argument (`/project-todo`) → vraag de gebruiker direct: "Wat wil je toevoegen aan de backlog?" Wacht op hun antwoord.

2. **Multi-item detectie:**

   **[GAME MODE]:** sla deze stap over. Multi-item split is een dev/frontend concept en past niet bij game-types (MECHANIC/SYSTEM/CONTENT/POLISH/UI). Voeg game-items één voor één toe.

   **[WEB MODE]:** analyseer de beschrijving op cross-domain signalen:
   - Bevat connectors: "inclusief", "met bijbehorende", "en de pagina", "en de UI", "plus frontend", "met frontend"
   - Beschrijft expliciet zowel backend/logica/API áls UI/pagina/component

   **Als multi-domain gedetecteerd → AskUserQuestion:**

   ```yaml
   header: "Meerdere items"
   question: "Dit lijkt meerdere domeinen te beslaan. Wil je splitsen?"
   options:
     - label: "Ja, splits op (Recommended)"
       description: "Maak aparte items (bv. FEATURE + PAGE), gelinkt via dependencies"
     - label: "Nee, één item"
       description: "Voeg alles samen als één backlog item"
   multiSelect: false
   ```

   **Bij "Ja":**
   - Genereer een voorstel: 2-3 sub-items met `{ naam (kebab), type-hint, korte beschrijving }`. Gebruik je kennis van dev/frontend splitsing:
     - Logica/API/data → FEATURE (Dev swimlane)
     - Pagina/route → PAGE (Frontend swimlane)
     - Herbruikbaar UI-stuk → COMPONENT (Frontend swimlane)
   - Toon als plain-text tabel, vraag bevestiging (plain text, geen modal): "Klopt deze splitsing? Typ j om door te gaan, of pas de namen/types aan."
   - Stel interne queue in: `items = [{naam, beschrijving, type-hint}, ...]` (max 3)
   - Doorloop FASE 1b/1c/1d en FASE 2 sequentieel voor elk item
   - Link via `dependencies[]`: frontend-children krijgen `dependencies: ["dev-item-naam"]`

   **Bij "Nee" of geen detectie:** `items = [enkelvoudig item]`, verwerk normaal.

3. **Backlog check:**
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
          "source": "/project-todo",
          "overview": "",
          "features": [],
          "notes": ""
        }
        ```
   - **Gevonden** → parse JSON, check duplicaten:

     **Single-item:**
     - Genereer kebab-case naam uit beschrijving
     - Zoek `data.features.find(f => f.name === naam)`
     - Gevonden → AskUserQuestion:

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

       - "Toch toevoegen" → suffix toevoegen (bijv. `dash-ability-2`)
       - "Item verdiepen" → suggest `/thinking-brainstorm {naam}` en stop
       - "Annuleren" → stop

     **Multi-item (items.length > 1):**
     - Loop over alle queue-items en genereer kebab-case namen
     - Check per item: `data.features.find(f => f.name === naam)` EN botsing met andere queue-namen
     - Conflict → voeg stille suffix toe (`-2`, `-3`) zonder modal
     - Toon na de loop alle definitieve namen als plain-text bevestiging vóór je verdergaat:
       `"Items worden toegevoegd als: {naam-1}, {naam-2}. Typ j om door te gaan."`

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
- **[WEB MODE]** Focus op scope, doel, en aanpak — niet op implementatiedetails
- **[GAME MODE]** Focus op gameplay feel, balancing, en technische aanpak (Godot-specifiek)

**[GAME MODE]** Gebruik deze question-headers als richtlijn:

```yaml
# Question 1
header: "Gameplay"
question: "{specifieke vraag over hoe deze mechanic voelt/werkt voor de speler}"

# Question 2
header: "Balancing"
question: "{specifieke vraag over balancing, tuning, of interactie met bestaande mechanics}"

# Question 3 (optional)
header: "Technisch"
question: "{specifieke vraag over technische aanpak of Godot-specifieke keuzes}"
```

Na de antwoorden: verwerk de inzichten in een aangescherpte beschrijving van het item. Ga door naar FASE 1b.

### FASE 1b: Priority + Category/Type

**Multi-item modus** (items.length > 1): gebruik de batch-flow hieronder. Single-item: sla batch-flow over en gebruik de WEB/GAME MODE blokken direct.

**Batch-flow:** één AskUserQuestion call met N+1 vragen:

```yaml
# Vraag 1 — Priority (geldt voor álle items in batch)
header: "Priority"
question: "Welke prioriteit heeft deze batch items?"
options:
  - label: "P1 (Recommended)", description: "Hoogste prioriteit"
  - label: "P2", description: "Belangrijk maar niet blokkerend"
  - label: "P3", description: "Als er tijd is"
  - label: "P4", description: "Parkeren voor later"
multiSelect: false

# Vraag 2..N+1 — Type per item (één vraag per queue-item, header = kebab-naam)
# Opties = dezelfde set als de single-item flow (zie WEB/GAME MODE hieronder),
# gebaseerd op type-hint uit FASE 0 multi-split.
```

Als je per item een andere priority wilt: kies "Nee, één item" in FASE 0 en run `/project-todo` meerdere keren.

**[WEB MODE]** Single-item — eén AskUserQuestion call met twee vragen:

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
header: "Categorie"
question: "Welke categorie past het beste?"
options:
  - label: "Dev (Recommended)", description: "Backend, API, logica, data, bugs, refactor"
  - label: "Frontend", description: "Pagina's en componenten"
  - label: "Design & Quality", description: "Tokens, accessibility, performance, ontbrekende pagina-functionaliteit"
multiSelect: false
```

**[GAME MODE]** Single-item — twee losse AskUserQuestion calls:

```yaml
# Vraag 1: Priority
header: "Priority"
question: "Welke prioriteit heeft deze feature?"
options:
  - label: "P1 (Recommended)", description: "Hoogste prioriteit"
  - label: "P2", description: "Belangrijk maar niet blokkerend"
  - label: "P3", description: "Als er tijd is"
  - label: "P4", description: "Parkeren voor later"
multiSelect: false

# Vraag 2: Type
header: "Type"
question: "Wat voor type item is dit?"
options:
  - label: "MECHANIC (Recommended)", description: "Nieuwe gameplay mechanic (ability, movement, combat)"
  - label: "SYSTEM", description: "Ondersteunend systeem (spawning, scoring, saving)"
  - label: "CONTENT", description: "Levels, vijanden, items, dialoog"
  - label: "POLISH", description: "Juice, particles, screen shake, geluid"
  - label: "UI", description: "HUD, menu's, feedback indicators"
multiSelect: false
```

### FASE 1c: Type (alleen WEB MODE)

Eén AskUserQuestion call (1 vraag). Opties afhankelijk van gekozen categorie:

**If Dev:**

```yaml
header: "Type"
question: "Wat voor type item is dit?"
options:
  - label: "FEATURE (Recommended)", description: "Nieuwe functionaliteit"
  - label: "CHANGE", description: "Wijziging aan bestaande functionaliteit"
  - label: "BUG", description: "Bug fix of correctie"
  - label: "API", description: "Backend endpoint of service"
multiSelect: false
```

**If Frontend:**

```yaml
header: "Type"
question: "Welke frontend entity?"
options:
  - label: "PAGE (Recommended)", description: "Nieuwe pagina/route — landt op Frontend track ('To design')"
  - label: "COMPONENT", description: "Herbruikbaar UI-component — landt op Frontend track"
  - label: "PAGE-GAP", description: "Ontbrekende functionaliteit op bestaande pagina — landt op Dev track"
multiSelect: false
```

Alle drie types vallen door naar **FASE 1d → FASE 2 Backlog write**. PAGE en COMPONENT landen op de Frontend swimlane ("To design"); PAGE-GAP op de Dev swimlane ("To define").

**If Design & Quality:**

```yaml
header: "Type"
question: "Wat voor type design/quality item is dit?"
options:
  - label: "THEME (Recommended)", description: "Design tokens — kleuren, typografie, spacing via /frontend-tokens"
  - label: "A11Y", description: "Accessibility verbetering via /frontend-check --scope=a11y"
  - label: "PERF", description: "Performance of SEO optimalisatie via /frontend-check"
multiSelect: false
```

### FASE 1d: Dependencies

**Multi-item:** sla deze vraag over — dependencies zijn al bepaald in FASE 0 stap 2 (frontend-children krijgen automatisch `dependencies: ["dev-item-naam"]`).

```yaml
header: "Dependencies"
question: "Zijn er features die eerst af moeten zijn?"
options:
  - label: "Nee (Recommended)"
    description: "Geen afhankelijkheden"
  - label: "Ja, ik noem ze"
    description: "Geef de namen op als komma-gescheiden lijst"
multiSelect: false
```

**"Nee"** → `dependencies: []`

**"Ja"** → AskUserQuestion (vrije tekst): "Welke features? (komma-gescheiden)" → parse naar array → `dependencies: ["naam1", "naam2"]`

### FASE 2: Schrijf naar Backlog + Thinking

**Loop:** alle onderstaande stappen draaien per item in de queue (FASE 0 stap 2). Bij single-item is `items = [enkelvoudig item]`. Bij multi-item loopt de skill stappen 1-7 sequentieel per item, waarbij `dependencies[]` verwijst naar eerder verwerkte items in de batch.

1. Read `.project/backlog.html` → parse JSON uit `<script id="backlog-data" type="application/json">...</script>`

2. **Genereer naam:** kebab-case uit beschrijving (bijv. "Dash ability met cooldown" → `dash-ability`)

3. **Insert in `data.features[]`** — voeg het nieuwe object toe na het laatste item met `status: "DOING"` of `status: "TODO"`, of aan het begin als er geen actieve items zijn:

   ```json
   {
     "name": "{kebab-case-naam}",
     "type": "{gekozen type}",
     "status": "TODO",
     "phase": "{gekozen priority}",
     "description": "{beschrijving — aangescherpt als thinking rounds gedaan}",
     "source": "/project-todo",
     "dependencies": []
   }
   ```

   Het `source: "/project-todo"` veld signaleert aan `/project-plan` dat deze feature handmatig is toegevoegd (INDEPENDENT) en nooit overschreven mag worden bij backlog-rebuild.

4. **Update metadata:** zet `data.updated` naar huidige datum (`YYYY-MM-DD`)

5. **Schrijf terug:** Edit het JSON-blok in `backlog.html`. Zoek een uniek anker in de bestaande features array en gebruik Edit om het nieuwe object ervoor te plaatsen. Houd de `<script>` tags intact.

6. **Schrijf thinking output** (alleen als FASE 1a doorlopen):

   Pad: `.project/thinking/feature-idea-{naam}.md` — `mkdir -p .project/thinking`
   - **[WEB MODE]:**

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

   - **[GAME MODE]:**

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

   Geen mutatie aan `project.json` voor thinking — output staat in losse md-files conform DASHBOARD.md.

7. **Sync naar `project.json.features[]`** (concept sync):
   - Read `.project/project.json` (al gelezen in Pre-FASE 0)
   - Initialize `features = []` indien missing
   - Check duplicate op `name` — als gevonden én status > TODO: MERGE (update `summary`, behoud status). Anders push:
     ```json
     {
       "name": "{kebab-naam}",
       "type": "{type}",
       "status": "TODO",
       "phase": "{P1-P4}",
       "summary": "{beschrijving, max 200 chars}",
       "dependencies": [],
       "source": "/project-todo",
       "created": "{YYYY-MM-DD}"
     }
     ```
   - Write `.project/project.json`

   Schrijf NIET naar `concept.content` of `project-concept.md` — dat is eigendom van `/thinking-concept`.

### FASE 3: Output

**[MULTI-ITEM — wanneer items queue > 1]:**

```
TODOS TOEGEVOEGD ({n} items)

  1. {naam-1}    {phase} · {type}
     {beschrijving-1}

  2. {naam-2}    {phase} · {type}     ← depends on: {naam-1}
     {beschrijving-2}

  Backlog: .project/backlog.html
  Next steps:
  [Per item, passende next step uit de WEB/GAME MODE output hieronder]
```

**[WEB MODE — single item]:**

```
TODO TOEGEVOEGD

  {naam}                {phase} · {type}
  {beschrijving}
  Thinking: .project/thinking/feature-idea-{naam}.md    ← alleen als thinking rounds gedaan

  Backlog: .project/backlog.html
  Next steps:
  - /thinking-brainstorm {naam} - Verdiep het idee met variaties
  - /thinking-critique {naam} - Toets het idee kritisch
  [If type is FEATURE, CHANGE, BUG, or API:]
  - /dev-define {naam} - Begin met requirements en bouwen
  - /team-outsource {naam} - Outsource naar een teammate via GitHub/Jira/Linear
  [If type is PAGE or COMPONENT:]
  - /frontend-design {naam} - Bouw de pagina/component
  - /frontend-design - Definieer meerdere pagina's tegelijk
  [If type is THEME:]
  - /frontend-tokens - Stel design tokens in (kleur, typografie, spacing)
  [If type is A11Y:]
  - /frontend-check --scope=a11y {naam} - Voer accessibility audit uit
  [If type is PERF:]
  - /frontend-check {naam} - Voer performance en SEO audit uit
  [If type is PAGE-GAP:]
  - /dev-define {naam} - Definieer de ontbrekende functionaliteit
```

**[GAME MODE]:**

```
FEATURE TOEGEVOEGD

  {naam}                {phase} · {type}
  {beschrijving}
  Thinking: .project/thinking/feature-idea-{naam}.md    ← alleen als thinking rounds gedaan

  Backlog: .project/backlog.html
  Next steps:
  - /thinking-brainstorm {naam} - Verdiep het idee met variaties
  - /thinking-critique {naam} - Toets het idee kritisch
  - /game-define {naam} - Begin met requirements en architectuur
```

## Restrictions

- Schrijf GEEN implementatiecode
- Wijzig GEEN bestaande items in de backlog
- Sla de priority en type vragen niet over
- Max 3 items per batch bij smart split
- Thinking rounds: max 3 vragen, niet meer
- Schrijf NIET naar `project-concept.md` of `concept.content` — alleen `/thinking-concept` mag dat

### Terminal Formatting

- NEVER use blockquote syntax (`>`) for displaying content — causes unreadable white background in dark terminals
- NEVER use inline code backticks for emphasis on regular words — use **bold** or plain text
- Backticks only for actual code, file paths, and command references

### Language

Follow the Language Policy in CLAUDE.md.
