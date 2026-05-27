# Phase 1a Interview Protocol

Full protocol for the open interview phase of `/dev-define`. Load this file when PHASE 1a starts.

## Dimension Checklist

Track coverage internally — not as a visible numbered list. Move to the next open dimension naturally as the conversation progresses; do not announce the structure.

| #   | Dimension                        | Always?     | When to ask                                                                                                        |
| --- | -------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------ |
| 1   | **Goal & why**                   | Yes         | Opening question                                                                                                   |
| 2   | **Success criteria & scenarios** | Yes         | After goal is clear                                                                                                |
| 3   | **Edge cases & non-goals**       | Yes         | After success is clear                                                                                             |
| 4   | **User & context**               | Conditional | Only if task type ∈ PAGE, COMPONENT, or FEATURE with direct end-user interaction. Skip for INFRA, REFACTOR, THEME. |

All required dimensions covered → trigger the [Stop Condition](#stop-condition).

## Tone Rules

- **One question at a time** — never list multiple questions in a single turn.
- **No options or suggestions** — do not propose solutions, technical approaches, or design choices in this phase.
- **Paraphrase** after each substantive answer: "So you mean that…" or "If I understand correctly, you want…". Ask "is that right?" only when genuinely uncertain — not as a ritual after every answer.
- **Probe and follow up**: "Can you give a concrete example?", "What happens if X?", "What would make this a failure?", "What breaks today without it?"
- **Show interest**: briefly acknowledge what the user said before asking the next question. Don't jump straight to the next question.
- **Stay open**: do not name file structure, components, tech stack choices, or implementation options. If the user goes there, note it briefly ("Good to know — I'll factor that in") and steer back: "What about {next uncovered dimension}?"

## Opening Question

Always start with:

> "I see we're defining `{feature-name}`. Tell me first — what problem does this solve for you?"

If the user's answer is very brief (e.g. "we need login"), probe immediately:

> "What situation triggers someone needing that? What breaks today without it?"

## Dimension Openers

Use these as starting points — adapt to the conversation flow. Don't use them as a script.

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
- "What edge cases do you already know about?"

**User & context** (conditional — skip for INFRA/REFACTOR/THEME)

- "Who will use this, and in what situation?"
- "What are they trying to accomplish when they get here?"

## Stop Condition

Stop interviewing when all required dimensions are covered.

Close with an explicit summary:

> "I understood that: [1–3 sentences covering: what goal this solves, what success looks like, key constraints or explicit non-goals]. Is this correct, or am I missing something?"

- **User confirms** → proceed to PHASE 1b.
- **User adds or corrects something** → acknowledge, update your understanding, briefly re-confirm that part ("Got it — so {correction}. Anything else?"), then proceed.
- **User signals done** ("you already know enough", "that's it", "go ahead") → accept and proceed.

Do not loop the summary more than once — after a correction is acknowledged, move on.

## Handling "I Don't Know" Responses

Apply per dimension when the user cannot answer:

| Turn                                              | Claude's response                                                                                                                                                          |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1st "I don't know" on a dimension                 | Probe with a concrete scenario question: "Can you describe a situation where this would work versus where it would fail?" or "What would a bad version of this look like?" |
| 2nd "I don't know" on the same dimension          | Offer explicitly: "I can suggest some options to choose from — would that help?" Proceed only if the user says yes.                                                        |
| 3rd "I don't know" or clear signal of uncertainty | Mark the dimension as `unresolved` internally. Move on to the next dimension. Do not ask again.                                                                            |

**In the closing summary**: if ≥1 dimension is unresolved, name it explicitly:

> "The {X} dimension is still open — I'll cover that in the synthesis phase with a best-guess approach. Does that work?"

**In PHASE 1b**: treat each `unresolved` dimension as a gap to fill via a structured design choice (AskUserQuestion with options), not via another open question. The user couldn't answer in interview mode; structured options help more at that point.

## Context from Backlog

The backlog task title and concept pitch already tell you _what_ is being defined. Do not re-explain it. The interview explores the _why_, _for whom_, and _where it ends_ — not what it is.

If `SEED_CONTEXT` or `project.json#concept` is available, use it to sharpen questions — e.g. "You mentioned the project targets {audience} — is this feature primarily for them?"
