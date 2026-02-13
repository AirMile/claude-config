---
name: core-create
description: Create new skills interactively with optional resource bundling. Use when user wants to make, create, build, or add a new skill. Handles SKILL.md generation, frontmatter, references, and scripts.
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: core
---

# Create

## Overview

This skill creates new skills through a streamlined process. It determines if bundled resources are needed, then guides through creation.

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

### Frontmatter (YAML)

Two fields are **required** per the Anthropic skill spec. The rest is optional.

```yaml
---
# REQUIRED fields
name: my-skill                      # kebab-case, must match folder name
description: >-                     # MUST include WHAT + WHEN (trigger phrases)
  What it does in one sentence.
  Use when user says "trigger phrase" or asks for "specific task".

# RECOMMENDED
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: core                    # core|dev|frontend|game|project|story|team|thinking

# OPTIONAL — Claude Code specific
argument-hint: [issue-number]       # Hint shown during autocomplete
disable-model-invocation: true      # Only user can invoke via /name (default: false)
user-invocable: false               # Only Claude can invoke (default: true)
allowed-tools: Read, Grep, Glob     # Restrict tools when skill is active
context: fork                       # Run in isolated subagent context
agent: Explore                      # Which agent to use with context: fork
---
```

### Description Pattern

The `description` field is the most critical — it determines when Claude loads the skill.

**Pattern**: `[What it does] + [When to use it / trigger phrases]`

Good examples:
- `"Analyze staged git changes and generate conventional commit messages. Use with /core-commit. Detects rebase/merge state, validates changes."`
- `"Compose low-fidelity HTML wireframes using parallel design agents. Use when user asks for wireframe, mockup, prototype, or layout exploration."`

Bad examples:
- `"Helps with projects."` — too vague, no triggers
- `"Creates documentation systems."` — missing trigger phrases

### Security Rules

- No XML angle brackets (< >) in frontmatter
- No "claude" or "anthropic" in skill name (reserved)
- Description must be under 1024 characters

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

Proceed to Step 3.

### Step 3: Write Content

**IMPORTANT: All skill files must be written in English.**

- Skill content, instructions, examples: English
- AskUserQuestion labels/descriptions: Follow user's language preference from CLAUDE.md
- This ensures skills are reusable across projects

**Guiding principles for skill content:**

- Write instructions in imperative form ("Scan the project", "Generate a report")
- Focus on defining the PROCESS (steps, order, checks) — not prescribing specific output
- Let Claude use its knowledge and Context7 for domain-specific details
- Keep the skill lean: define what to do, not how to think
- Include AskUserQuestion integration points where user decisions are needed
- Reference supporting files if applicable

**Enter plan mode** before writing the draft:

1. Use the **EnterPlanMode** tool to switch to plan mode
2. Write the full SKILL.md draft (frontmatter + content) to the plan file
3. Include all supporting file contents if applicable
4. Use **ExitPlanMode** to present the plan for user approval

The plan file should contain the complete skill content exactly as it will be written. The user reviews and approves via the built-in plan approval flow.

After approval, proceed to Step 3.5.

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

Then ask if `$ARGUMENTS` substitution is needed:

- If skill accepts arguments → add `$ARGUMENTS` or `$0`, `$1` etc. to content

### Step 3.6: Design Patterns (Conditional)

**Skip this step if:** Simple skill without workflow phases.

**Apply when:** Skill has workflow with multiple phases or long-running operations.

Analyze the workflow and determine which patterns apply:

- **Notifications**: Long-running phases that need status updates
- **Parallel Agents**: Analysis/evaluation phases that benefit from multiple perspectives
- **AskUserQuestion**: Decision points where user input is needed
- **Sequential Modals**: Multi-step input gathering

Use **AskUserQuestion** tool:

- header: "Design Patterns"
- question: "Welke patterns wil je toepassen?"
- options:
  - label: "Notifications", description: "Status updates en feedback aan user"
  - label: "Parallel Agents", description: "Multi-agent orchestratie met meerdere perspectieven"
  - label: "AskUserQuestion", description: "Interactieve user input met keuzes"
  - label: "Geen patterns", description: "Simpele skill zonder patterns"
- multiSelect: true

Configure selected patterns and update the draft accordingly.

### Step 4: Create Files

#### Step 4.0: Determine Skill Name with Category Prefix

Skills use a flat naming convention with category prefixes: `[category]-[name]`.

1. **Detect existing categories:**

   ```bash
   find -L .claude/skills -name "SKILL.md" -type f 2>/dev/null | sed 's|^\.claude/skills/||' | sed 's|/SKILL\.md$||' | sed 's|-.*||' | sort -u
   ```

2. **Present category options** using AskUserQuestion — suggest best-matching existing prefixes, with option for new prefix.

3. **Set target path:**

   ```
   TARGET: .claude/skills/[prefix]-[name]/SKILL.md
   ```

#### Step 4.1: Resolve Write Target (Junction Detection)

Skills may live in a separate shared library linked via per-skill junctions. Detect this before writing.

**Step 1 — Check if junctions are active:**

```bash
powershell -Command "(Get-ChildItem '.claude/skills' -Directory | Select-Object -First 1).LinkType"
```

- Output `Junction` → per-skill junctions active, proceed to step 2
- Empty output → no junctions, write directly to `.claude/skills/`

**Step 2 — Get shared library path (only if Junction):**

```bash
powershell -Command "Split-Path (Get-ChildItem '.claude/skills' -Directory | Select-Object -First 1).Target"
```

- Output is the shared library path (e.g., `C:\Projects\claude-config\skills`)
- Write files there, then create junction back to `.claude/skills/`

#### Step 4.2: Write Files

1. Create skill directory in write target
2. Write SKILL.md with finalized content
3. Create supporting files if applicable
4. If per-skill junctions: create junction and verify

**Junction creation:**

```bash
powershell -Command "New-Item -ItemType Junction -Path '{junction_source}' -Target '{junction_target}'"
```

**Verify:**

```bash
test -f ".claude/skills/[prefix]-[name]/SKILL.md" && echo "Junction OK" || echo "Junction FAILED"
```

#### Step 4.3: Register in Profile

New skills must be added to `profiles.yaml` so they survive profile switches.

1. **Locate profiles.yaml:**
   - If per-skill junctions: `{shared_library}/core-profile/profiles.yaml`
   - If no junctions: `.claude/skills/core-profile/profiles.yaml`

2. **Detect matching profile** from skill name prefix:
   - Skill name `dev-lint` → prefix `dev` → profile key `dev`
   - Skill name `frontend-seo` → prefix `frontend` → profile key `frontend`

3. **Ask user** using AskUserQuestion:
   - header: "Profile"
   - question: "Aan welk profiel moet de skill worden toegevoegd?"
   - options: matching profile as recommended + 2-3 other likely profiles from profiles.yaml
   - multiSelect: false

4. **Add skill name** to the chosen profile in profiles.yaml:
   - Insert in alphabetical order within the profile's skill list
   - Use the Edit tool to add the entry

5. **Validate** by running:

   ```bash
   python3 .claude/skills/core-profile/switch-profile.py --validate
   ```

**Output**:

```
CREATED!

- [list of created files]
[If junction: Junction: source → target]
Profile: added to [profile-name] in profiles.yaml

Test with: /[prefix]-[name]
```

### Step 5: Verification

Use sequential thinking to verify:

- [ ] File(s) created in correct location
- [ ] Frontmatter has required `name` field (kebab-case, matches folder name)
- [ ] Frontmatter has required `description` with WHAT + WHEN pattern
- [ ] Description includes trigger phrases users would say
- [ ] Description is under 1024 characters
- [ ] No XML angle brackets (< >) in frontmatter
- [ ] `metadata` block present (author, version, category)
- [ ] Instructions clear and in imperative form
- [ ] All referenced supporting files exist (if resources created)
- [ ] Skill name follows `[prefix]-[name]` convention
- [ ] Junction created and accessible (if per-skill junctions active)

**Auto-fix** (no approval needed): formatting, whitespace, path separators
**Ask user** (needs approval): content changes, missing files, structure changes
