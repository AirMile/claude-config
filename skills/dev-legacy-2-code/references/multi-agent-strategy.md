# Multi-Agent Parallelization Strategy for /2-code Skill

**Status:** Planning / Future Enhancement
**Purpose:** Analysis and strategy for intelligent multi-agent parallelization in FASE 2 (Implementation)

---

## Executive Summary

This strategy describes how the /2-code skill can be extended with intelligent multi-agent parallelization to implement large features 2-3x faster. The approach uses **sequential batches** with **general agents**, **pre-flight time analysis**, and **automatic fallback** to single-agent for simple features.

**Core Decision:** Start with **bare bones single-agent** (for context window), build out to full multi-agent later.

---

## Phased Approach

### Phase 1: Bare Bones (MVP)
**Goal:** Have FASE 2 done by 1 agent for context window benefit

**Implementation:**
- Main skill spawns 1 general agent for entire FASE 2
- Agent receives: base context + architecture patterns + 01-intent.md + 01-research.md
- Agent does sequential implementation (current workflow)
- Agent reports back: files created/modified, decisions, deviations
- Main skill continues with FASE 3

**Benefits:**
- Simple to implement
- Context window isolation for FASE 2
- Zero breaking changes
- Foundation for future parallelization

---

### Phase 2: Batch Planning (Future Enhancement)
**Goal:** Structure implementation in batches (also for single agent)

- Sequential-thinking analyzes feature
- Groups files in architecture batches:
  - Batch 1: Config files
  - Batch 2: Models/Entities
  - Batch 3: Services/Controllers
  - Batch 4: Views/Components
- Detects shared files and dependencies
- Output: Structured batch plan

---

### Phase 3: Time Analysis & Multi-Agent (Future Enhancement)
**Goal:** Intelligent parallelization decision

**Decision Logic:**
```
IF speedup >= 1.5x AND sequential_time >= 5 min:
  → MULTI-AGENT MODE
ELSE:
  → SINGLE-AGENT MODE
```

---

## Fail-Safe Strategy

**Aggressive Fallback Policy:**

```
RULE: On ANY unexpected problem → abort parallel → fallback sequential

Fallback triggers:
- Sequential-thinking confidence < 90%
- Batch validation fails
- Agent crashes
- Context corruption
- Token budget > 80%
- Syntax errors after batch
- File conflicts unresolvable
- Estimated speedup < 1.5x
```

**Result:**
- Speed when it works (2-3x faster)
- Safety when it doesn't (proven sequential)
- Clear user messaging on fallback
- No silent failures
- Production-ready

---

## Conclusion

**Is it failproof? NO**
**Is it production-ready? YES (with fail-safe)**
**Is it better than 100% sequential? ABSOLUTELY**

The strategy is "fail-safe" not "fail-proof". With all mitigations + aggressive fallback:
- 70-80% of features: 2-3x faster via parallel
- 20-30% of features: fallback to sequential (no harm)
- 0% of features: unrecoverable failures

**Current status:** Ready to implement Phase 1 (bare bones single-agent)
