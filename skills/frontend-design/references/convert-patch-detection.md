# 0.4b Patch Detection

#### Step 1: Component location

If the component path is not already known (e.g. via argument or file selection in VSCode):

```yaml
header: "Component"
question: "Which file do you want to update?"
options:
  - label: "I'll type the path", description: "Relative or absolute path to the .tsx/.jsx file"
multiSelect: false
```

Read the file via Read tool. If the file does not exist: stop with message and fall back to scope "Single component".

#### Step 2: Before-screenshot

Render the current component via Playwright (if dev server is available):

```
playwright-cli goto http://localhost:[port]/[page with this component]
playwright-cli run-code "async page => { await page.waitForTimeout(2000); }"
playwright-cli screenshot --filename=.project/tmp/patch-before.png
```

If Playwright is not available: skip before-screenshot and go directly to step 3 without visual diff.

#### Step 3: Visual diff

Compare `$SOURCE_IMAGE` (new) with `.project/tmp/patch-before.png` (current):

```
PATCH ANALYSIS
════════════════════════════════════════════════════════════
Changed:
  [Section/element that changed visually — description]
  [Section/element 2 — if applicable]

Unchanged:
  [Sections that are identical — will not be touched]
════════════════════════════════════════════════════════════
```

#### Step 4: Confirm

```yaml
header: "Patch Scope"
question: "Is this analysis of what changed correct?"
options:
  - label: "Yes, continue (Recommended)", description: "Patch only the changed sections"
  - label: "Adjust", description: "I want to change the scope"
  - label: "Full rewrite instead", description: "Fall back to normal generation"
multiSelect: false
```

Store as `$PATCH_SECTIONS`. If "Full rewrite instead": restore scope to "Single component"; if `$MODE` is unset (patch fast-path skipped mode selection), run PHASE 0.2–0.3 first (visual analysis + mode selection, which loads the mode file), then continue with normal PHASE 0.5.

> **Todo**: If `$SCOPE` = patch (handoff fast-path or in-flow scope selection), use the `ExitPlanMode` tool now if plan mode is active — present PATCH ANALYSIS as plan output. PHASE 2 Patch Guard (Edits) runs in Sonnet. The mode file's PHASE 1 is skipped for patch scope — this is the only plan-mode exit on patch paths.
