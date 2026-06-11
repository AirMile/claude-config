# Shared: PHASE 1 Parse Input

Used by `/project-brainstorm`, `/project-critique`, and `/project-seed`. The caller's Todo-marker specifies the **variant**:

- **brainstorm** — action = "brainstorm", confirm: 2 options, no applied-techniques check
- **critique** — action = "analyze", confirm: 3 options, includes applied-techniques check
- **seed** — partial: only the § PHASE 1a scope handlers (Feature/Page/Standalone) and § Chat Context flow apply; concept detection, scope question, and output paths are seed-specific and live in `project-seed/references/initial-intake.md`. Every "proceed" = proceed to project-seed PHASE 2 (Explore and Expand).

---

### Auto-detect concept file

1. Check if `.project/` folder exists
   - If folder does NOT exist → proceed to manual input (below)
2. Check if `.project/project-seed.md` exists (primary) or `.project/project.json` has non-empty `concept.content` (legacy fallback)
3. If exists AND has concept AND no inline input provided:
   - Read `.project/project-seed.md` for the full concept document. Extract title from first H1 heading.
   - Show confirmation:

     ```
     CONCEPT DETECTED

     Source: .project/project-seed.md
     Title: {concept title from H1}

     This concept will be used for {brainstorming | analysis}.
     ```

   - Use AskUserQuestion:
     ```yaml
     header: "Load Concept"
     question: "Do you want to {brainstorm on | analyze} this concept?"
     options:
       - label: "Yes, {brainstorm on | analyze} this (Recommended)", description: "Use concept from project.json"
       - label: "Different concept", description: "I want to paste a different concept"
     multiSelect: false
     ```
   - If "Yes": proceed with loaded concept
   - If "Different concept": ask user to paste input

### Accumulated drift (load after concept detection, concept-scope only)

If scope is or may become concept-scope: scan for deferred drift entries:

1. Glob `.project/features/*/feature.json` — collect all `seedDrift[]` entries where `resolved` is absent or falsy into `accumulatedDrift[]`.
2. If `.project/backlog.json` exists: parse `data.seedDrift[]` (see `shared/BACKLOG.md`) and append to `accumulatedDrift[]`.
3. Deduplicate by `detectedAt`.

If `accumulatedDrift[]` is non-empty, include a one-line note in the technique-selection summary:

```
ℹ Deferred drift: {N} item(s) from {sources} — will be reconciled if you save to concept.
```

Pass `accumulatedDrift[]` into the chosen technique's prompt context so generated output incorporates the known divergence.

### PHASE 1a: Scope Check

After concept detection, also check for broader scope:

1. Check if `.project/backlog.json` exists
2. Check if `.project/features/` contains folders
3. Glob for page files (`app/**/page.tsx`, `src/pages/**/*.tsx`)

If scope context found AND concept already loaded:

```yaml
header: "Scope"
question: "What do you want to {brainstorm about | analyze}?"
options:
  - label: "Concept (Recommended)", description: "Work with concept from project.json"
  - label: "Feature from backlog", description: "Focus on a specific feature"
  - label: "Page / UX flow", description: "Focus on layout, UX or user flow"
  - label: "Standalone idea", description: "Standalone idea, not linked to the project"
multiSelect: false
```

**If "Feature from backlog":**

- Read `.project/backlog.json`, parse as JSON (see `shared/BACKLOG.md`), show features with status TODO or DEF
- AskUserQuestion to choose feature
- Load `01-define.md` (if it exists) as input context
- Load existing `thinking.md` (if it exists) as previous thinking output
- No define? Use feature description from backlog

**If "Page / UX flow":**

- Glob for page files in the project
- AskUserQuestion to choose page, or let user describe a UX flow
- Load page file as input context
- Check `.project/thinking/{name}.md` for previous thinking output

**If "Standalone idea":**

- Ignore the loaded concept — this idea is independent of the project
- Ask: "Describe your idea in a few sentences"
- Check `.project/thinking/` for previous standalone ideas
- Proceed with user's input

**Output path follows scope automatically:**

- Scope = concept → write to `.project/project-seed.md` + update project.json metadata (name, pitch)
- Scope = feature → write to `.project/features/{name}/thinking.md`
- Scope = page/UX → write to `.project/thinking/{topic}.md`
- Scope = standalone idea → write to `.project/thinking/{topic}.md`

### PHASE 1b: Manual input fallback

If the user provided an inline description/argument, use it directly as the starting idea.

Otherwise, ask:

```yaml
header: "Input"
question: "What do you want to {brainstorm about | analyze}?"
options:
  - label: "Use chat context (Recommended)", description: "Use what has been discussed in this conversation"
  - label: "Paste concept", description: "Paste or type an idea/concept"
multiSelect: false
```

- If "Use chat context": process using Chat Context flow (see below)
- If "Paste concept": proceed to manual input below

**If no concept file OR user wants different input:**

1. Examine the input provided by user
2. Determine input type:
   - Output from `/project-seed` (structured markdown) → extract directly
   - Concept document (PRD, design doc, project brief) → extract core idea
   - Raw idea description → use as-is
   - Unclear/vague input → ask clarifying questions

3. **[Critique-only]** Check for previously applied techniques:
   - Look for YAML frontmatter at the start of the input
   - If `applied_techniques:` found, extract the list — store to filter in PHASES 3 and 6
   - Example frontmatter:
     ```yaml
     ---
     applied_techniques:
       - Devil's Advocate Analysis
       - Assumption Testing
     ---
     ```
   - If no frontmatter found: start with empty list

4. Analyze:
   - What is the core idea?
   - What type of idea is this? (creative concept, product, service, etc)
   - Is there enough information to start?
   - What aspects could be explored?
   - **[Critique-only]** What assumptions are visible?

5. If insufficient information:
   - **[Brainstorm]** Ask 2-3 targeted questions; use AskUserQuestion with `multiSelect: true`.
   - **[Critique]** Use AskUserQuestion:
     ```yaml
     options:
       - label: "[Most likely interpretation] (Recommended)", description: "Based on context clues"
       - label: "[Alternative interpretation]", description: "If the idea is about..."
       - label: "Explain question", description: "Explain what this means"
     multiSelect: false
     ```
   - Synthesize responses into clear idea description.

6. Confirm understanding with user via AskUserQuestion:

   **[Brainstorm]:**

   ```yaml
   options:
     - label: "Yes, that's correct (Recommended)", description: "Start brainstorming on this idea"
     - label: "Adjust", description: "I want to update the summary"
   multiSelect: false
   ```

   **[Critique]:**

   ```yaml
   options:
     - label: "Correct, start analysis (Recommended)", description: "Begin with technique selection"
     - label: "Adjust summary", description: "Let me refine the idea description"
     - label: "Add more context", description: "I have additional details to share"
   multiSelect: false
   ```

   Present before the question:

   ```
   [Confirmation message that we'll {brainstorm about | analyze}:]

   [concise idea summary]
   ```

   **[Critique-only]** Process user selection before proceeding.

**Note:** This step should be quick for `/project-seed` output, more thorough for other inputs.

### Chat Context flow

1. Analyze the conversation history:
   - What idea, concept, or topic has been discussed?
   - What are the key details, requirements, or characteristics mentioned?
   - Is there enough substance to work with?
2. Synthesize into a concise concept summary
3. Present to user:

   ```
   CHAT CONTEXT

   [concise summary of what was discussed in the conversation]
   ```

4. Use AskUserQuestion to confirm:
   ```yaml
   header: "Context Check"
   question: "Does this summary of the conversation look right?"
   options:
     - label: "Yes, correct (Recommended)", description: "Use this as input"
     - label: "Adjust", description: "I want to update the summary"
   multiSelect: false
   ```
5. If confirmed: use as input concept and proceed to PHASE 2
6. If "Adjust": ask what to change, update summary, confirm again
7. If insufficient context in conversation: inform user and fall back to manual input
