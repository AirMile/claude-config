# PHASE 4: Completion

### 4.1 Update DevInfo

Update `.project/session/devinfo.json`:

```json
{
  "handoff": {
    "from": "design-convert",
    "to": null,
    "data": {
      "inputType": "screenshot | url | image | figma-mcp | figma-rest | figma-make",
      "mode": "copy | inspiration | sketch",
      "pageFile": "[page file path]",
      "components": ["[list of created component files]"],
      "verificationRounds": "[computed — see §4.4, do not hand-write]",
      "refineRounds": "[from PHASE 3.5's REFINE ROUNDS record; absent when 3.5 did not run]",
      "preserved": "[$PRESERVE paths from 0.6b, or omitted when empty]",
      "finalMatchQuality": "[from the last ROUND ASSESSMENT block in convert-verification-loop.md §3.2 — do not hand-write; if no assessment block exists, this field is absent, not guessed]",
      "framework": "[detected framework]",
      "theme": "[.project/project.json#theme or null]",
      "scope": "page | component | patch | audit",
      "auditFixes": "[N — only present when scope = audit]",
      "interactions": "[N implemented — only present when $INTERACTION_SPEC was set]"
    }
  }
}
```

**Handoff cleanup** (if session started via PHASE 0.2 build-incomplete handoff): set `devinfo.handoff = null`.

**TokenDrift cleanup** (if page scope): read `devinfo.tokenDrift.affectedFeatures` → remove the current page name if present → if list is empty: `tokenDrift.resolved = true`. Write back.

### 4.2 Backlog Completion Sync

**Deferred entry (from Phase 0.5):** if `$NEW_BACKLOG_ENTRY` is set, append it to `data.features[]` and set `data.updated` to today **before** the match/update below. The just-inserted entry will then be found by the match and immediately flipped to its built status (`DOING`).

Read `.project/backlog.json` per shared/BACKLOG.md. Find feature where `f.name === $CONVERT_TARGET`.

If no match: skip silently.

**Section completeness.** Read `design.pages[{name}].sectionState[]` (or `.components[{name}]`).
Absent/empty → `$SECTION_COMPLETE = true` unconditionally (a pre-`sectionState` page, or a run that
never went through 0.4c — treat as whole-page, matching pre-partial-build behavior exactly). Present →
`$SECTION_COMPLETE` is computed per branch below, against whichever field that branch advances.

If match found, branch on entity type:

**Page scope** (`$CONVERT_TARGET` resolves to a page):

- **Build branch** (`$ASPECT` unset, or `"build"` — i.e. every path except PHASE 2c):
  - `$SECTION_COMPLETE` = every `sectionState[]` entry has `build: "built"` → `stage: "built"`.
    Otherwise → `stage: "building"` (reuses the value already used for component scope below — no
    new vocabulary; a section-scoped build genuinely isn't finished yet).
  - Set `status: "DOING"`, `data.updated` to today — same as the Build route (`build-completion-sync.md` 10d). A fully-built page lands at TO CHECK; `/design-ship` is the only gate to `DONE` for pages (build and convert alike). Convert's visual verification loop is a complementary pre-check, not a substitute for the runtime audit (a11y/responsive/darkmode/perf).
  - Remove `transition` and `completedAt` fields if present. Remove `contentStatus` **only when
    `$SECTION_COMPLETE`** — a full rebuild invalidates prior content review and the "Fill content"
    board button/badge should reappear, but a section-scoped build that leaves other,
    already-content-filled sections untouched must not silently reset their `contentStatus`.
  - Write back via Edit
  - **Audit re-entry:** this applies unchanged when `$SCOPE = audit` — an audit that patches an already-`DONE` page correctly moves it back to TO CHECK, since markup changed and a runtime re-check is warranted.
- **Content branch** (`$ASPECT = "content"`, PHASE 2c):
  - `$SECTION_COMPLETE` = every `sectionState[]` entry touched by `$BUILD_SECTIONS` this run, together
    with every prior `content: "filled"` entry, now reads `content: "filled"` → `contentStatus:
"filled"`. Otherwise (sections still pending content) → leave `contentStatus` unset/unchanged — a
    partial content-fill correctly reads as "not fully filled" to every downstream consumer
    (`convert-audit.md`'s content-fill guard, `design-ship`'s check gate, the content route's own
    batch-queue candidate filter).
  - Set `status: "DOING"`, `data.updated` to today. Do **not** touch `stage` — layout didn't change
    this run.
  - Remove `transition` if present.
  - Write back via Edit

**Component scope** (`$CONVERT_TARGET` resolves to a component):

- Set `status: "DOING"`, `stage: "building"`
- Remove `transition` and `contentStatus` fields if present
- Do NOT set `shippedSha` or `completedAt` — those belong to the page/feature merge that consumes this component
- Write back via Edit

### 4.2d Section State Write

Only when `$BUILD_SECTIONS` (0.4c) was set this run — a whole-page/whole-component run without a
0.4c branch never touches `sectionState[]` (its completeness already defaults to `true` per §4.2's
absent/empty rule, so there's nothing to advance).

For every section name in `$BUILD_SECTIONS`, merge into `design.{pages|components}[{name}].sectionState[]`
(create the array if absent, one entry per section seen in `$ANALYSIS.Sections` — see
`shared/DASHBOARD-PROJECT.md § pages[].sectionState`):

- Build branch → set that entry's `build: "built"`.
- Content branch → set that entry's `content: "filled"`.

Sections outside `$BUILD_SECTIONS` are left untouched — never regressed, never auto-completed. Write
back via Edit, in the same pass as §4.2's own write (one read, one write, not two round-trips).

### 4.2b New-Page Navigation Wiring

Only when page scope AND this run created a **new** page (`$TARGET_PAGE_CONFIRMED = "new"` from §0.25 — homepage/other-page audits patch an already-linked page, so this doesn't apply there). Skip entirely otherwise.

1. **Locate the primary nav component**: glob `components/**/nav*.{tsx,jsx}` and check `components/site/navbar.tsx` specifically (common convention). Pick the file that defines a links array of `{ label, href }`-shaped entries (e.g. a `NAV_LINKS`/`links` constant).
   - No match found → skip silently, print one line: `Nav-wiring: no navigation component found — link the new page manually.`
2. **Already linked, or deliberately not?** Skip silently — no modal — when either holds:
   - the array contains an entry whose `href` matches the new route → nothing to do; or
   - a **sibling route under the same parent segment** (`/{parent}/*`) exists on disk and is likewise absent from the array. That is an established convention, not an oversight: the project reaches those pages from a hub page instead of the nav, and asking makes the user re-decide the same thing once per sibling. Print `Nav-wiring: skipped — sibling /{parent}/{sibling} is also not in the nav (existing convention).`

   The question in step 3 only earns its round-trip when the new route has no precedent to follow.

3. Otherwise, ask:
   ```yaml
   header: "Navigation"
   question: "Route /{route} isn't linked from navigation anywhere. Add a nav link for it?"
   options:
     - label: "Add the link (Recommended)"
       description: 'Add { label: "{frameName}", href: "/{route}" } to the nav links'
     - label: "Skip"
       description: "I'll wire it up myself"
   multiSelect: false
   ```
4. **"Add the link"**: append one entry to the links array — `label` from the Figma frame name (§0.1/0.25), `href` the new route. A single, surgical edit — not a broader nav restructure, and not a redesign of existing entries. The edited nav file falls inside `§4.5b`'s baseline diff, so it's included in the scoped commit automatically.
5. **"Skip"**: leave as-is, no further prompting this run.

### 4.2c Interaction Persistence (only when `$INTERACTION_SPEC` was set)

Persist what fits the existing design-spec schema — nothing else (`shared/DASHBOARD-PROJECT.md`; key-level merge, never auto-delete):

- Rows whose confirmed mapping is a **choreography token** → write into the entity's existing slots: `design.components[].motion{onHover|onPress|onEnter|onExit|onSuccess|onError}` for component-level interactions, `design.pages[].transitions{sectionReveal}` for page-level scroll entrances. One token per slot; if a slot is already set and differs, keep the existing value and note it in the report (the spec is OVERWRITE-owned by `/design-tokens` conventions — don't fight it from here).
- Rows with **explicit custom values** (no token equivalent) stay run-scoped: they live in the generated code and the devinfo `interactions` count — deliberately no new schema field (a future `interactions[]` schema extension is the audit-scope's problem, not this run's).

### 4.3 Gap-Discovery

Trigger C — scan all generated/updated component files for stub handlers. Follow [Discovery — Gap-Discovery](../../shared/SKILL-PATTERNS.md#gap-discovery). **Source:** `"/design-convert"` · **Direction:** `"frontend→dev"` · **Type:** `FEATURE`. If no gaps: skip this step.

### 4.4 Completion Report — prepare fields

**STOP** when no `REFINE ROUNDS` block (`convert-refine-round.md` § 3.5d) was printed this run and 3.0 resolved a browser vehicle. PHASE 3.5 did not execute — the user has not seen the result. Go back and run it; do not source `refineRounds` from the conversation.

**Content branch (`$ASPECT = "content"`, PHASE 2c) uses a different precondition** — it never reaches PHASE 3.0, so the check above does not apply. Instead: **STOP** when no approval was recorded by `convert-content-review.md` §4.2/§4.3/§4.4 this run. The review table is that branch's "the user has seen the result" artifact.

Same shape as 2.0a's PHASE 1 gate: the phase's artifact is what its consumer is allowed to read, so its absence is detectable here rather than silently papered over.

Detect worktree state first:

```bash
WT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
IS_WORKTREE=$([ "$(git rev-parse --git-dir)" != "$(git rev-parse --git-common-dir)" ] && echo true || echo false)
```

Compare against `--git-common-dir`, never against a reconstructed
`{toplevel}/.git`: in a plain checkout `--git-dir` answers with the relative
`.git`, which never equals an absolute path, so the reconstructed form reports
`true` on every ordinary repo and makes §4.6 auto-finalize reachable where
there is no worktree to finalize. In a linked worktree `--git-dir` points at
`.git/worktrees/{name}` while `--git-common-dir` points at `.git` — the two
differ exactly when a worktree is in play.

Build the `Worktree:` line (reused verbatim in the printed report in §4.5b below):

- `$IS_WORKTREE = true` → `Worktree:    {WT_BRANCH} — UNMERGED (auto-finalized in §4.6)`
- `$IS_WORKTREE = false` → `Worktree:    not in a worktree`

Compute the verification-artifact count rather than recalling it. The `-newer` test scopes the count to **this** run: `.project/tmp` survives between runs, so an unscoped `ls` counts leftovers from an earlier conversion in the same project and reports a round count that never happened. No baseline file (non-git project) → fall back to counting all matches, and say `rounds (unscoped count)` in the report.

```bash
ROUNDS=$(find .project/tmp -maxdepth 1 -name 'verify-round-*.png' \
  -newer .project/session/pre-convert-sha.txt 2>/dev/null | wc -l | tr -d ' ')
```

The glob counts **PHASE 3 rounds only**. PHASE 3.5's re-captures are a different phase with its own uncapped counter (`Refine:` on the report), so name them anything but `verify-round-*` — a refine capture written under that name inflates `verificationRounds` past the 3-round cap the loop actually honoured.

`$ROUNDS = 0` and Playwright was available this run → the verification loop was skipped or ran degraded. Print `Verification: NOT RUN — convert-verification-loop.md was skipped` on the completion report (§4.5b) instead of a match-quality claim, and add it to 4.4b's Open-gaps bucket. `$ROUNDS > 0` → `verificationRounds = $ROUNDS`, `finalMatchQuality` = the `Match quality:` value from the last round's `ROUND ASSESSMENT` block (§3.2) — never a value recalled from memory without that block existing.

`$EXTRACTED_STYLES` was set this run (Figma/URL ground truth) → check that 3.2c ran the script rather than a hand-rolled substitute:

```bash
test -f .project/tmp/rendered-styles.json && echo ran || echo skipped
```

`skipped` → print `Exact-value check: NOT RUN — 3.2c hand-rolled or skipped` on the completion report and add it to 4.4b's Open-gaps bucket. That file is the only evidence spacing, radii and seams were compared at all; a per-segment colour eval passing is a different, smaller check (`convert-verification-loop.md § 3.2c` forbids the substitution outright, which is exactly why its absence needs a trace).

Check whether this run's `TaskCreate` list (Step 0b) exists and every phase reached `completed`: no list, or an unfinished phase → print `Tasks: not tracked this run` on the completion report (§4.5b) instead of omitting the line silently.

**Note:** the full `CONVERT BUILD COMPLETE` report is printed at the end of §4.5b, not here — it includes a `Commit:` line that needs the actual commit result, which doesn't exist yet at this point in the flow (mirrors `dev-verify`'s completion-sync: commit first, then print the report). This step only computes/holds the fields the report needs; the live-preview presentation below still happens now, since it isn't gated on the commit.

If the visual verification loop rendered a live page (Playwright was available and ran ≥1 round — see `convert-verification-loop.md`), present that live page in the browser:

> **Todo**: if the verification loop ran live (not skipped), present its page URL `http://localhost:[port]/[page-path]` (as `$CONVERT_PREVIEW_URL`, an `http://` URL) via `.claude/skills/shared/HTML-PRESENT.md` (auto-opens in the browser). Set `$PREVIEW_OPENED = true`. Verification skipped (no Playwright/dev-server) → skip, no error.

Also carry PHASE 3.5's `REFINE ROUNDS` record into the report fields: `Refine: [n] rounds` for the report block below, and the `Applied`/`Preserved`/`Parked` lines feed 4.4b's two buckets.

No `REFINE ROUNDS` block was printed this run and 3.0 resolved no browser vehicle → `Refine: not run — no browser vehicle` (the STOP gate above already rules out the other case: a vehicle resolved but PHASE 3.5 didn't run).

### 4.4b Decisions and Open Gaps

The user already accepted the result in PHASE 3.5 — this step is not a second
approval gate for the visual outcome. It surfaces the things a screenshot cannot
show: deliberate deviations the user may want to revisit, and anything the run
could not finish or verify.

Before writing anything below, if the run emitted any local asset path this session: `ls` each one. Any path that does not resolve is an Open gap, never a Decision.

Report two labeled buckets — do not merge them:

- **Decisions (max 3 lines)** — deliberate deviations you stand behind and would defend if asked, e.g. "kept X unlicensed asset out and substituted Y", "left section Z out of the page (no Figma match) but didn't delete the file". Every path in `$PRESERVE` (0.6b) belongs here with the reason it was preserved — that is a decision the user made and will want restated at the end. Omit the bucket only if there are genuinely none.
- **Open gaps (no line cap, one line each)** — anything the run could not complete, could not verify, or worked around: a substituted/invented asset or value, a verification step that was skipped or ran degraded, a fetch that failed. State `Gaps: none` explicitly if there genuinely are none — an omitted header reads as "forgotten," not "checked."

Each line in both buckets must cite a concrete referent — a file path, a `file:line`, or a value visible in `git diff` vs the baseline SHA. Do not describe the codebase from memory; grep the diff first. A line you cannot cite is a line you should not write.

**Gaps bucket empty → do not ask anything.** Print both buckets and continue to
4.5. PHASE 3.5 already collected the user's changes; a second "is dit goed?" here
is the double confirmation `SKILL-PATTERNS.md` warns about.

**Gaps bucket non-empty → one question, because a gap is a thing the run could
not close on its own:**

```yaml
header: "Open gaps"
question: "{n} open item(s) from this run. Address them now, or record them?"
options:
  - label: "Address them now (Recommended)", description: "Fix the reported gaps, then finish the run"
  - label: "Record as backlog items", description: "Commit what stands; the gaps become FEATURE cards via 4.3"
multiSelect: false
```

On "Address them now": address them, then continue to 4.5 — no re-ask loop here. A
fix that turns out to need visual confirmation goes back to PHASE 3.5's loop,
which is the phase that owns iteration; this step does not grow its own.

### 4.5 Dev-server cleanup

First remove session-scoped working screenshots (convert artifacts only):

```bash
for p in 'source-capture*.png' 'patch-before*.png' 'verify-round-*.png' \
         'extract-computed-styles.mjs' 'rendered-styles*.json'; do
  find .project/tmp -maxdepth 1 -name "$p" -delete 2>/dev/null
done
```

This is the earliest point where that is safe. PHASE 3.5's refine loop
re-captures and re-shows these on every round; deleting them while that loop can
still reopen destroys the comparison evidence for the next round.

Do NOT delete `.project/tmp/smoke-render-*.png` — those back the devinfo `buildScreenshot` handoff (24h staleness rule applies there).

Before auto-finalizing, detect Node processes with cwd in the current worktree:

```bash
WT_PATH=$(git rev-parse --show-toplevel)
CWD_PROCS=$(lsof +D "$WT_PATH" 2>/dev/null | awk 'NR>1 && $4=="cwd" && $1~/(node|next|ts-node)/ {print $2}' | sort -u)
```

If `CWD_PROCS` non-empty → AskUserQuestion:

```yaml
header: "Dev server active"
question: "{N} Node process(es) are still running in this worktree (probably the dev server). Stop them before cleanup?"
options:
  - label: "Yes, stop them"
    description: "kill -TERM {pids}, wait 2s, then kill -KILL if they are still running — prevents an orphan dir after cleanup."
  - label: "Keep running"
    description: "Continue; worktree-remove may leave an empty .next directory behind."
multiSelect: false
```

**Recommendation flips on `$PREVIEW_OPENED`:** if a live preview was opened in §4.4 (`$PREVIEW_OPENED = true`), append `(Recommended)` to "Keep running" — killing the dev server closes the page the user is viewing. Otherwise append `(Recommended)` to "Yes, stop them" (the default).

On "Yes": `kill -TERM $CWD_PROCS 2>/dev/null; sleep 2; kill -KILL $CWD_PROCS 2>/dev/null || true`

### 4.5b Scoped Commit

Follow `shared/SCOPED-COMMIT.md`. Convert's deltas:

- **Baseline**: SHA form, `.project/session/pre-convert-sha.txt` (written in `route-convert.md §0.5c`). Changed files = `git diff --name-only $(cat .project/session/pre-convert-sha.txt)` + `git ls-files --others --exclude-standard` for new files. Missing baseline file (pre-existing project predates this skill version, or non-git project) → fall back to staging only the known skill-output files (`pageFile` + `components` from the devinfo handoff written in §4.1) — never `git add -A` here, since an untracked baseline can't distinguish convert's output from unrelated dirt.
- **OVERLAP policy**: `interactive` — an audit/patch run can touch files that were already dirty before this run started (e.g. `app/page.tsx` mid-edit by the user). Ask before folding those into this commit, same as `dev-build`/`dev-verify`.
- **`.project/` stays local-only** — never stage or commit `.project/*` paths (backlog.json, devinfo.json, session files). Stage only codebase files: the page file and component files.
- **Commit message** (conventional, project language per `CLAUDE.md → Language`):
  - `$SCOPE ∈ {page, component, build}` → `feat({target}): {subject}`
  - `$SCOPE = audit` → `fix({target}): {subject}` (an audit patches existing markup)
  - `{subject}`: one short sentence (≤65 chars) describing what was built/changed — not counts, not mode/scope labels.
- **Staging + commit** — **never a bare `git add`** (`SCOPED-COMMIT.md § 2`). Land via the atomic script, which builds the commit in an isolated index and lands it with a compare-and-swap:

  ```bash
  mkdir -p .project/tmp
  printf '%s\n' "{type}({target}): {subject}" > .project/tmp/commit-msg.txt
  bash ~/.claude/scripts/scoped-commit.sh \
    --message .project/tmp/commit-msg.txt --files "<comma-separated paths>"
  ```

  Build `--files` from the baseline diff plus new files, then **subtract two things before calling** — one bad path makes the whole call exit non-zero, so filter up front rather than retrying:
  - anything under `.project/` (local-only, per the bullet above);
  - gitignored paths — `git check-ignore <paths>` and drop every hit. Skill output is not automatically committable: `scripts/` is gitignored in some projects, so a generated asset-prep script legitimately stays out of the commit.

  **Deleted files belong in `--files` like any other path** — the script stages them as deletions. A run that generalises a section into a shared component retires the originals; leaving those paths out lands a tree that still contains files the run removed, and the next run sees two implementations of the same section.

- **Guard**: skip the commit (no error) if the diff vs. baseline is empty and nothing is staged — set `$COMMIT_RESULT = "no changes to commit"` for the report below.
- **Worktree**: if `$IS_WORKTREE = true`, this commits inside the worktree branch, same as any other skill's scoped commit — §4.6 immediately below merges that now-committed branch. This is what closes the gap `shared/FINALIZE.md`'s own Uncommitted-Check would otherwise halt on.
- Clean up the baseline file after a successful commit: `rm -f .project/session/pre-convert-sha.txt`.

Then print the full completion report, using the `Worktree:` line built in §4.4 and the commit result from this step:

Omit the `Interactions:` line entirely when no `$INTERACTION_SPEC` was set this run — don't print it empty.

Add a `Sections:` line, and adjust `Next:`, whenever `$BUILD_SECTIONS` (0.4c) was set this run:

```
Sections:     [built]/[total] built, [filled]/[total] content-filled — remaining: [names, or "none"]
```

```
CONVERT BUILD COMPLETE
════════════════════════════════════════════════
Source:       [path | URL | pasted image]
Mode:         [1:1 copy | Inspiration | Sketch→high-fi]
Framework:    [detected framework]
Tasks:        [n phases tracked | "not tracked"]
Verification: [N] rounds, [High|Medium|Low] | "NOT RUN"
Exact-value:  [PASS | N mismatches fixed | "NOT RUN"]
Responsive:   mobile/tablet/desktop [PASS | N findings | interpretation]
Refine:       [N] rounds with the user | "not run" | "NOT RUN"
Preserved:    [paths kept in their existing styling | "none"]
Interactions: [N implemented, PASS | N mismatches]
Code quality: [PASS | N violations fixed]
Sections:     [only when $BUILD_SECTIONS was set — see above]
Gaps:         [N linked | M created | K pending | "none"]
Bans checked: [N enforced | "none active"]
Commit:       [{type}({target}): {subject} (sha) | "none"]
Worktree:     [{branch} — unmerged | not in a worktree]

Files ([N]):
  Page:       [page file path]
  Components: [component paths]

Next: /design-ship {name} — runtime check, ships on PASS.
      [$SECTION_COMPLETE = false → replace with: /design-convert {name} — resume, {N} section(s) remaining.]
════════════════════════════════════════════════
```

### 4.6 Auto-finalize

**Skip if `$IS_WORKTREE = false`** (detected in §4.4).

**Skip also when this run was section-scoped (`$BUILD_SECTIONS` set) and `$SECTION_COMPLETE = false`**
(§4.2/§4.2d) — even inside a worktree. The commit in §4.5b above still lands (the run's actual output
is never lost), but the worktree stays open and unmerged until every section is done: this is both
the mechanism against marking a partial page "finished" (§4.2 already keeps `stage`/`contentStatus`
from advancing prematurely; this is the matching guard on the merge itself) and the resume mechanism
for a later day — `sectionState[]` lives in `project.json`, which travels via `claude/state`
independently of the worktree, so `route-convert.md § 0.5b`'s own collision matrix
(`shared/WORKTREE-CREATE.md`) already does the right thing on re-entry: clean + matching branch →
silent reuse; branch merged/gone in the meantime → fresh worktree from `main`, no new state needed
either way.

Detect `TEAM_MODE` + PR state, then run `shared/FINALIZE.md` directly (no confirmation modal for the merge/cleanup decision):

```bash
TEAM_MODE=$(jq -r '.team.mode // "solo"' .project/project.json 2>/dev/null || echo "solo")
PR_INFO=$(gh pr list --head "$(git branch --show-current)" --state all --json number,url,state --limit 1 2>/dev/null)
PR_STATE=$(echo "$PR_INFO" | jq -r '.[0].state // empty' 2>/dev/null || echo "")
PR_NUMBER=$(echo "$PR_INFO" | jq -r '.[0].number // empty' 2>/dev/null || echo "")
PR_URL=$(echo "$PR_INFO" | jq -r '.[0].url // empty' 2>/dev/null || echo "")
```

Dispatch (no `AskUserQuestion` for the merge/cleanup decision):

| TEAM_MODE | PR_STATE                 | Action                                                                                                                |
| --------- | ------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| solo      | empty / `CLOSED` / no-gh | Run `shared/FINALIZE.md` mode=`solo` (Branch Resolution → Uncommitted Check → Solo-Merge → Cleanup → Output Report).  |
| solo      | `MERGED`                 | Run `shared/FINALIZE.md` mode=`cleanup-only`.                                                                         |
| solo      | `OPEN`                   | **Halt** — print `"PR #${PR_NUMBER} is open: ${PR_URL}. Run /core-finalize $CONVERT_TARGET after review."` Exit.      |
| team      | `MERGED`                 | Run `shared/FINALIZE.md` mode=`cleanup-only`.                                                                         |
| team      | `OPEN`                   | **Halt** — print `"PR #${PR_NUMBER} is open: ${PR_URL}. Run /core-finalize $CONVERT_TARGET after review."` Exit.      |
| team      | empty / `CLOSED`         | **Halt** — print `"Team project: no PR found. Push + open PR via /team-review."` Exit.                                |
| team      | no-gh                    | **Halt** — print `"Team mode but \`gh\` is not available — run \`gh auth login\` or toggle solo in backlog ⚙."` Exit. |

The design-track backlog sync (PAGE ships only when already `DONE`, COMPONENT left untouched) is handled inside `shared/FINALIZE.md`.

For component scope: this is the canonical close point — do not skip even if design-ship was not run.
