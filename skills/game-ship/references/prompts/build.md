You are AGENT 1 (build) in the game-ship pipeline. Execute the `/game-build` skill for the TARGET
FEATURE (named in the CONTEXT block you were given — the pointer that sent you here) by reading
`.claude/skills/game-ship/references/game-build/SKILL.md` and following it fully (PHASE 0 →
PHASE 6 completion), with the NON-INTERACTIVE CONTRACT below.

Return your result per the RESULT CONTRACT in the non-interactive contract: if you have a
structured-output tool, your final answer is that tool call (fields below); otherwise your final
message must be ONLY the delimited result block — a machine return value, not a human report.

NON-INTERACTIVE CONTRACT:
Read `.claude/skills/game-ship/references/non-interactive-contract.md` NOW and obey it as binding
rules — it overrides the workflow file. If that Read fails, return status "failed" immediately.

SHIP_CONTEXT + FEATURE:
Use the CONTEXT block you were given (the pointer that sent you here). It names the feature and
carries the build-slice of SHIP_CONTEXT, including the resolved {godot_executable} — use them instead
of re-running the workflow's own PHASE 0 context-load and instead of re-resolving paths.yaml; only
load what is missing there.

BUILD-SPECIFIC:

- game-build already creates the worktree (WORKTREE.md → Auto-create) and never merges — keep it
  that way. Honor the Pre-PHASE-1 worktree GATE.
- Run the TDD build (RED-GREEN) for all COVERED/testable requirements; Implementation Only only where
  automated tests add no value. Run PHASE 3a full GUT regression gate and PHASE 3b integration scene
  - the `playtest_scene.tscn` + DebugListener — the main chat's PHASE 3 playtest depends on that
    scene existing. Do game-build's normal .project/ sync (status DOING, stage "built",
    tests.checklist[]) + scoped worktree commit at the end.
- ALL GUT runs are HEADLESS: `"{godot_executable}" --headless --path . -s addons/gut/gut_cmdln.gd -gexit`.
  NEVER launch a game window (`mcp__godot-mcp__run_project`) — you have no display (contract rule 8).
- Skip game-build's terminal Next-Step Clipboard Offer.
- If the build cannot reach green after game-build's own diagnostics/regression gate: STOP, do not
  merge, leave the worktree, and return status "failed" with the failing requirement.

Result fields (structured output object; fallback = this exact block):
SHIP_BUILD_RESULT_START
status: green | failed
feature: {feature}
worktreePath: <absolute path>
branch: worktree-{feature}
testsPass: <n>
testsTotal: <n>
filesCreated: <n>
filesModified: <n>
failedAt: <REQ-id + short reason, or "none">
autoDecisions:

- <agent auto-choice made in place of an AskUserQuestion, or "none">
  SHIP_BUILD_RESULT_END
