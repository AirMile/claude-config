---
description: Create skills interactively
disable-model-invocation: true
---

# Create

## Overview

This skill creates new skills through a streamlined process. It determines if bundled resources are needed, then guides through creation with concrete examples.

**Trigger**: `/core-create` or `/core-create [name]`

## Type Detection

**Skill file only** (default):
- No bundled resources needed
- Everything from simple one-liners to complex multi-step workflows
- Can use agents, tools, sequential thinking - anything
- Result: `.claude/skills/[name]/SKILL.md`

**Skill with resources** (only when bundled files needed):
- Needs supporting files (scripts, references, templates, examples)
- Result: `.claude/skills/[name]/SKILL.md` + supporting files in `.claude/skills/[name]/`

## Skill Structure Reference

### Frontmatter Options

All fields are optional. Only `description` is recommended.

```yaml
---
name: my-skill                    # Display name (default: directory name)
description: What this skill does  # Recommended - Claude uses this to decide when to apply
argument-hint: [issue-number]      # Hint shown during autocomplete
disable-model-invocation: true     # Only user can invoke (default: false)
user-invocable: false              # Only Claude can invoke (default: true)
allowed-tools: Read, Grep, Glob   # Restrict tools when skill is active
context: fork                      # Run in isolated subagent context
agent: Explore                     # Which agent to use with context: fork
---
```

### String Substitutions

Available in skill content:
- `$ARGUMENTS` - All arguments passed when invoking
- `$ARGUMENTS[N]` or `$N` - Specific argument by index (0-based)
- `${CLAUDE_SESSION_ID}` - Current session ID

### Dynamic Context Injection

Use `` !`command` `` to run shell commands before content is sent to Claude:
```markdown
Current branch: !`git branch --show-current`
```

### Supporting Files

Skills can include multiple files alongside SKILL.md:
```
my-skill/
├── SKILL.md           # Main instructions (required)
├── template.md        # Template for Claude to fill in
├── examples/
│   └── sample.md      # Example output
└── scripts/
    └── validate.sh    # Script Claude can execute
```

Reference supporting files from SKILL.md so Claude knows when to load them.

## Workflow

### Step 1: Gather Requirements

**If name provided** (`/core-create commit`):
1. Acknowledge the name
2. Ask: "Describe what `/[name]` should do. Give a concrete example."

**If no name** (`/core-create`):
1. Ask: "What should the skill do? Give a concrete example and suggest a name."

**Follow-up questions** (ask 2-3 at a time):
- "What should trigger this? Give example phrases."
- "What's the expected output or behavior?"
- "Are there variations or options needed?"

**Output after gathering**:
```
UNDERSTOOD:

Name: /[name]
Purpose: [one sentence]
Example: "[example user input]" → [expected behavior]

```

Use **AskUserQuestion** tool:
- header: "Confirm"
- question: "Klopt deze samenvatting?"
- options:
  - label: "Ja, ga door (Recommended)", description: "Samenvatting is correct, ga verder"
  - label: "Nee, aanpassen", description: "Ik wil iets wijzigen"
  - label: "Uitleg", description: "Leg uit wat er gaat gebeuren"
- multiSelect: false

**Response handling:**
- "Ja, ga door" → proceed to Step 2
- "Nee, aanpassen" → ask what needs to change
- "Uitleg" → explain the next steps, then re-ask

### Step 2: Determine Type

Analyze the requirements:

**Check for resource needs**:
- Does it need executable scripts that should be reused exactly? → scripts/
- Does it need documentation/schemas to reference? → separate .md files
- Does it need template files or assets for output? → templates, assets

**Decision**:
```
TYPE DETECTION:

Supporting files needed: [YES/NO]
[If YES: list which files and why]

Result: [Skill only / Skill + resources]

```

Use **AskUserQuestion** tool:
- header: "Type"
- question: "Akkoord met het gedetecteerde type?"
- options:
  - label: "Ja, doorgaan (Recommended)", description: "Type is correct, begin met schrijven"
  - label: "Nee, aanpassen", description: "Type of resources moet anders"
  - label: "Uitleg", description: "Leg het verschil uit tussen skill en skill+resources"
- multiSelect: false

**Response handling:**
- "Ja, doorgaan" → if resources needed, proceed to Step 2.5; otherwise proceed to Step 3
- "Nee, aanpassen" → ask what should change about the type/resources
- "Uitleg" → explain skill vs skill+resources, then re-ask

### Step 2.5: Select Resource Types (Conditional)

**Skip this step if:** Skill file only (no supporting files needed).

**Apply when:** Skill needs supporting files.

Use **AskUserQuestion** tool:
- header: "Resources"
- question: "Welke resource types zijn nodig?"
- options:
  - label: "Scripts", description: "Uitvoerbare scripts (Python, Bash, PowerShell)"
  - label: "References", description: "Documentatie, schema's, referentiebestanden (.md)"
  - label: "Templates/Assets", description: "Templates, afbeeldingen, fonts, voorbeeldbestanden"
  - label: "Uitleg", description: "Leg elk resource type uit"
- multiSelect: true

**Response handling:**
- Selected types → create corresponding structure in `.claude/skills/[name]/`
- "Uitleg" → explain each resource type:
  - **Scripts**: Executable files the skill can invoke (e.g., Python scripts, shell scripts)
  - **References**: Documentation loaded into context (e.g., API specs, style guides, patterns)
  - **Templates/Assets**: Static files for output (e.g., templates, images, fonts)

**Output after selection**:
```
RESOURCE STRUCTURE:

.claude/skills/[name]/
├── SKILL.md
├── scripts/    [if selected]
├── [ref].md    [if selected - as separate files alongside SKILL.md]
└── templates/  [if selected]
```

Proceed to Step 3.

### Step 3: Write Content

**IMPORTANT: All skill files must be written in English.**
- Skill content, instructions, examples: English
- AskUserQuestion labels/descriptions: Follow user's language preference from CLAUDE.md
- This ensures skills are reusable across projects

**For Skill file only**:

Draft the skill file content:

```markdown
---
description: [clear description for skill list]
---

# [Name]

[Instructions in imperative form]

## When to Use
[Trigger scenarios]

## Process
[Step-by-step workflow]

## Examples
[Concrete examples if helpful]
```

**For Skill with resources**:

Draft skill file + list supporting files to create:

```markdown
---
description: [clear description for skill list]
---

# [Name]

[Instructions in imperative form]

## When to Use
[Trigger scenarios]

## Process
[Step-by-step workflow referencing supporting files]

## Additional Resources
- For [purpose], see [filename.md](filename.md)
- For [purpose], run `python .claude/skills/[name]/scripts/[file]`

## Examples
[Concrete examples if helpful]
```

**Show draft**:
```
DRAFT:

[content]
```

Use **AskUserQuestion** tool:
- header: "Draft"
- question: "Wijzigingen nodig?"
- options:
  - label: "Goedkeuren (Recommended)", description: "Draft is goed, ga verder naar patterns"
  - label: "Aanpassen", description: "Ik wil specifieke onderdelen wijzigen"
  - label: "Opnieuw genereren", description: "Begin opnieuw met andere aanpak"
  - label: "Uitleg", description: "Leg de structuur van de draft uit"
- multiSelect: false

**Response handling:**
- "Goedkeuren" → proceed to Step 3.5
- "Aanpassen" → ask what needs to change, update draft
- "Opnieuw genereren" → ask for new direction, regenerate from scratch
- "Uitleg" → explain the draft structure, then re-ask

Iterate until approved (max 3 rounds).

### Step 3.5: Configure Frontmatter (Conditional)

**Always ask** — determine which frontmatter options to enable beyond `description`.

Use **AskUserQuestion** tool:
- header: "Frontmatter"
- question: "Welke skill-opties wil je configureren?"
- options:
  - label: "Geen extra opties (Recommended)", description: "Alleen description, Claude kan de skill automatisch laden"
  - label: "Handmatig invoken", description: "disable-model-invocation: true — alleen via /naam"
  - label: "Subagent uitvoering", description: "context: fork — draait in geïsoleerde context"
  - label: "Uitleg", description: "Leg alle frontmatter opties uit"
- multiSelect: true

**Response handling:**
- "Geen extra opties" → keep only `description` in frontmatter
- "Handmatig invoken" → add `disable-model-invocation: true`
- "Subagent uitvoering" → add `context: fork`, ask which agent type (Explore, Plan, general-purpose)
- "Uitleg" → explain all frontmatter options:
  - `disable-model-invocation: true` — Claude can't trigger this automatically, user must type /name
  - `user-invocable: false` — Hidden from / menu, only Claude can load it
  - `allowed-tools` — Restrict which tools Claude can use
  - `context: fork` — Runs in isolated subagent, no access to conversation history
  - `agent` — Which agent type for subagent execution
  - `argument-hint` — Autocomplete hint for arguments

Then ask if `$ARGUMENTS` substitution is needed:
- If skill accepts arguments → add `$ARGUMENTS` or `$0`, `$1` etc. to content

### Step 3.6: Design Patterns (Conditional)

**Skip this step if:** Simple skill without workflow phases.

**Apply when:** Skill has workflow with multiple phases or long-running operations.

**Process:**

1. **Analyze workflow for applicable patterns:**
   - Does it have long-running phases (agents, research, generation >30s)? → Notifications
   - Does it have analysis/evaluation/planning phases? → Parallel Agents
   - Does it need user decisions or choices? → AskUserQuestion
   - Does it have multi-step configuration or input gathering? → Sequential Modals

2. **Let user select patterns:**

   Use **AskUserQuestion** tool:
   - header: "Design Patterns"
   - question: "Welke patterns wil je toepassen?"
   - options:
     - label: "Notifications", description: "Status updates en feedback aan user"
     - label: "Parallel Agents", description: "Multi-agent orchestratie met 3 perspectieven"
     - label: "AskUserQuestion", description: "Interactieve user input met keuzes"
     - label: "Geen patterns", description: "Simpele skill zonder patterns"
     - label: "Uitleg", description: "Leg elk pattern uit"
   - multiSelect: true

   **Response handling:**
   - Selected patterns → configure each selected pattern (see below)
   - "Geen patterns" → skip to Step 4
   - "Uitleg" → explain each pattern briefly, then re-ask

3. **Configure selected patterns:**

   **For Notifications:**

   **Rule:** Notify when Claude waits for user input AFTER a long-running phase.

   - Notify BEFORE user prompts that follow long phases (agents, research, generation)
   - Notify at workflow completion
   - DON'T notify during interactive Q&A or after short operations

   Messages: Short (3-5 words), action-oriented. Examples: "Ready for input", "Options ready", "[name] complete"

   ```
   NOTIFICATION TIMING:

   Suggested notifications for your workflow:
   - After [long phase X]: "[suggested message]"
   - After [long phase Y]: "[suggested message]"
   - At completion: "[name] complete"
   ```

   **For Parallel Agents:**

   **Rule:** Use 3 parallel agents with different perspectives for better decisions.

   - Each agent analyzes from a unique angle (e.g., speed/quality/balanced, or optimist/skeptic/pragmatist)
   - Synthesize results with weighted scoring if needed
   - Benefits: ~40-70% context token reduction, multi-perspective synthesis

   ```
   AGENT CONFIGURATION:

   [Phase name] with 3-angle approach:

   | Agent | Perspective | Focus |
   |-------|-------------|-------|
   | [name]-option1 | "[angle 1]" | [focus] |
   | [name]-option2 | "[angle 2]" | [focus] |
   | [name]-option3 | "[angle 3]" | [focus] |
   ```

   **For AskUserQuestion:**

   **Rule:** Use AskUserQuestion for structured choices instead of open-ended questions.

   - When workflow needs user decisions (yes/no, select option, choose approach)
   - When gathering preferences with predefined options
   - When confirming before destructive or irreversible actions
   - Benefits: Clearer UX, faster responses, prevents misunderstandings

   ```
   ASKUSERQUESTION POINTS:

   Suggested decision points:

   | Decision Point | Question Type | Options |
   |----------------|---------------|---------|
   | [point 1] | [single/multi] | [options] |
   | [point 2] | [single/multi] | [options] |
   ```

4. **Update draft with selected patterns** before proceeding to Step 4.

### Step 4: Create Files

#### Step 4.0: Determine Skill Name with Category Prefix

Skills use a flat naming convention with category prefixes: `[category]-[name]`.

1. **Detect existing categories:**
   ```bash
   find -L .claude/skills -name "SKILL.md" -type f 2>/dev/null | sed 's|^\.claude/skills/||' | sed 's|/SKILL\.md$||' | sed 's|-.*||' | sort -u
   ```
   This extracts unique prefixes like: `core`, `dev`, `frontend`, `thinking`, etc.

2. **Present category options:**

   Use **AskUserQuestion** tool:
   - header: "Category"
   - question: "Welk category prefix moet de skill krijgen?"
   - options:
     - label: "[best-match]- (Recommended)", description: "Past bij: [reason]"
     - label: "[second-match]-", description: "Alternatief: [reason]"
     - label: "[third-match]-", description: "Ook mogelijk: [reason]"
     - label: "Nieuw prefix", description: "Maak een nieuwe categorie aan"
   - multiSelect: false

   **Note:** First 3 options are dynamically selected from existing prefixes based on best fit analysis.

   **Response handling:**
   - Existing prefix selected → use that prefix
   - "Nieuw prefix" → ask for prefix name

3. **Set target path:**
   ```
   TARGET: .claude/skills/[prefix]-[name]/SKILL.md
   ```

   Final skill name: `[prefix]-[name]`, invoked as `/[prefix]-[name]`

#### Step 4.1: Write Files

**For Skill file only**:
1. Write `.claude/skills/[prefix]-[name]/SKILL.md`
2. Confirm creation

**For Skill with resources**:
1. Write `.claude/skills/[prefix]-[name]/SKILL.md` with full instructions
2. Create supporting files in `.claude/skills/[prefix]-[name]/`
3. Create and populate scripts/, references, templates as needed

**Output**:
```
CREATED!

[For skill file only:]
- .claude/skills/[prefix]-[name]/SKILL.md

[For skill with resources:]
- .claude/skills/[prefix]-[name]/SKILL.md
- .claude/skills/[prefix]-[name]/scripts/[files]
- .claude/skills/[prefix]-[name]/[reference].md

Test with: /[prefix]-[name]
```

### Step 5: Verification

Use sequential thinking to verify:

**Checklist**:
- [ ] File(s) created in correct location
- [ ] Frontmatter valid (description required)
- [ ] Instructions clear and in imperative form
- [ ] All referenced supporting files exist (if resources created)
- [ ] Skill name follows `[prefix]-[name]` convention

**Auto-fix** (no approval needed):
- Formatting issues
- Whitespace/indentation
- Path separators

**Ask user** (needs approval):
- Content changes
- Missing files
- Structure changes

**Final output**:
```
VERIFICATION COMPLETE

[name] is ready to use!
```

Send notification:
```bash
powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "Skill created: [name]"
```

## Examples

### Example 1: Simple Skill

**User**: `/core-create suggest`
**Claude**: "Describe what `/suggest` should do."
**User**: "Generate 3 options using sequential thinking"

```
UNDERSTOOD:

Name: /suggest
Purpose: Generate 3 alternative options using sequential thinking
Example: "suggest how to refactor this function" → 3 analyzed options

Correct? Yes

TYPE DETECTION:

Supporting files needed: NO
Result: Skill file

DRAFT:

---
description: Generate 3 options using sequential thinking
---

# Suggest

Generate 3 alternative approaches for the given problem using sequential thinking analysis.

## Process

1. Analyze the problem or request
2. Use sequential thinking to explore options
3. Present exactly 3 alternatives with pros/cons
4. Ask which option to pursue

## Output Format

**Option 1: [Name]**
- Approach: [description]
- Pros: [benefits]
- Cons: [drawbacks]

[Repeat for options 2 and 3]

Which option do you prefer?

[AskUserQuestion: "Is de draft goed?" → "Ja"]

[AskUserQuestion Frontmatter: "Geen extra opties"]

CATEGORY SELECTION:

Existing prefixes: core, dev, frontend, thinking

[AskUserQuestion: "Welk category prefix?"
→ "thinking- (Recommended)" - Past bij: analysis and ideation skills]

TARGET: .claude/skills/thinking-suggest/SKILL.md

CREATED!

- .claude/skills/thinking-suggest/SKILL.md

Test with: /thinking-suggest
```

### Example 2: Skill with Resources

**User**: `/core-create pdf-rotate`
**Claude**: "Describe what `/pdf-rotate` should do."
**User**: "Rotate PDF files by 90, 180, or 270 degrees"

```
UNDERSTOOD:

Name: /pdf-rotate
Purpose: Rotate PDF files by specified degrees
Example: "rotate invoice.pdf 90 degrees" → rotated PDF

Correct? Yes

TYPE DETECTION:

Supporting files needed: YES
- scripts/rotate_pdf.py - Python script for reliable PDF rotation

Result: Skill + resources

DRAFT:

---
description: Rotate PDF files by 90, 180, or 270 degrees
---

# PDF Rotate

Rotates PDF files by specified degrees using a bundled Python script.

## When to Use
When user wants to rotate a PDF file.

## Process

1. Receive PDF file and rotation angle from user
2. Validate angle is 90, 180, or 270
3. Execute: `python .claude/skills/dev-pdf-rotate/scripts/rotate_pdf.py --input [file] --degrees [angle]`
4. Return rotated PDF to user

## Additional Resources
- [`scripts/rotate_pdf.py`](scripts/rotate_pdf.py) - Python script using PyPDF2

---

[AskUserQuestion: "Is de draft goed?" → "Ja"]

[AskUserQuestion Frontmatter: "Handmatig invoken" → adds disable-model-invocation: true]

CATEGORY SELECTION:

Existing prefixes: core, dev, frontend, thinking

[AskUserQuestion: "Welk category prefix?"
→ "dev- (Recommended)" - Past bij: development utilities]

TARGET: .claude/skills/dev-pdf-rotate/SKILL.md

CREATED!

- .claude/skills/dev-pdf-rotate/SKILL.md
- .claude/skills/dev-pdf-rotate/scripts/rotate_pdf.py

Test with: /dev-pdf-rotate
```

### Example 3: Subagent Skill

**User**: `/core-create deep-research`
**Claude**: "Describe what `/deep-research` should do."
**User**: "Research a topic thoroughly using codebase exploration"

```
UNDERSTOOD:

Name: /deep-research
Purpose: Research a topic thoroughly using codebase exploration
Example: "deep-research authentication flow" → comprehensive analysis

Correct? Yes

TYPE DETECTION:

Supporting files needed: NO
Result: Skill file

DRAFT:

---
description: Research a topic thoroughly using codebase exploration
context: fork
agent: Explore
---

# Deep Research

Research $ARGUMENTS thoroughly:

1. Find relevant files using Glob and Grep
2. Read and analyze the code
3. Summarize findings with specific file references

---

[AskUserQuestion Frontmatter: "Subagent uitvoering" → context: fork, agent: Explore]

TARGET: .claude/skills/core-deep-research/SKILL.md

CREATED!

- .claude/skills/core-deep-research/SKILL.md

Test with: /core-deep-research [topic]
```
