#!/bin/bash
# Test coverage benchmark — % covered lines via vitest of jest.
# Print één regel: SCORE=<float, 0-100>
set -euo pipefail

# Stack-detect
if grep -q '"vitest"' package.json 2>/dev/null; then
  npx vitest run --coverage --reporter=json-summary >/dev/null 2>&1 || true
  REPORT="coverage/coverage-summary.json"
elif grep -q '"jest"' package.json 2>/dev/null; then
  npx jest --coverage --json --silent >/tmp/jest-cov.json 2>/dev/null || true
  REPORT="coverage/coverage-summary.json"
else
  echo "SCORE=0"
  exit 1
fi

if [ ! -f "$REPORT" ]; then
  echo "SCORE=0"
  exit 1
fi

PCT=$(node -e "const j=require('$PWD/$REPORT'); console.log(j.total.lines.pct.toFixed(2))")
echo "SCORE=$PCT"
