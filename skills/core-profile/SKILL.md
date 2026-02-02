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

Read the profiles config:
```
Read: .claude/skills/core-profile/profiles.yaml
```

Parse the user's argument to determine which profile(s) to activate.

- No argument → show a **numbered list** of all profiles (except "core" and "all") with their unique skills (skills not in "core"). Format:

  ```
  **Beschikbare profielen:**

  1. **dev** — dev-backlog, dev-build, dev-define, dev-test, dev-repos, ...
  2. **dev-legacy** — dev-legacy-1-plan, dev-legacy-2-code, dev-legacy-debug, ...
  3. **frontend** — frontend-theme, frontend-wireframe
  ...
  A. **all** — Alle skills
  ```

  Then ask the user to type their choice (number(s), name(s), or comma-separated combinations). Do NOT use AskUserQuestion — just present the list and ask in plain text so all options are visible.

- One or more arguments → use those as profile names
- `all` → activate everything

### Step 2: Run switch script

The script auto-detects the source directory from its own location.

```bash
python3 .claude/skills/core-profile/switch-profile.py \
  --profiles <profile1> [profile2] ... \
  --skills-dir .claude/skills
```

### Step 3: Confirm

After the script completes, list the active skills:
```bash
ls .claude/skills/
```

Report which profiles are now active and how many skills are available.

**IMPORTANT:** After switching profiles, inform the user they need to start a new conversation for the skill list to update in Claude Code.
