#!/usr/bin/env bash
# Smoke-tests for test-quality scripts (check-test-smells.js, junit-flakiness.js).
# Strips volatile fields (timestamps) before diffing against expected JSON fixtures.
#
# Usage: ./scripts/tests/run.sh
# Exit 0 = all checks pass. Exit 1 = at least one mismatch.

set -u
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FX="$ROOT/scripts/fixtures/test-quality"
EX="$FX/expected"
TMP="$FX/tmp"
HISTORY="$TMP/flakiness-history.jsonl"

mkdir -p "$TMP"
rm -f "$HISTORY"

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

# --- check-test-smells.js ---
run_case "smells: clean test file" \
  "$EX/smells-clean.json" \
  "$(node "$ROOT/scripts/check-test-smells.js" "scripts/fixtures/test-quality/test-clean.test.ts")"

run_case "smells: over-mocked test file" \
  "$EX/smells-overmocked.json" \
  "$(node "$ROOT/scripts/check-test-smells.js" "scripts/fixtures/test-quality/test-overmocked.test.ts")"

# Baseline drift-margin (DRIFT_MARGIN=0.1): threshold = baselineP90 + 0.1.
run_case "smells: --baseline-p90=0.4 → threshold 0.5" \
  "$EX/smells-baseline-low.json" \
  "$(node "$ROOT/scripts/check-test-smells.js" --baseline-p90=0.4 "scripts/fixtures/test-quality/test-overmocked.test.ts")"

# High baseline (1.05 threshold cannot be reached by mockRatio=1.0) — bypass-rule
# `mockCount >= 5 && behaviorCount === 0` still must trigger overMocking.
run_case "smells: --baseline-p90=0.95 → bypass-rule still triggers" \
  "$EX/smells-baseline-high.json" \
  "$(node "$ROOT/scripts/check-test-smells.js" --baseline-p90=0.95 "scripts/fixtures/test-quality/test-overmocked.test.ts")"

# --- junit-flakiness.js ---
# Fresh history per case for determinism.
rm -f "$HISTORY"
run_case "flakiness: clean junit (empty history)" \
  "$EX/flakiness-clean.json" \
  "$(node "$ROOT/scripts/junit-flakiness.js" "$FX/junit-clean.xml" abc1234 "--history=$HISTORY")"

# Same history → add flaky run on top
run_case "flakiness: flaky junit (after clean run)" \
  "$EX/flakiness-after-flaky.json" \
  "$(node "$ROOT/scripts/junit-flakiness.js" "$FX/junit-flaky.xml" abc1234 "--history=$HISTORY")"

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

# --- history-rotation invariant ---
# After two runs the history file should contain exactly 2 lines.
# (A case that actually hits RETENTION_RUNS=100 would need 100+ runs — too slow
# for a smoke test; this invariant check is the agreed coverage level.)
HIST_LINES=$(wc -l < "$HISTORY" | tr -d ' ')
if [ "$HIST_LINES" = "2" ]; then
  echo "PASS  rotation: history line count after 2 runs == 2"
  PASS=$((PASS+1))
else
  echo "FAIL  rotation: expected 2 lines, got $HIST_LINES"
  FAIL=$((FAIL+1))
fi

echo
echo "Result: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
