---
name: core-edit
description: >-
  Edit existing Claude Code skills with rename, delete, and resource management.
  Use with /core-edit to modify skill content, frontmatter, or resources.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: core
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

**Infer the edit type from context** — do NOT ask what the user wants to change via a modal. The user's message when invoking the skill (or the conversation context) tells you what they need.

**Detection rules:**

- User describes content changes (workflow, instructions, output) → **Content**
- User says "rename", "hernoem", or provides a new name → **Rename**
- User mentions scripts, files, resources, templates → **Resources**
- User says "delete", "verwijder", "remove" → **Delete**
- Ambiguous or no context provided → ask in plain text: "What do you want to change?"

**Important**: Delete requires separate confirmation flow (see Special Cases).

**If more detail is needed**, ask follow-up questions in plain text (2-3 at a time) to understand the specific changes.

**Summarize understanding**:

```
SUMMARY:

I understand you want to:
- [specific change 1]
- [specific change 2]
```

Confirm with a short "Klopt dit?" in plain text before proceeding. Only use AskUserQuestion if there's a genuine ambiguous choice between distinct options.

### Step 3: Show Preview

**IMPORTANT: All skill files must be written in English.**

- Skill content, instructions, examples: English
- AskUserQuestion labels/descriptions: Follow user's language preference from CLAUDE.md

**When reviewing the skill, also consider suggesting these patterns if missing:**

- **ASCII diagram**: if the skill has a complex flow, architecture, or decomposition phase — suggest adding an instruction to generate an ASCII diagram at that point. See `shared/SKILL-PATTERNS.md`
- **Interview checkpoint**: if the skill gathers 3+ inputs before execution — suggest adding a CHECKPOINT between gathering and execution phases (summary table + confirmation). See `shared/SKILL-PATTERNS.md`
- **Pass paths, not content**: if the skill spawns 2+ sub-agents that read project files — suggest passing a `<reference-paths>` block with categorized paths instead of file contents. See `shared/SKILL-PATTERNS.md`
- **Git safety gates**: if the skill performs git mutations — suggest adding explicit state re-reads after mutations and safety gates before risky operations. See `shared/SKILL-PATTERNS.md`

Only suggest these if they add genuine value — not every skill needs them.

**Enter plan mode** before showing the preview:

1. Use the **EnterPlanMode** tool to switch to plan mode
2. Write the modified SKILL.md content to the plan file showing the full updated file
3. For small changes: also include a summary of what changed at the top of the plan
4. For resource changes: include all affected file contents
5. Use **ExitPlanMode** to present the plan for user approval

The plan file should contain the complete updated skill content exactly as it will be written. The user reviews and approves via the built-in plan approval flow.

After approval, proceed to Step 4.

### Step 4: Apply Changes

#### Step 4.0: Detect Junction Structure

Before modifying files, detect if skills use per-skill junctions to a shared library.

**Step 1 — Check if symlinks/junctions are active:**

**Linux:**

```bash
test -L ".claude/skills/$(ls .claude/skills | head -1)" && echo "linked" || echo "direct"
```

**Windows:**

```bash
powershell -Command "(Get-ChildItem '.claude/skills' -Directory | Select-Object -First 1).LinkType"
```

- Output `linked` or `Junction` → per-skill links active, proceed to step 2
- Output `direct` or empty → no links, files live directly in `.claude/skills/`

**Step 2 — Get shared library path (only if linked):**

**Linux:**

```bash
readlink -f .claude/skills/$(ls .claude/skills | head -1) | xargs dirname
```

**Windows:**

```bash
powershell -Command "Split-Path (Get-ChildItem '.claude/skills' -Directory | Select-Object -First 1).Target"
```

**If per-skill links active:**

- Content edits: edit files via the link (transparent, no extra steps)
- Rename: must remove old link, rename in shared library, create new link
- Delete: must remove link AND delete from shared library

#### Step 4.1: Apply Changes

Apply content edits, resource changes, renames, or deletions as appropriate.

**For rename with symlinks/junctions:**

1. Remove old link:
   - Linux: `unlink .claude/skills/[old-name]`
   - Windows: `cmd //c "rmdir .claude\skills\[old-name]"`
2. Rename directory in shared library
3. Create new link:
   - Linux: `ln -s {shared_library}/[new-name] .claude/skills/[new-name]`
   - Windows: `cmd //c "mklink /J .claude\skills\[new-name] {shared_library}\[new-name]"`
4. Update paths in SKILL.md
5. Verify new link works

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

#### 5.1 Verify Changes

Verify:

1. List requested changes — what was supposed to change
2. Verify each change — confirm each modification was applied
3. Check file structure — ensure no broken paths or missing files
4. Validate frontmatter against Anthropic skill spec:
   - `name` field present (required, kebab-case, matches folder name)
   - `description` field present (required, includes WHAT + WHEN pattern with trigger phrases, under 1024 chars)
   - No XML angle brackets (< >) in frontmatter
   - `metadata` block present (recommended: author, version, category)
5. If frontmatter is missing required fields, offer to add them as part of the edit

#### 5.2 Search for Orphaned References

**Only for rename/delete operations.** Skip for content-only edits.

Search for orphaned references to the old/deleted skill name in `.claude/` recursively.

#### 5.3 Report and Resolve

- Auto-fix (no approval): formatting, whitespace, path separators
- Ask user (needs approval): content changes, deletions, structural changes

## Frontmatter Reference

When editing skill frontmatter, ensure it follows the Anthropic skill spec:

```yaml
---
# REQUIRED
name: skill-name # kebab-case, must match folder name
description: >- # MUST include WHAT + WHEN
  What it does. Use when user says "trigger phrase" or asks for "task".

# RECOMMENDED
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: core # core|dev|frontend|game|project|story|team|thinking

# OPTIONAL — Claude Code specific
disable-model-invocation: true
argument-hint: [hint]
---
```

**Description pattern**: `[What it does] + [When to use it / trigger phrases]`

If a skill being edited is missing `name` or has a weak `description`, suggest improvements as part of the edit.

## Agent Definitions

When editing an agent (`agents/*.md`), keep the `description` field short (max ~5 words). Agents are invoked by skills that provide full context — verbose descriptions waste tokens in every conversation.

## Special Cases

### Delete

Use **AskUserQuestion** for confirmation with "Annuleren" as recommended option (destructive action).

**If per-skill links:** remove link first (`unlink` on Linux, `cmd //c "rmdir"` on Windows), then delete from shared library.

**Always:** remove skill name from profiles.yaml (Step 4.2).

### Add/Remove Resources

When adding: create files in skill directory, update SKILL.md to reference them.
When removing: delete files, update SKILL.md to remove references. Confirm before deleting.
