# PHASE 5: Pick Winner

Load this file when entering PHASE 5. Contains branch ranking, winner selection, loser cleanup, and orphan handling.

---

Read `tree.json`, sort all `kept` nodes by score (direction). Show top-3:

```
TOP BRANCHES:
  1. exp_r03_p01_a1b2 — score {x} (Δ {improvement}, {commits} commits, {files} files)
     Hypothesis: "..."
  2. ...
  3. ...
```

**AskUserQuestion** (Auto-mode: top branch):

```yaml
header: "Winner"
question: "Which branch do you want to keep?"
options:
  - label: "Top branch (Recommended)"
  - label: "Second branch"
  - label: "Third branch"
  - label: "None — clean up losers, don't merge anything"
multiSelect: false
```

**For the chosen winner:**

```bash
WINNER_BRANCH="optimize/{run-id}/exp_{id}"
TARGET_BRANCH="optimize/{run-id}/winner"
git branch "$TARGET_BRANCH" "$WINNER_BRANCH"
```

Do NOT merge to default branch — user reviews themselves via PR/merge.

**Cleanup losers** (batch-mode hardening):

```bash
cd "$MAIN_ROOT" 2>/dev/null
while read -r BR; do
  if [ "$BR" != "$WINNER_BRANCH" ]; then
    WT_PATH=".project/optimize/{run-id}/worktrees/$(basename "$BR" | sed 's@.*/@@')"
    git worktree remove --force "$WT_PATH" 2>/dev/null
    git branch -D "$BR" 2>/dev/null
    if [ -d "$WT_PATH" ]; then
      if [ -z "$(ls -A "$WT_PATH" 2>/dev/null)" ]; then
        rmdir "$WT_PATH" 2>/dev/null || ORPHAN_LOG+=("$WT_PATH (rmdir failed)")
      else
        ORPHAN_LOG+=("$WT_PATH (non-empty)")
      fi
    fi
  fi
done < .project/optimize/{run-id}/branches.txt
```

Keep the winner-worktree so user can inspect directly.
