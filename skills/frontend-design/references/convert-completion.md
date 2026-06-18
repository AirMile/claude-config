# PHASE 4: Completion

### 4.1 Update DevInfo

Update `.project/session/devinfo.json`:

```json
{
  "handoff": {
    "from": "frontend-design",
    "to": null,
    "data": {
      "inputType": "screenshot | url | image",
      "mode": "copy | inspiration",
      "pageFile": "[page file path]",
      "components": ["[list of created component files]"],
      "verificationRounds": 2,
      "finalMatchQuality": "high",
      "framework": "[detected framework]",
      "theme": "[.project/project.json#theme or null]"
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

- Set `status: "DOING"`, `stage: "built"`, `data.updated` to today — same as the Build route (`build-completion-sync.md` 10d). The page lands at TO CHECK; `/frontend-check` is the only gate to `DONE` for pages (build and convert alike). Convert's visual verification loop is a complementary pre-check, not a substitute for the runtime audit (a11y/responsive/darkmode/perf).
- Remove `transition`, `completedAt`, and `contentStatus` fields if present — `contentStatus` reset ensures the "Fill content" board button and badge reappear after a re-convert so copy is re-reviewed against the new markup.
- Write back via Edit

**Component scope** (`$CONVERT_TARGET` resolves to a component):

- Set `status: "DOING"`, `stage: "building"`
- Remove `transition` and `contentStatus` fields if present
- Do NOT set `shippedSha` or `completedAt` — those belong to the page/feature merge that consumes this component
- Write back via Edit

### 4.3 Gap-Discovery

Trigger C — scan all generated/updated component files for stub handlers. Follow [Discovery — Gap-Discovery](../../shared/SKILL-PATTERNS.md#gap-discovery). **Source:** `"/frontend-design"` · **Direction:** `"frontend→dev"` · **Type:** `FEATURE`. If no gaps: skip this step.

### 4.4 Completion Report

Detect worktree state first:

```bash
WT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
MAIN_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
IS_WORKTREE=$([ "$(git rev-parse --git-dir)" != "$MAIN_ROOT/.git" ] && echo true || echo false)
```

Build the `Worktree:` line:

- `$IS_WORKTREE = true` → `Worktree:    {WT_BRANCH} — UNMERGED (auto-finalized in §4.6)`
- `$IS_WORKTREE = false` → `Worktree:    not in a worktree`

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
Worktree:     {WT_BRANCH} — UNMERGED (auto-finalized in §4.6) | not in a worktree

Files ([N]):
  Page:       [page file path]
  Components: [component paths]

Next: run /frontend-check (batch over all DOING items) at end of release cycle,
      or /frontend-check {name} for a targeted runtime audit — moves PAGE to DONE on PASS.

═══════════════════════════════════════════════════════════
```

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
  - label: "Yes, stop them (Recommended)"
    description: "kill -TERM {pids}, wait 2s, then kill -KILL if they are still running — prevents an orphan dir after cleanup."
  - label: "Keep running"
    description: "Continue; worktree-remove may leave an empty .next directory behind."
multiSelect: false
```

On "Yes": `kill -TERM $CWD_PROCS 2>/dev/null; sleep 2; kill -KILL $CWD_PROCS 2>/dev/null || true`

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

The frontend-track backlog sync (PAGE ships only when already `DONE`, COMPONENT left untouched) is handled inside `shared/FINALIZE.md`.

For component scope: this is the canonical close point — do not skip even if frontend-check was not run.
