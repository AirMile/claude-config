# Skill Pipeline

Read-only reference — not an executable skill. See BACKLOG.md, FEATURE.md, and SYNC.md for details.

---

## Dev Pipeline

```
[/project-research] ───────────────────────────┐
                                               │
/project-seed ─────────────────────────────────┤
  (thin: task / assignment / large feature)    │
  (rich: concept / product / game)             ▼
                                       project-seed.md
               [/project-brainstorm] ──────────┤
               [/project-critique]  ───────────┤
                                               ▼
                                 /project-plan ──→ backlog.json
                                               │
                                               ▼
                        /dev-ship (running define → build → verify → [refactor])
                                             │
                                             └── /dev-debug
```

Standalone (dev): `/dev-security` (security audit).

## Design Pipeline

```
/project-plan ──► THEME tasks (transition: "defining")
                                      │
                                      ▼
                     /design-tokens ──► design tokens + motion packs (Apple/Material/Fluent/Carbon),
                          │              spring physics, choreography, glass surfaces
                          │              → writes project.json#theme + devinfo.tokenDrift
                          ▼
/project-plan ──► PAGE/COMPONENT tasks (transition: "designing" | "converting")
                                      │
                                      ▼
                     /design-create (Build) ──► compose: select features + components
                          │                           │
                          │                           └── "+ new component/feature" → /project-todo (smart-todo)
                          │
                          └─→ /design-create (brief) ──→ Claude Design ──→ handoff
                          └─→ /design-create (visual → code — Convert route)
                          └─→ clears devinfo.tokenDrift.affectedFeatures on completion
                          │
                          ▼
                     /design-ship (check phase) ──► runtime: perf/SEO/A11Y/responsive/motion audit
```

**Recommended order: build dev-features first, then compose PAGEs.**

PAGE-design gets a selection menu showing all features (any status) + existing components. Features not yet DONE render as TODO-markers in the generated code — refinement pass after build completes.

Design items skip `defining/defined` — design captures pages/flows, Build generates code directly.

## Cross-track rules

| Item type            | Responsible skill                                                            | The other track must not                                |
| -------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------- |
| FEATURE (data/logic) | dev-ship (define → build)                                                    | design-create builds it                                 |
| FEATURE (with UI)    | dev-ship (define → build, token-styled UI — functional + presentably styled) | dev-ship's build phase writes styled/designed UI        |
| COMPONENT            | dev-ship (define → build, token-styled) → design-create (optional layout)    | dev-ship's build phase writes styled/designed component |
| PAGE                 | design-create                                                                | dev-ship's build phase builds it                        |
| THEME                | design-tokens (incl. motion packs)                                           | —                                                       |

**dev-ship's build phase** delivers: data layer, hooks, API, types, tests + token-styled UI (semantic HTML + design tokens). Pages and components are testable via `/dev-ship` (verify phase). `/design-create` is optional for layout reshaping (sidebar/hero/grid).

---

## Skill Registry

| Skill                     | Input                            | Output                      | Requires stage | Produces stage |
| ------------------------- | -------------------------------- | --------------------------- | -------------- | -------------- |
| project-research          | topic / question                 | research findings           | —              | —              |
| project-plan              | seed document / task description | backlog.json                | —              | —              |
| project-todo              | description                      | backlog item                | —              | —              |
| dev-ship (define phase)   | backlog item / user reqs         | feature.json (req + arch)   | —              | defined        |
| dev-ship (build phase)    | feature.json (defined)           | feature.json (code + tests) | defined        | built          |
| dev-ship (verify phase)   | feature.json (built)             | feature.json (verified)     | built          | DONE           |
| dev-ship (refactor phase) | feature.json (DONE)              | feature.json (DONE + ref)   | DONE           | DONE           |
| dev-debug                 | error / symptom                  | fix applied                 | —              | —              |
| dev-security              | —                                | security report + fixes     | —              | —              |

---

## State Machine

**Backlog status** (see BACKLOG.md):

```
TODO → DOING → DONE
```

**Feature stage** (within DOING, see FEATURE.md):

```
defining → defined → building → built → verifying → [DONE]
```

**feature.json requirement status**:

```
pending → built → PASS / FAIL
```

---

## Project Utilities

Not pipeline steps, but project-aware utilities. Callable standalone.

| Skill          | Purpose                                             |
| -------------- | --------------------------------------------------- |
| project-add    | Register project + create symlinks to claude-config |
| project-viewer | Local backlog/dashboard server (localhost:9876)     |
| core-pull      | Git pull + `.project/` sync + learning extraction   |
| project-remove | Deregister project + cleanup                        |
| project-tunnel | Dev server + Cloudflare Tunnel                      |
