# PHASE 4 — Visual review + Finalize/merge (MAIN CHAT)

The second (and last) human touchpoint: the user reviews the **live page** — build + copy + fixes
together — then design-ship merges. Inputs: `build`, `content` (may be degraded), `check` from the
workflow return, `SHIP_PLAN`, `SHIP_CONTEXT`.

## Step 1 — Live signal (waiting for review)

The review is user input — flag it amber on the board (see `shared/DEVINFO.md § Active Feature
Signal`):

```bash
echo '{"skill":"ship","waiting":"review"}' | node ~/.claude/scripts/ship-checkpoint.js signal {target}
```

## Step 2 — Live preview

1. **Check for a known serve method first.** Scan `build.autoDecisions[]` and
   `check.autoDecisions[]` (already in hand from the PHASE 1-3 return) for any note about how
   the app was actually served/verified (e.g. "dev mode blocked, used production build"). If
   found, use that same method below instead of defaulting to `npm run dev`.
2. Probe `build.smokeUrl`; if the dev server is down, start it in the background **in the
   worktree** — chain the `cd` with a verification in the SAME command
   (`cd {worktreePath} && pwd && git branch --show-current && npm run dev`) so a cwd/branch
   mismatch is caught immediately instead of discovered later. Wait until it responds, remember
   the PID.
3. **Confirm an actual render before presenting anything** — one lightweight check (`curl` for
   a 200 + a known string from the built page, or a headless Playwright navigate + wait)
   against the started server. Stuck on a loading state, a CSP/console error, or stale content
   (e.g. an old copy string AGENT 2 should have replaced) → this is a preview-infrastructure
   failure, not a project bug: retry ONCE via `npm run build && npm run start` on the same
   `pwd`-verified worktree path. Still failing after the retry → skip to Step 4 but replace the
   "Ship review" gate with a smaller one: report the failure plainly and ask only "Fix and
   retry the preview" vs "Proceed without a live preview" — never silently open a broken page.
4. Present the URL via `.claude/skills/shared/HTML-PRESENT.md` (an `http://` target — auto-opens
   the real, interactive page **in the user's own browser**). Set `$PREVIEW_OPENED = true` on
   success. No URL at all (smoke SKIPPED and no route) → skip, note it in the review block.

   **This step does not drive the browser** beyond the render-confirmation in step 3. The user
   reviews the live page themselves; Step 4's gate is the interaction surface, not Claude
   clicking through it. If extra automated confidence is genuinely wanted beyond AGENT 3's
   check-audit, route it per `shared/BROWSER-VEHICLES.md` — a scriptable spot-check goes to the
   Playwright CLI daemon; **never Claude-in-Chrome here** (no real user session is at stake, and
   it is the highest-flake vehicle for this exact situation). If the page renders but appears
   non-interactive in a way step 3's check didn't catch (console errors, unresponsive
   controls), record it as a review-block finding rather than opening an ad hoc debugging
   session in the main chat — route anything outside this feature's own diff to
   `/project-todo`.

## Step 3 — Review block

Print one combined block (runtime language per `CLAUDE.md → Language`):

```
SHIP REVIEW: {target} ({targetType})
════════════════════════════════════════════════
Direction:  {$DESIGN_DIRECTION.name}
Build:      {filesCreated} file(s) · {tokensUsed} token refs · smoke {smoke}
Copy:       {itemsApplied} applied, {itemsKept} kept {· DEGRADED: placeholder copy — {failedAt}}
Check:      {findingsResolved}/{findingsTotal} resolved · {checksRun}
Critical:   {criticalRemaining list, or "none"}
Ready:      {readyForDone → "ja" | "nee — zie Critical"}
════════════════════════════════════════════════

### Copy review ({N} items)
| Element | Category | Before | After |
| ...     | ...      | ...    | ...   |
```

The copy table comes from `content.copyTable` (truncate to the first 25 rows; mention the rest).
When content was degraded: show the degradation instead of the table and make "Copy bijstellen"
the Recommended option below.

## Step 4 — Review gate

```yaml
header: "Ship review"
question: "De pagina staat live in je browser. Hoe verder met {target}?"
options:
  - label: "Ship it (Recommended)"
    description: "Mergen naar main + backlog op DONE/shipped."
  - label: "Copy bijstellen"
    description: "Toon/taal aanpassen en copy regenereren — pagina blijft staan."
  - label: "Houd worktree open"
    description: "Zelf verder werken; mergen later via /core-finalize {target}."
  - label: "Afbreken"
    description: "Stoppen zonder merge; worktree blijft intact voor inspectie."
multiSelect: false
```

- **Ship it** → Step 5.
- **Copy bijstellen** → one follow-up `AskUserQuestion` (tone options per
  `.claude/skills/design-ship/references/design-content/references/review-gate.md` §4.5: conciser / formeler / vriendelijker / andere
  taal, plus Other for free-form), update `$BRIEF`, rewrite the live signal to
  `{"skill":"content"}` (no `waiting` — work resumes), re-spawn AGENT 2 per
  `agent-content.md § Regenerate loop`, **re-read `.project/`**, refresh the browser preview, then
  loop back to Step 3 via Step 1 (the `waiting:"review"` write). Cap: 3 rounds — after the third,
  re-present this gate without the regenerate option.
- **Houd worktree open** → stop the Step 2 dev server only if we started it, print
  `💡 Run /core-finalize {target} when ready`, skip to PHASE 5 (no merge; cleanup removes the
  shipping marker + live signal).
- **Afbreken** → same as "Houd worktree open" but report the run as aborted.

**readyForDone guard:** when `check.readyForDone === false`, "Ship it" stays available but its
description becomes "Mergen ondanks {N} openstaande CRITICAL finding(s)" and it is **not** marked
Recommended — "Houd worktree open" is.

## Step 5 — Finalize (merge) + backlog completion

0. **Live signal** — the review is answered; rewrite without `waiting` (merge work resumes):
   `echo '{"skill":"ship"}' | node ~/.claude/scripts/ship-checkpoint.js signal {target}`
1. **Dev-server cwd pre-check** — run the copied Build route Step 12.1 check (lsof on the
   worktree); with `$PREVIEW_OPENED = true` the "Keep running" recommendation flips as documented
   there. A server we started in Step 2: kill it now regardless.
2. **Merge** — run the copied Build route Step 12.2 dispatch table (`TEAM_MODE` + PR state →
   `shared/FINALIZE.md` mode). On a Halt row (open PR / team no-PR): print the halt message, skip
   step 3's shipped-fields (the merge did not happen), still do the cleanup in step 4, and report
   the halt in PHASE 5. `FINALIZE.md`'s Solo-Merge step 1 calls `ExitWorktree(action: keep)` — this
   always no-ops here (design-ship's main chat only ever `cd`s into the worktree via Bash, never via
   `EnterWorktree`); treat the printed no-op as expected, not a break. Skip `FINALIZE.md`'s own
   Cleanup-Procedure backlog-sync sub-step — step 3 below supersedes it with the fuller
   shipped-field set.
3. **Backlog completion** (after a successful merge; per `shared/BACKLOG.md → Lifecycle Protocol
→ Write`; this supersedes `FINALIZE.md`'s own backlog-sync dispatch — do not let both run) — find
the entry by `name`:
   - PAGE: `status: "DONE"`, `shipped: true`, `shippedAt: "{YYYY-MM-DD}"`,
     `shippedSha: "{merge SHA}"`, `lastCheckedSha: "{merge SHA}"`, remove `stage` and
     `transition` (including `"shipping"`). `contentStatus: "filled"` is already set by AGENT 2.
   - COMPONENT: keep `status: "DOING"`, set `lastCheckedSha`, remove `transition` — components
     ship with their consuming page (stock design-check semantics).
   - `data.updated` → today. Sync `project.json#features[]` if status changed.
4. **Cleanup** — `node ~/.claude/scripts/ship-checkpoint.js signal-clear {target}`. Session-reorientation guard: if
   `pwd` is inside the removed worktree, `cd {main-repo-path}` (the FINALIZE cleanup normally
   handles this — verify).

Continue to PHASE 5 (report).
