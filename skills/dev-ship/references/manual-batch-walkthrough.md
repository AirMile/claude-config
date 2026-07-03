# Manual Walkthrough — batched (dev-ship)

**When:** dev-ship PHASE 3 has `remainingManualItems` (from AGENT 2). This is the **token-lean**
walkthrough used by the auto-mode ship: the whole checklist is presented **once**, judged in **one**
`AskUserQuestion` round, and screenshots are taken only on demand — instead of the standalone
per-item loop (`dev-ship/references/dev-verify/references/manual-walkthrough.md`). MANUAL = human perception/judgment,
real-credential auth, physical-device, or audio/screen-reader checks — not visual polish.

## Step A — Board signal (amber: waiting on the user)

Before presenting, flag the board amber (see `shared/DEVINFO.md § Active Feature Signal`):

```bash
echo '{"feature":"{feature}","skill":"verify","startedAt":"{ISO}","waiting":"manual-tests"}' > .project/session/active-{feature}.json
```

After the round is answered, rewrite it **without** `waiting` — verification work resumes.

## Step B — Present the whole checklist ONCE

Launch the app (Step 2's hand-off rule in `phase-3-manual-finalize.md` applies — hand off, don't
block on a readiness grep). Then print the **entire** checklist in one message: the dev-server URL
once at the top, then every item. **No per-item Playwright smoke** — offer screenshots only on
demand (Step D).

```
Open {devServerUrl}, then run these {M} checks:

MANUAL TEST 1 — {title}
  steps:    1. {concrete action with data}  2. …
  data:     {field = value, …}
  expected: {observable outcome}

MANUAL TEST 2 — {title}
  …
```

## Step C — One judgement round (batched `AskUserQuestion`)

Ask the user to mark only what did **not** pass. Batch by item count (AskUserQuestion allows ≤ 4
questions per call, ≤ 4 options per question, `multiSelect: true`):

- **M ≤ 3** → one question, `multiSelect: true`, options = `"FAILED / needs follow-up: {title}"`
  for each item + `"All passed"`. Selecting nothing but "All passed" ⇒ every item Pass.
- **4 ≤ M ≤ 12** → chunk into groups of 3 items → one question per chunk (≤ 4 questions in the
  single call), each `multiSelect: true`, options = the 3 items + `"None of these failed"`.
- **M > 12** (rare) → two calls of the above, or fall back to the per-item
  `dev-ship/references/dev-verify/references/manual-walkthrough.md`.

"All passed" / "None of these failed" is the recommended (first) option in each question.

## Step D — Follow-up only for flagged items

For the items the user flagged (if any), ask **one** follow-up round (a single `AskUserQuestion`,
≤ 4 flagged items per call) to classify each and capture one line of detail:

- **Fail** → "what went wrong?" (one line — the observed vs expected). Offer to capture a Playwright
  screenshot as diagnosis if the item is DOM-observable.
- **Skip** → note reason ("not testing, accept as-is"). Does **not** block finalize.
- **Defer** → which external prereq blocks it (account, CORS-origin, API-token, third-party
  config). Stays open for re-test; does **not** block finalize.

Record all outcomes. Nothing flagged ⇒ all Pass → return to `phase-3-manual-finalize.md` Step 3
(completion + finalize). Any **Fail** ⇒ the FAIL-routing block in `phase-3-manual-finalize.md`
Step 2 decides what happens next (background fix agent / interactive debug / stop).
