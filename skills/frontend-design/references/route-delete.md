# Route: Delete (Delete Item)

Load this file when the user selects the Delete route. Contains the full deletion flow with cross-reference check.

---

```yaml
header: "Delete"
question: "What do you want to delete?"
options:
  - label: "Page", description: "A page from the design spec"
  - label: "Component", description: "A component from the design spec"
  - label: "Flow", description: "A user flow"
  - label: "Principle", description: "A design principle"
multiSelect: false
```

Show items of selected type as options. After selection, confirm with safety pattern:

```yaml
header: "Confirm Deletion"
question: "Are you sure you want to delete '{item-name}'?"
options:
  - label: "No, cancel (Recommended)", description: "Keep item"
  - label: "Yes, remove", description: "Permanently remove"
multiSelect: false
```

**Cross-reference check:** When deleting a page, check if it's referenced in any flows. If so, warn:

```
⚠ Page "{page}" is used in flow(s): {flow-names}.
  These flow steps will be orphaned.
```

Proceed to PHASE 3 (Confirm).
