---
description: Switch between skill profiles to show/hide groups of skills
disable-model-invocation: true
---

# Activate

Switch skill profiles to control which skills are visible. Supports single profiles, multiple profiles combined, or all skills.

## Usage

- `/core-profile` - Show available profiles and ask which to activate
- `/core-profile dev` - Activate dev profile (dev + core skills)
- `/core-profile dev game` - Combine dev and game profiles
- `/core-profile all` - Activate all skills

## Execution

### Step 1: Determine profiles

If the user provided profile names or numbers as arguments, skip to Step 2.

If no arguments were given, get the list from the script:

```bash
python3 .claude/skills/core-profile/switch-profile.py --list
```

Present the output to the user with a header:

```
**Beschikbare profielen:**

{output from --list}
```

Then ask the user to type their choice (number(s), name(s), or comma-separated combinations). Do NOT use AskUserQuestion — just present the list and ask in plain text so all options are visible.

### Step 2: Run switch script

Pass the user's input directly to the script. The script accepts both names and numbers.

```bash
python3 .claude/skills/core-profile/switch-profile.py \
  --profiles <user-input> \
  --skills-dir .claude/skills
```

### Step 3: Confirm

After the script completes, list the active skills:

```bash
ls .claude/skills/
```

Report which profiles are now active and how many skills are available.

**IMPORTANT:** After switching profiles, inform the user they need to start a new conversation for the skill list to update in Claude Code.
