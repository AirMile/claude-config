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

Standalone: `/dev-doctor` (codebase health), `/dev-owasp` (security audit), `/dev-server` (dev server + tunnel).

## Frontend Pipeline

```
/frontend-plan ──→ /frontend-compose ──→ /frontend-audit ──→ [/frontend-iterate]
                   /frontend-convert      /frontend-wcag
```

Frontend items slaan `defining/defined` over — plan maakt TODOs, compose pakt direct op als `building`.

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
| dev-doctor   | —                        | improvement plan            | —              | —              |
| dev-owasp    | —                        | security report + fixes     | —              | —              |
| dev-server   | —                        | running server + tunnel URL | —              | —              |

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
