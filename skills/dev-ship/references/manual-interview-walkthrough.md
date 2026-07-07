# Manual Walkthrough — item-by-item interview (dev-ship)

**When:** dev-ship PHASE 3 has `remainingManualItems` (from AGENT 2). This is the **collect-only**
walkthrough: each item is presented on its own, the user tests it live, and any non-pass verdict gets
its detail captured immediately — but nothing is fixed here. MANUAL = human perception/judgment,
real-credential auth, physical-device, or audio/screen-reader checks. Visual polish is not a MANUAL
_verification_ item — but the running app routinely sparks change requests, so this round also
accepts a **Tweak** outcome ("works, but I want it different"), and a closing interview surfaces
anything else the user noticed. None of that gets fixed during this walkthrough — see
`phase-3-manual-finalize.md § Findings ledger + routing` for what happens after.

**Philosophy.** This round is not only "do the requirements pass" — it is "now that you see it
running: is it right, and is it also good?" The interview close (Step F) exists specifically to catch
the second question, which a pass/fail checklist alone cannot ask.

## Step A — Board signal (amber: waiting on the user)

Before presenting the first item, flag the board amber (see `shared/DEVINFO.md § Active Feature
Signal`):

```bash
echo '{"skill":"verify","waiting":"manual-tests"}' | node ~/.claude/scripts/ship-checkpoint.js signal {feature}
```

The script resolves the main checkout itself, so this is safe even though cwd is inside the worktree
here. After Step F closes, rewrite it **without** `waiting` — verification work (routing to the
ledger) resumes.

## Step B — Present ONE item

Launch the app (Step 2's **App-launch rule** + hand-off rule in `phase-3-manual-finalize.md` apply —
match the launch command to the app **shell** and never substitute the browser-only dev server for a
Tauri/Electron desktop app; hand off, don't block on a readiness grep). On the **first** item only,
lead with the app URL/window note; then, one item at a time:

```
MANUAL TEST {i}/{M} — {title}
  steps:    1. {concrete action with data}  2. …
  data:     {field = value, …}
  expected: {observable outcome}
```

Wait for the user to actually run it before asking for a verdict — this is a live check, not a
read-through.

## Step C — Verdict for this item

One `AskUserQuestion` per item (not batched — the user asked for item-by-item testing):

- `Pass` (recommended)
- `Fail — doesn't work as specified`
- `Tweak — works, but I want it different`
- `Skip / Defer` — one immediate follow-up: which of the two, and why (reason for Skip; blocking
  external prereq for Defer — account, CORS-origin, API-token, third-party config).

## Step D — Immediate detail capture on Fail/Tweak (do NOT fix)

While the user is still looking at it, capture what the fix round will need — but stop there, do not
start fixing:

- **Observed vs expected** — what happened vs what should have happened.
- **SUBJECTIVE → clarify first (mandatory)** — "feels off", "looks wrong" is not actionable. Ask
  **one** clarifying `AskUserQuestion` (which element/target, expected vs seen, too much/too little,
  wrong position/timing/behaviour), then re-categorize the answer as TESTABLE or MEASURABLE per
  `shared/FEEDBACK-CATEGORIZATION.md`. Never leave a finding as SUBJECTIVE in the ledger.
- **Visual / DOM-observable item** → capture a Playwright screenshot **by default** (not on request)
  plus a one-line element pointer. The later fix round needs this signal to converge on the first
  try.

Record the category (TESTABLE / MEASURABLE) alongside the finding. Then move to the next item — the
fix routing lives in `phase-3-manual-finalize.md § Findings ledger + routing`, not here.

## Step E — Persist this item's verdict

After every single item (not batched at the end), upsert it into the checkpoint's ledger so a killed
session resumes mid-walkthrough rather than from the top:

```bash
echo '{"id":"MT-3","title":"...","verdict":"pass","category":"...","observed":"...","expected":"...","screenshot":"...","source":"checklist"}' \
  | node ~/.claude/scripts/ship-checkpoint.js item {feature} manual
```

Send only this one item — the script upserts it into `manual.items` by `id` (replacing an existing
entry with the same id, appending otherwise), so earlier verdicts are never lost to a partial resend.

Repeat Steps B–E for every remaining item.

## Step F — "Now that you see it running" interview close

After the last item, ask **one** open question (English source text, emit in the runtime language
per `shared/LANGUAGE.md`):

> "Now that you see it running: what should be different or better?"

Follow up on whatever the user raises — one clarifying question at a time, no pre-built dimension
checklist. SUBJECTIVE answers get the same mandatory clarify-then-recategorize as Step D. Stop the
moment the user has nothing more to add; do not fish for issues that aren't there.

- **In-theme adjustment** (design/behaviour change to something already built) → a new ledger
  finding, `verdict: "tweak"` (or `"fail"` if it turns out a criterion was genuinely not met),
  `source: "interview"`. Persist per Step E.
- **Net-new capability** (not in `remainingManualItems`, not a change to existing scope) → keep it
  out of the ledger entirely. Either fold it into the fix round only if it is small and clearly
  in-theme (the round-gate decides), or route it to `/project-todo` and finish the ship on the
  verified scope — do not let unbounded new scope block completion.

Patch `manual.interviewDone: true` once this closes.

## Step G — Return

Rewrite the live signal without `waiting` (Step A). Hand back to
`phase-3-manual-finalize.md § Findings ledger + routing` with the full ledger (`manual.items` +
any interview-close findings) for routing: empty ledger → regression-skip → completion; small
cosmetic-only ledger → inline fix; otherwise → the round-level fix-plan gate (`fix-round.md`).
