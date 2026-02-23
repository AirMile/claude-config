---
name: core-md-audit
description: >-
  Audit and improve CLAUDE.md files in repositories. Scans for all CLAUDE.md files,
  evaluates quality against criteria, outputs quality report with scores (A-F),
  then makes targeted updates after approval. Use with /core-md-audit or when user
  asks to "audit CLAUDE.md", "check CLAUDE.md quality", or "improve project memory".
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: core
disable-model-invocation: true
---

# CLAUDE.md Audit

Audit, evalueer en verbeter CLAUDE.md bestanden in een codebase zodat Claude Code optimale projectcontext heeft.

**Deze skill kan schrijven naar CLAUDE.md bestanden.** Na het presenteren van een quality report en goedkeuring van de gebruiker worden gerichte verbeteringen doorgevoerd.

## Trigger

`/core-md-audit` of wanneer de gebruiker vraagt om CLAUDE.md te auditen, checken of verbeteren.

## Process

### 1. Discovery

Vind alle CLAUDE.md bestanden in de repository:

```bash
find . -name "CLAUDE.md" -o -name ".claude.md" -o -name ".claude.local.md" 2>/dev/null | head -50
```

**Bestandstypen & locaties:**

| Type              | Locatie                  | Doel                                               |
| ----------------- | ------------------------ | -------------------------------------------------- |
| Project root      | `./CLAUDE.md`            | Primaire projectcontext (in git, gedeeld met team) |
| Local overrides   | `./.claude.local.md`     | Persoonlijke/lokale instellingen (gitignored)      |
| Global defaults   | `~/.claude/CLAUDE.md`    | User-wide defaults voor alle projecten             |
| Package-specifiek | `./packages/*/CLAUDE.md` | Module-level context in monorepos                  |
| Subdirectory      | Elke geneste locatie     | Feature/domein-specifieke context                  |

**Opmerking:** Claude ontdekt automatisch CLAUDE.md bestanden in parent directories, waardoor monorepo setups automatisch werken.

### 2. Quality Assessment

Evalueer elk CLAUDE.md bestand tegen de quality criteria. Zie [references/quality-criteria.md](references/quality-criteria.md) voor gedetailleerde rubrics.

**Quick Assessment Checklist:**

| Criterium                         | Gewicht | Check                                                                       |
| --------------------------------- | ------- | --------------------------------------------------------------------------- |
| Commands/workflows gedocumenteerd | Hoog    | Zijn build/test/deploy commands aanwezig?                                   |
| Architecture duidelijkheid        | Hoog    | Kan Claude de codebase structuur begrijpen? (check `project.json` context)  |
| Non-obvious patterns              | Medium  | Zijn gotchas en quirks gedocumenteerd? (in `project.json` context.patterns) |
| Beknoptheid                       | Medium  | Geen verbose uitleg of voor de hand liggende info?                          |
| Actualiteit                       | Hoog    | Reflecteert het de huidige codebase state?                                  |
| Uitvoerbaarheid                   | Hoog    | Zijn instructies uitvoerbaar, niet vaag?                                    |

**Quality Scores:**

- **A (90-100)**: Uitgebreid, actueel, uitvoerbaar
- **B (70-89)**: Goede dekking, kleine hiaten
- **C (50-69)**: Basisinfo, belangrijke secties ontbreken
- **D (30-49)**: Schaars of verouderd
- **F (0-29)**: Ontbreekt of ernstig verouderd

### 3. Quality Report

**ALTIJD het quality report outputten VOOR het maken van updates.**

Formaat:

```
## CLAUDE.md Quality Report

### Samenvatting
- Bestanden gevonden: X
- Gemiddelde score: X/100
- Bestanden die update nodig hebben: X

### Beoordeling per bestand

#### 1. ./CLAUDE.md (Project Root)
**Score: XX/100 (Grade: X)**

| Criterium | Score | Opmerkingen |
|-----------|-------|-------------|
| Commands/workflows | X/20 | ... |
| Architecture duidelijkheid | X/20 | ... |
| Non-obvious patterns | X/15 | ... |
| Beknoptheid | X/15 | ... |
| Actualiteit | X/15 | ... |
| Uitvoerbaarheid | X/15 | ... |

**Issues:**
- [Lijst specifieke problemen]

**Aanbevolen toevoegingen:**
- [Lijst wat toegevoegd moet worden]
```

### 4. Targeted Updates

Na het outputten van het quality report, vraag de gebruiker om bevestiging voor updates.

**Update richtlijnen (Kritiek):**

1. **Stel alleen gerichte toevoegingen voor** — Focus op oprecht nuttige info:
   - Commands of workflows ontdekt tijdens analyse
   - Gotchas of non-obvious patterns gevonden in code
   - Package relaties die niet duidelijk waren
   - Testing aanpakken die werkten
   - Configuratie-eigenaardigheden

2. **Houd het minimaal** — Vermijd:
   - Herhalen wat voor de hand ligt uit de code
   - Generieke best practices die al gedekt zijn
   - Eenmalige fixes die waarschijnlijk niet terugkeren
   - Verbose uitleg wanneer een one-liner volstaat

3. **Toon diffs** — Voor elke wijziging:
   - Welk CLAUDE.md bestand te updaten
   - De specifieke toevoeging (als diff of geciteerd blok)
   - Korte uitleg waarom dit toekomstige sessies helpt

Zie [references/update-guidelines.md](references/update-guidelines.md) voor volledige richtlijnen.

**Diff formaat:**

````markdown
### Update: ./CLAUDE.md

**Waarom:** Build command ontbrak, wat verwarring veroorzaakte over hoe het project te draaien.

\`\`\`diff

- ## Quick Start
-
- ```bash

  ```

- npm install
- npm run dev # Start development server op port 3000
- ```
  \`\`\`
  ```
````

### 5. Apply Updates

Na goedkeuring van de gebruiker, pas wijzigingen toe met de Edit tool. Behoud bestaande content structuur.

## Templates

Zie [references/templates.md](references/templates.md) voor CLAUDE.md templates per projecttype.

## Veelvoorkomende issues om te signaleren

1. **Verouderde commands**: Build commands die niet meer werken
2. **Ontbrekende dependencies**: Vereiste tools niet genoemd
3. **Verouderde architectuur**: Bestandsstructuur die veranderd is
4. **Ontbrekende environment setup**: Vereiste env vars of config
5. **Kapotte test commands**: Test scripts die veranderd zijn
6. **Ongedocumenteerde gotchas**: Non-obvious patterns niet vastgelegd

## Output

**Quality Report** (altijd eerst):

```
## CLAUDE.md Quality Report
### Samenvatting
- Bestanden gevonden: X
- Gemiddelde score: X/100 (Grade: X)
- Bestanden die update nodig hebben: X
```

**Na goedkeuring updates:**

```
Toegepast: X updates op Y bestanden
```
