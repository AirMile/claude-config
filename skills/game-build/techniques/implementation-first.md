# Implementation First Technique

For requirements where TDD is impractical (visual, scene setup, configuration).

## When to Use

- Scene tree construction and node configuration
- Resource creation (.tres files)
- Visual configuration (sprites, animations, particles)
- Audio setup (AudioStreamPlayer nodes)
- UI layout and theme configuration

## Process

1. **Implement directly** based on requirements
2. **Write verification test afterwards** to prevent regression
3. **Run test** to confirm current behavior is captured

## Verification Test Pattern

```gdscript
# Written AFTER implementation to capture expected behavior
func test_req{xxx}_{description}() -> void:
    # Verify the implementation works as expected
    var scene := preload("res://scenes/{feature}.tscn").instantiate()
    add_child(scene)
    await get_tree().process_frame

    # Assert scene structure
    assert_not_null(scene.get_node("ExpectedChild"))

    # Assert configuration
    assert_eq(scene.some_property, expected_value)

    scene.queue_free()
```

## Debug Hooks

Same as TDD — add debug prints and signals for playtest verification.
