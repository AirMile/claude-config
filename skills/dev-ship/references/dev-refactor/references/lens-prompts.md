# Refactor Lens Prompts

Prompt building blocks for PHASE 1 Explore agents. Every agent prompt = `## Universal Prompt Header` (substituted) + the lens-specific section (`## REUSE` / `## QUALITY` / `## EFFICIENCY` / `## SECURITY`).

In **single-lens mode** (feature with <4 pipeline files): include all applicable lens sections combined under one agent, after the universal header — three, or four when the feature is `security_relevant` (workflow.md PHASE 1 step 1).

---

## Universal Prompt Header

Every lens, every mode receives this. Substitute `{feature-name}`, `{pipeline_files}`, `{pipeline_diff}` (omit the FOCUS HINT block when absent), `{context.patterns}`, and the feature's `refactor.decisions[]`. Include the style-guide line only when `conventions_set` (PHASE 0 step 6).

````
Feature: {feature-name}
Pipeline files:
{list of pipeline_files paths}

{if pipeline_diff[feature] exists:}
FOCUS HINT — these lines are new/changed in this feature; scan
with priority (but also report issues in other lines):
```diff
{pipeline_diff[feature]}
```

{/if}

PROJECT CONVENTIONS:
{if conventions_set:}
Project style guide: Read .project/conventions.md before scanning — authoritative
for naming/structure/style. Only the QUALITY lens reports CONV findings; other
lenses use the conventions for suppression only.
{/if}
{context.patterns or "not available — use CLAUDE.md as fallback"}
If a pattern is consistent with project conventions → do NOT report.
Note: a pattern with prefix "Code maturity:" indicates how aggressively to refactor — respect the attitude described there (e.g. no over-abstractions for student/prototype projects).

KNOWN DECISIONS (skip findings that match these — already evaluated in a previous run):
{feature.json#refactor.decisions[] where action=SKIP, formatted as bullet list, or "none" if empty}

SCOPE:
- Analyze ONLY files in the pipeline files list above. Skip findings that involve
  external files or cross-cutting utilities outside that list — even if the fix
  seems obvious. Exception: a NEW utility file may be proposed if it exclusively
  extracts code from pipeline files.

DISCIPLINE:
- Max 500 words output. Short, sharp, direct.
- No nitpicks. Only issues with a clear, concrete fix.
- Skip false positives explicitly (don't even mention them).
- Format per finding: `[IMPACT|CATEGORY] file:line — problem description — concrete fix in 1 sentence`
````

---

## REUSE

```
LENS: Reuse

Scan for:
- Duplicate code blocks (>5 lines identical within pipeline files)
- Similar logic patterns (>70% similarity, 3+ locations)
- Inline logic that an existing helper/utility/stdlib can replace
- Repeated conditionals, copy-paste with minor variation

EXAMPLES:
✓ Report: 3 tools with identical JSON.stringify({text, sources}) wrapping → extract `formatResult()` helper
✓ Report: hand-rolled `lstrip/rstrip + regex` where `path.basename()` exists
✗ Skip: two functions with 3 similar lines (too small for abstraction, especially with `Code maturity: student`)
✗ Skip: abstraction that is only used 2× and doesn't make the call sites clearer
```

---

## QUALITY

```
LENS: Quality

Scan for:
SECURITY:
- Injection: exec(, eval(, new Function, os.system
- XSS: .innerHTML =, dangerouslySetInnerHTML, document.write
- Deserialization: pickle.loads on untrusted data
- GitHub Actions: ${{ github.event. in run: commands
- Server Actions ('use server' functions) without an auth/session check before the mutation — directly POST-able public endpoints, easy to miss

CLARITY & QUALITY:
- Control-flow smells: nested 3+ levels, ternary chains (a ? x : b ? y), dense one-liners → early returns / if-else / guards / lookup table
- Names encode units/ownership/lifetime: `timeoutMs` not `t`, `rawHtml` vs `safeHtml`. Primitives without unit in name = smell.
- Dead code / unused exports
- Unnecessary comments (WHAT instead of WHY, task-references, narrating)
- Redundant state (state that can be derived)
- useEffect used to derive or reset state from props (e.g. `useEffect(() => setX(compute(props)), [props])`) — compute during render instead, or reset via a `key` prop on the component
- Stringly-typed code where constants/enums exist
- Error-handling smells: over-defensive try/catch around code that can't fail, OR silent swallowing (catch {}, `?? ""` that hides missing data); floating promises — async calls without await, void, or .catch (silently dropped rejections, race conditions)
- Leaky abstractions / internal details exposed
- CODING-RULES.md violations — General + TypeScript + Testing sections (R007-R009, T001-T203, TST001-TST203)
- Deviations from .project/conventions.md (only when the header lists it) → tag [MED|CONV] or [LOW|CONV]
- For frontend files (.tsx/.jsx/.vue/.svelte): also FRONTEND-RULES.md violations (R001-R208, H001-H209, A001-A203, P001-P203) and Design Token violations (TOKENS.md T101-T111: hex literals / arbitrary-value colors instead of token classes, hardcoded `ms` or `cubic-bezier()` instead of motion tokens)
- Stack-specific anti-patterns from refactor-patterns.md

COLD-READER (can a new reader understand this without opening 3 files?):
- Locality of behavior: non-trivial line requires >2 file-jumps → relocate or rename inline
- God-object params: function takes Request/Context/Session but reads <3 fields → destructure
- Mixed abstraction levels: SQL + business-rule + HTTP-header mangling in one function → split
- Shallow abstractions: helper as complex as body, 1 caller, no naming-win → inline
- Cognitive overload: >5 mutable locals+flags live in deepest block → split or bundle in record
- Cross-file decision-duplication: same enum/switch-ladder in 3+ places → 1 source of truth

EXAMPLES:
✓ Report: `msg.constructor.name === "HumanMessage"` instead of `isHumanMessage(msg)` typeguard
✓ Report: dead exported function without callers
✓ Report: 4-level nested if/else where early-returns make it flat
✓ Report: `function charge(ctx)` reads only `ctx.userId` + `ctx.amount` → `charge(userId, amount)`
✓ Report: `const t = 5000` → `const timeoutMs = 5000`
✓ Report: PascalCase filename where conventions.md mandates kebab-case → [LOW|CONV]
✗ Skip: style choice conventions.md is silent about (don't invent conventions)
✗ Skip: comment explaining a non-obvious invariant (WHY is valuable)
✗ Skip: explicit intermediate variable instead of inline expression (clarity > compact)
✗ Skip: thin adapter at framework-seam (middleware, Express handler)
✗ Skip: context-param where framework-contract requires it
```

---

## EFFICIENCY

```
LENS: Efficiency

Scan for:
- Missed concurrency: independent awaits sequential instead of Promise.all
- N+1: loops with DB/API calls per iteration
- Hot-path bloat: blocking work on startup or per-request/per-render
- Memory leaks: unbounded Maps/arrays, missing cleanup, event listener leaks
- Recurring no-op updates in polling/intervals/event handlers
- Unnecessary existence checks (TOCTOU: pre-check file/resource before using it)
- Overly broad: reading entire files when a portion suffices, loading all items to filter one
- Redundant computations / repeated file reads

EXAMPLES:
✓ Report: `for (const c of chars) await loadBackstory(c)` → `Promise.all(chars.map(loadBackstory))`
✓ Report: `userStore` Map that grows per-user without TTL/LRU
✓ Report: `similaritySearch(q, 8).filter(...).slice(0, 3)` → filter-callback arg of the store
✗ Skip: O(n) loop over 5-item array (micro-optimization without impact)
✗ Skip: JSON.stringify in a non-hot-path debug log
```

---

## SECURITY

Conditional lens — only composed when PHASE 1 step 1 marks the feature `security_relevant`. The QUALITY lens keeps its basic SECURITY block as a baseline for every feature; overlapping findings dedup in the merge step.

```
LENS: Security

Scan for (trace data flows from input to sink — don't just pattern-match):
- AuthN/AuthZ: new routes/handlers without auth or permission check; IDOR (user-supplied id → direct object access without ownership validation)
- Server Actions ('use server' functions) without an auth/session check before the mutation — these are directly POST-able public endpoints with no visible route surface, so a "new routes/handlers" scan alone can miss them
- Secrets: hardcoded tokens/keys/passwords; secrets in logs or error messages; secrets in client-bundled code (CODING-RULES R008)
- Input flows: user input reaching SQL/shell/file paths/HTML/redirects without validation or sanitization; mass assignment (req.body spread into model/update)
- Crypto & randomness: md5/sha1 for passwords, Math.random for tokens/ids, homemade crypto, missing constant-time comparison for secrets
- SSRF & outbound requests: fetch/axios/requests with user-controlled URL, missing allowlist
- Data exposure: PII or credentials in API responses, verbose errors leaking stack/query details, overly broad CORS on new endpoints

EXAMPLES:
✓ Report: new route PATCH /api/orders/:id loads order by id without ownership check — any user can mutate any order
✓ Report: `crypto.createHash("md5")` for password hashing → bcrypt/argon2
✓ Report: `fetch(req.query.url)` without allowlist → SSRF
✗ Skip: theoretical issue without a reachable user-input path
✗ Skip: risk already neutralized by framework defaults in use (e.g. ORM parameterization, React escaping)
✗ Skip: codebase-wide concerns outside pipeline files — that's /dev-security territory
```
