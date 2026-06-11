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
                                 /project-backlog ──→ backlog.json
                                               │
                                               ▼
                        /dev-define ──→ /dev-build ──→ /dev-verify ──→ [/dev-refactor]
                                             │               │
                                             └── /dev-debug ◄┘
```

Standalone (dev): `/dev-security` (security audit).

## Frontend Pipeline

```
/project-backlog ──► THEME tasks (transition: "defining")
                                      │
                                      ▼
                     /frontend-tokens ──► design tokens + motion packs (Apple/Material/Fluent/Carbon),
                          │              spring physics, choreography, glass surfaces
                          │              → writes project.json#theme + devinfo.tokenDrift
                          ▼
/project-backlog ──► PAGE/COMPONENT tasks (transition: "designing" | "converting")
                                      │
                                      ▼
                     /frontend-design (Build) ──► compose: select features + components
                          │                           │
                          │                           └── "+ new component/feature" → /project-todo (smart-todo)
                          │
                          └─→ /frontend-design (brief) ──→ Claude Design ──→ handoff
                          └─→ /frontend-design (visual → code — Convert route)
                          └─→ clears devinfo.tokenDrift.affectedFeatures on completion
                          │
                          ▼
                     /frontend-check (batch at release end) ──► runtime: perf/SEO/A11Y/responsive/motion audit
```

**Recommended order: build dev-features first, then compose PAGEs.**

PAGE-design gets a selection menu showing all features (any status) + existing components. Features not yet DONE render as TODO-markers in the generated code — refinement pass after build completes.

Frontend items skip `defining/defined` — design captures pages/flows, Build generates code directly.

## Cross-track rules

| Item type            | Responsible skill                                                          | The other track must not                   |
| -------------------- | -------------------------------------------------------------------------- | ------------------------------------------ |
| FEATURE (data/logic) | dev-define → dev-build                                                     | frontend-design builds it                  |
| FEATURE (with UI)    | dev-define → dev-build (token-styled UI — functional + presentably styled) | dev-build writes styled/designed UI        |
| COMPONENT            | dev-define → dev-build (token-styled) → frontend-design (optional layout)  | dev-build writes styled/designed component |
| PAGE                 | frontend-design                                                            | dev-build builds it                        |
| THEME                | frontend-tokens (incl. motion packs)                                       | —                                          |

**dev-build** delivers: data layer, hooks, API, types, tests + token-styled UI (semantic HTML + design tokens). Pages and components are testable via `/dev-verify`. `/frontend-design` is optional for layout reshaping (sidebar/hero/grid).

---

## Skill Registry

| Skill            | Input                            | Output                      | Requires stage | Produces stage |
| ---------------- | -------------------------------- | --------------------------- | -------------- | -------------- |
| project-research | topic / question                 | research findings           | —              | —              |
| project-backlog  | seed document / task description | backlog.json                | —              | —              |
| project-todo     | description                      | backlog item                | —              | —              |
| dev-define       | backlog item / user reqs         | feature.json (req + arch)   | —              | defined        |
| dev-build        | feature.json (defined)           | feature.json (code + tests) | defined        | built          |
| dev-verify       | feature.json (built)             | feature.json (verified)     | built          | DONE           |
| dev-refactor     | feature.json (DONE)              | feature.json (DONE + ref)   | DONE           | DONE           |
| dev-debug        | error / symptom                  | fix applied                 | —              | —              |
| dev-security     | —                                | security report + fixes     | —              | —              |

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
