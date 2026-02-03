---
description: Edit skills interactively
disable-model-invocation: true
---

# Edit

## Overview

This skill edits existing skills. It detects if resources exist, loads the content, facilitates modifications, and applies changes with verification.

**Trigger**: `/core-edit` or `/core-edit [name]`

## Workflow

### Step 1: Load Target

**If name provided** (`/core-edit core-commit`):

1. Check if `.claude/skills/[name]/SKILL.md` exists → load skill
2. Check if `.claude/skills/[name]/` contains supporting files → note has resources
3. If skill doesn't exist → show error with available options

**If no name** (`/core-edit`):

1. Discover all skills using bash find with symlink support:

   ```bash
   find -L .claude/skills -name "SKILL.md" -type f 2>/dev/null | sed 's|^\.claude/skills/||' | sed 's|/SKILL\.md$||' | sort
   ```

   Note: The `-L` flag makes find follow symbolic links/junctions. `Glob` does not follow Windows junctions/symlinks correctly.

2. Display numbered table with skill names
3. Ask user to type a number (plain text, no modal)
4. Load selected skill based on number input

**After loading, show preview**:

```
LOADED: [name] ([skill / skill + resources])

[Brief summary of what it does]

[If has resources: list supporting files]
```

Proceed immediately to Step 2.

### Step 2: Understand Edit Request

Use **AskUserQuestion** tool:

- header: "Edit Type"
- question: "Wat wil je aanpassen?"
- options:
  - label: "Content (Recommended)", description: "Workflow, instructies, output format"
  - label: "Rename", description: "Skill naam wijzigen"
  - label: "Resources", description: "Scripts, references, templates"
  - label: "Delete", description: "Skill verwijderen"
- multiSelect: true

**Important**: If user selects "Delete", treat it as exclusive. Delete requires separate confirmation flow.

**Based on answer, ask follow-ups** (2-3 at a time) to understand the specific changes needed.

**For multiple selections**: gather specifics for each type sequentially, then show combined preview before applying.

**Summarize understanding**:

```
SUMMARY:

I understand you want to:
- [specific change 1]
- [specific change 2]
```

Confirm with AskUserQuestion before proceeding.

### Step 3: Show Preview

**IMPORTANT: All skill files must be written in English.**

- Skill content, instructions, examples: English
- AskUserQuestion labels/descriptions: Follow user's language preference from CLAUDE.md

Generate and show the changes:

```
PREVIEW:

File: [filename]

[For small changes: show diff-style]
- old line
+ new line

[For large changes: show new content]
```

Use **AskUserQuestion** for apply confirmation:

- header: "Wijzigingen Toepassen"
- question: "Wil je deze wijzigingen toepassen?"
- options:
  - label: "Toepassen (Recommended)", description: "Wijzigingen doorvoeren"
  - label: "Aanpassen", description: "Ik wil eerst iets wijzigen"
  - label: "Annuleren", description: "Niets wijzigen, stoppen"
- multiSelect: false

Iterate until approved (max 3 rounds).

### Step 4: Apply Changes

#### Step 4.0: Detect Junction Structure

Before modifying files, detect if skills use per-skill junctions to a shared library.

**Step 1 — Check if junctions are active:**

```bash
powershell -Command "(Get-ChildItem '.claude/skills' -Directory | Select-Object -First 1).LinkType"
```

- Output `Junction` → per-skill junctions active, proceed to step 2
- Empty output → no junctions, files live directly in `.claude/skills/`

**Step 2 — Get shared library path (only if Junction):**

```bash
powershell -Command "Split-Path (Get-ChildItem '.claude/skills' -Directory | Select-Object -First 1).Target"
```

- Output is the shared library path (e.g., `C:\Projects\claude-config\skills`)

**If per-skill junctions active:**

- Content edits: edit files via the junction (transparent, no extra steps)
- Rename: must remove old junction, rename in shared library, create new junction
- Delete: must remove junction AND delete from shared library

#### Step 4.1: Apply Changes

Apply content edits, resource changes, renames, or deletions as appropriate.

**For rename with junctions:**

1. Remove old junction
2. Rename directory in shared library
3. Create new junction
4. Update paths in SKILL.md
5. Verify new junction works

#### Step 4.2: Update profiles.yaml (Rename/Delete only)

**Skip this step for:** Content-only edits and resource changes.

**Apply when:** Skill was renamed or deleted.

1. **Locate profiles.yaml:**
   - If per-skill junctions: `{shared_library}/core-profile/profiles.yaml`
   - If no junctions: `.claude/skills/core-profile/profiles.yaml`

2. **For rename:**
   - Find old skill name in profiles.yaml
   - Replace with new skill name
   - Maintain alphabetical order within the profile

3. **For delete:**
   - Find and remove the skill name from profiles.yaml

4. **Validate** by running:

   ```bash
   python3 .claude/skills/core-profile/switch-profile.py --validate
   ```

**Output**:

```
CHANGES APPLIED!

Modified:
- [list of changed files]

[If renamed: old name → new name]
[If deleted: removed from profile]
[If junction: Junction updated]
profiles.yaml: updated
```

### Step 5: Verification

#### 5.1 Analyze with Sequential Thinking

Use sequential thinking to verify:

1. List requested changes — what was supposed to change
2. Verify each change — confirm each modification was applied
3. Check file structure — ensure no broken paths or missing files
4. Validate frontmatter — confirm YAML is valid (if applicable)

#### 5.2 Search for Orphaned References

**Only for rename/delete operations.** Skip for content-only edits.

Search for orphaned references to the old/deleted skill name in `.claude/` recursively.

#### 5.3 Report and Resolve

- Auto-fix (no approval): formatting, whitespace, path separators
- Ask user (needs approval): content changes, deletions, structural changes

Send notification:

```bash
powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "Skill edited: [name]"
```

## Special Cases

### Delete

Use **AskUserQuestion** for confirmation with "Annuleren" as recommended option (destructive action).

**If per-skill junctions:** remove junction first, then delete from shared library.

**Always:** remove skill name from profiles.yaml (Step 4.2).

### Add/Remove Resources

When adding: create files in skill directory, update SKILL.md to reference them.
When removing: delete files, update SKILL.md to remove references. Confirm before deleting.
