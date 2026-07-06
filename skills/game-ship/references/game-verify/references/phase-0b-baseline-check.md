# PHASE 0 Step 6b: Post-Build Baseline Check

Load this file when entering step 6b. Only run if the `build` section exists in feature.json.

---

## Check 1: Full GUT Regression Suite

Run the full GUT test suite to verify all features still work:

```bash
"{godot_executable}" --headless --path . -s addons/gut/gut_cmdln.gd -gexit
```

Parse output (same rules as game-build: PASS 1 line, FAIL max 10 lines).

```
BASELINE: full suite → {passed}/{total} PASS
```

On failures:

- Distinguish failures from the CURRENT feature vs OTHER features
- Current feature fails → warn, continue with playtest (this is what we're going to test)
- Other feature fails → warn:

  ```
  ⚠ REGRESSION: {N} tests from other features failing
  - test_{other}.test_xxx: {reason}
  ```

  Use AskUserQuestion:
  - "Continue with playtest (Recommended)" — "Regressions are reported but don't block the test"
  - "Stop — fix regressions first" — "Fix the other features before testing this one"

If GUT is not available or no test files found → skip with: `BASELINE: skipped (no GUT tests found)`

## Check 2: Integration Test Scene

Re-run the integration test scene as an additional check:

```bash
"{godot_executable}" --headless --path . -s res://tests/scenes/test_{feature}_runtime.tscn
```

Parse output for `FINAL:PASS` or `FINAL:FAIL`.

Display: `BASELINE: integration tests → {PASS|FAIL}`
On FAIL: warn ("Integration tests failing — possible regression since build"), show failed tests, continue with playtest.

If integration test scene does not exist → skip, no output.
