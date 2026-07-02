# Subagent adapter (design-ship non-interactive contract)

Every agent design-ship spawns runs a **copied design workflow**
(`design-ship/references/design-create/route-build.md`, `design-content/workflow.md`,
`design-check/workflow.md`) as a **non-interactive design-ship subagent**. This adapter is inlined
into each agent prompt and **blanket-overrides** the workflow's top-level-skill machinery. **When a
workflow instruction conflicts with this adapter, the adapter wins** — the workflow was written to
be run standalone; you are not running it standalone.

## Blanket overrides (apply throughout the entire workflow)

1. **Phase tracking** — do **not** call `TaskCreate`/`TaskUpdate`. design-ship owns phase tracking.
   Follow the workflow's phases/steps in order and track progress in prose. Ignore every "call
   TaskCreate" / "mark PHASE X → …" instruction and every phase-seed block.
2. **Plan mode** — **never** call `EnterPlanMode`/`ExitPlanMode`. You are already a subagent; run
   all analytical/design steps directly. Ignore "plan mode must be active before …" constraints.
3. **No user interaction** — **never** call `AskUserQuestion`. Wherever the workflow would ask,
   choose the **first / `(Recommended)`** option (repo convention lists it first) and record the
   choice in `autoDecisions[]` (returned in your result). Only if a decision is genuinely
   unresolvable without the user (e.g. an empty spec that would make codegen guesswork) → stop and
   return `status: failed` with the open question.
4. **No terminal handoff** — skip every Next-Step Clipboard Offer (`NEXT-STEP-OFFER.md`), clipboard
   copy, and `Next: /design-X` / "Recommended command" output. design-ship drives sequencing.
5. **Context READ** — `SHIP_CONTEXT` is provided in your prompt (seed, theme levers, spec, chosen
   design direction, content brief, glossary, entities). **Skip** the workflow's own context-load
   steps that it covers (`SEED.md` reader, design-lever pre-flight, `PROJECT-CONTEXT-LOAD`,
   archetype/brief derivation). Only read from disk what your slice does not already contain.
6. **Worktree — role-bound.** Build-agent: create the worktree (route-build Step 7b), commit,
   **never merge**. Content/check-agent: `cd` into the existing worktree (path in your prompt) and
   work on that branch; **never** finalize/merge/`ExitWorktree`/`git worktree remove`, never create
   a nested worktree. The main chat owns finalize (design-ship PHASE 4). Ignore every Finalize /
   `FINALIZE.md` / Step 12 / PHASE 5-finalize instruction.
7. **`.project/` resolves to the main repo** — the worktree checkout has no `.project/` (it is
   gitignored). Read/write `.project/…` via the main repo path (in your prompt), never commit it.
8. **No browser side-effects** — skip HTML-preview generation + `HTML-PRESENT.md` and never `open`
   a URL in the user's browser. Headless Playwright for smoke checks and runtime audits is fine —
   that is tooling, not presentation.
9. **Nested analysis agents** — spawning your own analysis sub-agents is allowed and expected
   where the workflow says so. **If you cannot spawn sub-agents in this environment, run the same
   analysis INLINE** — never skip the analysis, only change how it runs.
10. **Background processes** — if you launch a dev server (`run_in_background`), store its PID and
    **kill it before returning**. Never leak background processes.
11. **ToolSearch** — only load the deferred tools you actually use. Do **not** load
    `TaskCreate`/`TaskUpdate` (rule 1) or `EnterPlanMode` (rule 2).
12. **Board live signal** — first action after reading your workflow: write
    `.project/session/active-{feature}.json` (main repo) with your phase verb —
    `{"feature":"{feature}","skill":"{build|content|check}","startedAt":"{ISO}"}` — so the backlog
    board badge follows the pipeline. Do **not** remove it on exit; design-ship owns cleanup.
13. **Memory WRITE** — **do** keep your workflow's domain `.project/` writes: block inventory +
    `design.*` sync + tokenDrift cleanup (build), backlog stage/contentStatus writes, glossary
    terms (content). Those are your single-writer duty. **Never** write `status: "DONE"`,
    `shipped`, `shippedAt`, `shippedSha`, or `lastCheckedSha` — those belong to the main chat's
    PHASE 4 completion, after the merge. And never remove `transition: "shipping"` — the
    design-ship run marker.

## Git boundary (recap of rule 6)

The only git integration is the main chat's PHASE 4 finalize. Build commits generated code in the
worktree; content commits applied copy in the worktree; check commits fixes in the worktree. No
agent runs `git merge`, `git branch -d/-D`, `git worktree remove`, or switches to `main`.

## On failure

Do not merge, leave the worktree intact, kill your dev server, return `status: failed` with the
stop point. The main chat reports it and suggests the recovery command.

## RESULT CONTRACT

**Primary (Workflow path)**: you have been given a structured-output tool whose schema matches
your agent reference's result fields — your **final answer is that tool call**. Do not also print
a delimited result block.

**Fallback (Agent-tool path, no structured-output tool)**: return **exactly one** delimited block
(schema per agent reference): `SHIP_DESIGN_BUILD_RESULT` / `SHIP_DESIGN_CONTENT_RESULT` /
`SHIP_DESIGN_CHECK_RESULT`, each `_START` … `_END`. Keep prose minimal — the block IS the return
value.

In both cases: always include `autoDecisions[]` (rule 3).

## Orchestrator side (main chat)

- **Workflow path (primary)**: the workflow's return value carries each agent's schema-validated
  result object — read fields directly, nothing to parse. **Agent-tool fallback**: parse the block
  robustly: `sed -n '/SHIP_DESIGN_X_RESULT_START/,/SHIP_DESIGN_X_RESULT_END/p'`; on truncation
  `Grep` the agent's output file for the markers and `Read` with an offset.
- **Re-read `.project/` from disk after every agent/workflow return** — the pre-spawn snapshot is
  stale.
- **Sequencing**: build → content → check run strictly sequentially in one worktree (one writer at
  a time — the workflow script enforces this ordering). Nothing runs concurrently.
