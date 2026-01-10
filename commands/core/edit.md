---
description: Edit commands interactively
---

# Edit

## Overview

This command edits existing commands. It detects if resources exist, loads the content, facilitates modifications, and applies changes with verification.

**Trigger**: `/edit` or `/edit [name]`

## Type Detection

**Command only**: `.claude/commands/[name].md` exists, no matching resources folder
**Command with resources**: `.claude/commands/[name].md` exists AND `.claude/resources/[name]/` folder exists

## Workflow

### Step 1: Load Target

**If name provided** (`/edit commit`):
1. Check if `.claude/commands/[name].md` exists → load command
2. Check if `.claude/resources/[name]/` also exists → note has resources
3. If command doesn't exist → show error with available options

**If no name** (`/edit`):
1. Discover all commands using bash find with symlink support:
   ```bash
   find -L .claude/commands -name "*.md" -type f 2>/dev/null | sed 's|^\.claude/commands/||' | sed 's|\.md$||' | sort
   ```
   Note: The `-L` flag makes find follow symbolic links/junctions. `Glob` does not follow Windows junctions/symlinks correctly.

2. Display numbered table with command names only (DO NOT read files for descriptions):
   ```
   | #  | Command              |
   |----|----------------------|
   | 1  | core/edit            |
   | 2  | core/create          |
   | 3  | dev/1-plan           |
   | ...| ...                  |
   ```

3. Ask user to type a number (plain text, no modal):
   "Typ het nummer van het command dat je wilt bewerken:"

4. Load selected command based on number input

**After loading, show preview**:
```
📋 LOADED: [name] ([command / command + resources])

[Brief summary of what it does]

[If has resources: list bundled resources]
```

Proceed immediately to Step 2.

### Step 2: Understand Edit Request

Ask targeted questions using **AskUserQuestion** tool:

**AskUserQuestion Configuration:**
- header: "Edit Type"
- question: "Wat wil je aanpassen?"
- options:
  1. label: "Content (Recommended)", description: "Workflow, instructies, output format"
  2. label: "Rename", description: "Command naam wijzigen"
  3. label: "Resources", description: "Scripts, references, assets"
  4. label: "Delete", description: "Command verwijderen"
  5. label: "Vraag uitleggen", description: "Leg uit wat deze opties betekenen"
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
  2. label: "References", description: "Documentatie of referentiebestanden"
  3. label: "Assets", description: "Statische bestanden (images, templates, data)"
  4. label: "Vraag uitleggen", description: "Leg uit wat deze opties betekenen"
- multiSelect: false

**AskUserQuestion Configuration (Action):**
- header: "Actie"
- question: "Wat wil je doen?"
- options:
  1. label: "Toevoegen (Recommended)", description: "Nieuw resourcebestand toevoegen"
  2. label: "Verwijderen", description: "Bestaand resourcebestand verwijderen"
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
  1. label: "Workflow (Recommended)", description: "De stappen en logica van het command"
  2. label: "Instructies", description: "Tekst en uitleg in het command"
  3. label: "Output format", description: "Hoe de output eruitziet"
  4. label: "Vraag uitleggen", description: "Leg uit wat deze opties betekenen"
- multiSelect: true

**Modal 2b: Rename Details** (if Rename selected)
Use **AskUserQuestion**:
- header: "Nieuwe Naam"
- question: "Wat moet de nieuwe naam zijn?"
- options: [suggest 2-3 name variations based on current name]
  - Example: label: "command-v2", description: "Versie suffix toevoegen"
  - Last option: label: "Vraag uitleggen", description: "Leg uit wat deze opties betekenen"
- multiSelect: false
- Note: User can type custom name

**Modal 2c: Resource Details** (if Resources selected)
Use the Resource Type and Action modals defined above.

**Modal 3: Combined Preview**
After gathering all specifics, show combined preview:

```
📋 GECOMBINEERDE WIJZIGINGEN:

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
📋 SUMMARY:

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

**IMPORTANT: All command files must be written in English.**
- Command content, instructions, examples: English
- AskUserQuestion labels/descriptions: Follow user's language preference from CLAUDE.md
- This ensures commands are reusable across projects

Generate and show the changes:

```
📝 PREVIEW:

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
  - label: "Vraag uitleggen"
    description: "Leg uit wat deze opties betekenen"
- multiSelect: false

Response handling:
- If "Content onjuist": vraag wat specifiek fout is
- If "Onderdelen missen": vraag wat er mist
- If "Onderdelen verwijderen": vraag wat verwijderd moet worden
- If "Opnieuw beginnen": ga terug naar Step 2

Iterate until approved (max 3 rounds).

### Step 4: Apply Changes

**For command only**:
1. Edit `.claude/commands/[name].md`
2. If renamed: delete old file, create new

**For command with resources**:
1. Edit `.claude/commands/[name].md`
2. Update/create/delete resources as needed in `.claude/resources/[name]/`
3. If renamed:
   - Rename command file
   - Rename resources folder
   - Update paths in command file

**Output**:
```
✅ CHANGES APPLIED!

Modified:
- [list of changed files]

[If renamed: old name → new name]
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

After sequential thinking analysis, search for orphaned references to the old/deleted command name:

**Search patterns** (replace `old-name` with actual command name):
```bash
# Primary search - catches most references
Grep pattern="old-name" path=".claude/"

# Additional patterns to verify:
# - /old-name (slash command invocations)
# - old-name.md (file references)
# - /resources/old-name/ (resource folder paths)
```

The search covers `.claude/` recursively, including:
- commands, agents, resources, skills
- CLAUDE.md and settings files
- Any other configuration files

#### 5.3 Report and Resolve

If issues found:

- List each issue with file location
- Auto-fix (no approval): formatting, whitespace, path separators
- Ask user (needs approval): content changes, deletions, structural changes

**Final output**:
```
✅ VERIFICATION COMPLETE

Sequential thinking analysis: [summary]
Orphaned references found: [count]
Issues resolved: [count]

[name] updated successfully!
```

Send notification:
```bash
powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "Edit complete: [name]"
```

## Special Cases

### Rename

When renaming, update ALL of:
1. Command file name
2. Resources folder name (if exists)
3. Paths inside command file (if references resources)
4. Any internal references

Show all changes in preview.

### Delete

When deleting, use **AskUserQuestion** for confirmation:

```
⚠️ VERWIJDER BEVESTIGING

Dit wordt permanent verwijderd:
- [list all files - command + resources if any]
```

**AskUserQuestion Configuration:**
- header: "Verwijder Bevestiging"
- question: "Wil je '[name]' en alle bijbehorende resources permanent verwijderen?"
- options:
  1. label: "Verwijderen", description: "Dit command permanent verwijderen"
  2. label: "Annuleren (Recommended)", description: "Command behouden, terug naar edit menu"
  3. label: "Vraag uitleggen", description: "Leg uit wat dit betekent"
- multiSelect: false

**Response Handling:**
- Verwijderen → proceed with deletion
- Annuleren → return to Step 2 (edit type selection)
- Vraag uitleggen → clarify that deletion is permanent and cannot be undone

After deletion:
- Delete command file
- Delete resources folder if exists
- Confirm deletion complete

### Add Resources to Command

If user wants to add resources to a command:
1. Explain this will create a resources folder
2. Get confirmation
3. Create `.claude/resources/[name]/` folder
4. Create requested resources (scripts/, references/, assets/)
5. Update command file to reference the resources

### Remove Resources from Command

If user wants to remove all resources:
1. Explain this will delete the resources folder
2. Get confirmation
3. Delete `.claude/resources/[name]/` folder
4. Update command file to remove resource references

## Examples

### Example 1: Edit Command Content

**User**: `/edit suggest`

```
📋 LOADED: suggest (command)

Generates 3 options using sequential thinking.

---
What do you want to change?
```

**User**: "Add option to generate 5 instead of 3"

```
📋 SUMMARY:

I understand you want to:
- Add parameter for number of options (default 3, option for 5)

Correct? Yes

📝 PREVIEW:

File: .claude/commands/suggest.md

+ ## Options
+
+ - Default: 3 options
+ - Use "suggest 5" for 5 options

[Process section updated to use variable count]

---
Apply these changes? Yes

✅ CHANGES APPLIED!

Modified:
- .claude/commands/suggest.md
```

### Example 2: Rename Command with Resources

**User**: `/edit pdf-rotate`

```
📋 LOADED: pdf-rotate (command + resources)

Rotates PDF files by 90, 180, or 270 degrees.

Resources:
- scripts/rotate_pdf.py

---
What do you want to change?
```

**User**: Selects "Rename"

```
What should the new name be?
```

**User**: "rotate-pdf"

```
📋 SUMMARY:

I understand you want to:
- Rename from 'pdf-rotate' to 'rotate-pdf'
- Update all references

Correct? Yes

📝 PREVIEW:

Renames:
- .claude/commands/pdf-rotate.md → .claude/commands/rotate-pdf.md
- .claude/resources/pdf-rotate/ → .claude/resources/rotate-pdf/

Updates paths in command file.

---
Apply these changes? Yes

✅ CHANGES APPLIED!

Renamed: pdf-rotate → rotate-pdf

Modified:
- .claude/commands/rotate-pdf.md
- .claude/resources/rotate-pdf/
```

### Example 3: Delete Command

**User**: `/edit old-command`

```
📋 LOADED: old-command (command)

[description]

---
What do you want to change?
```

**User**: Selects "Delete"

```
⚠️ VERWIJDER BEVESTIGING

Dit wordt permanent verwijderd:
- .claude/commands/old-command.md

Wil je 'old-command' permanent verwijderen? [Confirm delete]

✅ DELETED

Removed:
- .claude/commands/old-command.md
```
