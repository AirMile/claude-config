# GUT Test Conventions

Reference for test file structure, assertions, and mocks. Loaded Just-In-Time by `/game-build` during test generation.

## Test File Structure

```gdscript
extends GutTest
## Tests for {ClassName}
## Requirements: REQ-001, REQ-002, ...

var _sut: ClassName  # System Under Test

func before_each() -> void:
    _sut = ClassName.new()
    add_child(_sut) if _sut is Node else null
    await get_tree().process_frame

func after_each() -> void:
    if _sut and is_instance_valid(_sut):
        _sut.queue_free() if _sut is Node else _sut.free()

# REQ-001: {requirement}
func test_req001_{description}() -> void:
    # Arrange
    var expected := 20

    # Act
    var result := _sut.calculate_damage()

    # Assert
    assert_eq(result, expected, "Damage should be 20")
```

## Assertion Methods

```gdscript
assert_eq(got, expected, message)      # Equality
assert_ne(got, expected, message)      # Not equal
assert_true(condition, message)        # Boolean true
assert_false(condition, message)       # Boolean false
assert_null(value, message)            # Is null
assert_not_null(value, message)        # Not null
assert_has(array, value, message)      # Contains
assert_signal_emitted(obj, signal)     # Signal was emitted
pending(message)                       # Mark as pending
```

## Mock Objects

```gdscript
# Simple mock
var mock_target := double(Target).new()
stub(mock_target, "take_damage").to_do_nothing()

# Verify calls
assert_called(mock_target, "take_damage")
assert_call_count(mock_target, "take_damage", 1)
```

## Scene Structure Tests

For scene-construction / resource requirements, assert the node tree and configuration.
Write the test first — RED while the scene file or expected node is still missing.

```gdscript
# REQ-002: Puddle spawns at impact location
func test_req002_puddle_scene_structure() -> void:
    var scene := preload("res://scenes/{feature}.tscn").instantiate()
    add_child(scene)
    await get_tree().process_frame

    # Assert node tree
    assert_not_null(scene.get_node("ExpectedChild"), "Scene must contain ExpectedChild")

    # Assert configuration
    assert_eq(scene.some_property, expected_value)

    scene.queue_free()
```
