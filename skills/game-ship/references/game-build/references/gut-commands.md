# GUT Commands Reference

Godot test commands for `/game-build`.

> **Path resolution**: `{godot_executable}` is resolved via `paths.yaml` (see [skills/project-add/paths.yaml](../../project-add/paths.yaml)). Per platform: macOS = `/Applications/Godot.app/Contents/MacOS/Godot`, Windows = `C:\Godot\Godot_v4.4.1-stable_win64.exe`. Override with env var `CLAUDE_GODOT_EXECUTABLE` or `.claude/paths.local.yaml`.

```bash
# Run all tests
"{godot_executable}" --headless --path . -s addons/gut/gut_cmdln.gd -gexit

# Run with verbose output
"{godot_executable}" --headless --path . -s addons/gut/gut_cmdln.gd -gexit -glog=3

# Run specific test file
"{godot_executable}" --headless --path . -s addons/gut/gut_cmdln.gd -gexit -gtest=res://tests/test_{feature}.gd

# Run tests matching name pattern
"{godot_executable}" --headless --path . -s addons/gut/gut_cmdln.gd -gexit -gunit_test_name={pattern}
```
