---
name: game-tweak
description: Use when a Godot change fits 1-3 files, no pipeline. Use with /game-tweak.
argument-hint: "[change description]"
reads: [backlog.features, project-context.learnings]
writes: [project-context.learnings]
metadata:
  author: claude-config
  version: 1.0.0
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

1. **Description** from the invocation argument; if empty, ask one short question.
2. **Repo**: resolve `$REPO` to the main worktree (per `shared/SYNC.md` Worktree-aware Path
   Resolution). `.project/` absent → degrade gracefully: skip the guard and learnings silently, keep
   the rest (the code change is the value; do not scaffold).
3. **Branch guard** per [shared/TWEAK-DISCIPLINE.md](../shared/TWEAK-DISCIPLINE.md) § Branch guard:
   not on the default branch (or detached HEAD) → warn + ask before proceeding.
4. **Baseline** per [shared/SCOPED-COMMIT.md](../shared/SCOPED-COMMIT.md) § 1:
   `git status --porcelain | sort > .project/session/pre-tweak-status.txt` (skip when `.project/` is
   absent).
5. **Gate + guard**: Read [shared/TWEAK-DISCIPLINE.md](../shared/TWEAK-DISCIPLINE.md); run § Size
   gate on the projected scope (game surface examples: new scene, autoload, signal contract, input
   action) and § Backlog guard — the `guard-items` load includes the game-pipeline `stage` field.

   > **Todo**: if any gate criterion fires or the guard demands escalation → Read
   > `.claude/skills/game-tweak/references/escalate.md` and follow it — never continue silently.

6. **Slug**: derive a kebab-case slug from the description (commit scope + learnings feature key).
   Print the status: `Gate: ✓ tweak-sized · Guard: ✓ no card overlap` (or the warn/advisory lines).

## PHASE 1 — Locate & context

1. **Locate** the change with minimal reads (Grep → targeted Read; `.tscn` files: read only the
   relevant node sections). The files found here feed the size-gate re-check and the learnings load
   below.
2. **Learnings** — loaded _after_ locating, so the query carries the real file anchors instead of
   only the description-derived slug. Load via
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
3. **Mid-flight re-check**: the moment actual scope exceeds the size gate (a 4th file, a discovered
   new surface) → stop and Read `references/escalate.md`.

## PHASE 3 — Verify light

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
2. **Optional learning (0-1)**: only for a bugfix whose root cause has value beyond this spot
   (filter per [shared/LEARNING-WRITE.md](../shared/LEARNING-WRITE.md) § Writer Append Protocol) —
   append via `learnings-write.js append` with `type: "pitfall"`, `source: "extracted"`, 0-3 tags
   (game vocabulary: `godot`, `gdscript`, `scene`, `game-loop`), then run the Consolidation Gate
   once (`LEARNING-WRITE.md § Consolidation Gate`). Skip both silently otherwise. No state auto-push
   (TWEAK-DISCIPLINE § Registration policy).
3. **Report** (compact prose, no rigid table): what changed with `file:line` refs, checks run,
   commit sha, a `Guard:` line repeating any card overlap, a `Learning:` line when one was written,
   and `Escalation overridden: {criterion}` when applicable. Add `Next steps: /game-ship {card}`
   only when the guard flagged a TODO card. A tweak is terminal — no next-step offer otherwise.
