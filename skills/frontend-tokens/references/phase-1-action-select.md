# PHASE 1: Action Selection

**First check if project.json has a populated theme section:**

```bash
# Read .project/project.json → parse JSON → check theme section
```

**Design Principles Context (optional):**

Check `.project/project.json` → `design.principles`. If principles exist, show them as context before action selection:

```
DESIGN PRINCIPLES AVAILABLE
════════════════════════════════════════════════════════════════
- {principle.name}: {principle.description}
- {principle.name}: {principle.description}
════════════════════════════════════════════════════════════════

These principles are taken into account as suggestions for token choices.
```

Principles are advisory — use them to inform suggestions (e.g., if "Mobile-first" exists, suggest mobile-optimized breakpoints), but don't enforce.

**If theme section contains DATA (not empty):**

**Completeness check — run before the action menu is shown:**

Check which of the 10 expected sections are present in `theme`. A section counts as "present" if the key exists AND is not an empty object `{}`, empty array `[]`, or empty string `""`.

```
THEME STATUS
════════════════════════════════════════════════
  [✓|✗] colors
  [✓|✗] typography
  [✓|✗] spacing
  [✓|✗] breakpoints
  [✓|✗] borderRadius
  [✓|✗] shadows
  [✓|✗] motion (durations + easings — base layer only)
  [✓|✗] interactions
  [✓|✗] modes
  [✓|✗] cssVars

Complete: {N}/10 sections
Motion pack: {pack-name — "none" if motion.pack absent or ""}
════════════════════════════════════════════════
```

**If all sections present (N = 10) AND motion.pack is absent/empty:**

**AskUserQuestion:**

```yaml
header: "Theme"
question: "What would you like to do?"
options:
  - label: "Motion Pack (Recommended)", description: "Add animation pack — spring physics, choreography, glass surfaces"
  - label: "Update", description: "Modify existing tokens"
  - label: "View", description: "Show current design tokens"
  - label: "Other…", description: "Modes / Delete"
multiSelect: false
```

**If all sections present (N = 10) AND motion.pack is set:**

**AskUserQuestion:**

```yaml
header: "Theme"
question: "What would you like to do?"
options:
  - label: "Motion Pack", description: "Manage animation pack — current: {pack-name}"
  - label: "Update", description: "Modify existing tokens"
  - label: "View", description: "Show current design tokens + motion pack"
  - label: "Other…", description: "Modes / Delete"
multiSelect: false
```

If "Other…" is selected, follow up with:

```yaml
header: "Other"
question: "Which action?"
options:
  - label: "Modes", description: "Manage dark/light mode"
  - label: "Delete", description: "Remove theme data"
multiSelect: false
```

**If sections are missing (N < 10):**

**AskUserQuestion:**

```yaml
header: "Theme"
question: "What would you like to do? (⚠ {10-N} sections missing: {missing_list})"
options:
  - label: "Fill in (Recommended)", description: "Add missing sections: {missing_list}"
  - label: "Extract from styleguide", description: "Pull missing tokens from a brand PDF, image, or URL"
  - label: "Motion Pack", description: "Add/update animation pack — spring physics, glass surfaces"
  - label: "View", description: "Show current design tokens"
multiSelect: false
```

**When "Motion Pack" is selected (any case above):**

Check `theme.motion.pack`:

- **Pack absent** → go directly to `MOTION_CREATE` (> **Todo**: Read `motion/route-create.md`)
- **Pack present** → show motion sub-menu:

```yaml
header: "Motion Pack"
question: "Current pack: {pack-name}. What would you like to do?"
options:
  - label: "Customize", description: "Configure axes: expressiveness, springiness, tempo, surfaces"
  - label: "Preview", description: "Generate animation-preview.html with current tokens"
  - label: "Apply to codebase", description: "Emit CSS vars for spring/easing/surface tokens"
  - label: "Replace / Delete", description: "Pick a different pack or remove the pack"
multiSelect: false
```

**If theme section is EMPTY or project.json does not exist:**

**AskUserQuestion:**

```yaml
header: "Theme"
question: "No theme found. What would you like to do?"
options:
  - label: "Extract from styleguide (Recommended if you have a brand doc)", description: "Extract tokens from a brand PDF, image, or URL"
  - label: "Create", description: "New theme with guided setup (start from scratch)"
  - label: "Extract from code", description: "Retrieve tokens from existing tailwind.config + CSS :root vars"
  - label: "Explain options", description: "Explain the difference between these approaches"
multiSelect: false
```
