# Learning Methods

Protocols for each comprehension method used in Phase 2 of school-learn. Read the selected method's section and follow its steps.

---

## 1. Concept Mapping

**Best for:** URL-based lesson material, new frameworks, topics with many interrelated concepts.

**Protocol:**

1. List all identified concepts from Phase 1
2. For each concept, identify:
   - Prerequisites (which concepts must be understood first)
   - Dependencies (which concepts build on this one)
   - Type: foundational / applied / integration
3. Generate an ASCII concept map showing relationships:
   ```
   [Foundational A] ──→ [Applied B] ──→ [Integration D]
                    └──→ [Applied C] ──┘
   ```
4. Walk through the map top-down: explain each concept starting with foundational ones
5. Per concept: definition (1-2 sentences) → concrete example → connection to next concept
6. After all concepts: comprehension check — ask user to explain one connection in their own words

**Output format per concept:**

```
CONCEPT {N}: {name}
Type: {foundational | applied | integration}

{2-3 sentence explanation with concrete example}

Connects to: {next concept} because {reason}
```

---

## 2. Code Review Challenge

**Best for:** Users with some prior knowledge, practical topics, API/library usage.

**Protocol:**

1. Generate a realistic code sample that implements the topic (15-40 lines)
2. Include 2-3 subtle issues:
   - One correctness issue (bug or logic error)
   - One best-practice violation (works but fragile)
   - One performance or security concern (if applicable)
3. Present the code and ask: "Review this code. What would you change and why?"
4. Wait for user response
5. Discuss findings:
   - What the user caught: confirm and deepen understanding
   - What the user missed: explain why it matters
   - What the user flagged incorrectly: clarify the misconception
6. Show the corrected version with explanations

**Presentation format:**

```
CODE REVIEW

The following code implements {topic}. Review it — what would you change?

{code block}
```

---

## 3. Architecture Walkthrough

**Best for:** Framework concepts, system design, understanding how pieces fit together.

**Protocol:**

1. Present the high-level architecture as an ASCII diagram:
   ```
   [User Action] → [Component A] → [Service B] → [Data Layer]
   ```
2. For each layer/component:
   - What it does (1 sentence)
   - Why it exists (what problem it solves)
   - What happens if you remove it (consequence)
3. Zoom into the layer most relevant to the topic
4. Show how data/control flows through the system with a concrete example
5. Compare with an alternative architecture: "You could also do X, but Y because Z"
6. Comprehension check: ask user to trace a different scenario through the architecture

**Flow:**

```
ARCHITECTURE

{ASCII diagram of full system}

ZOOM: {relevant layer}
{detailed explanation}

ALTERNATIVE: {different approach}
Trade-off: {what you gain vs lose}
```

---

## 4. Spot the Issue

**Best for:** Debugging mindset, edge cases, common pitfalls in a topic.

**Protocol:**

1. Generate 3 code snippets (5-15 lines each), each with one deliberate bug:
   - Snippet 1: Logic error (wrong condition, off-by-one, missing case)
   - Snippet 2: Runtime error (null reference, async issue, type mismatch)
   - Snippet 3: Subtle issue (race condition, memory leak, security flaw)
2. Present snippets one at a time
3. For each: "This code has a bug. Can you find it?"
4. Wait for user response
5. If correct: explain WHY it's a bug (root cause, not just symptom)
6. If incorrect: give a hint, let user try again (max 2 hints)
7. After all 3: summary of patterns — what category of bugs to watch for in this topic

**Presentation format:**

```
SPOT THE ISSUE ({N}/3)
Difficulty: {easy | medium | hard}

{code block}

What's wrong with this code?
```

---

## 5. Teach-Back

**Best for:** Verifying deep understanding, finding misconceptions, after initial learning.

**Protocol:**

1. Pick 2-3 core concepts from Phase 1
2. For each concept, ask the user to explain it:
   ```
   Explain to me: {concept}
   Pretend I'm a teammate who hasn't seen this before.
   ```
3. Listen to the explanation without interrupting
4. Ask 2-3 follow-up questions that probe deeper:
   - "What happens if {edge case}?"
   - "Why {specific detail} instead of {alternative}?"
   - "How does this relate to {connected concept}?"
5. Identify gaps: concepts the user skipped, simplified too much, or got wrong
6. Fill gaps with targeted mini-explanations (not full re-teaching)
7. Ask user to re-explain the part they got wrong — confirm understanding

**Interaction style:**

- Act as a curious but critical colleague, not a test examiner
- Genuine follow-up questions, not gotcha questions
- Acknowledge good explanations explicitly
- When correcting: "Almost — the key difference is..." not "Wrong, it's actually..."

---

## 6. Syntax Explorer

**Best for:** Learning a new programming language, syntax patterns, language idioms, operator shortcuts.

**Protocol:**

1. Identify the user's known languages (ask if unclear: "Which languages do you already know?")
2. For each concept from Phase 1, present a **comparison table**:

   ```
   SYNTAX: {concept}

   | {Known Language} | {New Language}  | Notes                    |
   |------------------|-----------------|--------------------------|
   | x ?? fallback    | x ?: fallback   | Elvis operator in Kotlin |
   | x?.property      | x?.property     | Same syntax, both null-safe |
   | async/await      | suspend fun     | Coroutines, not Promises |
   ```

3. After each table, highlight **idioms** — the "right way" to do it in this language:

   ```
   IDIOM: {pattern name}

   Instead of: {how you'd write it coming from known language}
   Write:      {idiomatic version in new language}
   Why:        {what makes this idiomatic — performance, readability, convention}
   ```

4. **Built-in typing exercise** per concept (this replaces Phase 4 for language-type input):

   ```
   TYPE IT: Write a {construct} that {does X}

   Expected pattern:
   {description of what the code should do, NOT the code itself}
   ```

   Wait for user to type. Evaluate:
   - Syntax correct? If not, show the fix with explanation
   - Idiomatic? If not, show the preferred pattern
   - Works but verbose? Show the shorthand

5. After all concepts: generate a **cheatsheet** summary:

   ```
   CHEATSHEET: {language}

   {concept}: {syntax pattern}
   {concept}: {syntax pattern}
   ...

   Key idioms:
   - {pattern} → {when to use}
   ```

   This cheatsheet is saved to a separate accumulating file in Phase 6 (`Cheatsheet - {language}.md`), not embedded in the topic note. Each session appends new patterns — one reference document per language that grows over time.

**Cross-language mapping rules:**

- Always compare to a language the user knows — never explain in isolation
- Highlight false friends: same syntax, different behavior (e.g., `==` in JS vs Java)
- Group related patterns: if teaching null-safety, show `?.`, `?:`, `!!`, `let{}` together
- Order by frequency: most-used patterns first, edge cases last
