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

| Use case              | Diagram type         | Example skills               |
| --------------------- | -------------------- | ---------------------------- |
| Architecture/layers   | Component diagram    | dev-define, frontend-compose |
| Multi-step workflow   | Flowchart            | dev-build, dev-test          |
| Feature decomposition | Tree                 | dev-plan, game-plan          |
| State transitions     | State machine        | game-define                  |
| Parallel processes    | Architecture diagram | team-review                  |
| Decision flow         | Decision tree        | thinking-decide              |

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

## Project Bootstrapping

**When:** Een skill verwacht `.project/` bestanden (backlog.html, project.json, features/) maar de folder bestaat niet of is leeg.

**How:** Check in FASE 0 of `.project/` bestaat. Als niet, suggest `core-setup` vóór de skill uitvoert.

**Rules:**

- Skills die `.project/` MOGEN aanmaken zonder check: `dev-plan`, `game-plan`, `frontend-plan`, `core-setup`
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
