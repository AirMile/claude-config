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

## Registration policy

A completed tweak registers as **exactly**:

1. One scoped conventional commit ([SCOPED-COMMIT.md](SCOPED-COMMIT.md)).
2. Optionally **0-1 learning** — only when the tweak was a bugfix whose root cause has value beyond
   this spot (filter per [LEARNING-WRITE.md](LEARNING-WRITE.md) § Writer Append Protocol): `type:
"pitfall"`, `source: "extracted"`, 0-3 tags — then the Consolidation Gate once
   (`LEARNING-WRITE.md § Consolidation Gate`).

Nothing else. No backlog card, no `feature.json`, no dashboard writes, no board signal
(`active-*.json` / ship checkpoint) — tweaks are not board-visible pipeline runs. **No state
auto-push either** (deliberate, do not "fix" this later): the only durable `.project/` delta is
≤ 1 learning, and it rides the next ship/finalize/`core-pull` auto-push
([STATE-SYNC-PUSH.md](STATE-SYNC-PUSH.md) § Auto-push).

## Escalation gate

When the size gate fires (at intake or mid-implement), the skill **stops and asks** — never continues
silently. Three options, semantics fixed here (the AskUserQuestion block and the invocation mechanics
live in each skill's `references/escalate.md`):

- **(a) Park as TODO** _(recommended default)_ — invoke the `project-todo` skill with one sentence:
  description + escalation reason + touched-file hints. project-todo owns naming, type/phase
  inference, dedup, and the backlog/project dual sync — the tweak skill performs **zero** backlog
  writes itself. Provenance goes in the description text ("parked from /dev-tweak escalation").
- **(b) Hand off to the pipeline** — invoke the ship skill (or debug skill, for tier-3 signals)
  directly with the change description — or, on a guard match, with the existing card's name. Do
  **not** pre-create a card on this path: the ship's define phase owns registration.
- **(c) Conscious override** — continue as a tweak; the final report carries
  `Escalation overridden: {criterion}`.

## Never (drift traps, with owners)

A tweak run must never:

- write `shipped` / `shippedAt` / `shippedSha` / `summary` / `refactor` on a card — owned by the
  ship refactor phase via `completion-sync.js`;
- flip a card's `status` or set/clear its `transition` — owned by the ship pipelines and the board;
- create a card by hand — the backlog/project dual write ([BACKLOG.md](BACKLOG.md) § Parallel sync)
  is project-todo's job; the park path _invokes_ that skill;
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
