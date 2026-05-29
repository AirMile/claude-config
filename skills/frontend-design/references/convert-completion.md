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

**Deferred entry (from Phase 0.5):** if `$NEW_BACKLOG_ENTRY` is set, append it to `data.features[]` and set `data.updated` to today **before** the match/update below. The just-inserted entry will then be found by the match and immediately flipped to DONE.

Read `.project/backlog.html` per shared/BACKLOG.md. Find feature where `f.name === $CONVERT_TARGET`.

If no match: skip silently.

If match found, branch on entity type:

**Page scope** (`$CONVERT_TARGET` resolves to a page):

- Set `status: "DONE"`, `completedAt: "{YYYY-MM-DD}"`, `data.updated` to today
- Remove `stage` and `transition` fields if present
- Write back via Edit (keep `<script>` tags intact)

**Component scope** (`$CONVERT_TARGET` resolves to a component):

- Set `status: "DOING"`, `stage: "building"`
- Remove `transition` field if present
- Do NOT set `shippedSha` or `completedAt` — those belong to the page/feature merge that consumes this component
- Write back via Edit (keep `<script>` tags intact)

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
- `$IS_WORKTREE = true`  → `Worktree:    {WT_BRANCH} — UNMERGED (offer in §4.6)`
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
Worktree:     {WT_BRANCH} — UNMERGED (finalize in §4.6) | not in a worktree

Files ([N]):
  Page:       [page file path]
  Components: [component paths]

Next: run /frontend-check (batch over all DOING items) at end of release cycle,
      or /frontend-check {name} for a targeted runtime audit.

═══════════════════════════════════════════════════════════
```

### 4.5 Dev-server cleanup

Before presenting the finalize offer, detect Node processes with cwd in the current worktree:

```bash
WT_PATH=$(git rev-parse --show-toplevel)
CWD_PROCS=$(lsof +D "$WT_PATH" 2>/dev/null | awk 'NR>1 && $4=="cwd" && $1~/(node|next|ts-node)/ {print $2}' | sort -u)
```

If `CWD_PROCS` non-empty → AskUserQuestion:

```yaml
header: "Dev server actief"
question: "{N} Node-proces(sen) draaien nog in deze worktree (waarschijnlijk de dev server). Stoppen voor cleanup?"
options:
  - label: "Ja, stop ze (Aanbevolen)"
    description: "kill -TERM {pids}, wacht 2s, daarna kill -KILL als ze nog draaien — verhindert orphan-dir na cleanup."
  - label: "Laat draaien"
    description: "Ga door; worktree-remove kan een lege .next-map achterlaten."
multiSelect: false
```

On "Ja": `kill -TERM $CWD_PROCS 2>/dev/null; sleep 2; kill -KILL $CWD_PROCS 2>/dev/null || true`

### 4.6 Finalize Offer

**Skip if `$IS_WORKTREE = false`** (detected in §4.4).

Read TEAM_MODE + PR state inline (no external file load required for the decision):

```bash
TEAM_MODE=$(jq -r '.team.mode // "solo"' .project/project.json 2>/dev/null || echo "solo")
PR_INFO=$(gh pr list --head "$WT_BRANCH" --state all --json number,url,state --limit 1 2>/dev/null)
PR_STATE=$(echo "$PR_INFO" | jq -r '.[0].state // empty' 2>/dev/null || echo "")
PR_NUMBER=$(echo "$PR_INFO" | jq -r '.[0].number // empty' 2>/dev/null || echo "")
PR_URL=$(echo "$PR_INFO" | jq -r '.[0].url // empty' 2>/dev/null || echo "")
```

Decision matrix (zie `shared/FINALIZE.md` voor de canonieke versie):

| TEAM_MODE | PR_STATE                 | Action                                                                                                    |
| --------- | ------------------------ | --------------------------------------------------------------------------------------------------------- |
| solo      | `OPEN`                   | Print `"PR #{PR_NUMBER} is open: {PR_URL}. Run /core-finalize {target} after review."` Geen modal. EXIT. |
| solo      | `MERGED`                 | AskUserQuestion cleanup-only (modal below, recommended=Cleanup).                                          |
| solo      | empty / `CLOSED` / no-gh | AskUserQuestion solo-finalize (modal below, recommended=Finalize).                                        |
| team      | `OPEN`                   | Print `"PR #{PR_NUMBER} is open: {PR_URL}. Run /core-finalize {target} after review."` EXIT.             |
| team      | `MERGED`                 | AskUserQuestion cleanup-only.                                                                             |
| team      | empty / `CLOSED`         | Print `"Team project: geen PR gevonden. Push + open PR via /team-review."` EXIT.                         |
| team      | no-gh                    | Print `` "Team mode maar `gh` niet beschikbaar — run `gh auth login` of toggle solo in backlog ⚙." `` EXIT. |

**Offer modal (solo-finalize variant):**

```yaml
header: "Finalize worktree"
question: "Worktree {WT_BRANCH} is gecommit maar nog niet gemerged. Finalize nu — merge naar main + cleanup?"
options:
  - label: "Ja, finalize (Aanbevolen)"
    description: "Merge {WT_BRANCH} → main (no-ff), verwijder branch + worktree directory"
  - label: "Later"
    description: "Worktree blijft staan. Draai later: /core-finalize {target}"
multiSelect: false
```

**Offer modal (cleanup-only variant):** identical maar question = "PR is al gemerged. Cleanup nu — branch + worktree verwijderen?" en label "Ja, cleanup".

**On "Ja":**

> **Todo**: Read `.claude/skills/shared/FINALIZE.md` and execute the full procedure (Branch Resolution → Uncommitted Check → Solo-Merge OR Cleanup → Output Report) using `feature-name = {target}` and the detected `mode`.

**On "Later":** print `💡 Run /core-finalize {target} when ready` and end skill.

For component scope: this is the canonical close point — do not skip even if frontend-check was not run.
