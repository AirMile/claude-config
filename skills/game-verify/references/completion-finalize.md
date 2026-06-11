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

2. **Parallel sync** (feature.json + backlog + project.json + project-context.json):

   Read in parallel (skip if not exists):
   - `.project/features/{feature-name}/feature.json`
   - `.project/backlog.json`
   - `.project/project.json`
   - `.project/project-context.json`

   Mutate in memory:

   **feature.json**: `status` → `"DONE"`, `requirements[].status` → `"PASS"` / `"FAIL"` / `"BLOCKED"` / `"UNCLEAR"` per item (BLOCKED/UNCLEAR include `evidence` string), `tests.checklist[].status` → update per item with evidence. Add/update `tests` section: `finalStatus` (`"PASSED"` all PASS / `"FAILED"` ≥1 FAIL / `"PARTIAL"` ≥1 BLOCKED or UNCLEAR, 0 FAIL), `sessions[]` (push `{ date, pass, fail, fixes }`), `fixSync`, `verificationCheckpoint` (gaps, mismatches, adjustments). Add `observations[]` if user reported out-of-scope issues. Do NOT overwrite other sections.

   **Backlog** (see `shared/BACKLOG.md → Lifecycle Protocol → Write`): set `.status = "DONE"`, remove `transition`, `data.updated` → current date.

   **project.json**: Feature status → `"DONE"`. Merge new packages if relevant.

   **project-context.json**: On fixes in PHASE 3: update `architecture.components[]` — merge modified files to component `src`/`test`, confirm `status: "done"`.

   **Learning Extraction** — extract project-wide learnings from the completed feature:

   Read the just-written `feature.json` and evaluate (mandatory source tag per source):
   - `build.decisions[]` → type `pattern`, source `extracted` (architectural choices that affect other features)
   - `tests.fixSync[]` and `tests.sessions[].fixes` → type `pitfall`, source `extracted` (bugs with root causes)
   - `observations[]` → type `observation`, source `inferred` (cross-feature insights)

   **Filter**: only items relevant outside this single feature. Skip feature-specific implementation details.

   **Append** to `project-context.json` → `learnings[]`:

   ```json
   {
     "date": "YYYY-MM-DD",
     "feature": "{feature-name}",
     "type": "pattern|pitfall|observation",
     "source": "extracted|inferred",
     "summary": "Max 200 char summary"
   }
   ```

   **Dedup** for each candidate learning:
   1. Exact shortcut: same feature + same summary → skip (no Jaccard needed)
   2. Tokenize candidate.summary via `shared/LEARNING-EXTRACTION.md` Dedup Tokenizer
   3. For each existing learning in `learnings[]` with the same `type`:
      - `Jaccard(candidate.tokens, existing.tokens) >= 0.55` → skip candidate
   4. Survives both checks → append

   No learnings found → skip.

   Write in parallel:
   - Write `feature.json`
   - Edit `.project/backlog.json`
   - Write `project.json`
   - Write `project-context.json` (if context/architecture/learnings changed)

3. **Scoped auto-commit** — follow [shared/SCOPED-COMMIT.md](../../shared/SCOPED-COMMIT.md). game-verify deltas:
   - **Baseline**: status form — `.project/session/pre-skill-status.txt`.
   - **OVERLAP policy**: interactive. **Fallback**: `git add -A`.
   - **Commit**: `test({feature}): verified - all {N} items pass` with body `Playtest verification complete.` / `- Fixed: {list of fixes}` / `- Tests added: {count}`.
   - **Cleanup**: `rm -f .project/session/pre-skill-status.txt .project/session/active-{feature-name}.json /tmp/current-status.txt`

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

---

## PHASE Finalize

**Run only if BOTH true:**

1. All test items PASS (no open fix-loop items)
2. Current branch matches `worktree-*` pattern (`git branch --show-current`)

**PR offer (team-mode only)** — show first, only if ALL true:

1. `TEAM_MODE === "team"` — read via `shared/PROJECT-MODE.md` read pattern (absent → skip)
2. `gh` on PATH AND `gh auth status` exit 0
3. Clean tree (`git status --porcelain` empty)

If all true → AskUserQuestion:

```yaml
header: "Open PR"
question: "Push + open a PR for worktree-{feature-name}?"
options:
  - label: "Yes, push + PR (Recommended)"
    description: "Push the branch and open a PR via gh. Worktree stays until merged."
  - label: "No, skip PR"
    description: "Skip the PR; show finalize prompt instead."
multiSelect: false
```

On "Yes" → follow `{skills_path}/shared/PR.md`. Print PR URL. Suppress finalize prompt below.
On "No" or any precondition fail → fall through to finalize prompt.

**Finalize prompt** — follow `shared/FINALIZE.md → Finalize Offer Decision`. AskUserQuestion modals for MERGED and empty/CLOSED state (solo mode, or MERGED regardless of mode):

```yaml
# For MERGED state:
header: "PR merged — cleanup"
question: "PR #{PR_NUMBER} is merged ({PR_URL}). Clean up now? Worktree + local branch will be removed."
options:
  - label: "Yes, cleanup now (Recommended)"
    description: "Follow shared/FINALIZE.md cleanup-only — remove worktree + branch"
  - label: "Keep open"
    description: "Worktree stays for follow-up commits"
multiSelect: false
```

```yaml
# For solo / empty/CLOSED state:
header: "Finalize"
question: "Feature '{feature-name}' completed (status: DONE). Finalize now (merge to main + cleanup)?"
options:
  - label: "Yes, finalize now (Recommended)"
    description: "Follow shared/FINALIZE.md solo-mode — merge worktree to main + cleanup"
  - label: "Keep open"
    description: "Worktree stays open, finalize later via /game-refactor"
multiSelect: false
```

On MERGED "Yes" → follow `shared/FINALIZE.md` with `mode: cleanup-only`.
On empty/CLOSED "Yes" → follow `shared/FINALIZE.md` with `mode: solo`.
On any "Keep open" → print `💡 Run /game-refactor {feature-name} on this worktree when ready`.
