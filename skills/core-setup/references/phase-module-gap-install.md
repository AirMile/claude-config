# Module Gap Install (mature PHASE 5.8)

**Inputs**: `gapChoices` from `.project/session/onboard-state.json` (persisted in PHASE 0.6). Loaded only when that list is non-empty (check stays in mode-mature.md).

**Once:**

```
Read("references/mode-install.md")
```

**Per module in `gap_choices[]`:** follow only `mode-install.md` **PHASE 5** steps 0-5 (state check → install → configure → verify → sync project context). **Skip the TaskCreate of 7 items at the top of mode-install.md** — that belongs to standalone install mode. Work the steps inline within this mature TaskCreate item; do not add a new TaskList and do not mutate mature todos.

If mode-install.md refers to its own PHASE 0/1/2/3/4/6/7 — skip those. Those are for standalone install runs.

Remember installed modules as `installed_in_session[]` for use in PHASE 6 report. One pass — no automatic repeat.

**Cleanup:**

```bash
rm -f .project/session/onboard-state.json
```

**Not in scope:**

- Research-mode libraries (Path B) — users who want non-tier-1 must use `/core-setup [free-text]`
- Categories without a stack slot (Routing, Animation, Icons, Auth, i18n, Analytics)

When done: return to PHASE 5.85.
