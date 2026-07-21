# Debug toolbox (shared)

The technique menu [DEBUG-LADDER.md § Difficulty triage](DEBUG-LADDER.md) selects from. Tier decides
how much process a fix gets; this file is what actually produces evidence once tier 2+ needs it.
Loaded on demand — read only the section the current difficulty score points at, not the whole file.

**Selection rule, always**: pick the **cheapest technique that can produce the evidence the current
hypothesis needs**. Never stream unfiltered console/network output into context — filter at the
source (a regex, a specific request, a specific scope dump), not after reading everything.

## Triage-to-technique map

| Score | Default move                                                                                                                                                                                                                  |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **S** | Static read + fix (the normal tier-1 flow). If frontend-facing, one filtered console check (playwright-cli daemon by default — see `BROWSER-VEHICLES.md`) before concluding "no error" — never skip straight to "looks fine." |
| **M** | Gather evidence first: § Instrumentation or § Browser-driven, whichever matches where the symptom lives, before writing the hypothesis down.                                                                                  |
| **L** | § Heavy techniques — `git bisect run` for a regression, a scripted CDP breakpoint dump for a value mystery, a state-diff for corruption, § User-in-the-loop when the agent itself can't reproduce the issue.                  |

## Instrumentation

- **Structured debug markers**: inject `console.log('[DBG:{session-id}:{point}]', JSON.stringify(data))`
  at suspect points — one unique session id per debug session so old markers from a prior round
  never get confused with this one's. Log both entry **and** exit of a suspect function — that
  proves the code path was reached AND what value it produced, not just one or the other.
  **Hard cleanup gate**: `grep -rn "DBG:{session-id}"` must return zero hits before the round's
  re-check verdict is recorded — a leaked marker is a failed round exit, not a cosmetic loose end.
- **`DEBUG=` env / request-logging middleware**: zero code change for framework-internal questions
  (routing, middleware order) — `DEBUG=express:* node server.js 2>debug.log`, or a 5-line
  `app.use` logging method/path/status/body-keys/duration for API-shaped bugs. Remove any added
  middleware before the round ends (the env-var form needs no cleanup).
- **Node runtime flags**: `NODE_OPTIONS='--enable-source-maps --unhandled-rejections=strict
--trace-warnings'` surfaces silent failures and bad stacks for free — no code change, no cleanup.

## Browser-driven

Interactive, hypothesis-driven investigation — steps are discovered as you go, not scripted in
advance. Vehicle per `BROWSER-VEHICLES.md`: **Playwright MCP** (`PLAYWRIGHT-MCP.md`) by default —
most repro runs against a dev server the agent itself launched, no real user session needed.
**Claude-in-Chrome** (`CLAUDE-IN-CHROME.md`) only when the repro genuinely depends on the real user's
session (already-logged-in state, extensions).

- **Console read, filtered**: `browser_console_messages` (Playwright MCP) / `read_console_messages`
  (Claude-in-Chrome) with a regex on the session's `DBG:` prefix, or `level:error` — never an
  unfiltered read, it floods context.
- **Network inspection**: `browser_network_requests` / `read_network_requests` filtered to the
  failing call's URL/status — request AND response body of that one call, not the whole log.
  Catches contract bugs: wrong payload shape, missing header, unexpected CORS, a duplicate fire.
- **Probe JS in page**: `browser_evaluate` / `javascript_tool` to evaluate state directly —
  `window.__state`, `localStorage`/`sessionStorage`/cookies, `getComputedStyle`, or a temporary
  `fetch` monkey-patch logging args before a repro. Patches vanish on reload — no cleanup needed,
  but note they won't persist across a hard refresh.
- **Agent-driven repro**: when the failing flow is reproducible, drive it yourself
  (`browser_navigate`+`browser_click` / `navigate`+`computer`) instead of asking the user to — then
  read console/network from that exact run. Faster than a round-trip when you can actually execute
  the steps.
- **DOM snapshot**: `browser_snapshot`/`read_page` (accessibility tree) or `get_page_text` for state
  assertions; screenshot only when a DOM assertion genuinely can't tell the story (layout/rendering
  bugs) — screenshots are token-heavy, prefer text-based checks first.

## User-in-the-loop repro

For bugs only the human can reproduce (real credentials, a specific device, a perception-triggered
issue) — the pattern is **instrument → hand off → collect → clean up**:

1. Inject markers per § Instrumentation, tagged with a fresh session id, writing to a single
   append-only file (`.project/debug/session-{id}.log` server-side, or just the browser console).
2. Hand the user a short numbered repro script — exact steps, expected vs actual — and ask them to
   say when done. Don't poll; wait for their signal.
3. Read/correlate the log by session id and timestamps.
4. **Delete the log file and strip the markers** — same cleanup discipline as any other
   instrumentation, just deferred until after the user's run.

## Heavy techniques (L-tier only — expensive, so use only when the score says so)

- **`git bisect run`** — for a confirmed regression with a known-good commit. Write a throwaway
  script that exits 0/1 (a repro test, or a `curl` + assertion), stash/clean the worktree first, then
  `git bisect start bad good && git bisect run ./repro.sh` — fully automatic, no manual stepping.
- **Scripted CDP one-shot breakpoint dump** — for "what value does X actually have here" mysteries
  where reading code isn't resolving it. Interactive step-through is too expensive for an agent;
  instead write a throwaway ~40-line script using `chrome-remote-interface` (or Node's own
  `--inspect` + the Inspector protocol) that: connects to `node --inspect=9229`,
  `Debugger.setBreakpointByUrl(file, line)`, triggers the request, on `Debugger.paused` dumps the
  call stack + scope via `Runtime.getProperties`, resumes, exits. One shot, not a REPL session.
- **State-checkpoint diffs** — for state-corruption bugs. Dump state to JSON at checkpoints (server:
  a debug write to `.project/debug/state-{step}.json`; browser: `window.__dumpState()` called via
  `javascript_tool`), then `diff`/`jq` between steps to see exactly where the value went wrong.
  Read-only for DB snapshots — never mutate live data to capture a state diff.
