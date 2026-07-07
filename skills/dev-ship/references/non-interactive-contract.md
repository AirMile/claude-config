# Subagent adapter (dev-ship non-interactive contract)

Every agent dev-ship spawns runs a **copied top-level dev workflow**
(`dev-ship/references/dev-{build,verify,refactor,define}/workflow.md`) as a **non-interactive
dev-ship subagent**. This adapter is inlined into each agent prompt and **blanket-overrides** the
workflow's top-level-skill machinery. **When a workflow instruction conflicts with this adapter, the
adapter wins** — the workflow was written to be run standalone; you are not running it standalone.

## Blanket overrides (apply throughout the entire workflow)

1. **Phase tracking** — do **not** call `TaskCreate`/`TaskUpdate`. dev-ship owns phase tracking.
   Follow the workflow's phases in order and track progress in prose. Ignore every "call TaskCreate"
   / "mark PHASE X → …" instruction and every phase-seed block. The checkpoint is written only by the
   main chat — worker agents never touch it.
2. **Plan mode** — **never** call `EnterPlanMode`/`ExitPlanMode`. You are already a subagent; run all
   analytical/design phases directly. Ignore "plan mode must be active before …" constraints. (This is
   subagent-scoped. The one plan-mode surface in the whole pipeline is the main-chat PHASE 0 Step 4b
   plan-approval gate — the orchestrator owns it; no spawned agent ever runs it.)
3. **No user interaction** — **never** call `AskUserQuestion`. Wherever the workflow would ask,
   choose the **first / `(Recommended)`** option (repo convention lists it first) and record the
   choice in `autoDecisions[]` (returned in your result block). Only if a decision is genuinely
   unresolvable without the user (e.g. ambiguous requirements that would corrupt the build) → stop
   and return `status: failed` with the open question.
4. **No terminal handoff** — skip every Next-Step Clipboard Offer (`NEXT-STEP-OFFER.md`), clipboard
   copy, and `Next: /dev-X` / "Recommended command" output. dev-ship drives sequencing.
5. **Context READ** — `SHIP_CONTEXT` is provided in your prompt. **Skip** the workflow's own PHASE 0
   context-load steps that it covers: `PROJECT-CONTEXT-LOAD`, `LEARNINGS-LOAD`, `BACKLOG-LOAD`,
   `FEATURE-LOAD`, `stack-baseline` reads. Use `SHIP_CONTEXT`. Only read `feature.json` fields your
   slice does not already contain.
6. **Context-gathering sub-agents** — skip the workflow's context-only agent spawns where
   `SHIP_CONTEXT` covers them (dev-verify PHASE 0 Explore for context synthesis; dev-define
   `context-aggregator`). Keep the task-specific analysis such a spawn also does (e.g. verify's
   `httpContractTested` / `acceptanceTests` probing) — run it inline if you cannot spawn (rule 9).
7. **Worktree — role-bound.** Build-agent: create the worktree, commit, **never merge**.
   Verify/refactor-agent: use the existing worktree; **never** finalize/merge/`ExitWorktree`/
   `git worktree remove`. The main chat owns finalize (PHASE 4, after refactor). Ignore the
   workflow's Finalize / `FINALIZE.md` / `ExitWorktree` phase entirely.
8. **No browser side-effects** — skip HTML-preview generation + `HTML-PRESENT.md` (dev-define visual
   preview). No browser in a subagent.
9. **Nested analysis agents** — spawning your own analysis sub-agents (dev-refactor lens agents;
   verify probes) is allowed and expected. **If you cannot spawn sub-agents in this environment, run
   the same analysis INLINE** (read the files, apply the lens/probe yourself) — never skip the
   analysis, only change how it runs.
10. **Background processes** — if you launch a dev server (`run_in_background`), store its PID and
    **kill it before returning**. Never leak background processes.
11. **TEAM_MODE / `gh` dispatch** — you never reach it (verify-agent skips finalize). Ignore
    `finalize.md`'s PR-state dispatch.
12. **ToolSearch** — only load the deferred tools you actually use. Do **not** load
    `TaskCreate`/`TaskUpdate` (rule 1) or `EnterPlanMode` (rule 2).
13. **Memory WRITE** — **do** keep your workflow's domain `.project/` writes: `build.decisions` →
    learnings, verify `fixSync`/observations → learnings, refactor decisions → learnings, plus
    `feature.json`, `backlog` status (build/refactor only — the verify agent leaves status `DOING`
    per its scope limits; the DONE flip is the main chat's PHASE 3), and architecture/context via
    `SYNC.md`. Those are your single-writer duty. Do **not** add ship-level learnings — the main chat does that in PHASE 5.

## Git boundary (recap of rule 7)

The only git integration is the main chat's PHASE 4 finalize (after refactor). Build commits in the
worktree; verify commits fixes
in the worktree; refactor commits in the worktree on the feature branch (pre-merge). No agent runs
`git merge`, `git branch -d/-D`, `git worktree remove`, or switches to `main`.

## On failure

Do not merge, leave the worktree intact, return `status: failed` with the stop point. The main chat
reports it and suggests `/dev-debug {feature}`.

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
itself), PHASE 3's manual round, and the inline fallback when the Workflow tool is unavailable.

- **Workflow path (primary)**: the workflow's return value carries each agent's schema-validated
  result object — read fields directly, nothing to parse. **Agent-tool fallback**: parse the block
  robustly: `sed -n '/SHIP_X_RESULT_START/,/SHIP_X_RESULT_END/p'`; on truncation `Grep` the
  agent's output file for the markers and `Read` with an offset.
- **Re-read `.project/` from disk after every agent/workflow return** — the pre-spawn snapshot is
  stale.
- **Sequencing**: build → verify → (main-chat manual+finalize) → refactor run sequentially (one
  `.project/` writer at a time — the workflow scripts enforce this ordering). Only AGENT S
  (security, read-only, no `.project/` writes) runs concurrently with AGENT 3.
