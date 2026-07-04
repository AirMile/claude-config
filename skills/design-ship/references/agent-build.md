# AGENT 1 — Build (design-convert Build route)

One subagent that runs the copied `design-convert` Build route (Steps 7–11) for the target
non-interactively, in an isolated context. It creates the worktree, generates the code with the
user-chosen design direction, runs the smoke check, and commits — but never merges.

The full agent instruction body is the **static** file
`.claude/skills/design-ship/references/prompts/build.md` — the agent reads it itself. The main chat
writes only a small **pointer + context** file (below); it does **not** read `prompts/build.md` or
`non-interactive-contract.md` (the agent reads both).

## Spawn

**Primary (Workflow)**: the main chat writes the pointer file below to
`.project/session/ship-prompts/{target}-build.txt` and passes its path as `args.buildPromptPath` to
`references/workflows/ship-design-phase123.js`, which has the agent read the file and runs it with
`agentType: "general-purpose"`, `model: "sonnet"`, `effort: "high"` (matrix: SKILL.md § Design —
direction + spec bound the work) and validates the result against `BUILD_SCHEMA`.

**Fallback (Agent tool, when Workflow is unavailable)**: spawn via the `Agent` tool with
`subagent_type: "general-purpose"` (needs full tools: Edit/Write/Bash/git) and `model: "sonnet"`
(effort is not settable on the Agent tool). Pass the same pointer file content as the prompt.

### Pointer file (what the main chat writes — the ONLY assembled text)

```
Read `.claude/skills/design-ship/references/prompts/build.md` — it is your full instruction set.
Execute it as your task for the target "{target}" ({targetType}).

CONTEXT (build-slice of SHIP_CONTEXT; main repo path = {mainRepoPath}):
{paste the build-slice of SHIP_CONTEXT (PHASE 0) — $SPEC, $DESIGN_LEVERS, $COMPOSITION,
$DESIGN_DIRECTION, $CHOSEN_LAYOUT, SEED_CONTEXT, stack, glossary}
```

## Orchestrator handling (PHASE 1)

1. **Workflow path**: `ship-design-phase123.js` returns the validated `build` object (and skips
   content/check on failure) — read fields directly, no parsing. **Fallback path**: parse
   `SHIP_DESIGN_BUILD_RESULT_START/END` (robust — see non-interactive-contract.md).
2. `status: failed` → leave PHASE 1 `in_progress` (do not mark it `completed`), skip to PHASE 5
   report: "Build failed at {failedAt}, worktree intact at {worktreePath} — run
   `/design-convert {target}` to patch, or inspect the worktree." AGENT 2/3 do not run.
3. `status: green` → **re-read `.project/` from disk**, carry `worktreePath` + `smokeUrl` forward,
   continue to PHASE 2.
