# Second Opinion Consult — Fable escalation at hard-thinking moments

At a small set of hard-thinking moments, a skill consults a stronger model (Fable) as an
independent second take before committing to a decision. This file is the single source of truth
for when, how, and what — hooks in the skills stay short and defer here.

**What this is NOT**: not a replacement for the existing opus judgment agents (verify, ship
security triage — those stay `model: "opus"`, unchanged), not a workflow orchestrator, and never
a fork (`shared/SKILL-PATTERNS.md § Fork Delegation`: independent judgment via inherited context
is contamination — forks also ignore model overrides). The consult is always a **fresh,
clean-context, read-only** agent.

**This is automatic**, not opt-in. A trigger firing is the authorization — there is no permission
prompt. The user (or the run) still has full control: attended runs can interrupt the wait,
and the digest never overrides a decision already made.

---

## Gate — when a consult fires

1. **Trigger** — a signal from the § Trigger table below fired for the current context. No
   trigger → no consult, no mention. Triggers are observable facts, not vibes.
2. **Auto-spawn** — the trigger fires the consult immediately, no confirmation step:
   - **Attended** (a user is present at this gate): print one line — `Consulting Fable (senior
second opinion) on {trigger, 1 line}…` — then spawn per § Spawn. The user can interrupt
     (Esc / stop) to skip the wait exactly as they'd interrupt any other agent call; that is the
     only skip path, there is no modal to decline.
   - **Unattended** (dev-ship/game-ship auto-mode, no user watching this gate): spawn per §
     Spawn with no announcement beyond the normal agent-call trace; never block on input that
     will never arrive.
   - **User-invoked** (a distinct authorization class, not a relaxation of the trigger-fired
     path above): the trigger IS the user's own request — either spoken (the generic row in
     § Trigger table below) or clicked, via a **"Second opinion (Fable)" option on an
     `AskUserQuestion` modal** (`shared/QUESTIONING.md § Second-Opinion Option` governs where
     that option is allowed to appear and its position rule — never option 1). Selecting it
     spawns per § Spawn scoped to the question at hand, then re-presents the same modal once
     with the digest visible. Still counts against the same budget below; still never
     auto-applies the recommendation.
3. **Budget** — max **1 consult per phase**, tracked durably wherever the skill already has a
   durable checkpoint (dev-ship/game-ship/dev-security: patch it into the checkpoint file the
   same way as other run state — never only in memory, or a cross-session resume or `/clear`
   silently re-fires it). Skills with no checkpoint (project-plan, project-seed, core-orchestrate,
   dev-tweak) track it in the plan-mode/session memory that already carries the rest of that run's
   state. dev-tweak needs no explicit slot bookkeeping: its only trigger is Lane C (a failed verify
   round), and a second failed round routes to `references/escalate.md` instead of a third lane, so
   a run cannot structurally reach a second consult.
   - **Round-aware contexts** (`fix-round.md`, debug ladders): the marker resets per round, not
     once for the whole phase — each new round is a fresh hard-thinking moment and gets its own
     budget slot.
   - **dev-ship/game-ship define is one shared slot, not per-dimension.** The interview
     (any dimension's modal) and the Step 4b gate hook draw from the **same single slot** for
     the whole define phase — whichever fires first consumes it, and the other is skipped
     (`unavailable (budget)`, not re-triggered). A per-dimension sub-budget was considered and
     rejected: define shares one context throughout, so a second consult mid-interview re-reads
     the same material for little marginal signal, and spending it early starves the run's
     highest-value moment (next bullet).
   - **Per-run backstop**: max **4 consults total per run**, across all phases/rounds combined,
     as a hard ceiling independent of the per-phase count. Most runs never approach it (they hit
     0-2 triggers); it exists purely to cap pathological cases (e.g. a heavy debug ladder
     re-triggering round after round). Once hit, later triggers in the same run are logged
     `unavailable (budget)` and skipped — never block the run to squeeze in a 5th. **One of the
     4 is reserved for the heavy debug ceiling** (`debug-round-heavy.md`) specifically — consumed
     in temporal order, an early-run consult spree (define, then a fix-round) would otherwise
     starve the dead-end consult that has the highest payoff in the run. Define + the gate
     hook + one ordinary fix-round consult still leaves that reserved slot untouched; only a
     4th non-debug trigger is turned away before the ceiling is reached.
4. Plan mode is fine: the consult agent is read-only (same footing as `define-scout`).

---

## Trigger table

| Context                                                                                                 | Trigger (any one → auto-fire; max 1/phase or /round, 4/run)                                                                                                                                                                                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dev-ship / game-ship define (gate, Step 4b)                                                             | (a) a design fork still had ≥2 viable options after the baseline gate (user hesitated, picked "Other", or asked for the recommendation); (b) cross-cutting architecture — `files[]` spans ≥3 top-level modules/dirs; (c) plan **rejected** at the Step 4b gate with feedback disputing the architecture (not wording)                                                                                                                                     |
| dev-ship / game-ship define (interview, PHASE 1a, any dimension)                                        | **user-invoked**: the dimension's modal is contested (`shared/QUESTIONING.md § Contested Dimension`) or was re-asked after an "I don't know" — the user clicks the modal's "Second opinion (Fable)" option (`shared/QUESTIONING.md § Second-Opinion Option`). Shares the gate's one slot per phase — whichever of the two fires first consumes it                                                                                                         |
| any consult-using skill, any interactive phase                                                          | the user explicitly asks for a second opinion / independent review, at any point before that context's own gate (e.g. mid-interview, before a design fork or the plan file even exists) — fires immediately with the same Spawn/Budget/Logging mechanics above; counts against the same per-phase/per-round and per-run budget. The define-interview row above is this same trigger given a clickable, modal-bound form — the spoken form still works too |
| dev-ship PHASE 3 / dev-manual MANUAL 1 / game-ship PHASE 3 fix-round gate (`fix-round.md` § Round gate) | a finding's root cause is still unclear after reviewing the ledger evidence (the "no guessed fix" case) — auto-fire before the round's fix design is written into the plan file                                                                                                                                                                                                                                                                           |
| debug heavy-round ceiling (dev-ship `debug-round-heavy.md`; game-debug PHASE 9)                         | heavy round / max-iteration fix failed — the dead-end itself is the trigger (always valid there); fires **before** the accept-or-park modal so the digest is visible when that modal is presented                                                                                                                                                                                                                                                         |
| dev-security triage (PHASE 3)                                                                           | (a) two sources give conflicting verdicts on the same finding (scanner vs tool vs ship-triage preload); (b) ≥1 CRITICAL finding with confidence < 80%; (c) anti-fantasy suspicion flagged AND the verdict flips on judgment                                                                                                                                                                                                                               |
| dev-security fix-strategy selection (PHASE 5, `references/fix-implement.md`)                            | the strategy-selection plan-mode gate is about to choose between minimal/thorough/defensive with no clear winner (a CRITICAL/HIGH finding where the strategies genuinely diverge in scope, not a cosmetic pick)                                                                                                                                                                                                                                           |
| game-debug fix-strategy selection (PHASE 6, Strategy step)                                              | the Fix Strategy choice (Minimal/Thorough/Defensive) is about to be made for a finding whose root cause spans multiple systems or has no clearly-dominant strategy                                                                                                                                                                                                                                                                                        |
| project-plan (before the P1 modal)                                                                      | (a) Scenario A semantic diff proposed MODIFIED/REMOVED for ≥3 existing features; (b) a circular dependency needed user intervention; (c) the degenerate-graph check fired (P1 ≥ 90%)                                                                                                                                                                                                                                                                      |
| project-plan (Seed Alignment Check, before ExitPlanMode)                                                | the Seed Alignment Check (`SKILL.md` PHASE 3) found ≥2 contradiction/new-direction drift items — a create-mode signal the P1-modal gate above cannot see (Scenario A diff requires an existing populated backlog, so a greenfield run that substantially overrides the seed would otherwise get no consult at all)                                                                                                                                        |
| project-seed (seed PHASE 4 / critique PHASE 6, pre-exit)                                                | (a) synthesis carries ≥2 unresolved mutually exclusive directions in Open Decisions; (b) critique leaves ≥3 high-impact problems whose fixes conflict or force a pivot                                                                                                                                                                                                                                                                                    |
| design-ship direction brief (Step 5)                                                                    | (a) the direction modal answered "Other" and the recompose loop ran; (b) the chosen direction conflicts with a `$DESIGN_LEVERS` warning or the seed's tone                                                                                                                                                                                                                                                                                                |
| core-orchestrate synthesis (PHASE 2, before the user-facing decision fork)                              | merging agent outputs surfaces a genuine decision fork (≥2 agents reached conflicting conclusions on the same question, or the synthesis itself is ambiguous about which path to recommend)                                                                                                                                                                                                                                                               |
| dev-tweak lane routing (PHASE 1 step 3 / PHASE 3 fail path)                                             | `shared/TWEAK-DISCIPLINE.md § Lane routing` row 2 fired — a verify round in this run failed, or a size-gate escalation was consciously overridden — lifting the run to Lane C; fires before the Lane C plan file's `ExitPlanMode`                                                                                                                                                                                                                         |

**Deliberately excluded** (considered, rejected — don't re-add without a new reason): dev-optimize
/ game-optimize PHASE 5 Pick Winner (data-driven — a second opinion doesn't change which measured
number is larger); core-orchestrate PHASE 4 Verify (duplicates the existing adversarial
`model: "opus"` verify pass the doc already carves out); game-debug PHASE 3 Root Cause Analysis
(firing before investigation contradicts `shared/DEBUG-LADDER.md`'s evidence-first discipline —
game-debug's consult stays at the PHASE 9 ceiling only).

---

## Spawn

Fresh agent via the `Agent` tool: `subagent_type: "general-purpose"`, `model: "fable"` (effort is
not settable via the Agent tool). **Fallback chain**: spawn error / model unavailable → retry
once with `model: "opus"`; that also fails → skip the consult entirely and log `unavailable`
(§ Logging) — never block the flow on an unavailable model, never retry more than once.

Brief = **paths, not content** (`shared/SKILL-PATTERNS.md § Pass Paths, Not Content`) plus a
compact context block (≤15 lines) and 2–4 explicit questions. Prompt template:

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

### Brief contents per context (pointer style)

| Context                    | INPUT paths                                                                                                                                              | QUESTIONS must cover                                                                                                                                                                                                            |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| define gate                | the gate plan file (already written at Step 4b step 1); `feature.json` paths of direct dependencies                                                      | is the chosen fork right; does the architecture hold at the seams; what breaks first                                                                                                                                            |
| define interview dimension | the backlog card path/description; the seed doc path; `feature.json` paths of direct dependencies; the dimension's competing readings inline (≤10 lines) | which reading the loaded evidence actually supports; what reading neither option named; what the recommended reading risks getting wrong                                                                                        |
| fix-round gate             | the findings ledger entry for the unclear finding; the file paths implicated by the ledger evidence                                                      | is there a plausible root cause in the evidence read so far; what untried angle should be checked before guessing a fix                                                                                                         |
| debug ceiling              | reproduction test path; the round's plan file; paths of files touched by the failed fix (from `git diff --stat`); failing output ≤10 lines inline        | is the root-cause diagnosis right; is there an untried angle; accept or park                                                                                                                                                    |
| security triage            | the audit state file; the cited source files of the disputed findings; the 2–5 disputed findings inline as compact JSON                                  | real or false positive, per disputed finding; does the verdict hold                                                                                                                                                             |
| security fix-strategy      | the finding(s) driving the strategy choice; the candidate strategies' scope (files/blast radius) inline                                                  | which strategy fits the finding's actual risk; what does the losing strategy get wrong                                                                                                                                          |
| game-debug fix-strategy    | the root-cause writeup; the candidate strategies inline                                                                                                  | which strategy fits the systems involved; what would the other strategy miss                                                                                                                                                    |
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
    decision already made, never auto-apply the recommendation. The user still decides.
- **Unattended** — there is no one to re-present a modal to. Main-chat Opus reads the digest and
  **re-decides itself**, weighing the rationale like any other piece of evidence — this is not
  "auto-applying the recommendation" blindly, it is Opus reasoning from the added information:
  - AGREE across the board → proceed as originally planned; log `consulted ({trigger})`.
  - DISAGREE / risks found → Opus weighs the risk against the original plan and picks — adjust the
    plan if the digest's case is stronger, keep it if not — then log which happened:
    `consulted ({trigger}) → revised` or `consulted ({trigger}) → confirmed`. Never stall the run
    waiting for a human who isn't coming; never proceed with the original plan without having
    actually weighed the digest first.
- **Malformed digest** (no `SECOND_OPINION_START/END` block) → treat as `unavailable`, do not
  re-spawn.

---

## Logging

Every pipeline's end report carries one line (values below cover both attended and unattended
outcomes):

- Ship-style ASCII tables (dev-ship / game-ship / design-ship): a `Consult:` row —
  `Consult:  {none | "{context}: consulted ({trigger})" | "{context}: consulted ({trigger}) → revised" | "{context}: unavailable"}`
- dev-security / project-plan / core-orchestrate report blocks: a `Second opinion: {…}` line, same
  values.
- Skills without a report table (project-seed): print the line once in chat, directly after the
  digest integration.

`none` means no trigger fired; `unavailable` means both fable and opus spawns failed, or the
per-run backstop cap was already hit (`unavailable (budget)`); `→ revised` means an unattended
DISAGREE digest changed the plan, `→ confirmed` means it didn't.

---

## Used by

`dev-ship` (define gate Step 4b; define **interview PHASE 1a**, per-dimension user-invoked click
— shares the gate's one slot; `fix-round.md` root-cause gate; heavy debug ceiling in
`debug-round-heavy.md`; report row) and `dev-manual` (shares `fix-round.md`/`debug-round-heavy.md`
with dev-ship, same hooks), `game-ship` (vendored define gate + `fix-round.md` — manual sync with
dev-ship's; the define-interview click is **dev-ship only for now** — `game-define`'s vendored
`phase1a-interview.md` lacks the Assumption Block the click's precedence rule depends on, so it
is not yet ported; see `CHANGELOG.md`'s entry for this change), `game-debug` (PHASE 6 fix-strategy; PHASE 9 fix ceiling),
`dev-security` (PHASE 3 triage escalation; PHASE 5 fix-strategy), `project-plan` (pre-P1 gate),
`project-seed` (seed/critique synthesis), `design-ship` (PHASE 0 direction brief),
`core-orchestrate` (PHASE 2 synthesis), `dev-tweak` (lane routing, PHASE 3 fail path —
session-memory budget per § Gate, no checkpoint). The existing opus spawns in `dev-ship` (verify,
ship security triage) and `core-orchestrate` (PHASE 4 verify) are NOT consults and stay unchanged.
