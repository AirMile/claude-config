# PHASE 3b: Integration Tests + Playtest

Load this file when entering PHASE 3b. Contains the integration test scene template and DebugListener script.

---

## Integration Test Scenes

Create runtime test scenes for MCP verification:

**File:** `tests/scenes/test_{feature}_runtime.tscn`
**Script:** `tests/scenes/test_{feature}_runtime.gd`

```gdscript
extends Node2D
## Integration test scene for {Feature}
## Run via MCP to verify runtime behavior

var _results: Dictionary = {}
var _all_passed: bool = false

func _ready() -> void:
    await _run_all_tests()
    _report_and_quit()

func _run_all_tests() -> void:
    print("INTEGRATION TEST START: {feature}")

    _results["req001_damage"] = await _test_req001_damage()
    _results["req002_spawn"] = await _test_req002_spawn()

    _all_passed = _results.values().all(func(r): return r)

func _test_req001_damage() -> bool:
    var ability := WaterAbility.new()
    add_child(ability)
    # ... test logic
    return true

func _report_and_quit() -> void:
    print("")
    print("INTEGRATION TEST RESULTS:")
    for test_name in _results:
        var status := "PASS" if _results[test_name] else "FAIL"
        print("TEST:%s:%s" % [test_name, status])

    print("")
    var final_status := "PASS" if _all_passed else "FAIL"
    print("FINAL:%s" % final_status)

    get_tree().quit(0 if _all_passed else 1)
```

**Run via MCP:**

```python
run_project(projectPath=".", scene="res://tests/scenes/test_{feature}_runtime.tscn")
get_debug_output()
# Parse output for FINAL:PASS or FINAL:FAIL
```

---

## Playtest Checklist + Scene

Build `tests.checklist[]` data for feature.json (written in PHASE 4b):

```json
{
  "tests": {
    "checklist": [
      {
        "id": 1,
        "title": "{what to verify}",
        "type": "MANUAL",
        "requirementId": "REQ-001",
        "steps": ["open game", "use ability on enemy", "observe damage effect"],
        "expected": "enemy shows damage number, health bar decreases",
        "status": "pending"
      }
    ]
  }
}
```

Include both automated test results and manual playtest items in the checklist. Automated items get `type: "AUTO"`, manual playtest items get `type: "MANUAL"`.

Guidelines for checklist items:

- Write steps as PLAYER ACTIONS (move to, press, use ability), not as code
- Expected = what the player WOULD SEE/HEAR (visual effect, sound, UI update)
- Do NOT add an item that says "run GUT tests" — unit tests are already covered by the build
- MANUAL items: describe concrete gameplay interactions
- AUTO items: describe what the integration test scene verifies

**Create playtest scene** at `.project/features/{feature-name}/playtest_scene.tscn`:

```
PlaytestArena (Node2D)
+-- Camera2D (current=true)
+-- PlayerSpawn (Marker2D)
+-- Player (instanced from scenes/player/ if exists)
+-- TestTarget (CharacterBody2D for ability targets)
+-- ArenaBounds (ColorRect, visual boundary)
+-- FeatureUnderTest (instanced based on feature type)
+-- DebugListener (captures debug signals)
```

**DebugListener script** at `.project/features/{feature-name}/debug_listener.gd`:

```gdscript
extends Node
## Auto-generated debug listener for playtest
## Captures all debug_* signals and logs them for analysis

var _debug_log: Array[Dictionary] = []

func _ready() -> void:
    _connect_debug_signals(get_parent())
    print("[PLAYTEST] Debug listener active - tracking %d signals" % _debug_log.size())

func _connect_debug_signals(node: Node) -> void:
    for signal_info in node.get_signal_list():
        if signal_info.name.begins_with("debug_"):
            node.connect(signal_info.name, _on_debug_signal.bind(node.name, signal_info.name))
    for child in node.get_children():
        _connect_debug_signals(child)

func _on_debug_signal(data: Variant, node_name: String, signal_name: String) -> void:
    var entry := {
        "time": Time.get_ticks_msec(),
        "node": node_name,
        "signal": signal_name,
        "data": data
    }
    _debug_log.append(entry)
    print("[PLAYTEST] %s.%s: %s" % [node_name, signal_name, str(data)])

func get_log() -> Array[Dictionary]:
    return _debug_log

func get_log_summary() -> String:
    var summary := "Debug Log (%d entries):\n" % _debug_log.size()
    for entry in _debug_log:
        summary += "  %dms: %s.%s\n" % [entry.time, entry.node, entry.signal]
    return summary
```
