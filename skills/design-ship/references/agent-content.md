# AGENT 2 — Content (design-content, auto-apply)

One subagent that runs the copied `design-content` workflow for the target non-interactively, in
the build worktree: scan placeholders → generate copy from the PHASE 0 brief → auto-apply →
backlog/glossary sync → worktree commit. The human copy review is deferred to design-ship PHASE 4
(against the live page) — this agent returns the `copyTable[]` payload for it.

The full agent instruction body is the **static** file
`.claude/skills/design-ship/references/prompts/content.md` — the agent reads it itself. The main
chat writes only a small **pointer + context** file (below); it does **not** read
`prompts/content.md` or `non-interactive-contract.md`.

## Spawn

**Primary (Workflow)**: the main chat writes the pointer file below to
`.project/session/ship-prompts/{target}-content.txt` and passes its path as `args.contentPromptPath`
to `references/workflows/ship-design-phase123.js`. Keep the literal `{worktreePath}` placeholder
**in the file** — the agent substitutes it with AGENT 1's worktree path per the script's
read-and-execute instruction. Runs with `agentType: "general-purpose"`, `model: "sonnet"`,
`effort: "medium"` (matrix: SKILL.md § Design — brief-bound generation) and validates against
`CONTENT_SCHEMA`.

**Fallback (Agent tool)**: spawn via the `Agent` tool with `subagent_type: "general-purpose"`,
`model: "sonnet"`; substitute `{worktreePath}` yourself before passing the pointer file content.

### Pointer file (what the main chat writes — the ONLY assembled text)

```
Read `.claude/skills/design-ship/references/prompts/content.md` — it is your full instruction set.
Execute it as your task for the target "{target}".

CONTEXT (content-slice of SHIP_CONTEXT; worktree path = {worktreePath}; main repo path = {mainRepoPath}):
{paste the content-slice of SHIP_CONTEXT (PHASE 0) — $ARCHETYPE, $BRIEF (confirmed), SEED,
glossary, entities, target files from the build result}
```

## Orchestrator handling (PHASE 2)

1. **Workflow path**: the script substitutes `{worktreePath}` itself and returns the validated
   `content` object. **Fallback path**: parse `SHIP_DESIGN_CONTENT_RESULT_START/END`.
2. Content failure is **non-fatal** (`contentDegraded: true` in the workflow return): the page
   ships with placeholder copy unless the user regenerates in PHASE 4. Mark PHASE 2 `completed`
   with a degradation note; AGENT 3 still runs.
3. `status: green` → **re-read `.project/` from disk**, keep `copyTable` in memory for PHASE 4.

## Regenerate loop (PHASE 4 "Copy bijstellen")

When the user asks for a copy regeneration in the PHASE 4 review, re-spawn THIS agent via the
`Agent` tool (single agent — no workflow needed): write the same pointer file, but in its CONTEXT
block update `$BRIEF` per the user's tone/language adjustment and add the line
`REGENERATE: previous copyTable below — improve per the new brief, replace in-place.` (append the
prior copyTable). `prompts/content.md` handles this line. Cap at 3 regeneration rounds (mirrors
review-gate.md §4.5).
