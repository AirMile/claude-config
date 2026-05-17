# Refactor Lens Prompts

Lens-specific body content for PHASE 1 Explore agents. Read the relevant section and insert it after the universal prompt header in the agent prompt.

In **single-lens mode** (feature with <4 pipeline files): include all three sections combined under one agent.

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

CLARITY & QUALITY:
- Control-flow smells: nested 3+ levels, ternary chains (a ? x : b ? y), dense one-liners → early returns / if-else / guards / lookup table
- Names encode units/ownership/lifetime: `timeoutMs` not `t`, `rawHtml` vs `safeHtml`. Primitives without unit in name = smell.
- Dead code / unused exports
- Unnecessary comments (WHAT instead of WHY, task-references, narrating)
- Redundant state (state that can be derived)
- Stringly-typed code where constants/enums exist
- Error-handling smells: over-defensive try/catch around code that can't fail, OR silent swallowing (catch {}, `?? ""` that hides missing data)
- Leaky abstractions / internal details exposed
- CODING-RULES.md violations — General + TypeScript sections (R007-R009, T001-T203)
- For frontend files (.tsx/.jsx/.vue/.svelte): also FRONTEND-RULES.md violations (R001-R208, H001-H209, A001-A203, P001-P203)
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
