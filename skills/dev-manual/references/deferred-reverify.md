# Deferred re-verify (VERIFY card pickup)

Entry point when `/dev-manual {feature}` found a live `verify-{feature}` VERIFY card instead of an
open ship checkpoint (`SKILL.md § MANUAL 0`). This is a short standalone round — no ship pipeline,
no worktree, no `TaskCreate` phase list — for re-running one or more manual tests that were deferred
at ship time because of an external blocker. See `shared/BACKLOG.md § VERIFY cards` and
`§ Known-issue badges` for the full lifecycle this closes out.

## Step 1 — Locate the dossier

Read `.project/features/{feature}/feature.json`; if absent, glob
`.project/features/archive/*-{feature}/feature.json` (shipped features archive under a date-prefixed
dir name). Extract every open deferred item from `tests.knownIssues[]` where `verdict === "deferred"`.
For each, look up the matching `tests.checklist[]` entry (`status === "deferred"`, same `id`) for
`steps`/`expected` detail; when the checklist entry lacks that detail, fall back to the parent
requirement's `acceptance[]` text in `requirements[]`.

No open deferred items found (dossier drifted from the card, or a prior round already cleared them) →
report this and offer to clean up the stale card (skip to Step 5 with zero re-tested items — the card
still completes since nothing remains open).

This step runs **before** the gate below on purpose: the dossier holds the authoritative blocker
record the gate needs.

## Step 2 — Dependency gate

Widens `shared/TWEAK-DISCIPLINE.md § Card pickup`'s dependency check. Load the card's
`dependencies[]`: `node ~/.claude/scripts/backlog-load.js "$main_root" read-feature verify-{feature}`.

Gate on the **union** of two sources — either one alone runs vacuous:

- the card's `dependencies[]`
- every distinct `blocker` on the open deferred `knownIssues[]` entries from Step 1

`dependencies[]` is lossy by design (`shared/BACKLOG.md § VERIFY cards`: it holds only names that
exist in `backlog.json#features[]`, so a blocker that was unresolvable — or already archived — at
card-creation time never lands there). `knownIssues[].blocker` is the durable record, and Step 4's
own repoint rule already treats the two as a dual-write pair.

For any union member not `shipped`/`DONE` (check via the same profile on that name) — and for a
blocker name that matches no card at all, which usually means an **environmental** blocker such as a
shared runtime, data directory, or device this round needs exclusively — warn: _"blocker `{dep}` is
not resolved — the deferred test will likely still be blocked."_ One `AskUserQuestion`: proceed
anyway (the blocker may be resolved in a way the backlog doesn't reflect, e.g. a manual workaround) /
abort. No warning when the union is empty or every member already resolved.

## Step 3 — Run

Launch the app for what the item needs: resolve the project's own run command (a run skill, the
`CLAUDE.md` Commands table, or `package.json#scripts`) and match it to the item — native-shell vs web
vs CLI. When a deferred item's `reason` names a limitation a dev server can't clear (e.g.
LAN/multi-device access), prefer a production build over the dev server if the project has one — that
is very often exactly why the item was deferred.

**The app may already be running** — often it is, and that is why this round was invoked now. Never
hand over item 1 on an unverified process:

- Confirm the running build from something the app itself renders (a version or build stamp, a
  visible fingerprint of the change). A file comparison is evidence about the **disk**, never about
  the **process** — a compiled, desktop, or native app does not reload a replaced artifact.
- Stale → rebuild, redeploy to every location the runtime actually reads, and reload BEFORE item 1.
  Say which signal you used.
- Teardown at the end kills only what you launched yourself; leave a pre-existing instance running.

(Launch-shape nuance for native-shell/backend targets: `phase-3-manual-finalize.md
§ App-launch rule`.)

**Order the items causally, not as recorded**: when one item's setup produces another's
precondition, run the producer first. State the reorder and its reason to the user before item 1 —
the recorded order is a ledger, not a script.

Present each item in this format:

```
MANUAL TEST {i}/{N} — {title}
  steps:    1. {concrete action}  2. …
  expected: {observable outcome}
```

One `AskUserQuestion` per item (not batched):

- `Pass (Recommended)`
- `Fail — doesn't work as specified`
- `Still blocked` — the external blocker hasn't actually cleared; ask for a one-line reason update if
  it differs from the recorded one.

**Persist each verdict the moment it lands**, before presenting the next item: write it to the
matching `feature.json#tests.checklist[]` entry as `retestVerdict: "pass"|"fail"|"still-blocked"`
plus `retestedAt`. This is the round's ledger, not the outcome write — Step 4 still owns the real
mutations. A killed session then resumes at the first item carrying no `retestVerdict`, with nothing
lost beyond the single write in flight (the same discipline as `phase-3-manual-finalize.md`
§ Findings ledger + routing). On re-entry, skip every item that already carries one and say which
you skipped.

When done, kill the process(es) you launched **and restore any shared deployment/db state the test
mutated** — seeded rows, advanced round/cursor pointers, score writes. A deferred test that drives a
stateful backend (Convex, a DB) almost always writes shared state; leaving it behind means a later
re-pickup — or the real event — inherits the test data. Note what you seed as you go so the restore
is a checklist, not a reconstruction.

## Step 4 — Outcome writes (one batch, after every item carries a verdict)

Collect every item's verdict, then write once:

- **Pass** — in `feature.json#tests.checklist[]`: `status: "pass"`, `retestedAt: "<YYYY-MM-DD>"`,
  remove `deferredReason`. Remove the matching entry from `feature.json#tests.knownIssues[]` **and**
  from wherever the feature's backlog entry currently lives — `backlog.json#features[]` if still
  there, otherwise `archive/backlog-archive.json#archived[]`.
- **Fail** — a deferred test failing on re-test is a real regression, never silently closed. Invoke
  `/project-todo` with one sentence: `"{title} fails on re-test → {expected}, type BUG, depends on
{feature}, origin agent via /dev-manual, re-tested from the verify-{feature} card"`. Set the matching `tests.checklist[]` entry to
  `status: "fail"` + `retestedAt` + the new BUG card's name (never leave it on `"deferred"` — the
  item is no longer deferred, and Pass/Still-blocked both update it). Remove the deferred
  `knownIssues[]` entry (the new BUG card supersedes it) and note the BUG card's name against this
  item in the VERIFY card's final summary.
- **Still blocked** — leave the checklist entry and `knownIssues[]` entry untouched; update `reason`
  only if the user gave a new one. **Different blocker than recorded** (the original cleared or was
  never the real cause, but a newly-found _external_ limitation still blocks the test — a
  feature-code fault is the **Fail** branch above instead): invoke `/project-todo` for the new
  blocker (one sentence, `type TWEAK`, `depends on {feature}`, `origin agent via /dev-manual`), then repoint **both**
  `knownIssues[].blocker` (feature.json) and the `verify-{feature}` card's `dependencies[]` to the
  new card's name, so a later pickup gates on the right blocker. Still no card write (Step 5) — the
  VERIFY card stays open.

After applying all three: if no `knownIssues[]` entries with `verdict: "deferred"` remain in
feature.json, clear `tests.hasDeferred` there; do the same on the backlog/archive entry's
`hasDeferred` and `knownIssues[]`. Clear the round-ledger `retestVerdict` fields in the same batch —
they exist only to survive an interrupted round.

## Step 5 — Card completion

Only when **no** deferred items remain open (every item this round was Pass or Fail, none Still
blocked) — mirror `shared/TWEAK-DISCIPLINE.md § Card-mode completion write`: flip the
`verify-{feature}` card's `shipped: true` + `shippedAt` (today) + `shippedSha` (`git rev-parse HEAD`)

- `summary` (one line: what re-tested clean, what became a BUG card), move it from
  `backlog.json#features[]` to `archive/backlog-archive.json#archived[]`, and dual-write
  `project.json#features[]` to match (`shared/BACKLOG.md § Parallel sync`).

**VERIFY cards are frequently absent from `project.json#features[]`** — `completion-sync.js` creates
them straight into the backlog and never mirrors them. Absent there → there is nothing to
dual-write; say so in the report rather than inventing an entry in the active feature list.
Present → update it.

Immediately after, run `shared/BACKLOG.md § Archive-move invariant` on the `verify-{feature}` card
— confirm absent from `backlog.json#features[]` and present in the archive with all four shipped
fields, self-heal if not. Do not report the VERIFY card as shipped until this holds.

If any item is Still blocked, make **no** card write — the card stays `TODO` on the backlog exactly
as-is, ready for a later `/dev-manual {feature}` re-pickup once the blocker clears.

## Step 6 — Report

Short ASCII summary: which items passed (retested clean), which failed (→ BUG card name), which are
still blocked (→ reason), and whether the VERIFY card shipped or remains open. Optionally record 0-1
learning through the `shared/LEARNING-WRITE.md` § Writer Append Protocol filter — only when a Fail's
root cause has value beyond this spot.
