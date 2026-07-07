---
name: project-memory
description: Ask what the project already knows. Use with /project-memory.
argument-hint: "[question]"
reads: [project-context.learnings, backlog.features, project.thinking]
metadata:
  author: claude-config
  version: 1.0.0
  category: project
---

## Overview

Answers a free-text question by interrogating everything the project already knows — extracted **learnings** (patterns/pitfalls/observations, active + archived), the **architecture** map (components and how they connect), the **backlog** (features and their status), and prior **thinking** output. It reads across all of these, ranks by relevance, and returns a synthesized answer with sources — instead of the user grepping four stores by hand.

This is the read-only, cross-store counterpart to `shared/LEARNINGS-LOAD.md` (which loads a fixed scoped slice into a build skill's context). Here the query is the user's question, and the whole memory is in scope.

**Read-only**: this skill never writes to `.project/`. It answers questions; it does not record them.

## PHASE 0 — Pre-flight

1. **Question**: take it from the invocation argument. If empty, ask the user what they want to know (one short prompt) before continuing.
2. **Project check**: resolve `$REPO` to the **main worktree** (per `shared/SYNC.md` Worktree-aware Path Resolution) — the archive and stores live there, not in a feature worktree. If `$REPO/.project/` does not exist, stop with: _"No project memory here yet — run `/core-setup` first."_
3. **Language**: answer in the runtime language from `CLAUDE.md § User Preferences → Language:` (see `shared/LANGUAGE.md`). This SKILL.md stays English; the user-facing answer follows their setting.

## PHASE 1 — Gather (in parallel where possible)

Pull candidate evidence from each store. Keep each pull small — this is retrieval, not a dump.

**1a) Learnings (active + archive)** — the primary source. Run:

```bash
node ~/.claude/scripts/learnings-search.js "$REPO" search --query "<question>" --archive --json --cap 12
```

Returns scored entries `{date, feature, type, source, author, summary, tags, archived, score}`. These already blend active and archived memory, ranked by relevance (see `shared/LEARNINGS-LOAD.md § Relevance model`). If the question names a specific area, also pass `--tags <tag>` (a tag from `LEARNING-WRITE.md § Tag Vocabulary`) to sharpen the match.

**1b) Architecture** — read `$REPO/.project/project-context.json` → `architecture.components[]`. Keep components whose `name`, `description`, `feature`, `endpoints[]`, or `entities[]` match the question tokens. For each kept component report `name`, `layer`, `description`, and its `connects_to[]` edges (so "how does X reach Y" is answerable). Also scan `architecture.routes[]` when the question is about routing/pages.

**1c) Backlog** — read `$REPO/.project/backlog.json` → `features[]` (fields via `shared/BACKLOG-LOAD.md` if the file is large). Keep features whose `name`/`description`/`type` match the question; report `name`, `status`, `phase`, and `dependencies[]`. This answers "is X built / planned / blocked?". Include archived features (`.project/archive/backlog-archive.json`) only if the question implies shipped work.

**1d) Thinking output** — `Grep` `$REPO/.project/thinking/*.md` for question tokens in filenames and H1 headings (per `shared/DASHBOARD-CONTEXT.md § thinking-output` — filenames are `{date}-{type}-{slug}.md`). List matching docs by title + date; do not inline their full body.

If a store is empty or absent, skip it silently — never fabricate.

## PHASE 2 — Synthesize

Write a direct answer to the question, grounded only in what PHASE 1 returned. Structure:

1. **Answer first** — 1–3 sentences that actually answer the question. Lead with the conclusion.
2. **Supporting detail** — the relevant learnings/components/features in prose, not a raw dump. Prefer the highest-scored evidence; mention tags only when they aid the reader.
3. **`Sources:`** block — one line per claim-bearing item, so the user can verify:
   - learnings: `learning [date] feature — summary (archived?)`
   - architecture: `component <name> (project-context.json#architecture)`
   - backlog: `feature <name> — <status> (backlog.json)`
   - thinking: `<title> (.project/thinking/<file>.md)`
4. **Gaps** — if the memory has nothing relevant, say so plainly ("Project memory has nothing on X"); suggest where it would come from (a `/dev-ship` run, a `/project-research` doc). Do not pad with generic advice.

If a matching thinking doc looks central to the answer, offer to open it (the file is the source of truth, not a summary).

## Notes

- **Relevance, not recency**: ranking comes from `learnings-search.js` `scoreEntry()` — tag > feature > keyword, recency only as a tiebreak. An old but on-topic entry will surface; that is the point.
- **No writes, no side effects**: if the user's question reveals a missing learning, note it in the answer — recording it is a separate `/dev-ship` or `/dev-debug` concern, not this skill's.
- **Token discipline**: cap each store's pull (learnings `--cap 12`; a handful of components/features/docs). The answer is a synthesis, not a transcript.
