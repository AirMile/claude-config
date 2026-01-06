---
description: Create commands interactively
---

# Create

## Overview

This command creates new commands through a streamlined process. It determines if bundled resources are needed, then guides through creation with concrete examples.

**Trigger**: `/create` or `/create [name]`

## Type Detection

**Command file only** (default):
- No bundled resources needed
- Everything from simple one-liners to complex multi-step workflows
- Can use agents, tools, sequential thinking - anything
- Result: `.claude/commands/[name].md`

**Command with resources** (only when bundled files needed):
- Needs scripts/ (Python, Bash executables)
- Needs references/ (documentation loaded into context)
- Needs assets/ (templates, images, fonts)
- Result: `.claude/commands/[name].md` + `.claude/resources/[name]/` folder with resources only

## Workflow

### Step 1: Gather Requirements

**If name provided** (`/create commit`):
1. Acknowledge the name
2. Ask: "Describe what `/[name]` should do. Give a concrete example."

**If no name** (`/create`):
1. Ask: "What should the command do? Give a concrete example and suggest a name."

**Follow-up questions** (ask 2-3 at a time):
- "What should trigger this? Give example phrases."
- "What's the expected output or behavior?"
- "Are there variations or options needed?"

**Output after gathering**:
```
📋 UNDERSTOOD:

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
- Does it need documentation/schemas to reference? → references/
- Does it need template files or assets for output? → assets/

**Decision**:
```
🔍 TYPE DETECTION:

Bundled resources needed: [YES/NO]
[If YES: list which resources and why]

Result: [Command only / Command + resources]

```

Use **AskUserQuestion** tool:
- header: "Type"
- question: "Akkoord met het gedetecteerde type?"
- options:
  - label: "Ja, doorgaan (Recommended)", description: "Type is correct, begin met schrijven"
  - label: "Nee, aanpassen", description: "Type of resources moet anders"
  - label: "Uitleg", description: "Leg het verschil uit tussen command en command+resources"
- multiSelect: false

**Response handling:**
- "Ja, doorgaan" → if resources needed, proceed to Step 2.5; otherwise proceed to Step 3
- "Nee, aanpassen" → ask what should change about the type/resources
- "Uitleg" → explain command vs command+resources, then re-ask

### Step 2.5: Select Resource Types (Conditional)

**Skip this step if:** Command file only (no bundled resources needed).

**Apply when:** Command needs bundled resources.

Use **AskUserQuestion** tool:
- header: "Resources"
- question: "Welke resource types zijn nodig?"
- options:
  - label: "Scripts", description: "Uitvoerbare scripts (Python, Bash, PowerShell)"
  - label: "References", description: "Documentatie en schema referenties"
  - label: "Assets", description: "Templates, afbeeldingen, fonts"
  - label: "Uitleg", description: "Leg elk resource type uit"
- multiSelect: true

**Response handling:**
- Selected types → create corresponding folders in `.claude/resources/[name]/`
- "Uitleg" → explain each resource type:
  - **Scripts**: Uitvoerbare bestanden die de command kan aanroepen (e.g., Python scripts, shell scripts)
  - **References**: Documentatie die in context geladen wordt (e.g., API specs, style guides)
  - **Assets**: Statische bestanden voor output (e.g., templates, images, fonts)

**Output after selection**:
```
📁 RESOURCE STRUCTURE:

.claude/resources/[name]/
├── scripts/    [if selected]
├── references/ [if selected]
└── assets/     [if selected]
```

Proceed to Step 3.

### Step 3: Write Content

**IMPORTANT: All command files must be written in English.**
- Command content, instructions, examples: English
- AskUserQuestion labels/descriptions: Follow user's language preference from CLAUDE.md
- This ensures commands are reusable across projects

**For Command file**:

Draft the command file content:

```markdown
---
description: [clear description for command list]
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

**For Command with resources**:

Draft command file + list resources to create:

```markdown
---
description: [clear description for command list]
---

# [Name]

[Instructions in imperative form]

## When to Use
[Trigger scenarios]

## Process
[Step-by-step workflow referencing bundled resources]

## Resources
References bundled files in `.claude/resources/[name]/`:
- scripts/[file]: [purpose]
- references/[file]: [purpose]
- assets/[file]: [purpose]

## Examples
[Concrete examples if helpful]
```

**Show draft**:
```
📝 DRAFT:

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

### Step 3.5: Design Patterns (Conditional)

**Skip this step if:** Simple command without workflow phases.

**Apply when:** Command/skill has workflow with multiple phases or long-running operations.

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
     - label: "Sequential Modals", description: "Multi-step vragenflows"
     - label: "Geen patterns", description: "Simpele command zonder patterns"
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
   📋 NOTIFICATION TIMING:

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
   📋 AGENT CONFIGURATION:

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
   📋 ASKUSERQUESTION POINTS:

   Suggested decision points:

   | Decision Point | Question Type | Options |
   |----------------|---------------|---------|
   | [point 1] | [single/multi] | [options] |
   | [point 2] | [single/multi] | [options] |
   ```

   **For Sequential Modals:**

   **Rule:** Use sequential modals for multi-step configuration.

   - Break complex input into logical steps
   - Each step focuses on one aspect
   - Allow back/forward navigation conceptually
   - Benefits: Less overwhelming, clearer structure

   ```
   📋 MODAL SEQUENCE:

   Step 1: [aspect] → [questions]
   Step 2: [aspect] → [questions]
   Step 3: [aspect] → [questions]
   ```

4. **Update draft with selected patterns** before proceeding to Step 4.

### Step 4: Create Files

#### Step 4.0: Select Target Folder

Before creating files, determine the appropriate folder location:

1. **Scan existing subfolders:**
   ```bash
   powershell -Command "Get-ChildItem -Path '.claude\commands' -Directory | Select-Object -ExpandProperty Name"
   ```

2. **Analyze command fit:**
   - Compare command purpose to existing folder themes:
     - `core/` - Core Claude Code functionality (create, edit, save, resume)
     - `dev/` - Development workflow (plan, code, verify, debug)
     - `frontend/` - UI/UX related (theme, wireframe)
     - `story/` - Creative writing commands
     - `team/` - Collaboration commands
     - `thinking/` - Analysis and ideation (brainstorm, critique, analyze)
   - Determine best match or if new folder is needed

3. **Present folder options:**

   Use **AskUserQuestion** tool:
   - header: "Target Folder"
   - question: "In welke map moet dit command komen?"
   - options:
     - label: "[best-match]/ (Recommended)", description: "Past bij: [reason]"
     - label: "[second-match]/", description: "Alternatief: [reason]"
     - label: "[third-match]/", description: "Ook mogelijk: [reason]"
     - label: "Nieuwe map maken", description: "Maak een nieuwe submap aan"
   - multiSelect: false

   **Note:** First 3 options are dynamically selected from existing folders based on best fit analysis.

   **Response handling:**
   - Existing folder selected → use that path
   - "Nieuwe map maken" → ask for folder name, create folder

4. **Set target path:**
   ```
   📁 TARGET: .claude/commands/[folder]/[name].md
   ```

#### Step 4.1: Write Files

**For Command file**:
1. Write `.claude/commands/[folder]/[name].md`
2. Confirm creation

**For Command with resources**:
1. Write `.claude/commands/[folder]/[name].md` with full instructions
2. Create `.claude/resources/[folder]/[name]/` folder
3. Create and populate scripts/, references/, assets/ as needed

**Output**:
```
✅ CREATED!

[For command only:]
- .claude/commands/[folder]/[name].md

[For command with resources:]
- .claude/commands/[folder]/[name].md
- .claude/resources/[folder]/[name]/scripts/[files]
- .claude/resources/[folder]/[name]/references/[files]

Test with: /[folder]:[name]
```

### Step 5: Verification

Use sequential thinking to verify:

**Checklist**:
- [ ] File(s) created in correct location
- [ ] Frontmatter valid (description required)
- [ ] Instructions clear and in imperative form
- [ ] All referenced resources exist (if resources folder created)
- [ ] Command triggers correctly

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
✅ VERIFICATION COMPLETE

[name] is ready to use!
```

Send notification:
```bash
powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "Command created: [name]"
```

## Examples

### Example 1: Simple Command

**User**: `/create suggest`
**Claude**: "Describe what `/suggest` should do."
**User**: "Generate 3 options using sequential thinking"

```
📋 UNDERSTOOD:

Name: /suggest
Purpose: Generate 3 alternative options using sequential thinking
Example: "suggest how to refactor this function" → 3 analyzed options

Correct? Yes

🔍 TYPE DETECTION:

Bundled resources needed: NO
Result: Command file

📝 DRAFT:

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

[AskUserQuestion: "Is de draft goed?" → "Ja, maak aan"]

📁 FOLDER SELECTION:

Existing folders: core/, dev/, frontend/, story/, team/, thinking/

[AskUserQuestion: "In welke map moet dit command komen?"
→ "thinking/ (Recommended)" - Past bij: analysis and ideation commands]

📁 TARGET: .claude/commands/thinking/suggest.md

✅ CREATED!

- .claude/commands/thinking/suggest.md

Test with: /thinking:suggest
```

### Example 2: Command with Resources

**User**: `/create pdf-rotate`
**Claude**: "Describe what `/pdf-rotate` should do."
**User**: "Rotate PDF files by 90, 180, or 270 degrees"

```
📋 UNDERSTOOD:

Name: /pdf-rotate
Purpose: Rotate PDF files by specified degrees
Example: "rotate invoice.pdf 90 degrees" → rotated PDF

Correct? Yes

🔍 TYPE DETECTION:

Bundled resources needed: YES
- scripts/rotate_pdf.py - Python script for reliable PDF rotation

Result: Command + resources

📝 DRAFT:

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
3. Execute: `python .claude/resources/pdf-rotate/scripts/rotate_pdf.py --input [file] --degrees [angle]`
4. Return rotated PDF to user

## Resources
- `.claude/resources/pdf-rotate/scripts/rotate_pdf.py` - Python script using PyPDF2

---

[AskUserQuestion: "Is de draft goed?" → "Ja, maak aan"]

📁 FOLDER SELECTION:

Existing folders: core/, dev/, frontend/, story/, team/, thinking/

[AskUserQuestion: "In welke map moet dit command komen?"
→ "dev/ (Recommended)" - Past bij: development utilities]

📁 TARGET: .claude/commands/dev/pdf-rotate.md

✅ CREATED!

- .claude/commands/dev/pdf-rotate.md
- .claude/resources/dev/pdf-rotate/scripts/rotate_pdf.py

Test with: /dev:pdf-rotate
```
