# Route: Create (First-Time Setup)

Guided 4-step creation flow.

#### Step 1: Project context

Check for concept:

Read `SEED_CONTEXT` per `shared/SEED.md` Reader.

**If `SEED_CONTEXT.present`:**

```
PROJECT CONTEXT
════════════════════════════════════════════════
Name:    {SEED_CONTEXT.name}
Concept: {SEED_CONTEXT.markdown — first 200 chars}
════════════════════════════════════════════════
```

```yaml
header: "Context"
question: "Is this context still correct?"
options:
  - label: "Yes, continue (Recommended)", description: "Context is correct"
  - label: "I'll update it", description: "Describe the context again"
multiSelect: false
```

**If no concept:**

```yaml
header: "Context"
question: "Briefly describe what you're building and for whom."
options:
  - label: "I'll type it out", description: "Free description"
multiSelect: false
```

Store context for generating relevant page suggestions.

#### Step 2: Define pages

```yaml
header: "Pages"
question: "Which pages does your app need? Describe name + purpose per page."
options:
  - label: "I'll type them out (Recommended)", description: "Describe each page freely"
  - label: "Standard set", description: "Home, Dashboard, Settings, Login/Register"
  - label: "Later", description: "Skip pages, add later"
multiSelect: false
```

**If "Standard set":** Generate 4 default pages with generic purposes based on project context. Present for confirmation.

**If "I'll type them out":** User provides free-text list. Parse into structured page objects:

For EACH page, generate:

- `name`: slug-case (e.g., "dashboard", "user-settings")
- `purpose`: 1-2 sentences derived from user description
- `status`: `DEF`
- `sections`: derived from purpose (e.g., dashboard → "metrics-grid", "activity-feed")
- `flows`: initially empty (filled after flow definition)
- `notes`: empty

Show summary table:

```
PAGES
════════════════════════════════════════════════
| Name      | Purpose                       | Sections                     | Status |
|-----------|-------------------------------|------------------------------|--------|
| dashboard | Overview with metrics         | hero, metrics-grid, feed     | DEF    |
| settings  | Account settings              | profile-form, notifications  | DEF    |
════════════════════════════════════════════════
```

```yaml
header: "Pages"
question: "Are these pages correct?"
options:
  - label: "Yes, continue (Recommended)", description: "Go to flows"
  - label: "Edit", description: "I want to change something"
multiSelect: false
```

If "Edit": ask what to change, update, re-confirm.

#### Step 3: User Flows

```yaml
header: "Flows"
question: "Which user flows are important? (e.g. onboarding, checkout, account setup)"
options:
  - label: "I'll type them out (Recommended)", description: "Describe each flow with steps"
  - label: "Derive from pages", description: "Generate flows based on defined pages"
  - label: "Later", description: "Skip flows, add later"
multiSelect: false
```

**If "Derive from pages":** Analyze defined pages and generate logical flows:

- Login-flow if login page exists
- Navigation flows between related pages
- CRUD flows if form pages exist

Present for confirmation.

**If "I'll type them out":** User provides descriptions. Parse into structured flow objects:

- `name`: descriptive name
- `steps`: array of page names as flow steps
- `notes`: empty

**Cross-reference:** For each step in a flow, check if the page exists in the defined pages. If not:

```
⚠ Flow "{flow}" references page "{page}" which has not been defined yet.
```

Offer to add missing pages.

Show summary:

```
FLOWS
════════════════════════════════════════════════
| Name        | Steps                                      |
|-------------|--------------------------------------------|
| onboarding  | landing → signup → verify → dashboard      |
| settings    | dashboard → settings → save → dashboard    |
════════════════════════════════════════════════
```

#### Step 4: Design Principles

```yaml
header: "Principles"
question: "Which design principles apply?"
options:
  - label: "Standard set (Recommended)", description: "Mobile-first, Consistent spacing, Accessibility (WCAG AA)"
  - label: "I'll define my own", description: "Enter custom principles"
  - label: "Later", description: "Skip principles, add later"
multiSelect: false
```

**If "Standard set":** Generate:

- Mobile-first: "Design for mobile viewport first, with progressive enhancement"
- Consistent spacing: "Use a spacing scale for all margins and padding"
- Accessibility: "WCAG 2.1 AA compliance, semantic HTML, keyboard navigation"

**If "I'll define my own":** Free-text input, parse into `{ name, description }` objects.

#### Step 5: Summary

Show complete summary:

```
DESIGN SPEC SUMMARY
════════════════════════════════════════════════

Pages ({N}):
| Name      | Purpose                 | Sections                 | Status |
|-----------|-------------------------|--------------------------|--------|
| dashboard | Overview with metrics   | hero, metrics-grid, feed | DEF    |
| settings  | Account settings        | profile-form, notifs     | DEF    |

Flows ({M}):
| Name       | Steps                                   |
|------------|-----------------------------------------|
| onboarding | landing → signup → verify → dashboard   |

Principles ({P}):
| Name          | Description                                      |
|---------------|--------------------------------------------------|
| Mobile-first  | Design for mobile viewport first                 |
| Accessibility | WCAG 2.1 AA compliance, semantic HTML            |

════════════════════════════════════════════════
```

Proceed to PHASE 3 (Confirm).
