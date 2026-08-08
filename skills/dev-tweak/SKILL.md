---
name: dev-tweak
description: Use when a change fits 1-3 files, no pipeline needed. Use with /dev-tweak.
argument-hint: "[change description | TWEAK card name]"
reads:
  [
    backlog.features,
    project-context.learnings,
    project.theme,
    feature.durableDecisions,
  ]
writes: [project-context.learnings, backlog.status, backlog.features]
metadata:
  author: claude-config
  version: 1.30.0
  category: dev
---

# Tweak

Fast path for small web-stack changes: a bugfix, copy/styling adjustment, config change, or small
refactor that fits 1-3 files. Everything heavier belongs to `/dev-ship` — the gate that decides is
[shared/TWEAK-DISCIPLINE.md](../shared/TWEAK-DISCIPLINE.md) (size gate, backlog guard, registration
policy, never-do list). No `TaskCreate` phase tracking — a tweak run is minutes of work with no
compaction risk; ceremony is what this skill exists to avoid (deliberate, not a gap:
`check-task-markers.py` expects 0 units here). Safe to run several `/dev-tweak`
invocations concurrently against the same repo/branch — PHASE 4's commit lands atomically per
[shared/SCOPED-COMMIT.md](../shared/SCOPED-COMMIT.md) § 5. Skill file stays English; user-facing
output follows `CLAUDE.md § User Preferences → Language:`.

Tweak configuration (per shared/TWEAK-DISCIPLINE.md):

- verify: scoped tests + lint per PHASE 3 below
- escalation ship target: `/dev-ship`
- escalation debug target: `/dev-ship {feature}` debug round, or the inline
  [DEBUG-LADDER.md](../shared/DEBUG-LADDER.md) tier-3 discipline outside a feature context

## PHASE 0 — Pre-flight, size gate & backlog guard

> **Todo**: session already in plan mode at invocation (harness-level, not this skill's own) →
> still run steps 1-3 and 5-6 now — they're read-only and plan-mode-safe. Defer only step 4 (a
> write) to the first action after the session's next `ExitPlanMode` resolves, before PHASE 1
> starts. A fired gate/guard still routes to `references/escalate.md` regardless of plan mode.

1. **Repo**: resolve `$REPO` per `shared/SYNC.md` § Worktree-aware Path Resolution —
   `git worktree list --porcelain | head -1` for `{main_worktree}` vs `git rev-parse --show-toplevel`
   for `{current}`; different → use `{main_worktree}/.project/`. `.project/` absent → degrade
   gracefully: skip the card lookup, guard, and learnings silently, keep the rest (the code change is
   the value; do not scaffold).
2. **Mode + description**: `.project/` present → resolve the card with the **narrowest load that can
   answer the question**, per [shared/TWEAK-DISCIPLINE.md](../shared/TWEAK-DISCIPLINE.md) § Card
   pickup path 1 (exact name, or an unambiguous ≥2-shared-token match against live `TWEAK` cards):
   - **Invocation argument is a bare kebab-case token** (a plausible card name) → try the
     single-card load FIRST: `node ~/.claude/scripts/backlog-load.js "$REPO" read-feature "<arg>"`.
     `present: true` + `type: "TWEAK"` → card mode, and this payload already carries
     `dependencies[]` — no second read, no `guard-items` load at all (card mode skips step 5's guard
     anyway, so the full-backlog payload would be loaded for nothing).
   - **`present: false`, a non-TWEAK type, or free-text prose** → THEN load
     `node ~/.claude/scripts/backlog-load.js "$REPO" guard-items` for the ≥2-shared-token match and
     step 5's guard (one load, not two).
   - **Match → card mode.** Description = the card's `description`. Dependency check against
     `dependencies[]` from whichever load ran (`guard-items` omits the field — on that path read the
     matched card's `dependencies` from `backlog.json` directly): one `AskUserQuestion` only when a
     dependency is present and not yet `shipped`/`DONE` (per TWEAK-DISCIPLINE § Card pickup); no
     dependencies field → skip silently. A dependency `read-feature` reports as `present: false` is
     usually **already resolved and archived**, not missing — look it up in
     `.project/archive/backlog-archive.json#archived[]` and check `shipped: true` (the criterion per
     TWEAK-DISCIPLINE § Card pickup). An archived `feature.json` carries `status`, never `shipped`,
     so `status: "DONE"` there is a weaker fallback signal, not the check.
   - **No match, or `.project/` absent → free-text mode.** Description from the invocation argument;
     if empty, ask one short question.
3. **Branch guard**.

   > **Todo**: run [shared/TWEAK-DISCIPLINE.md](../shared/TWEAK-DISCIPLINE.md) § Branch guard's
   > actual check now — `git symbolic-ref --short refs/remotes/origin/HEAD` (or the `main`/`master`
   > fallback) vs `git branch --show-current`. Run both commands; never infer the default branch from
   > the session's environment block or from memory. On the default branch → continue silently. Any
   > other branch or detached HEAD → warn + ask before proceeding.

4. **Baseline** — mandatory precondition for PHASE 4 and for a later escalate.md "override" choice,
   not optional ceremony.

   > **Todo**: run now, before step 5's gate check: `mkdir -p .project/session && git status
--porcelain | sort > .project/session/pre-tweak-status.txt` per
   > [shared/SCOPED-COMMIT.md](../shared/SCOPED-COMMIT.md) § 1 (skip only when `.project/` is absent).
   > Runs even when the gate is about to escalate — the file is cheap and unblocks a later "Continue
   > as tweak" override without re-deriving state.

5. **Gate (intake pre-check) + guard**.

   Apply [shared/TWEAK-DISCIPLINE.md](../shared/TWEAK-DISCIPLINE.md) § Size gate criteria **1, 5
   and 6** to the projected scope now — never from memory or from this file's own intro framing
   (criteria 2, 3 and 4 need the real file set and are decided in PHASE 1 step 2 instead). Use the
   shared table's own numbers — do not renumber locally:

   - **1 — Net-new surface** — adds capability instead of adjusting existing behavior
   - **5 — Guard hit with in-pipeline status** — see § Backlog guard resolution
   - **6 — Debug tier-3 signals** — intermittent failure, cause spans multiple modules, or a prior
     fix attempt already failed ([DEBUG-LADDER.md](../shared/DEBUG-LADDER.md) tier 3)

   Any of these fires → Read `references/escalate.md` now, before locating.

   § Backlog guard: **card mode** → skip (the card already names the scope — a fresh dedup would
   just rediscover itself). **Free-text mode** → run § Backlog guard as before, then § Card pickup
   path 2 (the TWEAK-only mini-guard) against the same `guard-items` load from step 2.

   > **Todo**: if any gate criterion fires or a guard demands escalation → Read
   > `.claude/skills/dev-tweak/references/escalate.md` and follow it — never continue silently.

6. **Slug**: card mode → the card's own kebab `name` (no re-derivation). Free-text mode → derive a
   kebab-case slug from the description (commit scope + learnings feature key).

   > **Todo**: print the intake status now, at this phase boundary — not deferred to the final
   > report: `Guard: ✓ no card overlap` (or the warn/advisory lines). Card mode prints
   > `Card: {name}` **instead** — the card already names the scope (step 5 skipped the guard), so
   > there is no guard result to report. Runs even when step 5's gate is about to escalate (same
   > mirrored rule as step 4's baseline) — `references/escalate.md § 3 (a)` reads this printed name
   > when it promotes the card out of the tweak lane. The `Gate:` verdict itself prints in PHASE 1
   > step 2, once the file set is known — do not print it here.

## PHASE 1 — Locate & context

1. **Locate** the change with minimal reads (Grep → targeted Read). The files found here feed the
   size-gate re-check and the learnings load below.

   **Pre-seeded from a ship de-escalation handoff** (invocation carries a `files[]` +
   `acceptance[]` pair, per [shared/TWEAK-DISCIPLINE.md](../shared/TWEAK-DISCIPLINE.md) §
   De-escalation gate (a)) → skip the Grep/Read locate itself; use the passed `files[]` as the
   located set directly. Everything downstream is unchanged: step 2's size-gate re-check still
   runs against that set — the handoff is not an exemption from it, and a criterion firing here
   still escalates exactly as a freshly-located set would. Hold the passed `acceptance[]` in
   memory and use it as PHASE 3's verify checklist (a test/check that exercises one of its
   scenarios counts toward Tier 1's auto-pass condition) instead of relying on whatever coverage
   happens to already exist.

   > **Todo**: an intake step here — a clarifying `AskUserQuestion`, or what the located code reveals —
   > can surface that the real scope exceeds the size gate (the described 1-file tweak is actually a
   > schema/sequencer/multi-file change). The moment it does, Read `references/escalate.md` and escalate
   > **before** any design work — do not run an Explore/plan/`EnterPlanMode` cycle on the out-of-scope
   > shape first (that is the intake-side twin of PHASE 2's "do not finish the edit first"). Holds even
   > when the session is already in harness plan mode. This gates every step below: only once it
   > clears do steps 2-5 run.

   > **Todo** (card mode): locate shows the described defect **already resolved** on `main` (a later
   > commit fixed it, or it never applied — **stale**), or the card's whole reason to exist is
   > **superseded** by a wider card (nothing fixed it, another card absorbed it — confirm with one
   > `AskUserQuestion` naming that card first) → skip PHASE 2, PHASE 3, and PHASE 4 step 1 entirely
   > (including step 3's learnings load); go straight to the matching PHASE 4 write per
   > [shared/TWEAK-DISCIPLINE.md](../shared/TWEAK-DISCIPLINE.md) § Card pickup → Stale card /
   > Obsolete-superseded card. Both cases: commit nothing, report carries no `Verdict:`/commit-sha
   > line. Superseded decline → continue the tweak as originally scoped.

2. **Close the size gate** — with the file set now known, apply
   [shared/TWEAK-DISCIPLINE.md](../shared/TWEAK-DISCIPLINE.md) § Size gate criteria **2, 3 and 4**
   (file span, new test _file_, architecture) to the actual files. Criterion 3 fires on a new test
   file or harness only — new cases in an existing test file are tweak-compatible. A criterion fires
   → Read `references/escalate.md` before any design work.

   > **Todo**: print `Gate: ✓ tweak-sized ({n} file(s))` now. Not printed → this step did not run;
   > do not proceed to step 3. One exception to "now": an intake `AskUserQuestion` in step 1 whose
   > answer itself decides the file set (a scope choice between a 1-file and a 2-file fix) — print
   > the `Gate:` line after that answer lands, since `{n}` does not exist before it. Never skip the
   > print, only defer it past that one question.

3. **Learnings** — **mandatory, not gated on tweak size**. Run exactly this, after locate so
   `--paths` carries the real file anchors (see [shared/LEARNINGS-LOAD.md](../shared/LEARNINGS-LOAD.md)
   for the full parameter/relevance model):

   ```bash
   node ~/.claude/scripts/learnings-search.js "$REPO" load \
     --feature "{slug}" --scopes component --pitfall-prefix true \
     --paths "{located files, comma-separated, repo-relative}"
   ```

   > **Todo**: any non-zero exit (including exit 2, usage error) is a failed step, not a zero-match
   > result — fix the invocation and re-run before proceeding. Only exit 0 with empty stdout is a
   > genuine zero. The count feeds step 5's `Lane:` line below; no separate print here.

4. **Durable-decisions check** — dev-tweak's only route back to a feature's already-settled design
   questions (`durableDecisions[]` has no other reader on the modify path — see
   `shared/FEATURE-LOAD.md`). `.project/` absent (already degraded at PHASE 0 step 1) → skip
   silently, same as the rest of this skill's graceful degradation.

   `.project/` present → grep `.project/features/*/feature.json` and
   `.project/features/archive/*/feature.json` for `files[].path` entries matching any located file
   (repo-relative path match). No match on any feature → skip silently, no cost — most tweaks touch
   files no pipeline feature ever built.

   > **Todo**: a feature matched → project its decisions first (cheap, no Read):
   >
   > ```bash
   > node -e 'const f=require(process.argv[1]);
   >   console.log(JSON.stringify((f.durableDecisions||[]).map(
   >     x=>({decision:x.decision,constraint:x.constraint,chosen:x.chosen}))))' \
   >   <path-to-feature.json>
   > ```
   >
   > Every projected entry has a null/absent `constraint` **and** `chosen` → no recorded constraint
   > can bind this tweak: say so in one clause and continue, no Read. Otherwise → Read
   > `.claude/skills/dev-tweak/references/durable-decisions.md` and follow it (multi-match tiebreak,
   > how the constraints bind PHASE 2).

5. **Lane routing**.

   > **Todo**: judge this table fresh against this run's actual locate/learnings results, never
   > from memory. Evaluate rows in order; the first match picks the lane. Source of truth:
   > [shared/TWEAK-DISCIPLINE.md](../shared/TWEAK-DISCIPLINE.md) § Lane routing — do not renumber
   > locally, same policy as PHASE 0 step 5's inlined size-gate criteria.
   >
   > | #   | Condition                                                                                                                                          | Lane |
   > | --- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
   > | 1   | Stale or obsolete/superseded card, or a docs-only / `.project`-only change (docs-only = no tracked source file is edited; a docstring or comment edit _inside_ a source file is a code change and does not qualify) | A    |
   > | 2   | A verify round in this run failed, **or** a size-gate escalation was consciously overridden (§ Escalation gate c)                                  | C    |
   > | 3   | PHASE 1 locate left ≥2 candidate sites open, or landed on none                                                                                     | B    |
   > | 4   | A learning printed with type `pitfall` carries the `⟨path⟩` marker (its own `paths[]` overlap a located file) — read the marker, never re-classify | B    |
   > | 5   | Otherwise                                                                                                                                          | A    |
   >
   > A lane only ever moves up during a run, and never overrules the size gate. Row 2 fired → Read
   > TWEAK-DISCIPLINE § Lane routing for its hard rules (the second failed round ends the tweak)
   > before designing.
   >
   > Then print one line, always — Lane A included:
   > `Lane: {A|B|C} · Learnings: {n} ({matched pitfall, or "no pitfall on located paths"})`.
   > `{n}` = total lines the load printed across all blocks — a raw count, not a deduped one;
   > nothing downstream depends on the exact number.

## PHASE 2 — Implement

1. **STOP — gate before the first `Edit`**: scroll up and confirm four artifacts exist above this
   point — a printed `Gate:` line (PHASE 1 step 2), a `learnings-search.js` tool result (step 3), a
   `feature.json` grep result or its "no match" (step 4), and a printed `Lane:` line (step 5).
   Judge what the transcript shows, not what you remember doing. Any one absent → go back to that
   step now; do not edit first and reconcile after. All four present → say so in one line
   (`Pre-edit gate: ✓ 4/4`) before the first `Edit` — a gate that leaves no trace cannot be
   distinguished from a gate that was skipped. An escalation firing in PHASE 1 is the one exception:
   the run ends at `references/escalate.md` instead, which prints its own two-line report.
2. **Lane execution** — run the lane PHASE 1 step 5 picked:
   - **A — direct.** No `EnterPlanMode`. Edit straight away.
   - **B — designed.** `EnterPlanMode` (skip if already active) → design → write the decision to the
     plan file → `ExitPlanMode` → implement.
   - **C — B plus a second opinion.** A `Plan` agent (`model: "opus"`) writes the design, then a
     Fable consult on the plan file per
     [shared/SECOND-OPINION.md](../shared/SECOND-OPINION.md), both before `ExitPlanMode`.

   Semantics and the hard rules stay in
   [shared/TWEAK-DISCIPLINE.md](../shared/TWEAK-DISCIPLINE.md) § Lane routing. Four dev-side deltas:
   - **Row 4 (pitfall) triggered the lane** → the plan file's design names the concrete mitigation
     in one line — part of the design, not a separate print.
   - **Lane C** → the Fable digest must be visible **before** `ExitPlanMode`, when the gate is
     presented.
   - Opus/Fable involvement is **not** a size-gate exemption — a wider file span or net-new surface
     found during design still routes to `references/escalate.md`.
   - The harness may open its own plan-mode workflow prescribing Explore/`Plan` agent fan-out on
     `EnterPlanMode`. Ignore it: the file set is already located, a tweak designs inline.
3. **Edit discipline** per [shared/TWEAK-DISCIPLINE.md](../shared/TWEAK-DISCIPLINE.md) § Edit
   discipline — read-before-write, bounded read size, deliberate (not random) test-file pick. A
   located file has a frontend extension (`.tsx`/`.jsx`/`.vue`/`.svelte`/`.css` or equivalent) → load
   the theme digest (same extraction as `/dev-inspect` PHASE 0 step 4 — color tokens, motion,
   `cssVars`; session-memoized) and Read
   [shared/EDIT-DISCIPLINE.md](../shared/EDIT-DISCIPLINE.md), hold the diff against it. No frontend
   file located → skip both, no cost.
4. Bugfix-shaped tweaks follow [shared/DEBUG-LADDER.md](../shared/DEBUG-LADDER.md) tier 1/2:
   hypothesis before edit, evidence before a second attempt — never guess-and-check.
5. **Mid-flight re-check**.

   > **Todo**: the moment actual scope exceeds the size gate (a 4th source file touched, a
   > discovered new surface) → stop now and Read `references/escalate.md` — do not finish the
   > edit first and reconcile after.

## PHASE 3 — Verify light

A tweak that edits **no git-tracked file at all** — only gitignored `.project/` state (e.g.
recording a known issue as a learning) — or a stale or obsolete/superseded card with nothing to
edit (see PHASE 1) — has nothing to verify and nothing to commit: skip PHASE 3 and PHASE 4 step 1,
say so in the report (no `Verdict:`/commit sha lines), and go straight to the card-completion (or
cancellation) + learning writes. A docstring/comment-only edit inside a tracked source file is
still a code change — it runs the normal verify + commit flow below, just with no behavior for a
test to exercise (routes to PHASE 3's Tier 2 modal, not the auto-pass tier). Everything below
assumes a code change.

Scoped to the touched modules — never the full suite unless it is genuinely fast:

- **Tests**: run existing tests covering the touched files. Take the test and lint commands from the
  project's own docs first — `CLAUDE.md § Commands`, `.project/`, or the test harness's own config —
  and only fall back to the web defaults below when the project names none. A non-JS project
  (Python/Go/Rust/C++) will not have the commands in the next two bullets.
- **The documented command is suite-wide** (the common case outside JS: `pytest <dir>`,
  `go test ./...`, `cargo test`) → do **not** run it as written; the project naming it does not
  make it scoped. Derive the scoped form — append the touched test file(s), or a `-k`/pattern
  filter — and run any build/compile step those same docs mandate as its own separate command. Run
  the unscoped command only when a measured run comes back under ~60s; over that, name in the
  report which scoped subset ran instead.
- **The project's docs mandate a post-build step** (deploy, sync an artifact to a runtime data
  directory, restart a service) → it belongs to verify, not to "later": a green test run on a build
  the user's runtime never received is a false pass. Run it. Could not run it → it becomes a PHASE 4
  step 4 `Next steps:` item, phrased as the command the user runs — never a line inside the report
  fence: an unrun step is the user's action, and label-value lines read as archive data they scroll
  past.
- **Web defaults**: `npx vitest related <files>`, or the project's test command with a path/pattern
  filter.
- **Harness failure** (collection/import error, missing interpreter or deps, stale virtualenv) is
  not a baseline regression — repair it when the broken piece is gitignored local state (e.g. a
  stale `.venv`), say so in the report, then re-run. Never edit source to make a broken harness pass.
- **Lint**: on changed files only — Biome (`npx biome check`) when `@biomejs/biome` is in
  package.json; ESLint when configured; skip with one line otherwise. `tsc --noEmit` only when
  configured and cheap.
- **Visual/copy tweaks**: re-check live in the running app (DEBUG-LADDER tier 1) instead of tests.
  Drive the app via the `/run` skill — it owns the per-project launch path (browser dev-server,
  Tauri/Electron desktop shell) so this stays project-agnostic. Capture concrete evidence before
  judging pass: a screenshot, a computed-style/DOM assertion, the changed pixels — never an
  eyeballed "looks right". Can't reach/drive the running app (wrong worktree, no dev server,
  headless environment) → say so explicitly and ask the user to verify visually; never report the
  live check as passed when it wasn't run.

New failures vs the baseline → fix within the current tier's discipline; unfixable within tweak
scope → Read `references/escalate.md`. **Not a failed round**: a test or assertion *this same PHASE 2
pass authored* failing on its own defect (an over-broad matcher, a wrong fixture), corrected without
touching the code under change — that is the test loop working. It becomes a failed round the moment
the correction reaches the source under change. A failed round also feeds
[shared/TWEAK-DISCIPLINE.md](../shared/TWEAK-DISCIPLINE.md) § Lane routing row 2: the **first**
failed round in this run lifts to Lane C for the next PHASE 2 pass (re-score, don't re-derive from
scratch — the lane only ever moves up); a **second** failed round on the same issue routes to
`references/escalate.md` instead of a fourth lane.

**Live verdict.**

> **Todo**: check the auto-pass condition below FIRST, before considering the modal — the modal is
> the fallback, not the default.

**Tier 1 — auto-pass (no modal).** Skip straight to PHASE 4 when **all** of these hold — machine
proof only, never a self-assessment of "this is trivial":

- the checks above actually ran and came back clean, AND
- at least one **test exercises the changed behavior** (lint/typecheck alone doesn't count; a
  change with no covering test doesn't count), AND
- this is **not** a visual/copy tweak (the "visual/copy tweaks" bullet above still applies — a
  live re-check there is human judgment, not machine proof), AND no reachability caveat fired.
  That caveat is **not** visual/copy-only: it fires for any change whose user-visible effect can
  only be confirmed in a running app or runtime this session cannot drive (game engine, trading
  terminal, daemon). Source-level proof that the call site is correct is real evidence, but it is
  not that confirmation — route to Tier 2 and name what the user should look at.

**Only the covering-test bullet failed, and coverage is one mechanical assertion away** — an
existing test file already covers the touched module AND the assertion is mechanical (a value, a
source-level invariant, a rendered string) → add that one case, re-run the checks, and re-evaluate
Tier 1. Size-gate criterion 3 fires on a new test _file_ only, so this stays tweak-sized, and PHASE
4's commit-type list already carries `test` for exactly this. No such file, or the assertion needs a
new harness or fixture (criterion 3 fires) → Tier 2. Bounded on purpose: never invent a test whose
only purpose is to dodge the modal.

Any other one of these failing → Tier 2.

**Tier 2 — ask.** Correctness rests on human judgment → one `AskUserQuestion` before wrap-up, four
options. Use these four verbatim — do not improvise replacements even when a live check was
blocked; a blocked live check maps to `I'll test it myself`. For a visual/copy tweak the live
re-check above runs FIRST and the modal presents its evidence (screenshot / verified value) — so
`Pass` there is an informed confirm-and-commit, never a decision made before the result exists. A
fifth path, `Re-score — design this properly`, is deliberately NOT a modal option (`AskUserQuestion`
caps at 4) — reached only via the built-in **Other** answer; treat that answer exactly as its
bullet below describes:

- `Pass (Recommended)` → the shown result is correct → continue to PHASE 4 and commit.
- `I'll test it myself` → state plainly what to test and what "pass" looks like, then **wait** —
  do not proceed to PHASE 4 until the user replies. "Works" → PHASE 4. "Doesn't hold up" → counts as
  a failed round (§ Lane routing row 2, same first/second-round rule as above) → back to PHASE 2 on
  the same file scope, then re-run PHASE 3.
- `One more small tweak` → back to PHASE 2 for one more iteration on the same file scope, then
  re-run PHASE 3. This doesn't reset the size gate — a new file surfacing on this pass still fires
  `references/escalate.md` exactly like any other mid-flight re-check (PHASE 2 step 5). Not itself a
  failed round (the prior pass may have verified clean) — only an actual PHASE 3 failure counts
  toward § Lane routing row 2.
- `Re-score — design this properly` (Other) → counts as a failed round (§ Lane routing row 2) →
  re-enter PHASE 2 step 2; the lane lifts per that row (first re-score → Lane C, second →
  `references/escalate.md`).
- `Revert — restore to baseline, don't commit` (per
  [shared/TWEAK-DISCIPLINE.md](../shared/TWEAK-DISCIPLINE.md) § Edit discipline) → restore the
  working tree to `pre-tweak-status.txt` (PHASE 0 step 4), commit nothing, skip PHASE 4 step 1
  entirely. Card mode → the card is **not** touched (no `shipped`/`CANCELLED` write — the defect is
  still open, this run just didn't fix it). Report closes with `Verdict: reverted, not committed`
  instead of a commit sha.

## PHASE 4 — Wrap-up

1. **Scoped commit** per [shared/SCOPED-COMMIT.md](../shared/SCOPED-COMMIT.md) — never a bare
   `git add && git commit`. Write the commit message to a scratch file
   under `.project/session/` first, then land with exactly this call — the script accepts no other arguments, and in
   particular there is **no baseline flag**: `pre-tweak-status.txt` is your own reference for
   categorizing files, never something you pass in.

   ```bash
   bash ~/.claude/scripts/scoped-commit.sh \
     --message <path-to-message-file> \
     --files <comma-separated-paths>
   ```

   Deltas vs § 5, one rule per line:

   - Baseline is `pre-tweak-status.txt`; OVERLAP policy is **auto-include** (the fix is the point);
     fallback: ask which files belong to the tweak.
   - **`--files` lists the files THIS run edited** — never the whole baseline diff. A concurrent
     `/dev-tweak` on the same tree makes its own files look NEW against your baseline too (§ 2
     buckets every changed file as NEW / OVERLAP / PRE-EXISTING; NEW cannot tell your file from
     theirs).
   - **Message type is never `feat`** — a tweak adds no net-new capability (size-gate criterion 1).
     Use `{fix|refactor|perf|style|test|docs|chore}({slug}): {summary}`; `test` when the only change
     is added or expanded test coverage, `docs` when it is a docstring/comment/markdown-only edit
     (PHASE 3's comment-only branch).
   - Cleanup: remove the baseline file and the commit-message scratch file.

2. **Card-mode completion** (skip entirely in free-text mode): move the card from
   `.project/backlog.json#features[]` to `.project/archive/backlog-archive.json#archived[]`,
   setting exactly `shipped: true`, `shippedAt` (`YYYY-MM-DD`), `shippedSha` (step 1's commit),
   and `summary` (the tweak's one-line outcome). **Those four and no others** — a `status` flip
   or a `transition` delete is not part of this write. Semantics, the archiving contract, and
   the dashboard rationale live in
   [shared/TWEAK-DISCIPLINE.md](../shared/TWEAK-DISCIPLINE.md) § Card pickup → completion write;
   read it only if the move itself is unclear.

   Then run [shared/BACKLOG.md](../shared/BACKLOG.md) § Archive-move invariant: re-read both
   files and confirm the card is **absent** from `features[]` **and** present in `archived[]`
   with all four fields. A running board app (`serve-backlog.js`) can silently revert an
   external write from its in-memory store — re-apply on a revert. Only once this holds does
   the report carry `Card: {name} → shipped`.

   **Obsolete/superseded card instead** (PHASE 1's confirmed obsolete branch): run that same file's
   § Card pickup **cancellation write** instead — the card stays in `features[]`, no archive move.

3. **Optional learning (0-1)**: only for a bugfix whose root cause has value beyond this spot
   (filter per [shared/LEARNING-WRITE.md](../shared/LEARNING-WRITE.md) § Writer Append Protocol).
   The payload goes in on **stdin** — there are no `--feature`/`--summary` flags:

   ```bash
   node ~/.claude/scripts/learnings-write.js append "$REPO" <<'JSON'
   {"entries":[{"feature":"{slug}","type":"pitfall","source":"extracted",
     "summary":"...","tags":["..."],"paths":["{located file}"]}]}
   JSON
   ```

   `paths` carries the located files — PHASE 1 step 3 loads with `--paths`, so a learning written
   without them is invisible to this skill's own next relevance load. 0-3 tags per
   `LEARNING-WRITE.md § Tag Vocabulary`. A non-zero exit is a failed step, not a zero result — fix
   the payload and re-run (same rule as PHASE 1 step 3). Then run the Consolidation Gate once
   (`LEARNING-WRITE.md § Consolidation Gate`). Skip both silently otherwise. No state auto-push
   (TWEAK-DISCIPLINE § Registration policy).

   **Stale-learning correction** — separate from the 0-1 budget above, and not gated on the bugfix
   filter: PHASE 1 step 3's load surfaced a learning this tweak just made **wrong** (a convention it
   renamed, a limit it lifted, a path it moved) or **superseded** (the workaround it prescribes is no
   longer the best route) → correct that entry in place. Same stdin shape as `append`, with the patch
   fields **flat alongside `match`** — a nested `{"match":…,"patch":{…}}` is silently ignored:

   ```bash
   node ~/.claude/scripts/learnings-write.js enrich "$REPO" <<'JSON'
   {"patches":[{"match":{"feature":"...","type":"pitfall",
     "summaryEquals":"<exact current summary>"},
     "summary":"<corrected summary>"}]}
   JSON
   ```

   **This call fails silently.** Exit 0 with `{"patched":0,"alreadyApplied":1}` on a *first*
   correction means the payload was not understood, not that the work was already done — re-read the
   entry and confirm the summary actually changed before reporting it. Only `patched: 1` is success.
   This repairs existing memory rather than adding to it, so it neither counts
   against the 0-1 budget nor triggers the Consolidation Gate, and it is not a new backlog write.
   Leaving a contradicted learning in place is the drift trap this closes — the next run reads it as
   current and undoes the tweak.

4. **Report** — one fenced block per `shared/OUTPUT.md` § Report Block (≤72 chars, Label-value
   grammar), with any "what changed" prose detail outside the fence.

   > **Todo**: Read `.claude/skills/shared/OUTPUT.md` § Report Block now, before composing the
   > block — 75 lines. Reconstructing the grammar from memory drops the `====` underline and lets
   > explanatory sentences into the fence, the two rules that decide whether the user can scan the
   > result at all.

   Repeat the `Card:`/`Guard:`, `Gate:` and `Lane:` lines here even though they printed mid-run —
   this block is the durable record. Fields:
   - what changed, with `file:line` refs; checks run; commit sha
   - a `Guard:` line reflecting PHASE 0's actual result — never assert "no card overlap" if the
     guard didn't run (say so instead); card mode prints this exact form instead of a `Guard:`
     label: `Card: {name} → shipped`, or `Card: {name} → cancelled (superseded by {card})` for the
     obsolete/superseded outcome
   - a `Verdict:` line — `auto-passed on green checks ({n} tests + lint)` for a Tier 1 auto-pass,
     or `user-confirmed` / `self-tested` for whichever Tier 2 path was taken. Auto-pass is never
     silent — the report always states why the modal didn't fire.
   - a `Lane:` line **always**, Lane A included — `Lane: {A|B|C} · Learnings: {n}` (carry PHASE 1
     step 5's line forward verbatim; B/C append the matching row in one line). This field is the
     proof PHASE 1 step 3's learnings load actually ran — its absence means that step was skipped.
   - a `Consult:` line **only when Lane C actually spawned a consult** — values per
     [shared/SECOND-OPINION.md](../shared/SECOND-OPINION.md) § Logging (`consulted ({trigger})` /
     `consulted ({trigger}) → revised` / `consulted ({trigger}) → confirmed` / `unavailable`). Omit
     entirely on Lane A/B — there is nothing to log.
   - a `Learning:` line when one was written; `Escalation overridden: {criterion}` when applicable
   - a post-fence `Next steps:` numbered block (`shared/SKILL-PATTERNS.md § Next Steps`) when either
     trigger fires; neither fires → a tweak is terminal, no next-step offer:
     1. PHASE 3 could not run a project-mandated post-build step → the command the user must run,
        first in the list. Fires in card mode too, where the tweak is otherwise terminal.
     2. the guard flagged a TODO card (free-text mode only) → `/dev-ship {card}`

     An escalation park (`references/escalate.md § 3 (a)`) prints its own
     `Pick it up with /dev-ship {name}.` line instead of this block.

   > **Todo**: raised a skill-feedback point alongside this report (friction observed during the
   > run, per `~/.claude/CLAUDE.md § Skill Feedback`) → store it now, in one call:
   > `node ~/.claude/scripts/skill-feedback.js add --skill dev-tweak --note "<point>"` (repeat
   > `--note` per point; `--source user` for a point the user raised). The report is not the store —
   > an unstored point is lost, so `/core-audit` never sees its recurrence count. Nothing observed
   > during the run → no call, no ritual closer.
