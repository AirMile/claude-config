# Dev Debug — Problem Intake (PHASE 1)

Full intake protocol: classify the problem type, ask type-specific detail questions, confirm the summary. Outcome: confirmed problem summary (type + symptom + context + details) — input for the PHASE 2 investigation agent.

---

## Step 1: Classify

AskUserQuestion:

- header: "Problem Type"
- question: "What type of problem is this?"
- options:
  - "Runtime Error" — Crashes, exceptions, error messages in console or UI
  - "Logic Bug" — Wrong output, unexpected behavior
  - "Visual / UI" — Layout, styling, spacing, color, responsive — looks wrong (not a crash)
  - "Performance / Integration" — Slow, memory, timeouts, or API/DB/external-system failures

("Performance / Integration" splits back into its two detail branches in Step 2.)

## Step 2: Details (per type)

**Runtime Error:**
AskUserQuestion:

- header: "Error Details"
- question: "What information do you have about the error?"
- options:
  - "I have an error message" — Exact error message available
  - "I have a stack trace" — Full stack trace available
  - "I have both" — Error message and stack trace
  - "I only have a screenshot" — Visual representation

Then: ask user to share the details.

**Logic Bug:**
AskUserQuestion:

- header: "Behavior Details"
- question: "Describe the difference between expected and actual behavior:"
- options:
  - "I know exactly what is going wrong" — Expected vs actual describable
  - "Output is wrong" — Wrong value or display
  - "Action does not work" — Button, form, interaction fails
  - "Data is incorrect" — Wrong data shown or saved

Then: ask for specific expected vs actual behavior.

**Visual / UI:**
AskUserQuestion:

- header: "Visual Details"
- question: "What's wrong visually?"
- options:
  - "Wrong position / layout" — Element misplaced, overlap, wrong order, layout shift
  - "Wrong size / spacing" — Padding, margin, dimensions, alignment off
  - "Wrong style" — Color, font, border, state (hover/active), dark mode
  - "Responsive / breakpoint" — Breaks at a viewport size or device

Then: ask which element/page, expected vs seen (one line), whether a screenshot is available, and
whether it reproduces consistently. Most Visual/UI issues are MEASURABLE (a direct value fix) —
carry that into PHASE 7's testability step (Playwright visual baseline / DOM assertion / no test).

**Performance / Integration → Performance Issue:**
AskUserQuestion:

- header: "Performance Details"
- question: "When does the performance problem occur?"
- options:
  - "On a specific action" — Certain page, button click, or data load
  - "Always slow" — Consistently slow application
  - "Over time" — Starts fast, becomes slower (memory leak)
  - "With large datasets" — Only slow with large amounts of data

Then: ask about scale/context details. (If the user picked "Performance / Integration" but the
symptom is an API/DB/external failure rather than slowness, use the Integration branch below instead.)

**Performance / Integration → Integration Issue:**
AskUserQuestion:

- header: "Integration Details"
- question: "Which external system is involved?"
- options:
  - "REST API" — HTTP endpoints, fetch calls
  - "Database" — Supabase, Firebase, other DB
  - "Third-party service" — Auth, payment, analytics
  - "File system / Storage" — Uploads, downloads, cloud storage

Then: ask for API/service details and error responses.

## Step 3: Confirm summary

Show summary of type + symptom + context + details gathered.

AskUserQuestion:

- header: "Confirmation"
- question: "Is this problem summary correct?"
- options:
  - "Yes, start investigation (Recommended)" — Start inline investigation
  - "No, correction needed" — Provide more details or corrections

If "No, correction needed" → ask for corrections, update summary, re-confirm.
