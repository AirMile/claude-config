# Plan Mode Protocol — Thinking Phase Marker

Skills that perform multi-step analysis or synthesis can use plan mode to hint to model-routers (such as `opusplan`) that the thinking steps deserve a stronger model. Plan mode covers the analysis phase; file writes to `.project/` wait until after approval.

> **Scope**: this protocol is about plan mode as a _thinking hint_ around a long analysis phase. For plan mode as an _approval gate_ around a single output-write (`core-edit`, `core-create`, `core-audit`): document inline, not here.

---

## When to apply

Skills with a thought-heavy phase:

- Multi-step synthesis or analysis across multiple AskUserQuestion rounds
- Tool-heavy research (WebSearch + Context7 + reasoning)
- Architecture/design generation
- Pipeline-planning (concept → backlog, requirements → architecture)

Do not apply to short CRUD skills, pure validation, or skills with only file-reads + format-output.

---

## Entry — before the first thinking step

Call **`EnterPlanMode`** after the input/setup phase and before the first analytical step.

After the call:

1. Via system-reminder you receive the path to the plan file. Note this path — the final output will be written there for review.
2. Tools that keep working in plan mode: `AskUserQuestion`, `Read`, `Glob`, `Grep`, `WebSearch`, Context7 MCP, Obsidian MCP.
3. Tools that do NOT work until after exit: all file writes to `.project/` or project source.
4. The plan file itself may be written during plan mode — that is the review channel.

**Skip if already in plan mode** — if at entry an active plan-mode system-reminder already exists (the user started `/plan-mode` or another plan-mode skill themselves), skip `EnterPlanMode`. In that case read the existing plan-file path from the active system-reminder.

---

## Exit — before the first file write

At the end of the thinking phase:

1. Write the generated output to the plan file (path from Entry).
2. Call **`ExitPlanMode`** to present the output for user approval.
3. After approval: execute the file writes / sync phase (outside plan mode).

**Skip `ExitPlanMode` if the skill was already started in plan mode** — let the user end plan mode themselves.

---

## Skill-specific configuration

Skills that use this protocol insert a short section in their SKILL.md at the entry and exit locations.

**Entry section** (before first thinking step):

```markdown
### Enter Plan Mode

Follow [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Entry protocol before Step {X}.
Steps {X-Y} run in plan mode; the final output is written to the plan file for review.
```

**Exit section** (after last thinking step, before file writes):

```markdown
**End of thinking phase**: follow [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Exit protocol — write {what} to the plan file, then `ExitPlanMode`.
```

Skills may optionally name specific tools used intensively in plan mode (e.g. "WebSearch + Context7 keep working") if that extra clarity is useful for that skill.

---

## Used by

`dev-define`, `thinking-brainstorm`, `thinking-concept`, `thinking-critique`, `thinking-decide`, `thinking-research`

Authoritative: `grep -rl "shared/PLAN-MODE.md" skills/*/SKILL.md`
