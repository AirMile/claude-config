---
description: Create or develop characters through interview-style dialogue
---

# Character

Create, extend, or view characters for the active story. Uses an interview approach to discover character depth.

## Prerequisites

Check for active story by reading `.workspace/active-story.json`. If no active story:
```
⚠️ Geen actief verhaal. Gebruik /story:select eerst.
```

## Character Detection

Scan `stories/{active}/characters/` for existing character files.

### If characters exist:

Read each character's `_meta.md` frontmatter to get their role.

**Sort characters by role priority:**
1. Protagonist (🎭)
2. Antagonist (👿)
3. Supporting (👥)

Show top characters (by priority) and ask:

Use **AskUserQuestion**:
- header: "Personages"
- question: "Er zijn {count} personages. Wat wil je doen?"
- options:
  - label: "Nieuw personage maken", description: "Interview om nieuw personage te ontdekken"
  - label: "🎭 {protagonist1}", description: "Hoofdpersonage - bekijk of bewerk"
  - label: "🎭 {protagonist2}", description: "Hoofdpersonage - bekijk of bewerk"
  - label: "Alle personages bekijken", description: "Toon overzicht van alle personages"
- multiSelect: false

Note: Show up to 3 characters as direct options, prioritized by role (protagonists first). If more than 3 characters exist, show "Alle personages bekijken" to access the rest.

**If existing character selected** → go to Character Actions
**If "Nieuw personage maken"** → go to Mode: Nieuw Personage
**If "Alle personages bekijken"** → go to Mode: Bekijken

### If no characters exist:

```
📭 Nog geen personages in dit verhaal.
```

Go directly to Mode: Nieuw Personage.

---

## Character Actions

When an existing character is selected, show actions:

Use **AskUserQuestion**:
- header: "{character name}"
- question: "Wat wil je doen met {name}?"
- options:
  - label: "Bekijken", description: "Toon alle details van dit personage"
  - label: "Uitbreiden", description: "Voeg trait/backstory toe"
  - label: "Relatie toevoegen", description: "Koppel relatie met ander personage"
  - label: "Quick edit", description: "Bewerk een specifieke sectie"
- multiSelect: false

---

## Mode: Nieuw Personage

### Step 1: Name & Role

Use **AskUserQuestion**:
- header: "Basis"
- question: "Hoe heet dit personage en wat is hun rol?"
- options:
  - label: "Protagonist", description: "Hoofdpersonage van het verhaal"
  - label: "Antagonist", description: "Tegenstander of obstakel"
  - label: "Supporting", description: "Ondersteunend personage"
- multiSelect: false

Ask for name as text input.

### Step 2: Interview

Ask these questions one at a time, building on previous answers:

1. **Uiterlijk**: "Hoe ziet {naam} eruit in jouw hoofd? Beschrijf wat je ziet."

2. **Verlangen**: "Wat wil {naam} meer dan wat dan ook? Wat drijft hen?"

3. **Obstakel**: "Wat staat in de weg van dit verlangen? Wat houdt hen tegen?"

4. **Geheim**: "Wat is een geheim dat niemand weet over {naam}?"

5. **Gedrag**: "Hoe praat en beweegt {naam}? Welke tics of gewoontes hebben ze?"

### Step 3: Generate Character File

Read `templates/character.md` as base structure.

Create `stories/{active}/characters/{naam}.md`:

```markdown
---
name: "{naam}"
role: {role}
introduced_in: ""
---

## Uiterlijk
{answer 1}

## Persoonlijkheid
{derived from answers}

## Wil & Obstakel
**Wil:** {answer 2}
**Obstakel:** {answer 3}

## Geheim
{answer 4}

## Spraak & Gedrag
{answer 5}

## Relaties

## Notities
```

Confirm:
```
✅ {naam} aangemaakt in characters/

📖 Samenvatting:
- Rol: {role}
- Wil: {short summary}
- Obstakel: {short summary}
```

---

## Mode: Uitbreiden

### Step 1: Select Character

Scan `stories/{active}/characters/` for existing characters.

Use **AskUserQuestion**:
- header: "Personage"
- question: "Welk personage wil je uitbreiden?"
- options: [list of existing characters]
- multiSelect: false

### Step 2: Select Aspect

Use **AskUserQuestion**:
- header: "Aspect"
- question: "Wat wil je toevoegen?"
- options:
  - label: "Backstory", description: "Verleden en geschiedenis"
  - label: "Trait", description: "Persoonlijkheidskenmerk"
  - label: "Motivatie", description: "Diepere drijfveren"
  - label: "Conflict", description: "Interne strijd"
- multiSelect: false

### Step 3: Interview & Update

Ask relevant follow-up questions based on aspect chosen.
Update the character file with new information in appropriate section.

---

## Mode: Relatie Toevoegen

### Step 1: Select Characters

Scan `stories/{active}/characters/` for existing characters.

Use **AskUserQuestion** twice:
1. "Welk personage is de bron van de relatie?"
2. "Met welk personage heeft {source} een relatie?"

### Step 2: Define Relationship

Ask: "Beschrijf de relatie tussen {source} en {target}. Wat is de dynamiek?"

Use **AskUserQuestion**:
- header: "Type"
- question: "Wat voor soort relatie is dit?"
- options:
  - label: "Familie", description: "Bloedverwant of aangetrouwd"
  - label: "Romantisch", description: "Liefde of aantrekking"
  - label: "Vriendschap", description: "Vertrouwen en kameraadschap"
  - label: "Rivaliteit", description: "Competitie of vijandschap"
  - label: "Mentor/Leerling", description: "Leiding en groei"
- multiSelect: false

### Step 3: Update Both Files

Add relationship to both character files in their Relaties section:

```markdown
## Relaties
- **{other name}** ({type}): {description}
```

---

## Mode: Bekijken

### Step 1: Select or Show All

Scan `stories/{active}/characters/` for existing characters.

Use **AskUserQuestion**:
- header: "Bekijken"
- question: "Wat wil je zien?"
- options:
  - label: "Alle personages", description: "Overzicht van alle personages"
  - label: "Specifiek personage", description: "Details van één personage"
- multiSelect: false

### Step 2: Display

**Alle personages:**
```
📚 Personages in "{story title}"

🎭 Protagonisten:
- {name}: {short description from Persoonlijkheid}

👿 Antagonisten:
- {name}: {short description}

👥 Supporting:
- {name}: {short description}
```

**Specifiek personage:**
Display full character file content formatted nicely.

---

## Mode: Quick Add

For minor characters that don't need full interview.

### Step 1: Quick Input

Ask: "Beschrijf het bijpersonage in één zin: naam, rol in scene, en één opvallend kenmerk."

Example: "Maria, de barista, altijd humeurig in de ochtend"

### Step 2: Generate Minimal File

Create `stories/{active}/characters/{naam}.md`:

```markdown
---
name: "{naam}"
role: supporting
introduced_in: ""
---

## Uiterlijk

## Persoonlijkheid
{extracted trait}

## Wil & Obstakel

## Geheim

## Spraak & Gedrag

## Relaties

## Notities
{original description}
```

Confirm:
```
✅ {naam} (quick) toegevoegd aan characters/
```

---

## Mode: Quick Edit

For quickly editing a specific section of an existing character.

### Step 1: Select Section

Use **AskUserQuestion**:
- header: "Sectie"
- question: "Welke sectie van {name} wil je bewerken?"
- options:
  - label: "Uiterlijk", description: "Fysieke beschrijving"
  - label: "Persoonlijkheid", description: "Karakter en gedrag"
  - label: "Wil & Obstakel", description: "Motivatie en conflict"
  - label: "Geheim", description: "Verborgen informatie"
  - label: "Spraak & Gedrag", description: "Hoe ze praten en bewegen"
  - label: "Notities", description: "Vrije notities"
- multiSelect: false

### Step 2: Show Current & Edit

Display current content of selected section:
```
📝 Huidige {section}:

{current content or "(leeg)"}
```

Ask: "Wat moet de nieuwe inhoud zijn? (of typ '+' om toe te voegen aan bestaande tekst)"

### Step 3: Update File

Update the specific section in the character file.

Confirm:
```
✅ {section} bijgewerkt voor {name}
```
