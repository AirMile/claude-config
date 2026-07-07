# Sample feature — plan file (compact appendix variant)

## Context

Same fixture data as plan-valid.md, but the appendix is authored as compact single-line JSON —
verifies the extractor is indifferent to formatting.

## Requirements

- REQ-001: Do the thing

## Appendix — machine contract (skip review)

```json
{"name": "sample-feature", "status": "DEFINED", "created": "2026-01-01", "depends": [], "summary": "A sample feature.", "requirements": [{"id": "REQ-001", "description": "Do the thing", "acceptance": [{"when": "user acts", "then": "thing happens", "category": "happy"}], "status": "pending"}], "files": [{"path": "src/thing.ts", "type": "logic", "action": "CREATE", "purpose": "does the thing", "requirements": ["REQ-001"]}], "architecture": {"componentTree": "Thing", "interfaces": []}, "buildSequence": [{"step": 1, "requirements": ["REQ-001"], "description": "build it", "dependsOn": []}], "testStrategy": []}
```
