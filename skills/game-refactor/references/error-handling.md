# Error Handling

## Context Loading Failures

**No features found** — exit: "Run /game-define and /game-build first"
**No test results for any feature** — exit: "Run /game-verify first"
**Some features missing test results** — remove from queue, warn, continue with rest
**Feature.json missing files[]** — skip feature, warn: "No code files found in feature.json for {feature}"

## Refactor Patterns Failures

**Context7 unavailable** — skip refactor-patterns generation, proceed with universal + Godot-specific patterns only
**Partial Context7 results** — generate refactor-patterns.md with available data, note gaps

## Analysis Failures

**Explore agent fails for a feature** — skip that feature, warn, continue with rest
**All Explore agents fail** — exit: "Analysis failed — try again or run on a single feature"
**Agent output truncated** — use Grep/Read to find ANALYSIS_START..ANALYSIS_END block

## Test Failures

**GUT tests fail after refactoring a feature** — per-feature rollback, continue with next feature
**GUT not installed** — ask user which test command to run
**Tests hang** — kill process, rollback current feature

## Rollback Failures

**git checkout fails for feature files** — report manual recovery steps:

1. Show the `saved_hash` from PHASE 4 step 1
2. List all `modified_files[feature_name]` and `created_files[feature_name]`
3. Suggest: "Use `/rewind` in Claude Code to go back to an earlier point"
4. STOP — do not attempt destructive recovery commands
