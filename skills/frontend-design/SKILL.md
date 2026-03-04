---
name: frontend-design
description: >-
  Design specification management: pages, flows, and design principles.
  Iteratively capture and manage the app's design structure before building.
  Use with /frontend-design.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: frontend
---

# Design

Beheert de design specificatie van het project: pagina's, user flows, en design principes vastleggen en beheren. Iteratief — roep meerdere keren aan om incrementeel op te bouwen.

**Pipeline:** `/frontend-design` → `/frontend-theme` → `/frontend-page` → `/frontend-iterate` → quality skills

**Output locatie:** `.project/project.json` → `design` sectie

## References

- `../shared/DASHBOARD.md` — project.json schema en merge-strategieën
- `../shared/DEVINFO.md` — Session tracking, cross-skill handoff

---

## Design JSON Schema

De `design` sectie in `project.json` volgt dit schema:

```json
{
  "pages": [
    {
      "name": "dashboard",
      "purpose": "Overzicht met metrics en status",
      "status": "DEF",
      "sections": ["hero", "metrics-grid", "activity-feed"],
      "flows": ["login → dashboard", "dashboard → settings"],
      "notes": ""
    }
  ],
  "flows": [
    {
      "name": "onboarding",
      "steps": ["landing", "signup", "verify-email", "dashboard"],
      "notes": ""
    }
  ],
  "principles": [
    {
      "name": "Mobile-first",
      "description": "Design voor mobile viewport eerst, progressive enhancement"
    }
  ]
}
```

**Status waarden (pages):** `IDEA` | `DEF` | `BLT` | `DONE`

**Merge-strategie:** `MERGE op name` — pages/flows/principles merge op naam, update velden, nooit auto-delete.

---

## State Machine

```
[*] → PREFLIGHT

PREFLIGHT → ACTION_SELECT (pass)
PREFLIGHT → ERROR (fail)

ACTION_SELECT → AANMAKEN (empty state)
ACTION_SELECT → IMPORTEREN (empty state)
ACTION_SELECT → BEKIJKEN (populated)
ACTION_SELECT → PAGINA (populated)
ACTION_SELECT → FLOW (populated)
ACTION_SELECT → PRINCIPES (populated)
ACTION_SELECT → VERWIJDEREN (populated)

AANMAKEN → CONFIRM
IMPORTEREN → CONFIRM
BEKIJKEN → ACTION_SELECT ("Aanpassen")
BEKIJKEN → [*] ("Klaar")
PAGINA → CONFIRM
FLOW → CONFIRM
PRINCIPES → CONFIRM
VERWIJDEREN → CONFIRM

CONFIRM → POSTFLIGHT ("Ja")
CONFIRM → ACTION_SELECT ("Aanpassen" — loop back)
CONFIRM → [*] ("Annuleren")

POSTFLIGHT → COMPLETE (pass)
POSTFLIGHT → RECOVER (fail)

COMPLETE → [*]
```

---

## Read/Write Protocol

### Reading

1. Read `.project/project.json` (detect if missing)
2. Parse as JSON
3. Access `design` section (may be empty `{}`, undefined, or populated)

### Writing

1. Read `.project/project.json` (or create new with EMPTY schema from `shared/DASHBOARD.md` if missing)
2. Parse JSON
3. Mutate ONLY the `design` section (other sections UNTOUCHED)
4. Write back as `JSON.stringify(data, null, 2)`

**Nieuw bestand aanmaken** als `.project/project.json` niet bestaat: gebruik het EMPTY schema uit `shared/DASHBOARD.md`, voeg `design` sectie toe:

```json
"design": {
  "pages": [],
  "flows": [],
  "principles": []
}
```

### Merge Logic

For each page/flow/principle:

1. Find by `name` in existing array
2. If not found: push new item
3. If found: update fields (purpose, status, sections, flows, notes, steps, description)
4. Never auto-delete items (only via explicit "Verwijderen" route)

---

## FASE 0: Pre-flight

### 0.1 Directory Check

Check `.project/` exists. If not, create it.

```
Directory: [✓|✗] .project/ — [exists | created | error]
```

### 0.2 Session Check

Read `.project/session/devinfo.json` for handoff from upstream skill.

```
Session: [✓] [New session | Continuing from {skill}]
```

### 0.3 Design State Check

Read `.project/project.json` and check if `design` section has data.

```
Design: [empty — guided setup beschikbaar | {N} pagina's, {M} flows, {P} principes]
```

**On failure:** AskUserQuestion:

```yaml
header: "Pre-flight"
question: "Pre-flight check gefaald. Hoe wil je doorgaan?"
options:
  - label: "Fix en retry (Recommended)", description: "Probeer het probleem op te lossen"
  - label: "Doorgaan anyway", description: "Negeer en ga door"
  - label: "Annuleren", description: "Stop"
multiSelect: false
```

**Show pre-flight summary:**

```
PRE-FLIGHT CHECK
════════════════════════════════════════════════
Directory:  [✓|✗] .project/
Session:    [✓] [status]
Design:     [empty | {N} pages, {M} flows, {P} principles]
════════════════════════════════════════════════
```

---

## FASE 1: Actie Selectie

Conditional branching based on design section state. Follows the same pattern as `frontend-theme/SKILL.md`.

### If design section EMPTY (or project.json missing):

```yaml
header: "Design"
question: "Geen design spec gevonden. Wat wil je doen?"
options:
  - label: "Aanmaken (Recommended)", description: "Nieuwe design spec met guided setup"
  - label: "Importeren", description: "Design extraheren uit bestaande codebase"
multiSelect: false
```

### If design section HAS DATA:

```yaml
header: "Design"
question: "Design spec gevonden ({N} pagina's, {M} flows, {P} principes). Wat wil je doen?"
options:
  - label: "Bekijken", description: "Toon huidige design spec"
  - label: "Pagina", description: "Pagina toevoegen of bewerken"
  - label: "Flow", description: "User flow toevoegen of bewerken"
  - label: "Principes", description: "Design principes beheren"
multiSelect: false
```

If user chooses "Other": check for "verwijderen" intent. If confirmed, proceed to Verwijderen route.

---

## FASE 2: Actie Uitvoering

### Route: Aanmaken (First-Time Setup)

Guided 4-step creation flow.

#### Stap 1: Projectcontext

Check if `concept` section exists in project.json.

**If concept exists:**

```
PROJECT CONTEXT
════════════════════════════════════════════════
Naam:    {concept.name}
Concept: {concept.content — first 200 chars}
════════════════════════════════════════════════
```

```yaml
header: "Context"
question: "Klopt deze context nog?"
options:
  - label: "Ja, ga door (Recommended)", description: "Context is correct"
  - label: "Ik pas het aan", description: "Beschrijf de context opnieuw"
multiSelect: false
```

**If no concept:**

```yaml
header: "Context"
question: "Beschrijf kort wat je bouwt en voor wie."
options:
  - label: "Ik typ het uit", description: "Vrije beschrijving"
multiSelect: false
```

Store context for generating relevant page suggestions.

#### Stap 2: Pagina's definiëren

```yaml
header: "Pagina's"
question: "Welke pagina's heeft je app nodig? Beschrijf naam + doel per pagina."
options:
  - label: "Ik typ ze uit (Recommended)", description: "Beschrijf elke pagina vrij"
  - label: "Standaard set", description: "Home, Dashboard, Settings, Login/Register"
  - label: "Later", description: "Sla pagina's over, voeg later toe"
multiSelect: false
```

**If "Standaard set":** Generate 4 default pages with generic purposes based on project context. Present for confirmation.

**If "Ik typ ze uit":** User provides free-text list. Parse into structured page objects:

For EACH page, generate:

- `name`: slug-case (e.g., "dashboard", "user-settings")
- `purpose`: 1-2 sentences derived from user description
- `status`: `DEF`
- `sections`: derived from purpose (e.g., dashboard → "metrics-grid", "activity-feed")
- `flows`: initially empty (filled after flow definition)
- `notes`: empty

Show summary table:

```
PAGINA'S
════════════════════════════════════════════════
| Naam      | Doel                          | Secties                      | Status |
|-----------|-------------------------------|------------------------------|--------|
| dashboard | Overzicht met metrics         | hero, metrics-grid, feed     | DEF    |
| settings  | Account instellingen          | profile-form, notifications  | DEF    |
════════════════════════════════════════════════
```

#### Stap 2b: Design Alternatieven (optioneel)

Bij pagina's met ≥3 secties, bied aan:

```yaml
header: "Alternatieven"
question: "Wil je alternatieve layouts vergelijken voor {page-name}?"
options:
  - label: "Nee, ga door (Recommended)", description: "Huidige indeling is goed"
  - label: "Ja, 2 alternatieven", description: "Genereer 2 radicaal andere sectiedelingen"
multiSelect: false
```

**Als "Ja":** spawn 2 agents parallel, elk met een andere constraint:

- Agent 1: "Minimaliseer secties — max 2, combineer waar mogelijk"
- Agent 2: "Maximaliseer focus — elke sectie heeft één doel"

Presenteer de 3 opties (origineel + 2 alternatieven) als ASCII wireframes.
User kiest via AskUserQuestion welke layout, of combineert elementen.

Bij pagina's met <3 secties: skip deze stap.

```yaml
header: "Pagina's"
question: "Kloppen deze pagina's?"
options:
  - label: "Ja, ga door (Recommended)", description: "Ga naar flows"
  - label: "Aanpassen", description: "Ik wil iets wijzigen"
multiSelect: false
```

If "Aanpassen": ask what to change, update, re-confirm.

#### Stap 3: User Flows

```yaml
header: "Flows"
question: "Welke user flows zijn belangrijk? (bijv. onboarding, checkout, account setup)"
options:
  - label: "Ik typ ze uit (Recommended)", description: "Beschrijf elke flow met stappen"
  - label: "Afleiden uit pagina's", description: "Genereer flows op basis van gedefinieerde pagina's"
  - label: "Later", description: "Sla flows over, voeg later toe"
multiSelect: false
```

**If "Afleiden uit pagina's":** Analyze defined pages and generate logical flows:

- Login-flow if login page exists
- Navigation flows between related pages
- CRUD flows if form pages exist

Present for confirmation.

**If "Ik typ ze uit":** User provides descriptions. Parse into structured flow objects:

- `name`: descriptive name
- `steps`: array of page names as flow steps
- `notes`: empty

**Cross-reference:** For each step in a flow, check if the page exists in the defined pages. If not:

```
⚠ Flow "{flow}" refereert naar pagina "{page}" die nog niet gedefinieerd is.
```

Offer to add missing pages.

Show summary:

```
FLOWS
════════════════════════════════════════════════
| Naam        | Stappen                                    |
|-------------|--------------------------------------------|
| onboarding  | landing → signup → verify → dashboard      |
| settings    | dashboard → settings → save → dashboard    |
════════════════════════════════════════════════
```

#### Stap 4: Design Principes

```yaml
header: "Principes"
question: "Welke design principes gelden?"
options:
  - label: "Standaard set (Recommended)", description: "Mobile-first, Consistent spacing, Accessibility (WCAG AA)"
  - label: "Ik definieer zelf", description: "Eigen principes opgeven"
  - label: "Later", description: "Sla principes over, voeg later toe"
multiSelect: false
```

**If "Standaard set":** Generate:

- Mobile-first: "Design voor mobile viewport eerst, progressive enhancement"
- Consistent spacing: "Gebruik een spacing scale voor alle margins en padding"
- Accessibility: "WCAG 2.1 AA compliance, semantische HTML, keyboard navigatie"

**If "Ik definieer zelf":** Free-text input, parse into `{ name, description }` objects.

#### Stap 5: Samenvatting

Show complete summary:

```
DESIGN SPEC SAMENVATTING
════════════════════════════════════════════════

Pagina's ({N}):
| Naam      | Doel                    | Secties                  | Status |
|-----------|-------------------------|--------------------------|--------|
| dashboard | Overzicht met metrics   | hero, metrics-grid, feed | DEF    |
| settings  | Account instellingen    | profile-form, notifs     | DEF    |

Flows ({M}):
| Naam       | Stappen                                 |
|------------|-----------------------------------------|
| onboarding | landing → signup → verify → dashboard   |

Principes ({P}):
| Naam          | Beschrijving                                     |
|---------------|--------------------------------------------------|
| Mobile-first  | Design voor mobile viewport eerst                |
| Accessibility | WCAG 2.1 AA compliance, semantische HTML         |

════════════════════════════════════════════════
```

Proceed to FASE 3 (Confirm).

---

### Route: Importeren (Extract from Codebase)

#### Stap 1: Scan

Glob for page files in common framework patterns:

| Framework          | Pattern                     |
| ------------------ | --------------------------- |
| Next.js App Router | `app/**/page.{tsx,jsx}`     |
| Next.js Pages      | `src/pages/**/*.{tsx,jsx}`  |
| Vite + React       | `src/pages/**/*.{tsx,jsx}`  |
| Remix              | `app/routes/**/*.{tsx,jsx}` |
| Astro              | `src/pages/**/*.astro`      |

```
SCAN RESULTAAT
════════════════════════════════════════════════
Framework:  [detected]
Pagina's:   {N} gevonden
Componenten: {M} gevonden
════════════════════════════════════════════════
```

#### Stap 2: Parse Pages

For each detected page file:

- Extract page name from file path
- Analyze imports to detect section components
- Infer purpose from component names and composition

#### Stap 3: Infer Flows

From routing structure and navigation components (Link, useRouter, navigate), infer user flows between pages.

#### Stap 4: Present and Confirm

Show extracted design spec in same table format as Aanmaken Stap 5. Proceed to FASE 3 (Confirm).

---

### Route: Bekijken (View)

Read `project.json` → `design` section. Render as formatted table (same format as Aanmaken Stap 5 summary).

```yaml
header: "Actie"
question: "Wat wil je doen?"
options:
  - label: "Klaar", description: "Terug naar conversation"
  - label: "Aanpassen", description: "Naar actie selectie"
multiSelect: false
```

If "Klaar": end skill, no state change.
If "Aanpassen": loop back to FASE 1 (ACTION_SELECT with populated-state options).

---

### Route: Pagina (Add/Edit Page)

#### Stap 1: Keuze

```yaml
header: "Pagina"
question: "Wat wil je doen?"
options:
  - label: "Nieuwe pagina toevoegen (Recommended)", description: "Voeg een pagina toe aan de design spec"
  - label: "Bestaande bewerken", description: "Pas een bestaande pagina aan"
multiSelect: false
```

#### If "Nieuwe pagina":

```yaml
header: "Nieuwe Pagina"
question: "Beschrijf de pagina: naam, doel, en welke secties/content erop moet."
options:
  - label: "Ik typ het uit", description: "Vrije beschrijving"
multiSelect: false
```

Parse description into structured page object. Show preview, proceed to FASE 3 (Confirm).

#### If "Bestaande bewerken":

Show existing pages as options (dynamically generated):

```yaml
header: "Bewerken"
question: "Welke pagina wil je bewerken?"
options:
  - label: "{page1.name}", description: "{page1.purpose} ({page1.status}) — {N} secties"
  - label: "{page2.name}", description: "{page2.purpose} ({page2.status}) — {N} secties"
  # ... max 4 options, rest via "Other"
multiSelect: false
```

Then ask what to change:

```yaml
header: "Bewerk: {page-name}"
question: "Wat wil je aanpassen?"
options:
  - label: "Doel", description: "Huidige: {purpose}"
  - label: "Secties", description: "Huidige: {sections joined}"
  - label: "Status", description: "Huidige: {status}"
  - label: "Notities", description: "Huidige: {notes or 'leeg'}"
multiSelect: true
```

Process updates, proceed to FASE 3 (Confirm).

---

### Route: Flow (Add/Edit Flow)

Same structure as Pagina route.

#### If "Nieuwe flow":

```yaml
header: "Nieuwe Flow"
question: "Beschrijf de flow: naam en stappen als pagina-naar-pagina."
options:
  - label: "Ik typ het uit (Recommended)", description: "Bijv: 'onboarding: landing → signup → verify → dashboard'"
  - label: "Selecteer uit pagina's", description: "Kies pagina's en bouw de flow stap voor stap"
multiSelect: false
```

If "Selecteer uit pagina's": show existing pages as multi-select to build flow sequence.

Cross-reference: for each step, check if page exists in `design.pages`. If not, warn and offer to create it.

#### If "Bestaande bewerken":

Show existing flows as options, then edit name/steps/notes. Same pattern as page edit.

Proceed to FASE 3 (Confirm).

---

### Route: Principes (Add/Edit)

```yaml
header: "Principes"
question: "Wat wil je doen?"
options:
  - label: "Toevoegen (Recommended)", description: "Nieuw principe toevoegen"
  - label: "Bewerken", description: "Bestaand principe aanpassen"
multiSelect: false
```

**Adding:** Free-text input (name + description), parse, proceed to FASE 3 (Confirm).

**Editing:** Show list of current principles as selectable options, then edit description. Proceed to FASE 3 (Confirm).

---

### Route: Verwijderen (Delete Item)

```yaml
header: "Verwijderen"
question: "Wat wil je verwijderen?"
options:
  - label: "Pagina", description: "Een pagina uit de design spec"
  - label: "Flow", description: "Een user flow"
  - label: "Principe", description: "Een design principe"
multiSelect: false
```

Show items of selected type as options. After selection, confirm with safety pattern:

```yaml
header: "Bevestig Verwijdering"
question: "Weet je zeker dat je '{item-name}' wilt verwijderen?"
options:
  - label: "Nee, annuleren (Recommended)", description: "Behoud item"
  - label: "Ja, verwijderen", description: "Definitief verwijderen"
multiSelect: false
```

**Cross-reference check:** When deleting a page, check if it's referenced in any flows. If so, warn:

```
⚠ Pagina "{page}" wordt gebruikt in flow(s): {flow-names}.
  Deze flow stappen worden orphaned.
```

Proceed to FASE 3 (Confirm).

---

## FASE 3: Confirm + Loop

Reached after any mutating action. Show what will change:

```
WIJZIGINGEN
════════════════════════════════════════════════
+ Pagina "checkout" toegevoegd (3 secties)
~ Flow "purchase" bijgewerkt (stap toegevoegd)
- Principe "Dark theme" verwijderd

Totaal na wijziging: {N} pagina's, {M} flows, {P} principes
════════════════════════════════════════════════
```

```yaml
header: "Confirm"
question: "Wijzigingen doorvoeren?"
options:
  - label: "Ja, opslaan (Recommended)", description: "Schrijf naar project.json"
  - label: "Aanpassen", description: "Terug naar actie selectie"
  - label: "Annuleren", description: "Stop zonder wijzigingen"
multiSelect: false
```

If "Ja": proceed to FASE X (write + post-flight).
If "Aanpassen": loop back to FASE 1 (ACTION_SELECT with updated state).
If "Annuleren": exit cleanly, no changes written.

---

## FASE X: Post-flight Validation

### X.1 Write to project.json

Follow the Read/Write Protocol defined above. Only mutate the `design` section.

### X.2 Validate

1. **File validation** — project.json exists, is valid JSON
2. **Content validation:**
   - `design.pages` is an array, each page has `name`, `purpose`, `status`, `sections`
   - `design.flows` is an array, each flow has `name` and `steps` (non-empty array)
   - `design.principles` is an array, each principle has `name` and `description`
3. **Integrity check:**
   - Other project.json sections unchanged
   - No duplicate names within pages, flows, or principles
4. **Cross-reference check:**
   - Flow steps reference existing pages (warn if orphaned, don't block)

```
POST-FLIGHT CHECK
════════════════════════════════════════════════
File:       [✓] .project/project.json — valid JSON
Pages:      [✓] {N} pagina's — all valid
Flows:      [✓] {M} flows — all valid
Principles: [✓] {P} principes — all valid
Integrity:  [✓] andere secties ongewijzigd
CrossRef:   [✓|⚠] flow stappen → pagina's
════════════════════════════════════════════════
```

**On failure:**

```yaml
header: "Validatie"
question: "Post-flight validatie gefaald. Hoe wil je doorgaan?"
options:
  - label: "Auto-fix (Recommended)", description: "Los automatisch op"
  - label: "Handmatig fixen", description: "Ik fix het zelf"
  - label: "Negeren", description: "Ga door ondanks fout"
multiSelect: false
```

---

## Completion

### Update DevInfo

Update `.project/session/devinfo.json`:

```json
{
  "currentSkill": { "name": "frontend-design", "phase": "COMPLETE" },
  "handoff": {
    "from": "frontend-design",
    "to": "frontend-theme",
    "data": {
      "designLocation": ".project/project.json#design",
      "pages": {
        "count": 4,
        "names": ["dashboard", "settings", "login", "checkout"]
      },
      "flows": {
        "count": 2,
        "names": ["onboarding", "purchase"]
      },
      "principles": {
        "count": 3,
        "names": ["Mobile-first", "Accessibility", "Consistent spacing"]
      }
    }
  }
}
```

### Completion Report

```
DESIGN SPEC [AANGEMAAKT|BIJGEWERKT]
═══════════════════════════════════════════════════════════════

Locatie: .project/project.json (design sectie)

| Categorie | Aantal | Details                            |
|-----------|--------|------------------------------------|
| Pagina's  | {N}    | {status breakdown: 2 DEF, 1 BLT}  |
| Flows     | {M}    | {flow names joined}                |
| Principes | {P}    | {principle names joined}           |

Next steps:
  1. /frontend-design   → voeg meer pagina's/flows toe (iteratief)
  2. /frontend-theme    → design tokens en kleuren op basis van principes
  3. /frontend-page {x} → bouw een specifieke pagina

═══════════════════════════════════════════════════════════════
```

---

## Restrictions

This skill must **NEVER**:

- Write design spec without user confirmation (FASE 3)
- Auto-delete pages, flows, or principles (only via explicit "Verwijderen" route)
- Overwrite other sections in project.json
- Skip pre-flight or post-flight validation
- Guess page structure without user input or codebase evidence (Importeren route)

This skill must **ALWAYS**:

- Run pre-flight validation (FASE 0) before any operation
- Use AskUserQuestion for all user choices
- Show current values when editing existing items
- Show change preview before confirming (FASE 3)
- Confirm before destructive actions with "Nee" as recommended option
- Run post-flight validation (FASE X) after any write
- Cross-reference flow steps against defined pages
- Update DevInfo at completion
- Show completion report with next steps
