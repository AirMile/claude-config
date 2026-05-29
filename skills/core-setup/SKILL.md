---
name: core-setup
description: Project setup hub — detects whether a project is new (greenfield wizard), existing (mature scan), or needs a single tier-1 module added (install). Use with /core-setup, or when a user wants to initialize/onboard a project, scan an existing codebase into .project/ memory, or add a stack module (Tailwind, Vitest, shadcn-ui, etc.). Not for global ~/.claude/ setup — that is /core-bootstrap.
argument-hint: "[--mode=greenfield|mature|audit|resync|install] [module] [--no-llm]"
metadata:
  author: claude-config
  version: 2.0.0
  category: core
---

# Project Setup Skill

**Trigger**: `/core-setup [--mode=greenfield|mature|audit|resync|install] [module] [--no-llm]`

Hub skill that detects what the project needs and loads the appropriate flow.

### "Let Claude decide" Option

For every AskUserQuestion where the choice is a **technical decision** with an objectively better answer given project context (stack picks, install/skip prompts, configuration trade-offs), add a final option:

- **Label**: "Let Claude decide"
- **Description**: "Claude picks the best option based on your project context and best practices"

**Skip for personal-preference modals**: project name, project description, language selection, commit messages, anything tied to user identity or taste.

**When selected**: pick the best option based on project context and best practices. Display:

```
CLAUDE'S PICK: {chosen option} — {brief reason}
```

### Modal Option Cap

For dynamic multi-select modals (Audit fixes, Resync drift, Tech stack, Suggestions, Documentation Generators): apply `shared/SKILL-PATTERNS.md` § Modal Option Cap. Modals with ≤7 options are exempt.

---

## Phase 0: Detect Mode

Before all steps: if `~/.claude/CLAUDE.md` is missing, display:

> `Global bootstrap not done yet. Run /core-bootstrap first to initialize ~/.claude/.`

Stop.

0. **Check setup-pending marker** — if `.project/session/setup-pending.json` exists and no explicit `--mode=` flag was passed:
   1. Read marker: `mode` field determines the destination — `greenfield` or `mature`.
   2. Delete marker immediately after reading: `rm -f .project/session/setup-pending.json`.
   3. Display: `project-add handoff — starting {mode} flow directly.`
   4. Load `references/mode-{mode}.md`. Skip steps 1-5.

   If `--mode=...` flag is present: delete marker (`rm -f`) but honor the explicit flag.

1. **Module arg check** — if the invocation includes a non-flag argument (anything not prefixed with `--mode=` or `--no-llm`): treat it as `module_arg` and match (case-insensitive) against tier-1 modules:
   `inspect-overlay`, `tailwind`, `shadcn-ui`, `vitest`, `playwright`, `biome`, `eslint-prettier`, `zustand`, `tanstack-query`, `react-hook-form-zod`
   - **Match** → load `references/mode-install.md` with `direct_module=<module_arg>`. Skip steps 2-4.
   - **No match** → load `references/mode-install.md` with `direct_research=<module_arg>` (research path). Skip steps 2-4.

2. **Check `--mode` flag** — if provided, skip step 3 and load the corresponding reference directly:
   - `--mode=greenfield` → `references/mode-greenfield.md`
   - `--mode=mature` → `references/mode-mature.md` (pass through `--no-llm` flag if present)
   - `--mode=audit` → `references/mode-audit.md`
   - `--mode=resync` → `references/mode-resync.md`
   - `--mode=install` → `references/mode-install.md`

3. **Detect existing project** — run detection:

   ```bash
   python3 .claude/skills/core-setup/scripts/detect-existing.py --path .
   python3 .claude/skills/core-setup/scripts/detect-mode.py --path .
   ```

   Use `detect-mode.py` output as the primary classification. `detect-existing.py` checks for presence of existing config files.

4. **Choose mode** based on results:

   | detect-mode output | Existing configs? | Action                                                            | User-facing one-liner                       |
   | ------------------ | ----------------- | ----------------------------------------------------------------- | ------------------------------------------- |
   | `greenfield`       | no                | Load `mode-greenfield.md` directly                                | `New project — starting setup wizard.`      |
   | `greenfield`       | yes               | AskUserQuestion: Greenfield wizard / Mature scan / Audit / Resync | `Existing project detected — choose below.` |
   | `mature`           | n/a               | Load `mode-mature.md` directly                                    | `Existing project — scanning codebase.`     |
   | `ambiguous`        | n/a               | AskUserQuestion: Greenfield wizard / Mature scan / Audit          | `Project state unclear — choose below.`     |

   **Reporting rule:** show only the one-liner from the table above to the user. No filenames (`mode-greenfield.md`), no script output, no internal classification terms. Detection details belong in a debug mode, not in the happy path.

   **AskUserQuestion for ambiguous / existing configs** (single-select):
   - **Greenfield wizard** — "New project, I want to configure stack and standards" → `mode-greenfield.md`
   - **Mature scan (Recommended for existing project)** — "Existing project, scan the codebase and build base memory (incl. Module Gap modal for empty tier-1 slots)" → `mode-mature.md`
   - **Audit** — "Check what's missing, no full setup" → `mode-audit.md`
   - **Resync** _(only for `greenfield + existing configs`, not for `ambiguous`)_ — "Only update CLAUDE.md template sections" → `mode-resync.md`

5. **Load the chosen reference.**
