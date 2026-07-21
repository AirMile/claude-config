# Second Opinion Consult — Fable escalation at hard-thinking moments

At a small set of hard-thinking moments, a skill may consult a stronger model (Fable) as an
independent second take before committing to a decision. This file is the single source of truth
for when, how, and what — hooks in the skills stay short and defer here.

**What this is NOT**: not a replacement for the existing opus judgment agents (verify, ship
security triage — those stay `model: "opus"`, unchanged), not a workflow orchestrator, and never
a fork (`shared/SKILL-PATTERNS.md § Fork Delegation`: independent judgment via inherited context
is contamination — forks also ignore model overrides). The consult is always a **fresh,
clean-context, read-only** agent.

---

## Gate — when a consult may be offered

1. **Trigger** — a signal from the § Trigger table below fired for the current context. No
   trigger → no offer, no mention. Triggers are observable facts, not vibes.
2. **Confirm** — one `AskUserQuestion` (template below). The user approves the cost every time.
   Exception: at a debug dead-end the consult is an extra option inside the existing
   accept-or-park modal — choosing it is the confirmation.
3. **Budget** — max **1 consult per phase** per run. Track in memory as `secondOpinionUsed`;
   once used (or declined), later triggers in the same phase stay silent.
4. Plan mode is fine: the consult agent is read-only (same footing as `define-scout`).

### Confirm modal (template)

- header: "Second opinion"
- question: "Trigger: {signal, 1 line}. Consult Fable — a stronger model, fresh context,
  read-only — for an independent second take before continuing? One agent call."
- options:
  - "Consult Fable (Recommended)" — spawn per § Spawn below
  - "Skip" — continue without; log `declined` per § Logging
- multiSelect: false

---

## Trigger table

| Context                                                                         | Trigger (any one → offer; max 1/phase)                                                                                                                                                                                                                                                                                |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| dev-ship / game-ship define (gate, Step 4b)                                     | (a) a design fork still had ≥2 viable options after the baseline gate (user hesitated, picked "Other", or asked for the recommendation); (b) cross-cutting architecture — `files[]` spans ≥3 top-level modules/dirs; (c) plan **rejected** at the Step 4b gate with feedback disputing the architecture (not wording) |
| debug heavy-round ceiling (dev-ship `debug-round-heavy.md`; game-debug PHASE 9) | heavy round / max-iteration fix failed — the dead-end itself is the trigger (always valid there)                                                                                                                                                                                                                      |
| dev-security triage (PHASE 3)                                                   | (a) two sources give conflicting verdicts on the same finding (scanner vs tool vs ship-triage preload); (b) ≥1 CRITICAL finding with confidence < 80%; (c) anti-fantasy suspicion flagged AND the verdict flips on judgment                                                                                           |
| project-plan (before the P1 modal)                                              | (a) Scenario A semantic diff proposed MODIFIED/REMOVED for ≥3 existing features; (b) a circular dependency needed user intervention; (c) the degenerate-graph check fired (P1 ≥ 90%)                                                                                                                                  |
| project-seed (seed PHASE 4 / critique PHASE 6, pre-exit)                        | (a) synthesis carries ≥2 unresolved mutually exclusive directions in Open Decisions; (b) critique leaves ≥3 high-impact problems whose fixes conflict or force a pivot                                                                                                                                                |
| design-ship direction brief (Step 5)                                            | (a) the direction modal answered "Other" and the recompose loop ran; (b) the chosen direction conflicts with a `$DESIGN_LEVERS` warning or the seed's tone                                                                                                                                                            |

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

| Context          | INPUT paths                                                                                                                                       | QUESTIONS must cover                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| define gate      | the gate plan file (already written at Step 4b step 1); `feature.json` paths of direct dependencies                                               | is the chosen fork right; does the architecture hold at the seams; what breaks first |
| debug ceiling    | reproduction test path; the round's plan file; paths of files touched by the failed fix (from `git diff --stat`); failing output ≤10 lines inline | is the root-cause diagnosis right; is there an untried angle; accept or park         |
| security triage  | the audit state file; the cited source files of the disputed findings; the 2–5 disputed findings inline as compact JSON                           | real or false positive, per disputed finding; does the verdict hold                  |
| project-plan     | seed doc path; `backlog.json`; the diff table / dependency tree inline (≤20 lines)                                                                | is the reconcile/P1 cut right; what's missing for a working prototype                |
| project-seed     | the plan file (concept doc draft)                                                                                                                 | which direction is stronger and why; what would kill this idea                       |
| design direction | spec (path or inline SPEC block); the 2–3 direction summaries inline; `$DESIGN_LEVERS` warnings; seed name+pitch                                  | which direction serves the archetype/audience; what the compositions miss            |

---

## Integrating the digest

The digest is **advisory**. The main chat stays the decision-maker; the user stays the approver:

- Show the digest verbatim (it is ≤30 lines) in chat.
- AGREE across the board → proceed; note it in the log line.
- DISAGREE / risks found → fold the disagreement into the pending gate or modal (re-present the
  choice once with the digest's recommendation visible) — never silently override a user
  decision already made, never auto-apply the recommendation.
- Malformed digest (no `SECOND_OPINION_START/END` block) → treat as `unavailable`, do not
  re-spawn.

---

## Logging

Every pipeline's end report carries one line (`consulted` includes the trigger):

- Ship-style ASCII tables (dev-ship / game-ship / design-ship): a `Consult:` row —
  `Consult:  {none | "{context}: consulted ({trigger})" | "{context}: declined" | "{context}: unavailable"}`
- dev-security / project-plan report blocks: a `Second opinion: {…}` line, same values.
- Skills without a report table (project-seed): print the line once in chat, directly after the
  digest integration.

`none` means no trigger fired; `declined` means offered and skipped; `unavailable` means both
fable and opus spawns failed.

---

## Used by

`dev-ship` (define gate Step 4b; heavy debug ceiling in `debug-round-heavy.md`; report row),
`game-ship` (vendored define gate — manual sync with dev-ship's), `game-debug` (PHASE 9 fix
ceiling), `dev-security` (PHASE 3 triage escalation), `project-plan` (pre-P1 gate),
`project-seed` (seed/critique synthesis), `design-ship` (PHASE 0 direction brief). The existing
opus spawns in `dev-ship` (verify, ship security triage) are NOT consults and stay unchanged.
