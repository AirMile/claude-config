# GUT Test Conventions

Reference voor test file structuur, assertions en mocks. Geladen Just-In-Time door `/game-build` tijdens test generation.

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
