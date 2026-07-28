---
name: game-tweak
description: Use when a Godot change fits 1-3 files, no pipeline. Use with /game-tweak.
argument-hint: "[change description | POLISH card name]"
reads: [backlog.features, project-context.learnings]
writes: [project-context.learnings, backlog.status, backlog.features]
metadata:
  author: claude-config
  version: 1.6.0
  category: game
---

# Tweak

Fast path for small Godot 4.x changes: a bugfix, a tuning/value adjustment, a small script or scene
edit that fits 1-3 files. Everything heavier belongs to `/game-ship` (or `/game-debug` for hard
bugs) — the gate that decides is [shared/TWEAK-DISCIPLINE.md](../shared/TWEAK-DISCIPLINE.md) (size
gate, backlog guard, registration policy, never-do list). No `TaskCreate` phase tracking — a tweak
run is minutes of work with no compaction risk; ceremony is what this skill exists to avoid. Skill
file stays English; user-facing output follows `CLAUDE.md § User Preferences → Language:`.

Tweak configuration (per shared/TWEAK-DISCIPLINE.md):

- verify: gdlint + scoped GUT tests per PHASE 3 below
- escalation ship target: `/game-ship`
- escalation debug target: `/game-debug` (standalone skill)

## PHASE 0 — Pre-flight, size gate & backlog guard

1. **Repo**: resolve `$REPO` to the main worktree (per `shared/SYNC.md` Worktree-aware Path
   Resolution). `.project/` absent → degrade gracefully: skip the card lookup, guard, and learnings
   silently, keep the rest (the code change is the value; do not scaffold).
2. **Mode + description**: `.project/` present → load once:
   `node ~/.claude/scripts/backlog-load.js "$REPO" guard-items` (the game-pipeline `stage` field
   included; reused by step 6's guard — one load, not two). The invocation argument matches a live
   `POLISH` card — exact name, or an unambiguous ≥2-shared-token match — per
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
   gate on the projected scope (game surface examples: new scene, autoload, signal contract, input
   action). § Backlog guard: **card mode** → skip (the card already names the scope). **Free-text
   mode** → run § Backlog guard as before — the `guard-items` load includes the game-pipeline
   `stage` field — then § Card pickup path 2 (the POLISH-only mini-guard) against the same
   `guard-items` load from step 2.

   > **Todo**: if any gate criterion fires or the guard demands escalation → Read
   > `.claude/skills/game-tweak/references/escalate.md` and follow it — never continue silently.

6. **Slug**: card mode → the card's own kebab `name` (no re-derivation). Free-text mode → derive a
   kebab-case slug from the description (commit scope + learnings feature key). Print the status:
   `Gate: ✓ tweak-sized · Guard: ✓ no card overlap` (or the warn/advisory lines; card mode prints
   `Card: {name}` instead of the guard line).

## PHASE 1 — Locate & context

1. **Locate** the change with minimal reads (Grep → targeted Read; `.tscn` files: read only the
   relevant node sections). The files found here feed the size-gate re-check and the learnings load
   below.

   > **Todo** (card mode): locate shows the described defect is already resolved on `main` — a later
   > commit fixed it, or it never applied → **stale card**. Do not invent a change to justify the
   > card. Skip PHASE 2, PHASE 3, and PHASE 4 step 1 entirely (including step 2's learnings load);
   > go straight to the PHASE 4 card-completion write per
   > [shared/TWEAK-DISCIPLINE.md](../shared/TWEAK-DISCIPLINE.md) § Card pickup → Stale card:
   > `shippedSha` = the resolving commit (`git log -- <file>`), or `HEAD` if none pins it; `summary`
   > names the card stale; commit nothing.

   > **Todo** (card mode): locate/analysis (or an explicit user call mid-run) shows the card's whole
   > reason to exist is **superseded** by a different, wider card — not fixed, just made moot →
   > **obsolete/superseded card**. Confirm with one `AskUserQuestion` naming the superseding card
   > before touching anything. On confirmation: skip PHASE 2, PHASE 3, and PHASE 4 step 1 entirely;
   > go straight to the § Card pickup → Obsolete/superseded card cancellation write. On decline:
   > continue the tweak as originally scoped.

2. **Learnings** — mandatory, not gated on tweak size. Run exactly this, after locate so `--paths`
   carries the real file anchors (see [shared/LEARNINGS-LOAD.md](../shared/LEARNINGS-LOAD.md) for
   the full parameter/relevance model):

   ```bash
   node ~/.claude/scripts/learnings-search.js "$REPO" load \
     --feature "{slug}" --scopes component --pitfall-prefix true \
     --paths "{located files, comma-separated, repo-relative}"
   ```

   Any non-zero exit is a failed step, not a zero-match result — fix the invocation and re-run.
   Only exit 0 with empty stdout is a genuine zero. Include the printed block verbatim when
   non-empty, skip silently otherwise.

## PHASE 2 — Implement

1. **Conditional plan mode** ([shared/PLAN-MODE.md](../shared/PLAN-MODE.md) § Difficulty
   escalation): call `EnterPlanMode` only when the root cause is still unclear after first evidence,
   or the change spans > 2 files. Enter → design → write the decision to the plan file →
   `ExitPlanMode` → execute. Skip entry when plan mode is already active. The typical tweak never
   enters.
2. Bugfix-shaped tweaks follow [shared/DEBUG-LADDER.md](../shared/DEBUG-LADDER.md) tier 1/2:
   hypothesis before edit, evidence before a second attempt — never guess-and-check.
3. **Mid-flight re-check**: the moment actual scope exceeds the size gate (a 4th file, a discovered
   new surface) → stop and Read `references/escalate.md`.

## PHASE 3 — Verify light

A tweak that changes no runnable code — only docs or gitignored `.project/` state (e.g. recording a
known issue as a learning) — or a stale or obsolete/superseded card with nothing to edit (see
PHASE 1) — has nothing to verify and nothing to commit: skip PHASE 3 and PHASE 4 step 1, say so in
the report (no commit sha line), and go straight to the card-completion (or cancellation) + learning
writes. Everything below assumes a code change.

Scoped to the touched scripts/scenes — never the full suite unless it is genuinely fast:

- **Lint**: `gdlint` on changed `.gd` files (gdformat already runs via the format-on-save hook).
- **Tests**: run the GUT test file(s) covering the touched scripts:
  `godot --headless --path . -s addons/gut/gut_cmdln.gd -gtest={test-file} -gexit`
  (resolve the Godot executable per `.claude/paths.local.yaml` → `CLAUDE_GODOT_EXECUTABLE`).
- **No covering test + behavior change**: ask the user for one quick scene-run confirmation instead
  of writing a new test file (a new test file is size-gate criterion 3).

New failures vs the baseline → fix within the current tier's discipline; unfixable within tweak
scope → Read `references/escalate.md`.

## PHASE 4 — Wrap-up

1. **Scoped commit** per [shared/SCOPED-COMMIT.md](../shared/SCOPED-COMMIT.md). Deltas: baseline
   `pre-tweak-status.txt`; OVERLAP policy **auto-include** (the fix is the point); fallback: ask
   which files belong to the tweak; message `{fix|refactor|perf|style|chore}({slug}): {summary}` —
   never `feat` (net-new capability is an escalation criterion by definition); cleanup: remove the
   baseline file.
2. **Card-mode completion** (skip entirely in free-text mode): per
   [shared/TWEAK-DISCIPLINE.md](../shared/TWEAK-DISCIPLINE.md) § Card pickup completion write — flip
   the card `shipped: true` + `shippedAt` + `shippedSha` + `summary` (this tweak's one-line
   outcome), remove a board-set `transition` field if present (it was only ever the board's
   queue-marker, never a lifecycle state — see § Never), and move it from
   `backlog.json#features[]` to `.project/archive/backlog-archive.json#archived[]`. project.json
   persists no features list — the dashboard derives features from backlog + archive. **Then
   re-read `backlog.json` and confirm the card left `features[]` before reporting `shipped`** — a
   running board app (`serve-backlog.js`) re-serializes that file from its own in-memory store and
   can silently revert an external write; on a revert, re-apply and re-verify.

   **Obsolete/superseded card instead** (PHASE 1's confirmed obsolete branch): run the § Card pickup
   → Obsolete/superseded card cancellation write instead — in place within `features[]`, flip
   `status: "CANCELLED"`, add `cancelledReason: "superseded by {card}: {one-line why}"` and
   `cancelledAt`, remove `transition`. The card stays in `features[]` (never moves to the archive —
   that move is shipped-only). Same board-app revert guard: re-read `backlog.json` and confirm
   `status: "CANCELLED"` survived before reporting; re-apply on a revert.

3. **Optional learning (0-1)**: only for a bugfix whose root cause has value beyond this spot
   (filter per [shared/LEARNING-WRITE.md](../shared/LEARNING-WRITE.md) § Writer Append Protocol) —
   append via `learnings-write.js append` with `type: "pitfall"`, `source: "extracted"`, 0-3 tags
   (game vocabulary: `godot`, `gdscript`, `scene`, `game-loop`), then run the Consolidation Gate
   once (`LEARNING-WRITE.md § Consolidation Gate`). Skip both silently otherwise. No state auto-push
   (TWEAK-DISCIPLINE § Registration policy).
4. **Report** (compact prose, no rigid table): what changed with `file:line` refs, checks run,
   commit sha, a `Guard:` line repeating any card overlap (card mode prints `Card: {name} →
shipped`, or `Card: {name} → cancelled (superseded by {card})` for the obsolete/superseded outcome),
   a `Learning:` line when one was written, and `Escalation overridden: {criterion}` when
   applicable. Add `Next steps: /game-ship {card}` only when the guard flagged a TODO card
   (free-text mode only — card mode is already terminal). A tweak is terminal — no next-step offer
   otherwise.
