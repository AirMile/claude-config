---
name: core-orchestrate
description: Orchestrate a task with agent fan-out and research. Use with /core-orchestrate.
metadata:
  author: claude-config
  version: 1.0.0
  category: core
---

# Orchestrate

Run a substantive task as an orchestrated flow — scope, parallel research fan-out, evidence-disciplined synthesis, execution, adversarial verification — instead of one long inline pass. This is a discipline skill: it structures how the work runs; the task itself supplies the content.

**Trigger**: `/core-orchestrate <task>` — the argument is the task. No argument → ask for the task in one line (no AskUserQuestion needed).

**When NOT to use**: 1-3 file changes (`/dev-tweak`, `/game-tweak`), pipeline features (`/dev-ship`, `/game-ship`), pure conversation. Those flows already carry their own structure — say so and stop.

## Model selection

| Work type                                                   | Model                              |
| ----------------------------------------------------------- | ---------------------------------- |
| Mechanical: search, extraction, probes, rehearsals, drafts  | `sonnet`                           |
| Judgment: synthesis, architecture, trade-offs, final review | `opus`                             |
| Anything else                                               | omit `model` — inherit the session |

Passing paths beats passing content: agents read files themselves (`SKILL-PATTERNS.md § Pass Paths, Not Content`).

## PHASE 0: Scope

Produce a scope block before any agent runs:

```
SCOPE: [task]
Deliverables: [concrete artifacts]
Unknowns: [each unknown → one research question]
Execution surface: [files/systems that will change, or "analysis only"]
```

A vague task gets at most one AskUserQuestion (recommended option first) to pin deliverables — then commit to the scope. Every research question in `Unknowns` becomes exactly one agent in PHASE 1; a question no agent will answer is cut here, not silently dropped later.

## PHASE 1: Research fan-out

Launch one agent per research question, all in parallel, `model: sonnet`, each with a JSON output schema (schema-forced output beats prose parsing):

- **Web**: WebSearch for external facts, prior art, failure modes — claims need sources.
- **Docs**: context7 (`mcp__context7__resolve-library-id` + `query-docs`) for library/framework/API facts — never answer those from memory.
- **Codebase**: Explore agents for repo questions — paths in, conclusions out.
- **Probes**: when the deliverable will be executed by a model (skill, prompt, agent definition), add a rehearsal probe on the executing model's tier that reads the current artifact and reports what it would skip, misread, or improvise. Probes never see the draft they are meant to test.

4+ agents or multi-stage dependencies between them → use the Workflow tool (this skill instruction is the opt-in); below that, parallel Agent calls in one message.

## PHASE 2: Synthesis

Merge agent outputs against the scope block at opus level (inline when the session model is opus-class, else one `model: opus` agent). Apply the evidence rule: a claim survives only with a cited source or an agent finding behind it — unevidenced claims are dropped and listed as dropped, not blended in. Output: a decision list (what will be built/changed and why), each entry traceable to evidence. Real decision forks go to the user via AskUserQuestion, recommended option first; everything else is decided here.

## PHASE 3: Execute

Execute the decision list:

- Small edit set → inline in the main chat.
- Parallelizable independent work → agents; add `isolation: worktree` only when agents mutate files concurrently (worktrees cost setup time — never by default).
- **STOP** before any irreversible action (delete, force-push, overwrite of user-owned files, external publish): confirm it is in the approved scope; if not, ask first.

Each executed item points at its artifact (file, commit, output block) — PHASE 4 consumes these artifacts, so an item without one is not done.

## PHASE 4: Verify

Verify against the deliverables from PHASE 0, per `CODING-RULES.md R009`: every done-claim is backed by a command run fresh, with output shown.

- Deterministic first: tests, validators, linters that cover the artifacts.
- Model-executed deliverables get a rehearsal agent on the tier that will run them (e.g. `model: sonnet` executor reading only the artifact + a target): it must produce concrete results without meta-questions — vague output means the artifact failed, revise and re-run.
- Contested or high-stakes findings get an adversarial pass: 2-3 agents prompted to refute, majority decides.

Report:

```
ORCHESTRATED: [task]

| Phase | Result |
|-------|--------|
| Scope | [deliverables count, unknowns count] |
| Research | [n agents, n findings kept / n dropped] |
| Synthesis | [n decisions, n user forks] |
| Execute | [artifacts] |
| Verify | [checks run + outcomes, rehearsal verdict] |

Next steps: [follow-ups, or none]
```
