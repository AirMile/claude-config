---
name: core-merge
description: "DEPRECATED alias for /core-finalize. Use /core-finalize instead. Identical behaviour: solo-merge or cleanup-only depending on PR state."
argument-hint: "[feature-name]"
metadata:
  author: claude-config
  version: 4.0.0
  category: core
---

# /core-merge (deprecated)

Renamed to `/core-finalize`. All logic lives in `shared/FINALIZE.md`.

Both names work — prefer `/core-finalize` going forward. `/core-merge` stays as a muscle-memory alias.

## Workflow

Follow `skills/core-finalize/SKILL.md` for feature-name resolution, then `shared/FINALIZE.md` end-to-end.
