---
description: Manage feature worktrees - list, switch, create, and remove
---

# Worktree Management Skill

## Overview

This skill manages git worktrees for parallel feature development. Each feature gets its own isolated directory, enabling work on multiple features simultaneously without branch switching or stashing.

**Trigger**: `/worktree` command

## When to Use

This skill activates when:

**Trigger:**
- `/worktree` - Show all worktrees and switch
- `/worktree {name}` - Open specific feature worktree
- `/worktree new {name}` - Create new worktree without full /1-plan
- `/worktree remove {name}` - Remove worktree and cleanup
- `/worktree list` - Only show overview, no switch

## Workflow

### Mode Detection

Parse command arguments to determine mode:

```
/worktree              → MODE: ACTION_MENU (start with action choice)
/worktree list         → MODE: LIST_ONLY
/worktree {name}       → MODE: DIRECT_OPEN
/worktree new {name}   → MODE: CREATE_NEW
/worktree remove {name} → MODE: REMOVE
```

---

### MODE: ACTION_MENU

**Goal:** First ask what action the user wants, then show relevant worktree list.

**Steps:**

1. **Show action selection:**

   Use AskUserQuestion tool:
   - header: "Worktree"
   - question: "Wat wil je doen?"
   - options:
     - label: "Switch (Recommended)"
       description: "Open een bestaande feature worktree"
     - label: "New"
       description: "Maak een nieuwe worktree aan"
     - label: "Remove"
       description: "Verwijder een worktree"
     - label: "Uitleg"
       description: "Leg uit wat worktrees zijn"
   - multiSelect: false

2. **Handle action selection:**

   **If "Switch":** → Go to ACTION: SWITCH
   **If "New":** → Go to ACTION: NEW
   **If "Remove":** → Go to ACTION: REMOVE
   **If "Uitleg":**
   ```
   📖 WORKTREES UITLEG

   Git worktrees maken aparte mappen aan voor elke branch.
   Dit betekent dat je aan meerdere features tegelijk kunt werken,
   elk in hun eigen VSCode venster.

   Voordelen:
   - Geen branch switching nodig
   - Geen stashing van uncommitted changes
   - Elke feature volledig geïsoleerd
   - Parallel werken aan meerdere features

   Elke feature die je plant met /1-plan krijgt automatisch een
   eigen worktree. Open die worktree om aan die feature te werken.
   ```
   → Return to action selection

---

### ACTION: SWITCH

**Goal:** Show worktrees and let user choose which to open.

**Steps:**

1. **Scan active features:**
   ```bash
   ls .workspace/features/
   ```

   For each feature folder:
   - Check if `.worktree` file exists
   - Read worktree path from file
   - Detect current pipeline fase from existing files:
     - Has `05-refactor.md` → "Refactored"
     - Has `04-refine.md` → "/4-refine"
     - Has `03-verify.md` → "/3-verify"
     - Has `02-implementation.md` → "/2-code done"
     - Has `01-intent.md` only → "/1-plan done"

2. **Get current location:**
   ```bash
   pwd
   ```

3. **Display overview:**
   ```
   📂 BESCHIKBARE WORKTREES

   Huidige locatie: {current-directory}

   | Feature | Worktree | Fase |
   |---------|----------|------|
   | checkout | c:\Projects\project--checkout | /3-verify |
   | darkmode | c:\Projects\project--darkmode | /2-code |
   | login-fix | (no worktree) | /1-plan |

   ```

4. **Check if any worktrees exist:**

   **If NO worktrees found:**
   ```
   ℹ️ Geen worktrees gevonden

   Er zijn nog geen features met worktrees.
   Maak eerst een feature aan met /1-plan of /worktree new {name}.
   ```
   → EXIT

5. **Build selection options:**

   Use AskUserQuestion tool:
   - header: "Switch"
   - question: "Welke worktree wil je openen?"
   - options: (dynamically built)
     - For each feature WITH worktree:
       - label: "{feature-name} (Recommended)" (first one gets Recommended)
       - description: "Fase: {fase}, Path: {short-path}"
     - Always add:
       - label: "Annuleren"
         description: "Terug naar actie menu"
   - multiSelect: false

6. **Handle selection:**

   **If feature selected:**
   ```bash
   code "{worktree-path}"
   ```

   Report:
   ```
   ✅ WORKTREE OPENED

   Feature: {feature-name}
   Worktree: {worktree-path}

   VSCode venster geopend. Switch naar dat venster om verder te werken.
   ```

   **If "Annuleren":** → Return to ACTION_MENU

---

### ACTION: NEW

**Goal:** Show existing features and let user create a new worktree.

**Steps:**

1. **Scan features (with and without worktrees):**
   ```bash
   ls .workspace/features/
   ```

2. **Display current state:**
   ```
   📂 FEATURES OVERZICHT

   | Feature | Worktree | Status |
   |---------|----------|--------|
   | checkout | c:\Projects\project--checkout | ✓ Has worktree |
   | darkmode | (no worktree) | ○ No worktree |
   | login-fix | (no worktree) | ○ No worktree |

   ```

3. **Build options:**

   Use AskUserQuestion tool:
   - header: "New Worktree"
   - question: "Waarvoor wil je een worktree maken?"
   - options:
     - For each feature WITHOUT worktree:
       - label: "{feature-name} (Recommended)" (first one gets Recommended)
       - description: "Maak worktree voor bestaande feature"
     - Always add:
       - label: "Nieuwe feature"
         description: "Maak nieuwe feature + worktree (zonder /1-plan)"
       - label: "Annuleren"
         description: "Terug naar actie menu"
   - multiSelect: false

4. **Handle selection:**

   **If existing feature selected:**
   → Execute CREATE_NEW with that feature name

   **If "Nieuwe feature":**
   Ask for name:
   ```
   Voer een naam in voor de nieuwe feature:
   (alleen letters, cijfers en streepjes)
   ```
   → Execute CREATE_NEW with entered name

   **If "Annuleren":** → Return to ACTION_MENU

---

### ACTION: REMOVE

**Goal:** Show worktrees and let user choose which to remove.

**Steps:**

1. **Scan features with worktrees:**
   ```bash
   ls .workspace/features/
   ```

2. **Display worktrees:**
   ```
   📂 VERWIJDERBARE WORKTREES

   | Feature | Worktree | Fase |
   |---------|----------|------|
   | checkout | c:\Projects\project--checkout | /3-verify |
   | darkmode | c:\Projects\project--darkmode | /2-code |

   ```

3. **Check if any worktrees exist:**

   **If NO worktrees found:**
   ```
   ℹ️ Geen worktrees om te verwijderen

   Er zijn geen features met worktrees.
   ```
   → Return to ACTION_MENU

4. **Build options:**

   Use AskUserQuestion tool:
   - header: "Remove"
   - question: "Welke worktree wil je verwijderen?"
   - options:
     - For each feature WITH worktree:
       - label: "{feature-name}"
         description: "Fase: {fase}, Path: {short-path}"
     - Always add:
       - label: "Annuleren"
         description: "Terug naar actie menu"
   - multiSelect: false

5. **Handle selection:**

   **If feature selected:**
   → Execute REMOVE mode for that feature

   **If "Annuleren":** → Return to ACTION_MENU

---

### MODE: LIST_ONLY

**Goal:** Show overview without action menu.

**Steps:**

1. Scan features and worktrees (same as ACTION: SWITCH step 1)
2. Display table
3. Exit (no selection prompt)

**Output:**
```
📂 ACTIVE FEATURES & WORKTREES

| Feature | Worktree | Fase |
|---------|----------|------|
| checkout | c:\Projects\project--checkout | /3-verify |
| darkmode | c:\Projects\project--darkmode | /2-code |
| login-fix | (no worktree) | /1-plan |

Tip: /worktree om te switchen, new, of remove
```

---

### MODE: DIRECT_OPEN

**Goal:** Open specific feature worktree without menu.

**Steps:**

1. **Validate feature exists:**
   ```bash
   ls .workspace/features/{name}/
   ```

   **If not found:**
   ```
   ❌ Feature niet gevonden: {name}

   Beschikbare features:
   {list from .workspace/features/}
   ```
   → EXIT

2. **Check worktree file exists:**
   ```bash
   cat .workspace/features/{name}/.worktree
   ```

   **If no .worktree file:**
   ```
   ⚠️ Feature "{name}" heeft geen worktree

   Dit kan betekenen:
   - Feature is aangemaakt voor worktree support
   - Worktree is handmatig verwijderd

   Wil je een worktree aanmaken?
   ```

   Use AskUserQuestion tool:
   - header: "Worktree"
   - question: "Wil je een worktree aanmaken voor {name}?"
   - options:
     - label: "Ja, maak worktree (Recommended)"
       description: "Maak worktree en open in VSCode"
     - label: "Nee"
       description: "Annuleer"
   - multiSelect: false

   **If "Ja":** Execute CREATE_NEW mode with this name
   **If "Nee":** EXIT

3. **Open worktree:**
   ```bash
   code "{worktree-path}"
   ```

   Report:
   ```
   ✅ WORKTREE OPENED

   Feature: {name}
   Worktree: {worktree-path}

   VSCode venster geopend. Switch naar dat venster.
   ```

---

### MODE: CREATE_NEW

**Goal:** Create new worktree for quick features (without full /1-plan).

**Steps:**

1. **Validate name:**
   - No spaces, special characters
   - Not already exists in .workspace/features/

   **If invalid:**
   ```
   ❌ Ongeldige naam: {name}

   Gebruik alleen letters, cijfers en streepjes.
   ```
   → EXIT

   **If exists:**
   ```
   ❌ Feature bestaat al: {name}

   Gebruik /worktree {name} om de bestaande te openen.
   ```
   → EXIT

2. **Detect base branch:**
   ```bash
   git branch --list "develop"
   ```
   - If develop exists → `base_branch = "develop"`
   - Else → `base_branch = "main"` (fallback to "master")

3. **Generate paths:**
   ```bash
   # Get project name
   project_name=$(basename $(pwd))
   worktree_path="../${project_name}--${name}"
   branch_name="feature/${name}"
   ```

4. **Create worktree:**
   ```bash
   git worktree add "{worktree_path}" -b {branch_name} {base_branch}
   ```

   **If fails:**
   ```
   ❌ WORKTREE CREATION FAILED

   Error: {git error}

   Mogelijke oorzaken:
   - Branch bestaat al
   - Pad bestaat al
   - Geen schrijfrechten
   ```
   → EXIT

5. **Create feature folder and save metadata:**
   ```bash
   mkdir -p .workspace/features/{name}

   # Get absolute path
   absolute_path=$(cd "{worktree_path}" && pwd)

   echo "$absolute_path" > .workspace/features/{name}/.worktree
   echo "{base_branch}" > .workspace/features/{name}/.base-branch
   ```

6. **Copy .claude folder (if needed):**
   ```bash
   if [ ! -d "{worktree_path}/.claude" ]; then
     cp -r .claude "{worktree_path}/.claude"
   fi
   ```

7. **Open in VSCode:**
   ```bash
   code "{worktree_path}"
   ```

8. **Report:**
   ```
   ✅ WORKTREE CREATED

   Feature: {name}
   Branch: {branch_name}
   Base: {base_branch}
   Worktree: {absolute_path}

   VSCode venster geopend. Switch naar dat venster om te beginnen.

   💡 Voor volledige planning, run /1-plan in de worktree.
      Of begin direct met coderen als het een kleine fix is.
   ```

---

### MODE: REMOVE

**Goal:** Remove worktree and cleanup metadata.

**Steps:**

1. **Validate feature exists:**
   ```bash
   cat .workspace/features/{name}/.worktree
   ```

   **If not found:**
   ```
   ❌ Feature niet gevonden of heeft geen worktree: {name}
   ```
   → EXIT

2. **Check for uncommitted changes in worktree:**
   ```bash
   cd "{worktree_path}" && git status --porcelain
   ```

   **If changes exist:**
   ```
   ⚠️ UNCOMMITTED CHANGES

   De worktree heeft uncommitted changes:
   {list of changed files}
   ```

   Use AskUserQuestion tool:
   - header: "Uncommitted"
   - question: "Worktree heeft uncommitted changes. Toch verwijderen?"
   - options:
     - label: "Ja, verwijder alles"
       description: "Verwijder worktree inclusief uncommitted changes"
     - label: "Nee, behoud"
       description: "Annuleer verwijdering"
   - multiSelect: false

   **If "Nee":** EXIT

3. **Check for unpushed commits:**
   ```bash
   cd "{worktree_path}" && git log --oneline @{u}..HEAD 2>/dev/null
   ```

   **If unpushed commits:**
   ```
   ⚠️ UNPUSHED COMMITS

   De branch heeft commits die niet gepusht zijn:
   {list of commits}
   ```

   Use AskUserQuestion tool:
   - header: "Unpushed"
   - question: "Branch heeft unpushed commits. Toch verwijderen?"
   - options:
     - label: "Ja, verwijder"
       description: "Verwijder branch en worktree"
     - label: "Nee, eerst pushen"
       description: "Annuleer zodat je eerst kunt pushen"
   - multiSelect: false

   **If "Nee":** EXIT

4. **Confirm removal scope:**

   Use AskUserQuestion tool:
   - header: "Verwijderen"
   - question: "Wat wil je verwijderen?"
   - options:
     - label: "Alles (Recommended)"
       description: "Worktree + branch + metadata"
     - label: "Alleen worktree"
       description: "Behoud branch voor later gebruik"
     - label: "Annuleren"
       description: "Niets verwijderen"
   - multiSelect: false

5. **Execute removal:**

   **If "Alles":**
   ```bash
   # Remove worktree
   git worktree remove "{worktree_path}" --force

   # Remove branch
   git branch -D {branch_name}

   # Remove metadata
   rm -rf .workspace/features/{name}/
   ```

   **If "Alleen worktree":**
   ```bash
   # Remove only worktree
   git worktree remove "{worktree_path}" --force

   # Update metadata - mark as no worktree
   rm .workspace/features/{name}/.worktree
   ```

   **If "Annuleren":** EXIT

6. **Report:**
   ```
   ✅ VERWIJDERD

   | Item | Status |
   |------|--------|
   | Worktree | {removed/kept} |
   | Branch | {removed/kept} |
   | Metadata | {removed/kept} |

   💡 Features overzicht: /worktree list
   ```

---

## Best Practices

### Language
Follow the Language Policy in CLAUDE.md.

### Workflow
- Always validate before actions
- Warn about uncommitted changes
- Provide clear next steps
- Use AskUserQuestion for all confirmations

### Error Handling
- Clear error messages with causes
- Suggestions for resolution
- Never leave in broken state

## Error Handling

### Worktree Already Exists
```
❌ Worktree bestaat al op dit pad

Pad: {path}

Opties:
- Open bestaande: /worktree {name}
- Verwijder eerst: /worktree remove {name}
```

### Branch Already Exists
```
❌ Branch bestaat al: {branch_name}

Dit kan betekenen:
- Feature is eerder aangemaakt zonder worktree
- Branch is handmatig aangemaakt

Opties:
- Maak worktree voor bestaande branch
- Kies andere naam
```

### Permission Denied
```
❌ Geen schrijfrechten voor: {path}

Controleer:
- Directory permissions
- Disk space
- Antivirus blocking
```

## Restrictions

This skill must NEVER:
- Remove worktrees without confirmation
- Delete branches with unpushed commits without warning
- Leave metadata inconsistent with actual state

This skill must ALWAYS:
- Validate feature/worktree existence before actions
- Warn about uncommitted changes
- Provide clear status after each action
- Update .worktree metadata files
