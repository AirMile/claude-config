---
name: core-queue
description: Schedule a skill+prompt for one-shot execution at a delay or specific time. Use with /queue [skill] [prompt] [time], /queue list, or /queue cancel [id].
argument-hint: "[skill] [prompt] [time] | list | cancel [id]"
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: core
---

# Queue

Schedule a skill with a prompt for one-shot execution at a future time.

## Trigger

`/queue` with subcommands:

- `/queue [skill] [prompt] [timing]` — schedule a skill for later execution
- `/queue list` — show all queued items
- `/queue cancel [id]` — cancel a queued item

## Process

### 1. Parse Input

Detect which subcommand the user invoked from the arguments:

- Argument is `list` or empty → **List flow**
- Argument starts with `cancel` → **Cancel flow**
- Otherwise → **Add flow**

### 2. Add Flow

Parse three parts from the arguments:

1. **Skill name** — first word (with or without `/` prefix)
2. **Prompt** — everything between skill name and timing (quoted or unquoted)
3. **Timing** — last token, one of:
   - Delay: `30m`, `2h`, `1h30m`, `45m` (regex: `(\d+h)?(\d+m)?`)
   - Absolute: `14:00`, `9:30` (regex: `\d{1,2}:\d{2}`)

**Convert timing to cron expression:**

For **delay** timing:

1. Get current time in user's local timezone (CET/CEST — UTC+2 in summer, UTC+1 in winter)
2. Add the delay to get target time
3. Build pinned cron: `{minute} {hour} {day} {month} *`
4. Nudge by 1-2 minutes if landing on :00 or :30 (per CronCreate conventions)

For **absolute** timing:

1. Parse hour and minute from the time string
2. Determine if the time is today or tomorrow (if the time has already passed today, schedule for tomorrow)
3. Build pinned cron: `{minute} {hour} {day} {month} *`
4. Nudge by 1-2 minutes if landing on :00 or :30

**Create the cron job:**

Use **CronCreate** with:

- `cron`: the computed cron expression
- `prompt`: `/{skill} {prompt}` (the slash command to execute)
- `recurring`: `false` (one-shot, auto-deletes after firing)
- `durable`: `true` (survives session restarts)

**Output confirmation:**

```
QUEUED

| Item    | Value                        |
| ------- | ---------------------------- |
| Skill   | /{skill}                     |
| Prompt  | {prompt}                     |
| Runs at | {HH:MM} on {date}           |
| Job ID  | {id from CronCreate}         |

Cancel with: /queue cancel {id}
```

### 3. List Flow

Call **CronList** to retrieve all scheduled jobs.

Filter to only show durable one-shot jobs (queue items).

**If empty:**

```
Queue is leeg. Plan iets in met: /queue [skill] [prompt] [timing]
```

**If items exist**, display as table:

```
QUEUE

| #  | Skill       | Prompt              | Runs at       | ID     |
| -- | ----------- | ------------------- | ------------- | ------ |
| 1  | /dev-build  | bouw de login pagi… | 14:32 vandaag | abc123 |
| 2  | /dev-verify | run alle tests      | 09:00 morgen  | def456 |
```

### 4. Cancel Flow

Parse the job ID from arguments (word after `cancel`).

Call **CronDelete** with the provided ID.

**Output:**

```
CANCELLED: job {id} removed from queue.
```

If the ID is not found, inform the user and suggest `/queue list` to see valid IDs.
