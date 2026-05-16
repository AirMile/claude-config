---
name: core-delete
description: Safely delete a skill and clean up references. Use with /core-delete.
metadata:
  author: claude-config
  version: 1.0.0
  category: core
---

# Delete

Remove a skill safely by scanning all references, showing impact, updating dependents, and cleaning up.

**Trigger**: `/core-delete` or `/core-delete [name]`

## PHASE 0: Skill Selection

**If name provided** (`/core-delete project-brainstorm`):

1. Verify `.claude/skills/[name]/SKILL.md` exists
2. If not found → show error: "Skill `[name]` not found." and list available skills

**If no name** (`/core-delete`):

1. Discover all skills:

   ```bash
   find -L .claude/skills -name "SKILL.md" -type f 2>/dev/null | sed 's|^\.claude/skills/||' | sed 's|/SKILL\.md$||' | sort
   ```

2. Display numbered table with skill names
3. Ask user to type a number (plain text, no modal)

**After selection, show skill summary**:

```
TARGET: [name]
Description: [from frontmatter]
Has resources: [YES/NO — list files if yes]
```

## PHASE 1: Deep Reference Scan

Scan the entire `.claude/` directory for references to the target skill. Search for multiple patterns to catch all reference styles.

### Step 1: Define Search Patterns

For a skill named `example-skill`, search these patterns:

| Pattern                | Catches                   |
| ---------------------- | ------------------------- |
| `example-skill`        | Direct name references    |
| `/example-skill`       | Slash-command invocations |
| `skills/example-skill` | Path references           |

### Step 2: Scan All Locations

Search each location category using Grep. Exclude the skill's own directory from results.

**2a. Other skills (SKILL.md files)**:

```
Grep pattern="example-skill" path=".claude/skills" glob="**/SKILL.md"
```

Filter out matches from the skill's own SKILL.md.

**2b. Hooks**:

```
Grep pattern="example-skill" path=".claude/hooks"
```

**2d. Shared resources**:

```
Grep pattern="example-skill" path=".claude/skills/shared"
```

**2e. Project configuration**:

```
Grep pattern="example-skill" path=".claude" glob="CLAUDE*.md"
```

**2f. Scripts**:

```
Grep pattern="example-skill" path=".claude" glob="**/*.{py,sh,cjs,js}"
```

### Step 3: Classify References

For each match, classify it:

| Category        | Impact                                   | Action Needed                        |
| --------------- | ---------------------------------------- | ------------------------------------ |
| `INVOCATION`    | Another skill invokes this one (`/name`) | Update or remove the reference       |
| `SUGGESTION`    | Another skill suggests this one          | Update or remove the suggestion      |
| `DOCUMENTATION` | Mentioned in docs/comments               | Update or remove the mention         |
| `DEPENDENCY`    | Another skill depends on output          | **Critical** — needs workflow update |
| `HOOK`          | Referenced in hook configuration         | Update or remove hook reference      |
| `CONFIG`        | Referenced in CLAUDE.md or config        | Update or remove config reference    |

Analyze each reference and classify it correctly. Pay attention to the context — is it a hard dependency (workflow breaks without it) or a soft reference (mention in a list)?

## PHASE 2: Impact Report

### Step 1: Display Report

```
IMPACT REPORT: [skill-name]

References found: [N total]

CRITICAL (workflow breaks):
  - [file:line] — [description of dependency]
  - [file:line] — [description of dependency]

WARNING (needs update):
  - [file:line] — [description: invocation/suggestion to remove]
  - [file:line] — [description: documentation to update]

INFO (cosmetic):
  - [file:line] — [description: mention in comment/docs]

No references: ✓ Safe to delete without side effects
```

### Step 2: User Decision

Use **AskUserQuestion**:

- header: "Verwijderen"
- question: "[If CRITICAL refs]: There are **{N} critical** dependencies. Continue? [If no CRITICAL]: No critical dependencies found. Continue with deletion?"
- options:
  - label: "Delete + update refs (Recommended)", description: "Delete skill and update all references in other files"
  - label: "Delete only", description: "Delete skill without updating references (may break things)"
  - label: "Cancel", description: "No changes"
- multiSelect: false

**Response handling:**

- "Delete + update refs" → proceed to PHASE 3 (full cleanup)
- "Delete only" → skip to PHASE 3 Step 3 (delete only, skip ref updates)
- "Cancel" → stop, no changes

## PHASE 3: Execute Deletion

### Step 1: Update References (if selected)

For each reference found in PHASE 1, apply the appropriate fix:

**INVOCATION references** (another skill uses `/skill-name`):

- Show the context (surrounding lines) from the referring skill
- Use AskUserQuestion per critical reference:
  - header: "Reference"
  - question: "How do you want to handle this reference in `[file]`?"
  - options:
    - label: "Remove reference (Recommended)", description: "Remove the line/section that references the skill"
    - label: "Replace with alternative", description: "Replace with another skill or instruction"
    - label: "Skip", description: "Leave this reference as-is"
  - multiSelect: false
- Apply the chosen fix using Edit tool

**SUGGESTION references** (another skill suggests this one):

- Remove the suggestion line/option that mentions the deleted skill
- Adjust surrounding structure if needed (e.g., option lists)

**DOCUMENTATION references:**

- Remove or update mentions in documentation files
- Auto-fix without asking (cosmetic changes)

**HOOK references:**

- Show the hook code context
- Ask user how to handle (remove reference / update / skip)

**CONFIG references:**

- Show the config context
- Ask user how to handle

### Step 3: Delete Skill Files

**Step 3a — Detect link structure:**

Detect if skills directory uses symlinks (macOS) or junctions (Windows):

**macOS:**

```bash
test -L ".claude/skills/$(ls .claude/skills | head -1)" && echo "linked" || echo "direct"
```

**Windows:**

```bash
powershell -Command "(Get-ChildItem '.claude/skills' -Directory | Select-Object -First 1).LinkType"
```

- Output `Junction` → linked
- Empty → direct files

**Step 3b — Remove skill:**

**If linked (symlinks/junctions):**

1. Get shared library path:
   - macOS: `readlink -f .claude/skills/[any-skill] | xargs dirname`
   - Windows: `powershell -Command "Split-Path (Get-Item '.claude/skills/[any-skill]').Target"`
2. Remove link:
   - macOS: `unlink .claude/skills/[name]`
   - Windows: `cmd //c "rmdir .claude\skills\[name]"`
3. Remove from shared library:
   ```bash
   rm -rf "{shared_library}/[name]"
   ```

**If direct (no links):**

```bash
rm -rf ".claude/skills/[name]"
```

### Step 4: Verify Deletion

```bash
test ! -d ".claude/skills/[name]" && echo "DELETED" || echo "STILL EXISTS"
```

## PHASE 4: Verification & Report

### Step 1: Post-Deletion Scan

Run a final grep to confirm no stale references remain:

```
Grep pattern="[skill-name]" path=".claude"
```

### Step 2: Final Report

```
DELETED: [skill-name]

Actions taken:
  ✓ Skill files removed ([N] files)
  [✓ Updated [N] references in other files]
  [✓ Junction removed]

Remaining references: [0 / N still present]
[If remaining: list files that still reference the skill — user chose to skip these]
```

## Safety Rules

- **NEVER** delete `core-create` or `core-edit` — essential management skills
- **NEVER** delete `core-delete` itself
- **ALWAYS** ask confirmation before any destructive action
- **ALWAYS** show impact report before deletion
- If a skill has CRITICAL dependencies, warn prominently before proceeding
- Junction removal uses `rmdir` (safe) — never `rm -rf` on junction pointers
