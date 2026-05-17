# Route: View

1. Read `.project/project.json` → parse `theme` section
2. Parse and display in a clear table:

```
CURRENT THEME

## Colors
| Token | Value | Preview |
|-------|-------|---------|
| primary-500 | #3B82F6 | |
| secondary-500 | #10B981 | |
| ... | ... | ... |

## Typography
| Element | Font |
|---------|------|
| Headings | Inter |
| Body | system-ui |

## Spacing
| Token | Value |
|-------|-------|
| spacing-1 | 4px |
| spacing-2 | 8px |
| ... | ... |

## Breakpoints
| Name | Value |
|------|-------|
| sm | 640px |
| md | 768px |
| ... | ... |
```

3. **Completeness check:** check all 10 expected sections (colors, typography, spacing, breakpoints, borderRadius, shadows, motion, interactions, modes, cssVars). If sections are missing:

```
⚠ MISSING SECTIONS: {missing_list}
  Use "Fill in" to add missing sections.
```

**AskUserQuestion:**

If all sections present:

```yaml
header: "Action"
question: "What would you like to do?"
options:
  - label: "Done", description: "Return to conversation"
  - label: "Update", description: "Make changes"
  - label: "Export", description: "Show as CSS variables"
multiSelect: false
```

If sections are missing — add "Fill in":

```yaml
header: "Action"
question: "What would you like to do? (⚠ {N} sections missing)"
options:
  - label: "Fill in (Recommended)", description: "Add missing sections: {missing_list}"
  - label: "Done", description: "Return to conversation"
  - label: "Update", description: "Make changes"
  - label: "Export", description: "Show as CSS variables"
multiSelect: false
```
