---
name: dev-tweak
description: Use when a change fits 1-3 files, no pipeline needed. Use with /dev-tweak.
argument-hint: "[change description | TWEAK card name]"
reads: [backlog.features, project-context.learnings]
writes: [project-context.learnings, backlog.status, backlog.features]
metadata:
  author: claude-config
  version: 1.5.0
  category: dev
---

# Tweak

Fast path for small web-stack changes: a bugfix, copy/styling adjustment, config change, or small
refactor that fits 1-3 files. Everything heavier belongs to `/dev-ship` — the gate that decides is
[shared/TWEAK-DISCIPLINE.md](../shared/TWEAK-DISCIPLINE.md) (size gate, backlog guard, registration
policy, never-do list). No `TaskCreate` phase tracking — a tweak run is minutes of work with no
compaction risk; ceremony is what this skill exists to avoid. Skill file stays English; user-facing
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

1. **Repo**: resolve `$REPO` to the main worktree (per `shared/SYNC.md` Worktree-aware Path
   Resolution). `.project/` absent → degrade gracefully: skip the card lookup, guard, and learnings
   silently, keep the rest (the code change is the value; do not scaffold).
2. **Mode + description**: `.project/` present → load once:
   `node ~/.claude/scripts/backlog-load.js "$REPO" guard-items` (reused by step 6's guard — one
   load, not two). The invocation argument matches a live `TWEAK` card — exact name, or an
   unambiguous ≥2-shared-token match — per
   [shared/TWEAK-DISCIPLINE.md](../shared/TWEAK-DISCIPLINE.md) § Card pickup path 1?
   - **Match → card mode.** Description = the card's `description`. Run the dependency check now
     (one `AskUserQuestion` only if the card has an open, unshipped dependency).
   - **No match, or `.project/` absent → free-text mode.** Description from the invocation argument;
     if empty, ask one short question.
3. **Branch guard**.

   > **Todo**: run [shared/TWEAK-DISCIPLINE.md](../shared/TWEAK-DISCIPLINE.md) § Branch guard's
   > actual check now — `git symbolic-ref --short refs/remotes/origin/HEAD` (or the `main`/`master`
   > fallback) vs `git branch --show-current`. On the default branch → continue silently. Any other
   > branch or detached HEAD → warn + ask before proceeding.

4. **Baseline** — mandatory precondition for PHASE 4 and for a later escalate.md "override" choice,
   not optional ceremony.

   > **Todo**: run now, before step 5's gate check: `git status --porcelain | sort >
.project/session/pre-tweak-status.txt` per [shared/SCOPED-COMMIT.md](../shared/SCOPED-COMMIT.md)
   > § 1 (skip only when `.project/` is absent). Runs even when the gate is about to escalate — the
   > file is cheap and unblocks a later "Continue as tweak" override without re-deriving state.

5. **Gate + guard**.

   > **Todo**: Read [shared/TWEAK-DISCIPLINE.md](../shared/TWEAK-DISCIPLINE.md) § Size gate now —
   > do not judge scope from memory or from this file's own intro framing. Apply its
   > criteria table to the projected scope.

   § Backlog guard: **card mode** → skip (the card already names the scope — a fresh dedup would
   just rediscover itself). **Free-text mode** → run § Backlog guard as before, then § Card pickup
   path 2 (the TWEAK-only mini-guard) against the same `guard-items` load from step 2.

   > **Todo**: if any gate criterion fires or a guard demands escalation → Read
   > `.claude/skills/dev-tweak/references/escalate.md` and follow it — never continue silently.

6. **Slug**: card mode → the card's own kebab `name` (no re-derivation). Free-text mode → derive a
   kebab-case slug from the description (commit scope + learnings feature key). Print the status:
   `Gate: ✓ tweak-sized · Guard: ✓ no card overlap` (or the warn/advisory lines; card mode prints
   `Card: {name}` instead of the guard line).

## PHASE 1 — Locate & context

1. **Locate** the change with minimal reads (Grep → targeted Read). The files found here feed the
   size-gate re-check and the learnings load below.
2. **Learnings** — run this now, after locating (so the query carries the real file anchors instead
   of only the description-derived slug); only the printed output is conditional on being non-empty,
   not the load itself. Load via
   [shared/LEARNINGS-LOAD.md](../shared/LEARNINGS-LOAD.md):

   - scopes: [component]
   - pitfall-prefix: true
   - current-feature: {slug}
   - paths: {located files, comma-separated, repo-relative}

   One `learnings-search.js load` call; include the printed block verbatim when non-empty, skip
   silently otherwise.

## PHASE 2 — Implement

1. **Conditional plan mode** ([shared/PLAN-MODE.md](../shared/PLAN-MODE.md) § Difficulty
   escalation): call `EnterPlanMode` only when the root cause is still unclear after first evidence,
   or the change spans > 2 files. Enter → design → write the decision to the plan file →
   `ExitPlanMode` → execute. Skip entry when plan mode is already active. The typical tweak never
   enters.
2. Bugfix-shaped tweaks follow [shared/DEBUG-LADDER.md](../shared/DEBUG-LADDER.md) tier 1/2:
   hypothesis before edit, evidence before a second attempt — never guess-and-check.
3. **Mid-flight re-check**.

   > **Todo**: the moment actual scope exceeds the size gate (a 4th source file touched, a
   > discovered new surface) → stop now and Read `references/escalate.md` — do not finish the
   > edit first and reconcile after.

## PHASE 3 — Verify light

A tweak that changes no runnable code — only docs or gitignored `.project/` state (e.g. recording a
known issue as a learning) — has nothing to verify and nothing to commit: skip PHASE 3 and PHASE 4
step 1, say so in the report (no `Verdict:`/commit sha lines), and go straight to the
card-completion + learning writes. Everything below assumes a code change.

Scoped to the touched modules — never the full suite unless it is genuinely fast:

- **Tests**: run existing tests covering the touched files (e.g. `npx vitest related <files>` or the
  project's test command with a path/pattern filter).
- **Lint**: on changed files only — Biome (`npx biome check`) when `@biomejs/biome` is in
  package.json; ESLint when configured; skip with one line otherwise. `tsc --noEmit` only when
  configured and cheap.
- **Visual/copy tweaks**: re-check live in the running app (DEBUG-LADDER tier 1) instead of tests.
  Can't reach/drive the running app (wrong worktree, no dev server, headless environment) → say so
  explicitly and ask the user to verify visually; never report the live check as passed when it
  wasn't run.

New failures vs the baseline → fix within the current tier's discipline; unfixable within tweak
scope → Read `references/escalate.md`.

**Live verdict.**

> **Todo**: check the auto-pass condition below FIRST, before considering the modal — the modal is
> the fallback, not the default.

**Tier 1 — auto-pass (no modal).** Skip straight to PHASE 4 when **all** of these hold — machine
proof only, never a self-assessment of "this is trivial":

- the checks above actually ran and came back clean, AND
- at least one **test exercises the changed behavior** (lint/typecheck alone doesn't count; a
  change with no covering test doesn't count), AND
- this is **not** a visual/copy tweak (the "visual/copy tweaks" bullet above still applies — a
  live re-check there is human judgment, not machine proof), AND no reachability caveat fired (the
  "can't reach/drive the running app" bullet above).

Any one of these failing → Tier 2.

**Tier 2 — ask.** Correctness rests on human judgment → one `AskUserQuestion` before wrap-up, four
options:

- `Pass (Recommended)` → continue to PHASE 4.
- `I'll test it myself` → state plainly what to test and what "pass" looks like, then **wait** —
  do not proceed to PHASE 4 until the user replies. "Works" → PHASE 4. "Doesn't hold up" → back to
  PHASE 2 on the same file scope, then re-run PHASE 3.
- `One more small tweak` → back to PHASE 2 for one more iteration on the same file scope, then
  re-run PHASE 3. This doesn't reset the size gate — a new file surfacing on this pass still fires
  `references/escalate.md` exactly like any other mid-flight re-check (PHASE 2 step 3).
- `Escalate — design this properly with Opus` → `EnterPlanMode` (skip if already active), launch a
  `Plan` agent with `model: "opus"` briefed on the tweak description + files touched + what didn't
  verify cleanly, write its plan to the plan file, then the normal `ExitPlanMode` gate. On accept,
  resume PHASE 2 under the same file-scope discipline — a design needing net-new surface or a wider
  file span still routes to `references/escalate.md`; Opus involvement is not a size-gate exemption.

## PHASE 4 — Wrap-up

1. **Scoped commit** per [shared/SCOPED-COMMIT.md](../shared/SCOPED-COMMIT.md). Deltas: baseline
   `pre-tweak-status.txt`; OVERLAP policy **auto-include** (the fix is the point); fallback: ask
   which files belong to the tweak; message `{fix|refactor|perf|style|chore}({slug}): {summary}` —
   never `feat` (net-new capability is an escalation criterion by definition); cleanup: remove the
   baseline file.
2. **Card-mode completion** (skip entirely in free-text mode): per
   [shared/TWEAK-DISCIPLINE.md](../shared/TWEAK-DISCIPLINE.md) § Card pickup completion write — flip
   the card `shipped: true` + `shippedAt` + `shippedSha` + `summary` (this tweak's one-line
   outcome) and move it from `backlog.json#features[]` to
   `.project/archive/backlog-archive.json#archived[]`. project.json persists no features list — the
   dashboard derives features from backlog + archive. **Then re-read `backlog.json` and confirm the
   card left `features[]` before reporting `shipped`** — a running board app (`serve-backlog.js`)
   re-serializes that file from its own in-memory store and can silently revert an external write;
   on a revert, re-apply and re-verify.
3. **Optional learning (0-1)**: only for a bugfix whose root cause has value beyond this spot
   (filter per [shared/LEARNING-WRITE.md](../shared/LEARNING-WRITE.md) § Writer Append Protocol) —
   append via `learnings-write.js append` with `type: "pitfall"`, `source: "extracted"`, 0-3 tags,
   then run the Consolidation Gate once (`LEARNING-WRITE.md § Consolidation Gate`). Skip both
   silently otherwise. No state auto-push (TWEAK-DISCIPLINE § Registration policy).
4. **Report** — compact prose, no rigid table. Include:
   - what changed, with `file:line` refs; checks run; commit sha
   - a `Guard:` line reflecting PHASE 0's actual result — never assert "no card overlap" if the
     guard didn't run (say so instead); card mode prints `Card: {name} → shipped`
   - a `Verdict:` line — `auto-passed on green checks ({n} tests + lint)` for a Tier 1 auto-pass,
     or `user-confirmed` / `self-tested` for whichever Tier 2 path was taken. Auto-pass is never
     silent — the report always states why the modal didn't fire.
   - a `Learning:` line when one was written; `Escalation overridden: {criterion}` when applicable
   - `Next steps: /dev-ship {card}` **only** when the guard flagged a TODO card (free-text mode
     only — card mode is terminal). Otherwise a tweak is terminal: no next-step offer.
