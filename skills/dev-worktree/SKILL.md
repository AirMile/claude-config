---
name: dev-worktree
description: Manage git worktrees for parallel feature development — list, switch, create, and remove. Use with /dev-worktree to work on multiple features simultaneously.
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: dev
---

# Worktree Management Skill

## Overview

This skill manages git worktrees for parallel feature development. Each feature gets its own isolated directory, enabling work on multiple features simultaneously without branch switching or stashing.

**Trigger**: `/dev-worktree` command

## When to Use

This skill activates when:

**Trigger:**

- `/dev-worktree` - Show all worktrees and switch
- `/dev-worktree {name}` - Open specific feature worktree
- `/dev-worktree new {name}` - Create new worktree without full /dev-legacy-1-plan
- `/dev-worktree remove {name}` - Remove worktree and cleanup
- `/dev-worktree list` - Only show overview, no switch

## Workflow

### Mode Detection

Parse command arguments to determine mode:

```
/dev-worktree              → MODE: ACTION_MENU (start with action choice)
/dev-worktree list         → MODE: LIST_ONLY
/dev-worktree {name}       → MODE: DIRECT_OPEN
/dev-worktree new {name}   → MODE: CREATE_NEW
/dev-worktree remove {name} → MODE: REMOVE
```

---

### Shared: Feature Scan

Used by all modes. Scan and build feature table:

1. `ls .project/features/`
2. Per feature: check `.worktree` file, detect pipeline fase
3. Get current location: `pwd`

Pipeline fase detection:

- Has `05-refactor.md` → "Refactored"
- Has `04-refine.md` → "/4-refine"
- Has `03-verify.md` → "/3-verify"
- Has `02-implementation.md` → "/dev-legacy-2-code done"
- Has `01-intent.md` only → "/dev-legacy-1-plan done"

Display as table:

```
| Feature | Worktree | Fase |
|---------|----------|------|
| checkout | ../project--checkout | /dev-legacy-3-verify |
| darkmode | ../project--darkmode | /dev-legacy-2-code |
| login-fix | (no worktree) | /dev-legacy-1-plan |
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

   Elke feature die je plant met /dev-legacy-1-plan krijgt automatisch een
   eigen worktree. Open die worktree om aan die feature te werken.
   ```

   → Return to action selection

---

### ACTION: SWITCH

**Goal:** Show worktrees and let user choose which to open.

**Steps:**

1. Run **Shared: Feature Scan** and display table.

2. **Check if any worktrees exist:**

   **If NO worktrees found:**

   ```
   ℹ️ Geen worktrees gevonden

   Er zijn nog geen features met worktrees.
   Maak eerst een feature aan met /dev-legacy-1-plan of /dev-worktree new {name}.
   ```

   → EXIT

3. **Build selection options:**

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

4. **Handle selection:**

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

1. Run **Shared: Feature Scan** and display table (include worktree status column).

2. **Build options:**

   Use AskUserQuestion tool:
   - header: "New Worktree"
   - question: "Waarvoor wil je een worktree maken?"
   - options:
     - For each feature WITHOUT worktree:
       - label: "{feature-name} (Recommended)" (first one gets Recommended)
       - description: "Maak worktree voor bestaande feature"
     - Always add:
       - label: "Nieuwe feature"
         description: "Maak nieuwe feature + worktree (zonder /dev-legacy-1-plan)"
       - label: "Annuleren"
         description: "Terug naar actie menu"
   - multiSelect: false

3. **Handle selection:**

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

1. Run **Shared: Feature Scan** and display table (only features with worktrees).

2. **Check if any worktrees exist:**

   **If NO worktrees found:**

   ```
   ℹ️ Geen worktrees om te verwijderen

   Er zijn geen features met worktrees.
   ```

   → Return to ACTION_MENU

3. **Build options:**

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

4. **Handle selection:**

   **If feature selected:**
   → Execute REMOVE mode for that feature

   **If "Annuleren":** → Return to ACTION_MENU

---

### MODE: LIST_ONLY

**Goal:** Show overview without action menu.

Run **Shared: Feature Scan**, display table, exit. No selection prompt.

Add tip at bottom: `Tip: /dev-worktree om te switchen, new, of remove`

---

### MODE: DIRECT_OPEN

**Goal:** Open specific feature worktree without menu.

**Steps:**

1. **Validate feature exists:**

   ```bash
   ls .project/features/{name}/
   ```

   **If not found:**

   ```
   ❌ Feature niet gevonden: {name}

   Beschikbare features:
   {list from .project/features/}
   ```

   → EXIT

2. **Check worktree file exists:**

   ```bash
   cat .project/features/{name}/.worktree
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

**Goal:** Create new worktree for quick features (without full /dev-legacy-1-plan).

**Steps:**

1. **Validate name:**
   - No spaces, special characters
   - Not already exists in .project/features/

   **If invalid:**

   ```
   ❌ Ongeldige naam: {name}

   Gebruik alleen letters, cijfers en streepjes.
   ```

   → EXIT

   **If exists:**

   ```
   ❌ Feature bestaat al: {name}

   Gebruik /dev-worktree {name} om de bestaande te openen.
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
   mkdir -p .project/features/{name}

   # Get absolute path
   absolute_path=$(cd "{worktree_path}" && pwd)

   echo "$absolute_path" > .project/features/{name}/.worktree
   echo "{base_branch}" > .project/features/{name}/.base-branch
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

   💡 Voor volledige planning, run /dev-legacy-1-plan in de worktree.
      Of begin direct met coderen als het een kleine fix is.
   ```

---

### MODE: REMOVE

**Goal:** Remove worktree and cleanup metadata.

**Steps:**

1. **Validate feature exists:**

   ```bash
   cat .project/features/{name}/.worktree
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
   rm -rf .project/features/{name}/
   ```

   **If "Alleen worktree":**

   ```bash
   # Remove only worktree
   git worktree remove "{worktree_path}" --force

   # Update metadata - mark as no worktree
   rm .project/features/{name}/.worktree
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

   💡 Features overzicht: /dev-worktree list
   ```

---

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
