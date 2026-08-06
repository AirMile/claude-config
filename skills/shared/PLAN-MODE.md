# Plan Mode Protocol — Approval Gate

Plan mode exists to show the user a concrete, reviewable artefact — a plan, a design proposal, a fix
set, a strategy — before something hard-to-reverse happens, and to enforce that review with a write
stop. It is **not** a model-routing device: the session model is plain `opus` at all times
(`~/.claude/CLAUDE.md § Model Tiering`), so entering plan mode never changes which model is thinking.

> **Scope**: this protocol is about plan mode as an approval gate around a genuine decision point.
> For a single, self-contained output-write approval (e.g. `core-audit`'s refactor proposal): document
> inline, following the same Entry/Exit mechanics, not this file's catalog.

---

## Wanneer plan mode — the gate test

Use plan mode only when **both** are true:

- **(a)** a reviewable artefact comes out of the phase — a plan, a design, a fix set, a strategy — not
  just a summary of work already done, and
- **(b)** a rejection genuinely changes what happens next — the user can send the work back for
  revision, not just acknowledge it.

If the honest answer to (a) is "a short summary" or to (b) is "the flow continues either way," this
is not a gate — it is ceremony, and it should not call `EnterPlanMode`. A phase that merely does
multi-step analysis or reasoning does not need plan mode for that reason alone; reasoning quality no
longer depends on being inside plan mode.

---

## Entry — before the first thinking step

Call **`EnterPlanMode`** after the input/setup phase and before the first analytical step.

After the call:

1. Via system-reminder you receive the path to the plan file. Note this path — the final output will be written there for review.
2. Tools that keep working in plan mode: `AskUserQuestion`, `Read`, `Glob`, `Grep`, `WebSearch`, Context7 MCP.
3. Tools that do NOT work until after exit: all file writes to `.project/` or project source.
4. The plan file itself may be written during plan mode — that is the review channel.
5. **Deferral pattern for research-cache appends**: writes to `.claude/research/*.md` (stack-baseline, refactor-patterns, architecture-baseline) discovered during plan mode are blocked too — collect them in memory (`pending*Appends`) and write them in the skill's sync/completion phase after exit. If a write truly cannot be deferred at all, see § Administrative exit.

**User consent prompt** — `EnterPlanMode` may prompt the user for plan-mode confirmation in some Claude Code UIs. This is intentional: it is the moment the user is told a review gate is coming. Do not skip the call to avoid the prompt.

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
4. **Re-entry is mandatory when substantial thinking remains** — immediately call `EnterPlanMode` again and resume exactly where the thinking left off. An administrative exit never ends the thinking phase; only the skill's real gate does.
5. **Not available when the user started plan mode themselves** (the skip-cases in § Entry / § Exit — the user owns that session): defer, or ask the user.
6. Each exit costs the user an approval prompt — keep it rare (0–1 per phase).

---

## Difficulty escalation (ad-hoc entry) — a real decision gate, not routing

A main-chat phase may escalate **ad hoc** when it hits a genuinely hard decision, so the resulting
design/decision is written down and reviewed before execution continues. Triggers (any one):

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

The value here is the write stop itself: it prevents racing ahead on a hard call before the user has
actually seen it, independent of which model is doing the thinking.

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

Before adding a new entry to a skill, run it through § Wanneer plan mode above — do not add plan mode
to a phase whose exit would just be a summary.

---

## Conditional entry

Some skills enter plan mode only when a condition fires mid-flow: `dev-ship (refactor phase)` /
`game-ship (refactor phase)` after triage finds ≥1 HAS_FINDINGS; the `dev-ship (verify phase)`
fix-loop on SPEC or unclear-root-cause bugs; the `dev-ship (build phase)` / `game-ship (build phase)`
regression gate when the regression was not caused by the build itself; `design-convert`
(route-design.md PHASE 1.5) when the chosen action is a synthesis route (Page/Component/Flow/
Principles/Import/Brief) — CRUD and self-managed sub-routes do not enter. The Entry/Exit protocol
applies unchanged from the moment of entry. Document the condition at the entry point in the skill.
Any `dev-ship`/`game-ship` main-chat moment outside these catalogued entries may also escalate ad hoc
— see § Difficulty escalation above.

The `dev-ship (verify phase — PHASE 3 fix round)` / `game-ship (playtest fix round)` **round gate**
(`references/fix-round.md § Round gate`) is a plain conditional entry now: the manual/playtest
walkthrough itself no longer runs in plan mode (`manual-interview-walkthrough.md` — the round is an
interactive collection round, not a thinking phase that produces a plan), so **every** fix-round
entry, round 1 included, calls its own fresh `EnterPlanMode` the ordinary conditional way. There is
no more hand-off from an already-open walkthrough session.

---

## Used by

Full-phase: `game-debug`, `project-plan`, `project-seed` (incl. brainstorm/critique modes),
`project-research`, `dev-ship (define phase)`, `game-ship (define phase)`. The two `*-ship (define
phase)` entries are a **full-phase variant**: entry is at PHASE 0 Step 2b (before the interview, so
the whole define thinking-block is captured for review) and exit is the **plan-approval gate** itself
(Step 4b `ExitPlanMode`) — accept writes `feature.json` + starts build, reject stays in plan mode and
loops back to revise.

`dev-ship`'s in-ship debug rounds (`debug-round.md`, `debug-round-heavy.md`) are a **second full-phase
variant**, each opening its own session on a parked resume: entry is near the top of the file (§ 3
`Enter plan mode`, skipped only on the rarer proactive/already-in-plan-mode entry), exit is the
round's own fix-plan `ExitPlanMode` (`debug-round.md § 6` / `debug-round-heavy.md § 6`).

`dev-security` has one conditional entry left: **PHASE 5's fix-strategy gate**
(`references/fix-implement.md § PHASE 5 gate` — entry after the PHASE 4 fix-plans Workflow returns,
exit is the chosen-strategy/fix-set `ExitPlanMode`, the implementation go/no-go). **PHASE 3
aggregation/triage no longer enters plan mode** — a triage report is not a reviewable proposal
(`SKILL.md § PHASE 3`); this also removes the old "a Workflow cannot launch from inside plan mode"
constraint that used to force an early exit there.

Conditional entry (see § Conditional entry): `dev-ship (refactor phase)`, `game-ship (refactor
phase)`, `design-convert` (route-design.md PHASE 1.5 gate — synthesis routes only), the fix-round
gate (both dev-ship and game-ship, every round now, per § Conditional entry above). Self-managed
within a sub-route: `design-convert` Create (`references/route-create.md`) and Build
(`references/route-build.md` — enters at Step 0b, exits at Step 7 before worktree setup + codegen),
Convert (`references/route-convert.md` PHASE 0); `design-tokens` Create (`references/route-create.md`
— Steps 0b–7) and `website-sync.md` (Step 3 — single-shot review of the convert-list + exception
allowlist before any edit runs); `design-ship` Create Build
(`references/design-create/route-build.md` — enters at Step 0b, exits at Step 7 before Step 7b's
worktree setup + codegen, same shape as design-convert's Build route) and the direction brief
(`references/phase-0-direction-brief.md` — enters at Step 2, exits once `SHIP_PLAN` carries all
three required fields, presenting the Build route's BUILD PLAN block).

Authoritative for the above: `grep -rl "Entry protocol" skills/*/SKILL.md skills/*/references/*.md`
— **except** the two `*-ship (define phase)` full-phase variants, which call `EnterPlanMode` inline
at PHASE 0 Step 2b (referencing this file's Entry) rather than embedding the boilerplate Entry
section, so they do not appear in that grep; their entry point is documented at Step 2b of each
`phase-0-define-classify.md`.

Inline gates that call `EnterPlanMode` without the full Entry section (documented at the gate):
`dev-tweak` (SKILL.md PHASE 2 step 2 — Lane B/C per `shared/TWEAK-DISCIPLINE.md § Lane routing`, a
first-match decision table that writes a real design decision to the plan file before implementing —
this is a genuine gate per § Wanneer plan mode, not routing), `game-tweak` (SKILL.md PHASE 2 step 1 —
the § Difficulty escalation triggers verbatim, same shape), `core-audit` (`SKILL.md § Enter Plan
Mode`, between Step 2 and Step 3 — the analysis/scoring work; exit is the refactor proposal's own
approval gate, `references/refactor-plan.md § 5.2`, called even when the skill started already in
plan mode since the apply step needs writes).

**Removed** (were ceremony, not a gate — no longer call `EnterPlanMode`): the manual/playtest
walkthrough's own full-phase session (`dev-ship (verify phase — PHASE 3 manual)` /
`game-ship (playtest)`) — see `manual-interview-walkthrough.md` for why writes are now unrestricted
throughout the round; `dev-security` PHASE 3 aggregation/triage — see above.
