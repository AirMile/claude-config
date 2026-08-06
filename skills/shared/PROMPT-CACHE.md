# Prompt Cache Facts

Single source of truth for how Anthropic's prompt cache behaves inside Claude Code. Reference this instead of restating cache mechanics in a skill's design rationale — a claim duplicated across skills is a claim that goes stale in only one place.

Sources: [How Claude Code uses prompt caching](https://code.claude.com/docs/en/prompt-caching), [Prompt caching (API)](https://platform.claude.com/docs/en/build-with-claude/prompt-caching).

---

## TTL by auth mode

| Auth mode                                             | TTL                   | Notes                                                                                                                                                                                                |
| ----------------------------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude subscription (Pro/Max)                         | **1 hour, automatic** | Included in plan usage — costs nothing extra. Claude Code requests this TTL for you.                                                                                                                 |
| Subscription, over plan limit (drawing usage credits) | 5 minutes             | Automatic fallback once you're billed per token.                                                                                                                                                     |
| API key / Bedrock / Vertex / Microsoft Foundry        | 5 minutes (default)   | Set `ENABLE_PROMPT_CACHING_1H=1` to opt into the 1-hour TTL (billed at the 1h cache-write rate).                                                                                                     |
| Any mode                                              | —                     | `FORCE_PROMPT_CACHING_5M=1` forces 5 minutes regardless of auth — useful for debugging cache behavior.                                                                                               |
| Subagents                                             | 5 minutes, always     | Even inside a subscription session — the automatic 1h TTL only applies to the main conversation. A **fork** is the exception: it inherits the parent's prefix and reads the parent's cache directly. |

A cache-hit read refreshes its own TTL for free. Idle time is the only thing the TTL measures — it says nothing about which model, effort, or tool set produced the cached prefix.

## What breaks the cache (full or partial rebuild)

- **Effort level change** (`/effort`) mid-session.
- **Turning on fast mode** (adds a cache-key header) — once per conversation, cheapest at session start.
- **MCP server connect/disconnect** — only when its tools are _not_ deferred (deferred is the default on supported models).
- **Denying an entire tool** (a bare tool name / `Bash(*)` / a tool-name glob) — removes it from the system-prompt layer.
- **`/compact`** — replaces conversation history; system prompt + project context can still cache-hit.
- **Claude Code upgrade** — first turn after upgrade/restart rebuilds from the top; resuming a long session after an upgrade re-reads the _entire_ history uncached.

## What keeps the cache (safe, even for long idles)

- Any blocking wait on the user — `AskUserQuestion`, `ExitPlanMode`/plan review, a permission prompt, a hook awaiting an external process. These are pure idle time; the wall-clock TTL above is the only thing that matters, not _why_ the wait is happening.
- Entering plan mode itself — plan mode is a pure approval gate now; it never causes a model switch or cache rebuild.
- Invoking skills/commands (appended as messages).
- `/recap` and the automatic **session recap** (away-summary) — appended as command output, not a history replacement. **A recap appearing does not mean the cache expired** — it's a presence signal (≥3 min unfocused + ≥3 turns in the session), unrelated to cache TTL. Disable via `/config` → Session recap, or `CLAUDE_CODE_ENABLE_AWAY_SUMMARY=0`.
- `/rewind` — truncates back to an already-cached prefix.
- Editing a file Claude read earlier, or editing CLAUDE.md mid-session (the edit just doesn't apply until next `/clear`/`/compact`/restart).
- Changing permission mode — this never causes a model switch either, since plan mode carries no model swap.

## Cache scope

Scoped per machine + working directory — two worktrees of the same repo never share a cache. Sequential sessions in the same directory only share the prefix when the startup git-status snapshot (branch, recent commits) matches.

## Implication for pipeline design

Don't reason about "the workflow ran longer than the cache TTL" without first checking auth mode — on a subscription the TTL is 1 hour, comfortably longer than a typical 10-30 min background Workflow run. The real cache-rebuild cost in a plan-gated pipeline comes from whatever **model switches** genuinely occur in a run (explicit `/model` or `/effort` changes), not from wall-clock idling or from entering/exiting plan mode itself.

A model-switch gate's cost depends on _where in the context_ the toggle falls, not just that it happens: entering **before** the toggle as early as possible — right after the last write that must precede it, before any heavy reads — puts the cheap side of the switch (small prefix) at entry and the expensive side (full prefix, one uncached read) at exit. Entering late, after context has already grown, pays the expensive side twice. This no longer applies to plan mode itself (the session model is fixed at `opus` throughout, so plan-mode entry/exit is never a model switch) — it is the general lesson for any future gate that genuinely does toggle `/model`/`/effort`. See `dev-ship`/`game-ship`'s `references/design-rationale.md` for a worked historical example from when plan mode did carry that cost.
