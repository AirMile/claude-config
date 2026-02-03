---
description: Edit skills interactively
disable-model-invocation: true
---

# Edit

## Overview

This skill edits existing skills. It detects if resources exist, loads the content, facilitates modifications, and applies changes with verification.

**Trigger**: `/core-edit` or `/core-edit [name]`

## Type Detection

**Skill only**: `.claude/skills/[name]/SKILL.md` exists, no supporting files alongside
**Skill with resources**: `.claude/skills/[name]/SKILL.md` exists AND `.claude/skills/[name]/` contains supporting files

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

2. Display numbered table with skill names only (DO NOT read files for descriptions):

   ```
   | #  | Skill                |
   |----|----------------------|
   | 1  | core-edit            |
   | 2  | core-create          |
   | 3  | dev-build            |
   | ...| ...                  |
   ```

3. Ask user to type a number (plain text, no modal):
   "Typ het nummer van de skill die je wilt bewerken:"

4. Load selected skill based on number input

**After loading, show preview**:

```
LOADED: [name] ([skill / skill + resources])

[Brief summary of what it does]

[If has resources: list supporting files]
```

Proceed immediately to Step 2.

### Step 2: Understand Edit Request

Ask targeted questions using **AskUserQuestion** tool:

**AskUserQuestion Configuration:**

- header: "Edit Type"
- question: "Wat wil je aanpassen?"
- options:
  1. label: "Content (Recommended)", description: "Workflow, instructies, output format"
  2. label: "Rename", description: "Skill naam wijzigen"
  3. label: "Resources", description: "Scripts, references, templates"
  4. label: "Delete", description: "Skill verwijderen"
- multiSelect: true

**Important**: If user selects "Delete", treat it as exclusive (ignore other selections). Delete requires separate confirmation flow.

**Response Handling:**

- Single selection → proceed to type-specific follow-ups
- Multiple selections → proceed to Sequential Modal Flow (Step 2b)
- Delete (alone or with others) → proceed to delete confirmation only

**Based on answer, ask follow-ups** (2-3 at a time):

For content changes:

- "Welke sectie moet aangepast worden?"
- "Wat is er mis met de huidige versie?"
- "Hoe moet het eruitzien na de wijziging?"

For rename:

- "Wat moet de nieuwe naam zijn?"

For resources, use **AskUserQuestion** for type and action:

**AskUserQuestion Configuration (Resource Type):**

- header: "Resource Type"
- question: "Welk type resource?"
- options:
  1. label: "Scripts (Recommended)", description: "Uitvoerbare scripts (Python, Bash, PowerShell)"
  2. label: "References", description: "Documentatie of referentiebestanden (.md)"
  3. label: "Templates/Assets", description: "Statische bestanden (images, templates, data)"
  4. label: "Vraag uitleggen", description: "Leg uit wat deze opties betekenen"
- multiSelect: false

**AskUserQuestion Configuration (Action):**

- header: "Actie"
- question: "Wat wil je doen?"
- options:
  1. label: "Toevoegen (Recommended)", description: "Nieuw bestand toevoegen"
  2. label: "Verwijderen", description: "Bestaand bestand verwijderen"
  3. label: "Vraag uitleggen", description: "Leg uit wat deze opties betekenen"
- multiSelect: false

Then ask in plain text: "Wat moet het bestand doen/bevatten?"

### Step 2b: Sequential Modal Flow (Multiple Selections)

When user selects multiple edit types (e.g., Content + Rename + Resources), gather specifics for each type sequentially:

**Modal 2a: Content Details** (if Content selected)
Use **AskUserQuestion**:

- header: "Content Wijzigingen"
- question: "Welke content wil je aanpassen?"
- options:
  1. label: "Workflow (Recommended)", description: "De stappen en logica van de skill"
  2. label: "Instructies", description: "Tekst en uitleg in de skill"
  3. label: "Output format", description: "Hoe de output eruitziet"
  4. label: "Frontmatter", description: "Skill configuratie (description, allowed-tools, context, etc.)"
- multiSelect: true

**Modal 2b: Rename Details** (if Rename selected)
Use **AskUserQuestion**:

- header: "Nieuwe Naam"
- question: "Wat moet de nieuwe naam zijn?"
- options: [suggest 2-3 name variations based on current name]
  - Example: label: "core-suggest-v2", description: "Versie suffix toevoegen"
  - Last option: label: "Vraag uitleggen", description: "Leg uit wat deze opties betekenen"
- multiSelect: false
- Note: User can type custom name

**Modal 2c: Resource Details** (if Resources selected)
Use the Resource Type and Action modals defined above.

**Modal 3: Combined Preview**
After gathering all specifics, show combined preview:

```
GECOMBINEERDE WIJZIGINGEN:

Content:
- [specific content change 1]
- [specific content change 2]

Rename:
- [old name] → [new name]

Resources:
- [resource action 1]
```

Use **AskUserQuestion** for final confirmation:

- header: "Bevestiging"
- question: "Alle wijzigingen correct?"
- options:
  1. label: "Toepassen (Recommended)", description: "Alle wijzigingen doorvoeren"
  2. label: "Aanpassen", description: "Ik wil iets wijzigen"
  3. label: "Annuleren", description: "Niets wijzigen, stoppen"
  4. label: "Vraag uitleggen", description: "Leg uit wat deze opties betekenen"
- multiSelect: false

**Response Handling:**

- Toepassen → proceed to Step 3 (Preview with diffs)
- Aanpassen → ask which part needs adjustment, return to relevant modal
- Annuleren → exit edit flow

---

**Summarize understanding** (for single selection flow):

```
SUMMARY:

I understand you want to:
- [specific change 1]
- [specific change 2]
```

Then use **AskUserQuestion** for confirmation:

**AskUserQuestion Configuration:**

- header: "Bevestiging"
- question: "Klopt deze samenvatting?"
- options:
  1. label: "Ja (Recommended)", description: "Ga door met deze wijzigingen"
  2. label: "Nee", description: "Ik wil verduidelijken wat ik nodig heb"
  3. label: "Vraag uitleggen", description: "Leg uit wat deze opties betekenen"
- multiSelect: false

**Response Handling:**

- Ja → proceed to Step 3 (Preview)
- Nee → ask user what needs clarification

### Step 3: Show Preview

**IMPORTANT: All skill files must be written in English.**

- Skill content, instructions, examples: English
- AskUserQuestion labels/descriptions: Follow user's language preference from CLAUDE.md
- This ensures skills are reusable across projects

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

**AskUserQuestion Configuration:**

- header: "Wijzigingen Toepassen"
- question: "Wil je deze wijzigingen toepassen?"
- options:
  1. label: "Toepassen (Recommended)", description: "Wijzigingen doorvoeren"
  2. label: "Aanpassen", description: "Ik wil eerst iets wijzigen"
  3. label: "Annuleren", description: "Niets wijzigen, stoppen"
  4. label: "Vraag uitleggen", description: "Leg uit wat deze opties betekenen"
- multiSelect: false

**Response Handling:**

- Toepassen → proceed to Step 4 (Apply Changes)
- Aanpassen → show adjustment modal (see below)
- Annuleren → exit edit flow

**If "Aanpassen" selected**:

Use AskUserQuestion tool:

- header: "Aanpassing"
- question: "Wat moet aangepast worden?"
- options:
  - label: "Content onjuist (Recommended)"
    description: "De inhoudelijke wijzigingen kloppen niet"
  - label: "Onderdelen missen"
    description: "Wijzigingen zijn incompleet, er mist iets"
  - label: "Onderdelen verwijderen"
    description: "Sommige wijzigingen moeten uitgesloten worden"
  - label: "Opnieuw beginnen"
    description: "Terug naar requirements verzamelen"
- multiSelect: false

Response handling:

- If "Content onjuist": vraag wat specifiek fout is
- If "Onderdelen missen": vraag wat er mist
- If "Onderdelen verwijderen": vraag wat verwijderd moet worden
- If "Opnieuw beginnen": ga terug naar Step 2

Iterate until approved (max 3 rounds).

### Step 4: Apply Changes

#### Step 4.0: Detect Junction Structure

Before modifying files, detect if skills use per-skill junctions to a shared library.

```bash
powershell -File - <<'PS1'
$item = Get-ChildItem '.claude/skills' -Directory | Select-Object -First 1
if ($item -and $item.LinkType -eq 'Junction') {
  $target = $item.Target -replace '[\\/][^\\/]+$', ''
  Write-Output "JUNCTIONS:$target"
} else {
  Write-Output "DIRECT"
}
PS1
```

- `JUNCTIONS:{path}` → per-skill junctions, shared library at `{path}`
- `DIRECT` → no junctions, files live directly in `.claude/skills/`

**If per-skill junctions active:**

- Content edits: edit files via the junction (transparent, no extra steps)
- Rename: must remove old junction, rename in shared library, create new junction
- Delete: must remove junction AND delete from shared library

#### Step 4.1: Apply Content Changes

**For skill only**:

1. Edit `.claude/skills/[name]/SKILL.md`

**For skill with resources**:

1. Edit `.claude/skills/[name]/SKILL.md`
2. Update/create/delete supporting files as needed in `.claude/skills/[name]/`

#### Step 4.2: Apply Rename (if applicable)

**If direct (no junctions):**

1. Rename skill directory
2. Update paths in SKILL.md file

**If per-skill junctions:**

1. Remove old junction:
   ```bash
   powershell -File - <<'PS1'
   Remove-Item '.claude/skills/[old-name]' -Force
   PS1
   ```
2. Rename directory in shared library:
   ```bash
   mv '{shared_library_path}/[old-name]' '{shared_library_path}/[new-name]'
   ```
3. Create new junction:
   ```bash
   powershell -File - <<'PS1'
   New-Item -ItemType Junction -Path '.claude/skills/[new-name]' -Target '{shared_library_path}/[new-name]'
   PS1
   ```
4. Update paths in SKILL.md file
5. Verify new junction works:
   ```bash
   test -f ".claude/skills/[new-name]/SKILL.md" && echo "Junction OK" || echo "Junction FAILED"
   ```

**Output**:

```
CHANGES APPLIED!

Modified:
- [list of changed files]

[If renamed: old name → new name]
[If junction: Junction updated: .claude/skills/[new-name] → {shared_library_path}/[new-name]]
```

### Step 5: Verification

#### 5.1 Analyze with Sequential Thinking

Use the `mcp__sequential-thinking__sequentialthinking` tool to systematically verify all changes:

1. **List requested changes** - Enumerate what was supposed to change
2. **Verify each change** - Confirm each modification was applied correctly
3. **Check file structure** - Ensure no broken paths or missing files
4. **Validate frontmatter** - Confirm YAML is valid (if applicable)
5. **Assess completeness** - Identify any missed or partial changes

#### 5.2 Search for Orphaned References

**Only for rename/delete operations.** Skip this step for content-only edits.

After sequential thinking analysis, search for orphaned references to the old/deleted skill name:

**Search patterns** (replace `old-name` with actual skill name):

```bash
# Primary search - catches most references
Grep pattern="old-name" path=".claude/"

# Additional patterns to verify:
# - /old-name (slash command invocations)
# - old-name/SKILL.md (file references)
# - /skills/old-name/ (skill folder paths)
```

The search covers `.claude/` recursively, including:

- skills, agents
- CLAUDE.md and settings files
- Any other configuration files

#### 5.3 Report and Resolve

If issues found:

- List each issue with file location
- Auto-fix (no approval): formatting, whitespace, path separators
- Ask user (needs approval): content changes, deletions, structural changes

**Final output**:

```
VERIFICATION COMPLETE

Sequential thinking analysis: [summary]
Orphaned references found: [count]
Issues resolved: [count]

[name] updated successfully!
```

Send notification:

```bash
powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "Skill edited: [name]"
```

## Special Cases

### Rename

When renaming, update ALL of:

1. Skill directory name (and junction if per-skill junctions active — see Step 4.2)
2. Paths inside SKILL.md (if references supporting files)
3. Any internal references
4. profiles.yaml if skill is listed there

Show all changes in preview.

### Delete

When deleting, use **AskUserQuestion** for confirmation:

```
VERWIJDER BEVESTIGING

Dit wordt permanent verwijderd:
- [list all files - SKILL.md + supporting files if any]
```

**AskUserQuestion Configuration:**

- header: "Verwijder Bevestiging"
- question: "Wil je '[name]' en alle bijbehorende bestanden permanent verwijderen?"
- options:
  1. label: "Verwijderen", description: "Deze skill permanent verwijderen"
  2. label: "Annuleren (Recommended)", description: "Skill behouden, terug naar edit menu"
  3. label: "Vraag uitleggen", description: "Leg uit wat dit betekent"
- multiSelect: false

**Response Handling:**

- Verwijderen → proceed with deletion
- Annuleren → return to Step 2 (edit type selection)
- Vraag uitleggen → clarify that deletion is permanent and cannot be undone

After deletion:

**If direct (no junctions):**

- Delete skill directory (SKILL.md + all supporting files)
- Confirm deletion complete

**If per-skill junctions:**

1. Remove junction first:
   ```bash
   powershell -File - <<'PS1'
   Remove-Item '.claude/skills/[name]' -Force
   PS1
   ```
2. Delete skill directory from shared library:
   ```bash
   rm -rf '{shared_library_path}/[name]'
   ```
3. Confirm both junction and directory deleted

### Add Resources to Skill

If user wants to add supporting files to a skill:

1. Explain this will create files in the skill directory
2. Get confirmation
3. Create requested files (scripts/, references .md, templates/) in `.claude/skills/[name]/`
4. Update SKILL.md to reference the supporting files

### Remove Resources from Skill

If user wants to remove all supporting files:

1. Explain this will delete the supporting files
2. Get confirmation
3. Delete supporting files from `.claude/skills/[name]/`
4. Update SKILL.md to remove file references

## Examples

### Example 1: Edit Skill Content

**User**: `/core-edit thinking-suggest`

```
LOADED: thinking-suggest (skill)

Generates 3 options using sequential thinking.

---
What do you want to change?
```

**User**: "Add option to generate 5 instead of 3"

```
SUMMARY:

I understand you want to:
- Add parameter for number of options (default 3, option for 5)

Correct? Yes

PREVIEW:

File: .claude/skills/thinking-suggest/SKILL.md

+ ## Options
+
+ - Default: 3 options
+ - Use "suggest 5" for 5 options

[Process section updated to use variable count]

---
Apply these changes? Yes

CHANGES APPLIED!

Modified:
- .claude/skills/thinking-suggest/SKILL.md
```

### Example 2: Rename Skill with Resources

**User**: `/core-edit dev-pdf-rotate`

```
LOADED: dev-pdf-rotate (skill + resources)

Rotates PDF files by 90, 180, or 270 degrees.

Supporting files:
- scripts/rotate_pdf.py

---
What do you want to change?
```

**User**: Selects "Rename"

```
What should the new name be?
```

**User**: "dev-rotate-pdf"

```
SUMMARY:

I understand you want to:
- Rename from 'dev-pdf-rotate' to 'dev-rotate-pdf'
- Update all references

Correct? Yes

PREVIEW:

Renames:
- .claude/skills/dev-pdf-rotate/ → .claude/skills/dev-rotate-pdf/

Updates paths in SKILL.md.

---
Apply these changes? Yes

CHANGES APPLIED!

Renamed: dev-pdf-rotate → dev-rotate-pdf

Modified:
- .claude/skills/dev-rotate-pdf/SKILL.md
- .claude/skills/dev-rotate-pdf/
```

### Example 3: Delete Skill

**User**: `/core-edit old-skill`

```
LOADED: old-skill (skill)

[description]

---
What do you want to change?
```

**User**: Selects "Delete"

```
VERWIJDER BEVESTIGING

Dit wordt permanent verwijderd:
- .claude/skills/old-skill/

Wil je 'old-skill' permanent verwijderen? [Confirm delete]

DELETED

Removed:
- .claude/skills/old-skill/
```
