#!/bin/bash
# Default gate voor game-optimize: GUT testsuite moet groen blijven.
# Exit 0 = pass, exit 1 = fail.
set -euo pipefail

GODOT_BIN="${GODOT_BIN:-$(command -v godot4 || command -v godot)}"
TEST_DIRS="${TEST_DIRS:-test/}"

if [ -z "$GODOT_BIN" ] || [ ! -x "$GODOT_BIN" ]; then
  echo "GODOT_BIN niet gezet of niet executable." >&2
  exit 1
fi

if [ ! -d "addons/gut" ]; then
  echo "GUT niet geïnstalleerd — gate is no-op."
  exit 0
fi

if [ ! -d "$TEST_DIRS" ]; then
  echo "Geen test directory ($TEST_DIRS) — gate is no-op."
  exit 0
fi

# Headless GUT run met timeout. -gexit zorgt dat Godot quit na tests.
OUT=$(timeout 300 "$GODOT_BIN" --headless --path . \
  -s addons/gut/gut_cmdln.gd \
  -gtest_dirs="$TEST_DIRS" \
  -gexit 2>&1)

# Parse fail count uit GUT output
if echo "$OUT" | grep -qE '^Failures:\s*0\b' && echo "$OUT" | grep -qE '^Errors:\s*0\b'; then
  exit 0
else
  echo "$OUT" | tail -30 >&2
  exit 1
fi
