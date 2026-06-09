# Route: new

Creates an empty canvas for a project screen.

## Arguments

```
/frontend-sketch new <slug> [--page <pagename>]
```

- `slug` — kebab-case identifier, e.g. `login-v1`, `dashboard-mobile`
- `--page` — optional reference to an existing `design.pages[].name`

## Steps

### 1. Resolve paths

```bash
PROJECT_DIR="$(basename "$PWD")"
CANVAS_DIR=".project/canvas"
CANVAS_FILE="$CANVAS_DIR/${slug}.excalidraw"
INDEX_FILE="$CANVAS_DIR/index.json"
TEMPLATE="~/.claude/skills/frontend-sketch/templates/canvas-template.html"
```

### 2. Guard: canvas already exists?

If `$CANVAS_FILE` already exists → ask:

- "Open existing canvas (Recommended)" — jump to Open route, print URL
- "Overwrite" — proceed

### 3. Create canvas directory

```bash
mkdir -p "$CANVAS_DIR"
```

### 4. Write empty Excalidraw scene

Write `$CANVAS_FILE` with this minimal valid JSON:

```json
{
  "type": "excalidraw",
  "version": 2,
  "source": "frontend-sketch",
  "elements": [],
  "appState": {
    "viewBackgroundColor": "#ffffff",
    "gridSize": 20,
    "theme": "light"
  },
  "files": {}
}
```

### 5. Update canvas index

Read `$INDEX_FILE` (or `[]` if missing). Append entry (or update if slug already present):

```json
{
  "slug": "<slug>",
  "pageRef": "<pagename or null>",
  "frames": [],
  "mtime": "<ISO timestamp>"
}
```

Write back as `JSON.stringify(index, null, 2)`.

### 6. Update project.json

Read `.project/project.json`. Ensure `design.canvases` array exists. Merge on `name`:

```json
{
  "name": "<slug>",
  "pageRef": "<pagename or null>",
  "frames": [],
  "mtime": "<ISO timestamp>"
}
```

Merge strategy: MERGE on `name`, never auto-delete (same as `design.pages`).

Write project.json back.

### 7. Print result

```
Canvas created: .project/canvas/{slug}.excalidraw
URL:            http://localhost:9876/{project}/canvas/{slug}

Tip: /frontend-sketch generate {slug} "3 versions of the login screen"
```
