# Technique: Implementation First

## When to use

- CRUD operations, middleware, straightforward features
- Clear requirements where architecture is obvious
- Features where the shape is well-understood upfront

## Single Requirement Workflow

### Step 1: Implement

Implement THIS requirement fully. Context7 research if needed.
Verify it works (manual check or quick run).

### Step 2: Write Test

Generate test for the implemented requirement.
Run test — fix implementation if FAIL.

### Output

```
REQ-XXX: {description}
IMPLEMENTED: {what was built}
TESTED: PASS
Files: {files created/modified}
```
