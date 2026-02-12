---
description: Safely delete skills with deep reference scanning and dependency updates
disable-model-invocation: true
---

# Delete

Remove a skill safely by scanning all references, showing impact, updating dependents, and cleaning up.

**Trigger**: `/core-delete` or `/core-delete [name]`

## FASE 0: Skill Selection

**If name provided** (`/core-delete thinking-plan`):

1. Verify `.claude/skills/[name]/SKILL.md` exists
2. If not found → show error: "Skill `[name]` niet gevonden." and list available skills

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
Profile: [which profile in profiles.yaml]
```

## FASE 1: Deep Reference Scan

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

**2b. Profiles registry**:

```
Grep pattern="example-skill" path=".claude/skills/core-profile/profiles.yaml"
```

**2c. Hooks**:

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
| `PROFILE`       | Registration                             | Remove entry from profiles.yaml      |
| `INVOCATION`    | Another skill invokes this one (`/name`) | Update or remove the reference       |
| `SUGGESTION`    | Another skill suggests this one          | Update or remove the suggestion      |
| `DOCUMENTATION` | Mentioned in docs/comments               | Update or remove the mention         |
| `DEPENDENCY`    | Another skill depends on output          | **Critical** — needs workflow update |
| `HOOK`          | Referenced in hook configuration         | Update or remove hook reference      |
| `CONFIG`        | Referenced in CLAUDE.md or config        | Update or remove config reference    |

Use sequential thinking to analyze each reference and classify it correctly. Pay attention to the context — is it a hard dependency (workflow breaks without it) or a soft reference (mention in a list)?

## FASE 2: Impact Report

### Step 1: Display Report

```
IMPACT REPORT: [skill-name]

Profile: [profile-name] — will be removed from profiles.yaml

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
- question: "[If CRITICAL refs]: Er zijn **{N} kritieke** afhankelijkheden. Wil je doorgaan? [If no CRITICAL]: Geen kritieke afhankelijkheden gevonden. Doorgaan met verwijderen?"
- options:
  - label: "Verwijder + update refs (Recommended)", description: "Verwijder skill en update alle referenties in andere bestanden"
  - label: "Alleen verwijderen", description: "Verwijder skill zonder referenties aan te passen (kan dingen breken)"
  - label: "Annuleren", description: "Niets wijzigen"
- multiSelect: false

**Response handling:**

- "Verwijder + update refs" → proceed to FASE 3 (full cleanup)
- "Alleen verwijderen" → skip to FASE 3 Step 3 (delete only, skip ref updates)
- "Annuleren" → stop, no changes

## FASE 3: Execute Deletion

### Step 1: Update References (if selected)

For each reference found in FASE 1, apply the appropriate fix:

**PROFILE references:**

- Remove the skill name line from profiles.yaml
- Maintain list formatting (no empty lines)

**INVOCATION references** (another skill uses `/skill-name`):

- Show the context (surrounding lines) from the referring skill
- Use AskUserQuestion per critical reference:
  - header: "Referentie"
  - question: "Hoe wil je deze referentie in `[file]` aanpassen?"
  - options:
    - label: "Verwijder referentie (Recommended)", description: "Verwijder de regel/sectie die naar de skill verwijst"
    - label: "Vervang door alternatief", description: "Vervang door een andere skill of instructie"
    - label: "Overslaan", description: "Laat deze referentie staan"
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

### Step 2: Validate profiles.yaml

After updating profiles.yaml, validate:

```bash
python3 .claude/skills/core-profile/switch-profile.py --validate
```

### Step 3: Delete Skill Files

**Step 3a — Detect junction structure:**

```bash
powershell -Command "(Get-ChildItem '.claude/skills' -Directory | Select-Object -First 1).LinkType" 2>/dev/null || echo "no-powershell"
```

- Output `Junction` → per-skill junctions active
- Otherwise → no junctions (direct files or Linux)

**Step 3b — Remove skill:**

**If per-skill junctions:**

1. Get shared library path:
   ```bash
   powershell -Command "Split-Path (Get-ChildItem '.claude/skills' -Directory | Select-Object -First 1).Target"
   ```
2. Remove junction:
   ```bash
   cmd /c "rmdir .claude\skills\[name]"
   ```
3. Remove from shared library:
   ```bash
   rm -rf "{shared_library}/[name]"
   ```

**If no junctions (Linux/direct):**

```bash
rm -rf ".claude/skills/[name]"
```

### Step 4: Verify Deletion

```bash
test ! -d ".claude/skills/[name]" && echo "DELETED" || echo "STILL EXISTS"
```

## FASE 4: Verification & Report

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
  ✓ Removed from profiles.yaml ([profile-name])
  [✓ Updated [N] references in other files]
  [✓ Junction removed]

Remaining references: [0 / N still present]
[If remaining: list files that still reference the skill — user chose to skip these]
```

## Safety Rules

- **NEVER** delete `core-profile` — it manages all other skills
- **NEVER** delete `core-create` or `core-edit` — essential management skills
- **NEVER** delete `core-delete` itself
- **ALWAYS** ask confirmation before any destructive action
- **ALWAYS** show impact report before deletion
- If a skill has CRITICAL dependencies, warn prominently before proceeding
- Junction removal uses `rmdir` (safe) — never `rm -rf` on junction pointers
