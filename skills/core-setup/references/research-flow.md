# Research Flow

Protocol for library/tool research when no tier-1 module is available. Uses Context7 for docs and WebSearch for sentiment, then presents 3 best-fit options.

---

## Step 1: User intent

Ask the user (free text, no modal) what exactly they are looking for. Example:

> Enter the name or category of what you want to install. For example: "an animation library", "Framer Motion", "auth for Next.js", "a datepicker with range support".

Parse the input into:

- **Library name** (if specifically named, e.g. "Framer Motion")
- **Category** (if generic, e.g. "animation")
- **Constraints** (compatibility, framework, size, etc.)

---

## Step 2: Context7 query

### 2a. For specific library

```
mcp__context7__resolve-library-id(libraryName: "{name}")
→ choose first match with highest trust score
mcp__context7__query-docs(context7CompatibleLibraryID: "{id}", query: "installation setup {framework}")
```

### 2b. For category-only

Find 3 candidates via WebSearch first (see Step 3), then for each:

```
mcp__context7__resolve-library-id(libraryName: "{candidate}")
mcp__context7__query-docs(...)
```

Goal: current install steps + recent version + framework compatibility.

---

## Step 3: WebSearch sentiment

```
WebSearch("best {category} library {framework} 2026")
WebSearch("{candidate} vs alternatives {framework}")
```

Filter results:

- Recent (last 12 months preferred)
- Sources: GitHub stars/issues, Reddit, dev.to, blog posts from known developers
- Negative signals: "deprecated", "unmaintained", "abandoned", last release > 18 months

---

## Step 4: Trade-off matrix

Build a table for 3 best-fit candidates:

```
| Option    | Bundle  | Weekly DLs | Last release | DX score | Stack fit |
| --------- | ------- | ---------- | ------------ | -------- | --------- |
| {opt 1}   | {kb}    | {N}        | {date}       | {1-5}    | {1-5}     |
| {opt 2}   | ...     | ...        | ...          | ...      | ...       |
| {opt 3}   | ...     | ...        | ...          | ...      | ...       |
```

**DX score** (subjective, 1-5): TypeScript support, docs quality, API ergonomics
**Stack fit**: how well it fits the detected framework + already installed libs

---

## Step 5: Present + recommend

```yaml
header: "Research result"
question: "Three best-fit options for {category} ({framework}). Which do you want?"
options:
  - label: "{best pick} (Recommended)", description: "{1-line why + key trade-off}"
  - label: "{alternative 1}", description: "{1-line + why you'd choose this}"
  - label: "{alternative 2}", description: "{1-line + why you'd choose this}"
  - label: "Cancel", description: "No install, back to PHASE 2"
multiSelect: false
```

**Recommendation logic**:

- Prefer stack-fit ≥ 4
- Tie-breaker: highest DX score
- Tie-breaker 2: smaller bundle
- Negative signals (deprecated/abandoned) → exclude

---

## Step 6: Generate install steps

On user choice, query Context7 again for exact installation:

```
mcp__context7__query-docs(
  context7CompatibleLibraryID: "{chosen-id}",
  query: "installation {framework} typescript setup config"
)
```

Distill to:

1. **Install command** (which packages, dev vs prod)
2. **Config files** (which files to edit, which entries)
3. **Boilerplate** (provider wrappers, root setup, etc.)
4. **Optional gitignore entries**

Execute as per PHASE 5 in SKILL.md.

---

## Edge cases

- **No Context7 match**: skip Context7, use only WebSearch + library website docs
- **Conflict with existing lib**: warn and ask for confirmation (e.g. installing Tailwind if StyleX is already present)
- **Framework incompatible**: abort with suggestion of compatible alternative
- **Library is paid/closed source**: report this explicitly before user choice
