---
name: dev-build
description: Build features with TDD or implementation-first per requirement. Use with /dev-build or /dev-build [feature-name] after /dev-define. Voor PAGE/COMPONENT-features leest dev-build design.pages[]/design.components[] als visuele spec-bron indien aanwezig.
reads: [feature.requirements]
writes: [feature.requirements, feature.build, backlog.status, learnings]
metadata:
  author: mileszeilstra
  version: 1.8.0
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

**Fase tracking** — eerste actie van de skill: roep `TaskCreate` aan met deze 6 items (status `pending`), daarna gebruik `TaskUpdate` om per fase `in_progress` te zetten aan begin en `completed` aan einde. Bij context compaction blijft de task list zichtbaar — geen risico op vergeten fases.

1. FASE 0: Context Loading
2. FASE 1: Technique Mapping
3. FASE 2: Execute Build
4. FASE 2b: Regression Gate
5. FASE 3A: Project Sync
6. FASE 3B: Scoped Commit

### FASE 0: Context Loading

> **Todo**: roep `TaskCreate` aan met de 6 fase-items (zie boven). Markeer FASE 0 → `in_progress` via `TaskUpdate`.

**Capture git baseline** (eerste actie):

Bepaal eerst de repo root. Als CWD geen git-repo is, zoek de repo via de feature-locatie:

```bash
REPO=$(git rev-parse --show-toplevel 2>/dev/null) || \
  REPO=$(cd "$(dirname "$(find . -maxdepth 6 -name 'feature.json' -path '*/.project/features/*' | head -1)")/../../.." && pwd)
```

Geen repo gevonden → exit: "Geen git-repo gedetecteerd; /dev-build vereist een tracked project."

Bewaar `$REPO` — alle latere git-commando's gebruiken `git -C "$REPO" ...`.

```bash
mkdir -p "$REPO/.project/session"
find "$REPO/.project/session" -maxdepth 1 \( -name "active-*.json" -o -name "pre-skill-*.txt" \) -mtime +1 -delete 2>/dev/null
git -C "$REPO" rev-parse HEAD > "$REPO/.project/session/pre-skill-sha.txt"
```

**Detect stack:** lees CLAUDE.md `### Stack` sectie + `.claude/research/stack-baseline.md` (als beschikbaar). Fallback: `project.json.stack`.

**Project context** (skip als niet bestaat):

Lees `.project/project.json` en `.project/project-context.json`. Gebruik voor:

- Bestaande endpoints (voorkom dubbele routes)
- Bestaand DB schema (voorkom conflicten)
- Code patterns om te volgen
- Learnings uit eerdere features

**Learnings load** (via [shared/LEARNINGS-LOAD.md](../shared/LEARNINGS-LOAD.md)):

Configuratie:

```
scopes: [component]
pitfall-prefix: true
global-memory: true
current-feature: <feature-name>
```

Toon de geladen output. Pitfall-prefix sectie + component-scoped patterns geven context voor de build (geen constraint — bij twijfel ga uit van root cause, niet pattern-match).

Bewaar de geladen learnings voor FASE 1 (Technique Mapping).

**COMPONENT Build Detection** (na feature.json load):

Als `feature.type === "COMPONENT"` (of backlog-item type is COMPONENT):

1. Bepaal `COMPONENT_SCOPE`:
   - Check `feature.json#architecture.scope` of top-level `scope` veld
   - Fallback: check `project.json#design.components[]` — match op naam → lees `scope`
   - Fallback: vraag user via AskUserQuestion: `"Wat is de scope van dit component?"` (atomic/section/layout)

2. Bepaal `COMPONENT_OUTPUT_PATH` op basis van scope en framework (zie FASE 2):
   - `atomic` → `src/components/ui/{Name}.tsx`
   - `section` → `src/components/{Name}.tsx`
   - `layout` → `src/components/{Name}.tsx` (+ auto-patch `app/layout.tsx` na build)

3. Sla op als `IS_COMPONENT_BUILD = true`, `COMPONENT_SCOPE`, `COMPONENT_OUTPUT_PATH`.

**Load feature:**

Ready queue (alleen als geen feature-naam via CLI opgegeven):

Parse `.project/backlog.html`. Bereken per DEFINED feature of alle `dependencies[]` `status === "DONE"` hebben (of dep-lijst leeg is). Toon vóór de feature-selectie:

```
Ready om te bouwen:
  ✓ auth-login        P1  (geen deps)
  ✓ user-profile      P2  deps: [auth-login ✓]

Geblokkeerd:
  ✗ payment-flow      P1  wacht op: [stripe-integration — DOING]
  ✗ checkout          P2  wacht op: [payment-flow ✗, cart — TODO]
```

- Toon "Geblokkeerd" sectie alleen als er geblokkeerde features zijn
- Als geen DEFINED features bestaan → "Geen features klaar om te bouwen." → exit

If no feature name provided:

1. Parse `.project/backlog.html` (zie `shared/BACKLOG.md`). Filter `status === "DEFINED"` → suggest via **AskUserQuestion** (ready features bovenaan)
2. Fallback: list `.project/features/` met `feature.json`, let user select

Load `feature.json`. Extract: `requirements[]`, `buildSequence[]`, `files[]`, `testStrategy[]`, `architecture` (specifiek `registries[]` en `interfaces`). Als `clarifications[]` aanwezig: behandel als harde constraints tijdens implementatie (gray-area beslissingen van de user). Als `architecture.registries[]` aanwezig: gebruik als leidraad — nieuwe instances (endpoints, commands, entities) toevoegen aan het aangegeven registry-bestand, niet verspreiden over losse bestanden.

Niet gevonden → exit: "Run `/dev-define` eerst."

**Dependency check:**

Skip als geen `depends[]` of leeg.

1. Parse `.project/backlog.html`. Niet gevonden → skip.
2. Per dependency: status moet `"DONE"` zijn.
3. Blockers gevonden → **AskUserQuestion**:
   - "Stop — werk eerst {dep} af (Recommended)" / "Toch doorgaan"
   - Stop → exit. Doorgaan → continue.

**Workspace setup:**

Alleen tonen als we NIET al in een worktree zitten:

1. Check: `git rev-parse --show-toplevel` vs eerste pad uit `git worktree list --porcelain`
   → Verschillend: al in worktree → skip
2. AskUserQuestion:
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

> **Branch-naming**: `EnterWorktree` maakt branch `worktree-{feature-name}` (NIET `{feature-name}`). Vervolgskills (`dev-verify`, `dev-debug`, `dev-refactor` single-mode) detecteren deze worktree automatisch via `shared/WORKTREE.md` en switchen erin. Voor merge/cleanup gebruik je `/core-merge` of handmatig `git worktree remove --force` + `git branch -D worktree-{feature-name}`.

**Tag backlog card als actief** (direct na feature laden):

Lees `.project/backlog.html` (als bestaat), zoek feature op naam → zet `"status": "DOING"`, verwijder `transition` veld als het aanwezig is (niet verplicht), `updated` naar huidige datum (overgang DEFINED → DOING bij build-start). Schrijf terug via Edit.

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

**Risk-check (alleen als backlog feature `risk >= 4`):**

Als de geladen backlog-feature een `risk`-score van 4 of 5 heeft, toon deze waarschuwing vóór FASE 1:

```
⚠ HOOG RISICO — Complexiteit {risk}/5

Overweeg vóór de bouw:
- Zijn alle dependencies beschikbaar (status DONE)?
- Is de feature-definitie volledig (alle REQs helder)?
- Bouw in kleine stappen — commit na elke werkende REQ
```

### FASE 1: Technique Mapping

> **Todo**: markeer FASE 0 → `completed`, FASE 1 → `in_progress`.

**REMOVED filter**: Requirements met `deltaOp === "REMOVED"` overslaan — geen technique toewijzen, niet tonen in technique map tabel.

Assign per requirement:

- **TDD**: validation rules, business logic, calculations, complex conditions, testable math
- **Implementation First**: CRUD, middleware, config, wiring
- **Implementation Only**: pure styling/layout, visual/particle effects, static content, env config, prototype code — alleen wanneer automated tests geen waarde toevoegen. Verplichte reden: `visual-only`, `config-only`, of `prototype`

**Pitfall overlap check**: voor elke requirement, vergelijk met de pitfall-lijst uit FASE 0. Bij duidelijke thematische overlap (zelfde domein, zelfde type bug-risico) → log expliciet welke pitfall geraakt wordt en hoe deze build het voorkomt. Geen forcing — alleen markeren waar relevant.

Display technique map als tabel. Proceed automatically — do NOT confirm with the user.

### FASE 2: Execute Build

> **Todo**: markeer FASE 1 → `completed`, FASE 2 → `in_progress`.

**COMPONENT output-pad routing** (alleen als `IS_COMPONENT_BUILD = true`):

Overschrijf `feature.json files[]` paden met de definitieve output-paden op basis van `COMPONENT_SCOPE`:

| Scope     | Hoofd-component bestand        | Demo-page                             |
| --------- | ------------------------------ | ------------------------------------- |
| `atomic`  | `src/components/ui/{Name}.tsx` | `app/_dev/components/{name}/page.tsx` |
| `section` | `src/components/{Name}.tsx`    | `app/_dev/components/{name}/page.tsx` |
| `layout`  | `src/components/{Name}.tsx`    | `app/_dev/components/{name}/page.tsx` |

Genereer de demo-page naast het component-bestand. De demo-page toont een variant-matrix van alle `variants × sizes × states`:

```tsx
// app/_dev/components/{name}/page.tsx (gitignored via _dev/)
export default function {Name}Demo() {
  return (
    <main aria-label="{Name} demo">
      {variants.map(v => sizes.map(s => states.map(state => (
        <{Name} key={`${v}-${s}-${state}`} variant={v} size={s} {...stateProps[state]}>
          {v}/{s}/{state}
        </{Name}>
      ))))}
    </main>
  );
}
```

Voeg `app/_dev/` toe aan `.gitignore` als het er nog niet in staat (check eerst):

```bash
grep -q "_dev/" .gitignore 2>/dev/null || echo "app/_dev/" >> .gitignore
```

**Variant visual spec (G1 — alleen als component >1 variant heeft):**

Conditie: `feature.json.requirements` bevat `cva(...)` met meer dan één variant-sleutel of meer dan één waarde per sleutel. Skip voor 1-variant components.

**Pre-flight (Playwright runner)**: Check `package.json` op `@playwright/test` devDep. Bij ontbreken:

```yaml
header: "Playwright runner"
question: "Variant visual specs vereisen @playwright/test. Hoe verder?"
options:
  - label: "Run /core-setup playwright (Recommended)"
    description: "Installeert daemon + runner + base config"
  - label: "Skip variant specs"
    description: "Sla deze stap over, ga door met build"
multiSelect: false
```

Bij **Skip** → spring naar "Layout auto-patch" sectie hieronder.

Genereer `.project/playwright-runs/component-{name}.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

const variants = { variants_array }; // bijv. ['default', 'destructive', 'outline']
const sizes = { sizes_array }; // bijv. ['sm', 'md', 'lg'] — [] als geen size-variant

test.beforeEach(async ({ page }) => {
  await page.goto("http://localhost:3000/_dev/components/{name}");
  await page.waitForLoadState("networkidle");
});

for (const variant of variants) {
  for (const size of sizes.length ? sizes : [null]) {
    const label = size ? `${variant}-${size}` : variant;
    test(`{name} — ${label}`, async ({ page }) => {
      const selector = size
        ? `[data-variant="${variant}"][data-size="${size}"]`
        : `[data-variant="${variant}"]`;
      await expect(page.locator(selector).first()).toHaveScreenshot(
        `{name}-${label}.png`,
        { maxDiffPixelRatio: 0.02 },
      );
    });
  }
}
```

Genereer `.project/playwright-runs/playwright.config.ts` (zie `shared/PLAYWRIGHT.md → Runner Mode`).

Eerste run (baseline aanmaken):
`npx playwright test .project/playwright-runs/component-{name}.spec.ts --update-snapshots`

Volgende runs (regressie check):
`npx playwright test .project/playwright-runs/component-{name}.spec.ts`
→ FAIL = visuele regressie in een specifieke variant/size combinatie.

Toon na eerste succesvolle run:

```
VARIANT VISUAL SPEC
  Component:  {Name}
  Variants:   {N} ({variant-namen})
  Sizes:      {M} ({size-namen}) / n.v.t.
  Spec:       .project/playwright-runs/component-{name}.spec.ts
  Baselines:  .project/playwright-runs/__screenshots__/ ({N×M} PNG's)
```

**Layout auto-patch** (alleen als `COMPONENT_SCOPE === "layout"`):

Na het genereren van het component-bestand: voeg import + render toe aan `app/layout.tsx` (of framework-equivalent). Conflict-detectie: check of de component-naam al geïmporteerd is. Bij conflict → toon diff en vraag user via AskUserQuestion: "Patchen (Recommended)" | "Handmatig toepassen". Geen conflict → patch direct. Toon:

```
AUTO-PATCH layout.tsx: import {Name} van "{pad}" toegevoegd + <{Name} /> in render.
```

For each buildSequence step:

**REMOVED filter per step**: filter `step.requirements` → verwijder IDs waarvan `feature.json.requirements[id].deltaOp === "REMOVED"`. Als step leeg na filter → skip step, ga door naar volgende.

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

1. Load technique:
   - **TDD** → `Read(".claude/skills/dev-build/techniques/tdd.md")`
   - **Implementation First** → `Read(".claude/skills/dev-build/techniques/implementation-first.md")`
   - **Implementation Only** → geen file laden (techniek = geen tests; `skipTestReason` verplicht invullen)
2. **Read existing code**: lees alle bestanden uit feature.json `files[]` die `action: "modify"` hebben, plus 1 bestaand test bestand voor setup/teardown patronen (before/after hooks, DB lifecycle, import conventies).
3. Execute technique workflow
4. **Stack-aware enforcement**:
   - **Code clarity**: descriptieve namen boven comments. Wel comments voor: niet-obvioze "waarom" beslissingen, workarounds, compatibility notes. Volg bestaande project comment-stijl.
   - **Code rules**: volg `shared/RULES.md` — Algemeen (R007-R009) + stack-specifieke secties. Bij twijfel: MUST_DO regels altijd, SHOULD_DO regels tenzij bewuste afwijking met reden.
5. **Update feature.json** na elke REQ: zet `requirements[].status` → `"built"` en voeg `technique` + `syncNote` toe. Bij Implementation Only: voeg ook `skipTestReason` toe (`visual-only`, `config-only`, of `prototype`). Dit bewaart voortgang bij context compaction.
6. Output per requirement:
   ```
   REQ-XXX: {description}
   Technique: {TDD | Implementation First | Implementation Only}
   {technique-specific output}
   SYNC: {pattern/concept} in {file(s)} — {what, why, what depends on it}
   Progress: {done}/{total}
   ```

**Edge cases:**

- **Combined steps** (e.g. "REQ-002 + REQ-003"): build als één unit. Technique = die van het eerste REQ in de combinatie.
- **Already covered**: als een REQ al (deels) werkt door een eerder REQ → schrijf alleen tests, verify GREEN. Output: `RED: N/A (covered by REQ-XXX)`

**On blocker:** log in feature.json `build.blockers[]`, mark BLOCKED, ga door met andere requirements. Suggest `/thinking-decide` voor architecturele blockers.

### FASE 2b: Regression Gate

> **Todo**: markeer FASE 2 → `completed`, FASE 2b → `in_progress`.

Na succesvolle afronding van alle requirements, run de **volledige test suite** met timeout (hangende tests = FAIL). Inclusief acceptance tests uit eerdere `/dev-verify` runs (`test/acceptance/*.test.js`) — deze beschermen tegen spec-regressies.

Gebruik de Bash tool met `timeout: 300000` parameter (milliseconden) — niet het shell `timeout` commando (werkt niet op macOS).

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
3. Als NEE (pre-existing failure): waarschuw gebruiker, laat kiezen via AskUserQuestion:
   - "Fix eerst de regressie (Recommended)" — "Voorkomt dat de regressie doorschuift naar /dev-verify"
   - "Toch doorgaan" — "Regressie was er al voor deze build"
4. Max 2 fix-pogingen. Daarna: rapporteer als blocker en laat gebruiker beslissen.

**Skip:** Als er geen test bestanden bestaan, geen test runner geconfigureerd, of stack niet herkend.

```
REGRESSION CHECK: overgeslagen ({reden})
```

### FASE 3A: Project Sync

> **Todo**: markeer FASE 2b → `completed`, FASE 3A → `in_progress`.

Volg `shared/SYNC.md` 3-File Sync Pattern. Skill-specifieke mutaties:

**feature.json**: `status → "DOING"`, `files[]` → merge met actuele bestanden. Add: `build {}` (started, completed, techniques, testsPass, testsTotal, decisions), `packages[]`, `tests.checklist[]`. Bestaande secties NIET overschrijven. Note: `requirements[]` is al enriched in FASE 2 stap 4.

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

**Backlog**: `data.updated` → nu. Status blijft `"DOING"`.

**Context**: update `context.structure` (overwrite), `context.routing` (overwrite), `context.patterns` (merge), `context.updated`. Skip als geen structurele impact.

**Architecture** (volg component-first model uit `shared/DASHBOARD.md`): update `architecture.components[]` — gebouwde componenten `status: "planned"` → `"done"`, vul `description` (korte functionele beschrijving, max 200 chars — wat doet dit component?), `src`, `test`, `connects_to` (typed edges `{ to, type }` uit werkelijke imports en runtime IO — `calls` voor function/HTTP calls, `reads`/`writes` voor DB of state IO, `depends_on` voor pure library/config dependencies), `endpoints` (bijv. `"POST /api/auth/login"`), `entities` (gebruikte model namen), `feature` (huidige feature naam). Nieuwe componenten die tijdens build zijn ontstaan: push met alle velden inclusief `feature`. Skip als geen structurele impact.

**Routes** (`architecture.routes[]`): bevestig routes die tijdens build daadwerkelijk geïmplementeerd zijn — controleer `auth` veld klopt met de werkelijke middleware/guard (`"public" | "user" | "admin"`), update `purpose` als de pagina nu beter beschreven kan worden. Nieuwe routes die tijdens build zijn ontstaan: push `{ path, purpose, auth, feature }`. Endpoints in `endpoints[]` met daadwerkelijke auth-check: migreer `auth: false` → `"public"` en `auth: true` → `"user"` (of `"admin"` bij role-check).

**PAGE-seeding** (safety net — frontend projects only):

Als tijdens build nieuwe page-routes zijn ontstaan die **niet al in `/dev-define` zijn geseedd** (check `data.features.find(f => f.source === "/dev-define" && f.parentFeature === "{feature-name}")`), detecteer ze via dezelfde patronen als dev-define en vraag de user:

```yaml
header: "Nieuwe pages gebouwd"
question: "Tijdens build zijn {N} pages gebouwd die nog geen eigen backlog-todo hebben. Toevoegen voor de design → convert → check pipeline?"
options:
  - label: "Ja (Recommended)"
    description: "Voeg PAGE-todo toe per nieuw gebouwde page"
  - label: "Nee"
    description: "Overslaan"
multiSelect: false
```

Per bevestigde page → voeg toe aan `data.features[]` met `source: "/dev-build"`, `parentFeature: "{feature-name}"`, `phase: "P3"`, `status: "TODO"`, `type: "PAGE"`, `auto: true`.

**COMPONENT design sync** (alleen als `IS_COMPONENT_BUILD = true`):

Na succesvolle build: update `project.json#design.components[]` — zoek op naam, zet `status: "BLT"`. Niet gevonden → voeg toe met status `"BLT"`, scope `COMPONENT_SCOPE`. Update ook `project-context.json#components[]` inventory: check op naam → nieuw: push `{ name, src: COMPONENT_OUTPUT_PATH, exports: ["{Name}"], variants, sizes }` → bestaand: update `src`.

**Sub-component Reuse-Discovery** (frontend projects only — skip voor non-frontend):

Na generatie van alle requirement-code: scan de gegenereerde bestanden op herhalende, uitbreid-bare sub-patterns die als los component herbruikbaar zouden zijn buiten deze feature. Detecteer:

- Inline JSX-blocks die dezelfde structuur herhalen (≥2x in hetzelfde bestand of ≥1x in meerdere bestanden van deze feature)
- Stuk code dat een duidelijke visuele of functionele eenheid vormt met eigen props en rendering

**Dedup**: check `project.json#design.components[]` en `project-context.json#components[]` op naam-overlap. Check `feature.json#suggestionsLog[]` — eerder rejected van `dev-build`? → skip. Van andere skill? → mag voorgesteld worden.

Gevonden kandidaten → AskUserQuestion:

```yaml
header: "Sub-components gevonden"
question: "Tijdens code-generatie zijn herbruikbare sub-patterns ontstaan. Promoten als COMPONENT-todo?"
options:
  - label: "{naam} — {korte beschrijving}", description: "Maak COMPONENT-todo (scope: atomic/section)"
  - label: "..." (één per kandidaat)
  - label: "Overslaan", description: "Inline laten"
multiSelect: true
```

Per geaccepteerd: append backlog + `design.components[]` (status: IDEA) + `feature.json#suggestionsLog[]` (accepted).
Per afgewezen: log in `suggestionsLog[]` (rejected).

**PAGE-suggesties via COMPONENT-links** (alleen als `IS_COMPONENT_BUILD = true`):

Als het gebouwde component linkt naar routes (via `<Link href="...">` of `router.push(...)`) die niet in `project.json#design.pages[]` of `backlog.html` bestaan: toon suggestie:

```
Onbekende route gevonden: {route}
Wil je een PAGE-todo toevoegen voor {route}?
```

AskUserQuestion: "Ja, PAGE-todo toevoegen (Recommended)" | "Overslaan". Per geaccepteerde route → voeg PAGE-todo toe aan backlog.

**Learning extraction** (na feature.json sync): schrijf naar `project-context.json learnings[]` (append-only, identiek formaat als `dev-verify`/`dev-refactor`):

- `build.decisions[]` → `type: "pattern"` (architecturale keuze gemaakt)
- `build.blockers[]` waar de blocker opgelost is (niet meer BLOCKED aan einde build) → `type: "pitfall"`

```json
{
  "date": "...",
  "feature": "{naam}",
  "type": "pattern|pitfall",
  "source": "extracted",
  "summary": "..."
}
```

Alleen schrijven als er decisions of opgeloste blockers aanwezig zijn — geen lege entries.

### FASE 3B: Scoped Commit

> **Todo**: markeer FASE 3A → `completed`, FASE 3B → `in_progress`.

**Strategie**: stage alleen files die door deze build zijn aangemaakt of gewijzigd. Laat pre-existing dirty files met rust.

**Stap 0: Pre-commit diagnostics** (stack-aware):

- Lees `package.json` → check `scripts` op keys die matchen op `typecheck|type-check|tsc|lint`
- Python project (geen package.json): check op aanwezigheid van `mypy.ini` of `[tool.mypy]` in `pyproject.toml`
- Geen match gevonden → skip stilzwijgend

Bij match: run gevonden script(s) (meerdere matches → parallel) via Bash tool met `timeout: 60000`:

- **PASS** → toon `DIAGNOSTICS: PASS`, door naar git status
- **FAIL** → toon errors (max 30 regels) + AskUserQuestion:
  - `"Fix eerst (Recommended)"` — stop FASE 3C, geen commit; user fixt errors en herstart de skill
  - `"Toch committen"` — door naar git add + commit; voeg `[diagnostics-warnings]` toe aan commit message

```bash
git -C "$REPO" status --porcelain
```

Categoriseer elke file:

1. **Check baseline**: vergelijk met de SHA uit `$REPO/.project/session/pre-skill-sha.txt`:
   ```bash
   git -C "$REPO" diff --name-only $(cat "$REPO/.project/session/pre-skill-sha.txt") HEAD 2>/dev/null
   ```
   Als diff leeg is (geen mid-build commits): gebruik `git -C "$REPO" diff --name-only $(cat "$REPO/.project/session/pre-skill-sha.txt")` (zonder HEAD) voor unstaged changes, plus `git -C "$REPO" ls-files --others --exclude-standard` voor nieuwe bestanden.
   Bestanden die NIET door deze build zijn gewijzigd EN al dirty waren → PRE-EXISTING, niet stagen.
2. **Nieuwe/gewijzigde bestanden van deze feature** (bestanden uit `feature.json files[]`, test files, feature.json zelf) → `git add`.
3. **Untracked bestanden** die niet bij de feature horen → niet stagen.
4. **.project/ bestanden** (project.json, backlog.html, project-context.json) → probeer toe te voegen. Als skip-worktree of sparse-checkout dit blokkeert: accepteer en ga door (deze bestanden zijn lokaal bijgewerkt maar worden niet gecommit).

```bash
git -C "$REPO" commit -m "build({feature}): {n} requirements ({tdd} TDD, {impl} impl-first)"
```

Clean up: `rm -f "$REPO/.project/session/pre-skill-sha.txt" "$REPO/.project/session/active-{feature-name}.json"`

**Output:**

```
BUILD COMPLETE: {feature}
========================
Techniques: TDD ({n}), Implementation First ({n}), Implementation Only ({n})
Tests: {passed}/{total} PASS
Files created: {count} | modified: {count}

Next steps:
  1. /dev-verify {feature} → hybrid test verificatie
  2. /dev-debug → als er onverwachte failures zijn
```

**Worktree reminder** — voeg één extra blok toe aan de output als de huidige branch matcht `worktree-*` pattern (`git -C "$REPO" branch --show-current`):

```
💡 Worktree actief: {worktree_path}
   Volgende skills (/dev-verify, /dev-refactor, /dev-debug) starten in een NIEUWE chat —
   ze detecteren deze worktree automatisch en switchen erin.
   Voor merge/cleanup: /core-merge {feature}
```

> **Todo**: markeer FASE 3B → `completed`. Alle 6 fases moeten nu `completed` zijn.

## Test Output Parsing

Condense test output:

**PASS:** `TESTS: {n}/{n} PASS ({time})`

**FAIL:**

```
TESTS: {passed}/{total} PASS ({time})
FAILED:
- {file}:{line} - {reason <50 chars}
```
