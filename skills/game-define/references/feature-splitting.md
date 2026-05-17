# PHASE 1b: Scope Analysis & Feature Splitting

**Goal:** Analyze gathered requirements and decide whether to keep as a single feature or split into multiple sub-features for optimal build execution.

## Steps

1. **Analyze requirement scope:**

   Count requirements and map dependency graph from PHASE 1 output.

   ```
   SCOPE ANALYSIS:

   Total requirements: {count}
   Categories: {list of unique categories}
   Dependency depth: {max chain length}
   ```

2. **Identify dependency clusters:**

   Group requirements that depend on each other into clusters:
   - Requirements with direct dependencies → same cluster
   - Requirements with no cross-dependencies → separate clusters
   - Single isolated requirements → own cluster or attach to nearest related cluster

3. **Apply decision logic:**

   ```
   IF requirements ≤ 6 AND single category/concern:
     → SINGLE feature (continue normally)

   IF requirements 7-10:
     → EVALUATE: check if ≥2 natural clusters exist with ≤2 cross-dependencies
     → If clusters found: RECOMMEND SPLIT
     → If tightly coupled: SINGLE feature

   IF requirements > 10:
     → RECOMMEND SPLIT (unless linear dependency chain with single concern)
   ```

4. **If SINGLE feature:**

   ```
   ✓ Scope analysis: SINGLE FEATURE

   Requirements: {count}
   Reason: {e.g., "tightly coupled, single concern", "≤6 requirements"}

   → Continuing to architecture design.
   ```

   Proceed to PHASE 2.

5. **If SPLIT recommended:**

   Show proposed split:

   ```
   SPLIT RECOMMENDATION:

   Requirements: {count} → {n} sub-features

   1. {feature-name}-{sub1} (REQ-001, REQ-002, REQ-003)
      Focus: {description of this group's concern}

   2. {feature-name}-{sub2} (REQ-004, REQ-005)
      Focus: {description of this group's concern}

   Build order: {sub1} → {sub2}
   Cross-dependencies: {list or "none"}
   ```

   Use **AskUserQuestion** for confirmation:
   - header: "Feature Split"
   - question: "Agree with this split?"
   - options:
     - label: "Agree (Recommended)", description: "Split into {n} sub-features"
     - label: "Edit", description: "I want to change the grouping"
     - label: "Keep as one feature", description: "No split, everything in one feature"
   - multiSelect: false

   **Response Handling:**
   - Agree → proceed with split
   - Edit → ask which requirements should move where, regenerate split
   - Keep as one feature → proceed as SINGLE feature to PHASE 2

6. **Execute split (if approved):**

   a. Create parent documentation:

   Write `.project/features/{feature-name}/00-split.md`:

   ````markdown
   # Feature Split: {Feature Name}

   **Created:** {date}
   **Status:** split
   **Original requirements:** {count}
   **Sub-features:** {count}

   ## Split Decision

   Reason: {why split was recommended}

   ## Sub-features

   | #   | Sub-feature   | Requirements              | Focus   |
   | --- | ------------- | ------------------------- | ------- |
   | 1   | {name}-{sub1} | REQ-001, REQ-002, REQ-003 | {focus} |
   | 2   | {name}-{sub2} | REQ-004, REQ-005          | {focus} |

   ## Build Order

   1. {name}-{sub1} (base, no dependencies)
   2. {name}-{sub2} (after {sub1})

   ## Commands

   ```
   /game-build {name}-{sub1}
   /game-build {name}-{sub2}
   ```
   ````

   b. Create sub-feature project folders:

   ```bash
   mkdir -p .project/features/{feature-name}-{sub1}
   mkdir -p .project/features/{feature-name}-{sub2}
   ```

   c. Continue PHASE 2-5 for EACH sub-feature sequentially:
   - Re-number requirements per sub-feature (REQ-001, REQ-002, etc.)
   - Each sub-feature gets its own architecture, scene layout, and feature.json
   - Use build order: complete all PHASEs for sub-feature 1 before starting sub-feature 2

7. **Update backlog (split only):**

   If `.project/backlog.html` exists:
   - Replace original feature entry with sub-feature entries
   - Each sub-feature gets its own line in the backlog
   - Add `(split from {original-name})` annotation
