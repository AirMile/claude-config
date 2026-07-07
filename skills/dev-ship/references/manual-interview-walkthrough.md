# Manual Walkthrough — item-by-item interview (dev-ship)

**When:** dev-ship PHASE 3 has `remainingManualItems` (from AGENT 2). This is the **collect-only**
walkthrough: each item is presented on its own, the user tests it live, and any non-pass verdict gets
its detail captured immediately — but nothing is fixed here. MANUAL = human perception/judgment,
real-credential auth, physical-device, or audio/screen-reader checks (each carries a `manualReason`
per `dev-verify/references/test-classification.md` — an item without one is a contract violation and
should not have reached this file). Visual polish is not a MANUAL _verification_ item — but the
running app routinely sparks change requests, so this round also accepts a **Tweak** outcome ("works,
but I want it different"), and a closing interview surfaces anything else the user noticed. None of
that gets fixed during this walkthrough — see `phase-3-manual-finalize.md § Findings ledger +
routing` for what happens after.

**Philosophy.** This round is not only "do the requirements pass" — it is "now that you see it
running: is it right, and is it also good?" The interview close (Step F) exists specifically to catch
the second question, which a pass/fail checklist alone cannot ask.

**Plan mode.** Steps A–A2 (signal, app-launch, evidence pre-check) run **before** plan mode — they
write to disk and touch the browser, both blocked once plan mode is active. Step A3 enters plan mode;
everything from Step B through the routing handoff at the end runs inside it. See Step A3 and Step E
for what that changes about persistence.

## Step A — Board signal (amber: waiting on the user)

Before presenting the first item, flag the board amber (see `shared/DEVINFO.md § Active Feature
Signal`):

```bash
echo '{"skill":"verify","waiting":"manual-tests"}' | node ~/.claude/scripts/ship-checkpoint.js signal {feature}
```

The script resolves the main checkout itself, so this is safe even though cwd is inside the worktree
here. After Step F closes, rewrite it **without** `waiting` — verification work (routing to the
ledger) resumes.

## Step A2 — Evidence pre-check sweep (before plan mode)

For each MANUAL item with an objectively observable sub-aspect (a DOM state, a navigation, a visible
outcome — not the perception/audio/credential/device reason itself), exercise it now via
Claude-in-Chrome (preferred — see `shared/CLAUDE-IN-CHROME.md` for the tool-loading ritual and the
Chrome/Playwright decision rule) or the `playwright-cli` daemon (fallback, no live browser
connected), and capture one screenshot per item (note its path — you'll attach it in Step B/D). Skip
this sweep entirely for items that are purely perceptual (real credentials, audio, physical device,
screen reader — nothing here is objectively pre-checkable). This sweep never sets a verdict — it only
prepares evidence for the human to confirm against.

## Step A3 — Enter plan mode

`EnterPlanMode` per `shared/PLAN-MODE.md` Entry (skip if already in plan mode). From here through the
end of this walkthrough — and into the round gate if the ledger routes there — all `.project/`
writes are blocked. Verdicts and ledger items are collected **in memory** (Step E) and written in one
batch immediately after the matching `ExitPlanMode` (`phase-3-manual-finalize.md § Findings ledger +
routing` names the exact exit point per path). **Trade-off, accepted**: a session death mid-interview
loses that session's in-memory verdicts — the resume filters `remainingManualItems` down to items not
yet present in the persisted `manual.items` (`phase-3-manual-finalize.md § Resume entry`), so nothing
is lost except having to re-ask those specific items.

## Step B — Present ONE item

Launch the app (Step 2's **App-launch rule** + hand-off rule in `phase-3-manual-finalize.md` apply —
match the launch command to the app **shell** and never substitute the browser-only dev server for a
Tauri/Electron desktop app; hand off, don't block on a readiness grep — this happens before Step A3,
so it is unaffected by plan mode). On the **first** item only, lead with the app URL/window note;
then, one item at a time:

```
MANUAL TEST {i}/{M} — {title}
  steps:    1. {concrete action with data}  2. …
  data:     {field = value, …}
  expected: {observable outcome}
```

If Step A2 produced evidence for this item, lead with it: "already exercised — here's the evidence
(screenshot); confirm, or test it yourself." Otherwise wait for the user to actually run it before
asking for a verdict — this is a live check, not a read-through.

## Step C — Verdict for this item

One `AskUserQuestion` per item (not batched — the user asked for item-by-item testing):

- `Pass` (recommended)
- `Fail — doesn't work as specified`
- `Tweak — works, but I want it different`
- `Skip / Defer` — one immediate follow-up: which of the two, and why (reason for Skip; blocking
  external prereq for Defer — account, CORS-origin, API-token, third-party config). **Defer is for
  external blockers only** — "it is broken" is by definition a **Fail**, never a Defer.

## Step D — Immediate detail capture on Fail/Tweak (do NOT fix)

While the user is still looking at it, capture what the fix round will need — but stop there, do not
start fixing:

- **Observed vs expected** — what happened vs what should have happened.
- **SUBJECTIVE → clarify first (mandatory)** — "feels off", "looks wrong" is not actionable. Ask
  **one** clarifying `AskUserQuestion` (which element/target, expected vs seen, too much/too little,
  wrong position/timing/behaviour), then re-categorize the answer as TESTABLE or MEASURABLE per
  `shared/FEEDBACK-CATEGORIZATION.md`. Never leave a finding as SUBJECTIVE in the ledger.
- **Visual / DOM-observable item** → reuse the Step A2 evidence if it exists; otherwise note the
  element pointer now and capture the screenshot right after plan-mode exit (the app is still
  running) — screenshot capture is a disk write, blocked until then. The later fix round needs this
  signal to converge on the first try.
- **On Fail** — capture objective failure evidence now, while it still reproduces: console errors,
  the failing network response, the screenshot already specified above. The fix round consumes it,
  and after repeated failed rounds the debug round does (`fix-round.md § Re-check` ladder →
  `references/debug-round.md`). Still collect-only — do not fix anything here.

Record the category (TESTABLE / MEASURABLE) alongside the finding. Then move to the next item — the
fix routing lives in `phase-3-manual-finalize.md § Findings ledger + routing`, not here.

## Step E — Collect (in memory)

Keep each item's full record (id, title, verdict, category, observed, expected, screenshot, source)
in memory as you go — do **not** write to the checkpoint yet; plan mode blocks it. Repeat Steps B–E
for every remaining item.

**Batch persist (after plan-mode exit).** The exact `ExitPlanMode` you follow is named in
`phase-3-manual-finalize.md § Findings ledger + routing` (it differs by which path the ledger takes).
Immediately after that exit, in one call:

```bash
echo '[{"id":"MT-1","title":"...","verdict":"pass","category":"...","observed":"...","expected":"...","screenshot":"...","source":"checklist"}, {"id":"MT-2", ...}]' \
  | node ~/.claude/scripts/ship-checkpoint.js item {feature} manual
```

Send the full in-memory array — the script upserts each element into `manual.items` by `id` in one
atomic write. Then patch `manual.interviewDone: true`, and capture any screenshots you deferred in
Step D (the app is still running).

## Step F — "Now that you see it running" interview close

After the last item (still inside plan mode), ask **one** open question (English source text, emit in
the runtime language per `shared/LANGUAGE.md`):

> "Now that you see it running: what should be different or better?"

Follow up on whatever the user raises — one clarifying question at a time, no pre-built dimension
checklist. SUBJECTIVE answers get the same mandatory clarify-then-recategorize as Step D. Stop the
moment the user has nothing more to add; do not fish for issues that aren't there.

- **In-theme adjustment** (design/behaviour change to something already built) → a new ledger
  finding, `verdict: "tweak"` (or `"fail"` if it turns out a criterion was genuinely not met),
  `source: "interview"`. Add it to the in-memory collection (Step E) — it persists in the same batch
  write.
- **Net-new capability** (not in `remainingManualItems`, not a change to existing scope) → keep it
  out of the ledger entirely. Either fold it into the fix round only if it is small and clearly
  in-theme (the round-gate decides), or route it to `/project-todo` and finish the ship on the
  verified scope — do not let unbounded new scope block completion.

## Step G — Return

Hand back to `phase-3-manual-finalize.md § Findings ledger + routing` with the full in-memory ledger
(`manual.items` + any interview-close findings) for routing — it names the `ExitPlanMode` for each
path (all-pass, inline-fix, or the round-level fix-plan gate in `fix-round.md`) and the batch-persist
that follows it. After the batch persist, rewrite the live signal without `waiting` (Step A) —
verification work resumes.
