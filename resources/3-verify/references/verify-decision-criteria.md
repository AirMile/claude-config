# Debug Decision Criteria

**Purpose:** Framework for analyzing whether to continue debugging or start from scratch after each debug attempt.

**Usage:** Load this file during FASE 5 (DECISION) to guide sequential thinking analysis and decision presentation.

---

## Decision Framework

After each debug attempt that has test failures, use this framework to systematically evaluate the best path forward.

### Analysis Questions

Ask these questions during sequential thinking analysis:

1. **Progress Assessment**
   - Are we making measurable progress with each attempt?
   - Are fewer tests failing than in previous attempts?
   - Is the root cause becoming clearer or more obscure?
   - Are fixes solving problems or just moving them around?

2. **Issue Complexity**
   - Are new issues being introduced by fixes? (cascading failures)
   - Is the problem isolated or spreading to other areas?
   - Is the fix complexity increasing with each attempt?
   - Are we encountering unexpected dependencies?

3. **Root Cause Clarity**
   - Do we understand why the original implementation failed?
   - Is the root cause in implementation details or architecture?
   - Are we addressing symptoms or the actual problem?
   - Is the solution path clear from here?

4. **Architecture Validity**
   - Does the current architecture support the requirements?
   - Are we fighting against the chosen approach?
   - Would a different architectural pattern be more suitable?
   - Is the implementation fundamentally aligned with the plan?

5. **Resource Evaluation**
   - How many attempts have been made so far?
   - How much time has been invested in debugging?
   - Would a fresh implementation be faster at this point?
   - What have we learned that would make a rewrite better?

---

## Indicators for "Continue Debugging"

Choose **Continue** when these indicators are present:

### Strong Indicators (High confidence to continue)

✓ **Measurable Progress**
  - Test pass rate is improving with each attempt
  - Failure count is decreasing
  - Understanding of problem is deepening

✓ **Root Cause Identified**
  - We know exactly what's causing the failures
  - Solution path is clear and straightforward
  - No architectural issues blocking progress

✓ **Clean Fixes**
  - Fixes are solving problems without creating new ones
  - Changes are isolated and predictable
  - No cascading failures appearing

✓ **Sound Architecture**
  - Current approach is fundamentally correct
  - Problem is in implementation details, not design
  - Framework/pattern choice is appropriate

✓ **High Confidence**
  - Next fix has high probability of success
  - We understand what went wrong and how to fix it
  - Fix complexity is manageable

### Supporting Indicators

- Context7 research provided clear solutions
- Errors are framework-specific and well-documented
- Similar issues have been solved successfully before
- Team/developer has experience with this type of bug
- Problem is isolated to specific components
- No major refactoring required

---

## Indicators for "Start from Scratch"

Choose **Scratch** when these indicators are present:

### Strong Indicators (High confidence for scratch)

✗ **Cascading Issues**
  - Fixing one problem creates two new problems (whack-a-mole)
  - Issue is spreading to previously working code
  - Complexity is exponentially increasing
  - Cannot isolate the problem

✗ **Unclear Root Cause**
  - After multiple attempts, still don't understand why it fails
  - Root cause keeps shifting with each investigation
  - Symptoms don't match any known patterns
  - Context7 research yielded low relevance results

✗ **Architectural Mismatch**
  - Current architecture doesn't support requirements
  - Fighting against framework conventions
  - Original pattern choice was wrong for use case
  - Would need major refactoring to make it work

✗ **Diminishing Returns**
  - Each attempt takes longer but achieves less
  - Progress has plateaued or regressed
  - Fresh implementation would likely be faster now
  - Debug time exceeds original implementation time

✗ **Wrong Approach**
  - Implementation doesn't align with original plan
  - Fundamental misunderstanding of requirements
  - Technology/framework choice inappropriate
  - Need to rethink the entire approach

### Supporting Indicators

- Multiple attempts (3+) with no progress
- Test failures remain at same level or increase
- Code becoming increasingly complex/fragile
- Lost confidence in current implementation
- Debug insights reveal fundamental flaws
- Original implementation assumptions were wrong
- Better approach identified through debugging
- Fresh start would incorporate all learnings

---

## Decision Matrix

Use this matrix to guide recommendation:

| Progress | Root Cause | Architecture | Issues | Recommendation |
|----------|-----------|--------------|---------|----------------|
| Good | Clear | Sound | None | **Continue** (high confidence) |
| Good | Clear | Sound | Minor | **Continue** (confident) |
| Some | Unclear | Sound | Minor | **Continue** (try again) |
| None | Clear | Sound | Major | **Consider Scratch** (depends on fix) |
| None | Unclear | Sound | Major | **Scratch** (likely better) |
| None | Unclear | Wrong | Major | **Scratch** (high confidence) |
| Negative | Unclear | Wrong | Cascading | **Scratch** (very high confidence) |

---

## Presentation Template

When presenting decision to user, use this structure:

```
📊 DECISION ANALYSIS - ATTEMPT {N}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Current situation:
- Attempts made: {N}
- Progress: {Improving / Plateaued / Regressing}
- Root cause clarity: {Clear / Partial / Unclear / Murky}
- New issues introduced: {Yes - describe / No}
- Architecture validity: {Sound / Questionable / Wrong}

OPTION 1: Continue Debugging
✓ Pros:
  - {Specific advantage based on indicators}
  - {Specific advantage based on indicators}
  - {Specific advantage based on indicators}
✗ Cons:
  - {Specific disadvantage or risk}
  - {Specific disadvantage or risk}

OPTION 2: Start from Scratch
✓ Pros:
  - {Specific advantage based on learnings}
  - {Specific advantage based on learnings}
  - {Specific advantage based on learnings}
✗ Cons:
  - {Specific disadvantage or cost}
  - {Specific disadvantage or cost}

💡 RECOMMENDATION: {Continue / Start from Scratch}

Reasoning: {Clear explanation referencing specific indicators from analysis}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What is your decision? (continue / scratch)
```

---

## Edge Cases

### Equal Arguments for Both Options

When indicators are balanced and no clear recommendation emerges:

- Present both options honestly with balanced view
- Note the uncertainty explicitly
- Highlight which factors user should prioritize
- Let user make decision without strong recommendation
- Defer to user's intuition and context knowledge

### First Attempt Failure

For attempt 1, generally favor **Continue** unless:
- Architectural mismatch is immediately obvious
- Requirements were completely misunderstood
- Wrong technology/framework chosen
- Catastrophic implementation errors

Reason: One attempt rarely provides enough data for scratch decision.

### Many Attempts Without Decision

If reaching attempt 5+ without resolution:
- Strongly favor **Scratch** unless clear progress
- Acknowledge time investment but don't fall for sunk cost fallacy
- Emphasize learnings that make rewrite better
- Frame as "informed second attempt" not "starting over"

---

## Scratch Type Classification

When "Start from Scratch" decision is made, classify the scratch type to determine optimal next step.

### Two Scratch Types

**ARCHITECTURAL**: Root cause is in design/architecture
- **Next step**: Run `/1-plan` to reconsider architecture with debug insights
- **Why**: /1-plan can research alternative patterns with Context7 using debug learnings

**IMPLEMENTATION**: Root cause is in implementation, architecture is sound
- **Next step**: Run `/2-code` directly with implementation fixes
- **Why**: Same architecture with better execution will succeed

---

### ARCHITECTURAL Scratch Indicators

Choose **ARCHITECTURAL** when these are true:

✗ **Wrong Architecture Pattern**
  - Current pattern (MVC/MVVM/etc) doesn't fit requirements
  - Framework conventions conflict with needs
  - Design fundamentally misaligned with use case
  - Example: Using REST API for real-time requirements

✗ **Technology Mismatch**
  - Chosen framework/library doesn't support needed features
  - Technology stack inappropriate for use case
  - Example: Using synchronous framework for async operations

✗ **Design Conflicts**
  - Core requirements impossible with current design
  - Would need complete restructure to work
  - Architecture fights against requirements
  - Example: Monolithic design for microservice requirements

✗ **Context7 Suggests Alternative**
  - Research during debug revealed better patterns
  - Industry standard differs from current approach
  - Debug insights show different architecture needed
  - Example: Event-driven pattern needed instead of request-response

✗ **Fundamental Misunderstanding**
  - Original plan misunderstood requirements
  - Core assumptions about use case were wrong
  - Design doesn't match actual problem to solve
  - Example: Built for single-user when multi-tenant needed

### IMPLEMENTATION Scratch Indicators

Choose **IMPLEMENTATION** when these are true:

✓ **Architecture Sound, Execution Flawed**
  - Correct pattern chosen, just poorly implemented
  - Design is right, code has bugs
  - Structure is good, logic has errors
  - Example: Correct MVC setup, but controller logic wrong

✓ **Logic Errors, Not Design Errors**
  - Algorithms incorrect or incomplete
  - Business logic has flaws
  - Data validation missing
  - Example: Calculation errors, missing edge cases

✓ **Implementation Details Wrong**
  - Syntax errors, typos, wrong API calls
  - Configuration mistakes
  - Missing error handling
  - Example: Wrong method names, incorrect parameters

✓ **Same Architecture Would Work**
  - Fresh implementation with same structure would succeed
  - Just need cleaner code, not different design
  - Bugs are fixable without architecture change
  - Example: Better variable names, clearer logic flow

✓ **Debug Insights Are "How" Not "What"**
  - Learnings are about implementation techniques
  - Not about choosing different patterns
  - Example: "Use async/await correctly" not "use different pattern"

---

### Classification Decision Matrix

| Root Cause | Architecture | Framework Fit | Recommendation | Scratch Type |
|-----------|--------------|---------------|----------------|--------------|
| Design wrong | Needs change | Wrong choice | Run /1-plan | **ARCHITECTURAL** |
| Design wrong | Needs change | OK choice | Run /1-plan | **ARCHITECTURAL** |
| Design OK | Sound | Wrong choice | Run /1-plan | **ARCHITECTURAL** |
| Design OK | Sound | OK choice | Run /2-code | **IMPLEMENTATION** |
| Logic errors | Sound | OK choice | Run /2-code | **IMPLEMENTATION** |
| Bug fixes | Sound | OK choice | Run /2-code | **IMPLEMENTATION** |

---

### Analysis Process

Use sequential thinking to determine scratch type:

1. **Identify root cause from debug attempts**
   - What fundamentally caused the failure?
   - Design issue or code issue?

2. **Evaluate architecture validity**
   - Can current architecture support requirements?
   - Is pattern choice appropriate?
   - Does framework fit the use case?

3. **Check Context7 findings**
   - Did research suggest alternative patterns?
   - Are we using industry anti-patterns?

4. **Assess rewrite scope**
   - Would fresh implementation change structure?
   - Or just write cleaner same-structure code?

5. **Classify and recommend**
   - ARCHITECTURAL → /1-plan needed
   - IMPLEMENTATION → /2-code sufficient

---

### Presentation to User

When presenting scratch type decision:

```
✅ SCRATCH RESET COMPLETE

Scratch Type: [ARCHITECTURAL / IMPLEMENTATION]

Analysis:
- [Specific reason from debug attempts]
- [Why this classification was chosen]
- [What fundamentally needs to change]

Recommendation: [Run /1-plan / Run /2-code]

Why [/1-plan//2-code] needed:
- [Specific reason 1]
- [Specific reason 2]
- [Specific reason 3]

[If ARCHITECTURAL:]
What /1-plan should reconsider:
- [Architectural aspect 1]
- [Architectural aspect 2]
- Context7 research: [specific topics]

[If IMPLEMENTATION:]
What /2-code should improve:
- [Implementation aspect 1]
- [Implementation aspect 2]
- [Implementation aspect 3]

Alternative: [Other option]
(Why not recommended: [reasoning])
```

---

### Edge Cases

**Mixed Indicators (Both ARCHITECTURAL and IMPLEMENTATION issues)**
- Classify as ARCHITECTURAL (safer choice)
- Reason: /1-plan can catch both architecture and implementation improvements
- /1-plan → /2-code flow covers both types
- IMPLEMENTATION → /2-code might miss architecture issues

**Uncertain Classification**
- Default to ARCHITECTURAL
- Reason: Better to overplan than underplan
- User can skip /1-plan if they disagree
- Extra planning rarely hurts

**User Disagrees with Classification**
- User always has final say
- Recommendation is guidance, not requirement
- Present reasoning but respect override
- Document user's choice in 01-intent.md

---

## Common Pitfalls to Avoid

❌ **Sunk Cost Fallacy**
Don't continue just because of time invested. Consider future cost, not past investment.

❌ **Premature Scratch**
Don't give up after one attempt unless truly catastrophic. Give debug process a fair chance.

❌ **Ignoring Architecture Issues**
If architecture is wrong, continuing debug just delays inevitable. Address it early.

❌ **Overconfidence in Fixes**
If uncertain, acknowledge it. Don't oversell fix success probability.

❌ **Undervaluing Learnings**
Scratch isn't failure - it's informed iteration with debug insights. Frame positively.

---

## Success Criteria

Remember: Debug attempt is successful only when **ALL** three test levels pass:
- ✓ Automated tests: ALL pass
- ✓ Chrome Extension tests: User confirms ALL pass
- ✓ Manual tests: User confirms ALL pass

Partial success = Not success → Need decision (continue or scratch)

---

**End of Debug Decision Criteria**
