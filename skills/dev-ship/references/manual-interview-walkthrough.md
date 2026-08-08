# Manual Walkthrough — item-by-item interview (dev-ship)

**When:** dev-ship PHASE 3 has `remainingManualItems` (from AGENT 2). This is the **collect-only**
walkthrough: each item gets an overview, then a guided step-by-step walk, the user tests it live,
and any non-pass verdict gets its detail captured immediately — but nothing is fixed here. MANUAL =
human perception/judgment, real-credential auth, physical-device, audio/screen-reader checks, or
objectively-checkable items no automation vehicle can reach (`tooling-gap` — e.g. a Tauri shell
without WebDriver) (each carries a `manualReason` per `dev-verify/references/test-classification.md`
— an item without one is a contract violation and should not have reached this file). Items split
into **judgment-class** (`perception`, `audio` — the user's verdict is the evidence) and
**evidence-class** (`tooling-gap`, `real-credentials`, `physical-device`, `screen-reader` — a Pass
asks for user-supplied evidence; soft gate, see Step C). Visual polish is not a MANUAL
_verification_ item — but the running app routinely sparks change requests, so this round also
accepts a **Tweak** outcome ("works, but I want it different"), and a closing interview surfaces
anything else the user noticed. None of that gets fixed during this walkthrough — see
`phase-3-manual-finalize.md § Findings ledger + routing` for what happens after.

**Philosophy.** This round is not only "do the requirements pass" — it is "now that you see it
running: is it right, and is it also good?" It is also an **evidence-collection** device, not just a
readability one: a per-step walk means Claude knows exactly which step diverged and what the user
saw, instead of reconstructing a failure from a one-line `observed` field written from memory after
the fact. The interview close (Step F) exists specifically to catch the "is it also good" question,
which a pass/fail checklist alone cannot ask.

**Plan mode is not used here.** This walkthrough is an interactive collection round, not a thinking
phase that produces a plan (`shared/PLAN-MODE.md § Wanneer plan mode`) — there is no reviewable
artefact and no rejection path, so it never calls `EnterPlanMode`. Every write below (verdicts,
step observations, screenshots) lands the moment it's known; nothing is held in memory. This is also
why the fix-round gate (`fix-round.md § Round gate`) now always does its own fresh `EnterPlanMode`
instead of continuing a session opened here — see `shared/PLAN-MODE.md § Conditional entry`.

## Step A — Board signal (amber: waiting on the user)

Before presenting the first item, flag the board amber (see `shared/DEVINFO.md § Active Feature
Signal`):

```bash
echo '{"skill":"verify","waiting":"manual-tests"}' | node ~/.claude/scripts/ship-checkpoint.js signal {feature}
```

The script resolves the main checkout itself, so this is safe even though cwd is inside the worktree
here. After Step F closes, rewrite it **without** `waiting` — verification work (routing to the
ledger) resumes.

## Step A2 — Evidence pre-check sweep

For each MANUAL item with an objectively observable sub-aspect (a DOM state, a navigation, a visible
outcome — not the perception/audio/credential/device reason itself), collect evidence now. Skip this
sweep entirely for items that are purely perceptual (real credentials, audio, physical device,
screen reader — nothing here is objectively pre-checkable). This sweep never sets a verdict — it
only prepares evidence for the human to confirm against.

**Native-shell exception (check first)**: when the app under test is a native-shell app whose window
no automation vehicle can drive (Tauri/Electron without a working WebDriver), skip this sweep
entirely — no vehicle means no evidence. Evidence-class items then run in **user-evidence mode**:
the proof comes from the user in Step C instead of from this sweep. Same condition, other side:
when the harness cannot even *start* the app, `phase-3-manual-finalize.md § Step 2`'s
prepare-then-hand-over branch owns the launch.

**Primary — fresh Sonnet agent, not a fork.** The sweep's context (the item list, the app URL, the
launch state) is cheaply re-statable as paths and facts — it is not conversation-load-bearing the
way `shared/SKILL-PATTERNS.md § Fork Delegation`'s decision rule requires for a fork, and a fork
always inherits the parent (Opus) model regardless of a `model` override, which would waste it on
mechanical work. Dispatch one fresh `general-purpose` agent, `model: "sonnet"`: it exercises each
pre-checkable item via the `playwright-cli` daemon by default (scriptable pre-check — see
`shared/BROWSER-VEHICLES.md` for the full routing rule); Claude-in-Chrome only applies when an
item genuinely needs the real user session (real-credentials/session-dependent items — rare for a
pre-check sweep by definition) and a live browser is connected — see `shared/CLAUDE-IN-CHROME.md`
for that tool-loading ritual. Saves one screenshot per item to `.project/screenshots/`, and returns
ONLY:

```
EVIDENCE_SWEEP_START
{item id} | exercised: yes|no | {one-line observation} | {screenshot path or "-"}
… one line per pre-checkable item
EVIDENCE_SWEEP_END
```

End the turn after the dispatch and wake on the agent's task-notification. On wake, parse the block
and note each item's screenshot path (you'll attach it in Step B/D), then proceed to Step B.

**Fallback — inline sweep** (dispatch unavailable or errored): exercise each pre-checkable item
yourself via the same vehicles and capture one screenshot per item (note its path). Same output
discipline: keep only the per-item observation + path, don't carry raw page dumps forward.

## Step B — Item overview

Launch the app (Step 2's **App-launch rule** + hand-off rule in `phase-3-manual-finalize.md` apply —
match the launch command to the app **shell** and never substitute the browser-only dev server for a
Tauri/Electron desktop app; hand off, don't block on a readiness grep). On the **first** item only,
lead with the app URL/window note; then, one item at a time, an overview only — nothing actionable
yet:

```
MANUAL TEST {i}/{M} — {title}
expected: {observable outcome, verbatim}
{n} steps — I'll walk you through them one at a time.
Say "alles in één keer" if you'd rather do the whole item yourself and report back.
```

The user now knows what "correct" looks like **before** starting — today they only learn that at
the end, which is why "I did it wrong" and "it's broken" were indistinguishable. If the user picks
"alles in één keer," persist `guided: false` on this item now (Step E's upsert) and present the full
step block per § Typography below instead of walking it — a resume honours that choice for the rest
of the item.

## Step B2 — Guided walk

**Checkpoint rule.** A step is a **checkpoint** when it establishes state that later steps consume,
and Claude cannot verify that state itself. Testable straight from the item text at presentation
time: does step N name an identifier, path, or value that step N+1 uses? This is deliberately _not_
"how complex is the step" — Claude has no model of the user's familiarity, so that axis degrades to
always-on in practice. The checkpoint rule is per-step, not per-item: most items have one fragile
step and several trivial ones. The MT5 case that motivated this file is exactly this class — "set
`InpStepLineMaxSegments` to 3" establishes state that the following steps all depend on; if it never
took, everything after it measures nothing.

**Interaction — free text as the base, checkpoints as the placement rule:**

- Consecutive non-checkpoint steps ship in one message, plainly numbered, and are answered with
  free text ("reageer met `ok` zodra je klaar bent" or a one-line description of what happened).
- A checkpoint step ships alone and asks for the concrete value it established ("welke waarde staat
  er nu in het veld?") — not a yes/no.
- Escalate to `AskUserQuestion` only when a reply is genuinely ambiguous (neither clearly matches nor
  clearly contradicts what the step should have produced).

Rejected alternatives, and why: **one modal per step** is fatal — a screen-filling interruption per
step, each one hiding the very step text the user is answering about (`§ Typography` exists for
exactly this reason). **A per-item guided toggle keyed on `manualReason`** uses the wrong signal —
`manualReason` describes _why_ automation can't reach the item, not how fragile any one step inside
it is. A one-word free-text reply costs the user less than a modal and gives Claude _more_
information than a modal option ever could.

**Step observations are not verdicts.** The verdict-inference STOP rule below (Step C) governs
inferring a Pass/Fail/Tweak from unverified prose — it does not apply to per-step observations
gathered here, which are explicitly not verdicts (§ Step B3). Do not let this walk turn into a
second modal-heavy round by misapplying that rule to every step reply.

The `Kom er niet uit` exit (Step C) is reachable **mid-walk**, not only at the final verdict — that
is exactly where it was needed in the MT5 case: the user got stuck on step 2 of 6, long before any
verdict was due.

## Step B3 — Step log

Record an **observation** per step, never a verdict: `{n, action, outcome}`, plus the confirmed
value at a checkpoint step. On a divergence from what the step should have produced: `divergedAt: n`
with the observed value. Persist as `stepLog` on the ledger item via the same upsert Step E already
uses.

This is the mechanical meaning of "Claude and the user both have the full picture." Before this,
a 6-step item emitted N instructions and received ~2 bits back at the end; the fix round then
reconstructed the failure from an `observed` field the user wrote from memory, after the fact. Two
failure modes this removes: the **false Fail** (a precondition never held — step 3–6 measured
nothing, and the fix round would otherwise chase a bug that doesn't exist) and the **blind Fail**
(real, but unlocalized, so the fix round has to guess). `fix-round.md` consumes `divergedAt` and
`stepLog` directly when it exists.

## Step C — Verdict for this item

> **Skip the modal on a verified match.** If the user's own reply (or your own inspection of
> files/output the user pointed you at) already carries evidence against `expected` — verify it
> yourself now. **Match** → record `verdict: "pass"` with that evidence (`{path}` or `"in-chat"`),
> print one line naming what matched, and move straight to the next item — no `AskUserQuestion`.
> **Discrepancy** → show the user what you see vs `expected`; the user decides (fail / tweak / pass
> anyway — a pass-anyway keeps the evidence but notes the discrepancy in `observed`). **No evidence
> to check at all** (a bare free-text claim like "ja werkt het") → the STOP rule below applies in
> full. A completed guided walk with no divergence (§ Step B2/B3, all steps confirmed, `expected`
> observed at the final step) **is** such a verified match for **evidence-class** items — collapse
> the modal the same way. Judgment-class items (`perception`, `audio`) never collapse — see below.

> **STOP — Claude never produces a verdict; Claude always produces the route.** A verdict is a claim
> about the world the user is looking at — does it work, is it right, does this blocker also hit the
> other items. Only the user, or an artefact Claude can check against `expected`, can settle one — a
> free-text reply with nothing to check it against is not a verdict, call `AskUserQuestion` now, one
> call per item, even when the answer seems obvious. A route — which round, which tier, which file,
> park vs. offload — is Claude's own call and never needs this modal; `phase-3-manual-finalize.md`
> and `fix-round.md` name exactly which routes those are.

One `AskUserQuestion` per item (not batched — the user asked for item-by-item testing), used only
when the skip-condition above did not fire:

- `Pass (Recommended)`
- `Fail — doesn't work as specified`
- `Tweak — works, but I want it different` (a small, in-scope, tier-1 tweak is fixed in the ship
  itself; anything larger is offloaded to a TWEAK backlog card — the ship stays raw-functionality
  only for that finding and `/dev-tweak` picks it up later. See
  `phase-3-manual-finalize.md § Findings ledger + routing` for the exact band.)
- `Kom er niet uit / kan dit niet testen` — fires one immediate follow-up `AskUserQuestion`:
  - `Help me (Recommended)` — **not a verdict.** Grep the worktree for the identifier/control the
    stuck step named (the real failure this file was built to catch was an item-text defect: a step
    named a UI path that didn't exist as written), report where it actually surfaces, correct the
    item's `steps`/`expected` on the ledger item, then re-present the corrected step and continue
    the walk from there. **Capped at 2 durable `helpAttempts`** (increment, start at 1, never reset
    on resume — mirrors the `tweakAttempts` pattern in `phase-3-manual-finalize.md § Inline fix
now`) — the 3rd time this item reaches Step C, the modal drops the 4th option entirely (Pass /
    Fail / Skip-Defer only).
  - `Skip` / `Defer` — same follow-up question as before: which of the two, and why (reason for
    Skip; blocking external prereq for Defer — account, CORS-origin, API-token, third-party
    config). **Defer is for external blockers only** — "it is broken" is by definition a **Fail**,
    never a Defer.

> **STOP — a broken item is Claude's to catch too, not only the user's.** The item-text correction
> above sits under `Kom er niet uit`, so it only fires once the *user* is stuck. Two defects show up
> earlier than that, while you are presenting or checking the item, and both silently produce a
> wrong verdict if walked as written:
>
> - **The vehicle cannot cause the effect.** The step names a tool or control that does not produce
>   the thing under test, so the expected outcome would hold with or without the fix — the item is
>   unfalsifiable and a Pass on it means nothing.
> - **The observation is humanly impossible.** The step asks the user to see something they have no
>   way to identify (one row among hundreds, a change they never had a baseline for).
>
> This is a **route, not a verdict** — decide it yourself, do not open a modal. Say in one line what
> is broken and why, propose the corrected step, patch the ledger item's `steps`/`expected` via the
> Step E upsert, and record it as a `stepLog` entry with `divergedFromItemText: true` so the report
> can show the item was repaired rather than merely passed. Do not spend a `helpAttempt` on it —
> that counter is for the user being stuck, and this is not that.

**Systemic blocker discovered mid-item** — when the Skip/Defer reason is an environment/
infrastructure issue that will equally block every remaining un-walked item (not something specific
to this one item), don't silently carry that judgment into the rest of the ledger. Fold it into the
same `AskUserQuestion` that resolves the current item: name the still-untested items in that
question's option description (e.g. "also defers {N} remaining item(s): {titles}") so the user's one
answer is an informed batch decision, not an inferred one. Record each affected item's verdict/reason
identically once the answer comes back — this still counts as each item's own Step C resolution, not
a shortcut around it. This question is a verdict, not a route — it stays a modal.

**Evidence gate (soft, opt-in) — evidence-class items only, when the modal above did fire.** A
plain `Pass` from the user IS the verdict — do not follow it with a separate evidence request by
default. When the user answers `Pass` on an evidence-class item and neither Step A2 nor the guided
walk produced evidence for it, record `verdict: "pass"`, `evidence: "none"` immediately (**unproven**,
surfaced later in the routing summary/report) and move on to the next item.

Only ask for evidence when the item's own `manualReason` is `real-credentials` or `tooling-gap`
(verification genuinely impossible without it) — for `physical-device`/`screen-reader` a plain Pass
from the person at the device already IS the strongest available evidence; asking for a photo on
top of a verbal Pass is redundant, not rigorous.

Judgment-class items (`perception`, `audio`) never trigger the skip-condition above or this gate —
the verdict itself is the evidence, and only the user can supply it, so the modal always fires.

## Step D — Immediate detail capture on Fail/Tweak (do NOT fix)

While the user is still looking at it, capture what the fix round will need — but stop there, do not
start fixing:

- **Observed vs expected** — read straight from `stepLog[divergedAt]` when it's set (§ Step B3)
  rather than re-asking; that field already names the step and the concrete observation.
- **SUBJECTIVE → clarify first, unless `divergedAt` already names it.** > **STOP — never
  self-classify a subjective remark** _without a diverged step to anchor it_. "feels off", "looks
  wrong", or an unprompted aside like "and X also loads late" is not actionable as stated **when
  there is nothing in `stepLog` to check it against** — ask **one** clarifying `AskUserQuestion`
  (which element/target, expected vs seen, too much/too little, wrong position/timing/behaviour)
  before assigning TESTABLE or MEASURABLE per `shared/FEEDBACK-CATEGORIZATION.md`. **When
  `divergedAt` is set and its observation already differs from `expected`**, this is a route, not a
  verdict — classify it directly and say so in one line: `geclassificeerd als
{TESTABLE|MEASURABLE} — stap {n} gaf "{observed}" waar "{expected}" verwacht werd. Klopt dat niet,
zeg het.` A bare "feels off" with no diverged step still gets the clarifying modal — this bypass
  never widens beyond what `stepLog` actually recorded. Never leave a finding as SUBJECTIVE in the
  ledger.
- **Visual / DOM-observable item** → reuse the Step A2 evidence if it exists; otherwise capture the
  screenshot now (the app is still running — no write restriction applies here). The later fix round
  needs this signal to converge on the first try.
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
  (`phase-3-manual-finalize.md § Findings ledger + routing`), then the same upsert patches that
  item's own verdict to `"offloaded"` + `offload: "{card-name}"` so it doesn't dead-lock the ledger
  as a lingering fail — mechanics owned by `phase-3-manual-finalize.md § Offload flush`, not
  repeated here.

Record the category (TESTABLE / MEASURABLE) alongside the finding. Then move to the next item — the
fix routing lives in `phase-3-manual-finalize.md § Findings ledger + routing`, not here.

## Step E — Persist immediately

There is no write restriction in this round, so nothing waits: the moment a step observation, a
verdict, or a screenshot is known, write it. **The upsert is a full replace by `id`, not a merge**
(`ship-checkpoint.js item` sets `items[existingIndex] = item` outright) — every write for this item
must therefore carry its **complete accumulated record so far**, not just the field that just
changed, or earlier fields (a prior `stepLog` entry, `helpAttempts`, a screenshot path) are silently
overwritten with nothing. Keep the running record in your own working state as the item progresses
(id, title, verdict, category, manualReason, observed, expected, screenshot, evidence, source,
`stepLog`, `divergedAt`, `helpAttempts`, `guided`) and send that whole object on every write:

```bash
echo '[{"id":"MT-1","title":"...","verdict":"pass","category":"...","observed":"...","expected":"...","manualReason":"tooling-gap","screenshot":"...","evidence":".project/screenshots/mt-1.png","source":"checklist","stepLog":[{"n":1,"action":"...","outcome":"ok"}],"guided":true}]' \
  | node ~/.claude/scripts/ship-checkpoint.js item {feature} manual
```

`evidence` is `{path}` (user-supplied file, or the Step A2 capture), `"in-chat"` (pasted image —
cannot be persisted to disk; note the paste timestamp in `observed`), or `"none"` (unproven pass).
Repeat Steps B–E for every remaining item. A session death mid-interview loses only the fields
accrued since the last write for the item in flight — the resume path
(`phase-3-manual-finalize.md § Resume entry`) filters `remainingManualItems` down to items not yet
present in `manual.items`; a **resume landing mid-item** (present but incomplete) must first read the
existing record back from the checkpoint file before writing again, so a fresh write still carries
everything the interrupted session had already accrued.

Also update the checklist file (§ below) in the same step, so it never drifts from what's persisted.

## Checklist file — a second, durable reading surface

At the start of the round (before item 1), write all M items as a markdown checklist to
`.project/session/manual-{feature}.md`: one section per item, steps one per line, `expected` called
out, Step A2 evidence paths inline where they exist, and a status line updated in place as each
verdict lands (`- [x] MT-1 — pass`), plus the `stepLog` from Step B3. Mention the path once, at the
first item. This is a plain reading aid alongside the chat — not a substitute for the typography fix
below, and not an approval channel (there is no plan file in this round to confuse it with). No HTML
preview: `shared/HTML-PRESENT.md` already had one dead, unreferenced contract for dev-ship's define
phase (`skills/shared/references/preview-wireframe.html`, removed) and a second templated surface
risks the same fate; in the native-shell case (§ Step A2) it would also be nearly empty, since the
evidence sweep that would fill it never runs.

## Typography

Steps ship one per line with a blank line between them — no `steps:` label gutter that forces
continuation-wrapping. `expected` goes verbatim into the modal's question text at Step C, since the
modal covers the chat the instant it opens — that is the only place a user reliably sees it while
answering. The item block is always the **last** thing in a message; evidence prose or the
first-item app-URL note goes before it, never after, so the steps never scroll out of view.

## Step F — "Now that you see it running" interview close

After the last item, ask **one** open question (English source text, emit in the runtime language per
`shared/LANGUAGE.md`):

> "Now that you see it running: what should be different or better?"

Follow up on whatever the user raises — one clarifying question at a time, no pre-built dimension
checklist. SUBJECTIVE answers get the same mandatory clarify-then-recategorize as Step D. Stop the
moment the user has nothing more to add; do not fish for issues that aren't there.

- **In-theme adjustment** (design/behaviour change to something already built) → a new ledger
  finding, `verdict: "tweak"` (or `"fail"` if it turns out a criterion was genuinely not met),
  `source: "interview"`. Persist it via the same Step E upsert. It routes exactly like a Step C
  tweak, via the same ledger routing table (`phase-3-manual-finalize.md § Findings ledger +
routing`) — DEBUG-LADDER tier 1 + in-scope + within the cap fixes inline, everything else goes
  through the **Offload flush**'s own size-gate judgment. Nothing to pre-judge in this step.
- **Net-new capability** (not in `remainingManualItems`, not a change to existing scope) → keep it
  out of the ledger entirely. Either fold it into the fix round only if it is small and clearly
  in-theme (the round-gate decides), or route it to `/project-todo` and finish the ship on the
  verified scope — do not let unbounded new scope block completion. Net-new capability **is**
  `shared/TWEAK-DISCIPLINE.md § Size gate` criterion 1 by definition, so it never carries a `type
TWEAK` hint — plain inference applies, same as any size-gate-exceeding offload.

## Step G — Return

Hand back to `phase-3-manual-finalize.md § Findings ledger + routing` for routing — the ledger is
already fully persisted (Step E), so there is nothing left to batch-write. It names the round path
(all-pass, inline-fix, or the round-level fix-plan gate in `fix-round.md`, which now always does its
own fresh `EnterPlanMode`). After routing resolves, rewrite the live signal without `waiting` (Step
A) — verification work resumes.
