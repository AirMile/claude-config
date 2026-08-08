# PHASE 3 — Manual tests + Completion (MAIN CHAT)

Runs in the main chat so `AskUserQuestion` reaches the real user. Resumes the half of `dev-verify`
that AGENT 2 deliberately skipped: the manual walkthrough (if any) and the DONE completion.
Finalize/merge has moved to the end of PHASE 4 (after refactor) so refactor commits land on the
feature branch first. AGENT 2's `remainingManualItems` is authoritative here.

**Dual reader**: this file is read by the main chat on both paths — the manual-items path (below),
and the no-manual path (`references/orchestration.md § 4`), which runs only **Step 1** + **Step 3**,
never Step 2 (no app launch, no walkthrough — this route only fires when there's nothing to show a
human) and never the routing sections below (those assume manual items). **`/dev-manual`** is the
standalone skill that owns this whole phase for a resume (`dev-manual/SKILL.md`) — it reads this
same file rather than duplicating it; `/dev-ship {feature}` still resumes here too (same reference,
same routing), so both commands land in the same place.

## Resume entry (fresh session)

When PHASE 3 is entered via a direct resume (a fresh chat running `/dev-manual {feature}` — or
`/dev-ship {feature}`, same result — after the last session handed off here: the deliberate token
break after auto-verify leaves manual items, the common case — or was interrupted), `results.verify`
comes from the checkpoint (`ship-{feature}.json`), not from an in-context AGENT 2 return. Run
**Step 1** (enter the worktree) and **Step 2** (launch the app via the App-launch rule) exactly as on
the normal path,
then route **per open item** in the following precedence order (highest first — check 1 before 2,
2 before 3, and so on; a resume typically finds only one kind of open work, but if the ledger has
several items at different stages, e.g. one still mid-dispatch while another already escalated,
handle each via its own highest-matching bullet):

1. **Item has `heavyRoundFailed: true`** (still open — cleared once resolved) → resume directly at
   `debug-round-heavy.md § 8`'s re-check. The fix plan already exists; nothing to redesign.
2. **Item has `debugTier: "heavy"`** (and not `heavyRoundFailed`) → go straight to
   `references/debug-round-heavy.md § 1` for that item (`debug-round.md § 8` escalated it there).
3. **Item has `debugTier: "light"` AND a non-empty `lightRoundNotes`** → a light round already ran
   to completion (the notes read as investigation + hypothesis + fix + re-check, not a bare park) —
   the `debugTier: "heavy"` write was interrupted before landing. Treat it as already escalated: go
   straight to `references/debug-round-heavy.md § 1`, and first patch `debugTier: "heavy"` to
   correct the record.
4. **Item has `debugTier: "light"`** (no `lightRoundNotes` yet) → go straight to
   `references/debug-round.md § 1` for that item (`fix-round.md § Re-check` parked it there) — its
   evidence is already durable in the ledger, nothing is re-asked.
5. **`manual.fixPlan` present and `activeWorkflow: "phase3fix"`** (a dispatch was in flight) → go to
   `fix-round.md § Dispatch` and relaunch `ship-fix.js` with `resume` built from `manual.dispatch`
   (cross-session) or `resumeFromRunId` (same session, per `shared/SHIP-RESUME.md`).
6. **`manual.fixPlan` present, dispatch complete (`manual.dispatch.allFixed` or all groups
   terminal), and ≥1 item from that round has no `verdict: "pass"`, `"accepted"`, or `"offloaded"`
   yet and no `debugTier` set** →
   go to `fix-round.md § Re-check` for those still-open items (checks 1–3 already claimed any item
   that re-check has already escalated on a prior pass — this bullet only fires for the ones it
   hasn't reached yet).
7. **Ledger complete (`manual.items` covers every item, `manual.interviewDone: true`) but no
   `manual.fixPlan`** → go straight to `§ Findings ledger + routing` below and re-enter the fix-plan
   gate (the ledger is durable, so the walkthrough never re-runs — only the round's fix-plan draft was
   lost, same as a rejected-and-abandoned plan would be).
8. **No `manual` block, or `manual.items` shorter than `results.verify.remainingManualItems`** →
   run the walkthrough (`manual-interview-walkthrough.md`), filtering `remainingManualItems` down to
   the items **not yet present** in `manual.items` (already-verdicted items are not re-asked). The
   walkthrough's Step A re-arms `active-{feature}.json` with `waiting: "manual-tests"`, so the board
   flips the row from **parked** back to **waiting**. (Vacuously lowest precedence — no item can have
   a `debugTier` or verdict before the ledger exists.)

Keep the checkpoint `phase: "PHASE 3"` throughout.

## Step 1 — Enter the worktree

The agents ran in isolated contexts; the main-chat shell is **not** in the worktree. Switch in
before anything else: execute `.claude/skills/shared/WORKTREE.md` — **§ Switch into existing
worktree** plus **§ Symlink Integrity Gate** only, not the whole file (§ Shared .project/ via
symlink and § Caveats are auto-create material and never fire here) — with
`feature-name = {feature}` and `feature.status = DOING`. This switches to `worktree-{feature}`
(needed for the dev-server /
Playwright daemon that the walkthrough uses) and runs the symlink-integrity gate.

> **Gate scope:** only the 4 required symlinks (`backlog.json`, `features`, `project.json`,
> `project-context.json`) gate the switch. `wireframes`/`screenshots`/`thinking` may dangle safely
> (their source dirs don't always exist in main) — do **not** abort the gate on those.

## Step 2 — Manual walkthrough (only if `remainingManualItems` non-empty)

Skip this step entirely when AGENT 2 returned `remainingManualItems: none` (the 85% case) — go
straight to Step 3.

**Launch the app + hand off — don't block on a readiness grep.** Start the app in the background,
then **hand the first item to the user immediately** and let them confirm when the window is up:
_a manual test is verified by the human, not by a log line — the person at the window is the
readiness signal._ Never make the user wait on your own "is it ready yet" check.

> **STOP — launch command shape.** `run_in_background: true` already backgrounds the whole
> command. Do **not** also append a trailing shell `&`/`disown` — that double-backgrounds the
> process, and the tool reports the launch itself as "completed" while the app keeps running,
> which reads as a crash and costs a clarifying round.
>
> - Wrong: `Bash({command: "npm run tauri dev & disown", run_in_background: true})`
> - Right: `Bash({command: "npm run tauri dev", run_in_background: true})`

> **STOP — confirm the fix is actually loaded before asking for a re-check.** After editing a file
> during a fix/debug round with the app already running, grep the dev-server's background output
> for an HMR/rebuild line naming that file before handing the item back to the user. No matching
> line (or a full-reload/compile-error line instead) → kill and relaunch the app before asking —
> never hand off a re-check against code the running instance hasn't actually picked up.

**App-launch rule — launch what the manual item actually needs, from the project's OWN run config.**
A hard rule, not a judgment call: a slow compile or a heavier process is **never** a reason to
substitute a lighter command that cannot exercise the item under test.

**Source the launch command from the project — don't hardcode `npm run dev`.** Resolve it lazily, in
this order, first hit wins (so you read only what this project needs): (a) a project-local run skill
or the built-in `run` skill's pattern for the detected type — it is the canonical launcher, prefer it
over re-deriving; (b) the project `CLAUDE.md` **Commands** table; (c) `package.json#scripts` /
`project.json#stack`. Launch the command the project declares for its own shell.

**Then match that command to what the item exercises:**

- **Native-shell app** (Tauri: a `src-tauri/` dir or `tauri` script; Electron: an `electron`
  dep/script) → launch the **desktop** command (`npm run tauri dev`, the electron dev script).
  **Never substitute the frontend-only dev server** (`npm run dev` / bare `vite`) to skip the
  compile: the browser serves the UI but the native runtime is absent — Tauri's
  `@tauri-apps/plugin-fs|dialog|store`, Electron's IPC/`fs` are `undefined` there — so any item that
  opens a file, reads disk, or hits a native API is **impossible** in the browser and gets
  force-skipped (the exact failure this rule prevents). The compile is slow; tell the user it is
  building and wait.
- **Web app** → the project's declared web dev script IS the app, but be smart about the item's
  needs: if it exercises an **API / SSR / auth / DB** path and the frontend dev server does not also
  start the backend, launch the backend too (a monorepo `dev` that runs both, or the separate
  api/server script) — a frontend-only server force-skips API-dependent items the same way a browser
  force-skips native ones. A pure client-side UI item needs only the dev server.
- **CLI / TUI / server-only / library** → no window: drive it as the `run` skill's pattern for that
  type does (run the binary, start the server, exercise the export) and hand the user the concrete
  command + expected output instead of a URL.
- **An app no vehicle here can launch** (a desktop app behind a runtime the harness does not drive —
  MT5/Wine, a device simulator, a physical rig). The same condition
  `manual-interview-walkthrough.md § Step A2` already recognises as "no vehicle means no evidence":
  there it switches the sweep to user-evidence mode, here it switches the launch to a
  **prepare-then-hand-over**. Do the half you can: build/compile, sync artifacts to wherever the
  runtime actually reads them, and run the project's own staleness check so the hand-over is not
  against a stale build. Then hand the user the concrete open-it steps and **name the signal that
  proves the running build is yours** (a version label, a fresh log line) — the no-hot-reload rule
  below applies in full, since nothing here reloads. Prefer a machine-readable side channel the app
  writes (a log file, an export) over asking the user to transcribe values: it is faster, and it is
  evidence rather than testimony.

Principle: **the lighter command is acceptable only when it can actually exercise the item.** If a
manual item touches a capability the lighter command does not provide (native runtime, backend, SSR),
launch the heavier one — the only cost is startup time, whereas the wrong launch wastes the whole
manual round. When unsure, launch the fuller shell.

**Git-manipulating feature → check for a worktree branch-name collision first.** If the feature
under test itself performs branch operations (switch/create/merge), the app's project selection may
be the very repo this ship is running in — and its other local branches may already be claimed by
`.claude/worktrees/*` (git refuses to check out a branch that's checked out elsewhere). Run `git
worktree list` before presenting item 1; if the only other branches are worktree-claimed, set up a
disposable scratch git repo (a few plain branches, a deliberately colliding file for a merge-conflict
item) instead of discovering the blocker mid-item.

**If the app under test has its own persisted project/workspace selection** (a canvas/IDE-style app,
a multi-project tool) — its active project may not be the worktree the dev server serves from.
Before creating any test fixture file (e.g. for a read-only-file or permission-error scenario),
verify which path the running app actually has open (its own settings/store, not an assumption
that "the worktree" == "what the app shows") — a fixture written to the wrong path silently never
appears in the app and costs a full extra round to diagnose.

**Presets are app state too — pin them before the first observation.** A saved template, workspace,
profile, layout or theme changes what is under test even when it "loads nothing" of the feature
itself, and it is invisible in every screenshot. The first observation of every item must come from
a **fresh instance with no preset applied**, and the hand-off to the user says so in those words. A
preset applied part-way through invalidates every observation after it — treat that round as void
rather than reasoning about the results. Where the app persists such state per document/window
(charts, boards, canvases), "fresh" means a new one, not a reset of the existing one.

**No hot reload → confirm the running build another way.** The HMR/rebuild grep above assumes a dev
server that announces reloads. A compiled or desktop app caches its loaded module: replacing the
artifact on disk while the app is running does **not** reload it, so a file-level sync check reports
green while the previous build keeps executing. Before handing over any item, confirm the running
build from something the app itself renders — a build stamp/version label, or a visible fingerprint
of the change (a new field, a new row, a changed count). No such signal available → restart the app
rather than re-attach or re-open, and say which signal you used. A disk comparison is evidence about
the disk, never about the process.

> If you genuinely must detect readiness programmatically (e.g. to auto-open a browser tab), it MUST
> (a) tolerate ANSI color codes — match the bare word (`grep -aE "Running|Finished|error"`), never a
> literal `Running \`space\`…`pattern, because Cargo/Vite wrap words in ANSI escapes so "Running" is
followed by an escape, not a space; and (b) use a **bounded** wait (a `run_in_background` `until`loop with a timeout / fixed poll count) that falls back to surfacing to the user — never an
unbounded`until` that can hang forever on a signal that never arrives.

Then run the **item-by-item interview walkthrough**: Read
`.claude/skills/dev-ship/references/manual-interview-walkthrough.md` and execute it for the
`remainingManualItems` from AGENT 2 — no plan mode is involved (the round is interactive collection,
not a thinking phase — `manual-interview-walkthrough.md § Plan mode is not used here`), each item
gets an overview then a guided step-by-step walk, non-pass verdicts get their detail captured
immediately, and a closing interview asks what else should be different or better.
**Nothing is fixed during this walkthrough** — it only builds the findings ledger, persisted to the
checkpoint item-by-item as each verdict lands (so a killed session resumes mid-walkthrough at the
last **persisted** item, per § Resume entry, with nothing lost beyond the single write in flight).

## Findings ledger + routing

No plan mode is involved here (`manual-interview-walkthrough.md § Plan mode is not used here`) — the
ledger is already fully persisted item-by-item, so this is a plain routing decision on
`manual.items` + any interview-close findings:

| Ledger state                                                                                                       | Route                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No Fail/Tweak findings (all Pass, or only Skip/Defer)                                                              | Summarize (e.g. "all N items pass — {k} unproven" when any evidence-class Pass carries `evidence: "none"`; omit when k = 0) → Regression re-check → Step 3            |
| No Fail finding, and ≥1 remaining Tweak finding is DEBUG-LADDER tier 1 (symptom + cause both visible) and in-scope | **Offload flush** (below) for any non-qualifying findings, then **Inline fix now** (below) for the qualifying findings (cap 3) → Regression → Step 3                  |
| No Fail finding, and no remaining Tweak finding qualifies for the inline band above                                | **Offload flush** (below) → Regression → Step 3                                                                                                                       |
| Anything else (any Fail finding present, mixed with or without Tweak findings)                                     | Read `fix-round.md` and run the round gate; **it** does its own fresh `EnterPlanMode` (`shared/PLAN-MODE.md § Conditional entry`) — this walkthrough never opened one |

**Inline fix now** — for each qualifying finding (DEBUG-LADDER tier 1, in-scope, within the cap):
fix it directly in the main chat (the app is already running), Read `shared/DEBUG-LADDER.md` and
apply tier 1 (symptom + cause both visible, ≤1-2 files). If the fix touches typed code, run the
project's typecheck command on the touched file(s) before reloading — a live "it looks right"
confirm from the user cannot catch a type error the dev server silently tolerates. Then reload, let
the user confirm live.

This path carries the same **polish-loop cap** as `fix-round.md § Re-check`'s cosmetic-tweak
bullet — capped at 3 attempts per finding, no round-gate, no plan-mode fix-plan design: after each
attempt, patch the ledger item's `tweakAttempts` (increment, starts at 1) via `ship-checkpoint.js
item {feature} manual` — durable record that a fix is in progress, not a park (`debugTier` stays
unset). On a resume landing back on this item, read the existing `tweakAttempts` first and continue
counting — never reset to 1, or a crash/`/clear` becomes a way to dodge the cap.

- **Satisfied at attempt ≤3** → clear `tweakAttempts`, **flip `verdict` to `"pass"` in the same
  upsert** — see the verdict-flip rule in § Offload flush below; a lingering `"tweak"`
  verdict on an item fixed in-ship (not offloaded) would leave `route` unable to resolve it, since
  it never gets an `offload` field either.
- **Turns out to need real investigation mid-loop** (reading library internals, forming a
  root-cause hypothesis, more than a live style tweak) — re-file it as a fail-class finding
  immediately and drop out of this loop into `fix-round.md`'s one-attempt-then-ask path, even if
  `tweakAttempts` hasn't hit 3 yet. This is evidence the tier-1 classification was wrong, not a
  reason to keep guessing.
- **Still not right after 3 attempts** → this is a route, not a verdict — Claude decides directly
  instead of asking (`manual-interview-walkthrough.md § Step C`'s verdict-vs-route rule). Category
  decides which:
  - **TESTABLE** → clear `tweakAttempts`, escalate to root-cause analysis, handle exactly as the
    fail-class park (`fix-round.md`'s Otherwise bullet). Print: `3 pogingen, convergeert niet —
{titel} gaat naar de debug-ladder. Antwoord "accepteer" om hem alsnog zo te sluiten.` The named
    undo verb ("accepteer") stays live for one turn before the park's signal-clear runs — if the
    user replies with it in that window, take the "Accept anyway" branch below instead.
  - **MEASURABLE** → clear `tweakAttempts`, route to **Offload flush** (below) instead of park — a
    cosmetic finding that survived 3 tweak attempts is, by the size gate's own "default to TWEAK
    when it's a close call" rule, definitionally a close call, not an escalation.
  - **"Accept anyway"** (the named undo verb above, or the user asks for it directly) → clear
    `tweakAttempts`, `verdict: "accepted"`, done.

No round bookkeeping beyond `tweakAttempts` — this stays the friction-free path for genuinely small,
in-scope work.

**Offload flush** — the outcome for tweak-class findings that don't qualify for the inline band
above: for those findings the ship stays raw-functionality only, improvements ride `/dev-tweak`
later. Three variants share this section, all ending in the same upsert.

**Ordering (normative when reached from the partition row above): this flush runs to completion —
every card created, every ledger item's `offload` field written — before the first inline `Edit` of
this routing pass.** This bounds a crash mid-pass to a distinguishable state: an offloaded item
always carries `offload` before any inline item carries a verdict at all (see the verdict-flip rule
below). **Resume idempotency**: an item that already carries an `offload` field on this pass was
already flushed — skip it rather than re-invoking `/project-todo`, or a resumed run mints a
duplicate card.

- **Tweak-class finding, within the tweak size gate.** Before invoking `/project-todo`, judge the
  finding's projected scope against `shared/TWEAK-DISCIPLINE.md § Size gate` criteria 1-4 (net-new
  surface, >3 files, new test surface, architecture — criteria 5-6 don't apply here: 5 is a
  `/dev-tweak` intake-time backlog-guard check, 6 is fail-class and never reaches offload). You have
  the worktree open and just wrote the code, so this is a judgment call on what you already know, not
  new analysis — no `AskUserQuestion`, same zero-modal principle
  `project-todo/references/inference-rules.md` states for its own gate. **Default to TWEAK when
  it's a close call**: the cost
  is asymmetric — overestimating just runs one extra ship later (the user can always retype it
  straight to `/dev-tweak` too), underestimating burns the round-trip described in this file's own
  design notes (a `/dev-tweak` session that immediately re-escalates to `/dev-ship`). Only a clear
  gate hit routes the other way. **Within the gate** → invoke `/project-todo` with one sentence:
  `"{observed} → {expected}, type TWEAK, depends on {feature}, origin agent via /dev-ship, parked from /dev-ship manual round"`
  — batch at most 3 items per invocation (`project-todo/SKILL.md § PHASE 0` step 3's own multi-item
  split cap). The `origin agent via /dev-ship` token is mandatory on every variant below too
  (`shared/BACKLOG.md § Card provenance`) — without it the card is written as if the user asked for
  it. Ledger verdict stays `"tweak"`.
- **Tweak-class finding, exceeding the tweak size gate.** Same finding, but the judgment above hit a
  clear criterion. Invoke `/project-todo` with **no** explicit `type` hint — normal inference then
  lands on `CHANGE` ("now does X, should do Y") or `FEATURE` as the default — and name the reason in
  the sentence:
  `"{observed} → {expected}, origin agent via /dev-ship, parked from /dev-ship manual round (exceeds tweak size gate: {criterion})"`.
  Ledger verdict is `"offloaded"`, not `"tweak"` — this finding is headed for
  the ordinary pipeline, same as the out-of-scope case below, even though it originated as an
  in-scope tweak-class judgment.
- **Out-of-scope defect finding** (`shared/FEEDBACK-CATEGORIZATION.md § Scope check`,
  `manual-interview-walkthrough.md § Step D`, `fix-round.md`'s scope-check bullet). Invoke
  `/project-todo` with normal type inference (no explicit `type` hint — this is a real defect, not
  an improvement, so it lands on `BUG`) but **with** the provenance token —
  `"{observed} → {expected}, origin agent via /dev-ship, parked from /dev-ship manual round (out of scope)"`
  — same batching cap. Patch the ledger item's verdict to
  `"offloaded"` instead of `"tweak"` — it is a different card type and a different terminal verdict
  from the tweak case above, even though the write mechanics are identical.

After each card is created (any variant), upsert the matching ledger item — `node
~/.claude/scripts/ship-checkpoint.js item {feature} manual` — with `offload: "{card-name}"`.
`shared/TWEAK-DISCIPLINE.md § Card pickup` documents how `/dev-tweak {card-name}` later picks up a
TWEAK card; a plain `BUG`/`CHANGE`/feature card instead re-enters the ordinary backlog track and gets
picked up by a future `/dev-ship {card-name}` run.

**Verdict-flip rule (must-follow).** `ship-checkpoint.js route` counts `"offloaded"` verdicts as
resolved, and a `"tweak"` verdict as resolved **only when the item also carries an `offload` field**
(`scripts/ship-checkpoint.js`'s `manualLedgerResolved`) — offloading is what makes either true (the
item was handed off, not dropped). The **Inline fix now path above is the one exception**: it also
starts as a `"tweak"` verdict but fixes the item in-ship rather than offloading it, so that path
must flip its verdict to `"pass"` once the live re-check confirms the fix (stated again there — do
not skip it just because it's also stated here). A `"tweak"` verdict that ends up with neither a
`"pass"` flip nor an `offload` field is a bug, not an edge case: `route` keeps the ledger open until
one of the two happens.

**Otherwise** → Read `.claude/skills/dev-ship/references/fix-round.md` and follow it: the
hoisted-bookkeeping + round-level fix-plan gate, which opens its own fresh plan-mode session (the
interview never opened one), designs the fix inside it, grouping findings into file-disjoint waves
and deciding inline-vs-agent dispatch per group, then the `ship-fix.js` dispatch (Sonnet), and the
post-dispatch re-check. That file owns everything from here through "all findings resolved or explicitly
deferred" — it returns control here only when ready for the regression re-check below. Its own
`§ Re-check` handles the case where a fail-round's remaining findings turn out to be tweak-only
partway through (a fail got fixed, only tweaks remain) — same offload flush, entered from there
instead of here.

**Policy — a `fail` finding never leaves the ship via a backlog todo.** It is fixed, parked (the
checkpoint stays open, the feature stays non-DONE — see `fix-round.md § Re-check`'s park option), or
escalated via the debug ladder. Tweak findings that qualify for the inline band above (DEBUG-LADDER
tier 1, in-scope, within the cap) are fixed in-ship instead of offloaded. Everything else — tweak
findings outside that band, out-of-scope defects split off by the Scope check
(`shared/FEEDBACK-CATEGORIZATION.md § Scope check`), and net-new capability (walkthrough Step F) —
defaults to `/project-todo` offload — `type TWEAK` only for a tweak that also fits
`shared/TWEAK-DISCIPLINE.md § Size gate` (ledger verdict `"tweak"`); plain inference
(`CHANGE`/`FEATURE`) for a tweak that exceeds it or an out-of-scope defect (→ `BUG`), both ledger
verdict `"offloaded"`. Net-new capability (Step F) never enters the ledger at all — no verdict field
applies — and also carries no `TWEAK` hint, since it is size-gate criterion 1 by definition. The
ship then finalizes normally and **refactor runs as usual** (no deferral). `Skip`/`Defer`
outcomes never block finalize either — they
are recorded (deferred items stay open for a later re-test), and the flow continues regardless of how
many are open; remember that Defer is for external blockers only (walkthrough Step C) — a `fail` is
never disguised as a Defer to get it out of the way. Unproven passes (an evidence-class Pass with
`evidence: "none"`) never block either — they are surfaced in the routing summary and the completion
report, nothing more (soft gate).

## Regression re-check (before completion)

If **any** PHASE 3 fix or tweak touched code, run the FULL test suite **plus a typecheck/lint pass**
(the project's own commands, e.g. `tsc --noEmit` + the linter) once before Step 3. Skip only when
nothing was changed in this phase (all items passed first time). No plan mode is involved anywhere
in this walkthrough (`manual-interview-walkthrough.md § Plan mode is not used here`).

> **Todo**: dispatch the fresh agent below first. Fall back to inline `run_in_background` only when
> the dispatch itself errors — running the suite inline by default defeats the reason this section
> exists (keeping the raw test/typecheck/lint output out of the main-chat context).

**Primary — fresh-agent dispatch, never a fork** (`shared/SKILL-PATTERNS.md § Fork Delegation`'s own
decision rule: this task's context is "cheaply re-statable as paths/fields," not conversation-
load-bearing, so it routes to a fresh agent, not a fork). Dispatch one fresh (non-fork)
`general-purpose` agent with `model: "sonnet"` (mechanical: run commands, summarize failures) and a
short, self-contained prompt: the worktree path, and one sentence on
what just changed (from the checkpoint/commit, not the live interview — state it as a fact, don't ask
the agent to infer it). **A fresh agent starts with zero conversation history**, so unlike a fork it
structurally cannot read this skill's own "Step 3 hands off to `orchestration.md § 5` — continue
there" language or any other pipeline-continuation instruction — isolation is the defense, not just
the prompt. **Still scope the prompt explicitly** (defense in depth): the agent's ONLY job is to run
the suite + typecheck/lint and return a digest — it must NOT act on the result, continue the ship, or
call the Workflow tool. **State this too**: run each command as a blocking, foreground Bash call —
never `run_in_background` — and the agent's final answer must be the actual digest, not a "still
running" status; an agent that reports it kicked off a background process instead of returning
results has failed the task, not completed it. It returns ONLY a compact digest: overall pass/fail,
typecheck/lint pass/fail, and on any fail, each NEW failure relative to the known state (test name +
first error line). End the turn, wake on its notification — do not resume the agent with follow-up
instructions that could restart it mid-pipeline; if the digest is incomplete or wrong, re-dispatch a
fresh (non-fork) agent instead — never escalate to a fork on retry, and never assume a second attempt
is inherently safer than the first. **This is exactly the case `shared/SKILL-PATTERNS.md § Agent
Resume (Sparring)` excludes** — this agent could act on a resumed follow-up instead of just
answering it, so it never gets one. **Fallback:** run the suite + typecheck/lint inline via
`run_in_background` Bash and read only the failure tail, not the full log.

New failures → back into the fix routing above (ladder escalation applies); clean → proceed to
Step 3.

## Step 2 teardown — stop the launched app

Stop the app you launched in Step 2 in **either** of these two moments — whichever comes first:

- **Full resolution**: all items verdicted, any fix-round re-checks passed, regression re-check
  clean, right before proceeding to Step 3.
- **A fix-round park** (`fix-round.md § Re-check`'s Otherwise bullet, or the "Park — debug in a
  fresh chat" choice): right before ending the turn — a fresh session's `debug-round.md` resume
  relaunches its own app instance, so leaving this one running orphans a duplicate dev-server/port
  across the session boundary.

Kill the process(es) you started in Step 2 in either case. A lingering app process serves no further
purpose here and would otherwise still be running when PHASE 4 spawns the refactor agent into the
same worktree (potential file-lock/port contention, and simply wasted resources). Skip silently when
Step 2 never launched anything (the no-manual path). **Never kill an app the user started
themselves** (the prepare-then-hand-over branch): you did not start it, it holds no worktree cwd,
and a deferred item often wants it left open. Say in one line that it is still running and why.

**Clean up manual-test fixtures created outside the worktree.** When the app's active-project
selection pointed at the main checkout instead of the worktree (the mismatch this file already warns
about above), any scratch file created to exercise a manual item lands in main, not the worktree — it
is untracked and irrelevant to the merge, but a stray file/directory there will otherwise trip
`shared/FINALIZE.md`'s pre-merge Uncommitted Changes Check with an avoidable prompt. Remove such
fixtures now, in the same teardown moment as the app kill.

## Step 3 — Completion (DONE)

All AUTO passed (AGENT 2) and no open manual FAIL → complete (but do **not** integrate yet):

1. **Known-issue payload**: scan `checkpoint.manual.items[]` for every item with
   `verdict: "accepted"` or `verdict: "deferred"` and map each to
   `{ id, title, verdict, reason, source: "ship-ledger" }` (an `"offloaded"` item is deliberately
   **not** included here — the backlog card it was handed to is its trace, not this payload) —
   `reason` is a short synthesis of the
   item's `expected`/`lightRoundNotes`/context (same free-text judgment already used for
   `fixSync`/`observations`). When a `deferred` item's reason names an existing backlog card (e.g.
   the blocking limitation already has its own TWEAK card), also set `blocker: "{card-name}"` on
   that entry. Pass the result as `payload.knownIssues` on the completion-sync call
   below (omit the key entirely when empty — never send `[]`). This is what survives the ship
   checkpoint's eventual deletion (`SKILL.md § PHASE 1–4`, on green completion); without it, an
   explicitly accepted or deferred finding leaves no trace once the ship completes.
   `completion-sync.js` auto-creates/updates a `verify-{feature}` VERIFY card and sets
   `hasDeferred: true` whenever a `deferred` entry is present — nothing else to do here
   (`shared/BACKLOG.md § VERIFY cards`).
2. Run `dev-verify`'s completion-sync to flip the feature to **DONE** (backlog + feature.json
   `tests` section + learning extraction) — Read `.claude/skills/dev-ship/references/dev-verify/references/completion-sync.md`
   if the reused flow does not already cover it from the manual step. (This is the DONE write AGENT
   2 was told to skip.) **Skip completion-sync's tail handoff**: its `VERIFY COMPLETE` block ends
   with a `Next: /dev-refactor` line + a Next-Step Clipboard Offer (`NEXT-STEP-OFFER.md`) — do **not**
   emit either. dev-ship drives PHASE 4 refactor itself; keep only the DONE writes + learning
   extraction, drop the terminal handoff (adapter rule 4, applied here in the main chat).

Do **not** finalize/merge here — stay in the worktree. Finalize runs at the end of PHASE 4
(SKILL.md § PHASE 1–4) so refactor commits land on the feature branch first. **Return to SKILL.md
§ PHASE 1–4**: continue per `references/orchestration.md § 5` (the checkpoint's `route` subcommand
sends you straight to PHASE 4) and handle its notification there. **Idempotency note**: `route` may
still return `"phase3-completion"` even when this Step 3 already ran inline (e.g. a resume that
landed directly in the manual round) — that's expected, not a signal to redo it; Step 1+3 are safe
to re-run but unnecessary if already done, so just proceed to § 5.

## Guard

Never merge in this phase, even on all-green. The merge belongs to PHASE 4's finalize step. (On a
manual FAIL the routing above already blocks PHASE 4.)
