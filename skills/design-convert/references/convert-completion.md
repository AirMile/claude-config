# PHASE 4: Completion

### 4.1 Update DevInfo

Update `.project/session/devinfo.json`:

```json
{
  "handoff": {
    "from": "design-convert",
    "to": null,
    "data": {
      "inputType": "screenshot | url | image",
      "mode": "copy | inspiration",
      "pageFile": "[page file path]",
      "components": ["[list of created component files]"],
      "verificationRounds": 2,
      "finalMatchQuality": "high",
      "framework": "[detected framework]",
      "theme": "[.project/project.json#theme or null]",
      "scope": "page | component | patch | audit",
      "auditFixes": "[N — only present when scope = audit]"
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

If match found, branch on entity type:

**Page scope** (`$CONVERT_TARGET` resolves to a page):

- Set `status: "DOING"`, `stage: "built"`, `data.updated` to today — same as the Build route (`build-completion-sync.md` 10d). The page lands at TO CHECK; `/design-ship` is the only gate to `DONE` for pages (build and convert alike). Convert's visual verification loop is a complementary pre-check, not a substitute for the runtime audit (a11y/responsive/darkmode/perf).
- Remove `transition`, `completedAt`, and `contentStatus` fields if present — `contentStatus` reset ensures the "Fill content" board button and badge reappear after a re-convert so copy is re-reviewed against the new markup.
- Write back via Edit
- **Audit re-entry:** this applies unchanged when `$SCOPE = audit` — an audit that patches an already-`DONE` page correctly moves it back to TO CHECK, since markup changed and a runtime re-check is warranted.

**Component scope** (`$CONVERT_TARGET` resolves to a component):

- Set `status: "DOING"`, `stage: "building"`
- Remove `transition` and `contentStatus` fields if present
- Do NOT set `shippedSha` or `completedAt` — those belong to the page/feature merge that consumes this component
- Write back via Edit

### 4.2b New-Page Navigation Wiring

Only when page scope AND this run created a **new** page (`$TARGET_PAGE_CONFIRMED = "new"` from §0.25 — homepage/other-page audits patch an already-linked page, so this doesn't apply there). Skip entirely otherwise.

1. **Locate the primary nav component**: glob `components/**/nav*.{tsx,jsx}` and check `components/site/navbar.tsx` specifically (common convention). Pick the file that defines a links array of `{ label, href }`-shaped entries (e.g. a `NAV_LINKS`/`links` constant).
   - No match found → skip silently, print one line: `Nav-wiring: no navigation component found — link the new page manually.`
2. **Already linked?** If the array already contains an entry whose `href` matches the new route → skip (nothing to do).
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

### 4.3 Gap-Discovery

Trigger C — scan all generated/updated component files for stub handlers. Follow [Discovery — Gap-Discovery](../../shared/SKILL-PATTERNS.md#gap-discovery). **Source:** `"/design-convert"` · **Direction:** `"frontend→dev"` · **Type:** `FEATURE`. If no gaps: skip this step.

### 4.4 Completion Report — prepare fields

Detect worktree state first:

```bash
WT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
MAIN_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
IS_WORKTREE=$([ "$(git rev-parse --git-dir)" != "$MAIN_ROOT/.git" ] && echo true || echo false)
```

Build the `Worktree:` line (reused verbatim in the printed report in §4.5b below):

- `$IS_WORKTREE = true` → `Worktree:    {WT_BRANCH} — UNMERGED (auto-finalized in §4.6)`
- `$IS_WORKTREE = false` → `Worktree:    not in a worktree`

**Note:** the full `CONVERT BUILD COMPLETE` report is printed at the end of §4.5b, not here — it includes a `Commit:` line that needs the actual commit result, which doesn't exist yet at this point in the flow (mirrors `dev-verify`'s completion-sync: commit first, then print the report). This step only computes/holds the fields the report needs; the live-preview presentation below still happens now, since it isn't gated on the commit.

If the visual verification loop rendered a live page (Playwright was available and ran ≥1 round — see `convert-verification-loop.md`), present that live page in the browser:

> **Todo**: if the verification loop ran live (not skipped), present its page URL `http://localhost:[port]/[page-path]` (as `$CONVERT_PREVIEW_URL`, an `http://` URL) via `.claude/skills/shared/HTML-PRESENT.md` (auto-opens in the browser). Set `$PREVIEW_OPENED = true`. Verification skipped (no Playwright/dev-server) → skip, no error.

### 4.4b Final Verification Round

Whatever was shown so far (live preview, if any) is one-directional — it doesn't ask whether the result actually satisfies the user, or surface decisions made along the way that they might want to revisit. Close that gap here, **before** treating the run as done — and before §4.5b commits anything, so a "still needs work" answer never gets locked into a commit:

Summarize, in 1-3 lines, any judgment calls made during this run that a value-only report wouldn't surface — e.g. "kept X unlicensed asset out and substituted Y", "left section Z out of the page (no Figma match) but didn't delete the file", "didn't touch the site-wide brand color even though it differs from Figma". Skip this summary if the run had no such calls (a clean value-patch audit rarely does).

```yaml
header: "Verification"
question: "Klopt dit resultaat, of zijn er nog open punten voordat dit als afgerond geldt?"
options:
  - label: "Ziet er goed uit (Aanbevolen)", description: "Geen verdere wijzigingen nodig"
  - label: "Er zijn nog open punten", description: "Beschrijf wat nog moet worden aangepast — deze skill-run pakt het meteen op"
multiSelect: false
```

On "Er zijn nog open punten": treat the free-text response as new input, address it before continuing to 4.5. Loop this question once more if the follow-up also surfaces changes; don't loop indefinitely — after the second round, hand off remaining items as a plain list instead of re-asking.

### 4.5 Dev-server cleanup

First remove session-scoped working screenshots (convert artifacts only):

```bash
rm -f .project/tmp/source-capture*.png .project/tmp/patch-before*.png .project/tmp/verify-round-*.png
```

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
  ```bash
  git commit -m "{type}({target}): {subject}"
  ```
- **Guard**: skip the commit (no error) if the diff vs. baseline is empty and nothing is staged — set `$COMMIT_RESULT = "no changes to commit"` for the report below.
- **Worktree**: if `$IS_WORKTREE = true`, this commits inside the worktree branch, same as any other skill's scoped commit — §4.6 immediately below merges that now-committed branch. This is what closes the gap `shared/FINALIZE.md`'s own Uncommitted-Check would otherwise halt on.
- Clean up the baseline file after a successful commit: `rm -f .project/session/pre-convert-sha.txt`.

Then print the full completion report, using the `Worktree:` line built in §4.4 and the commit result from this step:

```
CONVERT BUILD COMPLETE
═══════════════════════════════════════════════════════════

Source:       [file path | URL | pasted image]
Mode:         [1:1 copy | Inspiration | Sketch → high-fi]
Framework:    [detected framework]
Verification: [N] rounds, [High | Medium | Low] match
Code quality: [PASS | [N] violations fixed]
Gaps:         [N linked | M created | K pending | "none"]
Bans checked: [N forbidden patterns enforced | "none active"]
Commit:       [{type}({target}): {subject} ({short-sha}) | "no changes to commit"]
Worktree:     {WT_BRANCH} — UNMERGED (auto-finalized in §4.6) | not in a worktree

Files ([N]):
  Page:       [page file path]
  Components: [component paths]

Next: run /design-ship {name} — build + runtime check, moves PAGE to DONE on PASS.

═══════════════════════════════════════════════════════════
```

### 4.6 Auto-finalize

**Skip if `$IS_WORKTREE = false`** (detected in §4.4).

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
