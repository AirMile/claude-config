# Ship checkpoint — why it exists (rationale)

Not needed to write or read the checkpoint — see `shared/SHIP-CHECKPOINT.md` for the schema and
write points. This doc is background only.

Canonical checkpoint mechanism for the auto-mode ship pipelines (`dev-ship`, `design-ship`,
`game-ship`). It makes any interruption — **credits exhausted, crash, killed process, or a mid-run
stop** — a resumable pause: the run's coarse state (`backlog.status`, worktree, `.project/`) already
survives on disk, and this checkpoint adds the **fine-grained run state** (which phase completed,
the PHASE 0 selections, the structured agent results) that otherwise lives only in the main-chat
context and is lost on a full session end. The same machinery also powers a **deliberate handoff
pause**: dev/game stop on purpose at the PHASE 2→3 boundary when auto-verify leaves manual items,
parking the run so the expensive interactive phase (manual tests / playtest) resumes on a fresh,
cheap session instead of on top of the whole build+verify transcript.

**Single writer.** The main chat is the checkpoint's **only writer**, throughout the whole run — it
launches the PHASE 1+2 / PHASE 4 Workflows itself and picks the write back up on each
task-notification (there is no intermediate orchestrator agent: a background subagent cannot call
the Workflow tool, so routing this through a spawned agent bought nothing but an extra hop). Worker
subagents (build, verify, refactor, scanners, fix) never touch the checkpoint
(non-interactive-contract rule 1: the ship skill owns phase tracking). The pipeline is sequential and
the main chat is the sole writer throughout — no write-races.

**Not `SHIP_CONTEXT`.** The checkpoint stores only the **irreproducible** state: the user's PHASE 0
choices (`plan`) and the agent results. `SHIP_CONTEXT` is deliberately **not** stored — it is cheap
to re-derive from disk (`PROJECT-CONTEXT-LOAD` + `LEARNINGS-LOAD`) on resume.
