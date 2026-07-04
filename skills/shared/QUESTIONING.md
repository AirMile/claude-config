# Adaptive Questioning Protocol

Shared protocol for skills that gather input through user questions — interviews (`dev-ship (define phase)`, `game-ship (define phase)`), exploration rounds (`project-seed`), and technique dialogues (`project-brainstorm`, `project-critique`). Load this file when the question phase starts.

**Plan-mode precondition**: question phases run inside plan mode so model routers (e.g. `opusplan`) route them through the planning model — see [PLAN-MODE.md](PLAN-MODE.md). Verify plan mode is active before the first question.

---

## Form Choice

Pick the form per question based on the answer space:

| Answer space                                                                                                                                     | Form                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- |
| **Enumerable** — Claude can list the plausible answers: design forks (A vs B vs C), trade-offs, scope confirmation, priorities, yes/no decisions | AskUserQuestion        |
| **Generative** — only the user knows: intent, domain knowledge, vision, taste, lived experience                                                  | Anchored open question |

Never ask an enumerable question as open text (it forces the user to generate what you could have listed). Never squeeze a generative question into options (it anchors the user to your guesses).

### AskUserQuestion rules

- Options concrete and specific to THIS instance — no generic placeholders
- First option = your recommended hypothesis, label suffixed "(Recommended)"
- `multiSelect: true` whenever answers are not mutually exclusive
- Max 4 questions in parallel per round
- "Other" is always built in — a clickable question never blocks free input

### Anchored open question rules

An open question must be **anchored**, never blank:

1. **Anchor in loaded context** — reference something concrete you already know (seed pitch, backlog title/risk, codebase find, prior decision): _"Your seed mentions {X} — ..."_
2. **Narrow to the genuine unknown** — not "tell me about the goal" but "what makes {specific aspect} the problem right now?"
3. **Example directions in the question text** (optional, 2-3) — handles, not options: _"...: new users, expiring sessions, or something else?"_ They invite; they don't constrain.
4. **One open question per turn** — never stack open questions. (Technique dialogues that present a numbered question menu are the documented exception — see the skill's own phase rules.)
5. **No solution proposals** — example directions describe the problem space, never the implementation (no file structures, tech choices, architectures). Exception: the user explicitly asks for your opinion — give one recommendation with one trade-off, then return control.

Generic fallback ("What problem does this solve for you?") only when there is genuinely no context to anchor in.

---

## Before Asking

- **Don't ask what you already know.** Check loaded context (seed, backlog, codebase, prior decisions, earlier answers) before every question. Covered → paraphrase-confirm instead of asking: _"Your seed already states {X} — still accurate, anything to add?"_ Partially covered → ask only the uncovered remainder. A confirm costs the user one word; a redundant question costs trust.
- **Compose openers fresh.** Never open with a canned or templated sentence. The opener is composed per instance: one line naming what you already know, then one anchored question about the biggest genuine unknown. Example openers in skill files illustrate the _shape_ — never reuse their wording verbatim or recycle the same opener across sessions.

---

## Escalation Ladder

Apply per dimension/topic when an open question stalls:

| Turn                                              | Response                                                                                                                                                          |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1st "I don't know"                                | Re-ask as a concrete scenario: "Can you describe a situation where this works versus where it fails?" / "What would a bad version of this look like?"             |
| 2nd "I don't know" on the same topic              | **Switch form**: present an AskUserQuestion with 2-4 concrete hypotheses. The user couldn't generate an answer — let them recognize one instead.                  |
| 3rd "I don't know" or clear signal of uncertainty | Mark the topic `unresolved` internally and move on. Do not ask again. Cover unresolved topics later with a best-guess + structured choice in the synthesis phase. |

In a closing summary: name unresolved topics explicitly.

---

## Conversation Rules

- **Paraphrase** after each substantive answer before the next question. Ask "is that right?" only when genuinely uncertain — not as a ritual.
- The user may redirect, skip, or counter-ask at any point — follow the conversation. The protocol provides structure, not a script.
- **Round shape is skill-specific**: interviews ask one question at a time; seed exploration fires parallel AskUserQuestion batches; technique dialogues present a numbered menu and converse freely. This file governs form choice, anchoring, and escalation — the skill's phase definition governs cadence.
