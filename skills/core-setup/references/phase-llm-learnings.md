# LLM Learnings via Subagent (mature PHASE 4)

**Inputs**: component list (PHASE 2e), existing `learnings[]`. Never loaded when `--no-llm` is set.

**4a) Select representative files**

Per component from PHASE 2e: choose 5-10 representative files. Criteria:

- File size > 50 LOC (skip stubs)
- Not test files (`*.test.*`, `*.spec.*`, `__tests__/**`)
- Not generated code (look for `// generated` comments, `*.d.ts` if imported from deps)
- Bias toward core/services/routes/models directories

Cap total: max 50 files across all components.

**4b) Call `learning-extractor` agent**

Via Agent tool:

- `subagent_type: "learning-extractor"`
- prompt:

  ```
  mode: "onboard"
  files: [<absolute paths>]
  existing_learnings: <current learnings[]>
  cap: 50
  ```

Subagent runs on Sonnet (see `agents/learning-extractor.md`), output JSON `[{type, summary, evidence, tags}]`.

**4c) Parse and enrich**

For each entry from subagent output:

- Set `source: "synced"`, `author: null` (codebase-wide), `date: <today>`, `feature: <first-segment-from-evidence>`
- Keep the agent's `tags` (0–3 from `LEARNING-WRITE.md § Tag Vocabulary`; default `[]`)
- Append to extraction results

On subagent failure (timeout, no JSON) → log warning, continue without LLM learnings.

When done: return to PHASE 4.5.
