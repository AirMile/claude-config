# Claude-config Init (mature PHASE 5.6)

**Inputs**: detected stack (PHASE 2a). Loaded only when `.claude/settings.local.json` or the format hook is missing (check stays in mode-mature.md).

No interactive permission wizard in mature mode — defaults are safe, user can adjust afterwards.

**Check and write only if missing:**

- `.claude/settings.local.json` not present → write with Full Access defaults:

  ```json
  {
    "permissions": {
      "allow": [
        "Read *",
        "Edit *",
        "Write *",
        "Bash(npm *)",
        "Bash(npx *)",
        "Bash(git *)"
      ],
      "deny": ["Edit node_modules/**", "Write dist/**", "Write build/**"]
    }
  }
  ```

  Stack-specific additions: Python → add `Bash(python *)`, `Bash(pip *)`; Go → `Bash(go *)`.

- `.claude/hooks/format-on-save.cjs` not present → write hook based on detected stack. Formatter mapping: see `references/phase-configure-claude.md` formatter table.

When done: return to PHASE 5.65.
