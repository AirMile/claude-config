# AGENT 2 — Auto-verify (fresh context)

Spawn a **separate** subagent (fresh context window) that runs `dev-verify` for the AUTO/COVERED
items only, then stops before manual walkthrough and before finalize. The fresh context is the
point: a verify agent that did not just write the code looks at it unbiased/adversarially.

The full agent instruction body is the **static** file
`.claude/skills/dev-ship/references/prompts/verify.md` — the agent reads it itself. The main chat
writes only a small **pointer + context** file (below); it does **not** read `prompts/verify.md` or
`non-interactive-contract.md`.

## Spawn

**Primary (Workflow)**: the main chat writes the pointer file below to
`.project/session/ship-prompts/{feature}-verify.txt` and passes its path as `args.verifyPromptPath`
to `references/workflows/ship-phase12.js`. Keep the literal `{worktreePath}` placeholder **in the
file** — the script replaces it with AGENT 1's worktree path per its read-and-execute instruction.
The script runs it with `agentType: "general-purpose"`, `model: "opus"`, `effort: "high"` (matrix:
SKILL.md § Design — the one independent adversarial judgment; backstops the sonnet build) and
validates the result against `VERIFY_SCHEMA`.

**Fallback (Agent tool, when Workflow is unavailable)**: spawn via the `Agent` tool with
`subagent_type: "general-purpose"` and `model: "opus"` (effort is not settable). Substitute
`{worktreePath}` yourself before passing the pointer file content as the prompt.

### Pointer file (what the main chat writes — the ONLY assembled text)

```
Read `.claude/skills/dev-ship/references/prompts/verify.md` — it is your full instruction set.
Execute it as your task for the feature "{feature}".

CONTEXT (verify-slice of SHIP_CONTEXT; worktree path = {worktreePath}):
{paste the verify-slice of SHIP_CONTEXT (PHASE 0) — the dynamic project-context lines}
```

The `{paste ...}` line above is the wrapper's only fixed shape — the CONTEXT block itself should
carry the full verify-slice detail from `phase-0-define-classify.md § Per-agent slices`
(`acceptance[]` + `testStrategy`, `verificationProfile`, `paths`, filtered learnings) and routinely
runs to tens of lines for a real feature. "Small pointer file" describes the wrapper prose above,
not the pasted slice.

## Main-chat handling (PHASE 2)

1. **Workflow path**: `ship-phase12.js` returns the validated `verify` object — read fields
   directly. **Fallback path**: parse `SHIP_VERIFY_RESULT_START/END` (robust).
2. `status: failed` → leave PHASE 2 `in_progress` (do not mark it `completed`), skip to PHASE 5:
   "Auto-verify failed at {failedAt},
   worktree intact — re-run `/dev-ship {feature}` to retry, or go straight to
   `references/debug-round-heavy.md` (non-ledger entry)." Do not finalize.
3. `status: green` → **re-read `.project/` from disk**. `remainingManualItems` is **authoritative**
   for PHASE 3 (overrides the PHASE 0 advisory estimate). Non-empty `improvementNotes` → hand them to
   `references/orchestration.md § 3`'s offload flush before continuing (never blocks; never enters
   `remainingManualItems`). Continue to PHASE 3.

   `improvementNotes` entries are **objects** (`{note, severity, class, paths?, dependsOn?}` —
   `prompts/verify.md`), not bare strings. Pass the array through to the flush verbatim: its first
   step pipes it to `scripts/improvement-notes.js`, which normalizes any legacy bare-string entry
   itself. When parsing the **fallback** `SHIP_VERIFY_RESULT_START/END` block (below), build the same
   object shape — a hand-parse that flattens each note back to a string still works, but loses the
   severity and class the routing and the recurrence counter depend on.

**Contract check**: every element of `remainingManualItems` must carry a `manualReason` as a
**structured field on the item itself** (one of
`perception`/`real-credentials`/`audio`/`physical-device`/`screen-reader`/`tooling-gap` —
`dev-verify/references/test-classification.md § MANUAL`), not merely mentioned in prose — PHASE 3
routes its evidence gate on this field and persists it into the manual ledger. An item with no
`manualReason`, or one AGENT 2 downgraded to MANUAL out of uncertainty rather than a genuine
human-only criterion or a real tooling gap, is a contract violation — AGENT 2 should have executed
it itself as AUTO/BROWSER (`prompts/verify.md` tells the agent to do exactly this) instead of
pushing it to the human round.

**On detection** (main chat, at read time — never carry a violating item into PHASE 3 unexamined):
do **not** re-run AGENT 2; a full verify pass to relabel one item costs more than it saves.
Per violating item, classify it yourself against
`dev-verify/references/test-classification.md § MANUAL`:

- Meets a MANUAL criterion → write the missing `manualReason` yourself and continue.
- Does not → drop it from `remainingManualItems` and record it for the PHASE 5 report as
  `Verify contract: {N} item(s) reclassified` — it was AUTO-verifiable, and PHASE 3 must not
  spend a human round on it.

An empty `remainingManualItems` after this pass routes to PHASE 4 exactly as a clean verify would.
