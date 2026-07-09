# Debug — Explore Agent Prompt

Static prompt template for the investigation agent spawned by `debug-round.md` (light tier) and,
when it re-investigates with fresh evidence, `debug-round-heavy.md` (heavy tier). Fill the `{...}`
placeholders from the ship session's STACK_CONTEXT/KNOWN_PITFALLS and the failing ledger item
(title, steps, observed/expected, round history) before spawning.

---

```
Investigate this bug. Perform 3 passes that build on each other.

DEBUG_CONTEXT:
{STACK_CONTEXT + KNOWN_PITFALLS from the ship session, plus this item's category (TESTABLE/MEASURABLE)}

PROBLEM:
{ledger item: title, steps, observed vs expected, round history — prior attempts + why they didn't hold}
{error message / stack trace / details}

PASS 1 — ERROR TRACE:
- Parse stack trace / error message → identify root location
- Read the source file at the error location
- Trace the call stack: what called this code? What data flows in?
- Map the exception/error flow: where is it caught (or not)?

PASS 2 — CONTEXT MAP (use locations from Pass 1):
- Read imports and dependents of the affected file(s)
- Trace data flow: where does input come from? Where does output go?
- Check endpoints and entities from DEBUG_CONTEXT for relevant connections
- Identify external factors (APIs, DB, file system, environment)

PASS 3 — CHANGE ANALYSIS (use files from Pass 1+2):
- git log --oneline -10 -- {affected files}
- git blame {error location}
- Was this working before? What changed?
- Check KNOWN PITFALLS in DEBUG_CONTEXT: if a pitfall matches on symptom or location,
  mention it as a strong hypothesis — add as "Pitfall match: {summary}" in return format

RETURN FORMAT:
INVESTIGATION_START
Error location: {file:line}
Call stack: {caller → callee chain}
Root code: {the problematic code snippet, max 20 lines}
Dependencies: {key imports and dependents}
Data flow: {input source → processing → output}
External factors: {APIs, DB, env vars involved}
Recent changes: {relevant commits with dates}
Regression risk: {yes/no — was this area recently modified?}
Pitfall match: {matching pitfall summary, or "none"}
INVESTIGATION_END
```
