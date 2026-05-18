# Route: Restore (Restore Checkpoint)

Load this file when the user selects the Restore route. Only available if `.project/session/design-history.json` exists and is not empty.

---

## Step 1: Load Checkpoints

Read `.project/session/design-history.json`.

- If the file does not exist or is empty → show message and stop:
  ```
  ℹ No checkpoints available. Changes are only saved after the first write.
  ```

## Step 2: Choose Checkpoint

Show the 4 most recent checkpoints as options:

```yaml
header: "Restore"
question: "Which checkpoint do you want to restore?"
options:
  - label: "{HH:mm DD-MM}", description: "{trigger} — {N} pages, {M} flows"
  # max 4 entries
multiSelect: false
```

## Step 3: Show Diff

```
RESTORE PREVIEW
════════════════════════════════════════════════
Current: {N} pages, {M} flows, {P} principles
Restore: {N} pages, {M} flows, {P} principles

Removed:  {page/flow names that are gone in checkpoint}
Added:    {page/flow names that are new in checkpoint}
════════════════════════════════════════════════
```

## Step 4: Confirm + Write

```yaml
header: "Restore"
question: "Are you sure you want to restore to this checkpoint?"
options:
  - label: "No, cancel (Recommended)", description: "Keep current state"
  - label: "Yes, restore", description: "Overwrite current design spec"
multiSelect: false
```

On "Yes": write `snapshot` from the chosen checkpoint back to `project.json → design`. Go directly to PHASE X.1 (Write) + PHASE X.2 (Validate) — skip X.0.
