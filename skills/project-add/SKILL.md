---
name: project-add
description: Add or clone a project into the multi-project setup. Use with /project-add.
metadata:
  author: claude-config
  version: 1.0.0
  category: project
---

# Project Add

Adds a project — create a new project or clone an existing GitHub repo — with symlinks (macOS) or junctions (Windows) to the shared claude-config.

## Trigger

`/project-add [name]` or `/project-add`

## Process

### PHASE 0: Pre-flight Checks

**Detect platform:**

```bash
# Detect OS
case "$(uname -s)" in
  Darwin)                PLATFORM="macos" ;;
  Linux)                 PLATFORM="linux" ;;
  MINGW*|CYGWIN*|MSYS*) PLATFORM="windows" ;;
  *) echo "Unsupported platform: $(uname -s)" >&2; exit 1 ;;
esac
```

Use the detected platform to resolve `{projects_root}` and `{config_repo}` from `paths.yaml` (see Configuration section below).

**Before anything is created, validate:**

```bash
# Check claude-config exists and is complete
test -d "{config_repo}"
test -d "{config_repo}/scripts"

# Check gh CLI authenticated (needed for clone mode and publish)
gh auth status
```

**If config check fails:**

```
❌ claude-config not found or incomplete

Expected: {config_repo}
With folders: agents/, skills/, scripts/

Solution:
1. Clone claude-config repo to {config_repo}
2. Or set path via CLAUDE_CONFIG_REPO environment variable
```

→ Stop command, do NOT create any folders

**If gh auth fails:**
→ Store: `GH_AVAILABLE=false`. Show: `gh not available — clone mode and GitHub publish skipped.`

**If checks pass:**
→ Continue to PHASE 1

### PHASE 1: Mode Selection

**If name provided via `/project-add [name]`:**
→ Assume: **new project** mode. Validate the name immediately (same rules as PHASE 2 (new): lowercase letters/digits/hyphens, no spaces or special characters, not existing in `{projects_root}`). On validation error: show the error and stop. If valid: store name and go to PHASE 3 (skip PHASE 2 (new) name question).

**If no name provided:**

If `GH_AVAILABLE=false`: show only "Create new project" (Clone requires gh).

```yaml
question: "What do you want to do?"
header: "Mode"
options:
  - label: "Create new project (Recommended)"
    description: "Create an empty project with claude-config symlinks"
  - label: "Clone existing repo" # only show if GH_AVAILABLE=true
    description: "Clone a GitHub repo and configure claude-config symlinks"
multiSelect: false
```

→ **New project:** go to PHASE 2 (new)
→ **Clone:** go to PHASE 2 (clone)

### PHASE 2 (new): Project Name

**Ask name:**

```yaml
question: "What is the name of the new project?"
header: "Project"
options:
  - label: "Type a name"
    description: "Short, lowercase name without spaces (e.g. my-app)"
multiSelect: false
```

**Validation:**

- Lowercase letters, digits, hyphens
- No spaces or special characters
- Not existing in `{projects_root}`

→ Go to PHASE 3

### PHASE 2 (clone): Repo Selection

**Two sub-options:**

```yaml
question: "How do you want to select the repo?"
header: "Repo"
options:
  - label: "Browse my repos (Recommended)"
    description: "Show list of your GitHub repos"
  - label: "Enter manually"
    description: "Type owner/repo or full GitHub URL"
multiSelect: false
```

#### Browse mode:

```bash
gh repo list --limit 30 --json name,description,isPrivate,url --jq '.[] | "\(.name)\t\(.description // "-")\t\(if .isPrivate then "🔒" else "🌐" end)\t\(.url)"'
```

Show as numbered list in plain text:

```
Available repos:

 1. my-app          — My cool app             🔒
 2. website         — Personal site            🌐
 3. api-backend     — REST API service         🔒
...

M. Load more
Q. Enter manually

Which repo? (number)
```

- User chooses number → select that repo
- **M** → load next 30 (`--limit 30` with offset)
- **Q** → switch to manual entry

#### Manual mode:

User types `owner/repo` or full GitHub URL (e.g. `https://github.com/owner/repo`).
Parse to `owner/repo` format.

**After repo selection:**

1. Extract project name from repo name
2. Check that `{projects_root}/[name]` does not already exist
3. Clone:

```bash
gh repo clone <owner/repo> {projects_root}/[name]
```

→ Go to PHASE 3

### PHASE 3: Setup Directories

**Create project subdirectories (mkdir -p is safe for both modes):**

```bash
mkdir -p {projects_root}/[name]/.claude/docs
mkdir -p {projects_root}/[name]/.claude/research
mkdir -p {projects_root}/[name]/.project/sessions/chats
mkdir -p {projects_root}/[name]/.project/sessions/commands
mkdir -p {projects_root}/[name]/.project/plans
mkdir -p {projects_root}/[name]/.project/features
```

**New mode:** creates everything from scratch.
**Clone mode:** project root already exists, only creates `.claude/` and `.project/` subdirs.

### PHASE 4: Base Files

#### New mode:

**Copy templates:**

**Write initial project files:**

macOS / Linux:

```bash
cat > "{projects_root}/[name]/.project/project.json" << 'ENDJSON'
{
  "seed": { "name": "[name]", "pitch": "", "content": "" },
  "localUrl": "",
  "theme": {
    "colors": { "main": [], "accent": [], "semantic": [] },
    "typography": { "families": { "heading": "", "body": "", "mono": "" }, "sizes": [] },
    "spacing": { "base": "", "scale": [] },
    "breakpoints": [],
    "borderRadius": [],
    "shadows": [],
    "modes": {},
    "cssVars": ""
  },
  "stack": { "framework": "", "language": "", "styling": "", "db": "", "auth": "", "hosting": "", "packages": [] },
  "data": { "entities": [] },
  "endpoints": [],
  "features": [],
  "team": { "mode": "solo" },
  "thinking": []
}
ENDJSON

cat > "{projects_root}/[name]/.project/project-context.json" << 'ENDJSON'
{
  "architecture": { "routes": [], "components": [], "endpoints": [], "entities": [], "diagram": "", "dataFlow": "" },
  "context": { "structure": "", "routing": [], "patterns": [] },
  "learnings": []
}
ENDJSON
```

Windows (PowerShell):

```powershell
$projectJson = '{
  "seed": { "name": "[name]", "pitch": "", "content": "" },
  "localUrl": "",
  "theme": {
    "colors": { "main": [], "accent": [], "semantic": [] },
    "typography": { "families": { "heading": "", "body": "", "mono": "" }, "sizes": [] },
    "spacing": { "base": "", "scale": [] },
    "breakpoints": [], "borderRadius": [], "shadows": [], "modes": {}, "cssVars": ""
  },
  "stack": { "framework": "", "language": "", "styling": "", "db": "", "auth": "", "hosting": "", "packages": [] },
  "data": { "entities": [] },
  "endpoints": [], "features": [], "team": { "mode": "solo" }, "thinking": []
}'
Set-Content -Path "{projects_root}\[name]\.project\project.json" -Value $projectJson -Encoding UTF8

$ctxJson = '{
  "architecture": { "routes": [], "components": [], "endpoints": [], "entities": [], "diagram": "", "dataFlow": "" },
  "context": { "structure": "", "routing": [], "patterns": [] },
  "learnings": []
}'
Set-Content -Path "{projects_root}\[name]\.project\project-context.json" -Value $ctxJson -Encoding UTF8
```

**Replace `[name]` literally with the actual project name in both files.**

```bash
# settings.local.json with default permissions
echo '{"permissions": {"allow": []}}' > {projects_root}/[name]/.claude/settings.local.json
```

**.gitignore with standard content:**

```
# Dependencies
node_modules/

# Build output
dist/
build/

# Environment
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp

# OS
.DS_Store
Thumbs.db

# Claude project (runtime data)
.project/session/
.project/sessions/
.project/features/

# Claude local config (per-device, not shared)
.claude/paths.local.yaml

# Symlinks/junctions (tracked via master repo, not this one)
.claude/agents/
.claude/hooks/
.claude/skills/
.claude/scripts/
```

#### Clone mode:

**Create settings.local.json:**

```bash
echo '{"permissions": {"allow": []}}' > {projects_root}/[name]/.claude/settings.local.json
```

**.gitignore — append claude-specific entries if not already present:**

Check whether the following entries are already in `.gitignore`. Only add missing entries:

```
# Claude project (runtime data)
.project/session/
.project/sessions/
.project/features/

# Claude local config (per-device, not shared)
.claude/paths.local.yaml

# Symlinks/junctions (tracked via master repo, not this one)
.claude/agents/
.claude/hooks/
.claude/skills/
.claude/scripts/
```

If `.gitignore` does not exist, create it with the above entries.

### PHASE 6: Git Initialization

#### New mode:

```bash
cd {projects_root}/[name]
git init
git add .gitignore
```

#### Clone mode:

→ Skip (repo is already initialized by `gh repo clone`)

### PHASE 7: Project Configuration

**Determine intended core-setup mode:**

- New mode → `setup_mode = "greenfield"`
- Clone mode → `setup_mode = "mature"` (cloned repo may already have source code)

**AskUserQuestion (single-select):**

```yaml
header: "Setup wizard"
question: "Do you want to run the project setup wizard now? (stack, CLAUDE.md, design tokens)"
options:
  - label: "Yes, configure now (Recommended)"
    description: "Continue directly with /core-setup --mode={setup_mode}"
  - label: "No, later"
    description: "Write session marker — next /core-setup starts directly in {setup_mode} mode"
multiSelect: false
```

**If "Yes, configure now":** invoke `/core-setup --mode={setup_mode}`. No marker needed — flow is sequential.

**If "No, later":** write marker so the next `/core-setup` run skips detection:

```bash
mkdir -p .project/session
cat > ".project/session/setup-pending.json" << ENDJSON
{
  "source": "project-add",
  "mode": "{setup_mode}",
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
ENDJSON
```

Show: `Setup later: run /core-setup in a new session — the wizard starts directly in {setup_mode} mode.`

### PHASE 8: GitHub Publish

#### New mode:

If `GH_AVAILABLE=false`: skip this phase. Show: `GitHub publish skipped — gh not authenticated.` Go to PHASE 9.

```yaml
question: "Do you want to publish the repo to GitHub?"
header: "Publish"
options:
  - label: "Yes, create private repo (Recommended)"
    description: "Publish as private GitHub repository"
  - label: "Yes, create public repo"
    description: "Publish as public GitHub repository"
  - label: "No, later"
    description: "Skip, publish manually later"
multiSelect: false
```

**If publish desired:**

1. Stage all files and create initial commit:

```bash
cd {projects_root}/[name]
git add -A
git commit -m "feat: initial commit - [name]"
```

2. **Ask short description** (optional — free text):

Show: `Short GitHub description (optional, Enter to skip):`
Read user input → store as `REPO_DESC` (can be empty).

3. Create GitHub repo and push:

```bash
# Build description argument as bash array (empty = no flag)
if [ -n "$REPO_DESC" ]; then
  DESC_FLAG=(--description "$REPO_DESC")
else
  DESC_FLAG=()
fi

# Private repo
gh repo create [name] --private --source=. --push "${DESC_FLAG[@]}"

# OR public repo
gh repo create [name] --public --source=. --push "${DESC_FLAG[@]}"
```

4. Show repo URL after successful publish

**Requirements for publish:**

- `gh` CLI installed and authenticated
- Check with `gh auth status` before starting

#### Clone mode:

→ Skip (repo is already on GitHub)

Show: `GitHub: [repo URL]`

### PHASE 9: Shell Alias

**Ask:**

```yaml
question: "Do you want to create a shell alias to quickly open this project?"
header: "Alias"
options:
  - label: "Yes, create alias (Recommended)"
    description: "Add alias to ~/.bashrc that runs cd + claude"
  - label: "No, skip"
    description: "Don't create alias"
multiSelect: false
```

**If alias desired:**

Suggest a short alias based on the project name (first letters, abbreviation, or initials). Let the user confirm or change it.

```yaml
question: "Which alias do you want to use?"
header: "Alias"
options:
  - label: "[suggestion] (Recommended)"
    description: "alias [suggestion]='cd {projects_root}/[name] && claude'"
  - label: "Different name"
    description: "Type your own alias name"
multiSelect: false
```

**Validation:**

- Alias must not already exist in the target rc-file
- Lowercase letters only, max 4 characters (short and fast)

**Add:**

Detect shell and choose rc-file:

```bash
case "$SHELL" in
  */zsh)  RC_FILE="$HOME/.zshrc" ;;
  */bash) RC_FILE="$HOME/.bashrc" ;;
  */fish) RC_FILE="$HOME/.config/fish/config.fish" ;;
  *)      RC_FILE="$HOME/.profile" ;;
esac

echo "alias [alias]='cd {projects_root}/[name] && claude'" >> "$RC_FILE"
```

**Confirm:**

```
Alias created: [alias] → cd {projects_root}/[name] && claude
Added to: $RC_FILE
Use: source $RC_FILE (or open new terminal) to activate
```

### PHASE 10: Wrap Up

**Ask:**

```yaml
question: "Project added. What do you want to do?"
header: "Open"
options:
  - label: "Open in VS Code (Recommended)"
    description: "Open project in VS Code window"
  - label: "Stay here"
    description: "Stay in current project"
multiSelect: false
```

**If VS Code:**

```bash
code {projects_root}/[name]
```

**Output (new mode):**

```
✅ Project [name] created

Structure:
{projects_root}/[name]/
├── .claude/
│   ├── docs/
│   ├── research/
│   └── CLAUDE.md (or yet to configure)
├── .project/
└── .gitignore

Alias: [alias] → cd {projects_root}/[name] && claude (if created)
GitHub: https://github.com/[user]/[name] (if published)
```

**Output (clone mode):**

```
✅ Project [name] cloned and configured

Source: https://github.com/[owner]/[repo]

Structure:
{projects_root}/[name]/
├── .claude/
│   ├── docs/
│   ├── research/
│   └── CLAUDE.md (or yet to configure)
├── .project/
├── .gitignore (updated with claude entries)
└── [existing repo files]

Alias: [alias] → cd {projects_root}/[name] && claude (if created)
GitHub: https://github.com/[owner]/[repo]
```

## Configuration

Paths are configurable per device. Defaults are platform-dependent:

| Placeholder       | macOS Default         | Windows Default             | Environment Variable   |
| ----------------- | --------------------- | --------------------------- | ---------------------- |
| `{projects_root}` | `$HOME/projects`      | `C:\Projects`               | `CLAUDE_PROJECTS_ROOT` |
| `{config_repo}`   | `$HOME/claude-config` | `C:\Projects\claude-config` | `CLAUDE_CONFIG_REPO`   |

**Resolution order (first match wins):**

1. Environment variable
2. `.claude/paths.local.yaml` (local per project, not in git)
3. `resources/paths.yaml` (shared defaults, platform section)

## Restrictions

- Supported on macOS (symlinks) and Windows (junctions)
- Project name must be unique in `{projects_root}`
- Master config must exist in `{config_repo}`
- Clone mode requires `gh` CLI authenticated
- GitHub publish requires `gh` CLI authenticated
