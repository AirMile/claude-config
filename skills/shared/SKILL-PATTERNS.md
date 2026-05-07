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
| Feature decomposition | Tree                 | dev-plan, game-plan         |
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

- Skills die `.project/` MOGEN aanmaken zonder check: `dev-plan`, `game-plan`, `frontend-design`, `core-setup`
- Alle andere skills: als `.project/` niet bestaat of leeg is, toon suggestie en stop
- Doe geen silent `mkdir -p` voor de hele `.project/` structuur — dat is `core-setup`'s taak
- `mkdir -p .project/features/{name}` en `mkdir -p .project/session` binnen een bestaande `.project/` is wél ok

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

In these cases: present a numbered plain-text list and ask for free-form input (e.g., `1, 3, 5` / `1-4` / `alles behalve 2`). Reference: `dev-todo`, `game-todo`, `core-profile`, `project-add`.

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
