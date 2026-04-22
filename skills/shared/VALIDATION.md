# Validation Templates

Herbruikbare validation patterns voor alle skills. Referentie document voor pre-flight en post-flight checks.

---

## Pre-Flight Checklist Pattern

Run deze checks **VOORDAT** dure operaties starten (agents, file generation, API calls).

### 1. Context Validation

```markdown
**Context Check:**

- [ ] Vereiste input bestanden aanwezig
- [ ] Dependencies beschikbaar (andere skills output)
- [ ] User confirmation verkregen waar nodig
```

**Implementatie:**

```
PRE-FLIGHT: Context
-------------------
Input files: [✓|✗] [bestand] - [status]
Dependencies: [✓|✗] [dependency] - [status]
Confirmation: [✓|✗] [actie] - [status]
```

### 2. Resource Validation

```markdown
**Resource Check:**

- [ ] Output directory bestaat of kan gecreëerd worden
- [ ] Schrijfrechten beschikbaar
- [ ] Geen conflicterende processen
- [ ] MCP tools beschikbaar (indien nodig)
```

**Implementatie:**

```
PRE-FLIGHT: Resources
---------------------
Directory: [✓|✗] [pad] - [writable|readonly|missing]
Tools: [✓|✗] [tool] - [available|unavailable]
Conflicts: [✓|✗] [process] - [status]
```

### 3. Scope Validation

```markdown
**Scope Check:**

- [ ] Input parameters valide
- [ ] Output paden correct
- [ ] Geen overschrijf-conflicten
```

**Implementatie:**

```
PRE-FLIGHT: Scope
-----------------
Parameters: [✓|✗] [param] = [value] - [valid|invalid]
Output: [✓|✗] [pad] - [available|exists|conflict]
```

### Pre-Flight Samenvatting

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

Run deze checks **NA** generatie/modificatie operaties.

### 1. Existence Checks

```markdown
**Existence Check:**

- [ ] Alle verwachte bestanden aangemaakt
- [ ] Geen lege of corrupte outputs
- [ ] Bestandsgroottes realistisch
```

**Implementatie:**

```
POST-FLIGHT: Existence
----------------------
Files created: [N]/[M] expected
- [✓|✗] [bestand] - [size] bytes
Empty files: [N] detected
Corrupt files: [N] detected
```

### 2. Structural Validation

```markdown
**Structural Check:**

- [ ] Bestanden parseerbaar (HTML valid, JSON valid, etc.)
- [ ] Vereiste secties aanwezig
- [ ] Encoding correct (UTF-8)
```

**Implementatie:**

```
POST-FLIGHT: Structure
----------------------
Parse status:
- [✓|✗] [bestand] - [valid|invalid] [format]
Required sections:
- [✓|✗] [sectie] in [bestand]
```

### 3. Semantic Validation

```markdown
**Semantic Check:**

- [ ] Content matcht intent
- [ ] Geen placeholder/template variables remaining
- [ ] Interne referenties kloppen
```

**Implementatie:**

```
POST-FLIGHT: Semantic
---------------------
Placeholders: [N] remaining (should be 0)
- [bestand:regel] - {{placeholder}}
References:
- [✓|✗] [link] → [target]
```

### Post-Flight Samenvatting

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

**Implementatie:**

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

### Escalatie Protocol

Na uitputting van retries (3x gefaald of Level 4-5 degradation), kies een escalatie-optie via AskUserQuestion:

| Optie              | Wanneer                       | Actie                                 |
| ------------------ | ----------------------------- | ------------------------------------- |
| Reassign           | Ander agent/aanpak geschikter | Spawn alternatief of wissel strategie |
| Decompose          | Taak te complex               | Splits in subtaken, retry per subtaak |
| Revise approach    | Strategie werkt niet          | AskUserQuestion met alternatieven     |
| Accept with limits | Deels gelukt                  | Documenteer gaps, ga door met partial |
| Defer              | Niet urgent                   | Markeer als TODO, ga door             |

### Rollback

> **Note:** Rollback wordt afgehandeld door Claude Code's ingebouwde "Rewind" functie.
> Geen custom rollback logica nodig in skills.

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

## AskUserQuestion Patterns voor Recovery

### Missing Dependency

```yaml
header: "Dependency Missing"
question: "[Dependency] niet gevonden. Hoe wil je doorgaan?"
options:
  - label: "Maak eerst [dependency] (Recommended)"
    description: "Run /[skill] om dependency te maken"
  - label: "Doorgaan zonder"
    description: "Gebruik defaults waar mogelijk"
  - label: "Pad opgeven"
    description: "Geef handmatig locatie van [dependency]"
  - label: "Annuleren"
    description: "Stop workflow"
```

### Conflict Detected

```yaml
header: "Conflict"
question: "[File] bestaat al. Wat wil je doen?"
options:
  - label: "Overschrijven (Recommended)"
    description: "Vervang bestaand bestand"
  - label: "Hernoemen"
    description: "Maak [file]-v2 of kies nieuwe naam"
  - label: "Bekijken"
    description: "Toon huidige inhoud eerst"
  - label: "Annuleren"
    description: "Stop workflow"
```

### Partial Failure

```yaml
header: "Gedeeltelijk Mislukt"
question: "[N]/[M] taken gelukt. Hoe wil je doorgaan?"
options:
  - label: "Retry gefaalde (Recommended)"
    description: "Probeer alleen [failed] opnieuw"
  - label: "Doorgaan met successen"
    description: "Negeer gefaalde, ga verder"
  - label: "Alles opnieuw"
    description: "Start hele fase opnieuw"
  - label: "Handmatig"
    description: "Bekijk failures, fix handmatig"
```

### Post-Flight Failure

```yaml
header: "Validatie Mislukt"
question: "Post-flight check vond [N] problemen. Wat nu?"
options:
  - label: "Auto-fix (Recommended)"
    description: "Probeer automatisch te repareren"
  - label: "Bekijk problemen"
    description: "Toon details per probleem"
  - label: "Negeren"
    description: "Accepteer output ondanks problemen"
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
5. **Dev server**: Try `browser_navigate` to localhost (common ports: 3000, 5173, 4321)
6. **Session**: Read `.project/session/devinfo.json` for handoff data
```

### Graceful Degradation per State

| Missing State | Impact                                    | Degradation                                        |
| ------------- | ----------------------------------------- | -------------------------------------------------- |
| No theme      | Skills use Tailwind defaults              | Suggest `/frontend-tokens` in next steps           |
| No design     | Skills ask user for page/flow info inline | Suggest `/frontend-design` in next steps             |
| No code       | Build/iterate skills cannot run           | Suggest `/frontend-design` or `/frontend-convert` |
| No backlog    | Feature tracking skipped                  | Non-blocking, no action needed                     |
| No dev server | Playwright verification skipped           | Skills offer to start one, or skip visual checks   |
| No session    | No handoff data from previous skill       | Skills start fresh, ask user for context           |

### Usage in Skills

Skills reference this pattern in their pre-flight:

```markdown
### 0.X Project State (optional)

Run Project State Detection (see `shared/VALIDATION.md`).
Show snapshot. Adapt behavior based on available state.
```

Skills MUST NOT block on missing state unless it's a logical requirement (e.g., iterate needs code to exist). For optional state (theme, design, backlog), degrade gracefully and suggest the relevant skill in next steps.

---

## Integration met DevInfo

Bij elke validation checkpoint, update devInfo:

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
