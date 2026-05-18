# Validation Templates

Reusable validation patterns for all skills. Reference document for pre-flight and post-flight checks.

---

## Pre-Flight Checklist Pattern

Run these checks **BEFORE** expensive operations start (agents, file generation, API calls).

### 1. Context Validation

```markdown
**Context Check:**

- [ ] Required input files present
- [ ] Dependencies available (other skills output)
- [ ] User confirmation obtained where needed
```

**Implementation:**

```
PRE-FLIGHT: Context
-------------------
Input files: [✓|✗] [file] - [status]
Dependencies: [✓|✗] [dependency] - [status]
Confirmation: [✓|✗] [action] - [status]
```

### 2. Resource Validation

```markdown
**Resource Check:**

- [ ] Output directory exists or can be created
- [ ] Write permissions available
- [ ] No conflicting processes
- [ ] context7 MCP available (if needed)
```

**Implementation:**

```
PRE-FLIGHT: Resources
---------------------
Directory: [✓|✗] [path] - [writable|readonly|missing]
Tools: [✓|✗] [tool] - [available|unavailable]
Conflicts: [✓|✗] [process] - [status]
```

### 3. Scope Validation

```markdown
**Scope Check:**

- [ ] Input parameters valid
- [ ] Output paths correct
- [ ] No overwrite conflicts
```

**Implementation:**

```
PRE-FLIGHT: Scope
-----------------
Parameters: [✓|✗] [param] = [value] - [valid|invalid]
Output: [✓|✗] [path] - [available|exists|conflict]
```

### Pre-Flight Summary

```
═══════════════════════════════════════
PRE-FLIGHT CHECK COMPLETE
═══════════════════════════════════════
Context:   [✓ PASS | ✗ FAIL]
Resources: [✓ PASS | ✗ FAIL]
Scope:     [✓ PASS | ✗ FAIL]

Status: [→ Ready to proceed | ⚠ Issues found]
═══════════════════════════════════════
```

---

## Post-Flight Verification Pattern

Run these checks **AFTER** generation/modification operations.

### 1. Existence Checks

```markdown
**Existence Check:**

- [ ] All expected files created
- [ ] No empty or corrupt outputs
- [ ] File sizes realistic
```

**Implementation:**

```
POST-FLIGHT: Existence
----------------------
Files created: [N]/[M] expected
- [✓|✗] [file] - [size] bytes
Empty files: [N] detected
Corrupt files: [N] detected
```

### 2. Structural Validation

```markdown
**Structural Check:**

- [ ] Files parseable (HTML valid, JSON valid, etc.)
- [ ] Required sections present
- [ ] Encoding correct (UTF-8)
```

**Implementation:**

```
POST-FLIGHT: Structure
----------------------
Parse status:
- [✓|✗] [file] - [valid|invalid] [format]
Required sections:
- [✓|✗] [section] in [file]
```

### 3. Semantic Validation

```markdown
**Semantic Check:**

- [ ] Content matches intent
- [ ] No placeholder/template variables remaining
- [ ] Internal references correct
```

**Implementation:**

```
POST-FLIGHT: Semantic
---------------------
Placeholders: [N] remaining (should be 0)
- [file:line] - {{placeholder}}
References:
- [✓|✗] [link] → [target]
```

### Post-Flight Summary

```
═══════════════════════════════════════
POST-FLIGHT CHECK COMPLETE
═══════════════════════════════════════
Existence:  [✓ PASS | ✗ FAIL] - [N]/[M] files
Structure:  [✓ PASS | ✗ FAIL] - [N] valid
Semantic:   [✓ PASS | ✗ FAIL] - [N] issues

Status: [→ Complete | ⚠ Recovery needed]
═══════════════════════════════════════
```

---

## Error Recovery Patterns

### Retry Strategy

```
RETRY POLICY
────────────
Max retries: 2
Backoff: 1s → 3s (exponential)
Strategy per retry:
  - Retry 1: Same approach, fresh context
  - Retry 2: Simplified approach / alternative
  - After 2: Graceful degradation or manual mode
```

**Implementation:**

```markdown
### On Failure - Retry Sequence

1. **Immediate Retry (attempt 2/3)**
   - Clear caches
   - Fresh tool context
   - Same parameters

2. **Alternative Approach (attempt 3/3)**
   - Simplified parameters
   - Fallback method
   - Reduced scope

3. **Manual Mode**
   - Provide clear instructions
   - Export partial work
   - User completes manually
```

### Graceful Degradation

```
DEGRADATION LEVELS
──────────────────
Level 1: Full functionality (default)
Level 2: Reduced features (some options disabled)
Level 3: Minimal functionality (core only)
Level 4: Manual mode (instructions only)
Level 5: Abort (preserve user work, clean exit)
```

**Frontend-Specific Degradation:**

```
WIREFRAME DEGRADATION
─────────────────────
Level 1: 3 parallel agents, 2 rounds → 6 wireframes
Level 2: 2 parallel agents, 2 rounds → 4 wireframes
Level 3: 3 sequential agents, 1 round → 3 wireframes
Level 4: 1 agent, 3 styles sequential → 3 wireframes
Level 5: Template only, user fills in → 1 template
```

### Escalation Protocol

After exhausting retries (3x failed or Level 4-5 degradation), choose an escalation option via AskUserQuestion:

| Option             | When                          | Action                                 |
| ------------------ | ----------------------------- | -------------------------------------- |
| Reassign           | Different agent/approach fits | Spawn alternative or switch strategy   |
| Decompose          | Task too complex              | Split into subtasks, retry per subtask |
| Revise approach    | Strategy not working          | AskUserQuestion with alternatives      |
| Accept with limits | Partially succeeded           | Document gaps, continue with partial   |
| Defer              | Not urgent                    | Mark as TODO, continue                 |

### Rollback

> **Note:** Rollback is handled by Claude Code's built-in "Rewind" function.
> No custom rollback logic needed in skills.

---

## Validation Checkpoints per Skill Type

### Theme Skills

```markdown
**Pre-flight:**

- .project/ directory writable
- project.json exists or can be created
- Check if theme section already has data (warn on overwrite)

**Post-flight:**

- project.json valid JSON, theme section populated
- Required subsections: colors, typography, spacing
- All color values valid hex (#RRGGBB)
- Font families have fallbacks
- cssVars field present and syntactically valid
- Theme Infrastructure synced (Tailwind config or CSS vars)
```

### Wireframe Skills

```markdown
**Pre-flight:**

- Theme dependency satisfied (if selected)
- Output directory ready
- HTML template intact
- Task tool available (or fallback ready)

**Post-flight:**

- All expected HTML files exist
- HTML parseable
- Navigation links valid
- data-\* attributes present (if atomic level requires)
- Theme variables applied (if theme selected)
```

### Style Skills

```markdown
**Pre-flight:**

- project.json → theme section populated (or Tailwind defaults available)
- Source wireframe or page exists
- data-component attributes extractable

**Post-flight:**

- CSS/Tailwind output syntactically valid
- All tokens resolved (no undefined variables)
- No orphaned references
- Responsive breakpoints applied
```

### Scaffold Skills

```markdown
**Pre-flight:**

- Style outputs exist
- Component list available
- Template files intact

**Post-flight:**

- All component files generated
- TypeScript compiles (no syntax errors)
- Imports resolve
- Storybook stories valid
```

---

## AskUserQuestion Patterns for Recovery

### Missing Dependency

```yaml
header: "Dependency Missing"
question: "[Dependency] not found. How do you want to continue?"
options:
  - label: "Create [dependency] first (Recommended)"
    description: "Run /[skill] to create dependency"
  - label: "Continue without"
    description: "Use defaults where possible"
  - label: "Provide path"
    description: "Manually specify location of [dependency]"
  - label: "Cancel"
    description: "Stop workflow"
```

### Conflict Detected

```yaml
header: "Conflict"
question: "[File] already exists. What do you want to do?"
options:
  - label: "Overwrite (Recommended)"
    description: "Replace existing file"
  - label: "Rename"
    description: "Create [file]-v2 or choose new name"
  - label: "View"
    description: "Show current contents first"
  - label: "Cancel"
    description: "Stop workflow"
```

### Partial Failure

```yaml
header: "Partially Failed"
question: "[N]/[M] tasks succeeded. How do you want to continue?"
options:
  - label: "Retry failed (Recommended)"
    description: "Try only [failed] again"
  - label: "Continue with successes"
    description: "Ignore failed, continue"
  - label: "Retry all"
    description: "Restart entire phase"
  - label: "Manual"
    description: "Review failures, fix manually"
```

### Post-Flight Failure

```yaml
header: "Validation Failed"
question: "Post-flight check found [N] problems. What now?"
options:
  - label: "Auto-fix (Recommended)"
    description: "Try to repair automatically"
  - label: "View problems"
    description: "Show details per problem"
  - label: "Ignore"
    description: "Accept output despite problems"
```

---

## Project State Detection

Standardized pattern for detecting available project context. Use in pre-flight to determine what data is available, enabling skills to work in any order without assuming a fixed pipeline.

### State Snapshot

```
PROJECT STATE
════════════════════════════════════════════════
Theme:      [✓ project.json#theme populated | ✗ empty]
Design:     [✓ project.json#design — {N} pages, {M} flows | ✗ empty]
Code:       [✓ {N} source files ({framework}) | ✗ no source files]
Backlog:    [✓ .project/backlog.html — {N} features | ✗ not found]
Dev server: [✓ running on {port} | ✗ not detected]
Session:    [✓ devinfo from {skill} | ✗ new session]
════════════════════════════════════════════════
```

### Detection Steps

```markdown
1. **Theme**: Read `.project/project.json` → check if `theme` section has data (colors, typography, spacing)
2. **Design**: Read `.project/project.json` → check if `design` section has pages/flows/principles
3. **Code**: Glob for `src/**/*.{tsx,jsx}`, `app/**/*.{tsx,jsx}`, `*.html` — detect framework from `package.json`
4. **Backlog**: Check `.project/backlog.html` exists → parse JSON for feature count
5. **Dev server**: Try `playwright-cli open http://localhost:[port]` (common ports: 3000, 5173, 4321)
6. **Session**: Read `.project/session/devinfo.json` for handoff data
```

### Graceful Degradation per State

| Missing State | Impact                                    | Degradation                                       |
| ------------- | ----------------------------------------- | ------------------------------------------------- |
| No theme      | Skills use Tailwind defaults              | Suggest `/frontend-tokens` in next steps          |
| No design     | Skills ask user for page/flow info inline | Suggest `/frontend-design` in next steps          |
| No code       | Build/iterate skills cannot run           | Suggest `/frontend-design` or `/frontend-convert` |
| No backlog    | Feature tracking skipped                  | Non-blocking, no action needed                    |
| No dev server | Playwright verification skipped           | Skills offer to start one, or skip visual checks  |
| No session    | No handoff data from previous skill       | Skills start fresh, ask user for context          |

### Usage in Skills

Skills reference this pattern in their pre-flight:

```markdown
### 0.X Project State (optional)

Run Project State Detection (see `frontend-tokens/references/validation.md`).
Show snapshot. Adapt behavior based on available state.
```

Skills MUST NOT block on missing state unless it's a logical requirement (e.g., iterate needs code to exist). For optional state (theme, design, backlog), degrade gracefully and suggest the relevant skill in next steps.

---

## Integration with DevInfo

At each validation checkpoint, update devInfo:

```json
{
  "lastValidation": {
    "phase": "PRE_FLIGHT | POST_FLIGHT",
    "timestamp": "ISO timestamp",
    "status": "PASS | FAIL | PARTIAL",
    "checks": {
      "context": true,
      "resources": true,
      "scope": false
    },
    "issues": [
      {
        "severity": "CRITICAL | HIGH | MEDIUM | LOW",
        "check": "scope",
        "message": "Output path conflict detected",
        "resolution": "User chose overwrite"
      }
    ]
  }
}
```
