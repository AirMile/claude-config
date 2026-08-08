# Tweak Discipline (shared)

The shared contract for the tweak fast path — `/dev-tweak` (web) and `/game-tweak` (Godot). A tweak
is the middle road between a loose edit in chat (fast, but drifts `.project/` state) and a full ship
pipeline (safe, but heavyweight for a 1-3 file change). Both skills load this file in their PHASE 0;
it owns the size gate, the backlog guard, the registration policy, the escalation semantics, and the
never-do list. (`/dev-inspect` is a partial third consumer: § Size gate + § Escalation gate only —
it never commits, so the guards and registration policy don't apply there.) Domain specifics (verify commands, escalation targets) stay in each skill — see
§ Skill-specific configuration.

Relation to [DEBUG-LADDER.md](DEBUG-LADDER.md): a tweak is by definition **tier 1/2-sized** work.
Tier-3 signals (intermittent, cross-module, a prior attempt already failed) are an escalation
criterion here — that work belongs to the debug machinery, not the tweak path.

---

## Size gate

Escalate (see § Escalation gate) when **any** criterion holds — checked on the _projected_ scope at
intake, and re-checked the moment actual scope exceeds it mid-implement:

| #   | Criterion                                                                                                                                                        | dev examples                                                 | game examples                                      |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------- |
| 1   | **Net-new surface** — the change _adds_ capability instead of adjusting existing behavior                                                                        | new entity/model, DB migration, new endpoint/route, new page | new scene, autoload, signal contract, input action |
| 2   | **File span** — > 3 source files (generated files/lockfiles excluded)                                                                                            | —                                                            | —                                                  |
| 3   | **New test surface** — a new test _file_ or harness is needed (new cases in existing test files are tweak-compatible)                                            | —                                                            | —                                                  |
| 4   | **Architecture** — touches a shared layer/interface/config consumed by > 2 modules, or any cross-cutting rename                                                  | —                                                            | —                                                  |
| 5   | **Guard hit with in-pipeline status** — see § Backlog guard resolution                                                                                           | —                                                            | —                                                  |
| 6   | **Debug tier-3 signals** — intermittent failure, cause spans multiple modules, or a prior fix attempt already failed ([DEBUG-LADDER.md](DEBUG-LADDER.md) tier 3) | —                                                            | —                                                  |

Criterion 6 routes to the _debug_ machinery, not to ship define — the skill's escalate reference
words that option accordingly (dev: a `/dev-ship {feature}` debug round or inline ladder discipline;
game: `/game-debug`).

**Second consumer: pre-offload sizing.** Criteria 1-4 aren't only a `/dev-tweak`/`/game-tweak` intake
check — `dev-ship`'s manual-round and auto-verify offload flushes
(`dev-ship/references/phase-3-manual-finalize.md § Offload flush`,
`dev-ship/references/orchestration.md § 3`) and their `game-ship` mirrors judge a finding against
these same four criteria **before** deciding whether it
becomes a `type TWEAK`/`POLISH` card or a plain backlog card, so an oversized finding never enters
the tweak fast path only to bounce straight back out at this file's own § Escalation gate. Criteria 5
and 6 stay intake-only there (5 needs a live backlog scan this pre-check doesn't have; 6 is
fail-class and never reaches offload).

**Third consumer: ship de-escalation.** Criteria 1-4 are also the test `dev-ship`/`game-ship` run at
their plan-approval gate against the completed define draft (`feature.json` in memory —
`dev-ship/references/phase-0-define-classify.md § Step 4b`). None of the four fires → the feature is
tweak-sized and the gate offers the handoff (see § De-escalation gate). Criteria 5 and 6 stay
intake-only there too (5 needs a live backlog scan the gate doesn't run; 6 is fail-class and never
reaches define).

## Lane routing

Once a tweak clears the size gate, it still needs a process depth: build it straight away, design it
first, or design it with a second opinion. Judge the table below **in order** — the first row that
matches picks the lane, never a score or a sum:

| #   | Condition                                                                                                         | Lane |
| --- | ----------------------------------------------------------------------------------------------------------------- | ---- |
| 1   | Stale or obsolete/superseded card, or a docs-only / `.project`-only change                                        | A    |
| 2   | A verify round in this run failed, **or** a size-gate escalation was consciously overridden (§ Escalation gate c) | C    |
| 3   | PHASE 1 locate left ≥2 candidate sites open, or landed on none                                                    | B    |
| 4   | A learning printed with type `pitfall` carries the `⟨path⟩` marker (its `paths[]` overlap a located file)         | B    |
| 5   | Otherwise                                                                                                         | A    |

Why these are Sonnet-safe: none of them asks "how sure are you" — each reads off an artifact that
already exists at evaluation time. Row 3 counts candidate sites in the locate result just produced;
row 4 reads two markers `learnings-search.js load` prints on every line — the `feature · type` one
and the `⟨path⟩` one it appends when the entry's own `paths[]` overlap the caller's `--paths`. Both
must be present. Membership of the component-scoped block is **not** a substitute: that block ranks
on feature tokens too, so a line can sit there with no path overlap at all. No classification call,
and never a re-read of the raw learnings store; row 2 is this run's own history.

- **A — direct.** No `EnterPlanMode`. Identical to the pre-lane behavior.
- **B — designed.** `EnterPlanMode` (skip if already active) → design → write the decision to the
  plan file → `ExitPlanMode` → implement.
- **C — designed + second opinion.** Lane B, plus a `Plan` agent (`model: "opus"`) for the design and
  a Fable consult on the written plan file before `ExitPlanMode`, per
  [SECOND-OPINION.md](SECOND-OPINION.md).

Hard rules:

- **Lane routing never overrules the size gate.** A fired gate criterion always routes to
  `references/escalate.md` first — row 2's override branch is not an exception: the gate already
  fired there and the user consciously chose (c). The lane only decides how much process the
  continuing tweak gets, never whether it continues as a tweak.
- **Two failed rounds end the tweak, not a fourth lane.** The first failed verify round lifts to Lane
  C; a second failed round on the same issue routes to `references/escalate.md` instead of staying in
  the skill — mirrors [DEBUG-LADDER.md](DEBUG-LADDER.md)'s "every failed fix round escalates exactly
  one tier".
- **A lane only moves up during a run, never down.**
- **`.project/` absent** → the learnings load (PHASE 1 step 2) is skipped, so row 4 can't be
  evaluated — skip it silently for lane purposes, but if a lane above A fires anyway (rows 1-3), note
  the missing learnings check in the printed lane line rather than treating the row as a silent 0.

## Branch guard

A tweak commits on **whatever branch is checked out** — standing in a ship's feature worktree would
silently fold the tweak into that feature's merge, even when the backlog guard finds no content
overlap. So, before the baseline:

1. Resolve the default branch: `git symbolic-ref --short refs/remotes/origin/HEAD` (strip the
   `origin/` prefix); fallback: whichever of `main`/`master` exists locally.
2. Compare with `git branch --show-current`.
3. **On the default branch** → continue silently. **On any other branch, or detached HEAD** → warn
   and ask (one AskUserQuestion): _"Commit here (Recommended when this branch owns the change)"_ /
   _"Switch to {default} first"_ / _"Abort"_. Never switch branches without asking.

## Backlog guard

Cards carry no file lists, so the guard matches on **intent + touched paths**:

1. **Load** every live card: `node ~/.claude/scripts/backlog-load.js "$REPO" guard-items` — all
   non-CANCELLED cards with `name`, `type`, `status`, `transition`, `stage`, `description`
   ([BACKLOG-LOAD.md](BACKLOG-LOAD.md)). `backlogPresent: false` → skip the guard silently.
2. **Token heuristic** (same tokenizer family as project-todo dedup / `LEARNING-WRITE.md § Dedup
Tokenizer`): take tokens ≥ 3 chars from the tweak description + slug + touched-file basenames and
   directory segments; compare against each card's `name` + `description`. ≥ 2 shared tokens →
   candidate; then judge the candidate semantically — _same thing_, _same area, different thing_, or
   false positive.
3. **Session signals** (stronger than tokens): glob `.project/session/active-*.json` and
   `ship-*.json`. A live or parked ship whose feature matches a candidate upgrades the warning to a
   hard warn regardless of card status.
4. **Resolution by status**:
   - **TODO + same thing** → warn: _"this tweak implements open card `{name}` ad hoc."_ Options:
     proceed-and-report (the card is named in the final report; the tweak **never** flips its
     status) or escalate option (b) to ship the card properly.
   - **DEFINED / DOING / DONE-unshipped, or `transition` set, or a live/parked session signal** →
     the pipeline owns this area: hard warn, recommend resuming it (`/dev-ship {name}` /
     `/game-ship {name}`); continue only on an explicit user override (size-gate criterion 5).
   - **Same area, different thing** → one advisory line in the status output, continue.

## Card pickup (TWEAK / POLISH cards)

A tweak card is a small improvement a ship's verify/manual round already offloaded to the backlog
(`dev-ship/references/phase-3-manual-finalize.md § Findings ledger + routing`), or one added ad hoc via
`/project-todo`. Two ways a run picks one up, in addition to the free-text description path used
everywhere above:

1. **Invocation arg names a card** — exact match, or an unambiguous ≥2-shared-token match (same
   tokenizer as § Backlog guard) against **only** live cards of type `TWEAK` (dev) / `POLISH` (game) —
   never the full backlog (that full-backlog scan is `/project-todo`'s job, out of scope here).
   Ambiguous (≥2 candidates) → ask which one, or "none of these — treat my text as a free-form
   description" as the last option.

   **Card mode**: the card's `description` becomes the tweak's working description (the invocation arg
   was only the lookup key). **Dependency check**: any `dependencies[]` entry not yet complete per
   `shared/BACKLOG.md § Completion & dependency resolution` (`shipped`, not plain `status ===
"DONE"` — `DONE` lands right after verify, before the dependency is merged) → warn: _"parent
   feature `{dep}` not shipped yet — this tweak may target code that isn't on `main`."_ One
   `AskUserQuestion`: proceed anyway (recommended when the dependency is nearly done or the overlap
   is small) / abort. No warn when `dependencies` is empty or every entry already resolved.

   **Stale card**: if the calling skill's PHASE 1 (locate) shows the described defect is already
   resolved — a later commit fixed it, or it never applied — there is nothing to edit. Do **not**
   invent a change to justify the card. Skip the implement/verify phases, find the resolving commit
   (`git log -- <file>`), and run the § Card-mode completion write with `shippedSha` = that commit
   (or `HEAD` if none pins it) and a `summary` naming the card stale. Registration-policy item 1
   (one commit) does not apply — a stale-card run commits nothing.

   **Obsolete/superseded card**: distinct from stale — nothing fixed the defect, but PHASE 1
   locate/analysis (or an explicit user call mid-run) shows the card's whole reason to exist has
   been absorbed by a different, wider card (typically a FEATURE the described change turns out to
   be a fragment of). Do **not** invent a change to justify the card, and do **not** silently
   cancel it — a "superseded" judgment can be wrong in a way "already fixed by commit X" cannot. One
   `AskUserQuestion` naming the superseding card first: proceed with cancellation, or keep the card
   and continue the tweak as scoped. On confirmation: skip the implement/verify phases and run the
   § Card-mode cancellation write with `cancelledReason: "superseded by {card}: {one-line why}"`.
   Registration-policy item 1 (one commit) does not apply — an obsolete-card run commits nothing.

2. **No card argument** (free-text description, as always) — after the existing § Backlog guard
   resolves, run one further, narrower check: filter the same `guard-items` load down to
   `type === "TWEAK"` (dev) / `"POLISH"` (game) only, and token-match the description against just
   those cards. Match → offer _"pick up existing card `{name}` (Recommended)"_ (switches into card
   mode above) vs _"proceed separately"_ (a second, unlinked tweak touching the same area — rare, not
   forbidden). No match → proceed as a standalone tweak, unchanged from today.

   This mini-guard is deliberately narrower than `/project-todo`'s dedup (which scans the whole
   backlog) — its only job is to stop a tweak run from silently duplicating a card someone already
   offloaded from a ship run.

**Card-mode completion write** (PHASE 4 of the calling skill, in addition to its normal steps): flip
the card `shipped: true` + `shippedAt` + `shippedSha` + `summary` (the tweak's one-line outcome) and
move it from `backlog.json#features[]` to `.project/archive/backlog-archive.json#archived[]`
([BACKLOG.md § Archiving](BACKLOG.md) — TWEAK/POLISH archive like any other dev-track type). The
dashboard derives its features view from backlog + archive (`DASHBOARD-PROJECT.md § Features`) —
project.json persists no features list to sync. This is the **only** sanctioned backlog write a
tweak run ever performs in the shipped outcome, and only in card mode — a free-text run still makes
zero backlog writes.

Immediately after this write, run [BACKLOG.md § Archive-move invariant](BACKLOG.md) on the card
just moved — confirm absent from `backlog.json#features[]` and present in the archive with all four
shipped fields, self-heal if not. Do not report the tweak as shipped until this holds.

**Card-mode cancellation write** (§ Card pickup → Obsolete/superseded card, in addition to the
calling skill's normal steps): a different outcome from the completion write above — the card is
**not** shipped, so it never moves to the archive and never gets `shipped`/`shippedSha`. Instead,
in place within `backlog.json#features[]`: flip `status: "CANCELLED"`, add `cancelledReason:
"superseded by {card}: {one-line why}"` and `cancelledAt` (`YYYY-MM-DD`), and remove `transition`.
This is the exact mutation [BACKLOG.md § Impact Check](BACKLOG.md)'s `obsolete` verdict already
applies from the ship define phases — reuse its shape verbatim rather than inventing a new one. The
card stays in `features[]`, restorable via the board's collapsed Archived (CANCELLED) lane, and
`backlog-load.js guard-items` excludes it from every future guard/pickup scan. A running board app
(`serve-backlog.js`) can silently revert this write from its in-memory store the same way it can
revert the completion write above — re-read `backlog.json` and confirm `status: "CANCELLED"`
survived before reporting the outcome; re-apply on a revert.

## Registration policy

A completed tweak registers as **exactly**:

1. One scoped conventional commit ([SCOPED-COMMIT.md](SCOPED-COMMIT.md)) — **except a stale-card or
   obsolete-card no-op** (§ Card pickup → Stale card / Obsolete/superseded card), either of which
   commits nothing.
2. Optionally **0-1 learning** — only when the tweak was a bugfix whose root cause has value beyond
   this spot (filter per [LEARNING-WRITE.md](LEARNING-WRITE.md) § Writer Append Protocol): `type:
"pitfall"`, `source: "extracted"`, 0-3 tags — then the Consolidation Gate once
   (`LEARNING-WRITE.md § Consolidation Gate`).
3. **Card mode only**: the § Card pickup completion write, or — for an obsolete/superseded card —
   the § Card pickup cancellation write.

Nothing else. No backlog card creation, no `feature.json`, no dashboard writes, no board signal
(`active-*.json` / ship checkpoint) — tweaks are not board-visible pipeline runs. **No state
auto-push either** (deliberate, do not "fix" this later): the only durable `.project/` delta is
≤ 1 learning plus, in card mode, the card completion write — both ride the next
ship/finalize/`core-pull` auto-push ([STATE-SYNC-PUSH.md](STATE-SYNC-PUSH.md) § Auto-push).

## Escalation gate

When the size gate fires (at intake or mid-implement), the skill **stops and asks** — never continues
silently. Three options, semantics fixed here (the AskUserQuestion block and the invocation mechanics
live in each skill's `references/escalate.md`):

- **(a) Park as TODO** _(recommended default)_ — **a live card is already in play** (card mode, or a
  free-text guard match) → the card already sits at `TODO`, so parking never touches `status`. Do
  **not** invoke `project-todo` here — it refuses to modify existing backlog items, so it can only
  skip back to the same card or, on a token-overlap miss, mint a stray duplicate. Instead, this run
  **promotes the card out of the tweak lane** with one targeted `Edit`: overwrite `type` away from
  `TWEAK`/`POLISH` with the type inferred from the card's own description
  (`project-todo/references/inference-rules.md`) — the `TWEAK`/`POLISH` row is unreachable by
  construction, since the size gate just ruled the change exceeds it, exactly mirroring what
  `dev-ship`'s/`game-ship`'s own offload flush already does for an over-gate finding
  (`dev-ship/references/phase-3-manual-finalize.md § Offload flush`); append one provenance sentence
  to `description` ("parked from /dev-tweak escalation ({criterion}) — exceeds tweak scope, pick up
  with /dev-ship"); and remove `transition: "tweaking"` if the board's pickup action set it — the
  queue-marker the board writes for both stacks the moment its `/dev-tweak`/`/game-tweak` copy
  button was clicked, not a lifecycle state. Skipping the `transition` removal leaves the card
  stuck rendering "tweaking · queued" in the board's IN PROGRESS lane forever, since nothing else
  ever clears it once the run that would have consumed it (this one) bails out instead. Without this
  promotion the board's dedicated "Tweaks" lane (§ TWEAK cards below) keeps re-offering the same
  `/dev-tweak` button, and the next pickup just re-derives the identical escalation from scratch.
  Leave `type` untouched when the card was never `TWEAK`/`POLISH` to begin with (a free-text guard
  match). This is a third sanctioned exception to the `type`/`transition` ownership in § Never below
  — the write is provisional, a later ship define pass classifies fresh and overwrites `type` again
  regardless. **No live card** → invoke the `project-todo` skill with one sentence: description +
  escalation reason + touched-file hints. project-todo owns naming, type/phase inference, dedup, and
  the backlog/project dual sync — the tweak skill performs **zero** backlog writes on this path (no
  board transition was ever set here). Provenance goes in the description text ("parked from
  /dev-tweak escalation").
- **(b) Hand off to the pipeline** — invoke the ship skill (or debug skill, for tier-3 signals).
  **A live card is already in play** (card mode, or a free-text guard match) → always pass that
  card's exact name, never a re-derived description, so define's find-by-name resumes the same card
  instead of creating a duplicate — and promotes it out of `type: "TWEAK"`/`"POLISH"` (see § Never
  below). **No live card** → pass the change description; define registers a fresh feature as it
  always does. Do **not** pre-create a card on this path: the ship's define phase owns registration.
- **(c) Conscious override** — continue as a tweak; the final report carries
  `Escalation overridden: {criterion}`.

## De-escalation gate

The mirror of § Escalation gate, run by `dev-ship`/`game-ship` at their plan-approval gate
(`dev-ship/references/phase-0-define-classify.md § Step 4b`) when none of size-gate criteria 1-4
fires against the completed define draft — see § Size gate, third consumer. The ship skill **stops
and asks** there too, folded into the existing plan-approval gate rather than a second question:

- **(a) Hand off to the tweak skill** _(recommended default)_ — no `feature.json` write; unwind the
  ship's pre-plan-mode bookkeeping (backlog `transition`, live signal, checkpoint — the ship skill's
  own reference names the exact fields/order) so the card doesn't strand in the board's IN PROGRESS
  lane; pass the card's exact name into `/dev-tweak` (`/game-tweak`) so it resumes the same card
  instead of minting a new one. **Also pass the completed draft's `files[]` and `acceptance[]`**
  (still in memory — this handoff runs in the same chat session, no `/clear` involved) — never the
  name alone. Without them the tweak run re-locates from scratch and loses the requirement contract
  define just built, which is the whole point of routing back here rather than parking; with them,
  `files[]` pre-seeds the tweak's own PHASE 1 locate step — that step's own size-gate re-check
  (criteria 2, 3, 4) still runs against the pre-seeded set, this handoff is not an exemption from
  it — and `acceptance[]` becomes its PHASE 3 verify checklist, which is _better_ verification than
  a native tweak run gets on its own.
- **(b) Continue with the pipeline** — conscious override; the final report carries
  `De-escalation overridden: tweak-sized ({N} files, no net-new surface)`.
- **(c) Park** — reject the plan, card returns to `TODO`.

## Never (drift traps, with owners)

A tweak run must never:

- write `shipped` / `shippedAt` / `shippedSha` / `summary` / `refactor` on a card — owned by the
  ship refactor phase via `completion-sync.js`, **except the § Card pickup completion write, and only
  for the exact TWEAK/POLISH card this run was invoked with**;
- flip a card's `status` or set/clear its `transition` — owned by the ship pipelines and the board,
  **except that same § Card pickup completion write, or the § Card pickup cancellation write** (a
  TWEAK/POLISH card's lifecycle is `TODO → shipped` or `TODO → CANCELLED (superseded)` directly).
  A card can carry a board-set `transition: "tweaking"` while still at `TODO` — that is the board's
  queue-marker from the copy action (§ Card pickup), not a lifecycle state, so it is not protected
  the way `status` is. **Escalation exception**: on a § Escalation gate (b) handoff, the invoked ship
  skill's define phase (not this tweak run) is the one that flips the card to `DEFINED` and rewrites
  its `type` away from `TWEAK`/`POLISH`, clearing that same `transition` in the process — see
  `dev-ship/references/dev-define/references/phase4-sync.md` § TWEAK promotion (dev) /
  `game-ship/references/game-define/references/phase5-sync.md` § POLISH promotion (game). That write
  belongs to define, never to this skill. **§ Escalation gate (a) exception**: parking a live card
  promotes it out of the tweak lane — overwrites `type` away from `TWEAK`/`POLISH` and clears this
  board-set `transition` if present (never `status`) — see § Escalation gate (a) above;
- create a card by hand — the backlog/project dual write ([BACKLOG.md](BACKLOG.md) § Parallel sync)
  is project-todo's job; the park path _invokes_ that skill; card pickup only ever mutates an
  **existing** TWEAK/POLISH card, never creates one;
- touch `feature.json` or the seed;
- stage or commit `.project/` paths ([SCOPED-COMMIT.md](SCOPED-COMMIT.md) — local-only state);
- run the state auto-push (see § Registration policy).

## Skill-specific configuration

Each tweak skill declares in its SKILL.md:

```
Tweak configuration (per shared/TWEAK-DISCIPLINE.md):
- verify: <scoped test/lint commands for the stack>
- escalation ship target: /dev-ship | /game-ship
- escalation debug target: /dev-ship debug round (inline ladder) | /game-debug
```
