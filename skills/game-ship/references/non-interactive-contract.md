# Subagent adapter (game-ship non-interactive contract)

Every agent game-ship spawns runs a **vendored top-level game workflow**
(`game-ship/references/game-{build,verify,refactor,define}/SKILL.md`) as a **non-interactive
game-ship subagent**. This adapter is inlined into each agent prompt and **blanket-overrides** the
workflow's top-level-skill machinery. **When a workflow instruction conflicts with this adapter, the
adapter wins** — each vendored `SKILL.md` was written to be run standalone; you are not running it
standalone.

## Blanket overrides (apply throughout the entire vendored SKILL.md)

1. **Phase tracking** — do **not** call `TaskCreate`/`TaskUpdate`. game-ship owns phase tracking.
   Follow the workflow's phases in order and track progress in prose. Ignore every "call TaskCreate"
   / "mark PHASE X → …" instruction and every phase-seed block. The checkpoint is written only by the
   main chat — worker agents never touch it.
2. **Plan mode** — **never** call `EnterPlanMode`/`ExitPlanMode`. You are already a subagent; run all
   analytical/design phases directly. Ignore "plan mode must be active before …" constraints and
   every "Enter Plan Mode NOW" / "write to the plan file" step (author the design in-context instead).
   (This is subagent-scoped. The main chat owns every plan-mode surface in the pipeline — no spawned
   agent ever runs one.)
3. **No user interaction** — **never** call `AskUserQuestion`. Wherever the workflow would ask,
   choose the **first / `(Recommended)`** option (repo convention lists it first) and record the
   choice in `autoDecisions[]` (returned in your result block). Only if a decision is genuinely
   unresolvable without the user (e.g. ambiguous requirements that would corrupt the build) → stop
   and return `status: failed` with the open question. In particular the build's PHASE 4 "What Did We
   Build?" comprehension check and the verify fix-loop's SUBJECTIVE clarifications are auto-resolved
   (record what you assumed).
4. **No terminal handoff** — skip every Next-Step Clipboard Offer (`NEXT-STEP-OFFER.md`), clipboard
   copy, and `Next: /game-X` / "Recommended command" output. game-ship drives sequencing.
5. **Context READ** — `SHIP_CONTEXT` is provided in your prompt. **Skip** the workflow's own PHASE 0
   context-load steps that it covers: `GAME-CONTEXT-LOAD`, `LEARNINGS-LOAD`, `GAME-BACKLOG-LOAD`,
   `GAME-FEATURE-LOAD`, architecture-baseline reads. Use `SHIP_CONTEXT`. Only read `feature.json`
   fields your slice does not already contain. `{godot_executable}` is provided in your slice — use
   it verbatim for every GUT command; do not re-resolve `paths.yaml`.
6. **Context-gathering sub-agents** — skip the workflow's context-only agent spawns where
   `SHIP_CONTEXT` covers them (game-define `context-aggregator`; game-refactor Explore context
   synthesis). Keep the task-specific analysis such a spawn also does (e.g. verify's classification /
   coverage probing, refactor's per-feature anti-pattern scan) — run it inline if you cannot spawn
   (rule 9).
7. **Worktree — role-bound.** Build-agent: create the worktree (`shared/WORKTREE-CREATE.md → Auto-create`),
   commit, **never merge**. Verify/refactor-agent: use the existing worktree; **never**
   finalize/merge/`ExitWorktree`/`git worktree remove`. The main chat owns finalize (PHASE 4, after
   refactor). Ignore the workflow's PHASE Finalize / `FINALIZE.md` / `completion-finalize.md` merge
   phase entirely.
8. **No game-window launch in a subagent** — **never** call `mcp__godot-mcp__run_project` (or any
   MCP call that opens an interactive game window / `get_debug_output` on a live window). A subagent
   has **no display**. Build and GUT auto-verify run **headless only**
   (`"{godot_executable}" --headless --path . -s addons/gut/gut_cmdln.gd -gexit`). The verify agent
   does **not** run the playtest (`game-verify` PHASE 0 step 7 launch, PHASE 3 MEASURABLE re-launch) —
   it collects the MANUAL items and returns them for the main chat's PHASE 3. Also skip any
   HTML-preview / `HTML-PRESENT.md` step.
9. **Nested analysis agents** — spawning your own analysis sub-agents (game-refactor Explore agents;
   verify probes) is allowed and expected. **If you cannot spawn sub-agents in this environment, run
   the same analysis INLINE** (read the files, apply the scan/probe yourself) — never skip the
   analysis, only change how it runs.
10. **Background processes** — if you launch anything with `run_in_background`, store its PID and
    **kill it before returning**. Never leak background processes.
11. **TEAM_MODE / `gh` dispatch** — you never reach it (verify-agent skips finalize). Ignore
    `completion-finalize.md`'s PR-state dispatch table.
12. **ToolSearch** — only load the deferred tools you actually use. Do **not** load
    `TaskCreate`/`TaskUpdate` (rule 1) or `EnterPlanMode` (rule 2). Do **not** load
    `mcp__godot-mcp__run_project` (rule 8).
13. **Memory WRITE** — **do** keep your workflow's domain `.project/` writes: game-build is the
    single writer for `build.decisions[]` → learnings; game-verify writes `tests.qualityVerdict`,
    `fixSync`/observations → learnings; game-refactor writes its refactor decisions → learnings; plus
    `feature.json`, `backlog` status + **stage** (build/refactor only — the verify agent leaves
    status `DOING` / stage `built` per its scope limits; the DONE flip + stage `done` is the main
    chat's PHASE 3), and architecture/context via `SYNC.md`. Those are your single-writer duty. Do
    **not** add ship-level learnings — the main chat does that in PHASE 5.

## Git boundary (recap of rule 7)

The only git integration is the main chat's PHASE 4 finalize (after refactor). Build commits in the
worktree; verify commits fixes in the worktree; refactor commits in the worktree on the feature
branch (pre-merge). No agent runs
`git merge`, `git branch -d/-D`, `git worktree remove`, or switches to `main`.

## On failure

Do not merge, leave the worktree intact, return `status: failed` with the stop point. The main chat
reports it and suggests `/game-debug {feature}`.

## RESULT CONTRACT

**Primary (Workflow path)**: you have been given a structured-output tool whose schema matches
your agent reference's result fields — your **final answer is that tool call**. Do not also print
a delimited result block.

**Fallback (Agent-tool path, no structured-output tool)**: return **exactly one** delimited block
(schema per agent reference): `SHIP_BUILD_RESULT` / `SHIP_VERIFY_RESULT` / `SHIP_REFACTOR_RESULT`,
each `_START` … `_END`. Keep prose minimal — the block IS the return value.

In both cases: always include `autoDecisions[]` (rule 3).

## Main-chat side

The main chat holds the orchestration role throughout: PHASE 1–4 (launching the Workflow tool
itself), PHASE 3's playtest round, and the inline fallback when the Workflow tool is unavailable.

- **Workflow path (primary)**: the workflow's return value carries each agent's schema-validated
  result object — read fields directly, nothing to parse. **Agent-tool fallback**: parse the block
  robustly: `sed -n '/SHIP_X_RESULT_START/,/SHIP_X_RESULT_END/p'`; on truncation `Grep` the
  agent's output file for the markers and `Read` with an offset.
- **Re-read `.project/` from disk after every agent/workflow return** — the pre-spawn snapshot is
  stale.
- **Sequencing**: build → verify → (main-chat playtest+finalize) → refactor run sequentially (one
  `.project/` writer at a time — the workflow scripts enforce this ordering).
