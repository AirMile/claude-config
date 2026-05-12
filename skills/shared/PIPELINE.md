# Skill Pipeline

Read-only reference — not an executable skill. See BACKLOG.md, FEATURE.md, and SYNC.md for details.

---

## Dev Pipeline

```
         /project-todo ──┐
                        ▼
/project-plan ──→ backlog.html
                        │
                        ▼
                 /dev-define ──→ /dev-build ──→ /dev-verify ──→ [/dev-refactor]
                                      │              │
                                      └── /dev-debug ◄┘
```

Standalone (dev): `/dev-owasp` (security audit).

## Frontend Pipeline

```
/frontend-design (capture) ──→ /frontend-design (brief) ──→ Claude Design ──→ handoff → /dev-build
                                      │
                                      └─→ /frontend-convert (visual → code)
                                      └─→ /frontend-check (post-build checks — incl. --scope=a11y)
                                      └─→ [/core-setup [module]] (tools + libraries, incl. element picker)
```

Frontend items skip `defining/defined` — design captures pages/flows, brief generates context for Claude Design, handoff bundle returns to `/dev-build` as `building`.

---

## Skill Registry

| Skill        | Input                    | Output                      | Requires stage | Produces stage |
| ------------ | ------------------------ | --------------------------- | -------------- | -------------- |
| project-plan | concept / idea           | backlog.html                | —              | —              |
| project-todo | description              | backlog item                | —              | —              |
| dev-define   | backlog item / user reqs | feature.json (req + arch)   | —              | defined        |
| dev-build    | feature.json (defined)   | feature.json (code + tests) | defined        | built          |
| dev-verify   | feature.json (built)     | feature.json (verified)     | built          | DONE           |
| dev-refactor | feature.json (DONE)      | feature.json (DONE + ref)   | DONE           | DONE           |
| dev-debug    | error / symptom          | fix applied                 | —              | —              |
| dev-owasp    | —                        | security report + fixes     | —              | —              |

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

| Skill           | Purpose                                             |
| --------------- | --------------------------------------------------- |
| project-add     | Register project + create symlinks to claude-config |
| project-backlog | Local backlog/dashboard server (localhost:9876)     |
| project-pull    | Git pull + `.project/` sync + learning extraction   |
| project-remove  | Deregister project + cleanup                        |
| project-tunnel  | Dev server + Cloudflare Tunnel                      |
