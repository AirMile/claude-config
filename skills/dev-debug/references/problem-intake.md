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
  - "Performance Issue" — Slow, memory leaks, timeouts
  - "Integration Issue" — API failures, data sync, external systems

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

**Performance Issue:**
AskUserQuestion:

- header: "Performance Details"
- question: "When does the performance problem occur?"
- options:
  - "On a specific action" — Certain page, button click, or data load
  - "Always slow" — Consistently slow application
  - "Over time" — Starts fast, becomes slower (memory leak)
  - "With large datasets" — Only slow with large amounts of data

Then: ask about scale/context details.

**Integration Issue:**
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
