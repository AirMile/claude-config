# Route: Page (Add/Edit Page)

> **Plan mode**: the caller (route-design.md PHASE 1.5) enters plan mode for this route. The interview runs in plan mode; defer all writes to PHASE 3 confirm (this route is already write-clean — both branches end at "proceed to PHASE 3").

Load this file when the user selects the Page route. Contains the full add/edit flow.

---

## Step 1: Choice

```yaml
header: "Page"
question: "What do you want to do?"
options:
  - label: "Add new page (Recommended)", description: "Add a page to the design spec"
  - label: "Edit existing", description: "Edit an existing page"
multiSelect: false
```

## If "Add new page"

```yaml
header: "New Page"
question: "Describe the page: name, purpose, and which sections/content it needs."
options:
  - label: "I'll type it out", description: "Free description"
multiSelect: false
```

Parse description into structured page object. Show preview, proceed to PHASE 3 (Confirm).

## If "Edit existing"

Show existing pages as options (dynamically generated):

```yaml
header: "Edit"
question: "Which page do you want to edit?"
options:
  - label: "{page1.name}", description: "{page1.purpose} ({page1.status}) — {N} sections"
  - label: "{page2.name}", description: "{page2.purpose} ({page2.status}) — {N} sections"
  # ... max 4 options, rest via "Other"
multiSelect: false
```

Then ask what to change:

```yaml
header: "Edit: {page-name}"
question: "What do you want to update?"
options:
  - label: "Purpose", description: "Current: {purpose}"
  - label: "Sections", description: "Current: {sections joined}"
  - label: "Status", description: "Current: {status}"
  - label: "Notes", description: "Current: {notes or 'empty'}"
multiSelect: true
```

Process updates, proceed to PHASE 3 (Confirm).
