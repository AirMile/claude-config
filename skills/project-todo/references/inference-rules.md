# Project Todo — Inference Rules

Deterministic rules for deriving `type`, `phase` (priority) and `dependencies[]` from a plain description, plus the **ambiguity gate** that decides the rare cases where a question is still warranted.

The governing principle is stated repo-wide in `shared/FEEDBACK-CATEGORIZATION.md § Round gate`: _"Default to your own judgement; ask one `AskUserQuestion` only if genuinely ambiguous."_ It mirrors the **baseline gate** in `dev-ship/references/dev-define/workflow.md` — resolve what a known source already answers, surface only the residual forks.

`/project-todo` is called mid-run by `dev-ship` and `game-ship` to park out-of-scope findings (`dev-ship/references/fix-round.md`, `shared/FEEDBACK-CATEGORIZATION.md § Scope check`). Those call sites sit in the ship's **interactive lane** — the manual walkthrough and the live playtest, where `dev-ship/SKILL.md` puts "human interaction … in the main chat". The user is present, so a gate question there is a normal interaction, not a stall.

**Ship offload passes `type TWEAK` explicitly.** When `/dev-ship`'s manual/verify rounds offload a tweak-class finding (`shared/TWEAK-DISCIPLINE.md`, `dev-ship/references/phase-3-manual-finalize.md § Findings ledger + routing`), the invocation states `type TWEAK` + `depends on {feature}` up front — this overrides row-based inference below (row 1 of the WEB table still applies to a plain user-typed "tweak" description with no explicit type).

**`VERIFY` is never inferred from a plain description — explicit `type VERIFY` hint only.** These cards are normally created automatically by `scripts/completion-sync.js` from a deferred manual-test verdict (`shared/BACKLOG.md § VERIFY cards`), not by `/project-todo`. There is no keyword row for it in either table below; a card is only created as `VERIFY` when the calling context passes that type explicitly (e.g. a rare manual/ad hoc re-test request) — a plain "re-test X" description with no explicit hint falls through the normal rows below like any other description.

The cost being removed is **per-item friction**: parking three findings used to mean twelve modals. The happy path must be **zero modals** so that parking a finding costs one sentence.

---

## Matching is semantic, not literal

Signals below are written in English; descriptions arrive in the user's language. Match on **meaning**, not on substring — "kapot" hits the `BUG` row, "traag" hits `PERF`, "ooit" hits the `P4` parking row. A signal list is a set of examples, never an exhaustive vocabulary.

## Type inference — WEB

Evaluate top-down, **first match wins**. Ordered most-specific first, so a "fix the slow settings page" lands on `BUG`, not `PERF` or `PAGE`.

| #   | Type        | Signals                                                                                                                                                                     |
| --- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `BUG`       | bug, fix, crash, error, broken, throws, regression, "doesn't work"                                                                                                          |
| 2   | `TWEAK`     | explicit `type TWEAK` hint (always wins, see above) · "tweak" · polish/copy/styling/spacing adjustment of **existing**, already-working behavior — never net-new capability |
| 3   | `THEME`     | design tokens, color scheme, typography scale, spacing scale, dark-mode theme                                                                                               |
| 4   | `A11Y`      | accessibility, a11y, screenreader, contrast, keyboard nav, aria, focus order                                                                                                |
| 5   | `PERF`      | performance, slow, lighthouse, bundle size, SEO, core web vitals, caching                                                                                                   |
| 6   | `PAGE-GAP`  | missing functionality on an **existing** page — resolve by lookup, see below                                                                                                |
| 7   | `COMPONENT` | reusable UI element, not bound to one route (button, modal, card, nav)                                                                                                      |
| 8   | `PAGE`      | new route/screen, path-like name (`/settings`), "page", "screen", "view"                                                                                                    |
| 9   | `API`       | endpoint, route handler, webhook, service, backend contract, mutation, query                                                                                                |
| 10  | `CHANGE`    | modification of existing behavior ("now does X, should do Y", "instead of")                                                                                                 |
| 11  | `FEATURE`   | **default**                                                                                                                                                                 |

`TWEAK` never applies to the GAME table — game keeps `POLISH` for the equivalent small-improvement case (`/game-tweak` picks those up instead, see `shared/TWEAK-DISCIPLINE.md`).

**Row 5 is a lookup, not a judgement call.** "Existing page" is registered, so check the register rather than guessing:

1. `project.json#design.pages[]` — the page register (`shared/CODING-RULES.md`, `shared/DASHBOARD-PROJECT.md § Flows`)
2. `backlog.json#features[]` where `type === "PAGE"` — pages planned but not yet built

The description names a page from either list → `PAGE-GAP`. No match → fall through to rows 6/7.

Skipping the lookup is not a small error: `PAGE` and `PAGE-GAP` sit on **opposite sides of the track boundary**, so an unresolved guess between them satisfies gate criterion 1 and raises exactly the modal these rules exist to avoid.

**Track routing** (from `shared/BACKLOG.md § Status flow`): `PAGE` and `COMPONENT` land on the Design track and get `transition: "designing"`. Everything else — including `PAGE-GAP` — lands on the Dev track with no `transition` field.

## Type inference — GAME

Same top-down, first-match-wins evaluation.

| #   | Type       | Signals                                                        |
| --- | ---------- | -------------------------------------------------------------- |
| 1   | `UI`       | HUD, menu, indicator, health bar, inventory screen, pause menu |
| 2   | `POLISH`   | juice, particles, screen shake, sfx, feedback, game feel       |
| 3   | `CONTENT`  | level, enemy, item, dialogue, map, boss, quest                 |
| 4   | `SYSTEM`   | spawner, save/load, scoring, inventory logic, state machine    |
| 5   | `MECHANIC` | **default** — ability, movement, combat verb                   |

GAME has no `BUG` type. On bug signals: pick the closest type from the table and append the advisory line `Consider /game-debug for an existing-behavior bug.` — never block, never ask.

## Priority inference

Priorities are `P1` (highest) through `P4` (park). **There is no P0.**

Evaluate top-down, **first match wins**. The order matters: what the user _said_ outranks what the type _implies_. "Someday a dark mode theme" is `P4` (parking word), not `P3` (quality type) — rule 2 fires before rule 3.

| #   | Prio | Rule                                                                                                                                                                                               |
| --- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `P1` | Explicit urgency (urgent, asap, blocking, "first", "right now") · a `BUG` on a critical path (crash, data loss, security, broken auth/payment) · **blocks an existing `P1`** — see the query below |
| 2   | `P4` | Parking words (someday, later, eventually, experiment, stretch goal, "park this")                                                                                                                  |
| 3   | `P3` | Quality/polish types (`POLISH`, `A11Y`, `PERF`, `THEME`, `CONTENT`, `UI`) with no urgency signal · "when there's time", "nice to have"                                                             |
| 4   | `P2` | **default** — everything else, including any non-critical `BUG`                                                                                                                                    |

Rules 1 and 2 both firing is not a tie — that is gate criterion 4 (contradictory urgency).

**"Blocks an existing `P1`" is a query, not a hunch.** Collect the **open** dependency names — those named by a `P1` item but absent from `features[]`:

```
openP1Deps = features
  .filter(f => f.phase === "P1")
  .flatMap(f => f.dependencies || [])
  .filter(d => !features.some(g => g.name === d))
```

The new item fills one of them → `P1`. Match by name equality **or** token overlap (≥ 2 shared tokens, same tokenizer as § Dependencies inference): the card that satisfies the open dependency `payment-api` may well be named `payment-api-endpoint`. Strict equality would let the rule never fire.

It is reachable because `/project-plan` writes dependency names for cards that do not exist yet — `shared/BACKLOG.md § Filtering features` handles precisely that case in its Blocked filter (`!x`). A new item that unblocks a `P1` inherits its priority.

**Tiebreak: always `P2`.** Taken verbatim from `project-plan/SKILL.md` PHASE 3 — _"When unclear: prefer P2 (easier to demote than to promote later)."_

Consequence: uncertainty about priority **never** raises a modal. The only priority question that reaches the user is criterion 4 of the gate below (a genuine self-contradiction in the input).

## Dependencies inference

1. Read the existing names from `backlog.json#features[]`.
2. A name becomes a dependency when the description mentions it literally, or mentions ≥ 2 of its kebab tokens (tokens ≥ 3 chars).
3. No match → `dependencies: []`. Never ask.

Multi-split children keep the existing rule: frontend items get `dependencies: ["<dev-parent-name>"]`.

---

## Ambiguity gate

Without hard criteria a model defaults back to asking. These five are the **complete** list of reasons to raise a question. Everything else is inferred and reported.

1. **Track fork** — the type resolved to a **default row** (`FEATURE` in WEB, `MECHANIC` in GAME) rather than a signal row, _and_ the description reads just as plausibly as a Design-track item (`PAGE`/`COMPONENT`). Only then is the guess a coin flip worth surfacing: the track decides which pipeline picks the card up, so a wrong guess sends it to the wrong skill.

   Without this rule the criterion is unreachable — "first match wins" always yields an answer, so a bare `FEATURE` default would silently absorb every ambiguous UI-ish description. `"notification settings"` matches no signal row and could be a settings page or preference logic → gate. `"dash ability with cooldown"` also lands on a default row, but has no Design-track reading → no gate.

   A tie **within** one track (`FEATURE` vs `CHANGE`, `MECHANIC` vs `SYSTEM`) is never a fork: both cards enter the same pipeline. Pick per table order and report it.

2. **Description too thin** — no observable behavior _and_ no object (bare "settings", "better onboarding"), and neither the seed, the backlog, nor the codebase supplies the missing context. Yields 1–2 clarifying questions. **This is the only path that produces a thinking doc** (`.project/thinking/feature-idea-{name}.md`).
3. **Duplicate with unclear intent** — an existing item shares the kebab name and its description overlaps, but it is not evidently the same thing.
4. **Contradictory urgency** — the input argues with itself ("critical, but it can wait").
5. **Undetectable project type** — no `project.json`, no `project.godot`, and no web manifest to infer from (see SKILL.md Pre-PHASE 0).

### Never ask

- Priority with no explicit signal → apply the default table.
- A type tie **within one track** (`FEATURE` vs `CHANGE`, `MECHANIC` vs `SYSTEM`) → pick per table order, report the choice.
- Dependencies.
- Category — it is not a backlog field. It only ever existed to pick which type-modal to show, and has no consumer downstream.
- Large-feature warning → advisory line, then proceed.
- Multi-domain split → split automatically, report afterwards.

### Shape of the question

Every triggered criterion goes into **one** `AskUserQuestion` call, at most 4 questions. Never two calls in one run.

The seed-update question from `references/seed-alignment.md § Seed update question` may join this same single call as one extra question. It is **not** a sixth criterion; the 4-question cap wins — cap full → drop the seed question and downgrade its edits to record-only.

Per `shared/SKILL-PATTERNS.md § Smart Suggestions`: first option carries `(Recommended)` and **is the inference result**, so accepting the default yields exactly what full-auto would have produced. The gate only ever buys a correction, never a required decision.

```yaml
# Criterion 1 — track fork
header: "Track"
question: "Is '{name}' backend logic or a UI surface?"
options:
  - label: "{inferred} (Recommended)", description: "{why the inference picked it} — lands on the {Dev|Design} track"
  - label: "{alternative}", description: "lands on the {other} track"
multiSelect: false

# Criterion 2 — thin description (1-2 questions, specific to THIS idea, never generic)
header: "Scope"
question: "{concrete question about the observable behavior this item should ship}"

# Criterion 3 — duplicate
header: "Duplicate"
question: "'{name}' already exists (status: {status}). Same thing?"
options:
  - label: "Different — add as {name}-2 (Recommended)", description: "{one line contrasting the two descriptions}"
  - label: "Same — don't add", description: "Deepen the existing item with /project-brainstorm {name}"
multiSelect: false
```
