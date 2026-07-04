# Plan Mode Protocol — Thinking Phase Marker

Skills that perform multi-step analysis or synthesis can use plan mode to hint to model-routers (such as `opusplan`) that the thinking steps deserve a stronger model. Plan mode covers the analysis phase; file writes to `.project/` wait until after approval.

> **Scope**: this protocol is about plan mode as a _thinking hint_ around a long analysis phase. For plan mode as an _approval gate_ around a single output-write (e.g. `core-audit`): document inline, not here.

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
2. Tools that keep working in plan mode: `AskUserQuestion`, `Read`, `Glob`, `Grep`, `WebSearch`, Context7 MCP.
3. Tools that do NOT work until after exit: all file writes to `.project/` or project source.
4. The plan file itself may be written during plan mode — that is the review channel.
5. **Deferral pattern for research-cache appends**: writes to `.claude/research/*.md` (stack-baseline, refactor-patterns, architecture-baseline) discovered during plan mode are blocked too — collect them in memory (`pending*Appends`) and write them in the skill's sync/completion phase after exit.

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

## Conditional entry

Some skills enter plan mode only when a condition fires mid-flow: `dev-ship (refactor phase)` / `game-ship (refactor phase)` after triage finds ≥1 HAS_FINDINGS; the `dev-ship (verify phase)` fix-loop on SPEC or unclear-root-cause bugs; the `dev-ship (build phase)` / `game-ship (build phase)` regression gate when the regression was not caused by the build itself; `design-convert` (route-design.md PHASE 1.5) when the chosen action is a synthesis route (Page/Component/Flow/Principles/Import/Brief) — CRUD and self-managed sub-routes do not enter. The Entry/Exit protocol applies unchanged from the moment of entry. The deviation from "Entry before the first thinking step" is deliberate — runs where the condition never fires stay friction-free. Document the condition at the entry point in the skill.

---

## Used by

Full-phase: `dev-ship (define phase)`, `game-ship (define phase)`, `dev-debug`, `game-debug`, `project-plan`, `project-brainstorm`, `project-seed`, `project-critique`, `project-research`. Conditional entry (see § Conditional entry): `dev-ship (refactor phase)`, `game-ship (refactor phase)`, `design-convert` (route-design.md PHASE 1.5 gate — synthesis routes only). Self-managed within a sub-route: `design-convert` Create (`references/route-create.md`) and Build (`references/route-build.md` — enters at Step 0b, exits at Step 7 before worktree setup + codegen), Convert (`references/route-convert.md` PHASE 0); `design-tokens` Create (`references/route-create.md` — Steps 0b–7).

Authoritative for the above: `grep -rl "Entry protocol" skills/*/SKILL.md skills/*/references/*.md`

Inline gates that call `EnterPlanMode` without the full Entry section (documented at the gate): `dev-ship (verify phase)` (`references/fix-loop.md § Plan-mode gate`), `dev-ship (build phase)` PHASE 2b and `game-ship (build phase)` PHASE 3a (regression-not-caused-by-build path).
