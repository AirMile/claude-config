---
name: dev-build
description: Build features with TDD or implementation-first per requirement. Use with /dev-build or /dev-build [feature-name] after /dev-define.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.5.1
  category: dev
---

# Build

**FASE 2** of the dev workflow: define -> **build** -> test

Auto-detects stack from CLAUDE.md, selects technique per requirement (TDD, Implementation First, or Implementation Only), builds sequentially.

**Trigger**: `/dev-build` or `/dev-build [feature-name]`

## Input

Reads `.project/features/{feature-name}/feature.json`: requirements (REQ-XXX), architecture, implementation order.

## Output

```
.project/features/{feature-name}/
└── feature.json    # Enriched with build, packages, tests.checklist sections
```

## Process

**Phase checklist** — vink af na elke fase, STOP NIET voor alle fases ✓ zijn:

- [ ] FASE 0: Context Loading
- [ ] FASE 1: Technique Mapping
- [ ] FASE 2: Execute Build
- [ ] FASE 2b: Regression Gate
- [ ] FASE 3A: Documentation
- [ ] FASE 3B: Project Sync
- [ ] FASE 3C: Wat hebben we gebouwd?
- [ ] FASE 3D: Scoped Commit

### FASE 0: Context Loading

**Capture git baseline** (eerste actie):

```bash
mkdir -p .project/session
git rev-parse HEAD > .project/session/pre-skill-sha.txt
```

**Detect stack:** lees CLAUDE.md `### Stack` sectie + `.claude/research/stack-baseline.md` (als beschikbaar). Fallback: `project.json.stack`.

**Project context** (skip als niet bestaat):

Lees `.project/project.json` en `.project/project-context.json`. Gebruik voor:

- Bestaande endpoints (voorkom dubbele routes)
- Bestaand DB schema (voorkom conflicten)
- Code patterns om te volgen
- Learnings uit eerdere features

**Load feature:**

If no feature name provided:

1. Parse `.project/backlog.html` (zie `shared/BACKLOG.md`). Filter `status === "DOING" && stage === "defined"` → suggest via **AskUserQuestion**
2. Fallback: list `.project/features/` met `feature.json`, let user select

Load `feature.json`. Extract: `requirements[]`, `buildSequence[]`, `files[]`, `testStrategy[]`, `architecture` (specifiek `registries[]` en `interfaces`). Als `clarifications[]` aanwezig: behandel als harde constraints tijdens implementatie (gray-area beslissingen van de user). Als `architecture.registries[]` aanwezig: gebruik als leidraad — nieuwe instances (endpoints, commands, entities) toevoegen aan het aangegeven registry-bestand, niet verspreiden over losse bestanden.

Niet gevonden → exit: "Run `/dev-define` eerst."

**Timing** (na feature laden):

AskUserQuestion:

```yaml
header: "Timing"
question: "Wanneer wil je deze build uitvoeren?"
options:
  - label: "Nu (Recommended)"
  - label: "Over 1 uur"
  - label: "Over 3 uur"
  - label: "Over 6 uur"
  - label: "Specifieke tijd"
    description: "Bijv. 01:00, 14:30"
multiSelect: false
```

"Specifieke tijd" → follow-up AskUserQuestion: "Hoe laat? (HH:MM, CET)"

Bij elke "later" keuze:

1. Bereken sleep seconds:
   ```bash
   # "Over X uur":
   SLEEP_SECONDS=$((X * 3600))
   # "Specifieke tijd":
   TARGET=$(TZ="Europe/Amsterdam" date -d "{HH:MM}" +%s)
   NOW=$(date +%s)
   SLEEP_SECONDS=$((TARGET - NOW))
   # Als negatief (tijd al voorbij): gebruik morgen
   if [ $SLEEP_SECONDS -lt 0 ]; then
     TARGET=$(TZ="Europe/Amsterdam" date -d "tomorrow {HH:MM}" +%s)
     SLEEP_SECONDS=$((TARGET - NOW))
   fi
   ```
2. Display: `INGEPLAND: build {feature} om {tijd CET}. Sleep tot dan...`
3. `Bash: sleep {SLEEP_SECONDS}`
4. Na wake-up: **AUTO_MODE actief** voor de rest van de skill.

**Auto-mode** (actief bij "later" timing keuze):

Alle AskUserQuestions worden overgeslagen met deze defaults:

| Beslispunt             | Default                                    | Reden                                    |
| ---------------------- | ------------------------------------------ | ---------------------------------------- |
| Dependency blocker     | **Stop + exit**                            | Bouwen op incomplete deps is verspilling |
| Workspace keuze        | **Nee, huidige directory**                 | Standaard veilig                         |
| Pre-existing regressie | **Doorgaan**                               | Was er al voor deze build                |
| WAT HEBBEN WE GEBOUWD  | **Schrijf naar feature.json, niet vragen** | Geen gebruiker aanwezig                  |

Bij dependency blocker exit: schrijf resultaat naar `.project/session/auto-result-{feature}.json`:

```json
{
  "feature": "{name}",
  "status": "BLOCKED",
  "reason": "dependency {dep} not DONE",
  "timestamp": "{ISO}"
}
```

Bij succesvolle afronding: schrijf resultaat:

```json
{
  "feature": "{name}",
  "status": "BUILT",
  "tests": "{pass}/{total}",
  "timestamp": "{ISO}"
}
```

**Dependency check:**

Skip als geen `depends[]` of leeg.

1. Parse `.project/backlog.html`. Niet gevonden → skip.
2. Per dependency: status moet `"DONE"` zijn.
3. Blockers gevonden → **AskUserQuestion** (Auto-mode: stop en exit, schrijf auto-result met status BLOCKED):
   - "Stop — werk eerst {dep} af (Recommended)" / "Toch doorgaan"
   - Stop → exit. Doorgaan → continue.

**Workspace setup** (optioneel):

Alleen tonen als we NIET al in een worktree zitten:

1. Check: `git rev-parse --show-toplevel` vs eerste pad uit `git worktree list --porcelain`
   → Verschillend: al in worktree → skip
2. AskUserQuestion (Auto-mode: skip, gebruik huidige directory):
   ```yaml
   header: "Workspace"
   question: "Wil je in een worktree werken voor deze build?"
   options:
     - label: "Nee, huidige directory (Recommended)"
       description: "Werk op de huidige branch"
     - label: "Ja, worktree aanmaken"
       description: "Geïsoleerde workspace — ideaal bij parallel werken"
   multiSelect: false
   ```
3. Ja → `EnterWorktree(name: "{feature-name}")`

**Tag backlog card als actief** (direct na feature laden):

Lees `.project/backlog.html` (als bestaat), zoek feature op naam → zet `"stage": "building"`, `data.updated` naar nu. Schrijf terug via Edit.

**Signal active feature** (na backlog update):

```bash
echo '{"feature":"{feature-name}","skill":"build","startedAt":"{ISO timestamp}"}' > .project/session/active-{feature-name}.json
```

**Display** feature overview:

```
FEATURE: {feature-name}

REQUIREMENTS:
- REQ-001: {description}
  ...

IMPLEMENTATION ORDER:
(from buildSequence, sorted by step)
```

### FASE 1: Technique Mapping

Assign per requirement:

- **TDD**: validation rules, business logic, calculations, complex conditions, testable math
- **Implementation First**: CRUD, middleware, config, wiring
- **Implementation Only**: pure styling/layout, visual/particle effects, static content, env config, prototype code — alleen wanneer automated tests geen waarde toevoegen. Verplichte reden: `visual-only`, `config-only`, of `prototype`

Display technique map als tabel. Proceed automatically — do NOT confirm with the user.

### FASE 2: Execute Build

For each buildSequence step:

**Parallel build check** (per step met >1 requirement):

1. Check file overlap: vergelijk `files[]` waar `requirements` arrays overlappen tussen REQs in deze step
2. **Geen overlap** → launch Agent per REQ (max 3 parallel). Elke agent krijgt: technique file content, relevante source files uit feature.json `files[]`, stack context (CLAUDE.md ### Stack), eerdere SYNC notes van deze build
3. **Wel overlap** → serieel bouwen (onderstaande stappen)
4. Parse agent resultaten via `BUILD_RESULT_START...BUILD_RESULT_END` markers, update feature.json per REQ

   ```
   BUILD_RESULT_START
   REQ: {id}
   Technique: {TDD | Implementation First | Implementation Only}
   Status: {GREEN | BLOCKED}
   Files modified: {lijst}
   Files created: {lijst}
   Test output: {PASS | FAIL met details}
   SYNC: {pattern/concept in file(s) — what, why, depends on}
   BUILD_RESULT_END
   ```

Bij steps met 1 requirement of bij overlap, voor elke requirement sequentieel:

1. Load technique: `Read(".claude/skills/dev-build/techniques/{technique}.md")`
2. **Read existing code**: lees alle bestanden uit feature.json `files[]` die `action: "modify"` hebben, plus 1 bestaand test bestand voor setup/teardown patronen (before/after hooks, DB lifecycle, import conventies).
3. Execute technique workflow
4. **Stack-aware enforcement**:
   - Strict types (TS: geen `any`; JS: validatie op boundaries)
   - Async error handling
   - Geen secrets in client code
   - **Code clarity**: descriptieve namen boven comments. Geen comments die herhalen wat de code al zegt. Wel comments voor: niet-obvioze "waarom" beslissingen, workarounds, en compatibility notes. Volg bestaande project comment-stijl.
   - **Code rules**: volg `shared/RULES.md` — Algemeen (R007-R008) + stack-specifieke secties. Bij twijfel: MUST_DO regels altijd, SHOULD_DO regels tenzij bewuste afwijking met reden.
5. **Update feature.json** na elke REQ: zet `requirements[].status` → `"built"` en voeg `technique` + `syncNote` toe. Bij Implementation Only: voeg ook `skipTestReason` toe (`visual-only`, `config-only`, of `prototype`). Dit bewaart voortgang bij context compaction.
6. Output per requirement:
   ```
   [REQ-XXX] {description}
   Technique: {TDD | Implementation First | Implementation Only}
   {technique-specific output}
   SYNC: {pattern/concept} in {file(s)} — {what, why, what depends on it}
   Progress: {done}/{total}
   ```

**Edge cases:**

- **Combined steps** (e.g. "REQ-002 + REQ-003"): build als één unit. Technique = die van het eerste REQ in de combinatie.
- **Already covered**: als een REQ al (deels) werkt door een eerder REQ → schrijf alleen tests, verify GREEN. Output: `RED: N/A (covered by REQ-XXX)`

**On blocker:** log in feature.json `build.blockers[]`, mark BLOCKED, ga door met andere requirements. Suggest `/thinking-decide` voor architecturele blockers.

**⚠️ NIET STOPPEN NA HET CODEREN — er zijn nog 6 fases te gaan (2b → 3D). Check de phase checklist bovenaan en ga door met FASE 2b: Regression Gate.**

### FASE 2b: Regression Gate

Na succesvolle afronding van alle requirements, run de **volledige test suite** met timeout (hangende tests = FAIL). Inclusief acceptance tests uit eerdere `/dev-verify` runs (`test/acceptance/*.test.js`) — deze beschermen tegen spec-regressies.

```bash
timeout 300 {stack-aware test command} --test-timeout 30000
```

**PASS:** Alle tests slagen → door naar FASE 3A.

```
REGRESSION CHECK: {total}/{total} PASS — geen regressies
```

**FAIL:** Andere feature tests falen — dit is een gate.

```
REGRESSION CHECK: {passed}/{total} PASS
REGRESSIES GEVONDEN:
- {test_file}.{test_name}: {reason}

Bestanden overlap: {lijst van bestanden die zowel door deze feature
als de falende tests worden gerefereerd}
```

Bij regressie:

1. Analyseer of de huidige feature de regressie veroorzaakt (check gedeelde files/imports)
2. Als JA: fix de regressie voordat je doorgaat. Re-run full suite na fix.
3. Als NEE (pre-existing failure): waarschuw gebruiker, laat kiezen via AskUserQuestion (Auto-mode: doorgaan, pre-existing):
   - "Fix eerst de regressie (Recommended)" — "Voorkomt dat de regressie doorschuift naar /dev-verify"
   - "Toch doorgaan" — "Regressie was er al voor deze build"
4. Max 2 fix-pogingen. Daarna: rapporteer als blocker en laat gebruiker beslissen.

**Skip:** Als er geen test bestanden bestaan, geen test runner geconfigureerd, of stack niet herkend.

```
REGRESSION CHECK: overgeslagen ({reden})
```

### FASE 3A: Documentation

**Build summary** — display:

```
BUILD COMPLETE: {feature}
========================
Techniques: TDD ({n}), Implementation First ({n}), Implementation Only ({n})
Tests: {passed}/{total} PASS
Files created: {count}
```

### FASE 3B: Project Sync

Volg `shared/SYNC.md` 3-File Sync Pattern. Skill-specifieke mutaties:

**feature.json**: `status → "DOING"`, `stage → "built"`, `files[]` → merge met actuele bestanden. Add: `build {}` (started, completed, techniques, testsPass, testsTotal, decisions), `packages[]`, `tests.checklist[]`. Bestaande secties NIET overschrijven. Note: `requirements[]` is al enriched in FASE 2 stap 4.

**tests.checklist[]** — per requirement minimaal 1 test item:

```json
{
  "id": 1,
  "title": "beschrijving van wat te verifiëren",
  "requirementId": "REQ-XXX",
  "steps": ["stap 1", "stap 2"],
  "expected": "verwacht resultaat",
  "status": "pending"
}
```

Richtlijnen:

- UI features: steps als browser-interacties (navigeer, klik, vul in)
- API features: steps als HTTP-verzoeken met concrete endpoints en payloads
- Expected = observable resultaat (response body, status code, zichtbaar effect)
- Voeg GEEN "run npm test" items toe — unit tests zijn al gedekt door de build

**Backlog**: `stage → "built"`, `data.updated` → nu. Status blijft `"DOING"`.

**Context**: update `context.structure` (overwrite), `context.routing` (overwrite), `context.patterns` (merge), `context.updated`. Skip als geen structurele impact.

**Architecture** (volg component-first model uit `shared/DASHBOARD.md`): update `architecture.components[]` — gebouwde componenten `status: "planned"` → `"done"`, vul `description` (korte functionele beschrijving, max 200 chars — wat doet dit component?), `src`, `test`, `connects_to` (uit werkelijke imports), `endpoints` (bijv. `"POST /api/auth/login"`), `entities` (gebruikte model namen), `feature` (huidige feature naam). Nieuwe componenten die tijdens build zijn ontstaan: push met alle velden inclusief `feature`. Skip als geen structurele impact.

**Learning Extraction** — extracteer projectbrede learnings:

Lees de zojuist geschreven `feature.json` `build.decisions[]` en evalueer:

- Architecturale keuzes die andere features beïnvloeden → type `pattern`
- Ontdekte pitfalls of workarounds → type `pitfall`

**Filter**: alleen items die relevant zijn buiten deze ene feature. Skip feature-specifieke implementatiedetails.

**Append** naar `project-context.json` → `learnings[]`:

```json
{
  "date": "YYYY-MM-DD",
  "feature": "{feature-name}",
  "type": "pattern|pitfall",
  "summary": "Max 200 chars samenvatting"
}
```

Check op duplicaten (zelfde feature + zelfde summary → skip). Geen learnings gevonden → skip.

### FASE 3C: Wat hebben we gebouwd?

**STOP — ga NIET door naar de commit zonder deze fase volledig af te ronden.** (Auto-mode: schrijf uitleg naar `build.explanation` in feature.json, skip begripscheck, ga door naar commit.)

Display een visuele separator:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WAT HEBBEN WE GEBOUWD?
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Stap 1 — Uitleg displayen (verplicht, niet overslaan)**

De gebruiker moet begrijpen hoe de feature werkt voor goede beslissingen in test- en refactor-fases. Display de volgende uitleg alsof je het aan een student uitlegt:

- **Wat doet het?**: 1-2 zinnen zoals je het aan een vriend zou uitleggen. Beschrijf wat de gebruiker ziet en kan doen — geen technische termen.
- **Voorbeeld**: 1 concreet scenario in 2-3 zinnen. UI feature: "Stel je voor: je klikt op X, vult Y in, ziet Z." Backend/API feature: "Er komt een verzoek binnen met X, het systeem doet Y, en stuurt Z terug."
- **Hoe werkt het?**: 1 ASCII diagram dat het hele verhaal vertelt. Gebruik blokjes en pijlen met korte labels. De gebruiker moet het diagram kunnen lezen zonder uitleg ernaast. Voorbeeld: `[Gebruiker klikt "Opslaan"] → [Formulier checkt invoer] → [Server slaat op] → [✓ Bevestiging]`

**Stap 2 — Begripscheck (verplicht, niet overslaan)**

**BELANGRIJK**: Display **minimaal 15 lege regels** (`\n`) na de uitleg, VÓÓR de AskUserQuestion. Dit is nodig zodat de modal-popup de uitleg niet overlapt en de gebruiker alle tekst kan lezen.

**AskUserQuestion** na de witruimte:

Vraag: "Snap je hoe de feature werkt?"
Opties: "Ja, helder" / "Leg het uitgebreider uit" / "Ik heb een vraag"

Follow-up loop tot "Ja, helder". Sla uitleg op als `build.explanation` in feature.json (targeted Edit).

### FASE 3D: Scoped Commit

**Strategie**: stage alleen files die door deze build zijn aangemaakt of gewijzigd. Laat pre-existing dirty files met rust.

```bash
git status --porcelain
```

Categoriseer elke file:

1. **Check baseline**: vergelijk met de SHA uit `.project/session/pre-skill-sha.txt`:
   ```bash
   git diff --name-only $(cat .project/session/pre-skill-sha.txt) HEAD 2>/dev/null
   ```
   Als diff leeg is (geen mid-build commits): gebruik `git diff --name-only $(cat .project/session/pre-skill-sha.txt)` (zonder HEAD) voor unstaged changes, plus `git ls-files --others --exclude-standard` voor nieuwe bestanden.
   Bestanden die NIET door deze build zijn gewijzigd EN al dirty waren → PRE-EXISTING, niet stagen.
2. **Nieuwe/gewijzigde bestanden van deze feature** (bestanden uit `feature.json files[]`, test files, feature.json zelf) → `git add`.
3. **Untracked bestanden** die niet bij de feature horen → niet stagen.
4. **.project/ bestanden** (project.json, backlog.html, project-context.json) → probeer toe te voegen. Als skip-worktree of sparse-checkout dit blokkeert: accepteer en ga door (deze bestanden zijn lokaal bijgewerkt maar worden niet gecommit).

```bash
git commit -m "build({feature}): {n} requirements ({tdd} TDD, {impl} impl-first)"
```

Clean up: `rm -f .project/session/pre-skill-sha.txt .project/session/active-{feature-name}.json`

**Output:**

```
BUILD COMPLETE: {feature}
========================
Techniques: TDD ({n}), Implementation First ({n}), Implementation Only ({n})
Tests: {passed}/{total} PASS
Files created: {count}

Next steps:
  1. /dev-verify {feature} → hybrid test verificatie
  2. /dev-debug → als er onverwachte failures zijn
```

## Test Output Parsing

Condense test output:

**PASS:** `TESTS: {n}/{n} PASS ({time})`

**FAIL:**

```
TESTS: {passed}/{total} PASS ({time})
FAILED:
- {file}:{line} - {reason <50 chars}
```
