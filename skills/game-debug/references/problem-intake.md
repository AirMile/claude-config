# Game Debug — Problem Intake (PHASE 1)

Full intake protocol: classify the problem type, ask type-specific detail questions, confirm the summary. Outcome: confirmed problem summary (type + symptom + context + details) — input for the PHASE 2 investigation agent.

---

## Step 1: Classify

AskUserQuestion:

- header: "Problem Type"
- question: "What type of problem is this?"
- options:
  - "Runtime Error" — Crashes, GDScript errors, null references
  - "Logic Bug" — Wrong game behavior, state issues
  - "Performance Issue" — FPS drops, memory leaks, physics lag
  - "Scene/Signal Issue" — Node connections, signal flow, scene tree problems

## Step 2: Details (per type)

**Runtime Error:**
AskUserQuestion:

- header: "Error Details"
- question: "What information do you have about the error?"
- options:
  - "I have an error message" — Exact error from Godot console
  - "I have a stack trace" — Full stack trace available
  - "I have both" — Error message and stack trace
  - "I only have a screenshot" — Visual representation of the error

Then: ask user to share the details.

**Logic Bug:**
AskUserQuestion:

- header: "Behavior Details"
- question: "Describe the difference between expected and actual behavior:"
- options:
  - "I know exactly what is going wrong" — Expected vs actual describable
  - "Game state is wrong" — Wrong values, wrong state
  - "Action does not work" — Input, collision, ability fails
  - "Timing/order is wrong" — Things happen at wrong moment

Then: ask for specific expected vs actual behavior.

**Performance Issue:**
AskUserQuestion:

- header: "Performance Details"
- question: "When does the performance problem occur?"
- options:
  - "On specific action" — Certain ability, collision, or scene load
  - "Always slow" — Consistently low FPS
  - "Over time" — Starts smooth, becomes slower (memory leak)
  - "With many nodes" — Only slow with many instances

Then: ask about scale/context details.

**Scene/Signal Issue:**
AskUserQuestion:

- header: "Scene/Signal Details"
- question: "What type of connection problem is this?"
- options:
  - "Signal not received" — Signal emitted but receiver does not respond
  - "Node not found" — get_node() or @onready fails
  - "Scene tree corrupt" — Nodes disappear, wrong parent, orphans
  - "Connect/disconnect" — Signals not connecting or disconnecting correctly

Then: ask for node paths, signal names, scene structure.

## Step 3: Confirm summary

Show summary of type + symptom + context + details gathered.

AskUserQuestion:

- header: "Confirmation"
- question: "Is this problem summary correct?"
- options:
  - "Yes, start investigation (Recommended)" — Start inline investigation
  - "No, correction needed" — Provide more details or corrections

If "No, correction needed" → ask for corrections, update summary, re-confirm.
