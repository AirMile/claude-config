#!/bin/bash
# Default gate: test suite must stay green.
# Exit 0 = pass, exit 1 = fail (blocks acceptance of the hypothesis).
set -euo pipefail

TEST_CMD="${TEST_CMD:-}"

if [ -z "$TEST_CMD" ]; then
  if grep -q '"test"' package.json 2>/dev/null; then
    TEST_CMD="npm test --silent -- --run"
  else
    echo "No test script found — gate is no-op."
    exit 0
  fi
fi

# Timeout 5 minutes — hanging tests = fail
timeout 300 $TEST_CMD >/dev/null 2>&1
