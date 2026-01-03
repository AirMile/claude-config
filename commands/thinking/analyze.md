---
description: Analyzes plans using 3 parallel agents for risk analysis, alternatives exploration, and simplification opportunities
---

# Analyze Plan Skill

## Overview

This skill analyzes feature plans using three parallel analysis agents to identify risks, explore alternatives, and find simplification opportunities. It helps improve plan quality before implementation by systematically challenging the approach from multiple perspectives.

The skill uses:
- **analyze-risk-finder**: Devil's Advocate + Critical Assumption Testing
- **analyze-alternatives-explorer**: Alternative approaches and trade-offs
- **analyze-simplification-advisor**: YAGNI analysis and phased delivery

The agents run in parallel for efficiency (~67% context savings, 3x faster), and their outputs are synthesized into a weighted confidence score and actionable recommendations. The skill can then interactively improve the plan based on user feedback.

**Trigger**: `/analyze` or `/analyze [feature-name]`

## When to Use

This skill is useful:

**Before implementation:**
- After `/1-plan` creates a plan (or during /1-plan FASE 4)
- Before decomposition to understand complexity
- When uncertain about approach

**After decomposition:**
- Analyze individual sub-features
- Validate decomposition strategy

**When stuck:**
- Implementation challenges
- Unclear requirements
- Multiple possible approaches

## Workflow

The skill operates through four phases using three core analysis techniques.

### FASE 1: Plan Selection

**Goal:** Select which plan to analyze.

1. **List available features:**
   ```bash
   # Check both locations
   ls .workspace/features/
   ls .claude/originals/
   ```

2. **Ask user for feature selection using AskUserQuestion:**

   First, build dynamic options from discovered features:
   ```
   # For each feature in .workspace/features/ and .claude/originals/:
   options = []
   for feature_folder in discovered_features:
       options.append({
           "label": feature_folder.name,
           "description": f"Analyseer {feature_folder.name} feature"
       })
   ```

   Then use AskUserQuestion tool:
   ```json
   {
     "header": "Feature Selectie",
     "question": "Welke feature wil je analyseren?",
     "options": [
       {
         "label": "[feature-1] (Aanbevolen)",
         "description": "Analyseer [feature-1] feature"
       },
       {
         "label": "[feature-2]",
         "description": "Analyseer [feature-2] feature"
       },
       {
         "label": "[feature-N]",
         "description": "Analyseer [feature-N] feature"
       },
       {
         "label": "Uitleg",
         "description": "Leg uit wat deze analyse doet en hoe features worden gedetecteerd"
       }
     ],
     "multiSelect": false
   }
   ```

   **Notities:**
   - Dynamisch opties vullen op basis van gevonden features
   - Eerste optie = meest recente of relevante feature (Aanbevolen)
   - User kan ook custom input typen voor:
     - Specifiek pad: "recipe-management/01-intent.md"
     - Feature + part: "recipe-management 01-models"

   - Parse user input and locate context folder
   - If input is folder name → use `.workspace/features/{name}/`
   - If input contains path → resolve full path to folder
   - If input is just filename → search for matching folder in `.workspace/features/`
   - Validate folder exists, otherwise ask for clarification

3. **Detect mode and set file paths:**

   **Normal feature mode:**
   ```
   Intent: .workspace/features/{name}/01-intent.md
   Research: .workspace/features/{name}/01-research.md
   Analysis output: .workspace/features/{name}/00-analysis.md
   ```

   **Part mode (sections within parent files):**
   ```
   All files in feature folder (parts are sections, not folders):
   - Intent: .workspace/features/{feature}/01-intent.md (look for "## Part: {NN}-{name}" section)
   - Research: .workspace/features/{feature}/01-research.md (look for "## Part: {NN}-{name}" section)
   - Analysis output: .workspace/features/{feature}/00-analysis.md (append "## Part: {NN}-{name}" section)
   ```

4. **Load context files:**

   - Read `01-intent.md` for requirements analysis
   - Read `01-research.md` for patterns analysis

   **Parse sections and extract key information:**
   - From intent: User request, requirements, constraints
   - From research: Architecture patterns, testing strategy

**Output:**
```
📋 PLAN LOADED: {feature-name}

| Field | Value |
|-------|-------|
| **Mode** | [FEATURE / PART] |
| **Parent feature** | {parent} (if applicable) |
| **Type** | {FEATURE/EXTEND} |
| **Intent** | {intent-file-path} ✓ |
| **Research** | {research-file-path} ✓ |
| **Output** | {analysis-output-path} |

→ Ready for analysis
```

---

### FASE 2: Multi-Technique Analysis (Parallel Agents)

**Goal:** Apply three analysis perspectives systematically using parallel agents.

**IMPORTANT:** This phase uses 3 specialized analysis agents that work in parallel for maximum efficiency and multiple perspectives:
- `analyze-risk-finder` - Devil's Advocate + Critical Assumption Testing
- `analyze-alternatives-explorer` - Alternative Approaches exploration
- `analyze-simplification-advisor` - Simplification + YAGNI analysis

Each agent provides a distinct perspective on the plan quality.

---

**Step 1: Prepare Analysis Context**

Extract from loaded context files:

```
Feature: [name]
Type: [FEATURE/EXTEND]

Intent Summary (from 01-intent.md):
- User request: [description]
- Requirements: [list]
- Constraints: [list]
- Success criteria: [list]

Research Summary (from 01-research.md):
- Architecture patterns: [summary]
- Testing strategy: [summary]
- Key decisions: [list]
```

---

**Step 2: Launch 3 Analysis Agents in Parallel**

**CRITICAL:** You MUST send a single message with 3 Task tool calls to run agents in parallel.

```
🔍 Launching plan analysis...

3 analysis agents examining the plan:
- Agent 1: Risk Finder (what could go wrong?)
- Agent 2: Alternatives Explorer (what else could work?)
- Agent 3: Simplification Advisor (what can we cut?)
```

**Prompt for each agent:**

```
Analyze the following plan from your specialized perspective.

[Insert analysis context from Step 1]

Return your structured analysis report following your output format.
```

Launch all 3 agents:
- Task(subagent_type="analyze-risk-finder", prompt="[context]")
- Task(subagent_type="analyze-alternatives-explorer", prompt="[context]")
- Task(subagent_type="analyze-simplification-advisor", prompt="[context]")

---

**Step 3: Wait for All Agents to Complete**

All 3 agents work in parallel. Wait until all return their outputs.

---

**Step 4: Receive 3 Analysis Reports**

**Agent 1: analyze-risk-finder returns:**
```
## RISK ANALYSIS
### Devil's Advocate Findings
- Major Concerns
- Weak Points
- Potential Failure Modes

### Critical Assumption Analysis
- Core Assumptions table
- Highest Risk Assumptions

### Risk Summary
- Risk counts by category
- Recommended Mitigations
- Overall Risk Level
```

**Agent 2: analyze-alternatives-explorer returns:**
```
## ALTERNATIVES ANALYSIS
### Alternative Approaches
- Alternative 1: [Simpler Approach]
- Alternative 2: [Different Technology]
- Alternative 3: [Off-the-shelf Solution]

### Comparison Matrix
### 80/20 Analysis
### Recommendation
```

**Agent 3: analyze-simplification-advisor returns:**
```
## SIMPLIFICATION ANALYSIS
### What to ELIMINATE
### What to SIMPLIFY
### What to REUSE
### What to DEFER

### Over-Engineering Assessment
### Phased Delivery Recommendation
### Top 3 Simplification Actions
```

---

**Output:**
```
🔍 ANALYSIS COMPLETE

**Agents:** 3/3 returned

| Agent | Findings |
|-------|----------|
| Risk Finder | [X] concerns, [Y] unvalidated assumptions |
| Alternatives Explorer | [X] alternatives identified |
| Simplification Advisor | [X] simplification opportunities |

→ Proceeding to synthesis...
```

---

### FASE 3: Synthesis & Recommendations

**Goal:** Combine findings from 3 agents into actionable insights with weighted synthesis.

**Input:** 3 analysis reports from parallel agents (FASE 2)

---

**Step 1: Extract Key Findings from Each Agent**

From **analyze-risk-finder**:
- Count of critical/high/medium/low risks
- Top 3 concerns with likelihood/impact
- Unvalidated critical assumptions
- Risk score

From **analyze-alternatives-explorer**:
- Number of alternatives identified
- Best 80/20 option
- Recommendation (keep original or switch)
- Trade-off summary

From **analyze-simplification-advisor**:
- Items to eliminate/simplify/reuse/defer
- Complexity reduction percentage
- Time savings estimate
- Top 3 simplification actions

---

**Step 2: Prioritize Combined Findings**

Merge and prioritize all findings:

| Priority | Source | Issue Type |
|----------|--------|------------|
| 🔴 Critical | Risk Finder | Critical risks + unvalidated critical assumptions |
| 🔴 Critical | Alternatives | If alternative is significantly better (>30% improvement) |
| 🟡 Important | Risk Finder | High risks + important assumptions |
| 🟡 Important | Simplification | Major elimination/simplification opportunities |
| 🟢 Minor | All | Nice-to-have improvements |

---

**Step 3: Calculate Confidence Score**

Weighted calculation:

```
Risk Score (from Risk Finder):
- 0 critical issues = 10 points
- 1-2 critical = 7 points
- 3+ critical = 4 points
- Subtract 1 point per unvalidated critical assumption (max -3)

Alternatives Score (from Alternatives Explorer):
- Original is best = 10 points
- Alternative slightly better = 7 points
- Alternative significantly better = 4 points

Simplification Score (from Simplification Advisor):
- <20% over-engineering = 10 points
- 20-40% over-engineering = 7 points
- >40% over-engineering = 4 points

Final Confidence = (Risk × 0.40) + (Alternatives × 0.30) + (Simplification × 0.30)
```

---

**Step 4: Generate Synthesis Output**

```markdown
## Synthesis

### Agent Summary
| Agent | Key Finding | Impact |
|-------|-------------|--------|
| Risk Finder | [X] critical risks, [Y] unvalidated assumptions | [High/Med/Low] |
| Alternatives Explorer | [Best option] recommended | [Keep/Switch] |
| Simplification Advisor | [X]% complexity reduction possible | [X] days saved |

### Priority Issues

🔴 **Critical (Must Address):**
1. [Issue from Risk Finder] - [Action required]
2. [Issue from Alternatives if significant] - [Action required]

🟡 **Important (Should Address):**
1. [Risk/Assumption] - [Suggested improvement]
2. [Simplification opportunity] - [Action]

🟢 **Minor (Nice to Have):**
1. [Minor improvement] - [Optional enhancement]

### Key Recommendations
1. [Most important action - usually from Risk Finder]
2. [Second priority - often from Simplification]
3. [Third priority - from Alternatives if relevant]

### Confidence Assessment

**Plan Confidence: {X}/10**

| Factor | Score | Reason |
|--------|-------|--------|
| Risk Profile | {X}/10 | [summary] |
| Approach Fit | {X}/10 | [summary] |
| Simplicity | {X}/10 | [summary] |

- **Strengths:** {What's solid across all analyses}
- **Weaknesses:** {What needs work}
- **Overall:** {Ready / Needs revision / Reconsider approach}
```

---

**Send notification:**
```bash
powershell -ExecutionPolicy Bypass -File .claude/scripts/notify.ps1 -Title "Claude Code" -Message "Plan analysis complete"
```

---

### FASE 4: Report Generation

**Goal:** Create comprehensive analysis report.

1. **Generate full report:**
   - Combine all technique outputs
   - Add executive summary
   - Include next steps

2. **Save report:**
   - Save to location determined from detected mode:
     - Normal: `.workspace/features/{name}/01-analysis.md`
     - Part: Append "## Part: {NN}-{name} Analysis" section to `.workspace/features/{feature}/01-analysis.md`

3. **Ask about improvements using AskUserQuestion:**

   Use the AskUserQuestion tool with:
   ```json
   {
     "header": "Next Step",
     "question": "Analysis complete. What would you like to do next?",
     "options": [
       {
         "label": "View Summary",
         "description": "Show a condensed overview of key findings"
       },
       {
         "label": "Improve Plan",
         "description": "Interactive guided questions to refine the plan"
       },
       {
         "label": "Proceed",
         "description": "Continue with the original plan as-is"
       }
     ],
     "multiSelect": false
   }
   ```

   **Handle response:**
   - "View Summary" → Display executive summary and key metrics only
   - "Improve Plan" → Proceed to FASE 5 (Interactive Plan Improvement)
   - "Proceed" → Skip to final output, ready for /2-code

**Final output:**
```
✅ ANALYSIS COMPLETE

Report saved: {analysis-output-path}

Key findings:
- {Top risk from Risk Finder}
- {Best alternative from Alternatives Explorer}
- {Top simplification from Simplification Advisor}

Confidence: {X}/10

Recommended next step: {suggestion based on analysis}
```

---

### FASE 5: Interactive Plan Improvement (Optional)

**Goal:** Improve the plan through guided questions based on analysis findings.

**Triggered when:** User chooses option 2 "Improve plan through guided questions"

1. **Generate smart questions based on findings:**
   - Group questions by agent (Risk Finder, Alternatives Explorer, Simplification Advisor)
   - Maximum 3-4 questions per batch to avoid overwhelming
   - Each question offers clear, actionable choices

2. **Question types by agent:**

   **From Risk Finder (risks + assumptions):**
   ```
   RISK: Authentication complexity identified
   How should we address this risk?
   • Use Laravel Breeze (simpler, proven)
   • Keep custom implementation with added security
   • Implement OAuth2 (industry standard)
   • Add detailed security documentation
   ```

   ```
   ASSUMPTION: All users have valid email addresses
   How should we validate this assumption?
   • Require email verification on signup
   • Allow phone number as alternative
   • Make email optional initially
   • Add this as explicit requirement
   ```

   **From Alternatives Explorer:**
   ```
   ALTERNATIVE: Custom file handling vs library
   Which approach do you prefer?
   • Use Laravel Media Library (proven, maintained)
   • Keep custom implementation (full control)
   • Use S3 with presigned URLs (scalable)
   • Simple local storage for MVP
   ```

   **From Simplification Advisor:**
   ```
   DEFER: Real-time notifications
   When is this feature needed?
   • Essential for MVP launch
   • Nice to have - Phase 2
   • Can use email notifications instead
   • Not really needed - remove
   ```

3. **Interactive question flow:**
   ```python
   # Use AskUserQuestion tool for each batch
   questions = [
       {
           "question": "How should we handle authentication?",
           "header": "Auth",
           "options": [...],
           "multiSelect": false
       }
   ]
   ```

4. **Apply improvements based on answers:**
   - Parse user responses
   - Generate improved context sections
   - Show diff of changes
   - Ask for confirmation before saving

5. **Save improved plan using AskUserQuestion:**

   Use the AskUserQuestion tool with:
   ```json
   {
     "header": "Save Option",
     "question": "How would you like to save the improved plan?",
     "options": [
       {
         "label": "Replace Original",
         "description": "Overwrite the existing context file with improvements"
       },
       {
         "label": "Keep Both",
         "description": "Save as {context-name}-improved.md, preserve original"
       }
     ],
     "multiSelect": false
   }
   ```

   **Handle response:**
   - "Replace Original" → Overwrite original file
   - "Keep Both" → Save to new file with -improved suffix

   **Save locations:**
   - Normal - Option 1: Replace `.workspace/features/{name}/01-intent.md`
   - Normal - Option 2: Save as `.workspace/features/{name}/01-intent-improved.md`
   - Part - Option 1: Update part section in `.workspace/features/{feature}/01-intent.md`
   - Part - Option 2: Save as `.workspace/features/{feature}/01-intent-improved.md` with updated part section

**Output:**
```
✅ PLAN IMPROVED

**Based on your answers:**

| Improvement | Description |
|-------------|-------------|
| Simplification | Use Laravel Breeze for authentication |
| Deferral | Real-time features moved to Phase 2 |
| Addition | Email validation requirement added |
| Replacement | Custom file handling → library |

| Metric | Value |
|--------|-------|
| **Saved to** | {saved-location} |
| **New confidence** | 8/10 (was 6/10) |

→ Ready to proceed with /2-code
```

---

## Report Template

Full report structure:

```markdown
# Analysis Report: {feature-name}
**Date:** {current-date}
**Analyzer:** Claude Code Analyze Skill v1.0

## Executive Summary

**Confidence Score:** {X}/10

**Top 3 Concerns:**
1. {Most critical issue}
2. {Second issue}
3. {Third issue}

**Key Recommendations:**
1. {Primary action}
2. {Secondary action}
3. {Tertiary action}

---

## Risk Analysis (from analyze-risk-finder agent)
{Full risk analysis output including Devil's Advocate + Assumption Testing}

---

## Alternatives Analysis (from analyze-alternatives-explorer agent)
{Full alternatives output with comparison matrix}

---

## Simplification Analysis (from analyze-simplification-advisor agent)
{Full simplification output with phased delivery}

---

## Synthesis
{Combined findings from all 3 agents with weighted confidence score}

---

## Recommended Next Steps

Based on this analysis:

{If confidence >= 8}
✅ Plan is solid. Proceed with implementation via `/2-code`

{If confidence 5-7}
⚠️ Plan needs refinement. Consider:
- Address critical issues first
- Validate key assumptions
- Then proceed with caution

{If confidence < 5}
🔴 Plan needs significant revision. Recommend:
- Consider alternative approach
- Run `/1-plan` with new requirements
- Or let /1-plan FASE 5 decompose for better manageability
```

---

## Integration with Other Skills

### With /1-plan
- Integrated in /1-plan FASE 4 (optional quality check before decomposition)
- Analyze output to validate approach
- Feedback findings into improved plans before complexity analysis

### With /2-code
- Reference analysis during implementation
- Watch for identified risks

---

## Scripts

### analyze_plan.py
Main script that:
- Loads context file
- Runs three analysis techniques
- Generates comprehensive report
- Calculates confidence scores

---

## Best Practices

### Language
Follow the Language Policy in CLAUDE.md.

### General
1. **Be thorough** - Don't skip uncomfortable questions
2. **Be specific** - Vague concerns aren't actionable
3. **Be constructive** - Offer solutions, not just problems
4. **Be realistic** - Perfect is enemy of good
5. **Be timely** - Analyze before significant investment

---

## Examples

### Example: Authentication Analysis

**Devil's Advocate findings:**
- Session management could be vulnerable
- Password reset flow has security gaps

**Assumption Testing findings:**
- Assuming users have email (not validated)
- Assuming 2FA adoption (likely low)

**Alternative Approaches:**
- OAuth-only (simpler, more secure)
- Passwordless authentication

**Result:** Confidence 6/10, recommend OAuth approach

### Example: E-commerce Analysis

**Devil's Advocate findings:**
- Payment processing failure handling weak
- Inventory sync could cause overselling

**Assumption Testing findings:**
- Assuming real-time inventory (actually 5min delay)
- Assuming single currency (international needed)

**Alternative Approaches:**
- Use payment service (Stripe) instead of custom
- Implement reservation system for inventory

**Result:** Confidence 5/10, critical issues must be addressed

---

## Version History

- **v2.0** (2025-12-10): Parallel agent architecture
  - FASE 2 now uses 3 parallel agents for analysis
  - New agents: analyze-risk-finder, analyze-alternatives-explorer, analyze-simplification-advisor
  - ~67% context token savings (analysis moved to agents)
  - 3x faster FASE 2 execution (parallel instead of sequential)
  - Weighted synthesis in FASE 3 combining 3 perspectives
  - Added notification after analysis complete

- **v1.1** (2024-10-24): Enhanced with interactive improvement
  - Added fourth technique: Simplification Analysis
  - Interactive question-based plan improvement
  - User-guided refinement process
  - Generate improved context based on user feedback

- **v1.0** (2024-10-24): Initial implementation
  - Three core techniques
  - Confidence scoring
  - Integration with pipeline