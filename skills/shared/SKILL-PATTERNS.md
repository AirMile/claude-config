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
