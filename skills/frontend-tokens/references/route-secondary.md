# Routes: Update, Extract from code, Modes, Delete

## Route: Update

**AskUserQuestion:**

```yaml
header: "Update"
question: "Which section would you like to update?"
options:
  - label: "Colors", description: "Adjust colors"
  - label: "Typography", description: "Adjust fonts"
  - label: "Spacing", description: "Adjust spacing scale"
  - label: "Breakpoints", description: "Adjust breakpoints"
  - label: "Motion", description: "Adjust durations and easings"
  - label: "Interactions", description: "Adjust focus ring, hover, active states"
  - label: "All", description: "Full reconfiguration"
multiSelect: true
```

**Per selected section:**

- Read current values from `project.json` → `theme` section
- Show current values
- Ask for new values (same flow as Create)
- Show diff preview
- **Drift check** (see "Token Drift Check" above) for colors/typography/spacing changes
- Confirm change
- Read project.json → update only changed theme subsections → Write back
- → Go to PHASE X: Post-flight Validation
- → Go to X.6: Theme Infrastructure Sync (update CSS variables / Tailwind config with changed tokens)
- → Go to PHASE Y: Website Sync (scan for stale token values in components)

---

## Route: Extract from code

Scope: reads `tailwind.config.{js,ts,mjs}` and CSS files with `:root` vars — not external brand docs. For PDFs/images/URLs use `route-styleguide.md`.

**Step 1: Detection**

```bash
# Find configuration files
# - tailwind.config.js/ts/mjs
# - CSS files with :root variables
# - globals.css, variables.css, etc.
```

**Output:**

```
DETECTION RESULT

| Source | Status | Tokens |
|--------|--------|--------|
| tailwind.config.js | ✓ Found | ~{N} colors, spacing |
| src/styles/globals.css | ✓ Found | ~{N} CSS variables |
| src/index.css | ✗ No tokens | - |
```

**AskUserQuestion:**

```yaml
header: "Extract from code"
question: "Which sources to extract from?"
options:
  - label: "All sources (Recommended)", description: "Combine all found tokens"
  - label: "Tailwind only", description: "Only from tailwind config"
  - label: "CSS only", description: "Only :root variables"
multiSelect: false
```

**Step 2: Perform extraction**

1. Parse selected sources
2. Map to theme JSON structure (see schema above)
3. Show preview of extracted tokens
4. **Drift check** (see "Token Drift Check" above) — if extraction overwrites existing `colors`/`typography`/`spacing` keys
5. Ask for confirmation (same as Create Step 6)
6. Write to project.json theme section
7. → Go to PHASE X: Post-flight Validation
8. → Go to X.6: Theme Infrastructure Sync
9. → Go to PHASE Y: Website Sync

---

## Route: Modes (Dark/Light)

**AskUserQuestion:**

```yaml
header: "Modes"
question: "Theme mode action?"
options:
  - label: "Add dark mode (Recommended)", description: "Add dark variant to current theme"
  - label: "Add light mode", description: "Add light variant"
  - label: "Remove mode", description: "Remove an existing mode"
  - label: "Switch mode", description: "Toggle default mode"
  - label: "Explain question", description: "Explain how modes work"
multiSelect: false
```

**If "Add dark mode":**

**AskUserQuestion:**

```yaml
header: "Dark Mode"
question: "How to generate dark mode colors?"
options:
  - label: "Auto-generate (Recommended)", description: "Automatically invert/adjust"
  - label: "Manual", description: "Specify dark colors yourself"
  - label: "Extract", description: "Pull from existing dark theme CSS"
  - label: "Explain question", description: "Tips for dark mode colors"
multiSelect: false
```

**If "Auto-generate":**

- Read current colors from project.json → theme.colors
- Generate dark variants of current colors
- Show preview
- Ask for confirmation
- Update project.json → theme.modes with dark key
- → Go to PHASE X: Post-flight Validation
- → Go to X.6: Theme Infrastructure Sync

**Mode diff preview (inline table):**

```
MODE DIFFERENCES
────────────────────────────────
Background:  oklch(light-L ...) ↔ oklch(dark-L ...)
Foreground:  oklch(light-L ...) ↔ oklch(dark-L ...)
Primary:     oklch(light-L ...) ↔ oklch(dark-L ...)
Accent:      oklch(light-L ...) ↔ oklch(dark-L ...)
```

**AskUserQuestion:**

```yaml
header: "Mode Preview"
question: "Satisfied with the light/dark mode differences?"
options:
  - label: "Yes, save (Recommended)", description: "Confirm mode configuration"
  - label: "Adjust", description: "Modify colors"
```

---

## Route: Delete

**AskUserQuestion:**

```yaml
header: "Delete"
question: "Are you sure you want to delete the theme?"
options:
  - label: "Yes, delete", description: "Remove theme section from project.json"
  - label: "Cancel (Recommended)", description: "Keep current theme"
multiSelect: false
```

**If "Yes":**

1. Read project.json
2. Remove `theme` key
3. Write back
4. → Go to Output Format (show "THEME REMOVED")
