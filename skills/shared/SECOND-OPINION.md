# Consult — independent second opinion and sparring

At a small set of hard-thinking moments, a skill consults an independent counterpart before
committing to a decision — sometimes a fresh Fable spawn, sometimes a fresh Opus spawn, and
sometimes the answer is "explore instead" or "ask the user instead." This file is the single source
of truth for whether to fire, who to fire at, how many rounds, and what — hooks in the skills stay
short and defer here.

**What this is NOT**: not a replacement for the existing opus judgment agents (verify, ship
security triage — those stay `model: "opus"`, unchanged), not a workflow orchestrator, and never
a fork (`shared/SKILL-PATTERNS.md § Fork Delegation`: independent judgment via inherited context
is contamination — forks also ignore model overrides). The consult is always a **fresh,
clean-context, read-only** agent. Fable is **not a source of facts** — a factual gap never routes
here, it routes to an explore agent (§ Route).

**This is automatic**, not opt-in. A trigger firing is the authorization — there is no permission
prompt. The user (or the run) still has full control: attended runs can interrupt the wait,
and the digest never overrides a decision already made.

---

## Auto-spawn — authorization classes

Once Gate 0 and the trigger table both clear, the spawn happens immediately — no confirmation step,
not even via `AskUserQuestion`:

- **Attended** (a user is present at this gate): print one line — `Consulting {Fable|Opus} on
{trigger, 1 line}…` — then spawn per § Spawn. The user can interrupt (Esc/stop) to skip the wait
  exactly as they'd interrupt any other agent call; that is the only skip path, there is no modal to
  decline.
- **Unattended** (dev-ship/game-ship auto-mode, no user watching this gate): spawn per § Spawn with
  no announcement beyond the normal agent-call trace; never block on input that will never arrive.
- **User-invoked** (a distinct authorization class, not a relaxation of the trigger-fired path
  above): the trigger IS the user's own request — either spoken (the generic trigger-table row) or
  clicked, via a "Second opinion" option on an `AskUserQuestion` modal
  (`shared/QUESTIONING.md § Second-Opinion Option` governs where that option is allowed to appear
  and its position rule — never option 1). Selecting it spawns per § Spawn scoped to the question at
  hand, then re-presents the same modal once with the digest visible. Still subject to Gate 0 and
  the per-run backstop below; still never auto-applies the recommendation.

---

## Gate 0 — consequence precondition

Before the trigger table below even applies: fire only where a wrong answer would change
`feature.json#architecture`, `#durableDecisions`, or the REQ scope of the feature under work (or
the equivalent durable decision surface for non-dev-ship skills — a security fix's blast radius, a
seed's core direction, a plan's dependency graph). This is the same line
`dev-define/workflow.md:150` already draws for `AskUserQuestion` itself ("edge cases, validation
rules, input notation → add directly as acceptance criteria, no AskUserQuestion") — reused here so a
trivial step is **structurally excluded**, not merely budget-throttled. A trigger from the table
below that does not clear this precondition does not fire, full stop — it is not logged as
`unavailable`, because it was never a candidate.

---

## Route — what kind of gap is this

Before spawning anything, name what would actually settle the question. This is a testable
self-check ("what would settle this"), not a vibe ("am I unsure"):

| What would settle it                                 | Route                                                                                                                                             |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| A file, doc, or command                              | **Explore** — a Sonnet Explore agent, or `define-scout`'s own second scoped call (§ Explore-first). Never Fable — Fable is not a source of truth. |
| Only the user's own opinion                          | **Ask the user.** Never spar over a preference — that launders "I should have asked" into an agent call.                                          |
| Nothing — two defensible designs genuinely trade off | **Spar** (§ Mode, § Counterpart)                                                                                                                  |
| Both an artefact and a genuine trade-off             | **Explore, then spar** — in that order. Sparring over an unverified premise is worse than not sparring at all.                                    |
| You cannot name what would settle it                 | You don't understand the question yet. Decompose it — do not spawn anything.                                                                      |

The trigger table (§ below) tells you **when** in a skill's flow this check applies; this table
tells you **what to do** once it does.

---

## Mode — one-shot by default, sparring is bounded

Default is a single digest, integrated per § Integrating below. A second round is a deliberate
escalation, not automatic:

- **Round 2 fires only when the main chat can cite a specific, concrete factual error or
  unsupported premise in round 1's digest** — a path/line that disproves a claim it made. Never
  "what do you think of my answer" — that is not a citable correction, it is fishing for a
  different verdict.
- **Hard cap: 2 rounds.** Once the cited premise is corrected, a third round is theatre — there is
  no round 3, ever.
- **Mechanism**: `SendMessage` to the consult agent's id/name resumes it from its own transcript
  (`shared/SKILL-PATTERNS.md § Agent Resume (Sparring)`) — the correction only needs to state
  itself, not restate the brief. Round 2's reply follows the same `SECOND_OPINION_START/END`
  contract. Fallback: if resume is unavailable, fall back to the round-1 digest and log it.
  A spar of 2 rounds still counts as **one** consult against the budget below.
- **Pre-register a position before spawning round 1** — one line, in the plan file or in-memory
  scratch, stating what the main chat would decide without the consult. This makes `→ revised` /
  `→ confirmed` in § Logging falsifiable instead of a rubber stamp, and it is the anti-oracle
  device: the counterpart's job is to attack a stated position, not to hand down a verdict the main
  chat then just adopts.
- **Attended runs never auto-apply a DISAGREE** (§ Integrating) — a second round there mostly buys
  waiting, not a better outcome, since the user re-decides either way. Round 2 earns its keep most
  clearly in **unattended** runs, where Opus alone re-decides from the corrected digest.

---

## Latency — a detected trigger never blocks the interactive flow

A trigger the caller **detects itself** mid-flow (not a user click) never stalls a live interaction
waiting on the spawn: dispatch it, do not end the turn to wait, and keep going — the digest lands as
a background task-notification and is read at the run's next natural stop (a gate, a checkpoint), not
forced into the moment it fired. A user-clicked trigger is the opposite by design — the user asked
for it and is waiting on the modal it re-presents. Never let two consults block the same interactive
moment sequentially; a detected trigger and a clicked trigger may both be in flight, but neither
should make the user watch a second spinner after the first already resolved.

---

## Counterpart — who spars

Independence is the mechanism, not a bonus — `§ What this is NOT` above already grounds the whole
value of a consult in fresh, uncontaminated context, and that holds regardless of which model is
doing the reading:

- **Fable** — a genuine **difficulty gap**: the Step 4b define gate, a debug ceiling, real
  architecture with no clear winner. Reach for the strongest model when the judgment itself is hard.
- **Opus** — an **anchoring gap**: many turns deep into one framing, committed to a reading that
  fresh eyes might catch. Independence is the whole win here; Fable's extra strength is not worth
  its extra latency at an interactive moment. This is also the automatic fallback when Fable is
  unavailable (§ Spawn).
- **Sonnet — never a sparring partner.** Sonnet explores; it does not judge. A Sonnet spawn under
  this file is always routed via § Route's explore arm, never spawned as a counterpart to a spar.

---

## Explore-first

When § Route says explore (alone, or before a spar): do not build a parallel explorer. Use
`agents/define-scout.md` (a second scoped call, or a fresh `researchTopics` list) for define-phase
work, or a plain Sonnet Explore agent elsewhere (`shared/SKILL-PATTERNS.md § Agent Model
Selection`). This section only exists so a skill hook doesn't reinvent a research agent — the
digest contract for the actual spar is unaffected.

---

## Budget

Gate 0 is the primary rationing device now — most triviality is excluded before the trigger table
is even consulted, so there is no separate per-phase counter to maintain.

**Per-run backstop**: max **4 consults total per run**, across all phases/rounds combined, purely
as a ceiling against pathological cases (a heavy debug ladder re-triggering round after round).
Once hit, later triggers in the same run are logged `unavailable (budget)` and skipped — never
block the run to squeeze in a 5th. **One of the 4 is reserved for the heavy debug round**
(`debug-round-heavy.md`; game-debug PHASE 5-9) — consumed in temporal order, so an early-run consult
spree does not starve the run's highest-payoff moment. A 2-round spar still counts as one consult
against this backstop.

**Round-aware contexts** (`fix-round.md`, debug ladders): a fresh round is a fresh hard-thinking
moment and is free to consult again, subject only to the per-run backstop.

**`project-seed` keeps its own unconditional override** (`references/mode-seed.md`): every
seed/concept save always gets a Fable check, regardless of gate 0 or the trigger table — this is
project-seed's own documented exception, not a relaxation of the shared rule.

---

## Trigger table

| Context                                                                                                 | Trigger (any one → auto-fire, subject to Gate 0 and the 4/run backstop)                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dev-ship / game-ship define (gate, Step 4b)                                                             | (a) a design fork still had ≥2 viable options after the baseline gate (user hesitated, picked "Other", or asked for the recommendation); (b) **default** — fires whenever the plan-approval gate's own de-escalation check (`shared/TWEAK-DISCIPLINE.md § Size gate` criteria 1-4) found the draft NOT tweak-sized; skip only when the draft IS tweak-sized; (c) plan **rejected** at the Step 4b gate with feedback disputing the architecture (not wording). Counterpart: **Fable** (difficulty gap). |
| dev-ship / game-ship define (interview, PHASE 1a, any dimension)                                        | **user-invoked**: the dimension's modal is contested (`shared/QUESTIONING.md § Contested Dimension`) or was re-asked after an "I don't know" — the user clicks the modal's "Second opinion" option (`shared/QUESTIONING.md § Second-Opinion Option`). Counterpart: **Opus** (anchoring gap — mid-interview, independence over strength; § Counterpart) unless Fable is explicitly requested.                                                                                                            |
| dev-define interactive trigger, detected (not clicked) — new                                            | the user's answer contradicts a cited source (a struck Assumption Block bullet, `shared/QUESTIONING.md § Cite-or-ask` + struck-bullet tracking) **or** invalidates an already-extracted REQ — both are observable facts a model can check about itself, not a vibe. Never blocks the interview interactively (`dev-define/workflow.md § PHASE 1b` latency rule) — queue it, land it at the next consequence point (PHASE 1b forks or the Step 4b gate). Counterpart: **Opus**.                          |
| any consult-using skill, any interactive phase                                                          | the user explicitly asks for a second opinion / independent review, at any point before that context's own gate — fires immediately with the same Spawn/Route/Counterpart mechanics above. The define-interview row above is this same trigger given a clickable, modal-bound form — the spoken form still works too.                                                                                                                                                                                   |
| dev-ship PHASE 3 / dev-manual MANUAL 1 / game-ship PHASE 3 fix-round gate (`fix-round.md` § Round gate) | **narrowed**: a finding's root cause is still unclear **and** the fix approach under consideration would touch architecture or a durable decision (Gate 0) — most fix-round findings do not clear this bar; for an ordinary unclear root cause, spend the budget on a second Sonnet Explore pass instead (§ Route), not a consult. Counterpart when it does fire: **Fable**.                                                                                                                            |
| debug heavy round — fix plan (dev-ship `debug-round-heavy.md § 5`; game-debug PHASE 5)                  | the diagnosis is still contested when the round's one fix plan is drafted: `lightRoundNotes` shows the light-tier hypothesis was refuted, or this is a non-ledger entry with no prior-tier history (dev); PHASE 3 confidence is medium/low, or the root cause spans multiple systems (game) — fires **before** `ExitPlanMode`. Counterpart: **Fable**.                                                                                                                                                  |
| debug heavy-round ceiling (dev-ship `debug-round-heavy.md § 8`; game-debug PHASE 9)                     | heavy round / max-iteration fix failed — the dead-end itself is the trigger (always valid there); fires **before** the accept-or-park modal. Counterpart: **Fable**.                                                                                                                                                                                                                                                                                                                                    |
| dev-security triage (PHASE 3)                                                                           | (a) two sources give conflicting verdicts on the same finding (scanner vs tool vs ship-triage preload); (b) ≥1 CRITICAL finding with confidence < 80%; (c) anti-fantasy suspicion flagged AND the verdict flips on judgment. Counterpart: **Fable**.                                                                                                                                                                                                                                                    |
| dev-security fix-strategy selection (PHASE 5, `references/fix-implement.md`)                            | the strategy-selection plan-mode gate is about to choose between minimal/thorough/defensive with no clear winner. Counterpart: **Fable**.                                                                                                                                                                                                                                                                                                                                                               |
| project-plan (before the P1 modal)                                                                      | (a) Scenario A semantic diff proposed MODIFIED/REMOVED for ≥3 existing features; (b) a circular dependency needed user intervention; (c) the degenerate-graph check fired (P1 ≥ 90%). Counterpart: **Fable**.                                                                                                                                                                                                                                                                                           |
| project-plan (Seed Alignment Check, before ExitPlanMode)                                                | the Seed Alignment Check found ≥2 contradiction/new-direction drift items. Counterpart: **Fable**.                                                                                                                                                                                                                                                                                                                                                                                                      |
| project-seed (seed PHASE 4 / critique PHASE 6, pre-exit)                                                | seed PHASE 4 always fires (§ Budget override); critique PHASE 6: ≥3 high-impact problems whose fixes conflict or force a pivot. Counterpart: **Fable**.                                                                                                                                                                                                                                                                                                                                                 |
| design-ship direction brief (Step 5)                                                                    | (a) the direction modal answered "Other" and the recompose loop ran; (b) the chosen direction conflicts with a `$DESIGN_LEVERS` warning or the seed's tone. Counterpart: **Fable**.                                                                                                                                                                                                                                                                                                                     |
| core-orchestrate synthesis (PHASE 2, before the user-facing decision fork)                              | merging agent outputs surfaces a genuine decision fork. Counterpart: **Fable**.                                                                                                                                                                                                                                                                                                                                                                                                                         |
| dev-tweak lane routing (PHASE 1 step 3 / PHASE 3 fail path)                                             | `shared/TWEAK-DISCIPLINE.md § Lane routing` row 2 fired — a verify round in this run failed, or a size-gate escalation was consciously overridden — lifting the run to Lane C. Counterpart: **Fable**.                                                                                                                                                                                                                                                                                                  |

**Deliberately excluded** (considered, rejected — don't re-add without a new reason): dev-optimize
/ game-optimize PHASE 5 Pick Winner (data-driven — a second opinion doesn't change which measured
number is larger); core-orchestrate PHASE 4 Verify (duplicates the existing adversarial
`model: "opus"` verify pass the doc already carves out); game-debug PHASE 3 Root Cause Analysis
(firing before investigation contradicts `shared/DEBUG-LADDER.md`'s evidence-first discipline —
game-debug's consult stays at the PHASE 9 ceiling only).

---

## Spawn

Fresh agent via the `Agent` tool: `subagent_type: "general-purpose"`, `model:` per § Counterpart
(`"fable"` or `"opus"`; effort is not settable via the Agent tool). **Fallback chain**: `fable`
spawn error / model unavailable → retry once with `model: "opus"`; that also fails → skip the
consult entirely and log `unavailable` (§ Logging) — never block the flow on an unavailable model,
never retry more than once.

Brief = **paths, not content** (`shared/SKILL-PATTERNS.md § Pass Paths, Not Content`) plus a
compact context block (≤15 lines) and 2–4 explicit questions, plus the pre-registered position from
§ Mode. Prompt template:

```
You are an independent second-opinion reviewer (fresh context, read-only). You did NOT produce
the work under review — judge it adversarially but fairly. Do not modify any file; do not write
to .project/.

TASK: review the {artifact — plan file / evidence dossier / findings} for "{feature|target}"
and answer the questions below.

INPUT — read these paths yourself:
- {path 1}
- {path 2}

CONTEXT (compact, ≤15 lines):
{stack · the trigger that caused this consult · the competing options, 1 line each}

OUR POSITION (what we'd decide without this consult, so you can attack it directly):
{1 line}

QUESTIONS — answer each with AGREE / DISAGREE / UNSURE plus rationale:
1. {…}
2. {…}

Return ONLY this delimited digest (≤30 lines), nothing else:
SECOND_OPINION_START
context: {skill}/{phase} · trigger: {signal}
Q1: AGREE|DISAGREE|UNSURE — {1-2 line rationale}
Q2: …
RISKS MISSED:
- {risk the plan/verdict overlooks} ({where})
RECOMMENDATION: {1-3 lines, concrete}
CONFIDENCE: high|medium|low — {why, a few words}
SECOND_OPINION_END
```

A round-2 rebuttal (§ Mode) sends only the cited correction — no need to resend TASK/INPUT/CONTEXT —
and expects the same delimited digest back.

### Brief contents per context (pointer style)

| Context                    | INPUT paths                                                                                                                                              | QUESTIONS must cover                                                                                                                                                                                                            |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| define gate                | the gate plan file (already written at Step 4b step 1); `feature.json` paths of direct dependencies                                                      | is the chosen fork right; does the architecture hold at the seams; what breaks first                                                                                                                                            |
| define interview dimension | the backlog card path/description; the seed doc path; `feature.json` paths of direct dependencies; the dimension's competing readings inline (≤10 lines) | which reading the loaded evidence actually supports; what reading neither option named; what the recommended reading risks getting wrong                                                                                        |
| define interactive trigger | the struck Assumption Block bullet or invalidated REQ; the cited source that contradicts it                                                              | does the new answer genuinely invalidate the prior decision; what is the smallest correct revision                                                                                                                              |
| fix-round gate             | the findings ledger entry for the unclear finding; the file paths implicated by the ledger evidence                                                      | is there a plausible root cause in the evidence read so far; what untried angle should be checked before guessing a fix                                                                                                         |
| debug fix plan             | the fix plan as drafted so far; the evidence paths behind it (light-round investigation digest / PHASE 3-4 root-cause writeup)                           | is the root-cause diagnosis right given the evidence; what untried angle should be checked before committing to this plan                                                                                                       |
| debug ceiling              | reproduction test path; the round's plan file; paths of files touched by the failed fix (from `git diff --stat`); failing output ≤10 lines inline        | is the root-cause diagnosis right; is there an untried angle; accept or park                                                                                                                                                    |
| security triage            | the audit state file; the cited source files of the disputed findings; the 2–5 disputed findings inline as compact JSON                                  | real or false positive, per disputed finding; does the verdict hold                                                                                                                                                             |
| security fix-strategy      | the finding(s) driving the strategy choice; the candidate strategies' scope (files/blast radius) inline                                                  | which strategy fits the finding's actual risk; what does the losing strategy get wrong                                                                                                                                          |
| project-plan               | seed doc path; `backlog.json`; the diff table / dependency tree inline (≤20 lines)                                                                       | is the reconcile/P1 cut right; what's missing for a working prototype                                                                                                                                                           |
| project-plan (seed drift)  | seed doc path; the drift table inline (≤20 lines); `backlog.json`                                                                                        | is the drift justified by the run's own findings; what does the proposed seed rewrite miss                                                                                                                                      |
| project-seed               | the plan file (concept doc draft)                                                                                                                        | which direction is stronger and why; what would kill this idea                                                                                                                                                                  |
| design direction           | spec (path or inline SPEC block); the 2–3 direction summaries inline; `$DESIGN_LEVERS` warnings; seed name+pitch                                         | which direction serves the archetype/audience; what the compositions miss                                                                                                                                                       |
| orchestrate synthesis      | the per-agent findings (paths or inline digest); the ambiguous decision point, 1 line                                                                    | which conclusion the evidence actually supports; what's still unresolved                                                                                                                                                        |
| tweak lane C               | the Lane C plan file; the located file paths (paths, not content); the failed round's reason or the overridden size-gate criterion inline                | is the diagnosed cause the real one given the evidence so far; what untried angle deserves a check before the next pass; what breaks first — deliberately never "is this ship-sized" (the size gate already owns that question) |

---

## Integrating the digest

The digest is **advisory**. Who acts on it depends on whether a user is at this gate right now:

- **Attended** — show the digest verbatim (it is ≤30 lines) in chat.
  - AGREE across the board → proceed; note it in the log line.
  - DISAGREE / risks found → fold the disagreement into the pending gate or modal (re-present the
    choice once with the digest's recommendation visible) — never silently override a user
    decision already made, never auto-apply the recommendation. The user still decides. A round-2
    rebuttal is rarely worth spawning here (§ Mode) — the user re-decides regardless.
- **Unattended** — there is no one to re-present a modal to. Main-chat Opus reads the digest and
  **re-decides itself against the pre-registered position** (§ Mode), weighing the rationale like
  any other piece of evidence:
  - AGREE across the board → proceed as originally planned; log `consulted ({trigger})`.
  - DISAGREE / risks found → Opus weighs the risk against the pre-registered position and picks —
    adjust the plan if the digest's case is stronger, keep it if not — then log which happened:
    `consulted ({trigger}) → revised` or `consulted ({trigger}) → confirmed`. If the digest's
    disagreement rests on a citable factual error, spawn round 2 (§ Mode) before deciding. Never
    stall the run waiting for a human who isn't coming.
- **Malformed digest** (no `SECOND_OPINION_START/END` block) → treat as `unavailable`, do not
  re-spawn.

---

## Logging

Every pipeline's end report carries one line (values below cover both attended and unattended
outcomes):

- Ship-style ASCII tables (dev-ship / game-ship / design-ship): a `Consult:` row —
  `Consult:  {none | "{context}: consulted ({trigger})" | "{context}: consulted ({trigger}) → revised" | "{context}: consulted ({trigger}) → confirmed" | "{context}: sparred (2 rounds) → revised" | "{context}: sparred (2 rounds) → confirmed" | "{context}: unavailable"}`
- dev-security / project-plan / core-orchestrate report blocks: a `Second opinion: {…}` line, same
  values.
- Skills without a report table (project-seed): print the line once in chat, directly after the
  digest integration.

`none` means no trigger fired, or a trigger fired but Gate 0 excluded it; `unavailable` means both
fable and opus spawns failed, or the per-run backstop cap was already hit (`unavailable (budget)`);
`→ revised` means the digest changed the plan (measured against the pre-registered position),
`→ confirmed` means it didn't; `sparred (2 rounds)` marks a round-2 rebuttal.

---

## Used by

`dev-ship` (define gate Step 4b; define **interview PHASE 1a**, per-dimension user-invoked click;
the new detected interactive trigger; `fix-round.md` root-cause gate, narrowed to architecture-
touching fixes; heavy debug round in `debug-round-heavy.md` — § 5 fix-plan hook and § 8 ceiling
share the round's slot; report row) and `dev-manual` (shares `fix-round.md`/`debug-round-heavy.md`
with dev-ship, same hooks), `game-ship` (vendored define gate + `fix-round.md` — manual sync with
dev-ship's; the define-interview click and the detected interactive trigger are **dev-ship only for
now** — `game-define`'s vendored `phase1a-interview.md` lacks the Assumption Block the click's
precedence rule depends on, so it is not yet ported; see `CHANGELOG.md`'s entry for this change),
`game-debug` (PHASE 5 fix-plan hook; PHASE 9 fix ceiling — same shared-slot rule), `dev-security`
(PHASE 3 triage escalation; PHASE 5 fix-strategy), `project-plan` (pre-P1 gate), `project-seed`
(seed/critique synthesis — seed keeps its unconditional override), `design-ship` (PHASE 0 direction
brief), `core-orchestrate` (PHASE 2 synthesis), `dev-tweak` (lane routing, PHASE 3 fail path). The
existing opus spawns in `dev-ship` (verify, ship security triage) and `core-orchestrate` (PHASE 4
verify) are NOT consults and stay unchanged.
