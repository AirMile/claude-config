---
description: Add or develop worldbuilding elements through interview-style dialogue
---

# World

Create, extend, or view worldbuilding elements for the active story. Uses an interview approach to discover depth and consistency.

## Prerequisites

Check for active story by reading `.workspace/active-story.json`. If no active story:
```
⚠️ Geen actief verhaal. Gebruik /story:select eerst.
```

## Element Detection

Scan `stories/{active}/world/` for existing world element files.

### If elements exist:

Read each element's frontmatter to get their type.

**Group elements by type:**
- 📍 Location
- ✨ Magic
- 🏛️ Culture
- ⚙️ Technology
- 🐉 Creature
- 📝 Other

Show top elements (by type diversity) and ask:

Use **AskUserQuestion**:
- header: "Worldbuilding"
- question: "Er zijn {count} elementen. Wat wil je doen?"
- options:
  - label: "Nieuw element maken", description: "Interview om nieuw worldbuilding element te ontdekken"
  - label: "📍 {location1}", description: "Locatie - bekijk of bewerk"
  - label: "✨ {magic1}", description: "Magie - bekijk of bewerk"
  - label: "Alle elementen bekijken", description: "Toon overzicht per categorie"
  - label: "Quick add", description: "Snel minor element toevoegen"
  - label: "💡 Inspiratie", description: "Claude suggereert worldbuilding ideeën"
- multiSelect: false

Note: Show up to 3 elements as direct options, one from each most-used type. If more exist, show "Alle elementen bekijken" to access the rest.

**If existing element selected** → go to Element Actions
**If "Nieuw element maken"** → go to Mode: Nieuw Element
**If "Alle elementen bekijken"** → go to Mode: Bekijken
**If "Quick add"** → go to Mode: Quick Add
**If "Inspiratie"** → go to Mode: Inspiratie

### If no elements exist:

```
📭 Nog geen worldbuilding in dit verhaal.
```

Go directly to Mode: Nieuw Element.

---

## Element Actions

When an existing element is selected, show actions:

Use **AskUserQuestion**:
- header: "{element name}"
- question: "Wat wil je doen met {name}?"
- options:
  - label: "Bekijken", description: "Toon alle details van dit element"
  - label: "Uitbreiden", description: "Voeg detail of regels toe"
  - label: "Koppelen", description: "Verbind met ander element of personage"
  - label: "Quick edit", description: "Bewerk een specifieke sectie"
- multiSelect: false

---

## Mode: Nieuw Element

### Step 1: Type Selection

Use **AskUserQuestion**:
- header: "Type"
- question: "Wat voor soort element wil je maken?"
- options:
  - label: "📍 Locatie", description: "Plek, gebied, gebouw"
  - label: "✨ Magie", description: "Magiesysteem, krachten, regels"
  - label: "🏛️ Cultuur", description: "Samenleving, tradities, religie"
  - label: "⚙️ Technologie", description: "Uitvindingen, wetenschap"
  - label: "🐉 Wezen", description: "Creatures, rassen, monsters"
  - label: "📝 Anders", description: "Overig worldbuilding"
- multiSelect: false

Ask for element name as text input.

### Step 1.5: Scale (Location only)

If type is Location, ask:

Use **AskUserQuestion**:
- header: "Schaal"
- question: "Hoe groot is {naam}?"
- options:
  - label: "Kamer/Ruimte", description: "Eén specifieke ruimte"
  - label: "Gebouw", description: "Huis, kasteel, tempel"
  - label: "Wijk/District", description: "Deel van een stad"
  - label: "Stad/Dorp", description: "Nederzetting"
  - label: "Regio/Land", description: "Groter gebied"
  - label: "Wereld/Rijk", description: "Hele wereld of dimensie"
- multiSelect: false

### Step 2: Interview

Ask type-specific questions one at a time:

**📍 Location questions:**
1. "Wat zie je als je er binnenkomt? Beschrijf de ruimte."
2. "Wat hoor je? Wat ruik je? Hoe voelt de lucht?"
3. "Wie komt hier en waarom? Wat gebeurt hier normaal?"
4. "Wat is de geschiedenis van deze plek?"
5. "Wat weten de personages NIET over deze plek?" (geheim)
6. "Hoe kan deze plek spanning of conflict veroorzaken?"

**✨ Magic questions:**
1. "Hoe ziet magie eruit als het gebruikt wordt?"
2. "Wat kost het om te gebruiken? Energie, tijd, offers?"
3. "Wat zijn de absolute limieten? Wat kan NIET?"
4. "Waar komt deze magie vandaan? Wat is de oorsprong?"
5. "Wat weten de personages NIET over deze magie?" (geheim)
6. "Hoe kan dit magiesysteem spanning of conflict veroorzaken?"

**🏛️ Culture questions:**
1. "Hoe herken je iemand van deze cultuur? Kleding, taal, gedrag?"
2. "Wat is heilig of belangrijk? Wat vieren ze?"
3. "Wat is taboe? Wat is absoluut verboden?"
4. "Hoe is deze cultuur ontstaan? Wat is hun oorsprongsverhaal?"
5. "Welk geheim verbergt deze samenleving?" (geheim)
6. "Welke spanningen bestaan binnen of rond deze cultuur?"

**⚙️ Technology questions:**
1. "Hoe ziet deze technologie eruit? Hoe werkt het?"
2. "Wie heeft toegang? Wie controleert het?"
3. "Wat zijn de beperkingen of risico's?"
4. "Hoe is het uitgevonden? Wat was de doorbraak?"
5. "Welk gevaar of geheim zit in deze technologie?" (geheim)
6. "Hoe kan dit conflict of spanning veroorzaken?"

**🐉 Creature questions:**
1. "Hoe ziet dit wezen eruit? Beschrijf het."
2. "Hoe gedraagt het zich? Is het intelligent?"
3. "Wat eet het? Waar leeft het? Hoe plant het zich voort?"
4. "Wat is de oorsprong van dit wezen?"
5. "Wat weten mensen NIET over dit wezen?" (geheim)
6. "Waarom is dit wezen gevaarlijk of een bron van conflict?"

**📝 Other questions:**
1. "Beschrijf dit element. Wat is het precies?"
2. "Hoe werkt het? Wat zijn de regels?"
3. "Waar komt het vandaan? Wat is de geschiedenis?"
4. "Wat is er verborgen of onbekend?" (geheim)
5. "Hoe beïnvloedt dit het verhaal of de personages?"
6. "Hoe kan dit spanning of conflict veroorzaken?"

### Step 3: Generate Element File

Read `templates/world.md` as base structure.

Create `stories/{active}/world/{naam}.md`:

```markdown
---
type: {selected type}
scale: {scale if location, otherwise omit}
related_to: []
---

## Beschrijving
{visual + sensory answers combined}

## Regels / Hoe het werkt
{rules and mechanics}

## Geschiedenis
{origin and evolution}

## Geheim
{what characters don't know}

## Conflict Potentieel
{how this creates tension}

## Invloed op personages
{impact on story}

## Notities
```

Confirm:
```
✅ {naam} aangemaakt in world/

🌍 Samenvatting:
- Type: {type with emoji}
- Schaal: {scale if location}
- Kern: {one-line summary}
- Conflict: {one-line conflict potential}
```

---

## Mode: Uitbreiden

### Step 1: Select Element

Scan `stories/{active}/world/` for existing elements.

Use **AskUserQuestion**:
- header: "Element"
- question: "Welk element wil je uitbreiden?"
- options: [list of existing elements with type emoji]
- multiSelect: false

### Step 2: Select Aspect

Use **AskUserQuestion**:
- header: "Aspect"
- question: "Wat wil je toevoegen?"
- options:
  - label: "Detail", description: "Meer beschrijving en sfeer"
  - label: "Regels", description: "Nieuwe regels of uitzonderingen"
  - label: "Geschiedenis", description: "Oorsprong en evolutie"
  - label: "Geheim", description: "Verborgen aspect"
- multiSelect: false

### Step 3: Interview & Update

Ask relevant follow-up questions based on aspect chosen.
Update the element file with new information in appropriate section.

---

## Mode: Koppelen

### Step 1: Select Elements/Characters

Scan `stories/{active}/world/` and `stories/{active}/characters/` for existing items.

Use **AskUserQuestion** twice:
1. "Welk worldbuilding element is de bron?"
2. "Waarmee wil je koppelen?" (show both elements and characters)

### Step 2: Define Connection

Ask: "Beschrijf de connectie tussen {source} en {target}. Hoe zijn ze verbonden?"

### Step 3: Update Files

Add connection to `related_to` in frontmatter of source element.

If target is a character, optionally add note to character's Notities section.

Confirm:
```
✅ {source} gekoppeld aan {target}
```

---

## Mode: Bekijken

### Step 1: Select View

Use **AskUserQuestion**:
- header: "Bekijken"
- question: "Wat wil je zien?"
- options:
  - label: "Alle elementen", description: "Overzicht per categorie"
  - label: "Specifiek element", description: "Details van één element"
  - label: "Connecties", description: "Toon koppelingen tussen elementen"
- multiSelect: false

### Step 2: Display

**Alle elementen:**
```
🌍 Worldbuilding in "{story title}"

📍 Locaties:
- {name}: {first line of Beschrijving}

✨ Magie:
- {name}: {first line of Beschrijving}

🏛️ Cultuur:
- {name}: {first line of Beschrijving}

[etc. for each type with elements]
```

**Specifiek element:**
Display full element file content formatted nicely.

**Connecties:**
Show graph of related_to connections between elements and characters.

---

## Mode: Quick Edit

For quickly editing a specific section of an existing element.

### Step 1: Select Section

Use **AskUserQuestion**:
- header: "Sectie"
- question: "Welke sectie van {name} wil je bewerken?"
- options:
  - label: "Beschrijving", description: "Visueel en sfeer"
  - label: "Regels / Hoe het werkt", description: "Mechanica en logica"
  - label: "Geschiedenis", description: "Oorsprong en evolutie"
  - label: "Geheim", description: "Wat personages niet weten"
  - label: "Conflict Potentieel", description: "Hoe dit spanning creëert"
  - label: "Invloed op personages", description: "Impact op verhaal"
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

Update the specific section in the element file.

Confirm:
```
✅ {section} bijgewerkt voor {name}
```

---

## Mode: Quick Add

For minor worldbuilding elements that don't need full interview.

### Step 1: Type & Quick Input

Use **AskUserQuestion**:
- header: "Quick Type"
- question: "Wat voor element?"
- options:
  - label: "📍 Locatie", description: "Snelle plek toevoegen"
  - label: "✨ Magie", description: "Snel magisch element"
  - label: "🏛️ Cultuur", description: "Snel cultureel detail"
  - label: "📝 Anders", description: "Overig element"
- multiSelect: false

Ask: "Beschrijf het element in 1-2 zinnen: naam en belangrijkste kenmerk."

Example: "De Zilvermarkt, een drukke marktplaats waar je alles kunt kopen als je genoeg betaalt"

### Step 2: Generate Minimal File

Create `stories/{active}/world/{naam}.md`:

```markdown
---
type: {selected type}
scale: {infer from description if location}
related_to: []
---

## Beschrijving
{extracted description}

## Regels / Hoe het werkt

## Geschiedenis

## Geheim

## Conflict Potentieel

## Invloed op personages

## Notities
{original input}
```

Confirm:
```
✅ {naam} (quick) toegevoegd aan world/
```

---

## Mode: Inspiratie

Claude suggests worldbuilding elements based on existing story content.

### Step 1: Analyze Story

Read:
- `stories/{active}/_meta.md` for genre and logline
- `stories/{active}/characters/` for all characters
- `stories/{active}/world/` for existing elements
- `stories/{active}/scenes/_outline.md` for plot points

### Step 2: Generate Suggestions

Based on analysis, suggest 3-5 worldbuilding gaps:

```
💡 WORLDBUILDING SUGGESTIES

Gebaseerd op je verhaal zie ik deze mogelijkheden:

1. **{suggestion 1}** ({type emoji})
   {why this would enrich the story}

2. **{suggestion 2}** ({type emoji})
   {why this would enrich the story}

3. **{suggestion 3}** ({type emoji})
   {why this would enrich the story}
```

Use **AskUserQuestion**:
- header: "Inspiratie"
- question: "Welke suggestie wil je uitwerken?"
- options:
  - label: "{suggestion 1}", description: "Maak dit element"
  - label: "{suggestion 2}", description: "Maak dit element"
  - label: "{suggestion 3}", description: "Maak dit element"
  - label: "Geen, andere suggesties", description: "Genereer nieuwe ideeën"
- multiSelect: false

### Step 3: Create Selected Element

If suggestion selected, go to Mode: Nieuw Element with pre-filled context from the suggestion.
