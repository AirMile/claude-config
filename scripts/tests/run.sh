#!/usr/bin/env bash
# Smoke-tests for stryker-map-survivors.js.
# Strips volatile fields (timestamps) before diffing against expected JSON fixtures.
#
# Usage: ./scripts/tests/run.sh
# Exit 0 = all checks pass. Exit 1 = at least one mismatch.

set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FX="$ROOT/scripts/fixtures/test-quality"
EX="$FX/expected"
TMP="$FX/tmp"

FFP="$ROOT/scripts/fixtures/feature-from-plan"
FFP_TMP="$FFP/tmp"

mkdir -p "$TMP" "$FFP_TMP"

PASS=0
FAIL=0

# Strip volatile fields (timestamps + sha-injected lastRun).
strip_volatile() {
  jq 'del(.summary.checkedAt, .lastRun)'
}

run_case() {
  local label="$1"
  local expected="$2"
  local actual_raw="$3"

  local actual_norm expected_norm
  actual_norm=$(printf '%s' "$actual_raw" | strip_volatile)
  expected_norm=$(jq '.' < "$expected")

  if diff <(printf '%s' "$expected_norm") <(printf '%s' "$actual_norm") > "$TMP/diff.out" 2>&1; then
    echo "PASS  $label"
    PASS=$((PASS+1))
  else
    echo "FAIL  $label"
    cat "$TMP/diff.out"
    FAIL=$((FAIL+1))
  fi
}

# --- stryker-map-survivors.js ---
# Verifies single-match → requirementId assigned, multi-match → omitted,
# zero-match → unmapped[], killed mutants → not emitted.
run_case "stryker: survivor → requirementId mapping" \
  "$EX/stryker-survivors.json" \
  "$(node "$ROOT/scripts/stryker-map-survivors.js" "$FX/stryker-report.json" "$FX/feature-stryker.json")"

# Pre-v6 fallback: report without `tests`/`coveredBy` → empty survivedDetails[],
# all survivors in unmapped[] (documented in shared/MUTATION-TESTING.md).
# stderr warning is expected; suppress it so test output stays clean.
run_case "stryker: pre-v6 report (no coveredBy) → all unmapped" \
  "$EX/stryker-survivors-prev6.json" \
  "$(node "$ROOT/scripts/stryker-map-survivors.js" "$FX/stryker-report-prev6.json" "$FX/feature-stryker.json" 2>/dev/null)"

# --- feature-from-plan.js ---
# Like run_case but without strip_volatile — feature.json has no timestamp
# fields to strip (and .summary is a string, which strip_volatile can't index).
run_case_plain() {
  local label="$1"
  local expected="$2"
  local actual_raw="$3"

  local actual_norm expected_norm
  actual_norm=$(printf '%s' "$actual_raw" | jq '.')
  expected_norm=$(jq '.' <"$expected")

  if diff <(printf '%s' "$expected_norm") <(printf '%s' "$actual_norm") >"$TMP/diff.out" 2>&1; then
    echo "PASS  $label"
    PASS=$((PASS + 1))
  else
    echo "FAIL  $label"
    cat "$TMP/diff.out"
    FAIL=$((FAIL + 1))
  fi
}

# Asserts exit status of a command matches the expected non-zero-ness.
run_exit_fail() {
  local label="$1"; shift
  if "$@" > /dev/null 2>&1; then
    echo "FAIL  $label (expected non-zero exit, got 0)"
    FAIL=$((FAIL+1))
  else
    echo "PASS  $label"
    PASS=$((PASS+1))
  fi
}

# (a) Fresh write: target does not exist → draft written 1:1.
rm -f "$FFP_TMP/fresh.json"
node "$ROOT/scripts/feature-from-plan.js" "$FFP/plan-valid.md" "$FFP_TMP/fresh.json" 2>/dev/null
run_case_plain "feature-from-plan: fresh write → draft 1:1" \
  "$FFP/expected/fresh.json" \
  "$(cat "$FFP_TMP/fresh.json")"

# (b) Merge over existing feature.json → build/tests/refactor preserved, define-owned keys overwritten.
cp "$FFP/existing-feature.json" "$FFP_TMP/merge.json"
node "$ROOT/scripts/feature-from-plan.js" "$FFP/plan-valid.md" "$FFP_TMP/merge.json" 2>/dev/null
run_case_plain "feature-from-plan: merge preserves build/tests/refactor" \
  "$FFP/expected/merged.json" \
  "$(cat "$FFP_TMP/merge.json")"

# (c) Broken JSON in appendix → non-zero exit.
run_exit_fail "feature-from-plan: broken appendix JSON → non-zero exit" \
  node "$ROOT/scripts/feature-from-plan.js" "$FFP/plan-broken.md" "$FFP_TMP/broken.json"

# --- ship-checkpoint.js ---
# Integration test in a throwaway git repo + worktree. The core property: invoked with cwd
# INSIDE a linked worktree, the script must still write to the MAIN checkout's .project/session/
# (the PHASE 3/4 bug it fixes — .project/session/ is worktree-local, not symlinked).
SC="$ROOT/scripts/ship-checkpoint.js"
SCT=$(mktemp -d)
(
  cd "$SCT" && git init -q && git config user.email t@t.t && git config user.name t &&
    git commit -q --allow-empty -m init && git worktree add -q wt -b sctwt
) >/dev/null 2>&1

# (a) init from inside the worktree lands in MAIN, not the worktree.
(cd "$SCT/wt" && echo '{"pipeline":"dev","feature":"t","status":"running","phase":"PHASE 0","results":{"build":{"status":"green"}}}' | node "$SC" init t) >/dev/null 2>&1
if [ -f "$SCT/.project/session/ship-t.json" ] && [ ! -f "$SCT/wt/.project/session/ship-t.json" ]; then
  echo "PASS  ship-checkpoint: init from worktree writes to main-root"; PASS=$((PASS + 1))
else
  echo "FAIL  ship-checkpoint: init from worktree writes to main-root"; FAIL=$((FAIL + 1))
fi

# (b) patch deep-merges (adds verify, keeps build) and stamps updatedAt.
(cd "$SCT/wt" && echo '{"phase":"PHASE 3","results":{"verify":{"status":"green"}}}' | node "$SC" patch t) >/dev/null 2>&1
MERGED=$(node -e 'const c=require(process.argv[1]);process.stdout.write([c.phase,c.results.build.status,c.results.verify.status,!!c.updatedAt].join("|"))' "$SCT/.project/session/ship-t.json" 2>/dev/null)
if [ "$MERGED" = "PHASE 3|green|green|true" ]; then
  echo "PASS  ship-checkpoint: patch deep-merges + stamps updatedAt"; PASS=$((PASS + 1))
else
  echo "FAIL  ship-checkpoint: patch deep-merges + stamps updatedAt (got: $MERGED)"; FAIL=$((FAIL + 1))
fi

# (c) a null value clears a key.
(cd "$SCT/wt" && echo '{"activeWorkflow":"phase4"}' | node "$SC" patch t && echo '{"activeWorkflow":null}' | node "$SC" patch t) >/dev/null 2>&1
NULLED=$(node -e 'const c=require(process.argv[1]);process.stdout.write(String(c.activeWorkflow))' "$SCT/.project/session/ship-t.json" 2>/dev/null)
if [ "$NULLED" = "null" ]; then
  echo "PASS  ship-checkpoint: null clears a key"; PASS=$((PASS + 1))
else
  echo "FAIL  ship-checkpoint: null clears a key (got: $NULLED)"; FAIL=$((FAIL + 1))
fi

# (d) complete removes the file.
(cd "$SCT/wt" && node "$SC" complete t) >/dev/null 2>&1
if [ ! -f "$SCT/.project/session/ship-t.json" ]; then
  echo "PASS  ship-checkpoint: complete removes the file"; PASS=$((PASS + 1))
else
  echo "FAIL  ship-checkpoint: complete removes the file"; FAIL=$((FAIL + 1))
fi

# (e) patch on a missing checkpoint → non-zero exit.
if (cd "$SCT/wt" && echo '{}' | node "$SC" patch t) >/dev/null 2>&1; then
  echo "FAIL  ship-checkpoint: patch on missing checkpoint → non-zero exit (got 0)"; FAIL=$((FAIL + 1))
else
  echo "PASS  ship-checkpoint: patch on missing checkpoint → non-zero exit"; PASS=$((PASS + 1))
fi
rm -rf "$SCT"

echo
echo "Result: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
