---
name: dev-todo
description: Quickly add a single feature to the backlog without full planning. Use with /dev-todo to add a TODO item for later definition with /dev-define.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: dev
---

# Dev Todo

Voeg snel 1 feature toe aan de backlog zonder het volledige `/dev-plan` proces. Vult de gap tussen een los idee en een volledig uitgewerkt plan.

**Trigger**: `/dev-todo` of `/dev-todo [beschrijving]`

## Workflow

### FASE 0: Input + Backlog Check

1. **Beschrijving bepalen:**
   - Argument meegegeven (`/dev-todo contactformulier toevoegen`) → gebruik als startbeschrijving
   - Geen argument (`/dev-todo`) → AskUserQuestion:
     ```yaml
     header: "Feature"
     question: "Wat wil je toevoegen aan de backlog?"
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
          "source": "/dev-todo",
          "overview": "",
          "features": [],
          "notes": ""
        }
        ```
   - **Gevonden** → ga door naar FASE 1

### FASE 1: Uitwerken

Twee vragen via AskUserQuestion:

**Vraag 1: Priority**

```yaml
header: "Priority"
question: "Welke prioriteit heeft deze feature?"
options:
  - label: "P1 · Must (Recommended)"
    description: "Must-have voor launch"
  - label: "P2 · Should"
    description: "Belangrijk maar niet blokkerend"
  - label: "P3 · Could"
    description: "Als er tijd is"
  - label: "P4 · Maybe"
    description: "Parkeren voor later"
multiSelect: false
```

**Vraag 2: Type**

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

### FASE 2: Schrijf naar Backlog

1. Read `.project/backlog.html` → parse JSON uit `<script id="backlog-data" type="application/json">...</script>`

2. **Genereer naam:** kebab-case uit beschrijving (bijv. "Contactformulier met validatie" → `contact-form`)

3. **Duplicaat check:** zoek `data.features.find(f => f.name === naam)`
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
       - label: "Annuleren"
         description: "Stop, niets toevoegen"
     multiSelect: false
     ```

     - "Toch toevoegen" → suffix toevoegen (bijv. `contact-form-2`)
     - "Annuleren" → stop

4. **Push naar `data.features[]`:**

   ```json
   {
     "name": "{kebab-case-naam}",
     "type": "{gekozen type}",
     "status": "TODO",
     "phase": "{gekozen priority}",
     "description": "{beschrijving}",
     "dependency": null
   }
   ```

5. **Update metadata:** zet `data.updated` naar huidige datum (`YYYY-MM-DD`)

6. **Schrijf terug:** Edit `backlog.html` — vervang JSON tussen `<script id="backlog-data" type="application/json">` en `</script>` tags. Houd de `<script>` tags intact.

### FASE 3: Output

```
TODO TOEGEVOEGD

  {naam}                {phase} · {type}
  {beschrijving}

  Backlog: .project/backlog.html
  Volgende stap: /dev-define {naam}
```

## Restrictions

- Schrijf GEEN implementatiecode
- Wijzig GEEN bestaande features in de backlog
- Sla de priority en type vragen niet over
- Voeg maar 1 item tegelijk toe
