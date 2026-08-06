# Skill Authoring Patterns

Conventions for recurring patterns in skill workflows. Referenced when authoring or modifying skills.

---

## ASCII Diagram

**When:** A skill has a complex flow, architecture, decomposition, or multi-path decision that is hard to convey in text alone.

**How:** Add an instruction at the relevant phase telling Claude WHAT to diagram and WHEN. Do not hardcode diagrams in SKILL.md — the instruction should describe the diagram type so Claude generates it with actual project data.

**Instruction template:**

```markdown
Generate an ASCII [diagram type] showing [what to visualize].
```

**Diagram types by use case:**

| Use case              | Diagram type         | Example skills                                  |
| --------------------- | -------------------- | ----------------------------------------------- |
| Architecture/layers   | Component diagram    | dev-ship (define phase), design-convert         |
| Multi-step workflow   | Flowchart            | dev-ship (build phase), dev-ship (verify phase) |
| Feature decomposition | Tree                 | project-plan                                    |
| State transitions     | State machine        | game-ship                                       |
| Parallel processes    | Architecture diagram | team-review                                     |

**Placement:** After the phase where the relevant information is gathered, before execution continues.

---

## Interview Checkpoint

**When:** A skill gathers 3 or more inputs (via AskUserQuestion or context detection) before starting execution.

**How:** Insert a CHECKPOINT between the gathering phases and the execution phases. The checkpoint presents all collected input as a structured table and asks for confirmation before proceeding.

**Template:**

```markdown
### CHECKPOINT: [Summary title]

Present all gathered information as a structured table:

| Aspect | Value             |
| ------ | ----------------- |
| [key]  | [collected value] |
| ...    | ...               |

Ask via AskUserQuestion: "Does this overview look correct? Do you want to adjust anything?"

- "Proceed (Recommended)" — proceed to execution
- "Adjust" — return to relevant question
```

**Rules:**

- Table aspects should match the skill's domain (e.g., Stack/Type for setup, Mechanics/Visuals for game design)
- First option is always "proceed" and marked as Recommended
- Keep the table concise — group related items if needed
- Place AFTER all gathering, BEFORE first execution phase

---

## Next Steps

**When:** A pipeline skill has a completion report (last phase output).

**How:** Add a `Next steps:` block to the completion output that points the user to the next skill(s) in the pipeline. This prevents the user from having to figure out the next step themselves.

**Template:**

```markdown
Next steps:

1. /{pipeline}-{next-verb} {feature} → {short description}
2. /{pipeline}-{alt-verb} → {when relevant}
```

**Rules:**

- First option = most likely next step in the pipeline
- Second option = alternative path (e.g. debug on failures)
- Use conditional blocks if the next step depends on the result (PASS vs FAIL)
- Reference concrete skill names, not generic instructions
- Place WITHIN the completion output, after the summary

---

## Pass Paths, Not Content

**When:** A skill spawns 2+ sub-agents that need to read project files (e.g., parallel scanners, reviewers, researchers).

**How:** The orchestrator discovers file paths (cheap: Glob/Grep), then passes a `<reference-paths>` block to each agent. Agents read only the files relevant to their specific task — never receive file contents in their prompt.

**Template:**

```markdown
Discover relevant files via Glob/Grep, then pass categorized paths to each agent:

<reference-paths>
## Routes/Controllers
- src/routes/auth.ts
- src/routes/api.ts

## Models

- src/models/user.ts
- src/models/session.ts

## Config

- src/config/database.ts
  </reference-paths>

Agent instruction: "Read only the files relevant to your analysis from the paths above."
```

**Rules:**

- Never pass file contents in the agent prompt — only paths
- Categorize paths by type/module when agents cover different domains
- Each agent's instruction must explicitly say to read only what's relevant
- The orchestrator does discovery once — agents don't re-discover

---

## Parallel Dispatch

**When:** 3+ independent problems/investigations exist that can be solved in parallel via the Agent tool.

**Dispatch in parallel** when:

- 3+ independent problems/investigations exist
- No shared state or file-conflicts between agents
- Each agent can complete its task independently without output from another agent

**Keep sequential** when:

- Agents write to the same files (conflict risk)
- Output of agent A is input for agent B
- < 3 problems (overhead not worth it)
- Problems depend on shared database/service state

**Decision Flow:**

```
problems identified
  ↓
overlap in files or state?
  yes → sequential
  no ↓
< 3 problems?
  yes → sequential
  no ↓
parallel dispatch (one message, multiple Agent tool calls)
```

**Agent Prompt Template:**

Each parallel agent receives a self-contained, complete prompt:

```
**Scope**: [one problem domain, explicitly bounded]
**Goal**: [one clear output — fixed bug, scan report, refactor diff]
**Context**: [all required info inline — no reference to session history]
  - Relevant file paths
  - Reproducible symptoms / error message
  - Stack/framework info
**Constraints**:
  - Do NOT modify: [list of files/modules out of scope]
  - Do NOT write to [shared state files] — read only
**Output requirement**: End with evidence of completion (command + output, see R009)
```

Rules:

- Each agent prompt is fully self-contained — assume the agent has no session history
- Explicitly bound scope so agents don't touch the same files
- Always include output requirement so results are verifiable

**Integration** (after all agents complete):

1. Read report per agent
2. Detect conflicts: same file or symbol modified by multiple agents?
3. On conflict: pick one, revise other in a separate pass
4. Run shared validation (tests, type-check, lint) on the combined result
5. Claim completion per R009

---

## Project Bootstrapping

**When:** A skill expects `.project/` files (backlog.json, project.json, features/) but the folder does not exist or is empty.

**How:** Check in PHASE 0 whether `.project/` exists. If not, suggest `core-setup` before the skill executes.

**Rules:**

- Skills that MAY create `.project/` without a check: `project-plan`, `project-todo`, `design-convert`, `core-setup`
- All other skills: if `.project/` does not exist or is empty, show suggestion and stop
- Do not silently `mkdir -p` the entire `.project/` structure — that is `core-setup`'s responsibility
- `mkdir -p .project/features/{name}` and `mkdir -p .project/session` within an existing `.project/` is fine

---

## Task Tracking

**When:** Skill has 5+ phases and risk of context compaction (verify, debug, refactor, build, optimize, multi-stage setup).

**How:** Combine four marker types: seed block at the top, PHASE 0 bootstrap marker, inline transition markers per phase transition, completion marker at the last phase.

**Seed block** — directly under `## Process` or `## Workflow`, before the first phase:

```markdown
**Phase tracking** — first action of the skill: call `TaskCreate` with these N items
(status `pending`), then use `TaskUpdate` to set each phase to `in_progress` at the
start and `completed` at the end. During context compaction the task list remains
visible — no risk of forgetting phases. If `ToolSearch` cannot resolve
`TaskCreate`/`TaskUpdate` (unavailable this session), skip phase tracking silently
and proceed — the phase headers below (and any durable state/checkpoint file the
skill already writes) remain the resumability signal regardless.

1. PHASE 0: ...
2. PHASE 1: ...
   ...
   N. PHASE LAST: ...
```

**PHASE 0 marker** — directly under the first phase header:

```markdown
> **Todo**: call `TaskCreate` with the N phase items (see above). Mark PHASE 0 → `in_progress` via `TaskUpdate`. If the tools didn't resolve, skip seeding and continue.
```

**Inline transition marker** — directly under each subsequent phase header:

```markdown
> **Todo**: mark PHASE PREV → `completed`, PHASE CURRENT → `in_progress`.
```

**Completion marker** — at the end of the last phase:

```markdown
> **Todo**: mark PHASE LAST → `completed`.
```

**Conventions:**

- Capitalized `Mark` only in the PHASE 0 bootstrap marker (once per skill)
- Lowercase `mark` in all inline + completion markers
- Statuses always in backticks: `pending`, `in_progress`, `completed`
- Skills using "Step" or "Phase" instead of "PHASE" keep their own word
- Every seeded phase has a matching header and is marked `in_progress` and `completed` somewhere in the skill (N seed items = N headers; PHASE 0 marker + N-1 transitions + 1 completion = N+1 markers)

**Skip-`in_progress` marker** — for a phase whose entire work is a synchronous routing/resolution
check with no meaningful "in progress" duration (it starts and finishes in the same step), skip the
`in_progress` marker and say so explicitly, right where that phase is marked `completed`:

```markdown
> ... this routing step is the phase's own work — PHASE 0 skips `in_progress` and marks straight to
> `completed` once resolved ...
```

The validator treats an explicit "skips `in_progress`" statement for a phase as satisfying that
phase's `in_progress` requirement — it still requires the phase to reach `completed` somewhere; this
only waives the intermediate marker, not the phase itself. Reference:
`dev-manual/SKILL.md`'s MANUAL 0.

**Validator:** `python3 scripts/check-task-markers.py` enforces the seed = headers = status-coverage invariant (run per skill via `--skill <name>`; wired into `scripts/tests/run.sh`).

**Skip for:** short CLI utilities (<5 phases), interactive thinking skills, backlog/CRUD skills.

**Reference:** `dev-ship/references/dev-build/workflow.md` has the full pattern.

---

## Lazy Reference Loading

**When:** A skill has ≥30-line blocks that are (1) conditional on a runtime branch, (2) static templates/schemas, or (3) end-of-flow phases only needed in the last 1–2 phases. Loading them inline bloats the context even when the block is irrelevant for the current run.

**Extract when at least one is true:**

1. **Branch with dead-path cost** — block belongs to one of N paths, only 1 fires per run (e.g., update-mode, queue-selection, intake-per-type)
2. **Static template/schema** — agent prompt template, JSON schema table, or lookup table that is pure reference data, not execution flow
3. **End-of-flow phase** — completion/sync block only relevant in the last 1–2 phases
4. **Minimum size** — ≥30 lines. Below that threshold the Read call overhead isn't worth it.

**Where to put files:**

- `references/` — lookup data, templates, conditional branches, end-of-flow phases
- `techniques/` — mutually-exclusive workflow alternatives (e.g. TDD vs implementation-only, where the model picks one)

**How to wire it** — Read directive inline in the TaskUpdate transition marker of the phase that needs it:

```markdown
> **Todo**: mark PHASE 2 → `completed`, PHASE 3 → `in_progress`. Read `.claude/skills/{skill}/references/{name}.md`.
```

For conditional branches (read only when condition is met):

```markdown
> **Todo**: if update-mode detected → Read `.claude/skills/{skill}/references/update-mode.md` and follow that flow; otherwise continue inline.
```

**Naming:** Use `references/{descriptive-name}.md` — not `phase-N.md`. Renaming phases won't force a rename of the file.

**Read failure:** If the Read of a reference file fails (missing/renamed file), stop and report the missing path to the user — do not improvise the phase from memory. The reference is the source of truth; a reconstructed version silently diverges from it.

**Examples:** `dev-ship/references/dev-verify/references/completion-sync.md` (end-of-flow sync, 237 lines) and `dev-ship/references/dev-build/techniques/tdd.md` (mutually-exclusive workflow, loaded on demand in PHASE 2).

**Skip for:** Short inline phases (<30 lines), blocks that always run AND are always needed (no conditional savings), skills with fewer than 5 phases.

---

## Token Efficiency

**When:** Auditing or authoring any skill. These techniques govern a skill's cost-per-run — both the context it loads (input tokens) and the output it is forced to emit. Lazy Reference Loading (above) is one technique; this is the full checklist.

**Hot path vs cold path.** SKILL.md loads in full on every invocation (hot path). A reference file loads only when its Read directive fires (cold path). Keep the hot path — SKILL.md plus any file read unconditionally near the top — as small as the workflow allows. Estimate tokens as `wc -c ÷ 4`.

**Checklist:**

1. **Eager-read trap ("fake lazy loading").** A reference file that is Read unconditionally at the top of the flow saves nothing — it is hot-path cost wearing a cold-path costume. Extraction only pays off when the Read is conditional on a branch or lands late in the flow. Flag any `references/` file whose Read directive always fires early.
2. **Lazy Reference Loading.** Apply the `§ Lazy Reference Loading` criteria (≥30 lines, conditional / static template / end-of-flow).
3. **Cite, don't duplicate.** Content that lives in `shared/` (rules, schemas, patterns) is referenced by section, never restated in the skill. Restated shared content is dead weight that also drifts.
4. **Scoped reads.** Prescribe reading the needed section, not the whole file, where a file is large and the target is local. Never re-read a file already in context.
5. **Output-token cost.** Verbose mandatory templates (large ASCII tables, echoed summaries, repeated recaps) cost output tokens on every run. Prescribe a rigid format only where the format is load-bearing; otherwise trust Claude to format.
6. **Script offload.** Deterministic work — validation, counting, path existence, schema checks — belongs in `scripts/`, not in model tokens. A `python3 scripts/x.py` call is cheaper and more reliable than asking the model to compute it.
7. **Agent cost.** For skills that spawn sub-agents: `§ Pass Paths, Not Content` (never file contents in prompts), `§ Agent Context Block` (build context once), `§ Agent Model Selection` (tier matched to task). Inverse check too — agents spawned where an inline step would do (project CLAUDE.md § Agent Conventions) burn a full context for no isolation benefit.

---

## Git Safety Gates

**When:** A skill performs git mutations (commit, push, checkout, merge, rebase).

**How:** Treat git state as volatile — re-read after every mutation, check state dimensions separately, enforce safety gates before risky operations.

**Three principles:**

1. **Re-read after mutation** — after every git write, re-check with `git status` / `git log --oneline -1` / `git branch --show-current`
2. **Separate state dimensions** — check independently:
   - Is the working tree clean? (`git status --porcelain`)
   - Does the upstream branch exist? (`git rev-parse --abbrev-ref @{u}`)
   - Are there unpushed commits? (`git log @{u}..HEAD --oneline`)
   - What is the current branch? (`git branch --show-current`)
3. **Safety gates** — before risky operations, run explicit checks first

**Template:**

```markdown
Before push:
✓ Current branch is not main/master
✓ Working tree is clean
✓ Upstream exists or --set-upstream is used
✓ No unexpected commits in log

Before checkout/switch:
✓ Working tree is clean (or changes are stashed)
✓ Target branch exists

After any mutation:
→ Re-read git status
→ Verify expected state matches actual state
→ If unexpected: STOP and inform user
```

**Rules:**

- Never assume git state based on a previous check — always re-read
- Detect default branch via `git remote show origin` or `gh repo view --json defaultBranchRef`
- On unexpected state: stop and inform the user, don't attempt recovery

---

## Agent Context Block

**When:** A skill spawns an agent that needs project knowledge (Explore, Plan, or custom agent).

**How:** Build a standardized `PROJECT_CONTEXT` block from available sources in PHASE 0 (context loading). Pass this block to every agent that needs project knowledge.

**Template:**

```markdown
Assemble the following block from available sources:

PROJECT_CONTEXT_START
Stack: {CLAUDE.md ### Stack section, or stack-baseline.md summary}
Structure: {project-context.json → context.structure, or "not available"}
Patterns: {project-context.json → context.patterns, or "not available"}
Endpoints: {project.json → endpoints, max 20 entries, or "not available"}
Entities: {project.json → data.entities, max 10 entries, or "not available"}
Active feature: {.project/session/active-\*.json content, or "none"}
Learnings: {project-context.json → learnings[], last 5 entries, or "none"}
PROJECT_CONTEXT_END
```

**Rules:**

- Read source files in PHASE 0 (context loading) — not per agent
- Skip sections that do not exist (show "not available")
- Only pass learnings if relevant to the agent's task
- Skills may add extra skill-specific sections AFTER the standard block
- Existing skills (dev-ship's verify phase, dev-security) do not need to migrate immediately — this is opt-in for new skills and future refactors

**Context load helpers** — use these shared protocols instead of inline reads (single source of truth per file type):

**Dev pipeline:**

| Helper                           | File                                    | Profiles                                       |
| -------------------------------- | --------------------------------------- | ---------------------------------------------- |
| `shared/LEARNINGS-LOAD.md`       | `project-context.json#learnings[]`      | `component`, `architectural`, `pitfall-prefix` |
| `shared/PROJECT-CONTEXT-LOAD.md` | `project.json` + `project-context.json` | `build`, `define`, `verify`                    |
| `shared/BACKLOG-LOAD.md`         | `.project/backlog.json`                 | `read-feature`, `ready-queue`                  |
| `shared/FEATURE-LOAD.md`         | `.project/features/{name}/feature.json` | `build`, `verify`                              |

**Game pipeline** (Godot 4.x — same `.project/` files, game-specific schema fields):

| Helper                        | File                                    | Profiles                                |
| ----------------------------- | --------------------------------------- | --------------------------------------- |
| `shared/LEARNINGS-LOAD.md`    | `project-context.json#learnings[]`      | shared with dev pipeline                |
| `shared/GAME-CONTEXT-LOAD.md` | `project.json` + `project-context.json` | `build`, `define`, `verify`             |
| `shared/GAME-BACKLOG-LOAD.md` | `.project/backlog.json`                 | `read-feature`, `queue` (parameterized) |
| `shared/GAME-FEATURE-LOAD.md` | `.project/features/{name}/feature.json` | `build`, `verify`                       |

Guard script: `node scripts/check-context-load.js` — validates all 21 profiles (dev + game) against fixtures in `scripts/fixtures/`. Run alongside `check-handoff.py` before releases.

### Context Aggregation / Scout Agents (exception)

The "Read source files in PHASE 0 — not per agent" rule covers files the skill itself reasons over (project.json, feature.json, source code).

**Exception** — spawn a read-only aggregator/scout that returns a compact delimited digest when:

- Source count ≥ 5 files (or unbounded similar-pattern/library exploration) AND
- Output needs filtering/ranking (not raw read) AND
- Result fits in a small delimited block (≤ 30–40 lines compact text)

Two sanctioned agents:

- `context-aggregator` (sonnet) — prior feature decisions + thinking files → `PRIOR_DECISIONS_START/END` (≤ 30 lines). Used by dev-ship's define phase (PHASE 0).
- `define-scout` (sonnet) — similar-pattern **source exploration** + library/API research during define PHASE 2 → `DEFINE_SCOUT_START/END` (≤ 40 lines). This is the sanctioned way to keep the design-time codebase reads and Context7/WebSearch out of the main context; the build agent reads the real files later (pass-paths-not-content). The digest's optional `VERIFY:` entries (max 2) name signatures worth the caller reading directly — the one deliberate exception to "digest, not files," since a mis-transcribed signature would otherwise enter the machine contract unchecked.

**Not for:** single field extraction (use inline `node -e`), per-REQ context (use Agent Context Block above), or learnings filtering (use `shared/LEARNINGS-LOAD.md`). Raw full-source reads the skill must reason over line-by-line still stay inline — the scout returns signatures + notes, not file bodies.

**Contract:** agent MUST return delimited blocks (e.g. `PRIOR_DECISIONS_START/END`, `DEFINE_SCOUT_START/END`) so the caller parses without re-reading.

---

## Fork Delegation

**When:** A skill needs work done whose tool output should stay out of the main context, but whose input is the live conversation itself — re-serializing that context into a fresh agent prompt would be expensive or lossy.

A **fork** (`Agent` tool with `subagent_type: "fork"`) inherits the full conversation context at spawn time, runs in the background, keeps its tool output out of the main context, and returns only its final message. It always runs on the parent model (a `model` override is ignored). This is a fourth agent justification besides scale-parallelism, independent reasoning, and context-isolation-for-volume (project CLAUDE.md § Agent Conventions): **context-inheritance with output-isolation**.

**Use a fork only when ALL three hold:**

1. The conversation context is load-bearing — re-serializing it into a fresh agent prompt is expensive or lossy (interview history, round history, live app/launch state), AND
2. the work's tool output does not belong in the main context (browser loops, test-suite output, broad reads), AND
3. the result fits in a compact delimited block (same contract as scout agents above).

**How:** dispatch the fork with a task-only prompt (no context re-statement — that is the point), end the turn, wake on its task-notification (same rhythm as background Workflows). Parse only the delimited block from its final message.

**Rules:**

- **Never** for adversarial or independent judgment (verify, critique, second-opinion consults) — inherited context is contamination there, not a feature.
- **Never** for fan-outs or mechanical work: forks always run the parent model, so fresh sonnet/haiku agents stay correct there (§ Agent Model Selection).
- The fork sees context only up to the spawn moment; nothing after propagates. The result returns only as its final message → the delimited-block contract is mandatory.
- The main chat does no conflicting work while the fork runs (same browser session, same worktree files) — wait for the notification.
- **Fallback required:** every fork dispatch names its fresh-agent or inline fallback. Forks are a harness feature — if the dispatch is unavailable or errors, take the fallback path without retrying.
- **Cost framing:** the fork's win is main-context headroom (fewer compactions late in long interactive phases), not a lower bill — it re-reads the conversation as cached input on the parent model. Do not reach for a fork where a cheap fresh agent with a short prompt does the job.

**Decision rule:** conversation context load-bearing + output isolation needed → fork. Context cheaply re-statable as paths/fields + filtering needed → scout agent (§ Context Aggregation). Result must be reasoned over line-by-line in the main chat → inline.

---

## Agent Resume (Sparring)

**When:** a consult per `shared/SECOND-OPINION.md § Mode` needs a second round — the main chat found
a concrete factual error or an unsupported premise in the first digest and wants the same agent to
address it with its own prior reasoning intact, rather than re-explaining the whole brief to a fresh
spawn.

**How:** the `Agent` tool's spawn result carries an agent id/name. `SendMessage` to that id/name
resumes the agent from its own transcript — it keeps everything it read and reasoned on the first
call, so the follow-up prompt only needs to state the correction, not restate the brief. Round 2's
reply follows the **same delimited-block contract** as round 1 (`SECOND_OPINION_START/END` for a
consult; the equivalent block for any other resumable contract).

**Rules:**

- **Hard cap: 2 rounds.** Round 2 is authorized only when the main chat can name a specific, citable
  factual error or unsupported premise in round 1's digest (path/line that disproves it) — never
  "what do you think of my response." That is the whole stopping rule; there is no round 3.
- **Never for an agent that could continue the pipeline.** This mechanism is for read-only
  consults/spars whose only output is a digest. It is the opposite of `phase-3-manual-finalize.md`'s
  regression re-check, which dispatches a **fresh, non-fork** agent specifically so it cannot read
  and act on this skill's own continuation instructions (`§ Fork Delegation`'s isolation-as-defense
  rule) — do not resume that kind of agent under any circumstance; a fresh, isolated dispatch is the
  correct choice there, not this pattern.
- **Fallback required:** if resume is unavailable or errors, fall back to the one-shot digest and log
  it — never block the flow waiting on a resume that won't complete.
- **Pre-register a position before spawning round 1** — one line stating what the main chat would
  decide without the consult. This makes "confirmed" vs. "revised" in the consult's own logging
  falsifiable instead of a rubber stamp.

---

## Description Format

**When:** When writing or reviewing SKILL.md frontmatter `description`.

**Rule:** Description must start with trigger conditions, not a workflow summary.

| Good (✓)                                                                      | Bad (✗)                                                     |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `Use when implementation done and acceptance tests must verify spec`          | `Adversarial verification — tests + fix loops`              |
| `Use with /game-debug when a Godot feature has reported bugs to root-cause`   | `Debug methodology with systematic root-cause analysis`     |
| `Use with /project-seed brainstorm to expand idea via interactive techniques` | `Creatively expand ideas through interactive technique app` |

**Why:** Workflow summaries make Claude think it already knows the skill, so it skips the rest of SKILL.md. Trigger conditions clarify _when_ the skill is chosen, not _what_ it does.

**Format:**

```
Use {when|with} <trigger>. <short addition>. Use with /<command-name>[, optional /<predecessor>].
```

**Existing skills:** no bulk refactor — apply the pattern at the next edit of a skill (incremental adoption).

---

## Agent Model Selection

**When:** A skill spawns agents via the Agent tool and you want to optimize cost/speed.

**How:** Choose the model based on the task the agent performs.

**Guidelines:**

| Agent task                                                    | Model             | Reason                                                                                          |
| ------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------- |
| Reading code, searching, gathering context                    | `model: "sonnet"` | Cheaper, fast, sufficient for read-only tasks                                                   |
| Writing code, complex fixes, architecture                     | `model: "opus"`   | Higher quality for creative/analytical work                                                     |
| Simple classification, parsing                                | `model: "haiku"`  | Fastest and cheapest for simple tasks                                                           |
| One-shot independent second opinion at a hard-thinking moment | `model: "fable"`  | Strongest model for adversarial judgment — auto-fires on trigger per `shared/SECOND-OPINION.md` |

**Rules:**

- **Always specify a model explicitly.** The session model is plain `opus` (`~/.claude/CLAUDE.md § Model Tiering`) — an unpinned dispatch now inherits Opus, not a cheap default. "No model specification" is no longer a safe default; it is a silent cost/latency regression on every dispatch that meant to be cheap.
- Explore agents are almost always Sonnet-appropriate — pin `model: "sonnet"` on every Explore dispatch.
- Build/fix agents that write code: use Opus unless it's a trivial fix.
- `model: "fable"` is availability-gated — every fable spawn names the fallback chain fable → opus → skip-with-log (see `shared/SECOND-OPINION.md § Spawn`); never spawn fable outside that doc's gate (trigger auto-fires the spawn, no confirm step — capped per that file's budget).
- `subagent_type: "fork"` always inherits the parent (Opus) model and ignores a `model` override — never use a fork where a specific cheap/expensive tier matters; use a fresh (non-fork) agent instead.

---

## Modal Option Cap

**When:** A skill uses AskUserQuestion (multi-select) where the number of options is dynamic — depends on runtime context, scan results, stack, or user input. Applies to options generated from feature lists, agent outputs, file scans, or other unbounded sources.

**How:** Enforce a hard cap of 4 options per modal — this is the `AskUserQuestion` tool's own schema limit (`maxItems: 4`), not just a style preference; a 5th option makes the tool call fail outright. When more options exist, split into sequential category modals — one per logical group, in order of impact.

**When NOT to use a modal — use plain-text list + free-form parse instead:**

- The user needs to see ALL options simultaneously to make a coherent choice (e.g., prioritization, scope selection from holistic view)
- The option count is unbounded and runtime-dependent without natural categorization
- The choice involves comparing items against each other rather than picking from independent categories

In these cases: present a numbered plain-text list and ask for free-form input (e.g., `1, 3, 5` / `1-4` / `all except 2`). Reference: `project-todo`, `project-add`.

Use `AskUserQuestion` only for the cancel/exit route (e.g., "Continue with selection" / "Cancel").

**Rules:**

- **Cap**: max 4 options per modal (tool-enforced, not a convention)
- **When more options are available**: split into sequential category modals, skip empty categories
- **Never truncate silently**: prefer an extra modal over dropping options

**Category examples by domain:**

| Skill domain        | Category split                                    |
| ------------------- | ------------------------------------------------- |
| Tech stack          | Core framework → Build/dev tooling                |
| Library suggestions | Styling/UI → Testing → State/Data → Utilities     |
| Debug fixes         | By component/layer (UI, logic, data, performance) |
| Audit findings      | Core files → Config → Claude config → CLAUDE.md   |

**Modals with fixed/small option sets (≤4 options) are not subject to this rule.**

---

## Numbered List Selection

**When:** A skill presents a numbered plain-text list and asks the user to pick items via free-form input (the alternative to `AskUserQuestion` for holistic-choice scenarios — see § Modal Option Cap).

**How:** Standardize the syntax and edge cases so users get consistent behaviour across skills.

**Canonical syntax (accept all of these):**

| User input                 | Interpretation           |
| -------------------------- | ------------------------ |
| `1, 3, 5`                  | Items 1, 3, 5            |
| `1-4`                      | Items 1 through 4        |
| `1, 3-5, 8`                | Mixed list + range       |
| `all` / `everything` / `*` | All items                |
| `none` / empty             | No items                 |
| `all except 2, 7`          | All items except 2 and 7 |

**Edge case rules:**

- Out-of-range numbers (e.g., `8` in a list of 7): show what was unparseable and re-ask the same question — do not silently drop
- Duplicate numbers: dedupe silently
- Whitespace and case: ignore
- Mixed separators (`,` and `;`): accept both
- If the user types a sentence instead ("only the first three"): interpret if obvious, otherwise re-ask with the syntax examples

**Prompt template:**

> Question: "{question}? Enter numbers (e.g. `1, 3, 5` or `1-4` or `all except 2`)."

**Rules:**

- Always show the syntax hint inline with the question — don't expect the user to remember
- Empty input always means "none", never "all" (safer default)
- Echo the parsed selection back before destructive action (e.g., "Selected: items 1, 3, 5 — proceed?")

---

## Discovery (Gap, Reuse & Page)

Three related flows that automatically drop TODOs into the backlog when skills detect missing logic, reusable UI, or new page routes. Common structure: **scan → dedup → AskUserQuestion → append + log**. All three are **non-blocking** — the skill always continues regardless of gaps.

### Shared: dedup order

Before every `data.features.push()`, in this order:

1. **Name check** — `data.features.find(f => f.name === kebab-name)` → already in backlog? → skip.
2. **Inventory check** (type COMPONENT) — `project.json#design.components.find(c => c.name === kebab-name)` → already specified? → link instead of push.
3. **suggestionsLog check** — `feature.json#suggestionsLog.find(s => s.name === name && s.status === "rejected" && s.skill === current-skill)` → previously rejected by current skill? → skip. Rejected by another skill: may be proposed again.

### Shared: suggestionsLog shape

```json
{
  "skill": "{skill-name}",
  "type": "FEATURE|COMPONENT",
  "name": "{component}.{prop} or {component-name}",
  "status": "accepted|rejected",
  "at": "{ISO 8601}",
  "direction": "frontend→dev|dev→frontend"
}
```

If no gaps/candidates found: skip this step entirely (no prompt).

---

### Gap-Discovery

**Direction:** frontend → dev

**Goal:** Detect stub handlers and action verbs in generated frontend code that have no linked FEATURE in the backlog.

**Skills:** `design-convert` (Triggers A/B/C — Build and Convert routes).

#### Triggers

- **A — Capture(Component):** scan `props[]` for regex `/^on[A-Z]/` or names like `action`, `handler`, `submit`.
- **B — Capture(Page):** scan `flows[]`/`purpose` for action verbs: submit, delete, save, fetch, send, create, update, upload, download. Max 3 candidates, highest semantic weight first.
- **C — Build/Convert (post code-gen):** scan generated `.tsx`/`.svelte`/`.vue` for stub handlers: `() => {}`, `/* TODO */`, `// implement`, `console.log` as sole body.

Fuzzy-match each candidate against `data.features` (type FEATURE/API/INTEGRATION) on name/description. Threshold score > 0.5 → show "Link to existing" option.

#### Resolution (per gap candidate)

AskUserQuestion:

```yaml
header: "Gap: {component|page}.{prop/action} has no functionality"
question: "What should happen with this behavior?"
options:
  - label: "Link to existing: {best-match}"
    description: "Adds {entity} to {feature}.frontend.linkedEntities[]"
  - label: "Create new FEATURE TODO"
    description: "Backlog gets [FEATURE] {suggested-name} TODO"
  - label: "Mark as decorative"
    description: "No behavior needed (visual demo). Gap: skipped"
  - label: "Skip for now"
    description: "Gap: pending — prompt appears at next Build/Capture"
multiSelect: false
```

**Persist choice:**

- **Link:** append `{ prop, context, status: "linked", featureRef, at }` to `design.{components|pages}[name].gaps[]`; append `{ type, name, prop }` to `{feature-name}/feature.json#frontend.linkedEntities[]`
- **Create new:** run dedup order → push to `data.features[]`; append gap with `status: "created", featureRef: name`; append `frontend.linkedEntities[]` entry
- **Decorative:** append gap with `status: "skipped"`
- **Skip:** append gap with `status: "pending"`

---

### Reuse-Discovery

**Direction:** dev → frontend

**Goal:** Detect reusable UI patterns during dev work and drop them as COMPONENT todos in the backlog.

**Skills:** `dev-ship` (define phase — keyword-scan requirements), `dev-ship` (build phase — repeating JSX pattern).

#### Triggers (per skill)

- **dev-ship (define phase):** keyword-scan on UI element names in requirements (Modal, Dialog, Drawer, Tooltip, Dropdown, Select, DatePicker, TimePicker, RichTextEditor, FileUpload, Avatar, Badge, Toast, Alert, Banner, Stepper, Wizard, Table, DataGrid, Carousel, Accordion, Tab, Breadcrumb, FormField, InputGroup, ColorPicker, Rating, Slider, Progress, Skeleton). Also apply project-specific name prefixes.
- **dev-ship (build phase):** repeating JSX block after code-gen — ≥2x in the same file or ≥1x across multiple files of the same feature.

#### Resolution (batch)

AskUserQuestion:

```yaml
header: "Potential components found"
question: "{Skill-specific question about candidates}"
options:
  - label: "{name} — {short context}"
    description: "Create COMPONENT todo"
  - label: "..." (one per candidate)
  - label: "Skip"
    description: "Do not add COMPONENT todos"
multiSelect: true
```

**Persist per accepted proposal:**

1. Run dedup order (see above).
2. Append to `project.json#design.components[]`: `{ name, purpose: "infer from context", status: "IDEA", scope: "infer from context — atomic|section|layout, default atomic" }`
3. Push to `backlog.json#data.features[]`:
   ```json
   {
     "name": "{kebab-case name}",
     "type": "COMPONENT",
     "status": "TODO",
     "phase": "P3",
     "description": "Component detected by {skill} in {context}",
     "source": "/{skill-name}",
     "scope": "{infer from context, default atomic}",
     "dependencies": []
   }
   ```
4. Log in `feature.json#suggestionsLog[]` (accepted).
5. Append kebab-name to `dependencies[]` of triggering feature(s).

Per rejected proposal: log in `suggestionsLog[]` (rejected). "Skip" → log all candidates as rejected.

---

### Page-Discovery

**Direction:** dev ↔ frontend

**Goal:** Detect new page routes during dev work and drop them as standalone PAGE todos in the backlog so they go through the design → convert → check pipeline.

**Skills:** `dev-ship` (define phase — sole writer — post-architecture seed), `design-convert completion-sync` (sole writer — user-driven page creation), `dev-ship` (build phase — warning-only safety net + COMPONENT→route suggestions — does NOT write to backlog).

> **Doctrine:** `/dev-ship` (define phase) and `/design-convert completion-sync` are the only skills that create PAGE entries in `backlog.json`. `/dev-ship` (build phase) only logs a warning when it detects route patterns not yet in the backlog.

#### Triggers (per skill)

- **dev-ship (define phase):** scan `feature.json#architecture.routes[]` for stack-specific page patterns (`app/**/page.tsx`, `src/routes/**`, `pages/**/*.{tsx,vue}`, `routes/**/*.svelte`); scan `feature.json#files[]` for suffixes `Page`, `Screen`, `View`.
- **dev-ship (build phase, safety net):** identical patterns as the define phase. Skip candidates already seeded during the define phase: `data.features.find(f => f.source === "/dev-ship" && f.parentFeature === current)`. **Warning-only — no write.**
- **dev-ship (build phase, COMPONENT→route):** scan `<Link href="...">` and `router.push(...)` in generated component files. Candidate if route does not appear in `project.json#design.pages[]` or `backlog.json`.

#### Resolution

AskUserQuestion (wording per skill — see skill files for exact options):

- **dev-ship (define phase):** batch — "Add a PAGE todo per page?" — options: "Yes, all" / "Selection" / "No".
- **dev-ship (build phase, safety net):** log warning only — `⚠ Detected new route patterns: {list}. Run /dev-ship or /design-convert <name>.` No AskUserQuestion. No write.
- **dev-ship (build phase, COMPONENT→route):** per route — "PAGE todo for {route}?" — "Yes" / "Skip".

**Persist per accepted page** (dev-ship's define phase and design-convert only):

1. Run dedup order (see above — name check; type PAGE skips inventory check; suggestionsLog check on rejected status).
2. Push to `data.features[]`:
   ```json
   {
     "name": "{kebab-case page-name}",
     "type": "PAGE",
     "status": "TODO",
     "phase": "P3",
     "description": "Page introduced by feature {parentFeature}. Route: {route-pattern}",
     "source": "/{skill-name}",
     "dependencies": ["{parentFeature}"],
     "parentFeature": "{parentFeature}",
     "auto": true
   }
   ```
3. Log in `feature.json#suggestionsLog[]` (accepted, `direction: "dev→frontend"`, `type: "PAGE"`).

Per rejected proposal: log in `suggestionsLog[]` (rejected).

---

### Smart-Todo Creation

**Direction:** frontend → backlog (or dev → backlog)

**Goal:** During PAGE composition or feature definition, allow skills to discover and create new backlog items (COMPONENT or FEATURE) inline — without leaving the current flow.

**Skills:** `design-convert` (Build — page-compose step), `dev-ship` (define phase — pageHint sparring — new PAGE).

#### Trigger

- **design-convert Build (PAGE):** user selects `"+ new component"` or `"+ new feature"` in the page-composition selection menu.
- **dev-ship (define phase):** user answers `"+ new PAGE"` in the pageHint sparring question (no existing PAGE matches the feature's target route).

#### Resolution

**For "+ new component" (from design-convert):**

```yaml
header: "New component"
question: "Describe the new component:"
options:
  - label: "Quick add — I'll name it", description: "Provide kebab-case name + 1-line description"
multiSelect: false
```

Ask name + description (free text). Then:

1. Run dedup order (see BACKLOG.md § Writing the backlog).
2. Push to `backlog.json#data.features[]`:
   ```json
   {
     "name": "{kebab-name}",
     "type": "COMPONENT",
     "status": "TODO",
     "transition": "designing",
     "phase": "P2",
     "description": "{user description}",
     "source": "/design-convert",
     "scope": "atomic",
     "dependencies": ["{current-page-name}"]
   }
   ```
3. Add to `project.json#design.components[]`: `{ name, purpose: description, status: "IDEA", scope: "atomic" }`.
4. Return the new component name to the composition selection so it appears in the current list.

**For "+ new feature" (from design-convert):**

```yaml
header: "New feature"
question: "Describe the new feature this page needs:"
options:
  - label: "Quick add — I'll name it", description: "Provide kebab-case name + 1-line description"
multiSelect: false
```

1. Run dedup order.
2. Push to `backlog.json#data.features[]`:
   ```json
   {
     "name": "{kebab-name}",
     "type": "FEATURE",
     "status": "TODO",
     "phase": "P2",
     "description": "{user description}",
     "source": "/design-convert",
     "pageHint": ["{current-page-name}"]
   }
   ```
3. Return the new feature name to the composition selection.

**For "+ new PAGE" (from dev-ship's define phase pageHint sparring):**

1. Run dedup order.
2. Push to `backlog.json#data.features[]`:
   ```json
   {
     "name": "{kebab-page-name}",
     "type": "PAGE",
     "status": "TODO",
     "transition": "designing",
     "phase": "P2",
     "description": "Page for feature {current-feature}. Route: {route-hint}",
     "source": "/dev-ship",
     "dependencies": ["{current-feature}"],
     "parentFeature": "{current-feature}",
     "auto": true
   }
   ```
3. Return the new page name to the pageHint answer so `feature.json#pageHint[]` includes it.

#### Notes

- All smart-todo items are **user-confirmed before write** (they appear inline in the composition menu and the user chooses to add them).
- Write happens as part of the parent skill's backlog-sync step — not a separate intermediate write.
- `source` tag always reflects the originating skill so it is treated as INDEPENDENT (preserved across `/project-plan` rebuilds).

---

## Smart Suggestions (AskUserQuestion)

**When:** Every time a skill asks a question via `AskUserQuestion`.

**Rules:**

- First option = recommended → append `(Recommended)` to the label
- Always `multiSelect: true` as default — only `false` for yes/no confirmations
- 2-4 options; `"Other"` is built-in and does not need to be added manually
- Skills add skill-specific options for their context

**Template:**

```yaml
header: "{Short context}"
question: "{Question}"
options:
  - label: "{Best option} (Recommended)"
    description: "{Why this is the best choice}"
  - label: "{Alternative}"
    description: "{When this is relevant}"
multiSelect: true
```

**Single-select** (yes/no, pick one): `multiSelect: false`

---

## Forking & Personal Overlay

The public repo ships with universal defaults. Personal customisations live in a
gitignored `personal/` directory that sits inside the repo root but is never committed.

```
personal/
  CLAUDE.md.overlay          ← appended to ~/.claude/CLAUDE.md after base
  settings.overlay.json      ← deep-merged into ~/.claude/settings.json (your values win)
  styles/                    ← writing styles for content-write / content-rewrite
```

`/core-bootstrap` auto-detects `personal/` and applies overlays. Safe across `git pull`.

**For forks**: update `author:` in skill frontmatters to your own handle. Add your
writing styles to `personal/styles/`. Override defaults in `personal/settings.overlay.json`.
See [`personal/README.md.template`](../../personal/README.md.template) for the full setup guide.
