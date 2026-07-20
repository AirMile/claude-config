# Phase 1a Interview Protocol

Full protocol for the open interview phase of dev-ship's define phase (PHASE 0). Load this file when PHASE 1a starts. Form choice, anchoring rules, and the escalation ladder come from [shared/QUESTIONING.md](.claude/skills/shared/QUESTIONING.md) — read it together with this file.

## Dimension Checklist

Track coverage internally — not as a visible numbered list. Move to the next open dimension naturally as the conversation progresses; do not announce the structure.

| #   | Dimension                        | Always?     | When to ask                                                                                                        |
| --- | -------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | **Goal & why**                   | Yes         | Opening question                                                                                                   |
| 2   | **Success criteria & scenarios** | Yes         | After goal is clear                                                                                                |
| 3   | **Edge cases & non-goals**       | Yes         | After success is clear                                                                                             |
| 4   | **User & context**               | Conditional | Only if task type ∈ PAGE, COMPONENT, or FEATURE with direct end-user interaction. Skip for INFRA, REFACTOR, THEME. |

Before opening a dimension, run the coverage check (`shared/QUESTIONING.md § Before Asking`) — a dimension already answered by seed/backlog/context gets a paraphrase-confirm, not an open question.

All required dimensions covered → trigger the [Stop Condition](#stop-condition).

## Tone Rules

- **`AskUserQuestion` is not an opener** — open each dimension with a plain anchored question in chat, not a modal. `AskUserQuestion` appears only as escalation step 2 of the ladder in `shared/QUESTIONING.md` (after two "I don't know"s on the same dimension). Reaching for it as your first move on an architecture-flavored dimension skips the open interview entirely — restated here because this file is read standalone as "the full interview protocol."
- **One question at a time** — never list multiple questions in a single turn.
- **No solution proposals** — do not propose solutions, technical approaches, or design choices in this phase. Example directions inside the question text ARE allowed and encouraged — they describe the problem space, not the implementation (see `shared/QUESTIONING.md § Anchored open question rules`).
- **Paraphrase** after each substantive answer: "So you mean that…" or "If I understand correctly, you want…". Ask "is that right?" only when genuinely uncertain — not as a ritual after every answer.
- **Probe and follow up**: "Can you give a concrete example?", "What happens if X?", "What would make this a failure?", "What breaks today without it?"
- **Show interest**: briefly acknowledge what the user said before asking the next question. Don't jump straight to the next question.
- **Stay open**: do not name file structure, components, tech stack choices, or implementation options. If the user goes there, note it briefly ("Good to know — I'll factor that in") and steer back: "What about {next uncovered dimension}?"

## Interview Start

> **Todo:** run the Learnings Load now if PHASE 0 §5 (`dev-define/workflow.md`) has not already run
> it this session (`shared/LEARNINGS-LOAD.md`, scopes `[component]`, `pitfall-prefix: true`,
> `current-feature: {feature-name}`) and show the `RELEVANT LEARNINGS` block (max 5, pitfalls first)
> before your opening question, on ≥1 match. This feeds Step 3's classification bias and Step 4's
> technique derivation — loading it later, only for Step 6, misses the interview entirely.

**Context echo** — open the interview with a short "what I already know" block (2-3 lines max) built from PHASE 0 context: backlog title + `description` + risk, seed pitch fragment, codebase scan hits. This shows the user what the interview builds on so they never have to repeat known ground. The `PREVIOUSLY DECIDED` list and risk-check line (from workflow.md) render directly above this block — don't duplicate their content in the echo.

**Opening question** — compose it fresh per feature (`shared/QUESTIONING.md § Before Asking` — no canned scaffold, no recycled phrasing across sessions). Its job: target the biggest genuine unknown left after the context echo, anchored in one concrete fact from it, with 2-3 example directions where natural. Example of the _shape_ (never reuse the wording):

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

Follow the escalation ladder in `shared/QUESTIONING.md § Escalation Ladder`, applied per dimension. At step 2 the form switch means: a single AskUserQuestion with 2-4 concrete hypotheses for this dimension — that is the only AskUserQuestion allowed during the interview.

**In the closing summary**: if ≥1 dimension is unresolved, name it explicitly:

> "The {X} dimension is still open — I'll cover that in the synthesis phase with a best-guess approach. Does that work?"

**In PHASE 1b**: treat each `unresolved` dimension as a gap to fill via a structured design choice (AskUserQuestion with options), not via another open question. The user couldn't answer in interview mode; structured options help more at that point.

## Context from Backlog

The backlog record (title + `description`) and concept pitch already tell you _what_ is being defined. Do not re-explain it. The interview explores the _why_, _for whom_, and _where it ends_ — not what it is.

**The backlog `description` is coverage, not decoration.** Treat it as a prior answer in the `§ Before Asking` check: a specific description (written per `shared/BACKLOG.md § Description quality`) often covers Goal & why and sometimes scope boundaries — paraphrase-confirm it ("The card says {gist} — still accurate?") instead of asking an open goal question the card already answers.

**Backlog-generated features**: when the feature came out of `/project-plan` decomposition (`source: "/project-plan"`), the user did not author the card — "what problem does this solve for you?" has no answer they can generate and reads as if you ignored your own planning. Open with your derived understanding (description + seed) as a paraphrase-confirm, then spend the interview on the genuinely open dimensions: success specifics, edge cases, non-goals.

**Vague description**: if the card text is too thin to anchor on (a title restatement, missing behavior or boundary), name that explicitly — "The card only says '{description}', which doesn't tell me {specific gap}" — and ask the user to fill exactly that gap. Never silently pretend the card gave context it didn't; naming the gap also surfaces weak descriptions for repair.

If `SEED_CONTEXT` or `project.json#concept` is available, use it to sharpen questions — e.g. "You mentioned the project targets {audience} — is this feature primarily for them?"

## Handling User Requests Mid-Interview

The interview is normally Claude-asks → user-answers. Two patterns flip that direction:

### Opinion Requests ("wat denk jij?", "what do you think?", "what would you recommend?")

When the user explicitly asks for your view on the current dimension:

1. **Switch out of open-question mode** — the user has paused their own thinking and wants input.
2. **Give a recommendation with one tradeoff**, not multiple-choice. Format: "I'd lean toward X because Y; the tradeoff is Z." One option, named clearly.
3. **Then return control**: "Does that fit, or do you see it differently?"

Do NOT:

- Offer 3 options without a preference (the user already signalled they want your call).
- Defer with "what do you prefer?" (that's what they just asked you).
- Launch into a long analysis (one sentence recommendation + one sentence tradeoff is the budget).

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
