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
- **Why there is no background orchestrator agent.** An earlier version of this pipeline spawned a
  background "AGENT O" to run the PHASE 1–4 stretch in its own small context, motivated in part by
  avoiding an uncached re-read of the define-heavy main chat (SKILL.md + `phase-0-define-classify.md`
  - the interview transcript + loaded learnings/context, ~40-60k tokens after PHASE 0) at every
    workflow-boundary wake-up. That cache-miss concern turned out to be unfounded on a subscription auth
    (Claude Code requests the automatic 1-hour cache TTL there, comfortably longer than a 10-30 min
    Workflow run — see `shared/PROMPT-CACHE.md`); it only holds on API-key auth without
    `ENABLE_PROMPT_CACHING_1H=1`. The design was abandoned for an unrelated, harder reason: the Workflow
    tool is not reachable from a background subagent (confirmed — not even via `ToolSearch`), so
    AGENT O could never actually launch the PHASE 1+2/PHASE 4 workflows and always ran on the inferior
    Agent-tool fallback (no effort control, no resume-cache, no schema validation) — worse than just
    running inline. The main chat now launches every workflow itself; the turn still ends immediately
    after each launch, so any wake-up cost is (auth-mode-dependent) token spend, not wall-clock waiting.
    The human gates (`AskUserQuestion`, `EnterPlanMode`/`ExitPlanMode`) only work in the main chat
    anyway — which is why define and the PHASE 3 manual round were always going to stay there.
- **The real cache-rebuild cost is `opusplan`, not idling — and it is asymmetric, not "both sides".**
  Every plan-mode entry/exit under `/model opusplan` is a **model switch**, and a model switch
  invalidates the cache regardless of how long the wait was — see `shared/PROMPT-CACHE.md`. But the
  PHASE 0 gate's `EnterPlanMode` (`references/phase-0-fresh-define.md:9`) lands right after the last
  mandatory pre-plan-mode write, while the main chat still holds only `SKILL.md` +
  `phase-0-define-classify.md` — a cheap Opus write. Everything expensive (context loads, the
  interview, architecture, the plan file) then accumulates **inside** plan mode, so the costly
  rebuild is the single `ExitPlanMode` at `phase-0-fresh-define.md:125`, reading the full
  ~40-60k-token chat on Sonnet — not a rebuild on both sides. PHASE 3's gates run in a fresh,
  small-context session after the deliberate PHASE 2→3 park (`SKILL.md:96-97`), and round 1 of the
  fix-plan gate reuses the manual walkthrough's already-open plan mode (`references/fix-round.md:33-38`)
  rather than opening a second one — so this pattern costs roughly **one** significant uncached read
  per run, not "1-3 full rebuilds". `opusplan` is kept anyway — the define architecture is built
  around it (`SKILL.md § Design`, the OpusPlan-optimized paragraph) and the quality gain from planning
  on Opus is worth that one read. The design lesson for new plan-mode gates: enter as early as
  possible in the context (right after the last write that must precede it), so the cheap side of the
  switch is the entry, not the exit.
- **One place quietly depends on the session model, not just plan mode.** Switching off `opusplan` to
  a single fixed model is a silent quality regression here, not a neutral swap:
  `references/manual-interview-walkthrough.md:53-54` runs the evidence-sweep as a **fork**, and
  forks always run the parent model (`shared/SKILL-PATTERNS.md:454`) — so it rides `opusplan`
  implicitly. (The heavy debug ceiling, `references/debug-round-heavy.md § 5`, used to make the same
  point about its three unpinned fix-strategy agents — that fan-out is gone; the tier now writes one
  plan directly in whatever model plan mode is already running under, so there's no separate pin
  decision to make.)
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
