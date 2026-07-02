# PHASE 0: Input Detection

**Goal:** Auto-detect concept and existing backlog, determine action.

**Process:**

1. **Check if .project folder exists:**
   - If `.project/` folder does NOT exist → go directly to Scenario D (ask for input)
   - If `.project/` folder exists → continue to step 2

2. **Check for existing files (only if .project exists):**
   - Read `SEED_CONTEXT` per `shared/SEED.md` Reader. Concept present as `SEED_CONTEXT.present`.
   - Check if `.project/backlog.json` exists

3. **Scenario A: Both concept AND backlog exist**
   - Use `SEED_CONTEXT.markdown` as concept content
   - Read `backlog.json` → parse JSON
   - Analyze differences between concept and existing backlog
   - Check `data.features[]` in `backlog.json` to identify INDEPENDENT features: a feature is INDEPENDENT when its `source` field exists AND is not `"/project-plan"`. Features without a `source` field (or with `"/project-plan"`) are concept-derived and may be updated or proposed for cancellation by this run.
   - Compare `SEED_CONTEXT.markdown` against existing backlog features (semantic match by name/description)
   - Show comparison:

     ```
     EXISTING BACKLOG DETECTED

     Concept: .project/project-seed.md
     Backlog: .project/backlog.json
     New thinking outputs since last run: {n}

     Feature changes detected:
     - NEW: {list of features in concept but not in backlog}
     - MODIFIED: {list of features in both but with changed description/scope}
     - INDEPENDENT: {list of features in backlog added independently — not from concept}
     - OBSOLETE: {list of TODO/DEFINED features no longer supported by concept/thinking}
     - UNCHANGED: {count} features

     Protected features (not affected by update):
     - DOING: {list with current stage}
     - DONE: {list}
     ```

   - Use AskUserQuestion:
     ```yaml
     header: "Backlog Update"
     question: "A backlog already exists. What do you want to do?"
     options:
       - label: "Update backlog (Recommended)", description: "Add new features, keep DOING/DONE features and manual changes"
       - label: "New backlog", description: "Start fresh, ignore old backlog"
       - label: "Cancel", description: "Review differences first, do nothing"
     multiSelect: false
     ```
   - **If "Update backlog":**
     - **Merge rules by feature status:**
       - **DOING/DONE features** (protected): preserve status, stage, priority, date, and notes. Only enrich description if concept provides new insights — never overwrite.
       - **TODO features (modified)**: update description/scope from concept, preserve priority and notes
       - **New features**: add as TODO with auto-assigned priority (user reviews in PHASE 3)
       - **Obsolete TODO/DEFINED features**: handled by the cancel-proposal flow in `references/update-reconcile.md` (loaded in PHASE 1) — explicit user confirmation per cancellation, never silent
       - **INDEPENDENT features**: always preserve unchanged — these are not derived from concept. Never auto-cancelled; cancellable only via explicit per-item selection in the cancel-proposal flow.
     - Continue to PHASE 1 with update mode
   - **If "New backlog":**
     - Use concept as input, ignore existing backlog
     - Continue to PHASE 1 with create mode
   - **If "Cancel":**
     - Show detailed diff and exit

4. **Scenario B: Only concept exists (no backlog)**
   - Use `SEED_CONTEXT.markdown` as concept content (already read in step 2)
   - Show confirmation:

     ```
     CONCEPT DETECTED

     File: .project/project-seed.md
     Title: {extracted title}

     This concept will be used for the backlog.
     ```

   - Use AskUserQuestion:
     ```yaml
     header: "Load Concept"
     question: "Do you want to generate a backlog from this concept?"
     options:
       - label: "Yes, generate backlog (Recommended)", description: "Use project concept"
       - label: "Different concept", description: "I want to use a different concept"
     multiSelect: false
     ```
   - If "Yes": proceed with loaded concept to PHASE 1
   - If "Different concept": go to Scenario D

5. **Scenario C: Only backlog exists (no concept)** — show a one-line warning (`Backlog exists but no concept found — a concept is required; run /project-seed first or paste one now`) and continue as Scenario D (update-mode merge rules apply since the backlog exists).

6. **Scenario D: No .project folder OR neither file exists**
   - Ask user to paste concept:
     ```yaml
     header: "Input"
     question: "Paste the output of /project-seed or /project-brainstorm"
     options:
       - label: "I'll paste it below", description: "Type or paste your idea/brainstorm markdown"
       - label: "Load from file", description: "Load from an existing .md file"
     multiSelect: false
     ```

7. **If markdown provided inline (overrides auto-detection):**
   - Parse the provided markdown
   - Extract core concept and features
   - Continue to PHASE 1

8. **Validate input:**
   - Check for recognizable structure (title, sections)
   - If unclear, ask clarifying questions

**Output:**

```
INPUT LOADED

Source: [project.json concept | inline | custom file]
Mode: [CREATE | UPDATE]
Title: {extracted title}
Sections: {count}
```

**Research offer:**

Use AskUserQuestion:

```yaml
header: "Research"
question: "Do you want to do research before extracting features?"
options:
  - label: "No, extract directly (Recommended)"
    description: "Proceed to feature extraction"
  - label: "Yes, do research"
    description: "Analyze codebase, framework docs (Context7), and web examples for better feature extraction"
multiSelect: false
```

**Response handling:**

- "No" → skip to PHASE 1
- "Yes" → proceed to PHASE 0.5
