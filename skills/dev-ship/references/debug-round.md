# Debug Round — Light (dev-ship PHASE 3, tier 1)

Two entry points:

- **Primary** — loaded from `fix-round.md § Re-check` when an item's first batch fix attempt still
  fails (any `fail`-class finding, or a `fail`-sibling tweak) — always via a **parked resume**
  (`debugTier: "light"` set before the park, read by `phase-3-manual-finalize.md § Resume entry`).
  This is the common path.
- **Proactive** — loaded from `fix-round.md § Round gate` point 1, **Steps 4–5 only**, when a
  finding's root cause is still unclear before a first fix is even designed. This runs **inline**,
  inside the round gate's own already-open plan-mode session — no park, because there's no failed
  attempt yet to escalate from; it's evidence-gathering for the _first_ fix design.

This file is the ship's lightweight version of full root-cause investigation for **exactly one
ledger item**: an Explore investigation, Context7 research, and a single evidence-backed fix plan.
The heavy tier (`debug-round-heavy.md`, reached if this round's fix doesn't hold) also writes a
single evidence-backed plan — the difference is heavier investigation techniques
(`shared/DEBUG-TOOLBOX.md § Heavy techniques`), reproduction-test discipline, and a conditional
second-opinion consult on a still-contested diagnosis, not a wider process here.

## 1. Entry

Exactly one failing ledger item, plus its round history: the first fix attempt's notes
(`manual.fixPlan`/`manual.dispatch`), the re-check observations that followed, and the Step-D
evidence captured during the interview walkthrough (console errors, network responses, screenshots).
This is the input a fresh hypothesis needs — do not re-ask the user anything already in the ledger.

## 2. Bookkeeping before plan mode

Reuse the existing `waiting: "fix-plan"` signal — no new signal vocabulary.

- **Primary entry** (parked resume, plan mode not active yet in this fresh session): write the live
  signal now, before `EnterPlanMode`.
- **Proactive entry** (already inside the round gate's plan-mode session): the write is deferred to
  this file's own completion step (§ 7/8) alongside the other deferred writes, same as
  `fix-round.md § Hoisted bookkeeping`'s "already in plan mode" case.

## 3. Enter plan mode

`EnterPlanMode` per `shared/PLAN-MODE.md § Entry` — skip if a plan-mode session is already active
(the proactive-entry case, arriving from inside `fix-round.md`'s own plan-mode session). On a
primary (parked-resume) entry this is essentially always a fresh `EnterPlanMode` call. If the
investigation needs a **mutating** repro command (state reset, migration, destructive fixture), use
`shared/PLAN-MODE.md § Administrative exit` — exit with an administrative note, run it, **re-enter
immediately** — never continue the round outside plan mode silently.

## 3b. Difficulty triage

Score this item per `shared/DEBUG-LADDER.md § Difficulty triage` (5 signals → S/M/L) before
investigating. Persist `difficulty` + `difficultySignals` via the same `ship-checkpoint.js item`
upsert used elsewhere in this round (primary entry: now; proactive entry: deferred to this file's
completion step, same as § 2's bookkeeping). **S** → the investigation below still runs (this tier
already implies the cause wasn't obvious), but skip straight to forming the hypothesis from what
Explore returns. **M/L** → read `shared/DEBUG-TOOLBOX.md` and run 1–2 matching techniques as part of
§ 4/§ 5 before writing the hypothesis down; record which one ran (`technique` field, same upsert).

## 4. Investigation

Spawn one Explore agent (`subagent_type="Explore"`, `model: "sonnet"`, `thoroughness="very thorough"`)
to investigate in an isolated context — keeps source reads and git output out of the main session. **Read
`.claude/skills/dev-ship/references/debug-explore-agent-prompt.md` first** and use it verbatim as
the prompt template (do not write an ad hoc prompt), filling its placeholders from the ledger:

- `DEBUG_CONTEXT` → the STACK_CONTEXT/PROJECT_CONTEXT already loaded this verify session, plus this
  item's `manualReason` and category (TESTABLE/MEASURABLE).
- `PROBLEM` → the item's title, steps, observed vs expected, and the round history from § 1 above
  (prior attempts + why they didn't hold).

Parse only the `INVESTIGATION_START…END` block — the compact findings, not the raw reads.

A fork (`shared/SKILL-PATTERNS.md § Fork Delegation`) may replace this Explore dispatch: it inherits
`DEBUG_CONTEXT` and the round history, shrinking the prompt to the `PROBLEM` section plus the output
instruction. Same `INVESTIGATION_START…END` contract, read-only work only (plan mode is active). The
Explore path above remains the fallback and the default.

## 5. Root cause + Context7

Form the root-cause hypothesis from the investigation digest, following `shared/DEBUG-LADDER.md`'s
evidence-first discipline (state the hypothesis, name the confirming evidence, don't guess-and-check).

Finding implicates an external library API? Research it per `shared/CONTEXT7.md` now — both tools work
inside plan mode. Skip when the root cause is purely internal logic.

**Proactive-entry callers stop here** — `fix-round.md § Round gate` continues designing the fix from
this evidence itself; §§ 6–8 below apply only to the primary (parked) entry.

## 6. Single evidence-backed fix plan

Write one fix plan for this item — no 3-agent fan-out. `ExitPlanMode` is the go/no-go.

**Reject** → stay in plan mode, revise from the feedback, re-present, loop until accepted.

## 7. Execute

- **TESTABLE** → write a reproduction test (RED), apply the fix, get it green — inline in the main
  chat for a small, single-file fix; dispatch one `ship-fix.js` single-group wave
  (`fix-round.md § Dispatch`) if the fix spans multiple files or is large enough to warrant an
  isolated context.
- **MEASURABLE** → apply the fix directly; no reproduction test, live re-check covers it.

## 8. Re-check → 3-path verdict

Re-check via `manual-interview-walkthrough.md` Steps B–E for this one item (no new interview close).

- **Pass** → clear the item's `debugTier`, set `verdict: "pass"`. Return to
  `fix-round.md § Re-check` for any remaining items already mid-round, back to
  `phase-3-manual-finalize.md § Findings ledger + routing` if the scope check below split off a new
  item that hasn't been through a round-gate pass yet, straight to the regression re-check if this
  was the last open item, or — if another open item carries its own `debugTier` — route it per
  `phase-3-manual-finalize.md § Resume entry`'s per-item precedence.
- **Cosmetic tweak surfaces, and it's the only thing still open** (MEASURABLE, obvious, ≤1-2 files)
  → inline polish loop right here — no park, no new tier. Same skip-condition **and** capped
  mechanics as `fix-round.md § Re-check`'s cosmetic branch (3 attempts, `tweakAttempts` tracked on
  the item). If it doesn't converge after 3 tries, **"Escalate" folds into this section's own
  "Still failing" branch below** (park to `debugTier: "heavy"`) rather than fix-round.md's
  light-tier park — you're already past light, there's nowhere lower to send it.
- **Still failing on its own `expected` text** (the scope check in `manual-interview-walkthrough.md
§ Step D` already split off anything unrelated) → this light round's one evidence-backed attempt
  didn't hold.
  1. **Re-score first** — a failed round is new evidence; re-run `shared/DEBUG-LADDER.md § Difficulty
triage` before deciding anything below (a signal like reproducibility or origin can flip once
     you've seen the fix not hold). Fold the updated score into the same durable write in step 2.
  2. **Always first, regardless of what happens next** (durability — a park, or the session simply
     ending, must never lose this): in **one** `ship-checkpoint.js item` call (never two separate
     calls — a torn write between them is unrecoverable state, see
     `phase-3-manual-finalize.md § Resume entry`), patch the item: `debugTier: "heavy"`, the re-scored
     `difficulty`/`difficultySignals`, clear `tweakAttempts` if arriving here via an escalated tweak
     loop, and `lightRoundNotes` (a compact string): the § 4 investigation digest's key lines (error
     location, root code, pitfall match), the § 5 hypothesis and its confirming/refuting evidence, the
     fix applied, and what the § 8 re-check actually observed — on a tweak escalation, note explicitly
     that it was first judged a simple cosmetic fix and didn't hold after 3 tries, so the heavy round
     doesn't waste its own first pass re-deriving that. This is the only thing the heavy round has
     to go on — write it as if handing the case to someone who wasn't in this session.
  3. `AskUserQuestion` — header: "Debug ladder", question: "The light round didn't hold for {title}.
     How do you want to proceed?":
     - **"Escalate now, same session (Recommended)"** → skip straight to
       `debug-round-heavy.md § 1`'s same-session entry variant, reusing the current plan-mode
       session. Step 2's durable write above already covers a crash mid-heavy-round.
     - **"Instrument + user-in-the-loop repro"** — offer this option only when the item looks
       unreproducible by the agent itself (real credentials, a specific device, a
       perception-triggered symptom — the M/L signals from step 1 pointing that way) → run
       `shared/DEBUG-TOOLBOX.md § User-in-the-loop repro` right here, in this same round, before
       deciding escalation: instrument, hand the user a repro script, read the resulting log, fold
       what it shows into a fresh hypothesis. Converges → treat as a normal Pass above. Still
       unresolved → fall through to one of the other three options with the new evidence in hand.
     - **"Park — resume in a fresh session"** → continue with steps 4-6 below.
     - **"Accept as known limitation now"** → skip the heavy round entirely: `verdict: "accepted"`,
       clear `debugTier`/`tweakAttempts` (omit, not null — same mechanics as
       `debug-round-heavy.md § 8`'s own accept branch), proceed to the regression re-check with this
       item excluded from the pass/fail count.
  4. (park path only) `node ~/.claude/scripts/ship-checkpoint.js signal-clear {feature}`.
  5. (park path only) Print the park/handoff template (`SKILL.md § PHASE 1–4`) with
     `/dev-manual {feature}` as the resume command (`/dev-ship {feature}` still resumes to the same
     place). **End the turn.**
  6. (park path only) A fresh session resumes via `phase-3-manual-finalize.md § Resume entry`'s
     `debugTier: "heavy"` branch, landing directly in `references/debug-round-heavy.md`, which reads
     `lightRoundNotes` instead of re-running Explore (`debug-round-heavy.md § 4`).
