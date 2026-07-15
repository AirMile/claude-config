# Manual Walkthrough — item-by-item interview (dev-ship)

**When:** dev-ship PHASE 3 has `remainingManualItems` (from AGENT 2). This is the **collect-only**
walkthrough: each item is presented on its own, the user tests it live, and any non-pass verdict gets
its detail captured immediately — but nothing is fixed here. MANUAL = human perception/judgment,
real-credential auth, physical-device, audio/screen-reader checks, or objectively-checkable items no
automation vehicle can reach (`tooling-gap` — e.g. a Tauri shell without WebDriver) (each carries a
`manualReason` per `dev-verify/references/test-classification.md` — an item without one is a contract
violation and should not have reached this file). Items split into **judgment-class** (`perception`,
`audio` — the user's verdict is the evidence) and **evidence-class** (`tooling-gap`,
`real-credentials`, `physical-device`, `screen-reader` — a Pass asks for user-supplied evidence; soft
gate, see Step C). Visual polish is not a MANUAL _verification_ item — but the
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
outcome — not the perception/audio/credential/device reason itself), collect evidence now, before plan
mode. Skip this sweep entirely for items that are purely perceptual (real credentials, audio, physical
device, screen reader — nothing here is objectively pre-checkable). This sweep never sets a verdict —
it only prepares evidence for the human to confirm against.

**Native-shell exception (check first)**: when the app under test is a native-shell app whose window
no automation vehicle can drive (Tauri/Electron without a working WebDriver), skip this sweep
entirely — no vehicle means no evidence, in a fork or otherwise. Evidence-class items then run in
**user-evidence mode**: the proof comes from the user in Step C instead of from this sweep.

**Primary — fork dispatch** (`shared/SKILL-PATTERNS.md § Fork Delegation`). Dispatch one fork (`Agent`
tool, `subagent_type: "fork"`): it inherits this session's context — the items, the app URL, the
launch state — so the prompt states only the task, no context re-statement. The fork exercises each
pre-checkable item via Claude-in-Chrome (preferred — see `shared/CLAUDE-IN-CHROME.md` for the
tool-loading ritual and the Chrome/Playwright decision rule) or the `playwright-cli` daemon (fallback,
no live browser connected), saves one screenshot per item to `.project/screenshots/`, and returns
ONLY:

```
EVIDENCE_SWEEP_START
{item id} | exercised: yes|no | {one-line observation} | {screenshot path or "-"}
… one line per pre-checkable item
EVIDENCE_SWEEP_END
```

End the turn after the dispatch and wake on the fork's task-notification. Do **not** touch the browser
while the fork runs — it shares the same Chrome session. On wake, parse the block and note each
item's screenshot path (you'll attach it in Step B/D), then proceed to Step A3.

**Fallback — inline sweep** (fork dispatch unavailable or errored): exercise each pre-checkable item
yourself via the same vehicles and capture one screenshot per item (note its path). Same output
discipline: keep only the per-item observation + path, don't carry raw page dumps forward.

## Step A3 — Enter plan mode

> **STOP — before presenting item 1.** Call `EnterPlanMode` now per `shared/PLAN-MODE.md` Entry
> (skip only if already in plan mode). Do not go straight from Step A2 to presenting item 1 —
> `AskUserQuestion` works identically in or out of plan mode, so nothing else will catch a skipped
> entry here.

From here through the end of this walkthrough — and into the round gate if the ledger routes there
— all `.project/` writes are blocked. Verdicts and ledger items are collected **in memory** (Step E) and written in one
batch immediately after the matching `ExitPlanMode` (`phase-3-manual-finalize.md § Findings ledger +
routing` names the exact exit point per path). **Trade-off, accepted**: a session death mid-interview
loses that session's in-memory verdicts — the resume filters `remainingManualItems` down to items not
yet present in the persisted `manual.items` (`phase-3-manual-finalize.md § Resume entry`), so nothing
is lost except having to re-ask those specific items.

**If a mid-walkthrough discovery needs its own approval** (e.g. the test environment itself must
change) and plan mode gets entered/exited for that unrelated purpose: the walkthrough's original
write-protection window has already lapsed. Do not try to re-enter plan mode to "resume" it —
persist the ledger directly via the `ship-checkpoint.js item` batch-write (§ Step E) once the
walkthrough itself concludes, without waiting on a second `ExitPlanMode` call.

**If plan mode ends externally mid-walkthrough** (e.g. the session's permission mode switches to
bypass) rather than via this file's own `ExitPlanMode` calls: a later `ExitPlanMode` (here or in
`fix-round.md`) will error "not in plan mode." Treat that error as the plan already being implicitly
accepted — present the pending plan/ledger via one `AskUserQuestion` instead (accept = recommended
option), then continue exactly as if `ExitPlanMode` had returned an accept. Do not re-enter plan mode
to "recover" the write-blocking — the in-memory ledger collected so far is still valid; batch-persist
it at the same point the matching `ExitPlanMode` normally would.

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

For an evidence-class item with no Step A2 evidence, append one pre-chewed evidence step to `steps`,
naming the concrete end state to capture — e.g. `3. take a screenshot showing {the element/state
from expected}` (a photo of the device for `physical-device`; pasted command/log output where a
screenshot fits less).

If Step A2 produced evidence for this item, lead with it: "already exercised — here's the evidence
(screenshot); confirm, or test it yourself." Otherwise wait for the user to actually run it before
asking for a verdict — this is a live check, not a read-through.

## Step C — Verdict for this item

> **STOP — do not infer a verdict from prose.** A user's free-text reply ("ja werkt het") is not a
> verdict — call `AskUserQuestion` now, one call per item, even when the answer seems obvious.

One `AskUserQuestion` per item (not batched — the user asked for item-by-item testing):

- `Pass (Recommended)`
- `Fail — doesn't work as specified`
- `Tweak — works, but I want it different`
- `Skip / Defer` — one immediate follow-up: which of the two, and why (reason for Skip; blocking
  external prereq for Defer — account, CORS-origin, API-token, third-party config). **Defer is for
  external blockers only** — "it is broken" is by definition a **Fail**, never a Defer.

**Evidence gate (soft) — evidence-class items only.** When the user answers `Pass` on an
evidence-class item and Step A2 produced no evidence for it:

0. **If the user's own reply already carries the evidence** (an attached screenshot, a pasted
   image, or a description precise enough to verify against `expected` — common when a user
   narrates what they saw instead of clicking an option, including a rejected tool-call followed
   by a plain message) → skip straight to step 2 using that evidence; do not ask again.
1. Otherwise, ask for the evidence named in Step B: drag the screenshot file into the chat (a path
   you can `Read`) or paste the image directly.
2. Verify it yourself against the item's `expected` — this is the factual check the automation could
   not run. Match → record `verdict: "pass"` with the evidence (`{path}`, or `"in-chat"` for a
   pasted image — **always set this field**, never leave it unset). Discrepancy → show the user
   what you see vs `expected`; the user decides (fail / tweak / pass anyway — a pass-anyway keeps
   the evidence but notes the discrepancy in `observed`).
3. User declines or cannot provide evidence → Pass still stands (**soft gate**), recorded with
   `evidence: "none"` — it surfaces as **unproven** in the routing summary and the final report.

Judgment-class items (`perception`, `audio`) never trigger this gate — the verdict itself is the
evidence.

## Step D — Immediate detail capture on Fail/Tweak (do NOT fix)

While the user is still looking at it, capture what the fix round will need — but stop there, do not
start fixing:

- **Observed vs expected** — what happened vs what should have happened.
- **SUBJECTIVE → clarify first.** > **STOP — never self-classify a subjective remark.** "feels off",
  "looks wrong", or an unprompted aside like "and X also loads late" is not actionable as stated. Ask
  **one** clarifying `AskUserQuestion` (which element/target, expected vs seen, too much/too little,
  wrong position/timing/behaviour) before assigning TESTABLE or MEASURABLE per
  `shared/FEEDBACK-CATEGORIZATION.md`. Never leave a finding as SUBJECTIVE in the ledger, and never
  classify it solo.
- **Visual / DOM-observable item** → reuse the Step A2 evidence if it exists; otherwise note the
  element pointer now and capture the screenshot right after plan-mode exit (the app is still
  running) — screenshot capture is a disk write, blocked until then. The later fix round needs this
  signal to converge on the first try.
- **On Fail** — capture objective failure evidence now, while it still reproduces: console errors,
  the failing network response, the screenshot already specified above. The fix round consumes it,
  and after repeated failed rounds the debug round does (`fix-round.md § Re-check` ladder →
  `references/debug-round.md`). Still collect-only — do not fix anything here.
- **Split off out-of-item findings** — apply `shared/FEEDBACK-CATEGORIZATION.md § Scope check`. If
  what's reported goes beyond this item's own `expected` text, don't fold it into this item's
  evidence: judge this item on the on-topic remainder, and record the off-topic part as a new ledger
  item now (next sequential `MT-N` id) via the same `ship-checkpoint.js item {feature} manual`
  upsert Step E already uses — in-scope stays a blocking fail, out-of-scope routes to
  `/project-todo` per the Fail-never-to-todo policy's net-new-capability carve-out
  (`phase-3-manual-finalize.md § Findings ledger + routing`).

Record the category (TESTABLE / MEASURABLE) alongside the finding. Then move to the next item — the
fix routing lives in `phase-3-manual-finalize.md § Findings ledger + routing`, not here.

## Step E — Collect (in memory)

Keep each item's full record (id, title, verdict, category, manualReason, observed, expected,
screenshot, evidence, source) in memory as you go — do **not** write to the checkpoint yet; plan mode
blocks it. `evidence` is `{path}` (user-supplied file, or the Step A2 capture), `"in-chat"` (pasted
image — cannot be persisted to disk; note the paste timestamp in `observed`), or `"none"` (unproven
pass). Repeat Steps B–E for every remaining item.

**Batch persist (after plan-mode exit).** The exact `ExitPlanMode` you follow is named in
`phase-3-manual-finalize.md § Findings ledger + routing` (it differs by which path the ledger takes).
Immediately after that exit, in one call:

```bash
echo '[{"id":"MT-1","title":"...","verdict":"pass","category":"...","observed":"...","expected":"...","manualReason":"tooling-gap","screenshot":"...","evidence":".project/screenshots/mt-1.png","source":"checklist"}, {"id":"MT-2", ...}]' \
  | node ~/.claude/scripts/ship-checkpoint.js item {feature} manual
```

Send the full in-memory array — the script upserts each element into `manual.items` by `id` in one
atomic write. Then patch `manual.interviewDone: true`, and capture any screenshots you deferred in
Step D (the app is still running). User-supplied evidence files: copy them into
`.project/screenshots/` now (a disk write — only possible after the plan-mode exit) and store that
path as the item's `evidence`.

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
