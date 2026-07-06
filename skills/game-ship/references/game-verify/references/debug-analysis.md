# PHASE 1b: Debug Analysis

**When to use:** Runs when user selected "There are issues" in PHASE 0 step 8.

## Steps

1. **Capture debug output:**

   ```python
   debug_output = mcp__godot-mcp__get_debug_output()
   ```

2. **Parse debug log:**
   - Extract all `[DEBUG]` and `[PLAYTEST]` lines
   - Build timeline of events
   - Identify signal emissions and method calls

   ```
   DEBUG TIMELINE:

   00:01.234 [DEBUG] WaterAbility.execute() called - target: TestTarget
   00:01.235 [DEBUG] WaterAbility.execute() complete - damage: 20
   00:01.456 [PLAYTEST] debug_ability_used: {damage: 20, target: "TestTarget"}
   00:02.100 [DEBUG] Puddle.spawn() called - position: (100, 200)
   00:02.789 [PLAYTEST] debug_puddle_spawned: {position: (100, 200)}
   ...
   ```

3. **Show checklist and ask which items did not work:**

   ```
   Checklist items ({N} total):

   1. [Visuals] {item-1}
   2. [Controls] {item-2}
   3. [Audio] {item-3}
   ...
   ```

   Question: "Which items did not work? Give numbers (e.g. `1, 3, 5`) or `none` if everything worked."

   Parse → failure-set, continue to Step 4 for specifics per selected item.

4. **For each selected problem, ask specifics:**

   ```
   You selected: "Item 3: Puddle spawns on impact"

   What was the exact problem?
   - Puddle did not appear?
   - Wrong position?
   - Wrong size?
   - Something else?
   ```

   Wait for user description.

5. **Correlate with debug output:**

   ```
   ISSUE ANALYSIS: Item 3

   User feedback: "Puddle did not appear"

   Debug log analysis:
   ✓ debug_ability_used signal: FOUND at 00:01.456
   ✗ debug_puddle_spawned signal: NOT FOUND

   Expected sequence:
   1. ability.execute() -> ✓
   2. puddle.spawn() -> ✗ NOT CALLED

   Conclusion: spawn_puddle() method was never invoked
   Likely cause: Missing call in execute() after damage calculation
   ```

6. **Generate enriched feedback for PHASE 2:**

   Convert to structured feedback with debug context:

   ```python
   results = [
       {
           "item": 3,
           "status": "FAIL",
           "notes": "puddle not spawning",
           "debug_context": {
               "missing_signals": ["debug_puddle_spawned"],
               "last_signal": "debug_ability_used",
               "root_cause": "spawn_puddle() not called"
           }
       },
   ]
   ```

## Output

```
DEBUG ANALYSIS COMPLETE

Issues identified: {count}
Debug correlation: {matched}/{total} items have debug evidence

| # | Issue | Debug Evidence |
|---|-------|----------------|
| 3 | No puddle | debug_puddle_spawned missing |
| 4 | No sound | debug_sound_played missing |

-> Proceeding to PHASE 2: Categorize Issues
```
