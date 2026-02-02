# Approach Detection Logic for /2-code

**Purpose:** Detect whether a feature is simple (direct implementation) or complex (requires architectural choice).

---

## Simple vs Complex Detection

### Simple Feature Criteria

A feature is **SIMPLE** when ALL conditions are met:

| Criterion | Threshold | Example |
|-----------|-----------|---------|
| Files affected | ≤ 3 new/modified | Add logout button, fix validation |
| New dependencies | 0 | No new packages needed |
| Pattern exists | Yes | Pattern already used in codebase |
| Architectural choice | None | Only 1 reasonable approach |
| Integration points | ≤ 2 | Touches max 2 existing systems |

**Simple feature flow:**
```
Detect: Simple feature
→ Skip user choice
→ Run 3 agents (speed/quality/balanced) silently
→ Auto-synthesize best approach
→ Implement directly
→ Report what was done
```

### Complex Feature Criteria

A feature is **COMPLEX** when ANY condition is met:

| Criterion | Threshold | Example |
|-----------|-----------|---------|
| Files affected | > 5 new/modified | New module, major refactor |
| New dependencies | ≥ 1 major | New framework, database driver |
| Pattern exists | No | Need to establish new pattern |
| Architectural choice | Multiple valid | WebSocket vs Polling, REST vs GraphQL |
| Integration points | > 3 | Touches auth, db, cache, queue |

**Complex feature flow:**
```
Detect: Complex feature with architectural choice
→ Analyze approaches (2-3 options)
→ Calculate metrics per approach
→ Present to user with recommendation
→ User chooses (or accepts recommendation)
→ Run 3 agents for CHOSEN approach
→ Implement
→ Report
```

---

## Architectural Choice Detection

### When are there multiple valid approaches?

Analyze the feature against these categories:

| Category | Example Choices | Detection Signal |
|----------|-----------------|------------------|
| **Communication** | REST vs GraphQL vs gRPC | "API", "endpoint", "data fetching" |
| **Real-time** | Polling vs WebSocket vs SSE | "live", "real-time", "updates" |
| **State** | Redux vs Context vs Zustand | "state management", "global state" |
| **Auth** | JWT vs Session vs OAuth | "authentication", "login" |
| **Storage** | SQL vs NoSQL vs hybrid | "database", "persistence" |
| **Rendering** | SSR vs CSR vs SSG | "performance", "SEO", "static" |
| **Architecture** | Monolith vs Microservices | "scale", "deployment", "services" |

### When is there only ONE good approach?

- Requirements clearly specify technology
- Project already uses a pattern for this type
- One option is obviously superior for context
- Framework conventions dictate approach

---

## Metrics Definition

### Complexity Scale (●○○○○ to ●●●●●)

**NOT a formula. Use concrete indicators:**

| Scale | Files | Dependencies | Pattern | Description |
|-------|-------|--------------|---------|-------------|
| ●○○○○ | 1-2 | 0 | Existing | Trivial change |
| ●●○○○ | 3-5 | 0-1 minor | Existing | Standard feature |
| ●●●○○ | 5-10 | 1-2 | Slight variation | Moderate feature |
| ●●●●○ | 10-20 | 2-3 | New pattern | Complex feature |
| ●●●●● | 20+ | Major | Architectural | Major undertaking |

### Success Chance

**Based on confidence indicators, not calculations:**

| Chance | Confidence Level | Indicators |
|--------|------------------|------------|
| ~95% | Very High | Done this exact pattern in this codebase before |
| ~90% | High | Know pattern well, minor adaptation needed |
| ~80% | Good | Pattern documented, straightforward application |
| ~70% | Moderate | Some unknowns, but path is clear |
| ~60% | Low | Significant unknowns, experimental |
| <50% | Very Low | Uncharted territory, high uncertainty |

### Risk Identification

**Checklist-based, not formula-based:**

| Risk Category | Check For | Impact |
|---------------|-----------|--------|
| **Dependency** | New external package | Version conflicts, maintenance |
| **Breaking** | Changes to existing API | Downstream effects |
| **Edge cases** | Unclear requirements | Runtime surprises |
| **State** | Complex state management | Hard to debug |
| **Performance** | Heavy computation/queries | User experience |
| **Security** | Auth/validation changes | Vulnerabilities |
| **Integration** | External service calls | Failure modes |

---

## Choice Type Classification

### "Can Read" vs "Must Run"

| Type | Examples | How to Decide |
|------|----------|---------------|
| **Can Read** | Architecture, Stack, Patterns, Database schema | Analyze code/docs, no runtime needed |
| **Must Run** | Performance, Feel, Visual, Audio, UX | Must experience to evaluate |

### Recommendation Logic

```
IF Claude is certain (one approach clearly better):
  → Recommend that approach
  → No need to test alternatives
  → "Aanbeveling: Optie A - [reason based on context]"

IF Claude is uncertain (both have valid trade-offs):
  → Present both with pros/cons
  → Give slight preference if any
  → IF type is "Must Run": suggest testing both
  → IF type is "Can Read": let user decide on requirements
```

---

## Output Formats

### Format A: Simple Feature (No Choice)

```
🔍 ANALYSE: Simpele feature gedetecteerd

{Feature description}:
- Geen architectural keuze nodig
- Bestaand pattern: {pattern name}
- Bestanden: {count} ({list})

→ Direct implementeren...
```

### Format B: Complex Feature (Architectural Choice)

```
🔍 ANALYSE: Architectural keuze gedetecteerd

Er zijn {N} fundamenteel verschillende aanpakken:

┌─────────────────────────────────────────────────────────────┐
│ A) {Approach Name}                                          │
│                                                             │
│    Complexity:   {●●○○○}                                    │
│    Success kans: {~XX%}                                     │
│    Risico's:     {specific risks}                           │
│                                                             │
│    + {pro 1}                                                │
│    + {pro 2}                                                │
│    - {con 1}                                                │
├─────────────────────────────────────────────────────────────┤
│ B) {Approach Name}                                          │
│                                                             │
│    Complexity:   {●●●○○}                                    │
│    Success kans: {~XX%}                                     │
│    Risico's:     {specific risks}                           │
│                                                             │
│    + {pro 1}                                                │
│    + {pro 2}                                                │
│    - {con 1}                                                │
└─────────────────────────────────────────────────────────────┘

📌 Aanbeveling: Optie {X} ({name})
   Reden: {context-specific reasoning}

{IF uncertain AND must_run type:}
🧪 Test advies: Beide testen aanbevolen
   {reason why testing helps}

{IF certain OR can_read type:}
🧪 Test advies: Niet nodig
   {reason why reading/requirements is enough}

Wat wil je doen?
1. Implementeer {recommended} (aanbevolen)
2. Implementeer {alternative}
{IF test advised:}
3. Test beide (worktrees)
```

---

## Integration with Parallel Agents

**Important:** The 3 parallel agents (implement-speed, implement-quality, implement-balanced) run AFTER approach selection:

```
FASE 1.5: Approach Detection
├── Simple feature → auto-select (agents run silently, synthesize)
└── Complex feature → user chooses approach
         │
         ▼
FASE 2: Implementation (with chosen approach)
├── implement-speed: "Ship fast with {approach}"
├── implement-quality: "Do it right with {approach}"
└── implement-balanced: "Pragmatic {approach}"
         │
         ▼
    Synthesize → Implement
```

The agents answer HOW to implement the chosen approach, not WHAT approach to choose.

---

## Examples

### Example 1: Simple Feature

**Input:** "Add logout button to header"

**Detection:**
- Files: 2 (Header.tsx, auth.ts)
- Dependencies: 0
- Pattern: Existing (other buttons in header)
- Choices: None (obvious placement, standard click handler)

**Result:** SIMPLE → Direct implementation

---

### Example 2: Complex Feature - Architecture Choice

**Input:** "Add real-time notifications"

**Detection:**
- Files: 8+ (backend, frontend, config)
- Dependencies: 1+ (Pusher/Soketi or none for polling)
- Pattern: New (no real-time in codebase yet)
- Choices: WebSocket vs Polling

**Result:** COMPLEX → Present options with metrics

---

### Example 3: Complex Feature - No Choice Needed

**Input:** "Add user profile page"

**Detection:**
- Files: 6 (components, API, styles)
- Dependencies: 0
- Pattern: Existing (other pages follow same structure)
- Choices: None (follow existing page pattern)

**Result:** COMPLEX by file count, but no architectural choice → Proceed with standard pattern, notify user

```
🔍 ANALYSE: Uitgebreide feature gedetecteerd

User profile page:
- Volgt bestaand page pattern
- Geen architectural keuze nodig
- Geschatte bestanden: 6

→ Implementeren met bestaand pattern...
```
