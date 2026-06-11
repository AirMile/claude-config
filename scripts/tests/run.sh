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

mkdir -p "$TMP"

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

echo
echo "Result: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
