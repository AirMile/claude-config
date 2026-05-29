# Phase 1a Interview Protocol — Godot / game-define

Full protocol for the open interview phase of `/game-define`. Load this file when PHASE 1a starts.

## Dimension Checklist

Track coverage internally — not as a visible numbered list. Move to the next open dimension naturally as the conversation progresses; do not announce the structure.

| #   | Dimension                      | Always?                   | When to ask                                                                                                             |
| --- | ------------------------------ | ------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | **Goal & why**                 | Yes                       | Opening question                                                                                                        |
| 2   | **Player experience / "fun"**  | Yes for gameplay features | After goal is clear                                                                                                     |
| 3   | **Mechanics & rules**          | Yes                       | After player experience is clear                                                                                        |
| 4   | **Edge cases & failure modes** | Yes                       | After mechanics are clear                                                                                               |
| 5   | **Scene & input context**      | Conditional               | Only if task type ∈ MECHANIC, UI, or FEATURE with direct player interaction. Skip for PURE-LOGIC, TEST-INFRA, RESOURCE. |

All required dimensions covered → trigger the [Stop Condition](#stop-condition).

## Tone Rules

- **One question at a time** — never list multiple questions in a single turn.
- **No options or suggestions** — do not propose scene structures, node types, signal architectures, or implementation approaches in this phase.
- **Paraphrase** after each substantive answer: "So the player should feel…" or "If I understand correctly, when X happens then Y…". Ask "is that right?" only when genuinely uncertain.
- **Probe and follow up**: "Can you describe a moment in gameplay where this fires?", "What breaks if this feature isn't there?", "What would make this feel wrong to the player?"
- **Show interest**: briefly acknowledge what the user said before asking the next question. Don't jump straight to the next question.
- **Stay open**: do not name nodes, scripts, signals, or GDScript patterns. If the user goes there, note it briefly ("Good to know — I'll factor that into the architecture") and steer back: "What about {next uncovered dimension}?"

## Opening Question

Always start with:

> "I see we're defining `{feature-name}`. Tell me first — what gameplay problem does this solve?"

If the user's answer is very brief (e.g. "player needs to jump"), probe immediately:

> "What breaks in the game experience today without this? What should it feel like when it works?"

## Dimension Openers

Use these as starting points — adapt to the conversation flow. Don't use them as a script.

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

Close with an explicit summary:

> "I understood that: [1–3 sentences covering: what gameplay problem this solves, what the player experience should be, key mechanics/rules, and explicit failure modes or non-goals]. Is this correct, or am I missing something?"

- **User confirms** → proceed to PHASE 1b.
- **User adds or corrects something** → acknowledge, update your understanding, briefly re-confirm that part ("Got it — so {correction}. Anything else?"), then proceed.
- **User signals done** ("you already know enough", "that's it", "go ahead") → accept and proceed.

Do not loop the summary more than once — after a correction is acknowledged, move on.

## Handling "I Don't Know" Responses

Apply per dimension when the user cannot answer:

| Turn                                              | Claude's response                                                                                                                                                                     |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1st "I don't know" on a dimension                 | Probe with a concrete gameplay scenario: "Can you describe a playtest moment where this works versus where it fails?" or "What would feel wrong to the player if you got this wrong?" |
| 2nd "I don't know" on the same dimension          | Offer explicitly: "I can suggest some options to choose from — would that help?" Proceed only if the user says yes.                                                                   |
| 3rd "I don't know" or clear signal of uncertainty | Mark the dimension as `unresolved` internally. Move on. Do not ask again.                                                                                                             |

**In the closing summary**: if ≥1 dimension is unresolved, name it explicitly:

> "The {X} dimension is still open — I'll cover that in the synthesis phase with a best-guess approach. Does that work?"

**In PHASE 1b**: treat each `unresolved` dimension as a gap to fill via a structured design choice (AskUserQuestion with options), not via another open question.

## Context from Backlog

The backlog task title already tells you _what_ is being defined. Do not re-explain it. The interview explores the _why_, _how it feels to the player_, and _where it ends_ — not what it is.

If `SEED_CONTEXT` or `project.json#concept` is available, use it to sharpen questions — e.g. "Your concept mentions {genre} — does this feature need to fit a specific game feel for that genre?"
