---
name: core-create
description: >-
  Create new Claude Code skills interactively with optional resource bundling.
  Use with /core-create. Handles SKILL.md generation, frontmatter, references,
  and scripts.
disable-model-invocation: true
argument-hint: "[name]"
metadata:
  author: mileszeilstra
  version: 1.1.0
  category: core
---

# Create

Create new skills through a streamlined process: gather requirements → plan → create.

**Trigger**: `/core-create` or `/core-create [name]`

## Skill Spec Quick Reference

### Frontmatter

Required: `name` (kebab-case, matches folder) and `description` (WHAT + WHEN pattern with trigger phrases, under 1024 chars).

Optional Claude Code fields: `argument-hint`, `disable-model-invocation`, `user-invocable`, `allowed-tools`, `context: fork`, `agent`.

Recommended: `metadata` with author (`mileszeilstra`), version, category (`core|dev|frontend|game|project|story|team|thinking`).

### Description Pattern

`[What it does] + [When to use it / trigger phrases]`

Good: `"Analyze staged git changes and generate conventional commit messages. Use with /core-commit. Detects rebase/merge state, validates changes."`

Bad: `"Helps with projects."` — too vague, no triggers.

### Security Rules

- No XML angle brackets (< >) in frontmatter
- No "claude" or "anthropic" in skill name
- Description under 1024 characters

### Substitutions

- `$ARGUMENTS` / `$ARGUMENTS[N]` / `$N` — argument injection
- `` !`command` `` — dynamic context injection (shell commands run before content is sent)

### Supporting Files

Skills can include files alongside SKILL.md (scripts/, references/, templates/). Reference them from SKILL.md.

## Workflow

### Step 1: Gather Requirements

**If name provided** (`/core-create commit`):

- Acknowledge, ask: "Describe what `/[name]` should do. Give a concrete example."

**If no name** (`/core-create`):

- Ask: "What should the skill do? Give a concrete example and suggest a name."

Ask 2-3 follow-up questions to clarify triggers, expected output, and variations. Then summarize:

```

UNDERSTOOD:

Name: /[name]
Purpose: [one sentence]
Example: "[example input]" → [expected behavior]
Type: [Skill only / Skill + resources]

```

Use **AskUserQuestion** tool:

- header: "Confirm"
- question: "Klopt deze samenvatting?"
- options:
  - label: "Ja, ga door (Recommended)", description: "Samenvatting is correct, ga verder"
  - label: "Nee, aanpassen", description: "Ik wil iets wijzigen"
- multiSelect: false

### Step 2: Select Resource Types (Conditional)

**Skip if:** Skill file only (no supporting files needed).

Use **AskUserQuestion** tool:

- header: "Resources"
- question: "Welke resource types zijn nodig?"
- options:
  - label: "Scripts", description: "Uitvoerbare scripts (Python, Bash, PowerShell)"
  - label: "References", description: "Documentatie, schema's, referentiebestanden (.md)"
  - label: "Templates/Assets", description: "Templates, afbeeldingen, fonts, voorbeeldbestanden"
- multiSelect: true

### Step 3: Plan

**Write skill content in English.** AskUserQuestion labels follow user's language from CLAUDE.md.

**Guiding principles:**

- Imperative form ("Scan the project", not "You should scan")
- Define the PROCESS — not how to think
- Keep it lean: let Claude use its own knowledge for domain details
- Include AskUserQuestion where user decisions are genuinely needed

**Enter plan mode** before writing the draft:

1. Use the **EnterPlanMode** tool to switch to plan mode
2. Write the full SKILL.md draft (frontmatter + content) to the plan file:
   - Full frontmatter (name, description, metadata, and any optional fields — infer `disable-model-invocation`, `argument-hint`, `context: fork` etc. from requirements)
   - Full skill content
   - Supporting file contents (if applicable)
3. Use **ExitPlanMode** to present the plan for user approval

The plan file should contain the complete skill content exactly as it will be written. The plan IS the draft — frontmatter config, design patterns, and content are all reviewed in one pass.

### Step 4: Create Files

#### Determine Category Prefix

Skills use flat naming: `[category]-[name]`.

Detect existing categories:

```bash
find -L .claude/skills -name "SKILL.md" -type f 2>/dev/null | sed 's|^\.claude/skills/||' | sed 's|/SKILL\.md$||' | sed 's|-.*||' | sort -u
```

If prefix is ambiguous, ask via **AskUserQuestion** with existing prefixes as options.

Set target: `.claude/skills/[prefix]-[name]/SKILL.md`

#### Detect Write Target (Junction/Symlink Detection)

Skills may live in a shared library linked via junctions (Windows) or symlinks (Linux/macOS).

**Linux/macOS:**

```bash
readlink -f .claude/skills/$(ls .claude/skills/ | head -1) 2>/dev/null
```

- If resolves to a different path → shared library, write there and ensure symlink exists
- Otherwise → write directly to `.claude/skills/`

**Windows:**

```bash
powershell -Command "(Get-ChildItem '.claude/skills' -Directory | Select-Object -First 1).LinkType"
```

- Output `Junction` → get shared library path:

  ```bash
  powershell -Command "Split-Path (Get-ChildItem '.claude/skills' -Directory | Select-Object -First 1).Target"
  ```

  Write files there, then create junction:

  ```bash
  powershell -Command "New-Item -ItemType Junction -Path '{junction_source}' -Target '{junction_target}'"
  ```

- Empty output → no junctions, write directly to `.claude/skills/`

#### Write Files

1. Create skill directory in write target
2. Write SKILL.md with finalized content
3. Create supporting files if applicable
4. Verify junction/symlink if applicable:

   ```bash
   test -f ".claude/skills/[prefix]-[name]/SKILL.md" && echo "OK" || echo "FAILED"
   ```

#### Register in Profile

1. Locate `profiles.yaml` in `.claude/skills/core-profile/` (or shared library equivalent)
2. Detect profile from prefix (skill `dev-lint` → profile `dev`)
3. Insert skill name in alphabetical order
4. Validate:

   ```bash
   python3 .claude/skills/core-profile/switch-profile.py --validate
   ```

**Output:**

```
CREATED!

- [list of created files]
[If junction/symlink: Link: source → target]
Profile: added to [profile-name] in profiles.yaml

Test with: /[prefix]-[name]
```

### Step 5: Verification

Verify with sequential thinking:

- [ ] File(s) in correct location
- [ ] `name` field: kebab-case, matches folder
- [ ] `description`: WHAT + WHEN pattern, trigger phrases, under 1024 chars
- [ ] No XML angle brackets in frontmatter
- [ ] `metadata` block present
- [ ] Instructions imperative and in English
- [ ] Supporting files exist (if referenced)
- [ ] Skill name follows `[prefix]-[name]` convention
- [ ] Junction/symlink accessible (if applicable)
- [ ] profiles.yaml updated and validated

Auto-fix without asking: formatting, whitespace, path separators.
Ask user: content changes, missing files, structure changes.
