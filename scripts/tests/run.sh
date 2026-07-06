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

# --- state-files.py (project-sync manifest copy) ---
# Verifies collect includes the manifest subset + state-manifest.json and excludes
# the denylist (session/, auth-state.json, screenshots/) and regenerables
# (stryker-report.json); restore round-trips content, enforces the include-list
# (drops a branch-planted report), and skips symlinks.
SF="$ROOT/skills/project-sync/scripts/state-files.py"
SFT="$(mktemp -d)"
mkdir -p "$SFT/proj/.project"/{session,features/f1,archive,thinking,screenshots}
printf '{"a":1}\n' >"$SFT/proj/.project/project.json"
printf '{"b":2}\n' >"$SFT/proj/.project/backlog.json"
printf '# seed\n' >"$SFT/proj/.project/project-seed.md"
printf '{"id":"f1"}\n' >"$SFT/proj/.project/features/f1/feature.json"
printf '{"s":1}\n' >"$SFT/proj/.project/features/f1/stryker-report.json"
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
            archive/backlog-archive.json thinking/t1.md state-manifest.json; do
  [ -f "$SFT/branch/$want" ] || { echo "  missing in branch: $want"; sf_ok=0; }
done
# Excluded from the branch (denylist + regenerable).
for deny in session/state-sync.json auth-state.json screenshots/a.png \
            features/f1/stryker-report.json; do
  [ -e "$SFT/branch/$deny" ] && { echo "  leaked to branch: $deny"; sf_ok=0; }
done
# Restore round-trips content and never writes a denylisted path.
[ "$(cat "$SFT/proj2/.project/project.json")" = '{"a":1}' ] || { echo "  restore content mismatch"; sf_ok=0; }
[ -e "$SFT/proj2/.project/auth-state.json" ] && { echo "  restore wrote denylisted auth-state.json"; sf_ok=0; }
[ -e "$SFT/proj2/.project/state-manifest.json" ] && { echo "  restore wrote branch metadata into .project/"; sf_ok=0; }
[ -e "$SFT/proj2/.project/.git" ] && { echo "  restore leaked the worktree .git marker"; sf_ok=0; }
# Include-list gate: a report planted directly on the branch must not be restored.
[ -e "$SFT/proj2/.project/features/f2/stryker-report.json" ] && { echo "  restore wrote a branch-planted report"; sf_ok=0; }
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
#     table of LEARNING-EXTRACTION.md (single source of truth for tag NAMES).
VOCAB_SCRIPT=$(node "$LS" --print-vocab | sort)
VOCAB_DOC=$(awk '/^## Tag Vocabulary/{f=1;next} /^## /{f=0} f' "$ROOT/skills/shared/LEARNING-EXTRACTION.md" \
  | grep -oE '^\| `[a-z-]+`' | tr -d '| `' | sort)
if [ "$VOCAB_SCRIPT" = "$VOCAB_DOC" ] && [ -n "$VOCAB_DOC" ]; then
  echo "PASS  learnings-search: vocab matches LEARNING-EXTRACTION.md table"; PASS=$((PASS + 1))
else
  echo "FAIL  learnings-search: vocab drift between script and doc"
  diff <(printf '%s' "$VOCAB_SCRIPT") <(printf '%s' "$VOCAB_DOC")
  FAIL=$((FAIL + 1))
fi
rm -rf "$LST"

echo
echo "Result: $PASS passed, $FAIL failed"
[ "$FAIL" -eq 0 ]
