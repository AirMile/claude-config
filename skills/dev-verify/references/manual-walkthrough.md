# Manual Walkthrough

**When:** there are MANUAL items. By definition MANUAL = human perception/judgment, auth
with real credentials, physical-device tests, or audio/screen-reader checks. Visual polish,
motion smoothness, and design feel are NOT verified here — those belong to frontend-design /
frontend-build.

**Playwright smoke pre-check** — for each MANUAL item: if the item is DOM-observable
(navigate + check load / element-present / no-console-error / screenshot), Claude runs it
first via the playwright-cli daemon (see `references/test-classification.md → AUTO/BROWSER`):

- Pass + clear screenshot → present screenshot as evidence, AskUserQuestion: Confirm Pass
  (Recommended) | Mark Fail | Inspect manually
- Fail / error → skip to the per-item walkthrough below with the failure as context

Only items that need real human judgment (auth flows requiring real credentials, perception,
audio, physical-device) skip the smoke pre-check entirely.

Show setup once (e.g. "Open {devServerUrl}"). Per MANUAL item (if smoke skipped or smoke
failed):

```
──────────────────────────────────────
MANUAL TEST {n}/{total}: {title}
──────────────────────────────────────

STEPS:
1. {concrete action with data}

TEST DATA:
{table with fields + values}

EXPECTED:
→ {expected outcome}
```

AskUserQuestion per item: Pass (Recommended) | Fail | Skip | Defer.

- Fail → ask briefly what went wrong
- Skip → note reason ("not testing, accept as-is")
- Defer → ask which external prereq blocks it (account, CORS-origin, API-token,
  third-party config); item stays open for re-test when prereq landed
