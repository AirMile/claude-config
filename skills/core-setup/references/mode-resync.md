# Resync Mode

Synchronize only CLAUDE.md template sections with the most recent `CLAUDE.base.md`. Existing project-specific content remains unchanged.

---

## Pre-flight

Check that `CLAUDE.md` exists in the project root. If missing → exit with instruction: use `/core-setup` to set up the project first.

---

## Sync

Follow `references/claude-md-sync.md` with these parameters:

- `mode: "resync"`
- `generate-if-missing: false`
- `stack-overwrite: "never"`
- `inferred-stack: null`

PHASE D produces a standalone ASCII report — that is the final result of this skill.
