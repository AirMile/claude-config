# Validation Templates

Herbruikbare validation patterns voor alle skills. Referentie document voor pre-flight en post-flight checks.

---

## Pre-Flight Checklist Pattern

Run deze checks **VOORDAT** dure operaties starten (parallel agents, file generation, API calls).

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

### Rollback

> **Note:** Rollback wordt afgehandeld door Claude Code's ingebouwde "Rewind" functie.
> Geen custom rollback logica nodig in skills.

---

## Validation Checkpoints per Skill Type

### Theme Skills

```markdown
**Pre-flight:**
- Directory .project/config/ writable
- No conflicting THEME.md (or user confirmed overwrite)

**Post-flight:**
- THEME.md exists and valid markdown
- Required sections: Colors, Typography, Spacing
- All color values valid hex (#RRGGBB)
- Font families have fallbacks
- CSS export syntactically valid
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
- data-* attributes present (if atomic level requires)
- Theme variables applied (if theme selected)
```

### Style Skills

```markdown
**Pre-flight:**
- THEME.md exists and valid
- Source wireframe exists
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
