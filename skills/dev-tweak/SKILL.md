---
name: dev-tweak
description: Use when a change fits 1-3 files, no pipeline needed. Use with /dev-tweak.
argument-hint: "[change description | TWEAK card name]"
reads: [backlog.features, project-context.learnings]
writes: [project-context.learnings, backlog.status, backlog.features]
metadata:
  author: claude-config
  version: 1.2.0
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
3. **Branch guard** per [shared/TWEAK-DISCIPLINE.md](../shared/TWEAK-DISCIPLINE.md) § Branch guard:
   not on the default branch (or detached HEAD) → warn + ask before proceeding.
4. **Baseline** per [shared/SCOPED-COMMIT.md](../shared/SCOPED-COMMIT.md) § 1:
   `git status --porcelain | sort > .project/session/pre-tweak-status.txt` (skip when `.project/` is
   absent).
5. **Gate + guard**: Read [shared/TWEAK-DISCIPLINE.md](../shared/TWEAK-DISCIPLINE.md); run § Size
   gate on the projected scope. § Backlog guard: **card mode** → skip (the card already names the
   scope — a fresh dedup would just rediscover itself). **Free-text mode** → run § Backlog guard as
   before, then § Card pickup path 2 (the TWEAK-only mini-guard) against the same `guard-items` load
   from step 2.

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

**Live verdict** — once the checks above are clean (or the user has visually re-checked a
visual/copy tweak), one `AskUserQuestion` before wrap-up:

- `Pass (Recommended)` → continue to PHASE 4.
- `One more small tweak` → back to PHASE 2 for one more iteration on the same file scope, then
  re-run PHASE 3. This doesn't reset the size gate — a new file surfacing on this pass still fires
  `references/escalate.md` exactly like any other mid-flight re-check (PHASE 2 step 3).
- `Escalate — design this properly with Opus` → the fix needs real design thinking, not another
  quick edit. `EnterPlanMode` (skip if already active). Launch a `Plan` agent with `model: "opus"`,
  briefed with the tweak description, the files touched so far, and what didn't verify cleanly —
  request a concrete implementation plan. Write the returned plan into the plan file for review,
  then the normal `ExitPlanMode` gate. On accept, resume PHASE 2 executing the approved design under
  the same file-scope discipline — a design that turns out to need net-new surface or a wider file
  span still routes to `references/escalate.md`; Opus involvement is not an exemption from the size
  gate.

## PHASE 4 — Wrap-up

1. **Scoped commit** per [shared/SCOPED-COMMIT.md](../shared/SCOPED-COMMIT.md). Deltas: baseline
   `pre-tweak-status.txt`; OVERLAP policy **auto-include** (the fix is the point); fallback: ask
   which files belong to the tweak; message `{fix|refactor|perf|style|chore}({slug}): {summary}` —
   never `feat` (net-new capability is an escalation criterion by definition); cleanup: remove the
   baseline file.
2. **Card-mode completion** (skip entirely in free-text mode): per
   [shared/TWEAK-DISCIPLINE.md](../shared/TWEAK-DISCIPLINE.md) § Card pickup completion write — flip
   the card `shipped: true` + `shippedAt` + `shippedSha` + `summary` (this tweak's one-line
   outcome), move it from `backlog.json#features[]` to
   `.project/archive/backlog-archive.json#archived[]`, dual-write `project.json#features[]` to
   match.
3. **Optional learning (0-1)**: only for a bugfix whose root cause has value beyond this spot
   (filter per [shared/LEARNING-WRITE.md](../shared/LEARNING-WRITE.md) § Writer Append Protocol) —
   append via `learnings-write.js append` with `type: "pitfall"`, `source: "extracted"`, 0-3 tags,
   then run the Consolidation Gate once (`LEARNING-WRITE.md § Consolidation Gate`). Skip both
   silently otherwise. No state auto-push (TWEAK-DISCIPLINE § Registration policy).
4. **Report** (compact prose, no rigid table): what changed with `file:line` refs, checks run,
   commit sha, a `Guard:` line reflecting PHASE 0's actual result (never assert "no card overlap"
   if the guard didn't run — say so instead; card mode prints `Card: {name} → shipped` instead), a
   `Learning:` line when one was written, and `Escalation overridden: {criterion}` when applicable.
   Add `Next steps: /dev-ship {card}` only when the guard flagged a TODO card (free-text mode only —
   card mode is already terminal). A tweak is terminal — no next-step offer otherwise.
