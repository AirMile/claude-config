# Page-Discovery

**Goal:** Establish which screens the app has and which features appear on each screen. Produces PAGE tasks with `dependencies[]` that drive `/frontend-design` Build composition.

**Skip in GAME MODE and WEB-MOBILE mode** (React Native: screens are FEATURE-typed and
`/frontend-design` is browser-only). Run after Feature Review in WEB MODE.

---

## Step 1: Heuristic — propose pages from features

Analyse the confirmed feature list. Group features by their likely screen:

- Auth screens: features involving login, signup, password-reset, email-verify
- Dashboard / overview: features involving metrics, overview, home, feed
- Detail views: features involving a single entity (product, user, order, post)
- List / index views: features involving browse, search, filter, catalogue
- Settings / profile: features involving user preferences, account, billing
- Admin / management: features involving moderation, management, CRUD interfaces
- Onboarding / wizard: multi-step flow features

**One feature can appear on multiple pages** (e.g. `search-bar` on dashboard + catalogue).

Produce a proposed page list:

```
PROPOSED PAGES

| # | Page name (kebab) | Route hint | Features that belong here |
|---|-------------------|------------|---------------------------|
| 1 | {name}            | /{route}   | {feature-1}, {feature-2}  |
| 2 | {name}            | /{route}   | {feature-3}               |
...
```

Show features that were already extracted as `type: PAGE` separately: "These features are already PAGE-typed and will be kept as-is: {list}."

---

## Step 2: Confirmation + adjustment

```yaml
header: "Pages"
question: "These are the proposed screens. Correct?"
options:
  - label: "Yes, this is correct (Recommended)"
    description: "Add these PAGEs with the listed feature-dependencies"
  - label: "Adjust pages"
    description: "Add, remove, rename, or change feature assignments"
  - label: "Skip — I'll manage pages later"
    description: "No PAGE tasks created now; pages can be added via /project-todo or /frontend-design"
multiSelect: false
```

**"Yes, this is correct"** → proceed to Step 3.

**"Adjust pages"** → AskUserQuestion (free text): "What should change?" — parse, update the table, re-show, re-ask. Loop until confirmed.

**"Skip"** → do not create PAGE tasks. Proceed to PHASE 2. Show: `Pages: skipped — add via /project-todo or /frontend-design when ready.`

---

## Step 3: Write PAGE tasks

For each confirmed page (that is not already a PAGE-typed feature in the list):

1. Run dedup order (`shared/BACKLOG.md § Writing the backlog`).
2. Add to the in-memory feature list:

   ```json
   {
     "name": "{kebab-page-name}",
     "type": "PAGE",
     "status": "TODO",
     "phase": "P2",
     "description": "Screen: {route hint}. Contains: {feature names}.",
     "source": "/project-backlog",
     "dependencies": ["{feature-name-1}", "{feature-name-2}"]
   }
   ```

3. Also write `pageHint` back to each listed feature in the in-memory list:
   - For each feature assigned to this page: add `{kebab-page-name}` to that feature's `pageHint[]` array (create array if missing).

This in-memory list (including PAGE tasks + updated `pageHint` fields) is the input to PHASE 2 (dependencies) and PHASE 4 (backlog write). No separate write here — PHASE 4 writes everything at once.

---

## Output

```
PAGES CONFIRMED

| Page | Route | Feature-deps |
|------|-------|--------------|
| {name} | /{route} | {N} features |
...

{N} PAGE tasks added. Feature pageHint fields updated.
```
