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
5. **Deferral pattern for research-cache appends**: writes to `.claude/research/*.md` (stack-baseline, refactor-patterns, architecture-baseline) discovered during plan mode are blocked too — collect them in memory (`pending*Appends`) and write them in the skill's sync/completion phase after exit. If a write truly cannot be deferred at all, see § Administrative exit.

**User consent prompt** — `EnterPlanMode` may prompt the user for plan-mode confirmation in some Claude Code UIs. This is intentional: model routers use plan mode as the trigger for upgrading to the planning model. Do not skip the call to avoid the prompt.

**Skip if already in plan mode** — if at entry an active plan-mode system-reminder already exists (the user started `/plan-mode` or another plan-mode skill themselves), skip `EnterPlanMode`. In that case read the existing plan-file path from the active system-reminder.

---

## Exit — before the first file write

At the end of the thinking phase:

1. Write the generated output to the plan file (path from Entry).
2. Call **`ExitPlanMode`** to present the output for user approval.
3. After approval: execute the file writes / sync phase (outside plan mode).

**Skip `ExitPlanMode` if the skill was already started in plan mode** — let the user end plan mode themselves.

---

## Administrative exit (temporary) — exit, write, re-enter

`ExitPlanMode` is normally one-way (the gate). But occasionally a write genuinely cannot be deferred past the gate — a durable checkpoint/live-signal that must land now, or a mutating command needed to unblock the thinking itself. For that case only:

1. **Deferral is always the first choice** (the `pending*Appends` pattern in § Entry point 5). Use a temporary exit only when deferral is impossible.
2. **Exit with an administrative note, not a plan** — call `ExitPlanMode` with 1–2 lines as the plan content: `Administrative exit: {reason}. Performing {writes}; thinking resumes in plan mode immediately after.` Never present a half-finished feature plan here — this exit is not the gate.
3. **Perform only the stated writes** — no scope creep while outside plan mode.
4. **Re-entry is mandatory when substantial thinking remains** — immediately call `EnterPlanMode` again and resume exactly where the thinking left off. An administrative exit never ends the thinking phase; only the skill's real gate does. Re-entry is for resuming _thinking_ on the planning model — not for re-arming a lapsed write-batching window: when a skill defines its own lapsed-window rule (e.g. `dev-ship` `manual-interview-walkthrough.md § Step A3`), that rule wins for its phase.
5. **Not available when the user started plan mode themselves** (the skip-cases in § Entry / § Exit — the user owns that session): defer, or ask the user.
6. Each exit costs the user an approval prompt — keep it rare (0–1 per phase).

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

Some skills enter plan mode only when a condition fires mid-flow: `dev-ship (refactor phase)` / `game-ship (refactor phase)` after triage finds ≥1 HAS_FINDINGS; the `dev-ship (verify phase)` fix-loop on SPEC or unclear-root-cause bugs; the `dev-ship (build phase)` / `game-ship (build phase)` regression gate when the regression was not caused by the build itself; `design-convert` (route-design.md PHASE 1.5) when the chosen action is a synthesis route (Page/Component/Flow/Principles/Import/Brief) — CRUD and self-managed sub-routes do not enter. The Entry/Exit protocol applies unchanged from the moment of entry. The deviation from "Entry before the first thinking step" is deliberate — runs where the condition never fires stay friction-free. Document the condition at the entry point in the skill. Any `dev-ship`/`game-ship` main-chat moment outside these catalogued entries may also escalate ad hoc — see § Difficulty escalation below.

The `dev-ship (verify phase — PHASE 3 manual)` / `game-ship (playtest)` **round-level fix-plan gate**
(`references/fix-round.md § Round gate`) is a hybrid, not a plain conditional entry: on the common
round-1 path it does not call `EnterPlanMode` at all — it continues inside the walkthrough's own
full-phase plan-mode session (see § Used by below), entering only the design work when the ledger
turns out non-trivial (≤2 obvious cosmetic MEASURABLE tweaks skip silently and fix inline; the
post-dispatch polish loop also stays out of plan mode). Only on a **round 2+** re-entry (after
`§ Re-check` sends the run back for another round, when no plan-mode session is active) does it call
a fresh `EnterPlanMode` the traditional conditional way.

### Difficulty escalation (ad-hoc entry)

Beyond the catalogued conditions above, a main-chat phase may escalate **ad hoc** when it hits
genuinely hard thinking, so the reasoning runs on the planning model. Triggers (any one):

- an architectural/strategy decision with ≥2 viable approaches and no clear winner,
- the same fix or approach has failed twice,
- a cross-cutting change where the change-plan itself is unclear,
- ambiguous/conflicting requirements or unexpected state that invalidates the current plan mid-run.

Rule: `EnterPlanMode` (skip if already active) → think/design → write the decision to the plan file
→ `ExitPlanMode` (accept continues execution with the decision; reject revises in plan mode).
Boundaries: **main-chat only** (background workflows/subagents cannot call plan-mode tools); never
double-enter a moment already covered by a catalogued entry (refactor triage, fix-loop, fix-round
gate, debug rounds) — this is the backstop for uncovered moments. If execution must immediately
resume thinking after the decision, the exit follows § Administrative exit shape.

---

## Used by

Full-phase: `game-debug`, `project-plan`, `project-seed` (incl. brainstorm/critique modes), `project-research`, `dev-ship (define phase)`, `game-ship (define phase)`. The two `*-ship (define phase)` entries are a **full-phase variant**: entry is at PHASE 0 Step 2b (before the interview, so the whole define thinking-block runs on the planning model) and exit is the **plan-approval gate** itself (Step 4b `ExitPlanMode`) — accept writes `feature.json` + starts build, reject stays in plan mode and loops back to revise.

`dev-ship`'s in-ship debug rounds (`debug-round.md`, `debug-round-heavy.md`) are a **third full-phase
variant**, each opening its own session on a parked resume (distinct from the interview walkthrough's
session below, which already closed before the park): entry is near the top of the file (§ 3 `Enter
plan mode`, skipped only on the rarer proactive/already-in-plan-mode entry), exit is the round's own
fix-plan `ExitPlanMode` (`debug-round.md § 6` / `debug-round-heavy.md § 6`).

`dev-ship (verify phase — PHASE 3 manual)` / `game-ship (playtest)` are a second **full-phase
variant**, with an unconditional entry but a conditional exit: entry is
`manual-interview-walkthrough.md § Step A3`, before the first interview item — unconditional once
`remainingManualItems` is non-empty (after the board signal, app-launch, and the evidence pre-check
sweep, none of which touch plan mode). Exit is **one of three points**, decided by the ledger state
at `phase-3-manual-finalize.md § Findings ledger + routing`: an immediate `ExitPlanMode` on an
all-pass ledger, an immediate `ExitPlanMode` on the ≤2-cosmetic inline-fix path, or — when the ledger
needs a real fix round — staying in the same session while `fix-round.md § Round gate` designs the
round plan, with its `ExitPlanMode` presenting the interview outcome and the fix plan together.
Verdicts and ledger items are collected in memory throughout and batch-persisted immediately after
whichever exit fires (`manual-interview-walkthrough.md § Step E`) — the accepted trade-off is that a
session death mid-interview loses that session's in-memory verdicts, recovered by the resume path
filtering already-persisted items back out.

`dev-security` has **two independent conditional entries**, neither overlapping the other:
PHASE 3 aggregation/triage (`SKILL.md § PHASE 3` — entry right after the PHASE 2b scan Workflow
returns, judgment work is the tool-finding merge + anti-fantasy check + verdict; exit is either an
immediate `ExitPlanMode` on "No, report only", or `ExitPlanMode` before PHASE 4 launches its own
Workflow — a Workflow cannot launch from inside plan mode) and PHASE 5's fix-strategy gate
(`references/fix-implement.md § PHASE 5 gate` — entry after the PHASE 4 fix-plans Workflow returns,
exit is the chosen-strategy/fix-set `ExitPlanMode`, the implementation go/no-go). The PHASE 2
tooling-report writes (OSV/Semgrep/gitleaks JSON) deliberately run **before** either entry — no
deferral pattern needed there, unlike the research-cache append case in § Entry point 5.

Conditional entry (see § Conditional entry): `dev-ship (refactor phase)`, `game-ship (refactor phase)`, `design-convert` (route-design.md PHASE 1.5 gate — synthesis routes only), and the fix-round gate's **round 2+** path. Self-managed within a sub-route: `design-convert` Create (`references/route-create.md`) and Build (`references/route-build.md` — enters at Step 0b, exits at Step 7 before worktree setup + codegen), Convert (`references/route-convert.md` PHASE 0); `design-tokens` Create (`references/route-create.md` — Steps 0b–7).

Authoritative for the above: `grep -rl "Entry protocol" skills/*/SKILL.md skills/*/references/*.md` — **except** the two `*-ship (define phase)` full-phase variants, which call `EnterPlanMode` inline at PHASE 0 Step 2b (referencing this file's Entry) rather than embedding the boilerplate Entry section, so they do not appear in that grep; their entry point is documented at Step 2b of each `phase-0-define-classify.md`. The PHASE 3 manual/playtest full-phase variant is documented the same way, at `manual-interview-walkthrough.md § Step A3` / `playtest-interview-walkthrough.md`'s equivalent step.

Inline gates that call `EnterPlanMode` without the full Entry section (documented at the gate): `dev-tweak` / `game-tweak` (SKILL.md PHASE 2 — the § Difficulty escalation triggers verbatim: unclear root cause after first evidence, or > 2 files), `dev-ship (verify phase)` (`references/fix-loop.md § Plan-mode gate`), `dev-ship (verify phase — PHASE 3 manual)` **round 2+ only** (`references/fix-round.md § Round gate` — round 1 continues the walkthrough's already-active session instead), `game-ship (playtest)` **round 2+ only** (`references/fix-round.md § Round gate`), `dev-ship (build phase)` PHASE 2b and `game-ship (build phase)` PHASE 3a (regression-not-caused-by-build path), `core-audit` (`SKILL.md § Enter Plan Mode`, between Step 2 and Step 3 — the analysis/scoring work; exit is the refactor proposal's own approval gate, `references/refactor-plan.md § 5.2`, called even when the skill started already in plan mode since the apply step needs writes). (The `*-ship (define phase)` gate is **not** here anymore — it is now the exit of the full-phase define plan mode above, not a standalone inline `EnterPlanMode` at Step 4b.)
