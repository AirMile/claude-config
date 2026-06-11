# Configure Claude (greenfield Phase 5)

**Inputs**: Phase 2.3 project type, Phase 2.4 stack choice.

## Documentation Generators

Claude picks defaults based on Phase 2.3 project type + Phase 2.4 stack. No user confirmation — write silently into CLAUDE.md. Add stack-specific extras if obvious from chosen stack.

| Project type | Default generators                                                   |
| ------------ | -------------------------------------------------------------------- |
| Web Frontend | components, routes, state, design-tokens                             |
| Web Backend  | api, routes, middleware, auth-flow (auth-flow only if auth in stack) |
| Fullstack    | components, routes, state, api, middleware                           |
| Game         | scenes, game-classes, state-machines                                 |
| Mobile       | components, routes, state                                            |
| Desktop      | components, routes, state                                            |
| CLI          | (none — omit section from CLAUDE.md)                                 |

## Permissions

AskUserQuestion (single-select) — permission preset:

- **Full access (Recommended)**: read + edit + create files, bash (npm/npx/node), git, tests
- **Restrictive**: read-only files, tests only

For custom settings: the user can edit `.claude/settings.local.json` directly after setup (template below).

Then plain text — directory exclusions:

```
---

### ▸ Question — Directory exclusions

Which directories do you want to exclude from Claude's write access?

1. node_modules
2. vendor
3. dist
4. build
5. .env

→ Claude recommends: {numbers} — {1-sentence reason based on stack/project type}

Which would you like to exclude? (e.g. `1,3` or `none`)

---
```

Write `.claude/settings.local.json` with `permissions.allow` and `permissions.deny` arrays:

```json
{
  "permissions": {
    "allow": ["Read *", "Edit *", "Write *", "Bash(npm *)", "Bash(npx *)"],
    "deny": ["Edit node_modules/**", "Write dist/**"]
  }
}
```

## Code Formatter (PostToolUse Hook)

Auto-format after every Write/Edit.

**Step 1 — Check existing hook:**

```bash
ls -la .claude/hooks/format-on-save.cjs 2>/dev/null
```

If the file already exists (via symlink to global claude-config or project-local): read it and check if it supports the project stack (e.g. Biome via `biome.json` detection). If yes, skip creating — only reference in `settings.local.json`.

**Step 2 — Only create if no existing hook:**

Create `.claude/hooks/format-on-save.cjs` with:

- Node.js script that reads stdin JSON, extracts file path, checks extension, calls formatter
- Use `.cjs` to avoid ES Module issues
- IMPORTANT: do NOT write to `.claude/hooks/` if that directory is a symlink to a shared repo (check via `readlink .claude/hooks`)

Formatter selection per stack:

| Stack                                   | Formatter     | Command                   |
| --------------------------------------- | ------------- | ------------------------- |
| JS/TS (React, Vue, Next.js, Node, etc.) | Prettier      | `npx prettier --write`    |
| PHP/Laravel                             | Pint          | `./vendor/bin/pint`       |
| Python                                  | Black         | `black`                   |
| Rust                                    | rustfmt       | `rustfmt`                 |
| Go                                      | gofmt         | `gofmt -w`                |
| C#/.NET                                 | dotnet format | `dotnet format --include` |
| Godot/GDScript                          | gdformat      | `gdformat`                |
| C/C++                                   | clang-format  | `clang-format -i`         |
| Dart/Flutter                            | dart format   | `dart format`             |

Add the hook to `settings.local.json` — in the same file as `permissions` (do not write separately):

```json
{
  "permissions": {
    "allow": ["..."],
    "deny": ["..."]
  },
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/hooks/format-on-save.cjs"
          }
        ]
      }
    ]
  }
}
```

When done: return to Phase 5b.
