#!/bin/bash
# Default gate: testsuite moet groen blijven.
# Exit 0 = pass, exit 1 = fail (blokkeert acceptance van de hypothese).
set -euo pipefail

TEST_CMD="${TEST_CMD:-}"

if [ -z "$TEST_CMD" ]; then
  if grep -q '"test"' package.json 2>/dev/null; then
    TEST_CMD="npm test --silent -- --run"
  else
    echo "Geen test script gevonden — gate is no-op."
    exit 0
  fi
fi

# Timeout 5 minuten — hangende tests = fail
timeout 300 $TEST_CMD >/dev/null 2>&1
