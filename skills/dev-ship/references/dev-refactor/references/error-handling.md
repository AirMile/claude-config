# Error Handling

## Context Loading Failures

**No features found** → exit: "Run /dev-ship {feature-name} first"
**No test results for any feature** → exit: "Run /dev-ship {feature-name} first"
**Some features missing test results** → remove from queue, warn, continue with rest
**No files in feature** → skip feature, warn: "No code files found in feature.json for {feature}"

## Refactor Patterns Failures

**Context7 unavailable** → skip refactor-patterns generation, proceed with universal patterns only
**Partial Context7 results** → generate refactor-patterns.md with available data, note gaps
**CLAUDE.md has no ### Stack section** → skip stack-specific patterns, use universal only

## Analysis Failures

**Explore agent fails for a feature** → skip that feature, warn, continue with rest
**All Explore agents fail** → exit: "Analysis failed — try again or run on a single feature"
**Agent output truncated** → use Grep/Read to find ANALYSIS_START..ANALYSIS_END block

## Test Failures

**Tests fail after refactoring a feature** → per-feature rollback, continue with next feature
**Test framework not detected** → ask user which command to run
**Tests hang** → kill process, rollback current feature

## Rollback Failures

**git checkout fails for feature files** → report manual recovery steps:

1. Show the `saved_hash` from PHASE 4 step 1
2. List all `modified_files[feature_name]` and `created_files[feature_name]`
3. Suggest: `git reset --hard <saved_hash>` to restore to the pre-refactor state
4. STOP — do not attempt destructive recovery commands
