---
name: school-learn
description: >
  Learn coding topics with understanding-first methods. Parses lesson URLs,
  topic names, file paths, or code snippets into core concepts. Teaches through
  6 comprehension methods, generates annotated educational code, and offers
  optional practice phases. Tracks progress in Obsidian.
  Use with /school-learn [topic, URL, or file path].
argument-hint: "[topic, URL, or file path]"
disable-model-invocation: true
metadata:
  author: mileszeilstra
  version: 1.0.0
  category: school
---

## Overview

Understanding-first learning skill for coding topics. Accepts lesson URLs (GitHub, docs), topic names, file paths, or pasted code. Breaks material into core concepts, teaches through comprehension methods, generates educational code with annotations, and offers optional hands-on practice. Auto quick mode for simple topics (1-2 concepts). Progress tracked in Obsidian `Academic/` folder.

Flow: parse input → identify concepts → [auto quick or full] → teach (method choice) → working example → practice (optional) → save to Obsidian.

## Workflow

### Phase 0: Parse Input

**URL detected** (starts with `http`):

1. Fetch content via WebFetch. If fetch fails (timeout, 404, auth required, redirect loop):
   ```yaml
   header: "Fallback"
   question: "URL niet bereikbaar. Hoe wil je verder?"
   options:
     - label: "Inhoud plakken (Recommended)", description: "Plak de lesinhoud hier — ik verwerk het als tekst"
     - label: "Beschrijf het onderwerp", description: "Beschrijf het topic in eigen woorden, ga verder zonder bron"
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

Store `input_type` for use in Phase 2 (method default) and Phase 4 (Key Parts intensity).

**Course/vak detection:**

Skip this step if `input_type` is `codebase` — default `course_folder` to project name (from `package.json` name, repo folder name, or ask user) and save under `Academic/Projects/` instead of a course folder.

For all other input types:

1. List existing Academic folders via `mcp__obsidian__list_directory(path="Academic")`
2. If course code detected from URL: try to match against existing folders
3. Ask via AskUserQuestion:

```yaml
header: "Vak"
question: "Bij welk vak hoort dit onderwerp?"
options:
  - label: "{matched folder} (Recommended)", description: "Bestaand vak in Academic/"
  - label: "{other existing folder}", description: "Bestaand vak"
  - label: "Nieuw vak aanmaken", description: "Maak een nieuwe map aan in Academic/"
multiSelect: false
```

If "Nieuw vak": ask for folder name.

Store `course_folder` and `topic_title` for Phase 6.

**Existing note check (terugkom-flow):**

After determining `course_folder` and `topic_title`, check if a note already exists:

1. Attempt `mcp__obsidian__read_note(path="Academic/{course_folder}/{topic_title}.md")`
2. If note exists and has frontmatter with `confidence` and `status`:

```
PREVIOUS SESSION FOUND

Topic: {topic_title}
Last studied: {date}
Confidence: {confidence}/5
Method: {method}
Open questions:
{list from "Open Questions" section}
```

```yaml
header: "Terugkomen"
question: "Je hebt dit onderwerp eerder bestudeerd. Wat wil je doen?"
options:
  - label: "Verder leren (Recommended)", description: "Focus op open vragen en zwakke concepten uit vorige sessie"
  - label: "Opnieuw beginnen", description: "Start van scratch — negeer vorige sessie"
  - label: "Ander topic", description: "Ik wil een ander onderwerp leren"
multiSelect: false
```

- **Verder leren**: Load previous concepts from the note's "Core Concepts" section. Mark previously understood concepts. Skip Phase 1 — go directly to Phase 2 with focus on open questions and concepts that lacked confidence. At save time (Phase 6): merge new learnings into existing note via `mcp__obsidian__patch_note` instead of overwrite.
- **Opnieuw beginnen**: Continue to Phase 1 as normal (overwrite at save time).
- **Ander topic**: Ask for new topic, restart Phase 0.

3. If no note exists: continue to Phase 1 as normal.

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
Source: {URL, file path, or "eigen kennis"}

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
- User can override by saying "deep dive" or "uitgebreid" → switch to full mode

If 3+ concepts → full mode:

- Confirm via AskUserQuestion (Ja/Aanpassen)
- If lesson material includes assignments, note them separately — they feed into Phase 5
- Continue to Phase 2

### Phase 2: Comprehension (Method Choice)

Read `references/learning-methods.md` for the selected method's protocol.

Present method choice via AskUserQuestion. Mark the default as "(Recommended)" based on `input_type` from Phase 0:

- `language` → Syntax Explorer (Recommended)
- `lesson` or `framework` → Concept Mapping (Recommended)
- `architecture` → Architecture Walkthrough (Recommended)

```yaml
header: "Methode"
question: "Hoe wil je dit leren?"
options:
  - label: "{default method} (Recommended)", description: "{description}"
  - label: "Concept Mapping", description: "Visueel begrip opbouwen — kernconcepten en hun relaties als diagram"
  - label: "Syntax Explorer", description: "Syntax, idiomen en taalpatronen leren met ingebouwde typ-oefeningen"
  - label: "Code Review Challenge", description: "Beoordeel code op correctheid en verbeterpunten"
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
question: "Wil je de kernonderdelen zelf schrijven om het in je vingers te krijgen?"
options:
  - label: "Ja, laten we oefenen (Recommended)", description: "Schrijf {3-5} cruciale code-secties zelf"
  - label: "Nee, skip", description: "Ga door naar de volgende stap"
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
question: "Wil je een variatie-opdracht doen via AI-directed practice?"
options:
  - label: "Ja, geef me een opdracht (Recommended)", description: "Stuur Claude aan om een variatie te bouwen — train je prompt en review skills"
  - label: "Nee, afronden", description: "Ga door naar opslaan"
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

### Phase 6: Save & Confidence

**Confidence self-assessment:**

```yaml
header: "Begrip"
question: "Hoe goed snap je dit onderwerp nu?"
options:
  - label: "5 - Kan het uitleggen", description: "Ik kan dit aan iemand anders uitleggen"
  - label: "4 - Goed begrip", description: "Ik snap het en kan het toepassen"
  - label: "3 - Basis begrip", description: "Ik snap de kern maar twijfel over details"
  - label: "2 - Oppervlakkig", description: "Ik heb een idee maar mis nog veel"
multiSelect: false
```

**Save to Obsidian:**

Write note via `mcp__obsidian__write_note`:

- **Path:** `Academic/{course_folder}/{topic_title}.md`
- **Mode:** `overwrite`
- **Frontmatter:**
  ```yaml
  status: learned | in-progress # based on confidence (4-5 = learned, 2-3 = in-progress)
  date: "{YYYY-MM-DD}"
  method: "{chosen method}"
  confidence: { 1-5 }
  tags: [school, { course_code }, { framework/language }]
  source: "{URL or 'topic'}"
  ```
- **Content template (full mode):**

  ```markdown
  # {Topic Title}

  ## Core Concepts

  {numbered list from Phase 1 with status markers}

  ## What I Learned

  {key takeaways from the comprehension phase — 3-5 bullet points}

  ## Working Example

  {annotated code from Phase 3, condensed — keep annotations}

  ## Open Questions

  {anything still unclear or worth revisiting}
  ```

- **Content template (quick mode):**

  ```markdown
  # {Topic Title}

  ## Summary

  {concise explanation — what it is, how it works, when to use it}

  ## Example

  {code example from the quick explanation}
  ```

**Cheatsheet accumulation (Syntax Explorer only):**

If Phase 2 method was Syntax Explorer, maintain a separate accumulating cheatsheet per language:

1. Check if `Academic/{course_folder}/Cheatsheet - {language}.md` exists via `mcp__obsidian__read_note`
2. If exists: append new patterns to the existing cheatsheet via `mcp__obsidian__patch_note` — add new entries under the relevant sections, skip duplicates
3. If not exists: create via `mcp__obsidian__write_note` with frontmatter `{type: "cheatsheet", language: "{language}", tags: [school, cheatsheet, {course_code}]}` and initial content from the session's cheatsheet output
4. Include link to cheatsheet in the topic note: `See also: [[Cheatsheet - {language}]]`

**Completion output:**

```
LEARNED!

Topic: {topic_title}
Course: {course_folder}
Method: {method used}
Confidence: {N}/5
Saved: Academic/{course_folder}/{topic_title}.md
{If Syntax Explorer: "Cheatsheet: Academic/{course_folder}/Cheatsheet - {language}.md (created/updated)"}
{If practice done: "Practice: Key Parts {X/Y correct}, Direct & Review completed"}

Next steps:
- /school-learn [next topic] — leer het volgende onderwerp
- Review in Obsidian — herlees je notities voor spaced repetition
```

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
