# Route: Component (Add/Edit)

> **Plan mode**: the caller (route-design.md PHASE 1.5) enters plan mode for this route. The interview runs in plan mode; defer all writes to PHASE 3 confirm. The post-confirm Append + gap-discovery block (under "On confirmation:") is already correctly positioned after approval, so it runs outside plan mode as-is.

#### Step 1: Choice

```yaml
header: "Component"
question: "What do you want to do?"
options:
  - label: "Add new component (Recommended)", description: "Add a component to the design spec"
  - label: "Edit existing", description: "Edit an existing component"
multiSelect: false
```

#### If "Add new component":

```yaml
header: "New Component"
question: "Describe the component: name, purpose, and which variants/states it has."
options:
  - label: "I'll type it out", description: "Free description"
multiSelect: false
```

Parse description and ask additionally:

```yaml
header: "Component details"
question: "What type of component is this?"
options:
  - label: "Atomic (Recommended)", description: "Small reusable element — Button, Input, Avatar"
  - label: "Section", description: "Composite within a single page — StatCard, ProductCard"
  - label: "Layout", description: "Multi-page wrapper — NavBar, Footer, Sidebar"
multiSelect: false
```

If `scope: layout`: additionally set `appliesTo`:

```yaml
header: "Scope"
question: "Which pages does this apply to?"
options:
  - label: "All pages (Recommended)", description: "Every page — adds to root layout"
  - label: "Specific pages", description: "Select which pages"
  - label: "Route group", description: "E.g. all authenticated pages"
multiSelect: false
```

Generate component object:

```json
{
  "name": "{slug}",
  "purpose": "{derived from description}",
  "status": "DEF",
  "scope": "{atomic|section|layout}",
  "appliesTo": "{all | [page-names] | route-group:name}",
  "variants": [],
  "sizes": [],
  "states": ["default"],
  "props": [],
  "slots": [],
  "usedIn": [],
  "notes": ""
}
```

Show preview table:

```
COMPONENT
════════════════════════════════════════════════
| Name    | Purpose                | Scope   | Variants          | Status |
|---------|------------------------|---------|-------------------|--------|
| button  | Primary action trigger | atomic  | primary/ghost/... | DEF    |
════════════════════════════════════════════════
```

Proceed to PHASE 3 (Confirm).

On confirmation:

1. Append to `project.json#design.components[]`
2. Append to `.project/backlog.json` as COMPONENT feature with `status: TODO`, `phase: P3`, `source: "/frontend-design"`, `scope: {scope}`
3. Update `data.updated`
4. **Gap-discovery** — follow [Discovery — Gap-Discovery](../../shared/SKILL-PATTERNS.md#gap-discovery), Trigger A: scan `props[]` for handler patterns and show AskUserQuestion per found gap.

#### If "Edit existing":

Show existing components as options:

```yaml
header: "Edit"
question: "Which component do you want to edit?"
options:
  - label: "{component1.name}", description: "{component1.purpose} ({component1.status}) — {scope}"
  - label: "{component2.name}", description: "..."
  # max 4, rest via Other
multiSelect: false
```

Then:

```yaml
header: "Edit: {component-name}"
question: "What do you want to update?"
options:
  - label: "Purpose", description: "Current: {purpose}"
  - label: "Variants/Sizes/States", description: "Current: {variants joined}"
  - label: "Props/Slots", description: "Current: {props joined}"
  - label: "Status", description: "Current: {status}"
  - label: "Scope / appliesTo", description: "Current: {scope}"
  - label: "Notes", description: "Current: {notes or 'empty'}"
multiSelect: true
```

Process updates, proceed to PHASE 3 (Confirm).
