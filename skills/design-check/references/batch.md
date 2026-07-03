# Batch Mode — Combined Audit Over Multiple Features

Loaded only for `/design-check` without argument (`$BATCH_MODE = true`). Drives the entire
batch flow: queue → sequential scan + triage → one combined report → one fix-scope approval →
per-feature fix with rollback → single batch completion.

**Why this diverges from dev-ship's refactor-phase batch:** dev-ship's refactor phase parallelizes its read-only Explore
lenses; design-check scans drive a single shared Playwright browser, fixed screenshot paths
(`.project/screenshots/*`), Lighthouse subprocesses, and a dev-server. Those cannot run
concurrently without corrupting shared state — so **scans stay sequential**. And batch fixes run
**on the current branch** (no per-feature worktree) with file-snapshot rollback, producing **one
commit** — N worktrees + N finalize prompts would be unmanageable. Single-target mode keeps its
per-feature worktree (SKILL.md PHASE 2 "Worktree setup").

---

## §0 Queue

Candidates were already collected in SKILL.md §0.1 (HEAD = current commit SHA):
`status === "DOING" && lastCheckedSha !== HEAD` OR
`status === "DONE" && (!lastCheckedSha || lastCheckedSha !== shippedSha)`. A COMPONENT stays
`DOING` but, once checked at HEAD, drops out of the queue until code changes.

- **Auto-proceed if `candidates.length <= 3`**: set `$BATCH_TARGETS = candidates`, log
  `Queue: auto-selected {names}`, continue to §1. No prompt — a small queue is always right.
- **AskUserQuestion only if `candidates.length > 3`** (queue-level confirmation — NOT the fix-scope
  approval, which comes later in §2):

  ```yaml
  header: "Queue"
  question: "{N} features pending runtime audit: {names}. Audit all?"
  options:
    - label: "Yes, audit all (Recommended)", description: "{names}"
    - label: "I'll choose", description: "Pick which features to audit"
  multiSelect: false
  ```

  "I'll choose" → numbered plain-text list + free-form selection
  (`shared/SKILL-PATTERNS.md § Free-form List Selection`: `1, 3-5` / `all`). Built-in "Other" →
  cancel with `"Batch audit cancelled by user."`.

- **Capture commit baseline** (for the single batch commit in §5) — follow
  `shared/SCOPED-COMMIT.md § Baseline`, status form:

  ```bash
  mkdir -p .project/session
  git status --porcelain | sort > .project/session/pre-check-status.txt
  ```

**Per-feature scope** = the SKILL.md §0.2 auto-scope table (feature with routes → full runtime set;
feature without routes / COMPONENT → A11Y runtime + Smoke). No scope prompt in batch.

---

## §1 Sequential Scan + Triage

For **each** feature in `$BATCH_TARGETS`, **in sequence** (never parallel — shared browser):

1. Resolve targets (routes + files) and scope per the auto-scope table.
2. Run the selected scans (SKILL.md PHASE 1). Collect findings with severity + rule ID.
3. Triage:
   - **CLEAN** — 0 CRITICAL and 0 HIGH findings (MEDIUM-only counts as CLEAN for the fix gate).
   - **HAS_FINDINGS** — ≥1 CRITICAL or HIGH.
4. Record per-feature: `{name, type, status: CLEAN|HAS_FINDINGS, findings[], perAxisCounts}`.

**Component + its consuming page both candidates**: scan the page (it renders the component) and let
that cover the component's in-context dimensions (a11y / contrast / overflow / heading-order); record
the component's `lastCheckedSha = HEAD` from that scan instead of a redundant standalone pass.
Caveat: a page scan does NOT exercise deep per-variant interaction, or variants the page doesn't
render. If the component is being checked for the first time at this HEAD, still run its standalone
(harness) deep check once; thereafter the page scan is enough.

**ALL-CLEAN early-exit:** if every feature is CLEAN → skip §2-§3 entirely. Go straight to §5
completion: write `lastCheckedSha = HEAD` per feature, no approval, no plan, no commit (no code
changed). Print the completion table noting all-clean.

---

## §2 Combined Report + Single Approval

One report for the whole batch (not one per feature):

```
BATCH OPTIMIZATION REPORT — [N] features
═════════════════════════════════════════════════════════════
FEATURE ROLLUP
  feature              status        C   H   M   top issue
  ───────────────────  ────────────  ──  ──  ──  ─────────────────────
  checkout-page        HAS_FINDINGS   2   3   1  P004 JS runtime error
  pricing-page         HAS_FINDINGS   0   2   4  H001 mobile overflow
  nav-bar (COMPONENT)  CLEAN          0   0   0  —
  ───────────────────  ────────────  ──  ──  ──
  TOTAL                              2   5   5

PER-AXIS TOTALS (across all features)
  PERFORMANCE   C:1 H:2 M:1
  SEO           C:0 H:1 M:2
  AEO           C:0 H:0 M:1
  A11Y          C:1 H:1 M:0
  RESPONSIVE    C:0 H:1 M:1
  DARKMODE      C:0 H:0 M:0
  ERROR STATES  C:0 H:0 M:0
  SMOKE         C:0 H:0 M:0
  FLOW          C:0 H:0 M:0
  MOTION        C:0 H:0 M:0

COMBINED PRIORITIES (top 10, cross-feature)
  1. [checkout-page]  P004 JS runtime error — page crash — CRITICAL
  2. [checkout-page]  A001 focus trap missing — keyboard users — CRITICAL
  3. [pricing-page]   H001 overflow @375 — mobile unusable — HIGH
  ...

Total: [12] findings (C:2 H:5 M:5) across [2] features with findings, [1] clean
═════════════════════════════════════════════════════════════
```

**Single fix-scope approval** — ONE AskUserQuestion for the whole batch:

```yaml
header: "Fix Scope"
question: "Which issues do you want to fix across all [N] features? ([M] findings total)"
options:
  - label: "All CRITICAL + HIGH (Recommended)", description: "[K] fixes across [X] features"
  - label: "CRITICAL only", description: "[K] fixes, quick wins"
  - label: "Everything", description: "[M] fixes total"
  - label: "Choose per feature", description: "Pick which features to fix"
multiSelect: false
```

- "Choose per feature" → numbered feature list (HAS_FINDINGS only) + free-form selection
  (`shared/SKILL-PATTERNS.md § Free-form List Selection`: `1, 3` / `all`).
- Built-in "Other" → cancel; jump to §5 with no fixes (still writes `lastCheckedSha`).

The chosen scope yields a per-feature fix set: `fix_targets[feature] = [findings in scope]`.

---

## §3 Per-feature Fix + Rollback

Fix on the **current branch** (no worktree). Mirror dev-ship's refactor-phase apply-rollback isolation.

1. `saved_hash = git rev-parse HEAD` (global safety net).
2. **For each HAS_FINDINGS feature in `fix_targets`:**

   a. **Snapshot shared files** — files appearing in more than one feature's `files[]`:

   ```bash
   for file in {shared_files_for_this_feature}; do
     cp "$file" "/tmp/check-snapshot-{feature}-$(basename $file)"
   done
   ```

   Rollback of shared files uses the snapshot, not `git checkout` (which would also undo a prior
   feature's accepted fixes to that file).

   b. **Apply fixes** in `fix-reaudit.md § Fix Order` priority (JS runtime → failed requests →
   flow → error states → responsive → performance → darkmode → SEO → AEO → A11Y runtime → motion).
   Re-read each file immediately before editing. Use the `fix-reaudit.md § Per Fix` block format.
   Track `modified_files[feature]` and `created_files[feature]`.

   c. **Re-audit ONLY this feature's scopes** (`fix-reaudit.md § 4.1 Re-scan`); capture before/after.

   d. **Regression gate:** if a fix introduced a NEW CRITICAL finding → roll back THIS feature only:

   ```bash
   git checkout -- {unique_files_for_this_feature}
   rm -f {created_files[feature]}
   for file in {shared_files_for_this_feature}; do
     cp "/tmp/check-snapshot-{feature}-$(basename $file)" "$file"
   done
   ```

   Mark feature `ROLLED_BACK` with reason; continue to next feature.

   e. **Cleanup snapshots:** `rm -f /tmp/check-snapshot-{feature}-*`.

   f. **Report line:** `✓ {feature}: {N} fixed` or `✗ {feature}: rolled back ({reason})`.

**Cross-feature effect**: fixing a COMPONENT does not auto-rescan a checked page that renders it
(the per-feature re-audit covers only the fixed feature). If you fixed a component a checked page
consumes, re-run that page's scope once before completion, or flag it for the next run.

---

## §5 Batch Completion

Per-feature backlog sync, then one commit. (No §4 — re-audit is folded into §3 per feature.)

1. **Backlog sync** (read-modify-write `.project/backlog.json`; if N>1, batch the mutations):
   - Per feature: `f.lastCheckedSha = HEAD`. Set `data.updated` = today.
   - **PAGE with no unresolved CRITICAL** → `status: "DONE"`, `shipped: true`, `shippedAt: "{YYYY-MM-DD}"`,
     `shippedSha = {batch-commit-sha}`, remove `stage` and `transition`. (Reuses `fix-reaudit.md § 4.3`.)
   - **COMPONENT** → only update `lastCheckedSha` (never auto-DONE — ships with its consuming page).
     It stays `status: "DOING"` = "checked, awaiting its page". With `lastCheckedSha === HEAD` it
     drops out of the next batch queue until code changes. State this in the completion line so the
     board's "TO CHECK" lane isn't read as "unchecked":
     `✓ {component}: checked (DOING — ships with {consuming page})`.
   - ROLLED_BACK features: only `lastCheckedSha` (no shipped flags).
   - Sync to `project.json#features[]` for any feature whose status changed.
   - Frontend PAGE/COMPONENT items stay in `backlog.json` (NOT archived — design-track exception,
     see `shared/BACKLOG.md § Archiving`).

2. **Single scoped commit** — follow `shared/SCOPED-COMMIT.md`. Deltas:
   - **Baseline**: `.project/session/pre-check-status.txt` (§0). **OVERLAP policy**: interactive.
     **Fallback**: `git add -A`.
   - **Commit**: `audit(batch): {summary}` with per-feature lines (✓ fixed / ✗ rolled back / clean).
   - **Guard**: skip the commit if nothing changed (all-clean path never reaches here).
   - **Cleanup**: remove session files after commit.

3. **Cleanup** `.project/auth-state.json` if auth was used (Restrictions rule).

4. **Completion table:**

   ```
   BATCH CHECK COMPLETE
   ═════════════════════════════════════════════════════════════
   Features audited: [N]   ([X] fixed, [Y] clean, [Z] rolled back)

   feature              result        findings → resolved
   ───────────────────  ────────────  ───────────────────
   checkout-page        ✓ fixed       5 → 5
   pricing-page         ✗ rolled back 2 → 0 (regression)
   nav-bar (COMPONENT)  clean         0

   Commit: audit(batch): {summary}
   Next: /design-create → next page · /project-plan → revise scope
   ═════════════════════════════════════════════════════════════
   ```

**No worktree finalize in batch mode** (single-target only — see SKILL.md PHASE 4.5 / 5).
