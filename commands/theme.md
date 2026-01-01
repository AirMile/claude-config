---
description: Design systeem beheer - tokens CRUD, auto-extractie, en theme modes
---

# Theme

Beheert het project design systeem: design tokens aanmaken, bekijken, updaten, en dark/light mode configuratie.

## Overview

Dit command beheert de `THEME.md` file die design tokens bevat (colors, typography, spacing, breakpoints). Het kan tokens automatisch extraheren uit bestaande Tailwind of CSS configuratie.

**Output locatie:** `.workspace/config/THEME.md`

## When to Use

- Design systeem opzetten voor nieuw project
- Bestaande design tokens bekijken of updaten
- Tokens extraheren uit Tailwind/CSS config
- Dark/light mode toevoegen of aanpassen

## Workflow

### FASE 1: Actie Selectie

**Check eerst of THEME.md bestaat:**
```bash
# Check .workspace/config/THEME.md
```

**Als THEME.md BESTAAT:**

**AskUserQuestion:**
```yaml
header: "Theme"
question: "Wat wil je doen?"
options:
  - label: "Bekijken", description: "Toon huidige design tokens"
  - label: "Updaten", description: "Wijzig bestaande tokens"
  - label: "Extraheren", description: "Tokens ophalen uit Tailwind/CSS"
  - label: "Modes", description: "Dark/light mode beheren"
  - label: "Verwijderen", description: "Theme file verwijderen"
  - label: "Explain question", description: "Leg opties uit"
multiSelect: false
```

**Als THEME.md NIET bestaat:**

**AskUserQuestion:**
```yaml
header: "Theme"
question: "Geen theme gevonden. Wat wil je doen?"
options:
  - label: "Aanmaken (Recommended)", description: "Nieuwe theme met guided setup"
  - label: "Extraheren", description: "Tokens ophalen uit bestaande Tailwind/CSS"
  - label: "Explain question", description: "Leg opties uit"
multiSelect: false
```

---

### FASE 2: Actie Uitvoering

#### Route: Aanmaken (Nieuwe Theme)

**Stap 1: Kleuren**

**AskUserQuestion:**
```yaml
header: "Colors"
question: "Hoe wil je kleuren definiëren?"
options:
  - label: "Handmatig invoeren (Recommended)", description: "Ik geef hex values op"
  - label: "Extraheren uit config", description: "Haal uit Tailwind/CSS"
  - label: "Defaults gebruiken", description: "Start met standaard palette"
  - label: "Explain question", description: "Wat zijn design tokens?"
multiSelect: false
```

**Als "Handmatig invoeren":**
```
Geef je primaire kleuren (hex values):

1. Primary (hoofdkleur voor acties/buttons)
   → Voorbeeld: #3B82F6

2. Secondary (ondersteunende kleur)
   → Voorbeeld: #10B981

3. Neutral (grijs voor tekst/borders)
   → Voorbeeld: #6B7280

Type 's' voor populaire paletten, 'q' voor uitleg
```

**Als "Extraheren":** → Spring naar Route: Extraheren

**Als "Defaults":** Gebruik template defaults, ga naar Stap 2

**Stap 2: Typography**

**AskUserQuestion:**
```yaml
header: "Typography"
question: "Welke fonts gebruik je?"
options:
  - label: "System fonts (Recommended)", description: "system-ui, sans-serif"
  - label: "Custom fonts", description: "Eigen font families opgeven"
  - label: "Extraheren", description: "Haal uit bestaande CSS"
  - label: "Explain question", description: "Waarom fonts belangrijk zijn"
multiSelect: false
```

**Als "Custom fonts":**
```
Geef je font families:

1. Headings font
   → Voorbeeld: "Inter", "Poppins"

2. Body font
   → Voorbeeld: "Inter", system-ui

3. Mono font (optioneel, voor code)
   → Voorbeeld: "Fira Code", monospace

Type 's' voor populaire combinaties
```

**Stap 3: Spacing**

**AskUserQuestion:**
```yaml
header: "Spacing"
question: "Spacing scale voorkeur?"
options:
  - label: "4px base (Recommended)", description: "4, 8, 12, 16, 20, 24, 32, 48, 64"
  - label: "8px base", description: "8, 16, 24, 32, 40, 48, 64, 80, 96"
  - label: "Custom", description: "Eigen spacing scale"
  - label: "Explain question", description: "Wat is een spacing scale"
multiSelect: false
```

**Stap 4: Breakpoints**

**AskUserQuestion:**
```yaml
header: "Breakpoints"
question: "Responsive breakpoints?"
options:
  - label: "Tailwind defaults (Recommended)", description: "sm:640, md:768, lg:1024, xl:1280"
  - label: "Bootstrap style", description: "sm:576, md:768, lg:992, xl:1200"
  - label: "Custom", description: "Eigen breakpoints"
  - label: "Explain question", description: "Hoe breakpoints werken"
multiSelect: false
```

**Stap 5: Bevestiging**

```
📋 THEME SAMENVATTING

| Categorie | Waarde |
|-----------|--------|
| **Primary** | {color} |
| **Secondary** | {color} |
| **Neutral** | {color} |
| **Headings** | {font} |
| **Body** | {font} |
| **Spacing** | {scale} |
| **Breakpoints** | {list} |
```

**AskUserQuestion:**
```yaml
header: "Confirm"
question: "Theme aanmaken met deze settings?"
options:
  - label: "Ja, aanmaken (Recommended)", description: "Schrijf naar .workspace/config/THEME.md"
  - label: "Aanpassen", description: "Terug om wijzigingen te maken"
  - label: "Annuleren", description: "Stop zonder aanmaken"
multiSelect: false
```

**Als "Ja":**
1. Lees `THEME_TEMPLATE.md` uit resources
2. Vul template in met user values
3. Schrijf naar `.workspace/config/THEME.md`
4. Toon bevestiging

---

#### Route: Bekijken

1. Lees `.workspace/config/THEME.md`
2. Parse en toon in overzichtelijke tabel:

```
📋 HUIDIGE THEME

## Colors
| Token | Value | Preview |
|-------|-------|---------|
| primary-500 | #3B82F6 | 🟦 |
| secondary-500 | #10B981 | 🟩 |
| ... | ... | ... |

## Typography
| Element | Font |
|---------|------|
| Headings | Inter |
| Body | system-ui |

## Spacing
| Token | Value |
|-------|-------|
| spacing-1 | 4px |
| spacing-2 | 8px |
| ... | ... |

## Breakpoints
| Name | Value |
|------|-------|
| sm | 640px |
| md | 768px |
| ... | ... |
```

**AskUserQuestion:**
```yaml
header: "Action"
question: "Wat wil je doen?"
options:
  - label: "Klaar", description: "Terug naar conversation"
  - label: "Updaten", description: "Wijzigingen maken"
  - label: "Exporteren", description: "Toon als CSS variables"
multiSelect: false
```

---

#### Route: Updaten

**AskUserQuestion:**
```yaml
header: "Update"
question: "Welke sectie wil je updaten?"
options:
  - label: "Colors", description: "Kleuren aanpassen"
  - label: "Typography", description: "Fonts aanpassen"
  - label: "Spacing", description: "Spacing scale aanpassen"
  - label: "Breakpoints", description: "Breakpoints aanpassen"
  - label: "Alles", description: "Volledige herconfig"
  - label: "Explain question", description: "Toon huidige waarden"
multiSelect: true
```

**Per geselecteerde sectie:**
- Toon huidige waarden
- Vraag nieuwe waarden (zelfde flow als Aanmaken)
- Toon diff preview
- Bevestig wijziging

---

#### Route: Extraheren

**Stap 1: Detectie**

```bash
# Zoek configuratie files
# - tailwind.config.js/ts/mjs
# - CSS files met :root variables
# - globals.css, variables.css, etc.
```

**Output:**
```
🔍 DETECTIE RESULTAAT

| Bron | Status | Tokens |
|------|--------|--------|
| tailwind.config.js | ✓ Gevonden | ~{N} colors, spacing |
| src/styles/globals.css | ✓ Gevonden | ~{N} CSS variables |
| src/index.css | ✗ Geen tokens | - |
```

**AskUserQuestion:**
```yaml
header: "Extract"
question: "Uit welke bronnen extraheren?"
options:
  - label: "Alle bronnen (Recommended)", description: "Combineer alle gevonden tokens"
  - label: "Alleen Tailwind", description: "Alleen uit tailwind config"
  - label: "Alleen CSS", description: "Alleen :root variables"
  - label: "Explain question", description: "Verschil tussen bronnen"
multiSelect: false
```

**Stap 2: Extractie uitvoeren**

1. Parse geselecteerde bronnen
2. Map naar THEME.md structuur
3. Toon preview van geëxtraheerde tokens
4. Vraag bevestiging (zelfde als Aanmaken Stap 5)

---

#### Route: Modes (Dark/Light)

**AskUserQuestion:**
```yaml
header: "Modes"
question: "Theme mode actie?"
options:
  - label: "Dark mode toevoegen (Recommended)", description: "Voeg dark variant toe aan huidige theme"
  - label: "Light mode toevoegen", description: "Voeg light variant toe"
  - label: "Mode verwijderen", description: "Verwijder een bestaande mode"
  - label: "Mode switchen", description: "Wissel default mode"
  - label: "Explain question", description: "Hoe modes werken"
multiSelect: false
```

**Als "Dark mode toevoegen":**

**AskUserQuestion:**
```yaml
header: "Dark Mode"
question: "Hoe dark mode kleuren genereren?"
options:
  - label: "Auto-generate (Recommended)", description: "Inverteer/adjust automatisch"
  - label: "Handmatig", description: "Zelf dark kleuren opgeven"
  - label: "Extraheren", description: "Haal uit bestaande dark theme CSS"
  - label: "Explain question", description: "Tips voor dark mode kleuren"
multiSelect: false
```

**Als "Auto-generate":**
- Genereer dark variants van huidige kleuren
- Toon preview
- Vraag bevestiging

---

#### Route: Verwijderen

**AskUserQuestion:**
```yaml
header: "Delete"
question: "Weet je zeker dat je de theme wilt verwijderen?"
options:
  - label: "Ja, verwijderen", description: "Verwijder .workspace/config/THEME.md"
  - label: "Nee, annuleren (Recommended)", description: "Behoud theme"
multiSelect: false
```

---

## Output Formaat

**Na elke actie:**
```
✅ THEME [AANGEMAAKT/BIJGEWERKT/VERWIJDERD]

Locatie: .workspace/config/THEME.md

| Categorie | Tokens |
|-----------|--------|
| Colors | {N} |
| Typography | {N} |
| Spacing | {N} |
| Breakpoints | {N} |
| Modes | {light/dark/both} |
```

---

## Resources

- `.claude/resources/theme/references/THEME_TEMPLATE.md` - Template voor nieuwe theme

---

## Error Handling

**Config file niet gevonden bij extractie:**
```
⚠️ GEEN CONFIG GEVONDEN

Geen Tailwind of CSS variable config gedetecteerd.
```

**AskUserQuestion:**
```yaml
header: "Not Found"
question: "Geen config gevonden. Wat wil je doen?"
options:
  - label: "Handmatig aanmaken (Recommended)", description: "Maak theme met guided setup"
  - label: "Pad opgeven", description: "Geef locatie van config file"
  - label: "Annuleren", description: "Stop workflow"
multiSelect: false
```

**THEME.md corrupt of onleesbaar:**
```
⚠️ THEME ONLEESBAAR

.workspace/config/THEME.md kon niet geparsed worden.
```

**AskUserQuestion:**
```yaml
header: "Corrupt"
question: "Theme file is corrupt. Wat wil je doen?"
options:
  - label: "Opnieuw aanmaken (Recommended)", description: "Vervang met nieuwe theme"
  - label: "Backup bekijken", description: "Toon ruwe content"
  - label: "Annuleren", description: "Stop workflow"
multiSelect: false
```

---

## Restrictions

Dit command moet NOOIT:
- Theme aanmaken zonder bevestiging
- Bestaande theme overschrijven zonder waarschuwing
- Tokens raden zonder bron (config of user input)

Dit command moet ALTIJD:
- AskUserQuestion gebruiken voor alle keuzes
- Huidige waarden tonen bij updates
- Diff preview tonen voor wijzigingen
- Bevestiging vragen voor destructieve acties
