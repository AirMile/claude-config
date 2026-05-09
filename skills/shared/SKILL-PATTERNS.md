# Skill Authoring Patterns

Conventions for recurring patterns in skill workflows. Used by `core-create` and `core-edit` when building or modifying skills.

---

## ASCII Diagram

**When:** A skill has a complex flow, architecture, decomposition, or multi-path decision that is hard to convey in text alone.

**How:** Add an instruction at the relevant phase telling Claude WHAT to diagram and WHEN. Do not hardcode diagrams in SKILL.md — the instruction should describe the diagram type so Claude generates it with actual project data.

**Instruction template:**

```markdown
Generate an ASCII [diagram type] showing [what to visualize].
```

**Diagram types by use case:**

| Use case              | Diagram type         | Example skills              |
| --------------------- | -------------------- | --------------------------- |
| Architecture/layers   | Component diagram    | dev-define, frontend-design |
| Multi-step workflow   | Flowchart            | dev-build, dev-verify       |
| Feature decomposition | Tree                 | project-plan                |
| State transitions     | State machine        | game-define                 |
| Parallel processes    | Architecture diagram | team-review                 |
| Decision flow         | Decision tree        | thinking-decide             |

**Placement:** After the phase where the relevant information is gathered, before execution continues.

---

## Interview Checkpoint

**When:** A skill gathers 3 or more inputs (via AskUserQuestion or context detection) before starting execution.

**How:** Insert a CHECKPOINT between the gathering phases and the execution phases. The checkpoint presents all collected input as a structured table and asks for confirmation before proceeding.

**Template:**

```markdown
### CHECKPOINT: [Summary title]

Present all gathered information as a structured table:

| Aspect | Value             |
| ------ | ----------------- |
| [key]  | [collected value] |
| ...    | ...               |

Ask via AskUserQuestion: "Klopt dit overzicht? Wil je iets aanpassen?"

- "Ga door (Recommended)" — proceed to execution
- "Aanpassen" — return to relevant question
```

**Rules:**

- Table aspects should match the skill's domain (e.g., Stack/Type for setup, Mechanics/Visuals for game design)
- First option is always "proceed" and marked as Recommended
- Keep the table concise — group related items if needed
- Place AFTER all gathering, BEFORE first execution phase

---

## Next Steps

**When:** Een pipeline skill heeft een completion report (laatste fase output).

**How:** Voeg een `Next steps:` blok toe aan de completion output dat de gebruiker wijst naar de volgende skill(s) in de pipeline. Dit voorkomt dat de gebruiker zelf moet bedenken wat de volgende stap is.

**Template:**

```markdown
Next steps:

1. /{pipeline}-{next-verb} {feature} → {korte beschrijving}
2. /{pipeline}-{alt-verb} → {wanneer relevant}
```

**Rules:**

- Eerste optie = meest waarschijnlijke volgende stap in de pipeline
- Tweede optie = alternatief pad (bijv. debug bij failures)
- Gebruik conditionele blokken als de next step afhangt van het resultaat (PASS vs FAIL)
- Verwijs naar concrete skill namen, niet generieke instructies
- Plaats BINNEN de completion output, na de samenvatting

---

## Pass Paths, Not Content

**When:** A skill spawns 2+ sub-agents that need to read project files (e.g., parallel scanners, reviewers, researchers).

**How:** The orchestrator discovers file paths (cheap: Glob/Grep), then passes a `<reference-paths>` block to each agent. Agents read only the files relevant to their specific task — never receive file contents in their prompt.

**Template:**

```markdown
Discover relevant files via Glob/Grep, then pass categorized paths to each agent:

<reference-paths>
## Routes/Controllers
- src/routes/auth.ts
- src/routes/api.ts

## Models

- src/models/user.ts
- src/models/session.ts

## Config

- src/config/database.ts
  </reference-paths>

Agent instruction: "Read only the files relevant to your analysis from the paths above."
```

**Rules:**

- Never pass file contents in the agent prompt — only paths
- Categorize paths by type/module when agents cover different domains
- Each agent's instruction must explicitly say to read only what's relevant
- The orchestrator does discovery once — agents don't re-discover

---

## Parallel Dispatch

**When:** 3+ onafhankelijke problemen/onderzoeken bestaan die parallel opgelost kunnen worden via de Agent tool.

**Parallel dispatch** wanneer:

- 3+ onafhankelijke problemen/onderzoeken bestaan
- Geen gedeelde state of file-conflicts tussen agents
- Elke agent kan zelfstandig zijn taak voltooien zonder output van een andere agent

**Sequentieel houden** wanneer:

- Agents schrijven naar dezelfde files (conflictrisico)
- Output van agent A is input voor agent B
- < 3 problemen (overhead niet waard)
- Problemen hangen af van gedeelde database/service-state

**Decision Flow:**

```
problemen geïdentificeerd
  ↓
overlap in files of state?
  ja → sequentieel
  nee ↓
< 3 problemen?
  ja → sequentieel
  nee ↓
parallel dispatch (één message, meerdere Agent tool-calls)
```

**Agent Prompt Template:**

Elke parallel agent krijgt een zelfstandige, complete prompt:

```
**Scope**: [één probleemdomein, expliciet afgegrensd]
**Doel**: [één duidelijke output — gefixte bug, scan-rapport, refactor-diff]
**Context**: [alle benodigde info inline — geen verwijzing naar sessiehistorie]
  - Relevante file paths
  - Reproducieerbare symptomen / foutmelding
  - Stack/framework info
**Constraints**:
  - Wijzig NIET: [lijst van files/modules buiten scope]
  - Schrijf NIET naar [gedeelde state-files] — alleen lezen
**Output-eis**: Eindig met bewijs van voltooiing (commando + output, zie R009)
```

Regels:

- Elk agent-prompt is volledig zelfstandig — neem aan dat de agent geen sessiehistorie heeft
- Scope expliciet begrenzen zodat agents niet dezelfde files aanraken
- Output-eis altijd meegeven zodat resultaten verifieerbaar zijn

**Integratie** (na alle agents klaar):

1. Lees rapport per agent
2. Detecteer conflicts: zelfde file of symbol gewijzigd door meerdere agents?
3. Bij conflict: kies één, herzien ander in aparte pass
4. Run gedeelde validation (tests, type-check, lint) op de samenvoeging
5. Claim voltooiing conform R009

---

## Project Bootstrapping

**When:** Een skill verwacht `.project/` bestanden (backlog.html, project.json, features/) maar de folder bestaat niet of is leeg.

**How:** Check in FASE 0 of `.project/` bestaat. Als niet, suggest `core-setup` vóór de skill uitvoert.

**Rules:**

- Skills die `.project/` MOGEN aanmaken zonder check: `project-plan`, `project-todo`, `frontend-design`, `core-setup`
- Alle andere skills: als `.project/` niet bestaat of leeg is, toon suggestie en stop
- Doe geen silent `mkdir -p` voor de hele `.project/` structuur — dat is `core-setup`'s taak
- `mkdir -p .project/features/{name}` en `mkdir -p .project/session` binnen een bestaande `.project/` is wél ok

---

## Task Tracking

**When:** Skill heeft 5+ fases en risico op context compaction (verify, debug, refactor, build, optimize, multi-stage setup).

**How:** Combineer vier marker-types: seed-blok bovenaan, FASE 0 bootstrap-marker, inline transitiemarkers per fase-overgang, completion-marker bij laatste fase.

**Seed-blok** — direct onder `## Process` of `## Workflow`, vóór eerste fase:

```markdown
**Fase tracking** — eerste actie van de skill: roep `TaskCreate` aan met deze N items
(status `pending`), daarna gebruik `TaskUpdate` om per fase `in_progress` te zetten
aan begin en `completed` aan einde. Bij context compaction blijft de task list
zichtbaar — geen risico op vergeten fases.

1. FASE 0: ...
2. FASE 1: ...
   ...
   N. FASE LAST: ...
```

**FASE 0 marker** — direct onder de eerste fase-header:

```markdown
> **Todo**: roep `TaskCreate` aan met de N fase-items (zie boven). Markeer FASE 0 → `in_progress` via `TaskUpdate`.
```

**Inline transitiemarker** — direct onder elke volgende fase-header:

```markdown
> **Todo**: markeer FASE PREV → `completed`, FASE CURRENT → `in_progress`.
```

**Completion marker** — aan het einde van de laatste fase:

```markdown
> **Todo**: markeer FASE LAST → `completed`.
```

**Conventies:**

- Hoofdletter `Markeer` alleen in FASE 0 bootstrap-marker (eenmalig per skill)
- Lowercase `markeer` in alle inline + completion markers
- Statussen altijd in backticks: `pending`, `in_progress`, `completed`
- Skills met "Step" of "Phase" in plaats van "FASE" houden hun eigen woord aan
- Seed-count = aantal headers = aantal markers (FASE 0 marker + N-1 transities + 1 completion = N totaal)

**Skip voor:** korte CLI-utilities (<5 fases), interactieve denk-skills, backlog/CRUD skills.

**Reference:** `dev-build/SKILL.md` (regel 33+) heeft het volledige patroon.

---

## Git Safety Gates

**When:** A skill performs git mutations (commit, push, checkout, merge, rebase).

**How:** Treat git state as volatile — re-read after every mutation, check state dimensions separately, enforce safety gates before risky operations.

**Three principles:**

1. **Re-read after mutation** — after every git write, re-check with `git status` / `git log --oneline -1` / `git branch --show-current`
2. **Separate state dimensions** — check independently:
   - Is the working tree clean? (`git status --porcelain`)
   - Does the upstream branch exist? (`git rev-parse --abbrev-ref @{u}`)
   - Are there unpushed commits? (`git log @{u}..HEAD --oneline`)
   - What is the current branch? (`git branch --show-current`)
3. **Safety gates** — before risky operations, run explicit checks first

**Template:**

```markdown
Before push:
✓ Current branch is not main/master
✓ Working tree is clean
✓ Upstream exists or --set-upstream is used
✓ No unexpected commits in log

Before checkout/switch:
✓ Working tree is clean (or changes are stashed)
✓ Target branch exists

After any mutation:
→ Re-read git status
→ Verify expected state matches actual state
→ If unexpected: STOP and inform user
```

**Rules:**

- Never assume git state based on a previous check — always re-read
- Detect default branch via `git remote show origin` or `gh repo view --json defaultBranchRef`
- On unexpected state: stop and inform the user, don't attempt recovery

---

## Agent Context Block

**When:** Een skill spawnt een agent die projectkennis nodig heeft (Explore, Plan, of custom agent).

**How:** Bouw een gestandaardiseerd `PROJECT_CONTEXT` block uit beschikbare bronnen in FASE 0 (context loading). Geef dit block mee aan elke agent die projectkennis nodig heeft.

**Template:**

```markdown
Stel het volgende block samen uit beschikbare bronnen:

PROJECT_CONTEXT_START
Stack: {CLAUDE.md ### Stack sectie, of stack-baseline.md samenvatting}
Structure: {project-context.json → context.structure, of "niet beschikbaar"}
Patterns: {project-context.json → context.patterns, of "niet beschikbaar"}
Endpoints: {project.json → endpoints, max 20 entries, of "niet beschikbaar"}
Entities: {project.json → data.entities, max 10 entries, of "niet beschikbaar"}
Active feature: {.project/session/active-\*.json inhoud, of "geen"}
Learnings: {project-context.json → learnings[], laatste 5 entries, of "geen"}
PROJECT_CONTEXT_END
```

**Rules:**

- Lees bronbestanden in FASE 0 (context loading) — niet per agent opnieuw
- Skip secties die niet bestaan (toon "niet beschikbaar")
- Learnings alleen meegeven als relevant voor de agent's taak
- Skills mogen extra skill-specifieke secties toevoegen NA het standaard blok
- Bestaande skills (dev-debug, dev-verify, dev-owasp) hoeven niet direct te migreren — dit is opt-in voor nieuwe skills en toekomstige refactors

---

## Description Format

**When:** Bij schrijven of reviewen van SKILL.md frontmatter `description`.

**Rule:** Description moet beginnen met triggervoorwaarden, niet met een workflow-samenvatting.

| Goed (✓)                                                                  | Slecht (✗)                                                  |
| ------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `Use when implementation done and acceptance tests must verify spec`      | `Adversarial verification — tests + fix loops`              |
| `Use with /dev-debug when feature has reported bugs to root-cause`        | `Debug methodology with systematic root-cause analysis`     |
| `Use with /thinking-brainstorm to expand idea via interactive techniques` | `Creatively expand ideas through interactive technique app` |

**Why:** Workflow-summaries laten Claude denken dat het de skill al kent, dus skipt de rest van de SKILL.md. Triggervoorwaarden maken duidelijk _wanneer_ de skill gekozen wordt, niet _wat_ hij doet.

**Format:**

```
Use {when|with} <trigger>. <korte aanvulling>. Use with /<command-name>[, optional /<predecessor>].
```

**Bestaande skills:** geen bulk-refactor — pattern toepassen bij de volgende edit aan een skill (incremental adoption).

---

## Agent Model Selection

**When:** Een skill spawnt agents via de Agent tool en je wilt kosten/snelheid optimaliseren.

**How:** Kies het model op basis van de taak die de agent uitvoert.

**Richtlijn:**

| Agent taak                                   | Model             | Reden                                           |
| -------------------------------------------- | ----------------- | ----------------------------------------------- |
| Code lezen, zoeken, context verzamelen       | `model: "sonnet"` | Goedkoper, snel, voldoende voor read-only taken |
| Code schrijven, complexe fixes, architectuur | `model: "opus"`   | Hogere kwaliteit voor creatief/analytisch werk  |
| Eenvoudige classificatie, parsing            | `model: "haiku"`  | Snelst en goedkoopst voor simpele taken         |

**Rules:**

- Default = geen model specificatie (erft parent model)
- Specificeer alleen als kostenbesparing significant is (agent leest veel bestanden of draait vaak)
- Explore agents zijn bijna altijd Sonnet-geschikt
- Build/fix agents die code schrijven: gebruik Opus tenzij het een triviale fix is

---

## Modal Option Cap

**When:** A skill uses AskUserQuestion (multi-select) where the number of options is dynamic — depends on runtime context, scan results, stack, or user input. Applies to options generated from feature lists, agent outputs, file scans, or other unbounded sources.

**How:** Enforce a hard cap of 7 options per modal. When more options exist, split into sequential category modals — one per logical group, in order of impact.

**When NOT to use a modal — use plain-text list + free-form parse instead:**

- The user needs to see ALL options simultaneously to make a coherent choice (e.g., prioritization, scope selection from holistic view)
- The option count is unbounded and runtime-dependent without natural categorization
- The choice involves comparing items against each other rather than picking from independent categories

In these cases: present a numbered plain-text list and ask for free-form input (e.g., `1, 3, 5` / `1-4` / `alles behalve 2`). Reference: `project-todo`, `core-profile`, `project-add`.

Use `AskUserQuestion` only for the cancel/exit route (e.g., "Doorgaan met selectie" / "Annuleren").

**Rules:**

- **Cap**: max 7 options per modal
- **When more options are available**: split into sequential category modals, skip empty categories
- **Never truncate silently**: prefer an extra modal over dropping options

**Category examples by domain:**

| Skill domain        | Category split                                    |
| ------------------- | ------------------------------------------------- |
| Tech stack          | Core framework → Build/dev tooling                |
| Library suggestions | Styling/UI → Testing → State/Data → Utilities     |
| Debug fixes         | By component/layer (UI, logic, data, performance) |
| Audit findings      | Core files → Config → Claude config → CLAUDE.md   |

**Modals with fixed/small option sets (≤7 options) are not subject to this rule.**

---

## Modal Whitespace Buffer

**When:** A skill shows a table, list, or code-fence (substantive output block) and immediately calls `AskUserQuestion` after it.

**Problem:** The modal renders as a panel below the chat output. In a short terminal window the modal panel pushes the bottom of the preceding table out of view while the modal is open — the user loses context exactly when they need it.

**How:** Add an explicit instruction to print 8 blank lines before the `AskUserQuestion` call. Claude outputs those lines as chat content; the modal panel absorbs them instead of table content. Mark the spot with `<!-- modal-buffer -->` (machine-findable) followed by the instruction:

```
<!-- modal-buffer -->
Print 8 blank lines as whitespace buffer (keeps content above visible when the modal panel opens).
```

The instruction must be plain text — do NOT rely on literal blank lines in the SKILL.md file (the markdown formatter strips them).

**Example:**

❌ Wrong (modal pushes table out of view):

```
| Feature | Risk |
|---------|------|
| Auth    | 4    |
| Routing | 2    |

Use AskUserQuestion: question = "Klopt deze prioritering?"
```

✅ Right (buffer protects content):

```
| Feature | Risk |
|---------|------|
| Auth    | 4    |
| Routing | 2    |

<!-- modal-buffer -->
Print 8 blank lines as whitespace buffer (keeps content above visible when the modal panel opens).

Use AskUserQuestion: question = "Klopt deze prioritering?"
```

**When NOT to use:**

- Content above the modal is ≤3 lines (already short enough to stay fully visible)
- `AskUserQuestion` follows a short instruction line with no substantive output block above it
- Numbered-list + free-form parse pattern (see § Numbered List Selection) — no modal follows the list

**Anti-pattern — do NOT embed data in the `question` field.** The table above is still visible; duplicating it in the question makes the modal unnecessarily large and clutters the confirmation prompt. Keep the question short and generic.

**Reference implementation:** `project-plan/SKILL.md` FASE 1 stap 5 Feature Review modal.

---

## Numbered List Selection

**When:** A skill presents a numbered plain-text list and asks the user to pick items via free-form input (the alternative to `AskUserQuestion` for holistic-choice scenarios — see § Modal Option Cap).

**How:** Standardize the syntax and edge cases so users get consistent behaviour across skills.

**Canonical syntax (accept all of these):**

| User input              | Interpretation           |
| ----------------------- | ------------------------ |
| `1, 3, 5`               | Items 1, 3, 5            |
| `1-4`                   | Items 1 through 4        |
| `1, 3-5, 8`             | Mixed list + range       |
| `alle` / `alles` / `*`  | All items                |
| `geen` / `none` / empty | No items                 |
| `alles behalve 2, 7`    | All items except 2 and 7 |

**Edge case rules:**

- Out-of-range numbers (e.g., `8` in a list of 7): show what was unparseable and re-ask the same question — do not silently drop
- Duplicate numbers: dedupe silently
- Whitespace and case: ignore
- Mixed separators (`,` and `;`): accept both
- If the user types a sentence instead ("alleen de eerste drie"): interpret if obvious, otherwise re-ask with the syntax examples

**Prompt template:**

> Vraag: "{question}? Geef nummers (bv. `1, 3, 5` of `1-4` of `alles behalve 2`)."

**Rules:**

- Always show the syntax hint inline with the question — don't expect the user to remember
- Empty input always means "geen", never "alle" (safer default)
- Echo the parsed selection back before destructive action (e.g., "Geselecteerd: items 1, 3, 5 — doorgaan?")

---

## Discovery (Gap, Reuse & Page)

Drie gerelateerde flows die automatisch TODOs in de backlog droppen wanneer skills missende logica, herbruikbare UI, of nieuwe page-routes detecteren. Gemeenschappelijke structuur: **scan → dedup → AskUserQuestion → append + log**. Alle drie zijn **non-blocking** — de skill gaat altijd door ongeacht gaps.

### Gedeeld: dedup-volgorde

Vóór elke `data.features.push()`, in deze volgorde:

1. **Naam-check** — `data.features.find(f => f.name === kebab-name)` → al in backlog? → skip.
2. **Inventory-check** (type COMPONENT) — `project.json#design.components.find(c => c.name === kebab-name)` → al gespecificeerd? → link i.p.v. push.
3. **suggestionsLog-check** — `feature.json#suggestionsLog.find(s => s.name === name && s.status === "rejected" && s.skill === current-skill)` → eerder afgewezen door huidige skill? → skip. Afgewezen door andere skill: mag opnieuw voorgesteld worden.

### Gedeeld: suggestionsLog shape

```json
{
  "skill": "{skill-naam}",
  "type": "FEATURE|COMPONENT",
  "name": "{component}.{prop} of {component-naam}",
  "status": "accepted|rejected",
  "at": "{ISO 8601}",
  "direction": "frontend→dev|dev→frontend"
}
```

Als geen gaps/kandidaten gevonden: stap volledig overslaan (geen prompt).

---

### Gap-Discovery

**Richting:** frontend → dev

**Doel:** stub-handlers en actie-werkwoorden in gegenereerde frontend-code detecteren die nog geen gekoppeld FEATURE in de backlog hebben.

**Skills:** `frontend-design` (Triggers A/B/C), `frontend-convert` (Trigger C).

#### Triggers

- **A — Capture(Component):** scan `props[]` op regex `/^on[A-Z]/` of namen als `action`, `handler`, `submit`.
- **B — Capture(Page):** scan `flows[]`/`purpose` op actie-werkwoorden: submit, delete, save, fetch, send, create, update, upload, download. Max 3 kandidaten, hoogste semantische gewicht eerst.
- **C — Build/Convert (post code-gen):** scan gegenereerde `.tsx`/`.svelte`/`.vue` op stub-handlers: `() => {}`, `/* TODO */`, `// implement`, `console.log` als enige body.

Fuzzy-match per kandidaat tegen `data.features` (type FEATURE/API/INTEGRATION) op naam/beschrijving. Threshold score > 0.5 → toon "Link aan bestaand" optie.

#### Resolution (per gap-kandidaat)

AskUserQuestion:

```yaml
header: "Gap: {component|page}.{prop/actie} heeft geen functionaliteit"
question: "Wat moet er gebeuren met dit gedrag?"
options:
  - label: "Link aan bestaand: {best-match}"
    description: "Voegt {entity} toe aan {feature}.frontend.linkedEntities[]"
  - label: "Maak nieuw FEATURE TODO"
    description: "Backlog krijgt [FEATURE] {suggested-name} TODO"
  - label: "Markeer als decoratief"
    description: "Geen gedrag nodig (visual demo). Gap: skipped"
  - label: "Skip voor nu"
    description: "Gap: pending — prompt verschijnt bij volgende Build/Capture"
multiSelect: false
```

**Persisteer keuze:**

- **Link:** append `{ prop, context, status: "linked", featureRef, at }` aan `design.{components|pages}[name].gaps[]`; append `{ type, name, prop }` aan `{feature-name}/feature.json#frontend.linkedEntities[]`
- **Maak nieuw:** voer dedup-volgorde uit → push naar `data.features[]`; append gap met `status: "created", featureRef: name`; append `frontend.linkedEntities[]` entry
- **Decoratief:** append gap met `status: "skipped"`
- **Skip:** append gap met `status: "pending"`

---

### Reuse-Discovery

**Richting:** dev → frontend

**Doel:** herbruikbare UI-patronen detecteren tijdens dev-werk en als COMPONENT-todo in de backlog droppen.

**Skills:** `dev-define` (keyword-scan requirements), `dev-build` (herhalend JSX-pattern), `project-plan` (cross-page pattern matching).

#### Triggers (per skill)

- **dev-define:** keyword-scan op UI-element namen in requirements (Modal, Dialog, Drawer, Tooltip, Dropdown, Select, DatePicker, TimePicker, RichTextEditor, FileUpload, Avatar, Badge, Toast, Alert, Banner, Stepper, Wizard, Table, DataGrid, Carousel, Accordion, Tab, Breadcrumb, FormField, InputGroup, ColorPicker, Rating, Slider, Progress, Skeleton). Pas ook project-specifieke naam-prefixen toe.
- **dev-build:** herhalend JSX-block na code-gen — ≥2x in hetzelfde bestand of ≥1x over meerdere bestanden van dezelfde feature.
- **project-plan:** cross-page UI-patroon-matching — groepeer features op beschrijvingen (Lijst/tabel, Card, Form, Modal/dialog, Navigation). Threshold: 2+ PAGE/FEATURE features delen het pattern.

#### Resolution (batch)

AskUserQuestion:

```yaml
header: "Potentiële componenten gevonden"
question: "{Skill-specifieke vraag over kandidaten}"
options:
  - label: "{naam} — {korte context}"
    description: "Maak COMPONENT-todo"
  - label: "..." (één per kandidaat)
  - label: "Overslaan"
    description: "Geen COMPONENT-todos toevoegen"
multiSelect: true
```

**Persisteer per geaccepteerd voorstel:**

1. Voer dedup-volgorde uit (zie boven).
2. Append aan `project.json#design.components[]`: `{ name, purpose: "infereer uit context", status: "IDEA", scope: "infereer uit context — atomic|section|layout, default atomic" }`
3. Push naar `backlog.html#data.features[]`:
   ```json
   {
     "name": "{kebab-case naam}",
     "type": "COMPONENT",
     "status": "TODO",
     "phase": "P3",
     "description": "Component gedetecteerd door {skill} in {context}",
     "source": "/{skill-naam}",
     "scope": "{infereer uit context, default atomic}",
     "dependencies": []
   }
   ```
4. Log in `feature.json#suggestionsLog[]` (accepted).
5. Append kebab-naam aan `dependencies[]` van triggerende feature(s).

Per afgewezen voorstel: log in `suggestionsLog[]` (rejected). "Overslaan" → log alle kandidaten als rejected.

---

### Page-Discovery

**Richting:** dev ↔ frontend

**Doel:** nieuwe page-routes detecteren tijdens dev-werk en als losse PAGE-todo in de backlog droppen zodat ze de design → convert → check pipeline doorlopen.

**Skills:** `dev-define` (post-architecture seed), `dev-build` (post-codegen safety net + COMPONENT→route suggesties).

#### Triggers (per skill)

- **dev-define:** scan `feature.json#architecture.routes[]` op stack-specifieke page-patronen (`app/**/page.tsx`, `src/routes/**`, `pages/**/*.{tsx,vue}`, `routes/**/*.svelte`); scan `feature.json#files[]` op suffixen `Page`, `Screen`, `View`.
- **dev-build (safety net):** identieke patronen als dev-define. Skip kandidaten die al door dev-define geseedd zijn: `data.features.find(f => f.source === "/dev-define" && f.parentFeature === current)`.
- **dev-build (COMPONENT→route):** scan `<Link href="...">` en `router.push(...)` in gegenereerde component-bestanden. Kandidaat als route niet voorkomt in `project.json#design.pages[]` of `backlog.html`.

#### Resolution

AskUserQuestion (vraagstelling per skill — zie skill-files voor exacte opties):

- **dev-define:** batch — "Voeg per page een PAGE-todo toe?" — opties: "Ja, alle" / "Selectie" / "Nee".
- **dev-build (safety net):** batch — "Toevoegen voor design → convert → check?" — "Ja" / "Nee".
- **dev-build (COMPONENT→route):** per route — "PAGE-todo voor {route}?" — "Ja" / "Overslaan".

**Persisteer per geaccepteerde page:**

1. Voer dedup-volgorde uit (zie boven — naam-check; type PAGE slaat inventory-check over; suggestionsLog-check op rejected status).
2. Push naar `data.features[]`:
   ```json
   {
     "name": "{kebab-case page-naam}",
     "type": "PAGE",
     "status": "TODO",
     "phase": "P3",
     "description": "Page introduced by feature {parentFeature}. Route: {route-pattern}",
     "source": "/{skill-naam}",
     "dependencies": ["{parentFeature}"],
     "parentFeature": "{parentFeature}",
     "auto": true
   }
   ```
3. Log in `feature.json#suggestionsLog[]` (accepted, `direction: "dev→frontend"`, `type: "PAGE"`).

Per afgewezen voorstel: log in `suggestionsLog[]` (rejected).

---

## Smart Suggestions (AskUserQuestion)

**When:** Elke keer dat een skill een vraag stelt via `AskUserQuestion`.

**Rules:**

- Eerste optie = aanbevolen → voeg `(Recommended)` toe aan het label
- Altijd `multiSelect: true` als default — alleen `false` bij ja/nee confirmaties
- 2-4 opties; `"Other"` is ingebouwd en hoeft niet handmatig toegevoegd
- Skills voegen skill-specifieke opties toe voor hun context

**Template:**

```yaml
header: "{Korte context}"
question: "{Vraag}"
options:
  - label: "{Beste optie} (Recommended)"
    description: "{Waarom dit de beste keuze is}"
  - label: "{Alternatief}"
    description: "{Wanneer dit relevant is}"
multiSelect: true
```

**Single-select** (ja/nee, keuze uit één optie): `multiSelect: false`
