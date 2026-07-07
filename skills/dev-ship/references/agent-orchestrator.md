# AGENT O — Orchestrator

One background agent that runs the autonomous PHASE 1–4 stretch — build, auto-verify, the
no-manual PHASE 3 completion, refactor, security, and finalize — so the define-heavy main chat
wakes only once instead of re-reading its whole context at every workflow boundary.

The full agent instruction body is the **static** file
`.claude/skills/dev-ship/references/prompts/orchestrator.md` — the agent reads it itself. The main
chat writes only the spawn prompt below; it does **not** read `prompts/orchestrator.md` or
`non-interactive-contract.md`.

**What it owns**: the checkpoint write token from write point 1b until its final clearing write
(write points 2, 3, 4, and the PHASE 3 no-manual completion patch); the `active-{feature}.json`
live signal during its run.

**What it never does**: user interaction (`AskUserQuestion`/`EnterPlanMode`/`ExitPlanMode`),
`TaskCreate`/`TaskUpdate`, ship-level learning extraction (PHASE 5, main chat only), checkpoint
deletion (write point 5 is always the main chat's).

## Spawn

**Precondition**: write point 1b — `echo '{"orchestrator":{"status":"running","startedAt":"{ISO}"}}'
| node ~/.claude/scripts/ship-checkpoint.js patch {feature}` — must be the caller's **last**
checkpoint write before this call. The caller is either the main chat (after the PHASE 0 gate
accept, with build/verify pointer paths already written) or the PHASE 3 fresh chat (at the end of
its manual round, with no build/verify paths — the checkpoint routes AGENT O straight to PHASE 4).

```
Agent(subagent_type: "general-purpose", model: "sonnet", run_in_background: true, prompt: `
Read \`.claude/skills/dev-ship/references/prompts/orchestrator.md\` — it is your full instruction set.
Execute it for the feature "{feature}".
buildPromptPath: {path, or "checkpoint" when resuming / when spawned from PHASE 3}
verifyPromptPath: {path, or "checkpoint"}
`)
```

Sonnet is sufficient: AGENT O is mechanical routing and checkpoint bookkeeping — all judgment
(build, adversarial verify, refactor, security triage) lives in the workflows it launches.

## Wake handling (main chat / PHASE 3 fresh chat)

1. Parse the `SHIP_ORCH_RESULT_START…END` block from AGENT O's final answer.
2. Defensively clear a still-set `orchestrator` marker (`patch {"orchestrator":null}`) — AGENT O
   should have cleared it itself, but a crash on its very last write is possible.
3. Batch-`TaskUpdate` the phase tasks per the checkpoint's `completedPhases`.
4. Branch on `status`:
   - `"complete"` → proceed to SKILL.md PHASE 5 (report, learnings, consolidation gate).
   - `"parked"` → print the park/handoff message template (SKILL.md § PHASE 1–4, "On wake").
   - `"failed"` → print the failure recovery message (SKILL.md § PHASE 1–4, "On wake"), then
     PHASE 5's failure path.
