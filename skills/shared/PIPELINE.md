# Skill Pipeline

Read-only referentie — geen executable skill. Zie BACKLOG.md, FEATURE.md, en SYNC.md voor detail.

---

## Dev Pipeline

```
         /dev-todo ──┐
                     ▼
/dev-plan ──→ backlog.html
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

Frontend items slaan `defining/defined` over — design captures pages/flows, brief genereert context voor Claude Design, handoff bundle komt terug naar `/dev-build` als `building`.

---

## Skill Registry

| Skill        | Input                    | Output                      | Requires stage | Produces stage |
| ------------ | ------------------------ | --------------------------- | -------------- | -------------- |
| dev-plan     | concept / idee           | backlog.html                | —              | —              |
| dev-todo     | beschrijving             | backlog item                | —              | —              |
| dev-define   | backlog item / user reqs | feature.json (req + arch)   | —              | defined        |
| dev-build    | feature.json (defined)   | feature.json (code + tests) | defined        | built          |
| dev-verify   | feature.json (built)     | feature.json (verified)     | built          | DONE           |
| dev-refactor | feature.json (DONE)      | feature.json (DONE + ref)   | DONE           | DONE           |
| dev-debug    | error / symptom          | fix applied                 | —              | —              |
| dev-owasp    | —                        | security report + fixes     | —              | —              |

---

## State Machine

**Backlog status** (zie BACKLOG.md):

```
TODO → DOING → DONE
```

**Feature stage** (binnen DOING, zie FEATURE.md):

```
defining → defined → building → built → verifying → [DONE]
```

**feature.json requirement status**:

```
pending → built → PASS / FAIL
```

---

## Project Utilities

Niet pipeline-stappen, maar project-aware utilities. Standalone aanroepbaar.

| Skill           | Doel                                              |
| --------------- | ------------------------------------------------- |
| project-add     | Project registreren + symlinks naar claude-config |
| project-backlog | Lokale backlog/dashboard server (localhost:9876)  |
| project-pull    | Git pull + `.project/` sync + learning extractie  |
| project-remove  | Project deregistreren + cleanup                   |
| project-tunnel  | Dev server + Cloudflare Tunnel                    |
