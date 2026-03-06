# Plan: .project/ Context Optimalisatie

Verbeteringen aan hoe `.project/project.json` data wordt opgeslagen, geladen en gesynchroniseerd door skills. Doel: minder wasted context tokens, beheersbare groei, en simpelere skill code.

## Impact Overzicht

| Verbetering                 | Files geraakt                     | Token besparing                    | Risico |
| --------------------------- | --------------------------------- | ---------------------------------- | ------ |
| concept.pitch               | DASHBOARD.md + 3 skills           | ~3.5KB per dev-define/build sessie | Laag   |
| Thinking → file refs        | DASHBOARD.md + 4 skills           | Onbegrensd (voorkomt groei)        | Medium |
| DEVINFO.md strippen         | 1 bestand                         | 0 (documentatie cleanup)           | Laag   |
| Selectieve context loading  | 4 skills                          | ~1-2KB per agent call              | Medium |
| thinking-decide → decisions | 1 skill + FEATURE.md              | 0 (betere data flow)               | Laag   |
| Sync extractie              | 7 skills + 1 nieuw shared bestand | 0 (DRY, minder skill code)         | Hoog   |

---

## FASE 1: Schema Wijzigingen

Pas eerst de data-structuren aan. Geen skill-gedrag verandert — alleen het formaat.

### 1A. `concept.pitch` veld toevoegen

**Wat:** Nieuw veld `concept.pitch` (1-2 zinnen) naast bestaand `concept.content`.

**Schema wijziging in DASHBOARD.md:**

```json
"concept": {
  "name": "SonarPoppy",
  "pitch": "Shared muziek-aanbevelingsbackend met 4-pijler hybride scoring en gebruiker-gestuurd dialsysteem.",
  "content": "... (volledig document) ...",
  "thinking": [...]
}
```

**Bestanden:**

| Bestand                        | Wijziging                                                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `shared/DASHBOARD.md`          | Schema: `concept.pitch` veld toevoegen. Template: lege string default. Merge-strategie: OVERWRITE samen met name/content.           |
| `thinking-idea/SKILL.md`       | Step 4: na markdown generatie, extraheer eerste alinea als `pitch`. Step 5: schrijf `concept.pitch` mee bij "Opslaan naar concept". |
| `thinking-brainstorm/SKILL.md` | Step 7: bij "Opslaan naar concept", update ook `concept.pitch` met refined eerste alinea.                                           |
| `thinking-critique/SKILL.md`   | Zelfde als brainstorm — update pitch bij concept save.                                                                              |

**Backwards compatible:** Ja. Skills die pitch niet kennen negeren het veld. Lege pitch = fallback naar content.

### 1B. Thinking entries → file references

**Wat:** Volledige markdown content uit `concept.thinking[]` en `thinking[]` entries verplaatsen naar losse bestanden. JSON entries worden een compact index.

**Huidig (groeit onbegrensd):**

```json
{
  "type": "idea",
  "date": "2026-03-04",
  "title": "SonarPoppy",
  "content": "# SonarPoppy\n\nShared muziek-aanbevelingsbackend die twee apps...\n\n## Core Concept\n\n...(3KB)...",
  "source": "/thinking-idea"
}
```

**Nieuw (compact index + file):**

```json
{
  "type": "idea",
  "date": "2026-03-04",
  "title": "SonarPoppy",
  "summary": "Shared muziek-aanbevelingsbackend met cosine similarity en dialsysteem voor SonarPop en Poppy.",
  "file": ".project/thinking/2026-03-04-idea-sonarpoppy.md",
  "source": "/thinking-idea"
}
```

- `content` → `summary` (max 200 chars, key insight)
- `content` volledig → bestand in `.project/thinking/`
- `file` verwijst naar het markdown bestand

**Bestanden:**

| Bestand                        | Wijziging                                                                                                                                                              |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared/DASHBOARD.md`          | Schema: `thinking` en `concept.thinking` entries — `content` → `summary` + `file`. Bestandsnaam conventie: `{date}-{type}-{slug}.md`. Directory: `.project/thinking/`. |
| `thinking-idea/SKILL.md`       | Step 5: schrijf markdown naar `.project/thinking/{date}-idea-{slug}.md`. Push entry met `summary` + `file` i.p.v. `content`.                                           |
| `thinking-brainstorm/SKILL.md` | Step 7: zelfde patroon. Extra velden `variants`, `chosen` blijven in JSON entry.                                                                                       |
| `thinking-critique/SKILL.md`   | Output destination: zelfde patroon als idea.                                                                                                                           |
| `thinking-decide/SKILL.md`     | Dashboard sync: zelfde patroon. Extra velden `options`, `chosen`, `rationale` blijven in JSON.                                                                         |

**Migratie bestaande data:** Niet nodig. Oude entries met `content` blijven werken. Nieuwe entries gebruiken `summary` + `file`. Skills die entries lezen checken op `file` (nieuw) of `content` (legacy).

### 1C. DEVINFO.md strippen

**Wat:** DEVINFO.md reduceren tot wat werkelijk gebruikt wordt — het active-feature signaalprotocol. De rest (executionPlan, progress, taskHistory, file tracking, validation, handoff contracts) verwijderen.

**Reden:** Geen enkele skill schrijft `devinfo.json`. Alle skills gebruiken alleen:

- `.project/session/active-{feature}.json` (3 velden)
- `.project/session/pre-skill-sha.txt` (1 regel)
- `.project/session/pre-skill-status.txt` (git status snapshot)

**Bestanden:**

| Bestand             | Wijziging                                                                                                                                                                     |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shared/DEVINFO.md` | Strip naar ~50 regels: Active Feature Protocol + Session Files. Verwijder: schema (180 regels), operations (200 regels), handoff contracts (150 regels), directory structure. |

**DEVINFO.md nieuw (conceptueel):**

```markdown
# Session Tracking

## Active Feature Signal

Storage: `.project/session/active-{feature-name}.json`
Schema: { feature, skill, startedAt }
Protocol: create bij skill start, delete bij skill einde.

## Git Baseline

Storage: `.project/session/pre-skill-sha.txt` of `pre-skill-status.txt`
Doel: scoped commits — alleen files van deze skill stagen.

## Staleness

Entries ouder dan 2 uur worden genegeerd.
```

---

## FASE 2: Skill Consumption Verbeteren

Skills passen aan hoe ze context laden. Vereist FASE 1A (concept.pitch).

### 2A. Dev-define: concept.pitch i.p.v. concept.content

**Wat:** FASE 0 stap 3 van dev-define laadt nu `concept.content` als "feature context". Vervangen door `concept.pitch`.

**Huidige code (dev-define SKILL.md, rond regel 40-46):**

```
- `concept.content` als feature context
```

**Nieuw:**

```
- `concept.pitch` als feature context (korte samenvatting)
```

**Bestanden:**

| Bestand               | Wijziging                                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `dev-define/SKILL.md` | FASE 0 stap 3: vervang `concept.content` door `concept.pitch`. Fallback: als pitch leeg, gebruik eerste 2 zinnen van content. |

### 2B. Dev-build: selectieve PROJECT_CONTEXT

**Wat:** PROJECT_CONTEXT samenstelling in dev-build FASE 0 filtert op relevantie voor de feature.

**Huidig (alles mee):**

```
PROJECT CONTEXT:
Structure: {context.structure}      ← altijd
Patterns: {context.patterns}        ← altijd
Endpoints: {endpoints}              ← altijd
Entities: {data.entities}           ← altijd
```

**Nieuw (selectief op basis van feature.json):**

```
PROJECT CONTEXT:
Structure: {context.structure}                              ← altijd (compact)
Patterns: {context.patterns}                                ← altijd (compact)
Endpoints: {endpoints}                                      ← alleen als feature routes/ raakt
Entities: {data.entities}                                    ← alleen als feature models/ raakt
```

**Logica:** Check `feature.json` → `files[]` paths:

- Bevat `routes/` of `api/` of `pages/` → include endpoints
- Bevat `models/` of `schema` of `entities/` → include entities
- Geen match → skip die sectie, bespaar tokens

**Bestanden:**

| Bestand              | Wijziging                                                                        |
| -------------------- | -------------------------------------------------------------------------------- |
| `dev-build/SKILL.md` | FASE 0: PROJECT_CONTEXT conditioneel opbouwen op basis van feature.json files[]. |

### 2C. Dev-debug: gerichte agent context

**Wat:** De 3 parallelle investigation agents krijgen elk alleen de relevante subset van DEBUG_CONTEXT.

**Huidig:** Alle 3 agents krijgen de volledige context.

**Nieuw:**

| Agent                  | Context subset                                 |
| ---------------------- | ---------------------------------------------- |
| debug-error-tracer     | stack + patterns (hoe code werkt)              |
| debug-change-detective | structure (waar files zitten) + active feature |
| debug-context-mapper   | entities + endpoints + structure (data flow)   |

**Bestanden:**

| Bestand              | Wijziging                                                                           |
| -------------------- | ----------------------------------------------------------------------------------- |
| `dev-debug/SKILL.md` | FASE 0: bouw 3 gerichte context strings. FASE 2: geef elke agent zijn eigen subset. |

### 2D. thinking-decide → durableDecisions koppeling

**Wat:** Wanneer thinking-decide draait in de context van een feature (scope = feature), schrijf de gekozen optie + rationale als `durableDecision` in de feature.json.

**Bestanden:**

| Bestand                    | Wijziging                                                                                                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `thinking-decide/SKILL.md` | Na Step 3 (user kiest "Akkoord"): check of scope = feature. Zo ja: lees feature.json, push naar `durableDecisions[]`: `{ decision: title, rationale: rationale, date: today }`. |

**Vereist:** thinking-decide moet scope-aware worden (net als thinking-idea). Minimale toevoeging: check of `.project/features/` context actief is.

---

## FASE 3: Sync Logica Vereenvoudigen

Grotere refactor — de 3-file sync pattern die in 7 skills herhaald wordt.

### 3A. Shared sync protocol documenteren

**Wat:** Documenteer het herhaalde pattern als expliciet protocol in een shared bestand, zodat skills ernaar verwijzen i.p.v. het volledig uit te schrijven.

**Observatie:** 7 skills (dev-define, dev-build, dev-test, dev-refactor, team-test, game-define, game-build) hebben elk 20-40 regels sync-instructies die hetzelfde patroon volgen:

```
1. Read parallel: feature.json + backlog.html + project.json
2. Muteer in memory
3. Write parallel: feature.json (Write) + backlog.html (Edit) + project.json (Write)
```

**Nieuw shared bestand:** `shared/SYNC.md`

````markdown
# Project Sync Protocol

## 3-File Sync Pattern

Bij skill completion, sync feature state naar 3 bestanden:

### Stap 1: Read (parallel, skip als niet bestaat)

- `.project/features/{name}/feature.json`
- `.project/backlog.html`
- `.project/project.json`

### Stap 2: Muteer in memory

**feature.json:** update status, voeg skill-specifieke sectie toe.

**backlog.html:** parse JSON uit `<script id="backlog-data">`, update:

- feature status
- verwijder `inProgress`
- `data.updated` → nu

**project.json:** merge per sectie (zie DASHBOARD.md):

- `features[]` → status update
- `stack.packages` → push nieuwe (check op naam)
- `endpoints` → push nieuwe (check op method+path)
- `data.entities` → merge per entity (check op naam)
- `context` → conditioneel (alleen bij structurele impact)
- `architecture` → conditioneel (volg diagram conventies)

### Stap 3: Write (parallel)

- feature.json → Write tool
- backlog.html → Edit tool (keep `<script>` tags)
- project.json → Write tool

### Active Feature Cleanup

```bash
rm -f .project/session/active-{feature-name}.json
```
````

```

**Bestanden:**

| Bestand | Wijziging |
|---------|-----------|
| `shared/SYNC.md` | Nieuw bestand — sync protocol |
| 7 skills | Vervang inline sync-instructies door: "Volg `shared/SYNC.md` 3-File Sync Pattern. Skill-specifieke mutaties: {lijst}" |

**Voordeel:** Elke skill beschrijft alleen WAT het muteert, niet HOE de sync werkt. Minder duplicatie, minder kans op inconsistentie.

**Risico:** Skills worden afhankelijk van een shared bestand. Als SYNC.md wijzigt, raakt het alle 7 skills. Dit is een bewuste trade-off: single source of truth vs. self-contained skills.

---

## Implementatie Volgorde

```

FASE 1A: concept.pitch ← onafhankelijk, kan direct
FASE 1B: thinking → file refs ← onafhankelijk, kan parallel met 1A
FASE 1C: DEVINFO.md strippen ← onafhankelijk, kan parallel

FASE 2A: dev-define pitch ← vereist 1A
FASE 2B: dev-build selectief ← onafhankelijk van 1A
FASE 2C: dev-debug gerichte ctx ← onafhankelijk
FASE 2D: thinking-decide ← onafhankelijk

FASE 3A: shared/SYNC.md ← onafhankelijk, maar baat bij 1A/1B eerst

```

```

Parallelle tracks:

Track A: 1A → 2A
Track B: 1B (4 thinking skills)
Track C: 1C (DEVINFO.md alleen)
Track D: 2B + 2C + 2D (onafhankelijk)
Track E: 3A (na Track A+B stabiel)

```

## Verificatie

Per fase, test met sonarpoppy:

| Fase | Test |
|------|------|
| 1A | `/thinking-idea` op sonarpoppy → check dat `concept.pitch` geschreven wordt |
| 1B | `/thinking-idea` → check dat `.project/thinking/` bestand aangemaakt, entry in JSON compact |
| 1C | Lees nieuwe DEVINFO.md, vergelijk met wat skills werkelijk gebruiken |
| 2A | `/dev-define` op sonarpoppy → check dat pitch geladen wordt, niet full content |
| 2B | `/dev-build` op feature zonder routes → check dat endpoints niet in PROJECT_CONTEXT zit |
| 2C | `/dev-debug` → check agent prompts bevatten gerichte context subsets |
| 2D | `/thinking-decide` in feature scope → check durableDecisions in feature.json |
| 3A | `/dev-build` + `/dev-define` → check dat sync via SYNC.md protocol werkt |

## Niet in scope (bewuste keuze)

**Feature status single source of truth** — features[] in project.json en backlog.html samenvoegen tot één bron. Impact te groot: alle 7 sync-skills + dashboard UI + backlog server moeten herschreven worden. De huidige duplicatie is beheersbaar.

**architecture.description splitsen** — per-component files. Niet nodig zolang skills selectief lezen. Huidige groei (~2.5KB bij 12 componenten) is acceptabel.

**Volledige DEVINFO.md verwijderen** — het active-feature signaal is nog nuttig (backlog dashboard gebruikt het voor pulserende card indicator). Alleen de ongebruikte delen strippen.
```
