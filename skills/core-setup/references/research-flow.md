# Research Flow

Protocol voor library/tool research wanneer geen tier-1 module beschikbaar is. Gebruikt Context7 voor docs en WebSearch voor sentiment, dan presenteert 3 best-fit opties.

---

## Stap 1: User intent

Vraag de user (vrije tekst, geen modal) wat ze precies zoeken. Voorbeeld:

> Geef de naam of categorie van wat je wilt installeren. Bijvoorbeeld: "een animation library", "Framer Motion", "auth voor Next.js", "een datepicker met range support".

Parse de input naar:

- **Library naam** (als specifiek genoemd, bv. "Framer Motion")
- **Category** (als generiek, bv. "animation")
- **Constraints** (compatibiliteit, framework, size, etc.)

---

## Stap 2: Context7 query

### 2a. Bij specifieke library

```
mcp__context7__resolve-library-id(libraryName: "{naam}")
→ kies eerste match met hoogste trust score
mcp__context7__query-docs(context7CompatibleLibraryID: "{id}", query: "installation setup {framework}")
```

### 2b. Bij category-only

Zoek 3 kandidaten via WebSearch eerst (zie Stap 3), dan voor elk:

```
mcp__context7__resolve-library-id(libraryName: "{candidate}")
mcp__context7__query-docs(...)
```

Doel: actuele install-stappen + recente versie + framework compatibility.

---

## Stap 3: WebSearch sentiment

```
WebSearch("best {category} library {framework} 2026")
WebSearch("{candidate} vs alternatives {framework}")
```

Filter resultaten:

- Recent (laatste 12 maanden bij voorkeur)
- Bronnen: GitHub stars/issues, Reddit, dev.to, blog posts van bekende devs
- Negatieve signalen: "deprecated", "unmaintained", "abandoned", laatste release > 18 mnd

---

## Stap 4: Trade-off matrix

Bouw een tabel voor 3 best-fit kandidaten:

```
| Optie     | Bundle  | Weekly DLs | Last release | DX score | Stack fit |
| --------- | ------- | ---------- | ------------ | -------- | --------- |
| {opt 1}   | {kb}    | {N}        | {date}       | {1-5}    | {1-5}     |
| {opt 2}   | ...     | ...        | ...          | ...      | ...       |
| {opt 3}   | ...     | ...        | ...          | ...      | ...       |
```

**DX score** (subjective, 1-5): TypeScript support, docs quality, API ergonomics
**Stack fit**: hoe goed past het bij gedetecteerde framework + reeds geïnstalleerde libs

---

## Stap 5: Presenteer + recommend

```yaml
header: "Research result"
question: "Drie best-fit opties voor {category} ({framework}). Welke wil je?"
options:
  - label: "{best pick} (Recommended)", description: "{1-line waarom + key trade-off}"
  - label: "{alternative 1}", description: "{1-line + waarom je dit zou kiezen}"
  - label: "{alternative 2}", description: "{1-line + waarom je dit zou kiezen}"
  - label: "Annuleren", description: "Geen install, terug naar FASE 2"
multiSelect: false
```

**Recommendation logic**:

- Voorkeur stack-fit ≥ 4
- Tie-breaker: hoogste DX score
- Tie-breaker 2: kleinere bundle
- Negatieve signalen (deprecated/abandoned) → uitsluiten

---

## Stap 6: Genereer install-stappen

Bij user-keuze, query Context7 nogmaals voor exact installation:

```
mcp__context7__query-docs(
  context7CompatibleLibraryID: "{chosen-id}",
  query: "installation {framework} typescript setup config"
)
```

Distilleer naar:

1. **Install command** (welke packages, dev vs prod)
2. **Config files** (welke files te bewerken, welke entries)
3. **Boilerplate** (provider wrappers, root setup, etc.)
4. **Optional gitignore entries**

Voer uit per FASE 5 in SKILL.md.

---

## Edge cases

- **Geen Context7 match**: skip Context7, gebruik alleen WebSearch + library website docs
- **Conflict met bestaande lib**: warn en vraag bevestiging (bv. installing Tailwind als StyleX al aanwezig is)
- **Framework incompatibel**: abort met suggestie van compatible alternative
- **Library is paid/closed source**: meld dit expliciet voor user keuze
