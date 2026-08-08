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

# (d) Compact single-line appendix JSON → identical extraction to the pretty-printed fixture.
rm -f "$FFP_TMP/compact.json"
node "$ROOT/scripts/feature-from-plan.js" "$FFP/plan-compact.md" "$FFP_TMP/compact.json" 2>/dev/null
run_case_plain "feature-from-plan: compact single-line appendix → same as pretty-printed" \
  "$FFP/expected/fresh.json" \
  "$(cat "$FFP_TMP/compact.json")"

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

# (f) signal from inside the worktree lands in MAIN, carries feature/startedAt.
(cd "$SCT/wt" && echo '{"skill":"build"}' | node "$SC" signal t) >/dev/null 2>&1
SIG=$(node -e 'const s=require(process.argv[1]);process.stdout.write([s.feature,s.skill,!!s.startedAt].join("|"))' "$SCT/.project/session/active-t.json" 2>/dev/null)
if [ -f "$SCT/.project/session/active-t.json" ] && [ ! -f "$SCT/wt/.project/session/active-t.json" ] && [ "$SIG" = "t|build|true" ]; then
  echo "PASS  ship-checkpoint: signal writes to main-root with feature/skill/startedAt"; PASS=$((PASS + 1))
else
  echo "FAIL  ship-checkpoint: signal writes to main-root with feature/skill/startedAt (got: $SIG)"; FAIL=$((FAIL + 1))
fi

# (g) signal with a "waiting" field passes it through untouched.
(cd "$SCT/wt" && echo '{"skill":"verify","waiting":"manual-tests"}' | node "$SC" signal t) >/dev/null 2>&1
WAITING=$(node -e 'const s=require(process.argv[1]);process.stdout.write(String(s.waiting))' "$SCT/.project/session/active-t.json" 2>/dev/null)
if [ "$WAITING" = "manual-tests" ]; then
  echo "PASS  ship-checkpoint: signal passes through waiting field"; PASS=$((PASS + 1))
else
  echo "FAIL  ship-checkpoint: signal passes through waiting field (got: $WAITING)"; FAIL=$((FAIL + 1))
fi

# (h) signal without "skill" → non-zero exit.
if (cd "$SCT/wt" && echo '{}' | node "$SC" signal t) >/dev/null 2>&1; then
  echo "FAIL  ship-checkpoint: signal without skill → non-zero exit (got 0)"; FAIL=$((FAIL + 1))
else
  echo "PASS  ship-checkpoint: signal without skill → non-zero exit"; PASS=$((PASS + 1))
fi

# (i) signal-clear removes the file; exit 0 even when it is already gone.
(cd "$SCT/wt" && node "$SC" signal-clear t) >/dev/null 2>&1
if [ ! -f "$SCT/.project/session/active-t.json" ]; then
  echo "PASS  ship-checkpoint: signal-clear removes the file"; PASS=$((PASS + 1))
else
  echo "FAIL  ship-checkpoint: signal-clear removes the file"; FAIL=$((FAIL + 1))
fi
if (cd "$SCT/wt" && node "$SC" signal-clear t) >/dev/null 2>&1; then
  echo "PASS  ship-checkpoint: signal-clear on absent file → exit 0"; PASS=$((PASS + 1))
else
  echo "FAIL  ship-checkpoint: signal-clear on absent file → exit 0"; FAIL=$((FAIL + 1))
fi

# (j) item: append then upsert-by-id → one element, updated fields.
(cd "$SCT/wt" && echo '{"pipeline":"dev","feature":"t","status":"running","phase":"PHASE 3","results":{}}' | node "$SC" init t) >/dev/null 2>&1
(cd "$SCT/wt" && echo '{"id":"MT-1","title":"first","verdict":"fail"}' | node "$SC" item t manual) >/dev/null 2>&1
(cd "$SCT/wt" && echo '{"id":"MT-1","title":"first","verdict":"pass"}' | node "$SC" item t manual) >/dev/null 2>&1
ITEMS=$(node -e 'const c=require(process.argv[1]);process.stdout.write(JSON.stringify(c.manual.items))' "$SCT/.project/session/ship-t.json" 2>/dev/null)
if [ "$ITEMS" = '[{"id":"MT-1","title":"first","verdict":"pass"}]' ]; then
  echo "PASS  ship-checkpoint: item upserts by id (2x same id → 1 element)"; PASS=$((PASS + 1))
else
  echo "FAIL  ship-checkpoint: item upserts by id (2x same id → 1 element) (got: $ITEMS)"; FAIL=$((FAIL + 1))
fi

# (k) item: a second distinct id appends rather than replacing.
(cd "$SCT/wt" && echo '{"id":"MT-2","title":"second","verdict":"skip"}' | node "$SC" item t manual) >/dev/null 2>&1
COUNT=$(node -e 'const c=require(process.argv[1]);process.stdout.write(String(c.manual.items.length))' "$SCT/.project/session/ship-t.json" 2>/dev/null)
if [ "$COUNT" = "2" ]; then
  echo "PASS  ship-checkpoint: item appends a new id"; PASS=$((PASS + 1))
else
  echo "FAIL  ship-checkpoint: item appends a new id (got: $COUNT)"; FAIL=$((FAIL + 1))
fi

# (l) item missing the ledger arg → non-zero exit.
if (cd "$SCT/wt" && echo '{"id":"MT-3"}' | node "$SC" item t) >/dev/null 2>&1; then
  echo "FAIL  ship-checkpoint: item missing ledger arg → non-zero exit (got 0)"; FAIL=$((FAIL + 1))
else
  echo "PASS  ship-checkpoint: item missing ledger arg → non-zero exit"; PASS=$((PASS + 1))
fi

# (m) item on a missing checkpoint → non-zero exit.
(cd "$SCT/wt" && node "$SC" complete t) >/dev/null 2>&1
if (cd "$SCT/wt" && echo '{"id":"MT-1"}' | node "$SC" item t manual) >/dev/null 2>&1; then
  echo "FAIL  ship-checkpoint: item on missing checkpoint → non-zero exit (got 0)"; FAIL=$((FAIL + 1))
else
  echo "PASS  ship-checkpoint: item on missing checkpoint → non-zero exit"; PASS=$((PASS + 1))
fi

# --- ship-checkpoint.js route (deterministic replacement for orchestrator prose routing) ---
# (n) PHASE 1, no results → phase12, resume null.
(cd "$SCT/wt" && echo '{"pipeline":"dev","feature":"r","status":"running","phase":"PHASE 1","results":{}}' | node "$SC" init r) >/dev/null 2>&1
ROUTE_N=$(cd "$SCT/wt" && node "$SC" route r 2>/dev/null)
if [ "$ROUTE_N" = '{"route":"phase12","resume":null}' ]; then
  echo "PASS  ship-checkpoint: route PHASE 1 → phase12, resume null"; PASS=$((PASS + 1))
else
  echo "FAIL  ship-checkpoint: route PHASE 1 → phase12 (got: $ROUTE_N)"; FAIL=$((FAIL + 1))
fi

# (o) a failed verify result routes back to phase12 even though phase says PHASE 3;
# resume carries only the green build (a failed result is never resumed).
(cd "$SCT/wt" && echo '{"phase":"PHASE 3","results":{"build":{"status":"green"},"verify":{"status":"failed"}}}' | node "$SC" patch r) >/dev/null 2>&1
ROUTE_O=$(cd "$SCT/wt" && node "$SC" route r 2>/dev/null)
if [ "$ROUTE_O" = '{"route":"phase12","resume":{"build":{"status":"green"}}}' ]; then
  echo "PASS  ship-checkpoint: route falls back to phase12 on a failed verify result"; PASS=$((PASS + 1))
else
  echo "FAIL  ship-checkpoint: route falls back to phase12 on a failed verify result (got: $ROUTE_O)"; FAIL=$((FAIL + 1))
fi

# (p) build+verify green, remainingManualItems empty → phase3-completion; resume carries both.
(cd "$SCT/wt" && echo '{"results":{"verify":{"status":"green","remainingManualItems":[]}}}' | node "$SC" patch r) >/dev/null 2>&1
ROUTE_P=$(cd "$SCT/wt" && node "$SC" route r 2>/dev/null)
if [ "$ROUTE_P" = '{"route":"phase3-completion","resume":{"build":{"status":"green"},"verify":{"status":"green","remainingManualItems":[]}}}' ]; then
  echo "PASS  ship-checkpoint: route PHASE 3, empty remainingManualItems → phase3-completion"; PASS=$((PASS + 1))
else
  echo "FAIL  ship-checkpoint: route PHASE 3 empty remainingManualItems (got: $ROUTE_P)"; FAIL=$((FAIL + 1))
fi

# (q) non-empty remainingManualItems + an unresolved ledger item (verdict "fail") → phase3-manual.
(cd "$SCT/wt" && echo '{"results":{"verify":{"status":"green","remainingManualItems":["MT-1"]}},"manual":{"items":[{"id":"MT-1","verdict":"fail"}]}}' | node "$SC" patch r) >/dev/null 2>&1
ROUTE_Q=$(cd "$SCT/wt" && node "$SC" route r 2>/dev/null | node -e 'const r=JSON.parse(require("fs").readFileSync(0));process.stdout.write(r.route)')
if [ "$ROUTE_Q" = "phase3-manual" ]; then
  echo "PASS  ship-checkpoint: route PHASE 3, unresolved ledger → phase3-manual"; PASS=$((PASS + 1))
else
  echo "FAIL  ship-checkpoint: route PHASE 3 unresolved ledger (got: $ROUTE_Q)"; FAIL=$((FAIL + 1))
fi

# (r) same non-empty remainingManualItems, but the ledger is now fully resolved
# (pass/skip/defer, no fixPlan, no in-flight dispatch) → phase3-completion overrides it.
(cd "$SCT/wt" && echo '{"manual":{"items":[{"id":"MT-1","verdict":"pass"}]}}' | node "$SC" patch r) >/dev/null 2>&1
ROUTE_R=$(cd "$SCT/wt" && node "$SC" route r 2>/dev/null | node -e 'const r=JSON.parse(require("fs").readFileSync(0));process.stdout.write(r.route)')
if [ "$ROUTE_R" = "phase3-completion" ]; then
  echo "PASS  ship-checkpoint: route PHASE 3, resolved ledger overrides non-empty remainingManualItems"; PASS=$((PASS + 1))
else
  echo "FAIL  ship-checkpoint: route PHASE 3 resolved ledger (got: $ROUTE_R)"; FAIL=$((FAIL + 1))
fi

# (r2) an "accepted" verdict (debug-round-heavy § 8 "Accept anyway") resolves the ledger the
# same as pass/skip/defer → phase3-completion, not a dead end back into phase3-manual.
(cd "$SCT/wt" && echo '{"manual":{"items":[{"id":"MT-1","verdict":"accepted"}]}}' | node "$SC" patch r) >/dev/null 2>&1
ROUTE_R2=$(cd "$SCT/wt" && node "$SC" route r 2>/dev/null | node -e 'const r=JSON.parse(require("fs").readFileSync(0));process.stdout.write(r.route)')
if [ "$ROUTE_R2" = "phase3-completion" ]; then
  echo "PASS  ship-checkpoint: route PHASE 3, \"accepted\" verdict resolves ledger → phase3-completion"; PASS=$((PASS + 1))
else
  echo "FAIL  ship-checkpoint: route PHASE 3 \"accepted\" verdict (got: $ROUTE_R2)"; FAIL=$((FAIL + 1))
fi

# (r3) an "offloaded" verdict (an out-of-scope split-off item handed to its own
# backlog card, shared/FEEDBACK-CATEGORIZATION.md § Scope check) resolves the
# ledger the same as tweak/accepted → phase3-completion, not a dead end.
(cd "$SCT/wt" && echo '{"manual":{"items":[{"id":"MT-1","verdict":"offloaded","offload":"bug-x"}]}}' | node "$SC" patch r) >/dev/null 2>&1
ROUTE_R3=$(cd "$SCT/wt" && node "$SC" route r 2>/dev/null | node -e 'const r=JSON.parse(require("fs").readFileSync(0));process.stdout.write(r.route)')
if [ "$ROUTE_R3" = "phase3-completion" ]; then
  echo "PASS  ship-checkpoint: route PHASE 3, \"offloaded\" verdict resolves ledger → phase3-completion"; PASS=$((PASS + 1))
else
  echo "FAIL  ship-checkpoint: route PHASE 3 \"offloaded\" verdict (got: $ROUTE_R3)"; FAIL=$((FAIL + 1))
fi
(cd "$SCT/wt" && echo '{"manual":{"items":[{"id":"MT-1","verdict":"pass"}]}}' | node "$SC" patch r) >/dev/null 2>&1

# (r4) a "tweak" verdict WITHOUT an "offload" field does NOT resolve the ledger —
# the inline-fix band (dev-ship/references/phase-3-manual-finalize.md § Inline fix
# now) must flip it to "pass", and the offload flush always writes "offload"
# alongside "tweak"; a bare "tweak" here means neither happened yet.
(cd "$SCT/wt" && echo '{"manual":{"items":[{"id":"MT-1","verdict":"tweak"}]}}' | node "$SC" patch r) >/dev/null 2>&1
ROUTE_R4=$(cd "$SCT/wt" && node "$SC" route r 2>/dev/null | node -e 'const r=JSON.parse(require("fs").readFileSync(0));process.stdout.write(r.route)')
if [ "$ROUTE_R4" = "phase3-manual" ]; then
  echo "PASS  ship-checkpoint: route PHASE 3, bare \"tweak\" verdict (no offload) stays open → phase3-manual"; PASS=$((PASS + 1))
else
  echo "FAIL  ship-checkpoint: route PHASE 3 bare \"tweak\" verdict (got: $ROUTE_R4)"; FAIL=$((FAIL + 1))
fi

# (r5) a "tweak" verdict WITH an "offload" field resolves the ledger, same as
# "offloaded" — the card was created, so the finding was handed off.
(cd "$SCT/wt" && echo '{"manual":{"items":[{"id":"MT-1","verdict":"tweak","offload":"tweak-x"}]}}' | node "$SC" patch r) >/dev/null 2>&1
ROUTE_R5=$(cd "$SCT/wt" && node "$SC" route r 2>/dev/null | node -e 'const r=JSON.parse(require("fs").readFileSync(0));process.stdout.write(r.route)')
if [ "$ROUTE_R5" = "phase3-completion" ]; then
  echo "PASS  ship-checkpoint: route PHASE 3, \"tweak\" verdict with offload resolves ledger → phase3-completion"; PASS=$((PASS + 1))
else
  echo "FAIL  ship-checkpoint: route PHASE 3 \"tweak\"+offload verdict (got: $ROUTE_R5)"; FAIL=$((FAIL + 1))
fi
(cd "$SCT/wt" && echo '{"manual":{"items":[{"id":"MT-1","verdict":"pass"}]}}' | node "$SC" patch r) >/dev/null 2>&1

# (s) an in-flight fix dispatch keeps the ledger open → phase3-manual even with all-pass items.
(cd "$SCT/wt" && echo '{"activeWorkflow":"phase3fix"}' | node "$SC" patch r) >/dev/null 2>&1
ROUTE_S=$(cd "$SCT/wt" && node "$SC" route r 2>/dev/null | node -e 'const r=JSON.parse(require("fs").readFileSync(0));process.stdout.write(r.route)')
if [ "$ROUTE_S" = "phase3-manual" ]; then
  echo "PASS  ship-checkpoint: route in-flight phase3fix dispatch → phase3-manual"; PASS=$((PASS + 1))
else
  echo "FAIL  ship-checkpoint: route in-flight phase3fix dispatch (got: $ROUTE_S)"; FAIL=$((FAIL + 1))
fi
(cd "$SCT/wt" && echo '{"activeWorkflow":null}' | node "$SC" patch r) >/dev/null 2>&1

# (t) PHASE 4, no refactor result yet → phase4.
(cd "$SCT/wt" && echo '{"phase":"PHASE 4","results":{"refactor":null}}' | node "$SC" patch r) >/dev/null 2>&1
ROUTE_T=$(cd "$SCT/wt" && node "$SC" route r 2>/dev/null | node -e 'const r=JSON.parse(require("fs").readFileSync(0));process.stdout.write(r.route)')
if [ "$ROUTE_T" = "phase4" ]; then
  echo "PASS  ship-checkpoint: route PHASE 4, no refactor result → phase4"; PASS=$((PASS + 1))
else
  echo "FAIL  ship-checkpoint: route PHASE 4 no refactor (got: $ROUTE_T)"; FAIL=$((FAIL + 1))
fi

# (u) PHASE 4, refactor already applied → phase4-finalize-only; resume carries it too.
(cd "$SCT/wt" && echo '{"results":{"refactor":{"status":"applied"}}}' | node "$SC" patch r) >/dev/null 2>&1
ROUTE_U=$(cd "$SCT/wt" && node "$SC" route r 2>/dev/null)
if [ "$ROUTE_U" = '{"route":"phase4-finalize-only","resume":{"build":{"status":"green"},"verify":{"status":"green","remainingManualItems":["MT-1"]},"refactor":{"status":"applied"}}}' ]; then
  echo "PASS  ship-checkpoint: route PHASE 4 with applied refactor → phase4-finalize-only"; PASS=$((PASS + 1))
else
  echo "FAIL  ship-checkpoint: route PHASE 4 with applied refactor (got: $ROUTE_U)"; FAIL=$((FAIL + 1))
fi
# (u2) results.triage present → carried into resume (a PHASE 4 respawn must not re-run scanners).
(cd "$SCT/wt" && echo '{"results":{"triage":{"confirmed":[],"dismissed":[],"summary":"clean"}}}' | node "$SC" patch r) >/dev/null 2>&1
ROUTE_U2=$(cd "$SCT/wt" && node "$SC" route r 2>/dev/null | node -e 'const r=JSON.parse(require("fs").readFileSync(0));process.stdout.write(JSON.stringify(r.resume.triage))')
if [ "$ROUTE_U2" = '{"confirmed":[],"dismissed":[],"summary":"clean"}' ]; then
  echo "PASS  ship-checkpoint: route carries results.triage into resume.triage"; PASS=$((PASS + 1))
else
  echo "FAIL  ship-checkpoint: route resume.triage (got: $ROUTE_U2)"; FAIL=$((FAIL + 1))
fi

(cd "$SCT/wt" && node "$SC" complete r) >/dev/null 2>&1

# (v) route on a missing checkpoint → non-zero exit.
if (cd "$SCT/wt" && node "$SC" route r) >/dev/null 2>&1; then
  echo "FAIL  ship-checkpoint: route on missing checkpoint → non-zero exit (got 0)"; FAIL=$((FAIL + 1))
else
  echo "PASS  ship-checkpoint: route on missing checkpoint → non-zero exit"; PASS=$((PASS + 1))
fi

# (w) item: a JSON array on stdin batch-upserts (one update + one append) in a single atomic write.
(cd "$SCT/wt" && echo '{"pipeline":"dev","feature":"b","status":"running","phase":"PHASE 3","results":{},"manual":{"items":[{"id":"MT-1","verdict":"fail"}]}}' | node "$SC" init b) >/dev/null 2>&1
(cd "$SCT/wt" && echo '[{"id":"MT-1","verdict":"pass"},{"id":"MT-2","verdict":"skip"}]' | node "$SC" item b manual) >/dev/null 2>&1
BATCH=$(node -e 'const c=require(process.argv[1]);process.stdout.write(JSON.stringify(c.manual.items))' "$SCT/.project/session/ship-b.json" 2>/dev/null)
if [ "$BATCH" = '[{"id":"MT-1","verdict":"pass"},{"id":"MT-2","verdict":"skip"}]' ]; then
  echo "PASS  ship-checkpoint: item batch array upserts + appends in one atomic write"; PASS=$((PASS + 1))
else
  echo "FAIL  ship-checkpoint: item batch array (got: $BATCH)"; FAIL=$((FAIL + 1))
fi
(cd "$SCT/wt" && node "$SC" complete b) >/dev/null 2>&1

rm -rf "$SCT"

# --- state-files.py (project-sync manifest copy) ---
# Verifies collect includes the manifest subset + state-manifest.json and excludes
# the denylist (session/, auth-state.json, screenshots/) and regenerables
# (stryker-report.json); restore round-trips content, enforces the include-list
# (drops a branch-planted report), and skips symlinks.
SF="$ROOT/skills/project-sync/scripts/state-files.py"
SFT="$(mktemp -d)"
mkdir -p "$SFT/proj/.project"/{session,features/f1,features/archive/2026-01-10-shipped-f,archive,thinking,screenshots}
printf '{"a":1}\n' >"$SFT/proj/.project/project.json"
printf '{"b":2}\n' >"$SFT/proj/.project/backlog.json"
printf '# seed\n' >"$SFT/proj/.project/project-seed.md"
printf '{"id":"f1"}\n' >"$SFT/proj/.project/features/f1/feature.json"
printf '{"s":1}\n' >"$SFT/proj/.project/features/f1/stryker-report.json"
# Shipped feature moved to features/archive/{date}-{name}/ by dev-refactor's
# completion-batch — durableDecisions[] here must still travel (the leak this
# test guards against: a fresh clone otherwise loses every shipped feature's why).
printf '{"id":"shipped-f","durableDecisions":[{"decision":"x"}]}\n' \
  >"$SFT/proj/.project/features/archive/2026-01-10-shipped-f/feature.json"
printf '{"s":1}\n' \
  >"$SFT/proj/.project/features/archive/2026-01-10-shipped-f/stryker-report.json"
printf '{"arch":[]}\n' >"$SFT/proj/.project/archive/backlog-archive.json"
printf '# t\n' >"$SFT/proj/.project/thinking/t1.md"
printf '{"sess":1}\n' >"$SFT/proj/.project/session/state-sync.json"
printf '{"cookie":"x"}\n' >"$SFT/proj/.project/auth-state.json"
printf 'PNG\n' >"$SFT/proj/.project/screenshots/a.png"

python3 "$SF" collect --project "$SFT/proj" --dest "$SFT/branch" >/dev/null 2>&1
# In the real flow restore reads from a detached git worktree, whose root holds a
# .git marker file — simulate it so we assert restore never copies .git into .project/.
printf 'gitdir: /somewhere/worktrees/state-sync\n' >"$SFT/branch/.git"
# Tamper the branch (a fresh feature dir, so the collect-exclusion loop below still
# validates collect's own output): plant a report the include-list must drop on
# restore, and (where supported) a symlink restore must skip rather than follow out.
mkdir -p "$SFT/branch/features/f2"
printf '{"s":1}\n' >"$SFT/branch/features/f2/stryker-report.json"
HAVE_SYMLINK=0
if ln -s /etc/hostname "$SFT/branch/evil.json" 2>/dev/null; then HAVE_SYMLINK=1; fi
python3 "$SF" restore --src "$SFT/branch" --project "$SFT/proj2" >/dev/null 2>&1

sf_ok=1
# Included in the branch.
for want in project.json backlog.json project-seed.md features/f1/feature.json \
            features/archive/2026-01-10-shipped-f/feature.json \
            archive/backlog-archive.json thinking/t1.md state-manifest.json; do
  [ -f "$SFT/branch/$want" ] || { echo "  missing in branch: $want"; sf_ok=0; }
done
# Excluded from the branch (denylist + regenerable).
for deny in session/state-sync.json auth-state.json screenshots/a.png \
            features/f1/stryker-report.json \
            features/archive/2026-01-10-shipped-f/stryker-report.json; do
  [ -e "$SFT/branch/$deny" ] && { echo "  leaked to branch: $deny"; sf_ok=0; }
done
grep -q '"durableDecisions"' "$SFT/branch/features/archive/2026-01-10-shipped-f/feature.json" 2>/dev/null \
  || { echo "  archived durableDecisions content lost in transit"; sf_ok=0; }
# Restore round-trips content and never writes a denylisted path.
[ "$(cat "$SFT/proj2/.project/project.json")" = '{"a":1}' ] || { echo "  restore content mismatch"; sf_ok=0; }
[ -e "$SFT/proj2/.project/auth-state.json" ] && { echo "  restore wrote denylisted auth-state.json"; sf_ok=0; }
[ -e "$SFT/proj2/.project/state-manifest.json" ] && { echo "  restore wrote branch metadata into .project/"; sf_ok=0; }
[ -e "$SFT/proj2/.project/.git" ] && { echo "  restore leaked the worktree .git marker"; sf_ok=0; }
# Include-list gate: a report planted directly on the branch must not be restored.
[ -e "$SFT/proj2/.project/features/f2/stryker-report.json" ] && { echo "  restore wrote a branch-planted report"; sf_ok=0; }
# Archived feature dossier round-trips through restore too.
[ -f "$SFT/proj2/.project/features/archive/2026-01-10-shipped-f/feature.json" ] \
  || { echo "  restore dropped the archived feature dossier"; sf_ok=0; }
# Symlink skip: restore must not follow a symlink out of .project/.
if [ "$HAVE_SYMLINK" -eq 1 ]; then
  [ -e "$SFT/proj2/.project/evil.json" ] && { echo "  restore followed a symlink"; sf_ok=0; }
fi

if [ "$sf_ok" -eq 1 ]; then
  echo "PASS  state-files: collect/restore manifest + denylist"; PASS=$((PASS + 1))
else
  echo "FAIL  state-files: collect/restore manifest + denylist"; FAIL=$((FAIL + 1))
fi
rm -rf "$SFT"

# --- completion-sync.js ---
# Integration test in a throwaway git repo + worktree: the 3-file DONE-sync
# (feature.json + backlog.json + project-context.json/project.json), run with
# cwd INSIDE a linked worktree to prove writes land in the MAIN checkout.
CS="$ROOT/scripts/completion-sync.js"
CSFX="$ROOT/scripts/fixtures/completion-sync"
CST=$(mktemp -d)
(
  cd "$CST" && git init -q && git config user.email t@t.t && git config user.name t &&
    git commit -q --allow-empty -m init && git worktree add -q wt -b cswt
) >/dev/null 2>&1

cs_reset() {
  rm -rf "$CST/.project"
  mkdir -p "$CST/.project/features/auth-login" "$CST/.project/features/run-marker-feature" "$CST/.project/features/orphan-feature"
  cp "$CSFX/feature.json" "$CST/.project/features/auth-login/feature.json"
  cp "$CSFX/feature-run-marker.json" "$CST/.project/features/run-marker-feature/feature.json"
  cp "$CSFX/feature-orphan.json" "$CST/.project/features/orphan-feature/feature.json"
  cp "$CSFX/backlog.json" "$CST/.project/backlog.json"
  cp "$CSFX/project-context.json" "$CST/.project/project-context.json"
  cp "$CSFX/project.json" "$CST/.project/project.json"
}

cs_feature() { node -e "console.log(JSON.stringify(require(process.argv[1])))" "$CST/.project/features/$1/feature.json"; }
cs_backlog_entry() { node -e "const b=require(process.argv[1]);console.log(JSON.stringify(b.features.find(f=>f.name===process.argv[2]) ?? null))" "$CST/.project/backlog.json" "$1"; }

# (a) happy path: all PASS → finalStatus PASSED, evaluation carries scores,
# session counts, backlog flips DONE and drops stage/transition (non-shipping),
# and — the worktree property — nothing is written under wt/.project/.
cs_reset
CS_OUT=$(cd "$CST/wt" && cat "$CSFX/payloads/happy.json" | node "$CS" sync auth-login 2>&1)
CS_CODE=$?
CS_F=$(cs_feature auth-login)
CS_STATUS=$(node -e 'const f=JSON.parse(process.argv[1]);process.stdout.write(f.status)' "$CS_F")
CS_FINAL=$(node -e 'const f=JSON.parse(process.argv[1]);process.stdout.write(f.tests.finalStatus)' "$CS_F")
CS_SESSION=$(node -e 'const f=JSON.parse(process.argv[1]);const s=f.tests.sessions.at(-1);process.stdout.write([s.pass,s.fail,s.skip,"fixes" in s].join("|"))' "$CS_F")
CS_EVAL=$(node -e 'const f=JSON.parse(process.argv[1]);const e=f.tests.evaluation.find(x=>x.reqId==="REQ-001");process.stdout.write([e.verdict,e.acceptancePass,e.builderTotal].join("|"))' "$CS_F")
CS_R3=$(node -e 'const f=JSON.parse(process.argv[1]);const r=f.requirements.find(x=>x.id==="REQ-003");process.stdout.write(String(r.status))' "$CS_F")
CS_BL=$(cs_backlog_entry auth-login)
CS_BL_CHECK=$(node -e 'const e=JSON.parse(process.argv[1]);process.stdout.write([e.status,"stage" in e,"transition" in e].join("|"))' "$CS_BL")
if [ "$CS_CODE" -eq 0 ] && [ "$CS_STATUS" = "DONE" ] && [ "$CS_FINAL" = "PASSED" ] \
  && [ "$CS_SESSION" = "2|0|0|false" ] && [ "$CS_EVAL" = "PASS|2|3" ] && [ "$CS_R3" = "undefined" ] \
  && [ "$CS_BL_CHECK" = "DONE|false|false" ] && [ ! -f "$CST/wt/.project/features/auth-login/feature.json" ]; then
  echo "PASS  completion-sync: happy path → PASSED, scores, session counts, backlog flip, main-root write"; PASS=$((PASS + 1))
else
  echo "FAIL  completion-sync: happy path (code=$CS_CODE status=$CS_STATUS final=$CS_FINAL session=$CS_SESSION eval=$CS_EVAL req3=$CS_R3 backlog=$CS_BL_CHECK)"; FAIL=$((FAIL + 1))
fi

# (b) 1x BLOCKED, 0 FAIL → PARTIAL.
cs_reset
(cd "$CST/wt" && cat "$CSFX/payloads/partial.json" | node "$CS" sync auth-login) >/dev/null 2>&1
CS_FINAL_P=$(node -e 'const f=require(process.argv[1]);process.stdout.write(f.tests.finalStatus)' "$CST/.project/features/auth-login/feature.json")
if [ "$CS_FINAL_P" = "PARTIAL" ]; then
  echo "PASS  completion-sync: 1x BLOCKED, 0 FAIL → PARTIAL"; PASS=$((PASS + 1))
else
  echo "FAIL  completion-sync: 1x BLOCKED, 0 FAIL → PARTIAL (got: $CS_FINAL_P)"; FAIL=$((FAIL + 1))
fi

# (c) 1x FAIL → FAILED.
cs_reset
(cd "$CST/wt" && cat "$CSFX/payloads/failed.json" | node "$CS" sync auth-login) >/dev/null 2>&1
CS_FINAL_F=$(node -e 'const f=require(process.argv[1]);process.stdout.write(f.tests.finalStatus)' "$CST/.project/features/auth-login/feature.json")
if [ "$CS_FINAL_F" = "FAILED" ]; then
  echo "PASS  completion-sync: 1x FAIL → FAILED"; PASS=$((PASS + 1))
else
  echo "FAIL  completion-sync: 1x FAIL → FAILED (got: $CS_FINAL_F)"; FAIL=$((FAIL + 1))
fi

# (d) missing verdict for an active requirement → exit 6, feature.json untouched.
cs_reset
if (cd "$CST/wt" && cat "$CSFX/payloads/missing-verdict.json" | node "$CS" sync auth-login) >/dev/null 2>&1; then
  echo "FAIL  completion-sync: missing verdict → non-zero exit (got 0)"; FAIL=$((FAIL + 1))
else
  CS_UNCHANGED=$(node -e 'const f=require(process.argv[1]);process.stdout.write(f.status)' "$CST/.project/features/auth-login/feature.json")
  if [ "$CS_UNCHANGED" = "DOING" ]; then
    echo "PASS  completion-sync: missing verdict → exit 6, feature.json untouched"; PASS=$((PASS + 1))
  else
    echo "FAIL  completion-sync: missing verdict → feature.json was mutated (status=$CS_UNCHANGED)"; FAIL=$((FAIL + 1))
  fi
fi

# (e) transition:"shipping" survives; a non-shipping transition + stage do not.
cs_reset
(cd "$CST/wt" && cat "$CSFX/payloads/marker.json" | node "$CS" sync run-marker-feature) >/dev/null 2>&1
CS_MARKER=$(cs_backlog_entry run-marker-feature)
CS_MARKER_CHECK=$(node -e 'const e=JSON.parse(process.argv[1]);process.stdout.write([e.status,e.transition].join("|"))' "$CS_MARKER")
if [ "$CS_MARKER_CHECK" = "DONE|shipping" ]; then
  echo "PASS  completion-sync: transition:shipping survives the sync"; PASS=$((PASS + 1))
else
  echo "FAIL  completion-sync: transition:shipping survives the sync (got: $CS_MARKER_CHECK)"; FAIL=$((FAIL + 1))
fi

# (f) a forbidden refactor-owned key anywhere in the payload → exit 6, nothing written.
cs_reset
if (cd "$CST/wt" && cat "$CSFX/payloads/forbidden.json" | node "$CS" sync auth-login) >/dev/null 2>&1; then
  echo "FAIL  completion-sync: forbidden key in payload → non-zero exit (got 0)"; FAIL=$((FAIL + 1))
else
  CS_UNCHANGED2=$(node -e 'const f=require(process.argv[1]);process.stdout.write(f.status)' "$CST/.project/features/auth-login/feature.json")
  if [ "$CS_UNCHANGED2" = "DOING" ]; then
    echo "PASS  completion-sync: forbidden key in payload → exit 6, nothing written"; PASS=$((PASS + 1))
  else
    echo "FAIL  completion-sync: forbidden key in payload → feature.json was mutated"; FAIL=$((FAIL + 1))
  fi
fi

# (g) feature name with no backlog match → exit 7, feature.json IS written, backlog untouched.
cs_reset
if (cd "$CST/wt" && cat "$CSFX/payloads/orphan.json" | node "$CS" sync orphan-feature) >/dev/null 2>&1; then
  echo "FAIL  completion-sync: no backlog match → non-zero exit (got 0)"; FAIL=$((FAIL + 1))
else
  CS_ORPHAN_STATUS=$(node -e 'const f=require(process.argv[1]);process.stdout.write(f.status)' "$CST/.project/features/orphan-feature/feature.json")
  CS_BL_LEN=$(node -e 'const b=require(process.argv[1]);process.stdout.write(String(b.features.length))' "$CST/.project/backlog.json")
  if [ "$CS_ORPHAN_STATUS" = "DONE" ] && [ "$CS_BL_LEN" = "3" ]; then
    echo "PASS  completion-sync: no backlog match → exit 7, feature.json written, backlog untouched"; PASS=$((PASS + 1))
  else
    echo "FAIL  completion-sync: no backlog match (status=$CS_ORPHAN_STATUS backlogLen=$CS_BL_LEN)"; FAIL=$((FAIL + 1))
  fi
fi

# (h) seedPages → new PAGE backlog entry with the exact expected shape.
cs_reset
(cd "$CST/wt" && cat "$CSFX/payloads/seedpages.json" | node "$CS" sync auth-login) >/dev/null 2>&1
CS_PAGE=$(cs_backlog_entry admin-settings)
CS_PAGE_CHECK=$(node -e 'const e=JSON.parse(process.argv[1]);process.stdout.write([e.type,e.status,e.phase,e.source,e.parentFeature,e.auto,JSON.stringify(e.dependencies)].join("|"))' "$CS_PAGE")
if [ "$CS_PAGE_CHECK" = "PAGE|TODO|P3|/dev-verify|auth-login|true|[\"auth-login\"]" ]; then
  echo "PASS  completion-sync: seedPages pushes the expected PAGE shape"; PASS=$((PASS + 1))
else
  echo "FAIL  completion-sync: seedPages shape (got: $CS_PAGE_CHECK)"; FAIL=$((FAIL + 1))
fi

# (i) componentSync merges into architecture.components[] + designComponent upserts project.json.
cs_reset
(cd "$CST/wt" && cat "$CSFX/payloads/designcomponent.json" | node "$CS" sync auth-login) >/dev/null 2>&1
CS_ARCH=$(node -e 'const c=require(process.argv[1]);const a=c.architecture.components.find(x=>x.name==="auth");process.stdout.write([a.status,a.src.includes("src/auth/session.ts"),a.src.includes("src/auth/oauth.ts")].join("|"))' "$CST/.project/project-context.json")
CS_DESIGN=$(node -e 'const p=require(process.argv[1]);const c=p.design.components.find(x=>x.name==="LoginForm");process.stdout.write(c?c.status:"missing")' "$CST/.project/project.json")
CS_INV=$(node -e 'const c=require(process.argv[1]);const i=c.components.find(x=>x.name==="LoginForm");process.stdout.write(JSON.stringify(i.test))' "$CST/.project/project-context.json")
if [ "$CS_ARCH" = "done|true|true" ] && [ "$CS_DESIGN" = "DONE" ] && [ "$CS_INV" = '["src/auth/oauth.test.ts"]' ]; then
  echo "PASS  completion-sync: componentSync merge + designComponent upsert"; PASS=$((PASS + 1))
else
  echo "FAIL  completion-sync: componentSync/designComponent (arch=$CS_ARCH design=$CS_DESIGN inv=$CS_INV)"; FAIL=$((FAIL + 1))
fi

# (j) knownIssues: written to both feature.json#tests.knownIssues and the backlog entry.
cs_reset
(cd "$CST/wt" && cat "$CSFX/payloads/knownissues.json" | node "$CS" sync auth-login) >/dev/null 2>&1
CS_KI_F=$(node -e 'const f=require(process.argv[1]);const k=f.tests.knownIssues;process.stdout.write(k&&k.length===1?[k[0].id,k[0].verdict,k[0].source].join("|"):"missing")' "$CST/.project/features/auth-login/feature.json")
CS_KI_BL=$(node -e 'const b=require(process.argv[1]);const e=b.features.find(x=>x.name==="auth-login");const k=e.knownIssues;process.stdout.write(k&&k.length===1?[k[0].id,k[0].verdict].join("|"):"missing")' "$CST/.project/backlog.json")
if [ "$CS_KI_F" = "REQ-002|deferred|ship-ledger" ] && [ "$CS_KI_BL" = "REQ-002|deferred" ]; then
  echo "PASS  completion-sync: knownIssues written to feature.json + backlog entry"; PASS=$((PASS + 1))
else
  echo "FAIL  completion-sync: knownIssues write (feature=$CS_KI_F backlog=$CS_KI_BL)"; FAIL=$((FAIL + 1))
fi

# (k) knownIssues upsert: a second sync with the same id replaces it in place, a new id appends.
(cd "$CST/wt" && cat "$CSFX/payloads/knownissues-update.json" | node "$CS" sync auth-login) >/dev/null 2>&1
CS_KI_UPD=$(node -e 'const f=require(process.argv[1]);const k=f.tests.knownIssues;process.stdout.write([k.length,k.find(x=>x.id==="REQ-002").verdict,!!k.find(x=>x.id==="REQ-001")].join("|"))' "$CST/.project/features/auth-login/feature.json")
if [ "$CS_KI_UPD" = "2|accepted|true" ]; then
  echo "PASS  completion-sync: knownIssues upsert (replace by id + append new id)"; PASS=$((PASS + 1))
else
  echo "FAIL  completion-sync: knownIssues upsert (got: $CS_KI_UPD)"; FAIL=$((FAIL + 1))
fi

# (l) knownIssues validation: unknown verdict → exit 6, nothing written.
cs_reset
CS_KI_INVALID_OUT=$(cd "$CST/wt" && cat "$CSFX/payloads/knownissues-invalid.json" | node "$CS" sync auth-login 2>&1)
CS_KI_INVALID_CODE=$?
if [ "$CS_KI_INVALID_CODE" -eq 6 ] && [ ! -f "$CST/.project/features/auth-login/feature.json.tmp" ] \
  && [ "$(cs_backlog_entry auth-login | node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(0)).status)')" != "DONE" ]; then
  echo "PASS  completion-sync: knownIssues invalid verdict → exit 6, nothing written"; PASS=$((PASS + 1))
else
  echo "FAIL  completion-sync: knownIssues invalid verdict (code=$CS_KI_INVALID_CODE out=$CS_KI_INVALID_OUT)"; FAIL=$((FAIL + 1))
fi

# (m) a deferred knownIssue with a valid blocker → auto-creates a verify-{feature} VERIFY card
# with dependencies, and sets hasDeferred on both feature.json and the backlog entry.
cs_reset
(cd "$CST/wt" && cat "$CSFX/payloads/knownissues-deferred-blocker.json" | node "$CS" sync auth-login) >/dev/null 2>&1
CS_VC_F=$(node -e 'const f=require(process.argv[1]);process.stdout.write(String(!!f.tests.hasDeferred))' "$CST/.project/features/auth-login/feature.json")
CS_VC_BL=$(cs_backlog_entry auth-login)
CS_VC_BL_HD=$(node -e 'const e=JSON.parse(process.argv[1]);process.stdout.write(String(!!e.hasDeferred))' "$CS_VC_BL")
CS_VC_CARD=$(node -e 'const b=require(process.argv[1]);const c=b.features.find(f=>f.name==="verify-auth-login");process.stdout.write(c?[c.type,c.status,c.parentFeature,JSON.stringify(c.dependencies)].join("|"):"missing")' "$CST/.project/backlog.json")
if [ "$CS_VC_F" = "true" ] && [ "$CS_VC_BL_HD" = "true" ] \
  && [ "$CS_VC_CARD" = 'VERIFY|TODO|auth-login|["unrelated-feature"]' ]; then
  echo "PASS  completion-sync: deferred + blocker → verify-{feature} VERIFY card + hasDeferred"; PASS=$((PASS + 1))
else
  echo "FAIL  completion-sync: deferred + blocker (feature=$CS_VC_F backlogHasDeferred=$CS_VC_BL_HD card=$CS_VC_CARD)"; FAIL=$((FAIL + 1))
fi

# (n) a second sync with the same deferred+blocker payload upserts the same card, not a duplicate.
(cd "$CST/wt" && cat "$CSFX/payloads/knownissues-deferred-blocker.json" | node "$CS" sync auth-login) >/dev/null 2>&1
CS_VC_COUNT=$(node -e 'const b=require(process.argv[1]);process.stdout.write(String(b.features.filter(f=>f.name==="verify-auth-login").length))' "$CST/.project/backlog.json")
if [ "$CS_VC_COUNT" = "1" ]; then
  echo "PASS  completion-sync: verify-{feature} card upsert (re-run does not duplicate)"; PASS=$((PASS + 1))
else
  echo "FAIL  completion-sync: verify-{feature} card upsert (count=$CS_VC_COUNT)"; FAIL=$((FAIL + 1))
fi

# (o) accepted-only knownIssues → no VERIFY card, no hasDeferred.
cs_reset
(cd "$CST/wt" && cat "$CSFX/payloads/knownissues-accepted-only.json" | node "$CS" sync auth-login) >/dev/null 2>&1
CS_ACC_F=$(node -e 'const f=require(process.argv[1]);process.stdout.write(String(!!f.tests.hasDeferred))' "$CST/.project/features/auth-login/feature.json")
CS_ACC_CARD=$(node -e 'const b=require(process.argv[1]);process.stdout.write(String(b.features.some(f=>f.name==="verify-auth-login")))' "$CST/.project/backlog.json")
if [ "$CS_ACC_F" = "false" ] && [ "$CS_ACC_CARD" = "false" ]; then
  echo "PASS  completion-sync: accepted-only knownIssues → no VERIFY card, no hasDeferred"; PASS=$((PASS + 1))
else
  echo "FAIL  completion-sync: accepted-only knownIssues (hasDeferred=$CS_ACC_F card-exists=$CS_ACC_CARD)"; FAIL=$((FAIL + 1))
fi

rm -rf "$CST"

# --- learnings-search.js ---
# Relevance-scored memory loader/search. .project/ is gitignored, so fixtures are
# stored flat (context.json / archive-2025-01.json) and staged into a temp
# .project/ layout here. Asserts on grep/count so the volatile recency sub-score
# (Date.now-derived) never affects pass/fail — it only orders equal-base entries.
LS="$ROOT/scripts/learnings-search.js"
LSFX="$ROOT/scripts/fixtures/learnings-search"
LST=$(mktemp -d)
mkdir -p "$LST/.project/archive"
cp "$LSFX/context.json" "$LST/.project/project-context.json"
cp "$LSFX/archive-2025-01.json" "$LST/.project/archive/learnings-2025-01.json"

assert_contains() { # label, needle, haystack
  if printf '%s' "$3" | grep -qF "$2"; then
    echo "PASS  $1"; PASS=$((PASS + 1))
  else
    echo "FAIL  $1 (expected to contain: $2)"; echo "$3"; FAIL=$((FAIL + 1))
  fi
}
assert_absent() { # label, needle, haystack
  if printf '%s' "$3" | grep -qF "$2"; then
    echo "FAIL  $1 (should NOT contain: $2)"; echo "$3"; FAIL=$((FAIL + 1))
  else
    echo "PASS  $1"; PASS=$((PASS + 1))
  fi
}

# (a) query "auth" ranks the old 2024 tagged auth pitfall above newer irrelevant
#     entries — relevance beats recency (the core fix for problem 1).
A_TOP=$(node "$LS" "$LST" search --query auth --json 2>/dev/null | node -e 'const r=JSON.parse(require("fs").readFileSync(0));process.stdout.write((r[0]&&r[0].feature)||"")')
if [ "$A_TOP" = "auth-login" ] || [ "$A_TOP" = "auth-oauth" ]; then
  echo "PASS  learnings-search: relevance beats recency (auth query → auth entry on top)"; PASS=$((PASS + 1))
else
  echo "FAIL  learnings-search: relevance beats recency (got top feature: $A_TOP)"; FAIL=$((FAIL + 1))
fi

# (b) pitfall scope with feature context surfaces the ARCHIVED auth pitfall
#     (the core fix for problem 2 — archive is reachable by relevance).
B_OUT=$(node "$LS" "$LST" search --scope pitfall --feature auth-login --archive 2>/dev/null)
assert_contains "learnings-search: archived auth pitfall surfaces for auth-login" "auth-oauth" "$B_OUT"
assert_contains "learnings-search: archived entry is flagged" "(archived)" "$B_OUT"

# (b2) same archived pitfall must NOT surface for an unrelated feature.
B2_OUT=$(node "$LS" "$LST" search --scope pitfall --feature checkout --archive 2>/dev/null)
assert_absent "learnings-search: archived auth pitfall absent for unrelated feature" "auth-oauth" "$B2_OUT"

# (c) pitfall scope with NO context → 5 most recent ACTIVE pitfalls (recency
#     fallback preserves old behaviour); the 2024 entry and archive are excluded.
C_OUT=$(node "$LS" "$LST" search --scope pitfall 2>/dev/null)
C_N=$(printf '%s\n' "$C_OUT" | grep -c '^  \[')
if [ "$C_N" -eq 5 ]; then
  echo "PASS  learnings-search: no-context pitfall fallback caps at 5"; PASS=$((PASS + 1))
else
  echo "FAIL  learnings-search: no-context pitfall fallback caps at 5 (got $C_N)"; FAIL=$((FAIL + 1))
fi
assert_absent "learnings-search: recency fallback excludes archive" "(archived)" "$C_OUT"

# (d) architectural scope excludes source:inferred and the archive.
D_OUT=$(node "$LS" "$LST" search --scope architectural 2>/dev/null)
assert_contains "learnings-search: architectural includes extracted pattern" "Repository pattern" "$D_OUT"
assert_absent "learnings-search: architectural excludes inferred" "Inferred cross-feature" "$D_OUT"
assert_absent "learnings-search: architectural excludes archive" "(archived)" "$D_OUT"

# (d2) equal base score (no query → both patterns base 0) → newest date ranks
#      first. Locks in the date-desc tiebreak that carries recency now that the
#      recency term was dropped from the score. payments (2026-05-03) > core (2026-05-01).
D2_TOP=$(node "$LS" "$LST" search --scope architectural --json 2>/dev/null | node -e 'const r=JSON.parse(require("fs").readFileSync(0));process.stdout.write((r[0]&&r[0].feature)||"")')
if [ "$D2_TOP" = "payments" ]; then
  echo "PASS  learnings-search: equal base → newest date ranks first"; PASS=$((PASS + 1))
else
  echo "FAIL  learnings-search: equal base → newest date ranks first (got top: $D2_TOP)"; FAIL=$((FAIL + 1))
fi

# (d3) --paths anchor: the Dutch-summary entry (zero English query keywords)
#      ranks first purely on entry.paths[] ∩ --paths token overlap — the
#      language-neutral bridge the paths field exists for.
D3_TOP=$(node "$LS" "$LST" search --paths "src/canvas/graphLayout.ts" --json 2>/dev/null | node -e 'const r=JSON.parse(require("fs").readFileSync(0));process.stdout.write((r[0]&&r[0].feature)||"")')
if [ "$D3_TOP" = "canvas-layout" ]; then
  echo "PASS  learnings-search: --paths anchor ranks path-matched entry first"; PASS=$((PASS + 1))
else
  echo "FAIL  learnings-search: --paths anchor ranks path-matched entry first (got top: $D3_TOP)"; FAIL=$((FAIL + 1))
fi

# (e) missing project-context.json → exit 0, no output (silent loader contract).
LSE=$(mktemp -d)
E_OUT=$(node "$LS" "$LSE" load --feature x 2>&1); E_CODE=$?
if [ "$E_CODE" -eq 0 ] && [ -z "$E_OUT" ]; then
  echo "PASS  learnings-search: missing context → exit 0, empty"; PASS=$((PASS + 1))
else
  echo "FAIL  learnings-search: missing context → exit 0, empty (code=$E_CODE, out=$E_OUT)"; FAIL=$((FAIL + 1))
fi
rm -rf "$LSE"

# (f) vocab drift: --print-vocab must equal the tag names in the § Tag Vocabulary
#     table of LEARNING-WRITE.md (single source of truth for tag NAMES).
VOCAB_SCRIPT=$(node "$LS" --print-vocab | sort)
VOCAB_DOC=$(awk '/^## Tag Vocabulary/{f=1;next} /^## /{f=0} f' "$ROOT/skills/shared/LEARNING-WRITE.md" \
  | grep -oE '^\| `[a-z-]+`' | tr -d '| `' | sort)
if [ "$VOCAB_SCRIPT" = "$VOCAB_DOC" ] && [ -n "$VOCAB_DOC" ]; then
  echo "PASS  learnings-search: vocab matches LEARNING-WRITE.md table"; PASS=$((PASS + 1))
else
  echo "FAIL  learnings-search: vocab drift between script and doc"
  diff <(printf '%s' "$VOCAB_SCRIPT") <(printf '%s' "$VOCAB_DOC")
  FAIL=$((FAIL + 1))
fi
rm -rf "$LST"

# --- learnings-write.js ---
# Write side of the learnings library (dedup on append; consolidation planning
# + execution on gate/consolidate). Uses an explicit project-root (no git
# worktree needed here — that resolution path is already covered by
# ship-checkpoint.js / completion-sync.js's worktree tests).
LW="$ROOT/scripts/learnings-write.js"
LWFX="$ROOT/scripts/fixtures/learnings-write"
LWT=$(mktemp -d)
mkdir -p "$LWT/proj/.project"

lw_reset_small() { cp "$LWFX/context.json" "$LWT/proj/.project/project-context.json"; }
lw_reset_large() { cp "$LWFX/context-large.json" "$LWT/proj/.project/project-context.json"; }
lw_reset_no_op() { cp "$LWFX/context-no-op.json" "$LWT/proj/.project/project-context.json"; }
lw_reset_enrich() { cp "$LWFX/context-enrich.json" "$LWT/proj/.project/project-context.json"; }
lw_learnings_len() { node -e 'const c=require(process.argv[1]);process.stdout.write(String(c.learnings.length))' "$LWT/proj/.project/project-context.json"; }

# (a) append a genuinely new entry → appended, date stamped, nothing skipped.
lw_reset_small
LW_A=$(cd "$LWT" && cat "$LWFX/payloads/new.json" | node "$LW" append proj)
LW_A_CHECK=$(echo "$LW_A" | node -e 'const r=JSON.parse(require("fs").readFileSync(0));process.stdout.write([r.appended,r.skipped.length].join("|"))')
LW_A_DATE=$(node -e 'const c=require(process.argv[1]);const e=c.learnings.find(l=>l.feature==="dashboard");process.stdout.write(e&&e.date?"has-date":"no-date")' "$LWT/proj/.project/project-context.json")
if [ "$LW_A_CHECK" = "1|0" ] && [ "$LW_A_DATE" = "has-date" ] && [ "$(lw_learnings_len)" = "3" ]; then
  echo "PASS  learnings-write: append a new entry (date stamped, 0 skipped)"; PASS=$((PASS + 1))
else
  echo "FAIL  learnings-write: append a new entry (got: $LW_A_CHECK date=$LW_A_DATE len=$(lw_learnings_len))"; FAIL=$((FAIL + 1))
fi

# (b) exact-tuple duplicate (same type + normalized summary + author) → skipped, reason "exact".
lw_reset_small
LW_B=$(cd "$LWT" && cat "$LWFX/payloads/exact-dup.json" | node "$LW" append proj)
LW_B_CHECK=$(echo "$LW_B" | node -e 'const r=JSON.parse(require("fs").readFileSync(0));process.stdout.write([r.appended,r.skipped[0]&&r.skipped[0].reason].join("|"))')
if [ "$LW_B_CHECK" = "0|exact" ] && [ "$(lw_learnings_len)" = "2" ]; then
  echo "PASS  learnings-write: exact-tuple duplicate skipped"; PASS=$((PASS + 1))
else
  echo "FAIL  learnings-write: exact-tuple duplicate (got: $LW_B_CHECK len=$(lw_learnings_len))"; FAIL=$((FAIL + 1))
fi

# (c) near-duplicate (Jaccard >= 0.55, same type) → skipped, reason "jaccard".
lw_reset_small
LW_C=$(cd "$LWT" && cat "$LWFX/payloads/jaccard-dup.json" | node "$LW" append proj)
LW_C_CHECK=$(echo "$LW_C" | node -e 'const r=JSON.parse(require("fs").readFileSync(0));process.stdout.write([r.appended,r.skipped[0]&&r.skipped[0].reason].join("|"))')
if [ "$LW_C_CHECK" = "0|jaccard" ]; then
  echo "PASS  learnings-write: near-duplicate (Jaccard) skipped"; PASS=$((PASS + 1))
else
  echo "FAIL  learnings-write: near-duplicate (Jaccard) (got: $LW_C_CHECK)"; FAIL=$((FAIL + 1))
fi

# (d) two near-identical entries in the SAME batch → first appended, second deduped against it.
lw_reset_small
LW_D=$(cd "$LWT" && cat "$LWFX/payloads/within-batch-dup.json" | node "$LW" append proj)
LW_D_CHECK=$(echo "$LW_D" | node -e 'const r=JSON.parse(require("fs").readFileSync(0));process.stdout.write([r.appended,r.skipped.length].join("|"))')
if [ "$LW_D_CHECK" = "1|1" ]; then
  echo "PASS  learnings-write: within-batch duplicate deduped against its own batch"; PASS=$((PASS + 1))
else
  echo "FAIL  learnings-write: within-batch duplicate (got: $LW_D_CHECK)"; FAIL=$((FAIL + 1))
fi

# (d5) paths[] passthrough on append, capped at 5.
lw_reset_small
LW_P=$(cd "$LWT" && cat "$LWFX/payloads/with-paths.json" | node "$LW" append proj)
LW_P_CHECK=$(node -e 'const c=require(process.argv[1]);const e=c.learnings.find(l=>l.feature==="navigator");process.stdout.write(e&&Array.isArray(e.paths)?String(e.paths.length):"no-paths")' "$LWT/proj/.project/project-context.json")
if [ "$LW_P_CHECK" = "5" ]; then
  echo "PASS  learnings-write: paths[] stored on append, capped at 5"; PASS=$((PASS + 1))
else
  echo "FAIL  learnings-write: paths[] stored on append, capped at 5 (got: $LW_P_CHECK)"; FAIL=$((FAIL + 1))
fi

# (e) gate at/under the 60 threshold → silent, exit 0.
lw_reset_small
LW_E_OUT=$(cd "$LWT" && node "$LW" gate proj 2>/dev/null); LW_E_CODE=$?
if [ "$LW_E_CODE" -eq 0 ] && [ -z "$LW_E_OUT" ]; then
  echo "PASS  learnings-write: gate at/under 60 → silent, exit 0"; PASS=$((PASS + 1))
else
  echo "FAIL  learnings-write: gate at/under 60 (code=$LW_E_CODE out=$LW_E_OUT)"; FAIL=$((FAIL + 1))
fi

# (f) gate over 60 → plan: age-out list, threshold-4 group + threshold-3-escalation
# group (sorted by feature), tag-union (count desc, vocab-order tiebreak), author
# unification (identical → kept, mixed → null).
lw_reset_large
LW_F_OUT=$(cd "$LWT" && node "$LW" gate proj)
LW_F_CHECK=$(echo "$LW_F_OUT" | node -e '
const p = JSON.parse(require("fs").readFileSync(0));
const g0 = p.groups[0], g1 = p.groups[1];
process.stdout.write([
  p.needsConsolidation, p.before, p.ageOut.length, p.groups.length,
  g0.feature, g0.entries.length, g0.merged.author, JSON.stringify(g0.merged.tags), g0.merged.summary === "",
  g1.feature, g1.entries.length, g1.merged.author, JSON.stringify(g1.merged.tags),
].join("|"));
')
if [ "$LW_F_CHECK" = "true|65|4|2|grouped-feature|5|alice|[\"auth\",\"api\",\"db\"]|true|small-group|3||[\"perf\"]" ]; then
  echo "PASS  learnings-write: gate over 60 → age-out + threshold-4/3 groups + tag-union + author rules"; PASS=$((PASS + 1))
else
  echo "FAIL  learnings-write: gate over 60 (got: $LW_F_CHECK)"; FAIL=$((FAIL + 1))
fi

# (g) consolidate both groups → active list shrinks, archive holds all originals,
# report line matches, and a second gate is then silent (idempotent).
lw_reset_large
LW_G_OUT=$(cd "$LWT" && cat "$LWFX/payloads/consolidate-merges.json" | node "$LW" consolidate proj)
LW_G_ARCHIVE=$(ls "$LWT/proj/.project/archive/learnings-"*.json 2>/dev/null | head -1)
LW_G_ARCHIVED_LEN=$([ -n "$LW_G_ARCHIVE" ] && node -e 'const a=require(process.argv[1]);process.stdout.write(String(a.archived.length))' "$LW_G_ARCHIVE" || echo "no-archive")
LW_G_GATE2=$(cd "$LWT" && node "$LW" gate proj 2>/dev/null)
if [ "$LW_G_OUT" = "Learnings consolidated: 2 merged, 12 archived (65 → 55)" ] \
  && [ "$(lw_learnings_len)" = "55" ] && [ "$LW_G_ARCHIVED_LEN" = "12" ] && [ -z "$LW_G_GATE2" ]; then
  echo "PASS  learnings-write: consolidate merges + archives + idempotent second gate"; PASS=$((PASS + 1))
else
  echo "FAIL  learnings-write: consolidate (out='$LW_G_OUT' len=$(lw_learnings_len) archived=$LW_G_ARCHIVED_LEN gate2='$LW_G_GATE2')"; FAIL=$((FAIL + 1))
fi
rm -rf "$LWT/proj/.project/archive"

# (h) consolidate with empty merges → age-out only, qualifying groups left untouched.
lw_reset_large
LW_H_OUT=$(cd "$LWT" && cat "$LWFX/payloads/consolidate-empty.json" | node "$LW" consolidate proj 2>/dev/null)
if [ "$LW_H_OUT" = "Learnings consolidated: 0 merged, 4 archived (65 → 61)" ] && [ "$(lw_learnings_len)" = "61" ]; then
  echo "PASS  learnings-write: consolidate with empty merges → age-out only"; PASS=$((PASS + 1))
else
  echo "FAIL  learnings-write: consolidate with empty merges (out='$LW_H_OUT' len=$(lw_learnings_len))"; FAIL=$((FAIL + 1))
fi

# (i) gate over 60 but no qualifying cluster or age-out candidate (61 diverse,
# unique-feature, recent entries) → silent no-op, not a plan with empty groups/ageOut.
lw_reset_no_op
LW_I_OUT=$(cd "$LWT" && node "$LW" gate proj 2>/dev/null); LW_I_CODE=$?
if [ "$LW_I_CODE" -eq 0 ] && [ -z "$LW_I_OUT" ]; then
  echo "PASS  learnings-write: gate over 60 with no qualifying cluster/age-out → silent no-op"; PASS=$((PASS + 1))
else
  echo "FAIL  learnings-write: gate over 60 no-op (code=$LW_I_CODE out='$LW_I_OUT')"; FAIL=$((FAIL + 1))
fi

# (j) enrich: tags+paths patch via exact-tuple match, control entry untouched.
lw_reset_enrich
LW_J=$(cd "$LWT" && cat "$LWFX/payloads/enrich-tags-paths.json" | node "$LW" enrich proj)
LW_J_CHECK=$(echo "$LW_J" | node -e 'const r=JSON.parse(require("fs").readFileSync(0));process.stdout.write([r.patched,r.alreadyApplied,r.notFound.length,r.ambiguous.length].join("|"))')
LW_J_ENTRY=$(node -e 'const c=require(process.argv[1]);const e=c.learnings.find(l=>l.feature==="foo");process.stdout.write(JSON.stringify([e.tags,e.paths]))' "$LWT/proj/.project/project-context.json")
LW_J_CONTROL=$(node -e 'const c=require(process.argv[1]);const e=c.learnings.find(l=>l.feature==="control");process.stdout.write(e.tags?"has-tags":"no-tags")' "$LWT/proj/.project/project-context.json")
if [ "$LW_J_CHECK" = "1|0|0|0" ] && [ "$LW_J_ENTRY" = '[["ui","state"],["src/foo.ts"]]' ] && [ "$LW_J_CONTROL" = "no-tags" ] && [ "$(lw_learnings_len)" = "4" ]; then
  echo "PASS  learnings-write: enrich tags+paths via exact-tuple match, control entry untouched"; PASS=$((PASS + 1))
else
  echo "FAIL  learnings-write: enrich tags+paths (got: $LW_J_CHECK entry=$LW_J_ENTRY control=$LW_J_CONTROL len=$(lw_learnings_len))"; FAIL=$((FAIL + 1))
fi

# (k) enrich: legacy key-migration produces a conformant entry (no key/text/note,
# valid date/feature/type/source/summary) — then a SECOND identical run is a
# no-op via the identity fallback (key was already deleted by run 1).
lw_reset_enrich
LW_K1=$(cd "$LWT" && cat "$LWFX/payloads/enrich-legacy-migrate.json" | node "$LW" enrich proj)
LW_K1_CHECK=$(echo "$LW_K1" | node -e 'const r=JSON.parse(require("fs").readFileSync(0));process.stdout.write([r.patched,r.alreadyApplied].join("|"))')
LW_K_SHAPE=$(node -e '
const c=require(process.argv[1]);
const e=c.learnings.find(l=>l.feature==="bar");
const clean = e && !("key" in e) && !("text" in e) && !("note" in e);
const valid = e && e.date==="2025-06-01" && e.type==="pitfall" && e.source==="extracted" && e.summary==="Legacy text about bar module";
process.stdout.write(clean && valid ? "conformant" : "not-conformant");
' "$LWT/proj/.project/project-context.json")
LW_K2=$(cd "$LWT" && cat "$LWFX/payloads/enrich-legacy-migrate.json" | node "$LW" enrich proj)
LW_K2_CHECK=$(echo "$LW_K2" | node -e 'const r=JSON.parse(require("fs").readFileSync(0));process.stdout.write([r.patched,r.alreadyApplied].join("|"))')
if [ "$LW_K1_CHECK" = "1|0" ] && [ "$LW_K_SHAPE" = "conformant" ] && [ "$LW_K2_CHECK" = "0|1" ] && [ "$(lw_learnings_len)" = "4" ]; then
  echo "PASS  learnings-write: enrich legacy-key migration + idempotent re-run"; PASS=$((PASS + 1))
else
  echo "FAIL  learnings-write: enrich legacy migration (run1=$LW_K1_CHECK shape=$LW_K_SHAPE run2=$LW_K2_CHECK len=$(lw_learnings_len))"; FAIL=$((FAIL + 1))
fi

# (l) enrich: patch with no match anywhere → notFound, reported not swallowed, array untouched.
lw_reset_enrich
LW_L=$(cd "$LWT" && cat "$LWFX/payloads/enrich-no-match.json" | node "$LW" enrich proj)
LW_L_CHECK=$(echo "$LW_L" | node -e 'const r=JSON.parse(require("fs").readFileSync(0));process.stdout.write([r.patched,r.notFound.length].join("|"))')
if [ "$LW_L_CHECK" = "0|1" ] && [ "$(lw_learnings_len)" = "4" ]; then
  echo "PASS  learnings-write: enrich no-match reported, array untouched"; PASS=$((PASS + 1))
else
  echo "FAIL  learnings-write: enrich no-match (got: $LW_L_CHECK len=$(lw_learnings_len))"; FAIL=$((FAIL + 1))
fi

rm -rf "$LWT"

# --- backlog-load.js ---
# Verifies the ready/blocking dependency predicate from shared/BACKLOG.md
# § Completion & dependency resolution: a dependency clears at `shipped`,
# never at plain `status === "DONE"` alone (DONE lands right after verify,
# before the dependency is merged) — with a THEME/DONE backward-compat
# clause, and archived (shipped + moved out of features[]) dependencies
# resolving the same as live ones.
BL="$ROOT/scripts/backlog-load.js"
BLT=$(mktemp -d)
mkdir -p "$BLT/.project/archive"
cat > "$BLT/.project/backlog.json" <<'EOF'
{
  "schemaVersion": 2,
  "project": "backlog-load-test",
  "features": [
    { "name": "blocker-done-not-shipped", "type": "FEATURE", "status": "DONE" },
    { "name": "blocker-shipped", "type": "FEATURE", "status": "DONE", "shipped": true },
    { "name": "blocker-theme-done", "type": "THEME", "status": "DONE" },
    { "name": "dep-a", "type": "FEATURE", "status": "DEFINED", "dependencies": ["blocker-done-not-shipped"] },
    { "name": "dep-b", "type": "FEATURE", "status": "DEFINED", "dependencies": ["blocker-shipped"] },
    { "name": "dep-c", "type": "FEATURE", "status": "DEFINED", "dependencies": ["blocker-archived"] },
    { "name": "dep-d", "type": "FEATURE", "status": "DEFINED", "dependencies": ["blocker-theme-done"] },
    { "name": "dep-e", "type": "FEATURE", "status": "DEFINED", "dependencies": ["unknown-name"] }
  ]
}
EOF
cat > "$BLT/.project/archive/backlog-archive.json" <<'EOF'
{ "schemaVersion": 2, "archived": [
  { "name": "blocker-archived", "type": "FEATURE", "status": "DONE", "shipped": true }
] }
EOF

BL_READY=$(node "$BL" "$BLT" ready-queue)
BL_CHECK=$(echo "$BL_READY" | node -e '
const r = JSON.parse(require("fs").readFileSync(0));
const ready = (name) => { const it = r.items.find((i) => i.name === name); return it ? String(it.ready) : "missing"; };
process.stdout.write([
  ready("dep-a"), ready("dep-b"), ready("dep-c"), ready("dep-d"), ready("dep-e"),
].join("|"));
')
if [ "$BL_CHECK" = "false|true|true|true|false" ]; then
  echo "PASS  backlog-load: ready-queue completion predicate (DONE-not-shipped blocks, shipped/archived/THEME-DONE resolve, unknown stays blocked)"; PASS=$((PASS + 1))
else
  echo "FAIL  backlog-load: ready-queue completion predicate (got: $BL_CHECK, want: false|true|true|true|false)"; FAIL=$((FAIL + 1))
fi

BL_SHIPPED=$(node "$BL" "$BLT" read-feature blocker-shipped | node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(0)).shipped))')
BL_NOT_SHIPPED=$(node "$BL" "$BLT" read-feature blocker-done-not-shipped | node -e 'process.stdout.write(String(JSON.parse(require("fs").readFileSync(0)).shipped))')
if [ "$BL_SHIPPED" = "true" ] && [ "$BL_NOT_SHIPPED" = "false" ]; then
  echo "PASS  backlog-load: read-feature always emits boolean shipped"; PASS=$((PASS + 1))
else
  echo "FAIL  backlog-load: read-feature shipped field (shipped=$BL_SHIPPED not-shipped=$BL_NOT_SHIPPED)"; FAIL=$((FAIL + 1))
fi

rm -rf "$BLT"

# --- check-task-markers.py ---
# Fixture units live in their own subdirs: the validator scans sibling .md files
# per skill dir, so isolation per fixture prevents cross-contamination.
TM="$ROOT/scripts/fixtures/task-markers"

run_tm() {
  local label="$1" fixture="$2" want_exit="$3" want_pattern="$4"
  local out code
  out=$(python3 "$ROOT/scripts/check-task-markers.py" "$TM/$fixture/case.md" 2>&1)
  code=$?
  if [ "$code" -eq "$want_exit" ] && printf '%s' "$out" | grep -q "$want_pattern"; then
    echo "PASS  task-markers: $label"
    PASS=$((PASS + 1))
  else
    echo "FAIL  task-markers: $label (exit=$code, wanted $want_exit + /$want_pattern/)"
    printf '%s\n' "$out"
    FAIL=$((FAIL + 1))
  fi
}

run_tm "conformant unit (incl. wrapped marker) → OK, exit 0" conformant 0 "^OK:"
run_tm "seeded phase without header → WARN, exit 1" mismatch 1 "PHASE 2 has no matching header"
run_tm "seeded phase never completed → WARN, exit 1" mismatch 1 'PHASE 2 is never marked `completed`'
run_tm "unparsable seed → PARSE-SKIP, non-fatal exit 0" parse-skip 0 "PARSE-SKIP"

# --- skill-feedback.js ---
# Store lives outside the repo (~/.claude/skill-feedback.json), so every case
# redirects it into a throwaway file via CLAUDE_SKILL_FEEDBACK_FILE.
SF="$ROOT/scripts/skill-feedback.js"
export CLAUDE_SKILL_FEEDBACK_FILE="$TMP/skill-feedback.json"
rm -f "$CLAUDE_SKILL_FEEDBACK_FILE"

run_sf() {
  local label="$1" want="$2" actual="$3"
  if [ "$actual" = "$want" ]; then
    echo "PASS  skill-feedback: $label"
    PASS=$((PASS + 1))
  else
    echo "FAIL  skill-feedback: $label (got: $actual, want: $want)"
    FAIL=$((FAIL + 1))
  fi
}

# (a) Batch add: two notes in one call → two rows.
SF_ADD=$(node "$SF" add --skill dev-ship --note "verify asked too many questions" --note "debug-round.md loaded but unused" | grep -c '^stored #')
run_sf "batch add stores each --note" "2" "$SF_ADD"

# (b) Near-identical note for the same skill → recurrence bump, no new row.
SF_DUPE=$(node "$SF" add --skill dev-ship --note "verify asked too MANY questions!" | tr -d '\n')
run_sf "near-duplicate bumps count instead of adding" "stored #1 dev-ship (seen 2x)" "$SF_DUPE"

# (c) Same text under a different skill is a distinct note (dedup is per-skill).
SF_OTHER=$(node "$SF" add --skill core-commit --note "verify asked too many questions" --source user | tr -d '\n')
run_sf "dedup is scoped per skill" "stored #3 core-commit (new)" "$SF_OTHER"

# (d) list --skill filters, and orders most-recurrent first.
SF_LIST=$(node "$SF" list --skill dev-ship | head -1 | awk '{print $1, $2}')
run_sf "list --skill orders most-recurrent first" "#1 2x" "$SF_LIST"

# (e) resolve drops the row from the default (open-only) listing; an unknown id warns, exit 0.
node "$SF" resolve 1 999 > /dev/null 2>&1
SF_RESOLVE_EXIT=$?
SF_OPEN=$(node "$SF" list --skill dev-ship | wc -l | tr -d ' ')
run_sf "resolve is non-fatal on an unknown id" "0" "$SF_RESOLVE_EXIT"
run_sf "resolved note leaves the open listing" "1" "$SF_OPEN"

# (f) Empty result → no output, exit 0 (silent-skip contract for unconditional callers).
SF_EMPTY=$(node "$SF" list --skill no-such-skill; echo "exit=$?")
run_sf "no matches → silent, exit 0" "exit=0" "$SF_EMPTY"

unset CLAUDE_SKILL_FEEDBACK_FILE

# --- improvement-notes.js ---
# Triage for dev-ship's auto-verify improvement notes: the countable half of the
# offload flush (sort/cap, per-class recurrence with decay, card floor, the
# withheld audit trail, promote/escalate). The judgment half stays in the skill.
IN_S="$ROOT/scripts/improvement-notes.js"
INFX="$ROOT/scripts/fixtures/improvement-notes"
INT=$(mktemp -d)
mkdir -p "$INT/proj/.project"

in_reset() { rm -f "$INT/proj/.project/withheld-notes.json"; cp "$INFX/$1" "$INT/proj/.project/project-context.json"; }
in_triage() { cat "$INFX/payloads/$1" | node "$IN_S" triage "$INT/proj" --feature "${2:-f}"; }
in_ctx() { node -e 'const c=require(process.argv[1]);process.stdout.write(JSON.stringify(eval("c."+process.argv[2])))' "$INT/proj/.project/project-context.json" "$1"; }
run_in() {
  if [ "$2" = "$3" ]; then echo "PASS  improvement-notes: $1"; PASS=$((PASS + 1));
  else echo "FAIL  improvement-notes: $1 (expected: $2, got: $3)"; FAIL=$((FAIL + 1)); fi
}

# (a) Legacy bare strings normalize to medium/other and still become candidates —
# a resumed Workflow replays cached pre-change results, and nothing may vanish.
in_reset context-empty.json
IN_A=$(in_triage legacy.json | node -e 'const d=JSON.parse(require("fs").readFileSync(0));process.stdout.write([d.cardCandidates.length,d.cardCandidates[0].severity,d.cardCandidates[0].class].join("|"))')
run_in "legacy bare strings → medium/other, still carded" "2|medium|other" "$IN_A"

# (b) The cap keeps the HIGHEST severities, not the first written. This is the
# test that proves capping cannot silently drop a correctness finding.
in_reset context-empty.json
IN_B=$(in_triage mixed-five.json | node -e 'const d=JSON.parse(require("fs").readFileSync(0));process.stdout.write(d.cardCandidates.map(c=>c.severity).join(","))')
run_in "cap sorts before cutting (high+medium survive 3 lows)" "high,medium" "$IN_B"
IN_B2=$(node -e 'const s=require(process.argv[1]);process.stdout.write(String(s.notes.filter(n=>n.reason==="over per-run cap").length))' "$INT/proj/.project/withheld-notes.json")
run_in "over-cap notes land in the withheld store" "2" "$IN_B2"

# (c) Promotion at count 3 writes a PROPOSAL only — learnings[] stays untouched
# and promotedAt stays null until a human confirms at PHASE 5.
in_reset context-near-promote.json
IN_C=$(in_triage third-of-class.json | node -e 'const d=JSON.parse(require("fs").readFileSync(0));process.stdout.write([d.promote.length,d.promote[0]&&d.promote[0].tags.join("+"),d.cardCandidates.length].join("|"))')
run_in "3rd of a class → proposal, and the note STILL cards" "1|testing|1" "$IN_C"
run_in "proposal does not set promotedAt" "null" "$(in_ctx 'improvementClasses[0].promotedAt')"
run_in "proposal does not touch learnings[]" "0" "$(in_ctx 'learnings.length')"

# (d) Unknown top-level keys survive the write (the board's save endpoint and
# learnings-write.js both round-trip this file).
run_in "unknown top-level keys preserved" '"must survive"' "$(in_reset context-empty.json; in_triage legacy.json >/dev/null; in_ctx customKey)"

# (e) A 4th of the same class does not mint a second proposal.
in_reset context-near-promote.json
in_triage third-of-class.json >/dev/null
IN_E=$(in_triage third-of-class.json | node -e 'const d=JSON.parse(require("fs").readFileSync(0));process.stdout.write(String(d.promote.length))')
run_in "4th of a class → no second proposal" "0" "$IN_E"

# (f) Confirm → promotedAt set; then medium is suppressed but high still cards.
in_reset context-near-promote.json
in_triage third-of-class.json >/dev/null
node "$IN_S" promote-confirm "$INT/proj" --class test-coverage-gap >/dev/null
IN_F=$(echo '[{"note":"another missing control","severity":"medium","class":"test-coverage-gap"},{"note":"real race","severity":"high","class":"test-coverage-gap"}]' | node "$IN_S" triage "$INT/proj" --feature f | node -e 'const d=JSON.parse(require("fs").readFileSync(0));process.stdout.write([d.cardCandidates.map(c=>c.severity).join(","),d.belowFloor[0].reason].join("|"))')
run_in "after promotion: medium withheld, high still cards" "high|class already promoted" "$IN_F"

# (g) A promoted class that keeps recurring escalates once, at promotedCount + 3.
in_reset context-promoted.json
IN_G=$(in_triage escalating.json | node -e 'const d=JSON.parse(require("fs").readFileSync(0));process.stdout.write(d.escalate.map(e=>e.class+":"+e.count).join(","))')
run_in "promoted class recurring → escalation card" "naming-and-docs:6" "$IN_G"

# (h) class "other" is heterogeneous by definition and never promotes.
in_reset context-empty.json
in_triage other.json >/dev/null; in_triage other.json >/dev/null
IN_H=$(in_triage other.json | node -e 'const d=JSON.parse(require("fs").readFileSync(0));process.stdout.write(String(d.promote.length))')
run_in "class 'other' never promotes" "0" "$IN_H"

# (i) Decay: a sighting older than 180 days resets the count, so two findings
# far apart never masquerade as a pattern.
in_reset context-stale.json
in_triage after-decay.json >/dev/null
run_in "stale class decays: count resets to 1" "1" "$(in_ctx 'improvementClasses[0].count')"
run_in "stale class decays: resets incremented" "1" "$(in_ctx 'improvementClasses[0].resets')"

# (j) A withheld note keeps its blocker link — losing it would strand the note.
in_reset context-empty.json
in_triage blocked-low.json >/dev/null
IN_J=$(node -e 'const s=require(process.argv[1]);const n=s.notes[0];process.stdout.write([n.reason,n.dependsOn].join("|"))' "$INT/proj/.project/withheld-notes.json")
run_in "withheld note keeps dependsOn and reason" "low|broken-level-history-horizon" "$IN_J"

# (k) Unparsable stdin must never fail a green ship.
in_reset context-empty.json
IN_K=$(echo 'not json at all' | node "$IN_S" triage "$INT/proj" --feature f >/dev/null 2>&1; echo "exit=$?")
run_in "unparsable stdin → exit 0 (never fails a green ship)" "exit=0" "$IN_K"

# ---------------------------------------------------------------------------
# wire-project-symlinks.sh — the .project/ symlink wiring must never destroy
# content. Each case builds a throwaway main-checkout + worktree pair.
# ---------------------------------------------------------------------------

WP_S="$ROOT/scripts/wire-project-symlinks.sh"
WP_BASE="$(mktemp -d)"
WP_MAIN="$WP_BASE/repo"
WP_WT="$WP_MAIN/.claude/worktrees/feat-x"

run_wp() {
  if [ "$2" = "$3" ]; then echo "PASS  wire-symlinks: $1"; PASS=$((PASS + 1));
  else echo "FAIL  wire-symlinks: $1 (expected: $2, got: $3)"; FAIL=$((FAIL + 1)); fi
}

wp_reset() {
  rm -rf "$WP_MAIN"
  mkdir -p "$WP_MAIN/.project/features" "$WP_WT/.project"
  echo '{"main":1}' > "$WP_MAIN/.project/backlog.json"
  echo '{"main":1}' > "$WP_MAIN/.project/project.json"
  echo '{"learnings":["main"]}' > "$WP_MAIN/.project/project-context.json"
}

wp_run() { bash "$WP_S" --worktree "$WP_WT" --main-root "$WP_MAIN" --feature feat-x 2>&1; }

# (a) The normal case: an existing symlink is replaced, nothing is rescued.
wp_reset
ln -sfn "$WP_MAIN/.project/backlog.json" "$WP_WT/.project/backlog.json"
wp_run >/dev/null
run_wp "symlink is re-wired" "yes" "$([ -L "$WP_WT/.project/backlog.json" ] && echo yes || echo no)"
run_wp "nothing rescued on the normal path" "no" "$([ -d "$WP_MAIN/.project/.rescued" ] && echo yes || echo no)"

# (b) A real file byte-identical to main carries no unmerged content.
wp_reset
cp "$WP_MAIN/.project/project-context.json" "$WP_WT/.project/project-context.json"
wp_run >/dev/null
run_wp "identical real file → replaced by symlink" "yes" "$([ -L "$WP_WT/.project/project-context.json" ] && echo yes || echo no)"
run_wp "identical real file → no rescue dir" "no" "$([ -d "$WP_MAIN/.project/.rescued" ] && echo yes || echo no)"

# (c) The regression this gate exists for: a divergent real file is content a
# broken-symlink window wrote into the worktree. It must survive.
wp_reset
echo '{"learnings":["UNIQUE-from-worktree"]}' > "$WP_WT/.project/project-context.json"
WP_OUT="$(wp_run)"; WP_RC=$?
run_wp "divergent real file → exit 0" "0" "$WP_RC"
run_wp "divergent real file → WARN printed" "yes" "$(echo "$WP_OUT" | grep -q 'WARN: rescued' && echo yes || echo no)"
WP_R="$(find "$WP_MAIN/.project/.rescued" -name project-context.json 2>/dev/null | head -1)"
run_wp "divergent real file → content preserved" "yes" "$([ -n "$WP_R" ] && grep -q 'UNIQUE-from-worktree' "$WP_R" && echo yes || echo no)"
WP_OUTSIDE=no
[ "${WP_R#"$WP_MAIN/.project/.rescued"}" != "$WP_R" ] && WP_OUTSIDE=yes
run_wp "divergent real file → rescue lands outside the worktree" "yes" "$WP_OUTSIDE"

# (d) Main has no counterpart: the worktree copy is the only copy, so promote it
# rather than rescuing it behind a dangling symlink.
wp_reset
rm -f "$WP_MAIN/.project/project-context.json"
echo '{"learnings":["only-copy"]}' > "$WP_WT/.project/project-context.json"
WP_OUT="$(wp_run)"
run_wp "main missing → PROMOTED reported" "yes" "$(echo "$WP_OUT" | grep -q 'PROMOTED to main' && echo yes || echo no)"
run_wp "main missing → content moved to main" "yes" "$(grep -q 'only-copy' "$WP_MAIN/.project/project-context.json" 2>/dev/null && echo yes || echo no)"

# (e) Gate 1: a worktree path equal to main root must abort before any mutation.
wp_reset
WP_BEFORE="$(cat "$WP_MAIN/.project/backlog.json")"
bash "$WP_S" --worktree "$WP_MAIN" --main-root "$WP_MAIN" >/dev/null 2>&1
run_wp "worktree == main root → exit 1" "1" "$?"
run_wp "worktree == main root → main untouched" "$WP_BEFORE" "$(cat "$WP_MAIN/.project/backlog.json")"
run_wp "worktree == main root → no self-referential symlink" "no" "$([ -L "$WP_MAIN/.project/backlog.json" ] && echo yes || echo no)"

# (f) Gate 2: a whole-directory symlink at $WT/.project would make every path
# below resolve onto main's real files.
wp_reset
rm -rf "$WP_WT/.project"; ln -sfn "$WP_MAIN/.project" "$WP_WT/.project"
wp_run >/dev/null
run_wp "WT/.project symlink → replaced by a real dir" "yes" "$([ ! -L "$WP_WT/.project" ] && [ -d "$WP_WT/.project" ] && echo yes || echo no)"
run_wp "WT/.project symlink → main's real file survives" "yes" "$([ -f "$WP_MAIN/.project/backlog.json" ] && [ ! -L "$WP_MAIN/.project/backlog.json" ] && echo yes || echo no)"

rm -rf "$WP_BASE"

echo
echo "Result: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
