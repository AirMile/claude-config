# PHASE 6: Completion

## Step 0: Fix Sync (only when fixes were applied in PHASE 3)

**Skip this step if all items passed on first attempt (no fixes needed).**

The Fix Sync ensures the user understands what changed in the codebase during the test-fix cycle.

**0a) Claude summarizes** — per fix, in plain language:

```
FIX SYNC: {feature-name}
=========================

{For each fix applied:}

Fix {N}: {item title}
- Problem: {what was wrong, in plain language}
- Change: {what was modified} ({file:line})
- Approach: {why this fix, not an alternative — only if non-obvious}
- Watch out: {anything the user should know — only if relevant}

{Example:}

Fix 1: Puddle too small
- Problem: Puddle radius was 50px, user expected 100px
- Change: Doubled PUDDLE_RADIUS constant (scripts/abilities/water_ability.gd:12)

Fix 2: No sound on cast
- Problem: AudioStreamPlayer was missing from the ability scene
- Change: Added AudioStreamPlayer2D with cast_sound.ogg (scenes/abilities/water_ability.tscn)
- Watch out: Sound uses AudioBus "SFX" — make sure this bus exists in project audio settings
```

**0b) Comprehension check** via AskUserQuestion:

- header: "Fix Sync"
- question: "Do you understand the fixes that were applied?"
- options:
  - label: "Yes, clear (Recommended)", description: "I understand what changed and why"
  - label: "Explain more", description: "Give a more detailed explanation with examples"
  - label: "I have a question", description: "I want to ask about something specific"
- multiSelect: false

**If "Explain more"** → explain each fix in more detail with before/after examples, then re-ask.
**If "I have a question"** → answer the question, then re-ask.
**Loop until "Yes, clear".**

**0c) Save fix sync** — store the summary for inclusion in feature.json `tests.sessions[]`.

---

## Step 0b: Out-of-scope Observations (always — even without fixes)

The user was actively playtesting and may have noticed issues outside the current feature scope. Capture these before closing out.

Use AskUserQuestion tool:

- header: "Observations"
- question: "Did you notice anything else during playtesting that is outside the scope of this feature?"
- options:
  - label: "No, all good (Recommended)", description: "No further remarks"
  - label: "Yes, I noticed something", description: "I want to note something for later"
- multiSelect: false

**If "Yes"** → ask the user to describe what they noticed (plain text, no modal). Record the observations for inclusion in feature.json `observations[]`. Do NOT attempt to fix these — they are out of scope.

After documenting, show confirmation:

```
OBSERVATION NOTED

Recorded in test results.
```

---

## Steps

1. **Confirm all items pass:**

   ```
   {FEATURE-NAME} COMPLETE!

   All {N} playtest items passed.

   | # | Test | Status |
   |---|------|--------|
   | 1 | {description} | PASS |
   | 2 | {description} | PASS |
   | 3 | {description} | PASS |
   | 4 | {description} | PASS |

   Feature ready for integration.
   ```

2. **3-file sync** (feature.json + backlog + project.json + project-context.json):

   `node ~/.claude/scripts/completion-sync.js` owns this whole sync — it computes every derived
   field (`finalStatus`, session pass/fail/skip/fixes counts, per-REQ `evaluation`) and structurally
   never writes the backlog's refactor-owned keys (`shipped`/`shippedAt`/`shippedSha` — see
   `shared/BACKLOG.md` Lifecycle Protocol; this includes preserving `transition: "shipping"`, the
   game-ship run marker, exactly like dev-verify's sync). You supply only judgment:

   ```bash
   echo '{
     "pipeline": "game",
     "requirements": [{ "id": "REQ-001", "verdict": "PASS" }],
     "checklist": { "T-001": "PASS" },
     "fixSync": ["..."],
     "observations": ["..."],
     "verificationCheckpoint": { "gaps": [], "mismatches": [], "adjustments": "none" },
     "componentSync": [{ "name": "player-controller", "src": ["..."], "test": ["..."] }]
   }' | node ~/.claude/scripts/completion-sync.js sync {feature-name}
   ```

   `requirements[]`/`checklist` follow the same shape as dev-verify (see
   `dev-verify/references/completion-sync.md § Step 3`). `componentSync` only when PHASE 3 fixes
   touched `architecture.components[]`. Exit `6` (validation failed, nothing written) or `7` (no
   backlog match, feature.json written) fall back to authoring the mutations by hand per the
   script's header.

   **Learning Extraction** — append to `project-context.json#learnings[]` per [shared/LEARNING-WRITE.md § Writer Append Protocol](../../shared/LEARNING-WRITE.md) (schema, relevance filter, two-stage dedup). game-verify source mapping — read the just-written `feature.json`:
   - `tests.fixSync[]` and `tests.sessions[].fixes` → type `pitfall`, source `extracted` (bugs with root causes)
   - `observations[]` → type `observation`, source `inferred` (cross-feature insights)

   `build.decisions[]` is mapped by game-build (single writer) — do not re-map here.

3. **Scoped auto-commit** — follow [shared/SCOPED-COMMIT.md](../../shared/SCOPED-COMMIT.md). game-verify deltas:
   - **Baseline**: status form — `.project/session/pre-skill-status.txt`.
   - **OVERLAP policy**: interactive. **Fallback**: `git add -A`.
   - **Commit**: `test({feature}): verified - all {N} items pass` with body `Playtest verification complete.` / `- Fixed: {list of fixes}` / `- Tests added: {count}`.
   - **Cleanup**: `rm -f .project/session/pre-skill-status.txt /tmp/current-status.txt` plus
     `node ~/.claude/scripts/ship-checkpoint.js signal-clear {feature-name}`

## Output

```
VERIFICATION COMPLETE

Feature: {feature-name}
Status: DONE
Items: {N}/{N} passing

Committed: test({feature}): verified

Next steps:
  1. /game-refactor → code quality check + learning extraction
  2. /game-define {next-feature} → pick up next feature
```

> **Todo**: Apply the Next-Step Clipboard Offer (binary Ja/Nee) —
> read '.claude/skills/shared/NEXT-STEP-OFFER.md'.
> Recommended command: if worktree finalized → /game-refactor {feature} (optional polish on main); else if more items in backlog → /game-define {next-feature} (continues pipeline); else omit the offer.

---

## PHASE Finalize

**Run only if BOTH true:**

1. All test items PASS (no open fix-loop items)
2. Current branch matches `worktree-*` pattern (`git branch --show-current`)

**Finalize behavior** — detect `TEAM_MODE` + PR state, then act automatically (no confirmation modal for the merge/cleanup decision):

```bash
TEAM_MODE=$(jq -r '.team.mode // "solo"' .project/project.json 2>/dev/null || echo "solo")
PR_INFO=$(gh pr list --head "$(git branch --show-current)" --state all --json number,url,state --limit 1 2>/dev/null)
PR_STATE=$(echo "$PR_INFO" | jq -r '.[0].state // empty' 2>/dev/null || echo "")
PR_NUMBER=$(echo "$PR_INFO" | jq -r '.[0].number // empty' 2>/dev/null || echo "")
PR_URL=$(echo "$PR_INFO" | jq -r '.[0].url // empty' 2>/dev/null || echo "")
```

| TEAM_MODE | PR_STATE                 | Action                                                                                                                                                                                 |
| --------- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| solo      | empty / `CLOSED` / no-gh | Run `shared/FINALIZE.md` mode=`solo` (Branch Resolution → Uncommitted Check → Solo-Merge → Cleanup → Output Report).                                                                   |
| solo      | `MERGED`                 | Run `shared/FINALIZE.md` mode=`cleanup-only`.                                                                                                                                          |
| solo      | `OPEN`                   | **Halt** — print `"PR #${PR_NUMBER} is open: ${PR_URL}. Run /core-finalize {feature-name} after review."` Exit.                                                                        |
| team      | `MERGED`                 | Run `shared/FINALIZE.md` mode=`cleanup-only`.                                                                                                                                          |
| team      | `OPEN`                   | **Halt** — print `"PR #${PR_NUMBER} is open: ${PR_URL}. Run /core-finalize {feature-name} after review."` Exit.                                                                        |
| team      | empty / `CLOSED` / no-gh | **Leave worktree open** — refactor already ran on the branch. Print `"Team project: push + open a PR via /team-review, or run /core-finalize {feature-name} to merge directly."` Exit. |

## Post-merge reconcile + state-push (merge route only)

After a successful merge (the `FINALIZE.md solo` / `cleanup-only` rows above — **not** the halt / leave-worktree
rows), the main chat (game-ship PHASE 4 tail) must finish the postconditions the pre-merge agent could not:

1. **Reconcile the archive.** The pre-merge refactor agent wrote its completion batch in the worktree
   and could not see the merge, so enforce the archive postcondition here: verify the feature is
   **absent** from `backlog.json#features[]` **and present** in
   `.project/archive/backlog-archive.json#archived[]` with `shipped: true` — the same re-read invariant
   `game-refactor/references/completion-batch.md` already requires. **Self-heal a half-run**: if the
   entry was removed from `features[]` but never archived, reconstruct the archive entry from
   `feature.json`; if it is still in `features[]`, move it into the archive now — a green completion
   always ends archive-only.
2. **Re-stamp `shippedSha`** in the archive entry to the merge sha (`git -C {main_root} rev-parse HEAD`),
   not the pre-merge refactor commit the agent recorded.
3. **State auto-push** — follow `shared/STATE-SYNC-PUSH.md § Auto-push` (non-fatal — on failure print
   the hint line and continue).

On the halt / leave-worktree rows, skip this section entirely — nothing merged, so the worktree/PR
still owns the state.
