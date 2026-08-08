# Phase 1a Interview Protocol

Full protocol for the interview phase of dev-ship's define phase (PHASE 0) — each dimension opens as either an anchored open question or, when the evidence is contested, an `AskUserQuestion` modal (see `§ Modal Form`). Load this file when PHASE 1a starts.

> **Todo**: Read `.claude/skills/shared/QUESTIONING.md` now, before the opening question. It owns
> the CONDITIONS the rules below only name: § Contested Dimension (whether a dimension opens as a
> modal at all), § Second-Opinion Option (when the "Second opinion" option must be offered),
> § Before Asking, and § Escalation Ladder. § Modal Form below states those rules but does not
> restate their conditions, so it cannot be applied without this file.

## Dimension Checklist

Track coverage internally — not as a visible numbered list. Move to the next open dimension naturally as the conversation progresses; do not announce the structure.

| #   | Dimension                        | Always?     | When to ask                                                                                                        |
| --- | -------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | **Goal & why**                   | Yes         | Opening question                                                                                                   |
| 2   | **Success criteria & scenarios** | Yes         | After goal is clear                                                                                                |
| 3   | **Edge cases & non-goals**       | Yes         | After success is clear                                                                                             |
| 4   | **User & context**               | Conditional | Only if task type ∈ PAGE, COMPONENT, or FEATURE with direct end-user interaction. Skip for INFRA, REFACTOR, THEME. |

Before opening a dimension, run the coverage check (`shared/QUESTIONING.md § Before Asking`) — a dimension already answered by seed/backlog/context gets a paraphrase-confirm, not an open question. A dimension covered by a non-struck bullet in the Assumption Block below (see Interview Start) is already satisfied — do not reopen it. Only dimensions left uncovered, or whose bullet the user struck, get an open question.

All required dimensions covered → trigger the [Stop Condition](#stop-condition).

## Tone Rules

- **`AskUserQuestion` is not a default opener — it opens a dimension only when the evidence itself is contested.** Per `shared/QUESTIONING.md § Contested Dimension`: a dimension with ≥2 mutually exclusive, source-backed readings and no dominant winner opens as a modal (see `§ Modal Form` below); everything else — a single strong claim, or nothing to anchor on — opens as a plain anchored question in chat, exactly as before. `AskUserQuestion` also still appears as escalation step 2 of the ladder in `shared/QUESTIONING.md` (after an "I don't know" on the same dimension). Reaching for a modal on a dimension with no citable second reading fabricates options Claude invented rather than the evidence — restated here because this file is read standalone as "the full interview protocol."
- **One question at a time** — never list multiple questions in a single turn.
- **No solution proposals** — do not propose solutions, technical approaches, or design choices in this phase. Example directions inside the question text ARE allowed and encouraged — they describe the problem space, not the implementation (see `shared/QUESTIONING.md § Anchored open question rules`). **The Assumption Block below (Interview Start) is the one stated exception to "no proposals" — but only for problem-space claims** (goal, scope boundary, non-goal, success criterion), each carrying a source citation. It does not license stating architecture, file structure, or tech choices as fact — those stay open through the rest of the interview and into PHASE 1b's design forks.
- **Paraphrase** after each substantive answer: "So you mean that…" or "If I understand correctly, you want…". Ask "is that right?" only when genuinely uncertain — not as a ritual after every answer.
- **Probe and follow up**: "Can you give a concrete example?", "What happens if X?", "What would make this a failure?", "What breaks today without it?"
- **Show interest**: briefly acknowledge what the user said before asking the next question. Don't jump straight to the next question.
- **Stay open**: do not name file structure, components, tech stack choices, or implementation options. If the user goes there, note it briefly ("Good to know — I'll factor that in") and steer back: "What about {next uncovered dimension}?"

## Modal Form

When § Tone Rules routes a dimension to a modal instead of an open question:

- **Options are the readings, not inventions.** Each option restates one of the ≥2 source-backed
  readings that made the dimension contested — cite the source in the option `description`, the
  same discipline as an Assumption Block bullet. The **mechanical option test** applies: an
  option may name no file, component, or library (`shared/QUESTIONING.md § Contested Dimension`).
- **First option = your best-supported reading**, labeled `(Recommended)`. This is what
  auto-mode picks unattended — it must be the strongest reading, not just the first one drafted.
- **Free input is named, not implied.** Phrase the `question` so "Other" reads as a genuine
  third path — e.g. "...or is it something else entirely?" — not a fallback nobody expects to
  click.
- **"Second opinion" is conditional, never first.** Add it only when this dimension qualifies per
  `shared/QUESTIONING.md § Second-Opinion Option` (the modal is itself contested, or the
  dimension already drew an "I don't know"). Selecting it fires the consult scoped to this one
  dimension (`SECOND-OPINION.md § Brief contents → define interview dimension` row) — this is an
  **anchoring-gap** moment (`SECOND-OPINION.md § Counterpart`: many turns into one framing,
  independence matters more than raw strength), so the counterpart is **Opus** by default; label
  the option "Second opinion (Opus)". Only route to Fable instead when the user explicitly names
  Fable. Re-presents this same modal once with the digest visible, and counts against the per-run
  backstop (`SECOND-OPINION.md § Budget`) — a second consult later in the run is still available
  unless that backstop is exhausted.
- **`multiSelect`**: `true` when the readings don't exclude each other (e.g. two edge cases both
  apply), `false` when picking one settles the dimension.
- Record the resolved reading the same way an Assumption Block bullet would have been recorded,
  so PHASE 1b treats it as already covered — do not re-ask it as a design fork.

## Interview Start

> **Barrier — narrowed to the form that actually consumes each agent's output.** The Assumption
> Block waits on `context-aggregator` (PHASE 0 §5) alone — it feeds the `PREVIOUSLY DECIDED` list
> the block sits above, so don't render the block until that agent returns. It does **not** wait
> on a mid-interview consult (§ Modal Form): that agent's only consumer is the one modal that
> spawned it, re-presented with the digest once the consult lands — everything else in the
> interview (the next dimension's question, PHASE 1b) continues in the meantime, per
> `SECOND-OPINION.md § Latency`'s rule that a detected/clicked trigger never stalls the whole
> interactive flow. Don't half-render the Assumption Block and fill in the rest once
> `context-aggregator` lands — wait, then compose it whole. **Wait the house way**
> (`shared/SKILL-PATTERNS.md § Fork Delegation`): end the turn and wake on the agent's
> task-notification. Do **not** poll the agent's output file — it is the full JSONL transcript, it
> echoes the prompt back (so a grep for any delimiter the prompt itself contains matches
> immediately), and reading it overflows the context. The user can still interrupt (Esc/stop)
> to skip any wait; this rule only blocks Claude from starting to type early, it does not remove
> that escape.

> **Todo:** run the Learnings Load now if PHASE 0 §5 (`dev-define/workflow.md`) has not already run
> it this session (`shared/LEARNINGS-LOAD.md`, scopes `[component]`, `pitfall-prefix: true`,
> `current-feature: {feature-name}`) and show the `RELEVANT LEARNINGS` block (max 5, pitfalls first)
> before your opening question, on ≥1 match. This feeds Step 3's classification bias and Step 4's
> technique derivation — loading it later, only for Step 6, misses the interview entirely.

**Assumption Block** — open the interview with the block per `shared/QUESTIONING.md § Assumption Block`: up to 5 problem-space bullets (goal, scope boundary, non-goals, success criteria) drawn from PHASE 0 context — backlog `description` + risk, the seed markdown (Out of Scope / Open Decisions / Key Features), upcoming `open-items` entries used to name non-goals ("bulk import is covered by `{card-name}`"), codebase scan hits — each bullet citing its source, non-goal bullets cited-only. This replaces the old 2-3 line "context echo": instead of just naming what's known, state what you conclude from it, so the user corrects by exception rather than repeating known ground. The `PREVIOUSLY DECIDED` list and risk-check line (from workflow.md) render directly above this block — don't duplicate their content in the bullets.

**Opening question** — compose it fresh per feature (`shared/QUESTIONING.md § Before Asking` — no canned scaffold, no recycled phrasing across sessions). Its job: target the biggest genuine unknown left after the Assumption Block — a struck bullet, or a dimension the block didn't cover at all — anchored in one concrete fact, with 2-3 example directions where natural. Example of the _shape_ (never reuse the wording):

> "The backlog flags `{feature-name}` at risk 4 and your seed pitches {fragment}. What I can't tell from that: {specific aspect}. What makes that the problem right now — {direction A}, {direction B}, or something else?"

No context loaded at all → a plain open "what problem does this solve, and what triggered it now?" opener is acceptable — still phrased in your own words for this session.

If the user's answer is very brief (e.g. "we need login"), probe immediately: "What situation triggers someone needing that? What breaks today without it?"

## Dimension Openers

Use these as starting points — adapt to the conversation flow. Don't use them as a script. **Every opener MUST be anchored in loaded context when available** (per `shared/QUESTIONING.md`): prefix the question with what you already know from the seed, backlog, codebase, or earlier answers, and append 2-3 example directions where natural. The bare forms below are the no-context fallback shapes.

**Goal & why**

- "What problem does this solve for you?"
- "What breaks today without this?"
- "Why now — what changed?"

**Success criteria & scenarios**

- "What would it look like if this worked perfectly?"
- "Can you describe a concrete scenario where someone uses this?"
- "What does the user see or experience when it succeeds?"

**Edge cases & non-goals**

- "What should explicitly _not_ be part of this feature?"
- "Are there cases where this should not trigger or apply?"
- "What edge cases do you already know about? Think unusual-but-valid input: empty values, duplicates, special characters, simultaneous actions."
- "Are there numeric or list limits to consider — smallest/largest valid value, empty list, a single item versus many?" (ask only when requirements involve numeric input or list-iteration)

**User & context** (conditional — skip for INFRA/REFACTOR/THEME)

- "Who will use this, and in what situation?"
- "What are they trying to accomplish when they get here?"

## Stop Condition

Stop interviewing when all required dimensions are covered.

**No blocking summary-confirm here.** In the dev-ship flow the whole plan is reviewed at the gate
(dev-ship Step 4b `ExitPlanMode`), and a reject there loops back to revise — so the old
"Is this correct?" ceremony is redundant. Instead close lightly:

1. Show a short recap (1–3 sentences: goal, success, key constraints/non-goals) as a **statement**,
   not a question — the user does not need to answer it to proceed.
2. **One optional final open question** — ask "anything else before I write up the plan?" **only when
   it is genuinely useful** (an unresolved thread, a dimension you closed on a best-guess, a hunch the
   user is holding something back). If the interview already landed cleanly, skip it and move on.
   - User adds/corrects something → acknowledge, fold it into your understanding, proceed.
   - User signals done ("that's it", "go ahead") → proceed.
3. Proceed to PHASE 1b. Anything still fuzzy is surfaced in the gate plan file for review — not
   re-litigated here.

If ≥1 dimension is still unresolved, still name it in the recap (see "Handling I Don't Know" below) so
the user knows it will be filled with a best-guess and can catch it at the gate.

## Handling "I Don't Know" Responses

Follow the escalation ladder in `shared/QUESTIONING.md § Escalation Ladder`, applied per dimension. At step 2 the form switch means: a single AskUserQuestion with 2-4 concrete hypotheses for this dimension, carrying the "Second opinion (Opus)" option per `§ Modal Form` above — this and any `§ Modal Form` contested-dimension modal are the only `AskUserQuestion` calls allowed during the interview.

**In the closing summary**: if ≥1 dimension is unresolved, name it explicitly:

> "The {X} dimension is still open — I'll cover that in the synthesis phase with a best-guess approach, and flag it for review at the gate."

**In PHASE 1b**: treat each `unresolved` dimension as a gap to fill via a structured design choice (AskUserQuestion with options), not via another open question. The user couldn't answer in interview mode; structured options help more at that point.

### Measurable unknowns — ask for the reading, don't guess

A dimension can turn on a fact the user cannot recall but the running system can produce in
minutes: a timing, a count, a log line, a reproduction. That is a **measurement gap, not a judgment
gap** — the escalation ladder's step-2 hypothesis modal is the wrong instrument for it, and
deferring it to the build is worse: the plan-approval gate closes before the build starts, so
evidence that arrives later cannot gate anything.

Ask for the reading **now**, inside the interview, with concrete steps: which input/toggle to set,
which action to take, what to paste back. Give the falsifiable form up front — what each possible
answer would mean — so the user knows why it is worth the two minutes.

Fire only when all three hold: (a) the reading needs nothing that does not already exist (no new
instrumentation to build first), (b) it would change the plan, (c) the user has access right now.
Any one missing → carry the unknown into the gate as a stated assumption instead, and name it in
the closing recap.

A reading that contradicts the card's own premise is a PARK-ESCAPE (`dev-define/workflow.md
§ Constraints` → premise invalidation) reached with evidence in hand rather than inferred from
loaded context — route to `define-park.md` as normal.

## Context from Backlog

The backlog record (title + `description`) and concept pitch already tell you _what_ is being defined. Do not re-explain it. The interview explores the _why_, _for whom_, and _where it ends_ — not what it is.

**The backlog `description` is coverage, not decoration.** Treat it as a prior answer in the `§ Before Asking` check: a specific description (written per `shared/BACKLOG.md § Description quality`) often covers Goal & why and sometimes scope boundaries — paraphrase-confirm it ("The card says {gist} — still accurate?") instead of asking an open goal question the card already answers.

**Machine-authored cards**: when `source` names a skill rather than the user (`/project-plan` decomposition, `/project-todo` capture, `/dev-ship` — a card a define or verify round spun off, often from a consult), the user did not author the card — "what problem does this solve for you?" has no answer they can generate and reads as if you ignored your own planning. Open with your derived understanding (description + seed) as a paraphrase-confirm, then spend the interview on the genuinely open dimensions: success specifics, edge cases, non-goals — **and treat the card's own premise as a claim to check, not a given**: the Step 1 provenance gate (`phase-0-define-classify.md`) already flagged it if the card is also self-declared unmeasured, and this is the dimension where that flag gets spent.

**Vague description**: if the card text is too thin to anchor on (a title restatement, missing behavior or boundary), name that explicitly — "The card only says '{description}', which doesn't tell me {specific gap}" — and ask the user to fill exactly that gap. Never silently pretend the card gave context it didn't; naming the gap also surfaces weak descriptions for repair.

`SEED_CONTEXT` is loaded unconditionally in PHASE 0 §4 now — use it to sharpen the Assumption Block and any remaining open questions, e.g. "You mentioned the project targets {audience} — is this feature primarily for them?" `SEED_CONTEXT.present: false` just means no seed-sourced bullets; the rest of the coverage check still applies from backlog/codebase/prior-decision sources.

## Handling User Requests Mid-Interview

The interview is normally Claude-asks → user-answers. Two patterns flip that direction:

### Opinion Requests ("wat denk jij?", "what do you think?", "what would you recommend?")

When the user explicitly asks for your view on the current dimension:

1. **Switch out of open-question mode** — the user has paused their own thinking and wants input.
2. **Give a recommendation with one tradeoff**, not multiple-choice. Format: "I'd lean toward X because Y; the tradeoff is Z." One option, named clearly.
   **Exception — premise challenges.** When the honest recommendation is "this card should not be built as written", the budget does not apply: the claim is only actionable with the evidence attached, so walk the specific path (`file:line`) that settles it. The one-sentence cap governs preferences between defensible options, not a refutation.
3. **Then return control**: "Does that fit, or do you see it differently?"

Do NOT:

- Offer 3 options without a preference (the user already signalled they want your call).
- Defer with "what do you prefer?" (that's what they just asked you).
- Launch into a long analysis (one sentence recommendation + one sentence tradeoff is the budget — except for the premise challenge above).

### Domain Primers ("wat betekent X?", "wat is een Y?", "I'm new to Z")

When the user asks for clarification on a domain term you're using (library concept, design pattern, technical term):

1. **Give a 1–2 sentence primer** before moving on — concrete, with an analogy to something the user already knows when possible.
2. **Then resume the interview** at the question that prompted the request.

Example: user (new to Sanity) asks "is an object type a component you use in document types?" → answer: "Yes — object types are reusable building blocks (like React components), document types are the editable entries in the Studio (like pages)." → resume.

Do NOT:

- Launch into a multi-paragraph explanation (1–2 sentences is the budget).
- Quiz the user on their existing knowledge before answering.
- Skip the primer and assume — that compounds the gap.

Both patterns are exceptions to § Tone Rules ("no suggestions, no options") because the user has explicitly invited input.
