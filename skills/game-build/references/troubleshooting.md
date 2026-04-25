# Troubleshooting & Error Handling

Reference voor `/game-build`. Geladen Just-In-Time bij blockers of test failures.

## Test Failures During TDD

If a test fails unexpectedly during GREEN phase:

1. Log the failure with full error message
2. Analyze the error
3. Fix the implementation
4. Re-run test
5. Continue only when PASS

## Build Blockers

If implementation is blocked:

1. Log the blocker in `feature.json` `build.blockers`
2. Mark affected tests as BLOCKED
3. Continue with other tests
4. Report blockers at completion

## Common Errors

### GUT tests not found or not running

**Cause:** GUT (Godot Unit Test) framework not installed or configured.
**Solution:** Verify `addons/gut/` exists in the project. Check `res://tests/` directory structure. Run tests manually with `godot --headless -s addons/gut/gut_cmdln.gd` to verify setup.

### Scene tree errors during test

**Cause:** Node references breaking due to scene structure changes.
**Solution:** Check that `@onready` references match current scene tree. Use `has_node()` before accessing nodes. Review the test scene (`playtest_scene.tscn`) for missing dependencies.

### Signal connections not working in tests

**Cause:** Signals may not be connected in the test scene context.
**Solution:** Ensure signals are connected in `_ready()` or via the editor. The `debug_listener.gd` captures signals — check its output for missed connections.

### Implementation First verification test fails

**Cause:** Scene structure doesn't match what the verification test expects.
**Solution:** Check node names and paths in the verification test match the actual scene tree. Use `print_tree_pretty()` to debug scene structure.
