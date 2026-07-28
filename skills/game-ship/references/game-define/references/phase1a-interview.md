# Phase 1a Interview Protocol — Godot / game-define

Full protocol for the open interview phase of `/game-define`. Load this file when PHASE 1a starts. Form choice, anchoring rules, and the escalation ladder come from [shared/QUESTIONING.md](../../shared/QUESTIONING.md) — read it together with this file.

## Dimension Checklist

Track coverage internally — not as a visible numbered list. Move to the next open dimension naturally as the conversation progresses; do not announce the structure.

| #   | Dimension                      | Always?                   | When to ask                                                                                                             |
| --- | ------------------------------ | ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | **Goal & why**                 | Yes                       | Opening question                                                                                                        |
| 2   | **Player experience / "fun"**  | Yes for gameplay features | After goal is clear                                                                                                     |
| 3   | **Mechanics & rules**          | Yes                       | After player experience is clear                                                                                        |
| 4   | **Edge cases & failure modes** | Yes                       | After mechanics are clear                                                                                               |
| 5   | **Scene & input context**      | Conditional               | Only if task type ∈ MECHANIC, UI, or FEATURE with direct player interaction. Skip for PURE-LOGIC, TEST-INFRA, RESOURCE. |

Before opening a dimension, run the coverage check (`shared/QUESTIONING.md § Before Asking`) — a dimension already answered by concept/backlog/scene context gets a paraphrase-confirm, not an open question.

All required dimensions covered → trigger the [Stop Condition](#stop-condition).

## Tone Rules

- **One question at a time** — never list multiple questions in a single turn.
- **No solution proposals** — do not propose scene structures, node types, signal architectures, or implementation approaches in this phase. Example directions inside the question text ARE allowed and encouraged — they describe the gameplay problem space, not the implementation (see `shared/QUESTIONING.md § Anchored open question rules`).
- **Paraphrase** after each substantive answer: "So the player should feel…" or "If I understand correctly, when X happens then Y…". Ask "is that right?" only when genuinely uncertain.
- **Probe and follow up**: "Can you describe a moment in gameplay where this fires?", "What breaks if this feature isn't there?", "What would make this feel wrong to the player?"
- **Show interest**: briefly acknowledge what the user said before asking the next question. Don't jump straight to the next question.
- **Stay open**: do not name nodes, scripts, signals, or GDScript patterns. If the user goes there, note it briefly ("Good to know — I'll factor that into the architecture") and steer back: "What about {next uncovered dimension}?"

## Interview Start

**Context echo** — open the interview with a short "what I already know" block (2-3 lines max) built from PHASE 0 context: backlog title + `description` + risk, concept pitch/genre fragment, scene or script scan hits. This shows the user what the interview builds on so they never have to repeat known ground. The `PREVIOUSLY DECIDED` list and risk-check line (from SKILL.md) render directly above this block — don't duplicate their content in the echo.

**Opening question** — compose it fresh per feature (`shared/QUESTIONING.md § Before Asking` — no canned scaffold, no recycled phrasing across sessions). Its job: target the biggest genuine unknown left after the context echo, anchored in one concrete fact from it, with 2-3 example directions where natural. Example of the _shape_ (never reuse the wording):

> "The backlog flags `{feature-name}` at risk 4 and your concept pitches {genre fragment}. What I can't tell from that: {specific aspect}. What makes that the gameplay problem right now — {direction A}, {direction B}, or something else?"

No context loaded at all → a plain open "what gameplay problem does this solve, and what should it feel like?" opener is acceptable — still phrased in your own words for this session.

If the user's answer is very brief (e.g. "player needs to jump"), probe immediately: "What breaks in the game experience today without this? What should it feel like when it works?"

## Dimension Openers

Use these as starting points — adapt to the conversation flow. Don't use them as a script. **Every opener MUST be anchored in loaded context when available** (per `shared/QUESTIONING.md`): prefix the question with what you already know from the concept, backlog, scene tree, or earlier answers, and append 2-3 example directions where natural. The bare forms below are the no-context fallback shapes.

**Goal & why**

- "What gameplay problem does this solve?"
- "What breaks in the game without this?"
- "Why does this matter for the player right now?"

**Player experience / "fun"**

- "What should the player feel when this works?"
- "Can you describe a concrete moment where this fires and what the player experiences?"
- "What would a great version of this look like in play?"

**Mechanics & rules**

- "How should this actually work — what are the rules?"
- "What triggers it, and what does it produce?"
- "Are there counters, cooldowns, or conditions the player needs to know about?"

**Edge cases & failure modes**

- "What should explicitly _not_ happen — are there cases this should ignore?"
- "What gameplay edge cases do you already know about? Think simultaneous triggers, rapid input, or two systems fighting each other."
- "What would a broken version of this look like to the player?"
- "Are there extreme values to handle — maximum or minimum resource, zero duration, simultaneous conflicting triggers, or off-by-one timing?" (ask only when requirements involve numbers, timing, or resource counters)

**Scene & input context** (conditional — skip for PURE-LOGIC/TEST-INFRA/RESOURCE)

- "Which scene or screen does this live in?"
- "What input triggers this — keyboard, controller, collision, signal from another node?"
- "What else in the scene does this interact with?"

## Stop Condition

Stop interviewing when all required dimensions are covered.

**No blocking summary-confirm here.** In the game-ship flow the whole plan is reviewed at the gate
(game-ship Step 4b `ExitPlanMode`), and a reject there loops back to revise — so the old
"Is this correct?" ceremony is redundant. Instead close lightly:

1. Show a short recap (1–3 sentences: gameplay problem, player experience, key mechanics/rules,
   failure modes/non-goals) as a **statement**, not a question — the user does not need to answer it
   to proceed.
2. **One optional final open question** — ask "anything else before I write up the plan?" **only when
   it is genuinely useful** (an unresolved thread, a dimension closed on a best-guess). If the
   interview landed cleanly, skip it and move on.
   - User adds/corrects something → acknowledge, fold it in, proceed.
   - User signals done ("that's it", "go ahead") → proceed.
3. Proceed to PHASE 1b. Anything still fuzzy is surfaced in the gate plan file for review — not
   re-litigated here.

If ≥1 dimension is still unresolved, still name it in the recap (see "Handling I Don't Know" below) so
the user knows it will be filled with a best-guess and can catch it at the gate.

## Handling "I Don't Know" Responses

Follow the escalation ladder in `shared/QUESTIONING.md § Escalation Ladder`, applied per dimension. Step 1 probes use gameplay scenarios ("Can you describe a playtest moment where this works versus where it fails?"). At step 2 the form switch means: a single AskUserQuestion with 2-4 concrete hypotheses for this dimension — that is the only AskUserQuestion allowed during the interview.

**In the closing summary**: if ≥1 dimension is unresolved, name it explicitly:

> "The {X} dimension is still open — I'll cover that in the synthesis phase with a best-guess approach, and flag it for review at the gate."

**In PHASE 1b**: treat each `unresolved` dimension as a gap to fill via a structured design choice (AskUserQuestion with options), not via another open question.

## Context from Backlog

The backlog record (title + `description`) already tells you _what_ is being defined. Do not re-explain it. The interview explores the _why_, _how it feels to the player_, and _where it ends_ — not what it is.

**The backlog `description` is coverage, not decoration.** Treat it as a prior answer in the `§ Before Asking` check: a specific description (written per `shared/BACKLOG.md § Description quality`) often covers Goal & why and sometimes mechanics or scope boundaries — paraphrase-confirm it ("The card says {gist} — still accurate?") instead of asking an open goal question the card already answers.

**Backlog-generated features**: when the feature came out of `/project-plan` decomposition (`source: "/project-plan"`), the user did not author the card — "what gameplay problem does this solve?" has no answer they can generate and reads as if you ignored your own planning. Open with your derived understanding (description + concept) as a paraphrase-confirm, then spend the interview on the genuinely open dimensions: player experience, mechanics & rules, failure modes.

**Vague description**: if the card text is too thin to anchor on (a title restatement, missing behavior or boundary), name that explicitly — "The card only says '{description}', which doesn't tell me {specific gap}" — and ask the user to fill exactly that gap. Never silently pretend the card gave context it didn't; naming the gap also surfaces weak descriptions for repair.

If `SEED_CONTEXT` or `project.json#concept` is available, use it to sharpen questions — e.g. "Your concept mentions {genre} — does this feature need to fit a specific game feel for that genre?"
