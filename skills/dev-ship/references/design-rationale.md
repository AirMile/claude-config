# dev-ship — design rationale

The full "why" behind the pipeline shape. `SKILL.md § Design` carries the compressed, execution-relevant
version (the agent model/effort matrix + the `args`-normalization gotcha); this file holds the extended
reasoning for when you need to understand _why_ the flow is built this way — it is not needed to execute a run.

- **One human touchpoint up front** (PHASE 0: define only — technique passes are auto-derived),
  ending with a **plan-approval gate**: after define + classify the full feature plan is presented in
  plan mode and the user accepts it (or rejects → revise) before build starts. Then hands-off —
  except the conditional manual-test interlude (PHASE 3). The define-phase HTML preview is a **visual
  aid shown only when the feature has UI**; the plan-approval gate, not the preview, is the review
  surface.
- **85/15 is one flow, not two paths.** PHASE 3 either has manual items or falls through to just
  the completion (DONE write) — the merge happens at the end of PHASE 4, after refactor. The
  `verificationProfile` computed in PHASE 0 is an **advisory estimate**; AGENT 2's returned
  `remainingManualItems` is authoritative for PHASE 3.
- **Why there is no background orchestrator agent (and the cache-miss cost that follows from it).**
  An earlier version of this pipeline spawned a background "AGENT O" to run the PHASE 1–4 stretch in
  its own small context, specifically to avoid the define-heavy main chat (SKILL.md +
  `phase-0-define-classify.md` + the interview transcript + loaded learnings/context, ~40-60k tokens
  after PHASE 0) paying an **uncached** re-read at every workflow-boundary wake-up — Workflows run
  10-30+ minutes, longer than the prompt cache's 5-minute TTL. That design turned out to be
  infeasible: the Workflow tool is not reachable from a background subagent (confirmed — not even via
  `ToolSearch`), so AGENT O could never actually launch the PHASE 1+2/PHASE 4 workflows and always ran
  on the inferior Agent-tool fallback (no effort control, no resume-cache, no schema validation) —
  worse than just running inline. The main chat now launches every workflow itself and accepts the
  cache-miss cost on each notification wake-up as a known trade-off: the alternative (an orchestrator
  agent that cannot do the one thing it exists for) is strictly worse. The turn still ends
  immediately after each launch, so the cost is token spend on wake-up, not wall-clock waiting. The
  human gates (`AskUserQuestion`, `EnterPlanMode`/`ExitPlanMode`) only work in the main chat anyway —
  which is why define and the PHASE 3 manual round were always going to stay there.
- **Build and verify are separate agents (separate context windows)** — a fresh verify agent is
  unbiased/adversarial, which is the whole value of verify. See `references/agent-verify.md`.
- **`.project/` is shared on disk between agents; context is isolated.** The flow is sequential →
  one writer at a time → no write-races. Re-read `.project/` from disk after every agent return.
  See `references/non-interactive-contract.md`.
- **Agents run via the Workflow tool** (two runs: PHASE 1+2 and PHASE 4) with a per-agent
  model + effort matrix and schema-validated structured results (no result-block parsing).
  **Prompts are passed by pointer, never inline** — the static agent instruction bodies live in
  `references/prompts/{build,verify,refactor,security-triage}.md` and the spawned agent reads them
  itself (plus `non-interactive-contract.md`, which it also reads). The main chat writes only a small
  **pointer + dynamic SHIP_CONTEXT slice** file to `.project/session/ship-prompts/` and passes the
  path in `args` — it does **not** read the `prompts/*` bodies or the contract. Some
  runtimes deliver the `args` global to the script as a **JSON string** rather than an object (then
  every `args.x` is `undefined`), so both workflow scripts **normalize `args` at the top**
  (`typeof args === "string" ? JSON.parse(args) : args`) — the primary Workflow path is reliable.
  The Agent-tool spawn path in each `agent-*.md` is the **fallback**, used only when the Workflow
  tool is unavailable. Model override only there (the Agent tool cannot set effort).
