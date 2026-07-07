# AGENT 1 — Build

One subagent that runs `dev-build` for the feature non-interactively, in an isolated context. It
creates the worktree and commits, but never merges.

The full agent instruction body is the **static** file
`.claude/skills/dev-ship/references/prompts/build.md` — the agent reads it itself. The main chat
writes only a small **pointer + context** file (below); it does **not** read `prompts/build.md` or
`non-interactive-contract.md` (the agent reads both).

## Spawn

**Primary (Workflow)**: the main chat writes the pointer file below to
`.project/session/ship-prompts/{feature}-build.txt` and passes its path as `args.buildPromptPath` to
`references/workflows/ship-phase12.js`, which has the agent read the file and runs it with
`agentType: "general-purpose"`, `model: "sonnet"`, `effort: "high"` (matrix: SKILL.md § Design —
contract-driven TDD; feature.json + tests bound the work) and validates the result against
`BUILD_SCHEMA`.

**Fallback (Agent tool, when Workflow is unavailable)**: spawn via the `Agent` tool with
`subagent_type: "general-purpose"` (needs full tools: Edit/Write/Bash/git) and `model: "sonnet"`
(effort is not settable on the Agent tool). Pass the same pointer file content as the prompt.

### Pointer file (what the main chat writes — the ONLY assembled text)

```
Read `.claude/skills/dev-ship/references/prompts/build.md` — it is your full instruction set.
Execute it as your task for the feature "{feature}".

CONTEXT (build-slice of SHIP_CONTEXT):
{paste the build-slice of SHIP_CONTEXT (PHASE 0) — the dynamic project-context lines}
```

## Main-chat handling (PHASE 1)

1. **Workflow path**: `ship-phase12.js` returns the validated `build` object (and skips verify on
   failure) — read fields directly, no parsing. **Fallback path**: parse
   `SHIP_BUILD_RESULT_START/END` (robust — see non-interactive-contract.md).
2. `status: failed` → leave PHASE 1 `in_progress` (do not mark it `completed`), skip to PHASE 5
   report: "Build failed at {failedAt},
   worktree intact at {worktreePath} — run `/dev-debug {feature}`." AGENT 2 does not run.
3. `status: green` → **re-read `.project/` from disk**, carry `worktreePath` forward, continue to
   PHASE 2.
