---
name: dev-learn
description: Learn coding topics with guided comprehension methods. Use with /dev-learn.
argument-hint: "[topic, URL, or file path]"
metadata:
  author: claude-config
  version: 1.1.0
  category: dev
---

## Overview

Understanding-first learning skill for coding topics. Accepts lesson URLs (GitHub, docs), topic names, file paths, or pasted code. Breaks material into core concepts, teaches through comprehension methods, generates educational code with annotations, and offers optional hands-on practice. Auto quick mode for simple topics (1-2 concepts). Final output can be copied to clipboard.

Flow: parse input → identify concepts → [auto quick or full] → teach (method choice) → working example → practice (optional) → copy summary to clipboard.

## Workflow

### Phase 0: Parse Input

**URL detected** (starts with `http`):

1. Fetch content via WebFetch. If fetch fails (timeout, 404, auth required, redirect loop):
   ```yaml
   header: "Fallback"
   question: "URL not reachable. How do you want to proceed?"
   options:
     - label: "Paste content (Recommended)", description: "Paste the lesson content here — I'll process it as text"
     - label: "Describe the topic", description: "Describe the topic in your own words, continue without a source"
   multiSelect: false
   ```
   On paste: continue with pasted content as if fetched. On describe: switch to topic-text flow below.
2. Extract: topic title, core content, assignments/exercises if present
3. Detect course code from URL path (e.g., `PRG07` from `HR-CMGT/PRG07-2025-2026`)

**File path detected** (contains `/` or `\` with file extension, or starts with `src/`, `app/`, `./`):

1. Read the file(s) via Read tool. If input contains glob patterns (e.g., `src/components/*.tsx`): use Glob to resolve, then read
2. Identify: language, framework, patterns used, key concepts
3. Derive `topic_title` from the primary concept or file purpose (e.g., "Authentication Middleware" from `src/middleware/auth.ts`)

**Code snippet** (pasted code block in chat, no URL or path):

1. Detect language from syntax
2. Identify patterns and concepts used in the code
3. Ask for topic title if not obvious from context

**Topic text** (no URL, path, or code):

1. Accept topic as-is (e.g., "React hooks", "async/await", "SQL joins")
2. If topic references a specific library/framework: use Context7 `resolve-library-id` → `query-docs` for current documentation

**Input type detection:**

Classify the input to set smart defaults throughout the skill:

| Signal                                                                       | Type           | Effect                                                    |
| ---------------------------------------------------------------------------- | -------------- | --------------------------------------------------------- |
| Topic is a programming language name (e.g., "Kotlin", "Rust", "Python")      | `language`     | Default method → Syntax Explorer, Key Parts → recommended |
| Topic is syntax/idiom (e.g., "async/await", "pattern matching", "generics")  | `language`     | Default method → Syntax Explorer                          |
| Topic is a framework/library/API (e.g., "React hooks", "MapView", "Express") | `framework`    | Default method → Concept Mapping                          |
| URL with lesson material                                                     | `lesson`       | Default method → Concept Mapping                          |
| File path(s) or pasted code snippet                                          | `codebase`     | Default method → Architecture Walkthrough                 |
| System design / architecture topic                                           | `architecture` | Default method → Architecture Walkthrough                 |

Store `input_type` for use in Phase 2 (method default) and Phase 4 (Key Parts intensity). Store `topic_title` for use in Phase 6.

**Knowledge assessment (auto-research):**

Before teaching, assess whether you have sufficient knowledge to teach this topic well. This is a silent self-check — no AskUserQuestion needed.

Research is **needed** when:

- Topic involves a specific library, framework, or API (even well-known ones — docs change between versions)
- Topic references recent features, version-specific behavior, or a library you're less certain about
- Lesson URL referenced external documentation links that weren't fetched yet
- You are unsure about current best practices or syntax for this topic

Research is **not needed** when:

- Topic is a well-established CS fundamental (loops, recursion, OOP, data structures)
- Input type is `codebase` — the source code IS the material
- URL content already provided comprehensive lesson material

**Research actions** (execute silently, in parallel where possible):

- **Context7**: `resolve-library-id` → `query-docs` for any library/framework mentioned. Always prefer this over general knowledge for API syntax and usage patterns.
- **WebSearch**: 1-2 targeted queries for current best practices, common pitfalls, or version-specific changes. Focus on "how to" and "best practices" rather than generic overviews.

Do not present research findings separately — weave them into the teaching in Phase 1-3. If research reveals that a concept is more complex than initially assumed, adjust the concept count accordingly.

### Phase 1: Identify Concepts

Break the topic into core concepts. Present as numbered list:

```
CONCEPTS

Topic: {topic title}
Source: {URL, file path, or "own knowledge"}

1. {concept} — {one-line description}
2. {concept} — {one-line description}
3. {concept} — {one-line description}
...
```

**Auto quick mode detection:**

If 1-2 concepts identified → switch to quick mode:

- Skip concept confirmation (no AskUserQuestion)
- Skip Phase 2 method choice — explain directly with a clear example
- Skip Phase 3-5 entirely
- Phase 6: save with auto-confidence 4/5, skip confidence question
- User can override by saying "deep dive" or "extended" → switch to full mode

If 3+ concepts → full mode:

- Confirm via AskUserQuestion (Yes/Adjust)
- If lesson material includes assignments, note them separately — they feed into Phase 5
- Continue to Phase 2

### Phase 2: Comprehension (Method Choice)

Read `skills/shared/EXPLANATION.md` to calibrate term introductions, analogies, and code-explanation depth to the user's `Explanation Level:` before producing any teach content.

Read `references/learning-methods.md` for the selected method's protocol.

Present method choice via AskUserQuestion. Mark the default as "(Recommended)" based on `input_type` from Phase 0:

- `language` → Syntax Explorer (Recommended)
- `lesson` or `framework` → Concept Mapping (Recommended)
- `architecture` → Architecture Walkthrough (Recommended)

```yaml
header: "Method"
question: "How do you want to learn this?"
options:
  - label: "{default method} (Recommended)", description: "{description}"
  - label: "Concept Mapping", description: "Build visual understanding — core concepts and their relationships as a diagram"
  - label: "Syntax Explorer", description: "Learn syntax, idioms and language patterns with built-in typing exercises"
  - label: "Code Review Challenge", description: "Evaluate code for correctness and improvement points"
multiSelect: false
```

If user selects "Other": offer Architecture Walkthrough, Spot the Issue, or Teach-Back.

Execute the chosen method following its protocol from `references/learning-methods.md`. Each method ends with a comprehension summary listing which concepts are understood and which need reinforcement.

### Phase 3: Working Example

Generate complete, runnable code that implements the topic. Annotate educationally:

**Annotation conventions:**

- `// STEP N: {title}` — headers mapping to concepts from Phase 1
- `// Warning: {common mistake}` — frequent errors and why they happen
- `// Insight: {why this works}` — deeper understanding of the mechanism
- `// Explore: {suggestion}` — try changing this value, observe the difference

**Rules:**

- Code must be runnable, not pseudo-code
- Use the same language/framework as the lesson material or topic
- Keep the example focused — demonstrate all identified concepts but avoid unrelated complexity
- If lesson material includes a specific assignment: implement that assignment as the working example

**Codebase input (`input_type: codebase`):** The working example IS the existing code. Add educational annotations inline to the user's own code rather than generating new code. This teaches them what their code does and why.

Present the annotated code, then briefly walk through the flow connecting it back to the concepts.

### Phase 4: Key Parts (Optional)

**Skip this phase if Phase 2 method was Syntax Explorer** — typing exercises are already built into that method.

Intensity varies by `input_type`:

- `language`: recommend practice, extract 5+ sections focused on syntax patterns
- `framework` / `lesson`: optional, extract 3 sections focused on core API calls
- `architecture`: optional, extract 2-3 sections focused on key logic

```yaml
header: "Practice"
question: "Do you want to write the core parts yourself to practice?"
options:
  - label: "Yes, let's practice (Recommended)", description: "Write {3-5} crucial code sections yourself"
  - label: "No, skip", description: "Continue to the next step"
multiSelect: false
```

If yes:

1. Extract critical code sections from the working example (count based on intensity above)
2. For each section, show the surrounding context but replace the key part with a placeholder:

   ```
   KEY PART {N}: {what to implement}

   Context:
   {surrounding code with placeholder}

   Hint: {one-line hint about the approach}
   ```

3. Wait for user to write each part
4. Evaluate each attempt:
   - Correct? Mark with checkmark
   - Edge cases missed? Point them out
   - Conceptual misunderstanding? Explain and retry
5. Summary: X/Y correct on first attempt, key takeaways

### Phase 5: Direct & Review (Optional)

```yaml
header: "AI Practice"
question: "Do you want to do a variation assignment via AI-directed practice?"
options:
  - label: "Yes, give me an assignment (Recommended)", description: "Have Claude build a variation — train your prompting and review skills"
  - label: "No, finish", description: "Continue to saving"
multiSelect: false
```

If yes:

1. Present a variation assignment based on the topic but with a twist:

   ```
   ASSIGNMENT

   Build: {variation of the original topic}
   Twist: {what makes this different from the working example}
   Focus: {which concepts this tests}
   ```

2. User writes prompts to direct Claude. Claude acts as a "junior developer" that follows instructions literally — producing output that may need correction
3. User reviews generated code, identifies issues
4. Evaluate the session:
   - Prompt quality: was the intent clear? Did it cover edge cases?
   - Review accuracy: did the user catch the deliberate issues?
   - Concept understanding: demonstrated through prompt precision

### Phase 6: Confidence & Summary

**Confidence self-assessment:**

```yaml
header: "Understanding"
question: "How well do you understand this topic now?"
options:
  - label: "5 - Can explain it", description: "I can explain this to someone else"
  - label: "4 - Good understanding", description: "I understand it and can apply it"
  - label: "3 - Basic understanding", description: "I understand the core but am uncertain about details"
  - label: "2 - Surface level", description: "I have an idea but am still missing a lot"
multiSelect: false
```

**Build summary content:**

Compose a final markdown summary in the chat. Template (full mode):

```markdown
# {Topic Title}

> {input_type} · confidence {N}/5 · method: {chosen method}
> Source: {URL, file path, or "topic"}

## Core Concepts

{numbered list from Phase 1 with status markers}

## What I Learned

{key takeaways from the comprehension phase — 3-5 bullet points}

## Working Example

{annotated code from Phase 3, condensed — keep annotations}

## Open Questions

{anything still unclear or worth revisiting}
```

Quick-mode template:

```markdown
# {Topic Title}

## Summary

{concise explanation — what it is, how it works, when to use it}

## Example

{code example from the quick explanation}
```

**Copy to clipboard:**

Offer the option via `AskUserQuestion` and execute the platform command per [`shared/CLIPBOARD.md`](../shared/CLIPBOARD.md). User can paste into their note-taking app, doc, or wherever they keep learning logs.

**Completion output:**

```
LEARNED!

Topic: {topic_title}
Method: {method used}
Confidence: {N}/5
{If copied: "Copied to clipboard ({N} chars)."}
{If practice done: "Practice: Key Parts {X/Y correct}, Direct & Review completed"}

Next steps:
- /dev-learn [next topic] — learn the next topic
```

> **Todo**: Apply the Next-Step Clipboard Offer (binary Ja/Nee) —
> read '.claude/skills/shared/NEXT-STEP-OFFER.md'.
> Recommended command: /dev-ship {feature} → resume building the feature.

## Guidelines

**Teaching principles:**

- Meet the learner where they are — adjust depth based on responses
- One concept at a time during comprehension, never dump everything at once
- Use analogies from the user's domain when explaining abstract concepts
- If the user is confused after explanation: try a different angle, not the same words louder
- Celebrate correct understanding, gently correct misconceptions

**Formatting:**

- NEVER blockquote syntax (`>`) — unreadable background in dark terminals
- NEVER backticks for emphasis on regular words — use **bold**
- Backticks only for code, file paths, and command references
- Code blocks: always specify language for syntax highlighting

**Language:** Instructions in English. Runtime conversation in Dutch (following CLAUDE.md language policy). Code comments in English.
