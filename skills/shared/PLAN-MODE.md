# Plan Mode Protocol — Denkfase Markering

Skills die multi-stap analyse of synthese doen kunnen plan mode gebruiken om aan model-routers (zoals `opusplan`) te hinten dat de denkstappen een sterker model verdienen. Plan mode covert de analyse-fase; file writes naar `.project/` wachten tot na approval.

> **Scope**: dit protocol gaat over plan mode als _thinking hint_ rond een lange analyse-fase. Voor plan mode als _approval gate_ rond één output-write (`core-edit`, `core-create`, `core-audit`): inline documenteren, niet hier.

---

## Wanneer toepassen

Skills met een denkzware fase:

- Multi-stap synthese of analyse over meerdere AskUserQuestion-rondes
- Tool-heavy research (WebSearch + Context7 + reasoning)
- Architecture/design generation
- Pipeline-planning (concept → backlog, requirements → architecture)

Niet toepassen op korte CRUD-skills, pure validation, of skills met alleen file-reads + format-output.

---

## Entry — vóór de eerste denkstap

Roep **`EnterPlanMode`** aan na de input-/setup-fase en vóór de eerste analytische stap.

Na de call:

1. Via system-reminder krijg je het pad naar de plan file. Noteer dit pad — de finale output wordt hiernaar geschreven ter review.
2. Tools die blijven werken in plan mode: `AskUserQuestion`, `Read`, `Glob`, `Grep`, `WebSearch`, Context7 MCP, Obsidian MCP.
3. Tools die NIET werken tot na exit: alle file writes naar `.project/` of project source.
4. De plan file zelf mag wél worden geschreven tijdens plan mode — dat is het review-kanaal.

**Skip als al in plan mode** — als bij entry al een actieve plan-mode system-reminder bestaat (gebruiker heeft zelf `/plan-mode` of een andere plan-mode skill gestart), skip `EnterPlanMode`. Lees in dat geval het bestaande plan-file-pad uit de actieve system-reminder.

---

## Exit — vóór de eerste file write

Aan het einde van de denkfase:

1. Schrijf de gegenereerde output naar de plan file (pad uit Entry).
2. Roep **`ExitPlanMode`** aan om de output te presenteren voor user approval.
3. Na approval: voer de file writes / sync-fase uit (buiten plan mode).

**Skip `ExitPlanMode` als de skill al gestart was in plan mode** — laat de gebruiker zelf plan mode beëindigen.

---

## Skill-specifieke configuratie

Skills die dit protocol gebruiken voegen in hun SKILL.md een korte sectie in op de entry- en exit-locaties.

**Entry-sectie** (vóór eerste denkstap):

```markdown
### Enter Plan Mode

Volg [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Entry-protocol vóór Step {X}.
Steps {X-Y} draaien in plan mode; de finale output wordt naar de plan file geschreven ter review.
```

**Exit-sectie** (na laatste denkstap, vóór file writes):

```markdown
**Einde denkfase**: volg [shared/PLAN-MODE.md](../shared/PLAN-MODE.md) Exit-protocol — schrijf {wat} naar de plan file, dan `ExitPlanMode`.
```

Skills mogen optioneel specifieke tools noemen die intensief in plan mode gebruikt worden (bv. "WebSearch + Context7 blijven werken") als extra duidelijkheid voor die skill nuttig is.

---

## Gebruikt door

`dev-define`, `thinking-brainstorm`, `thinking-concept`, `thinking-critique`, `thinking-decide`, `thinking-research`

Authoritative: `grep -rl "shared/PLAN-MODE.md" skills/*/SKILL.md`
