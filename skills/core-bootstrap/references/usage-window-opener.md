# Usage-window opener routine

Creates an optional daily cloud routine (via the `RemoteTrigger` harness tool) that pings a
minimal Haiku turn three times a day, so the account's rolling 5-hour usage window starts at
predictable anchors instead of drifting with whenever the user happens to first prompt.

This step is **best-effort**: any failure here must never block the rest of bootstrap. Set
`WINDOW_OPENER_STATUS` to the outcome and return to PHASE 3 — do not retry loops, do not ask
follow-up questions.

## Steps

1. **Load the tool.** `ToolSearch({query: "select:RemoteTrigger", max_results: 1})`. If it isn't
   returned → `WINDOW_OPENER_STATUS="skipped (RemoteTrigger unavailable)"`, stop here.

2. **Dedup — check for an existing routine first.** Routines are per-account, not per-machine;
   re-running bootstrap on a second machine (or a second time on this one) must not create a
   duplicate.

   ```
   RemoteTrigger({action: "list"})
   ```

   Scan the returned routines for `name == "Daily usage-window opener"`. If found →
   `WINDOW_OPENER_STATUS="already-exists (account)"`, stop here (do not create, do not update).

3. **Derive the source repo.** Use the config repo's own git remote — it's small and fast to
   check out, and the routine's task doesn't read it anyway:

   ```bash
   git -C "$CONFIG_REPO" remote get-url origin 2>/dev/null
   ```

   If this returns a URL, normalize it to `https://github.com/<org>/<repo>` (strip `.git`,
   convert `git@github.com:` SSH form to `https://github.com/`). If there is no `origin` remote
   (e.g. a fresh local-only clone) → `WINDOW_OPENER_STATUS="skipped (no git remote found)"`, stop
   here — don't guess a repo URL.

4. **Pick an environment.** `RemoteTrigger({action: "list"})` responses and the `/schedule` skill
   both surface available environments; if none are discoverable this way, fall back to asking
   the user once via `AskUserQuestion` (same shape as `/schedule`'s environment question). Prefer
   reusing whatever the account's first `anthropic_cloud`-kind environment is.

5. **Create the routine.**

   ```
   RemoteTrigger({
     action: "create",
     body: {
       name: "Daily usage-window opener",
       cron_expression: "0 6,16,21 * * *",
       enabled: true,
       job_config: {
         ccr: {
           environment_id: "<resolved environment id>",
           session_context: {
             model: "claude-haiku-4-5-20251001",
             sources: [{ git_repository: { url: "<resolved repo URL>" } }],
             allowed_tools: []
           },
           events: [{
             data: {
               uuid: "<fresh lowercase v4 uuid>",
               session_id: "",
               type: "user",
               parent_tool_use_id: null,
               message: {
                 content: "Reply with exactly the single word: ready. Do not use any tools, do not read any files.",
                 role: "user"
               }
             }
           }]
         }
       }
     }
   })
   ```

   Notes:
   - `cron_expression: "0 6,16,21 * * *"` is UTC and equals **08:00 / 18:00 / 23:00
     Europe/Amsterdam** in summer (CEST, UTC+2). In winter (CET, UTC+1) the same cron fires an
     hour earlier locally (07:00 / 17:00 / 22:00) — cloud cron is fixed UTC and does not follow
     DST. Mention this in the PHASE 3 report tip.
   - The API may expand `allowed_tools: []` into its full default tool preset rather than
     honoring an empty list. This is harmless here — the prompt explicitly instructs the agent
     not to use any tools, so cost stays minimal regardless.
   - Generate the UUID fresh for this call (do not reuse one from another routine).

6. **Report.** On success, set `WINDOW_OPENER_STATUS="created"` and capture the routine id from
   the response (`trigger.id`) so PHASE 3 can show the link:
   `https://claude.ai/code/routines/{id}`.

   On any API error, set `WINDOW_OPENER_STATUS="skipped (<short reason>)"` — do not retry, do not
   surface a stack trace, just move on to PHASE 3.

## What this does NOT do

- Does not touch or update an existing routine of the same name — if the user wants different
  tick times or a different model, point them at https://claude.ai/code/routines or the
  `/schedule` skill to adjust it directly.
- Does not delete routines (the harness API has no delete; same limitation `/schedule` documents).
