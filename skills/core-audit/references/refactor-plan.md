# Refactor: Selection, Apply, Verify

## 5.1 Compile Changes

Collect every proposed change from the analysis. Per change:

- Title + target location
- Classification: **Significant** (structural change, content rewrite, logic change, section add/remove, reference extraction) or **Minor** (phrasing, typo, formatting, small wording)
- Impact estimate: lines/tokens saved per run, modals removed, ambiguity resolved
- Dependencies (B requires A)

Order significant changes by impact, highest first.

**Refactor principles:**

- Remove what Claude already knows — redundancy reduces signal
- Remove dead paths; restructure for top-to-bottom readability
- Apply token-efficiency techniques (`skills/shared/SKILL-PATTERNS.md § Token Efficiency`, incl. Lazy Reference Loading) when criteria are met
- Preserve unique project-specific knowledge and AskUserQuestion UX
- Don't sacrifice clarity for brevity — if a longer explanation prevents mistakes, keep it

## 5.2 Selective Approval

This is the single approval gate. Present a numbered plain-text list (`SKILL-PATTERNS.md § Numbered List Selection`). Per significant change include a `--- Before ---` / `--- After ---` block so the user approves concrete diffs, not titles:

```
PROPOSED CHANGES

Significant:
1. [title] — [impact] [depends on: n]
   --- Before --- / --- After ---
2. ...

Minor (bundled):
- [one-line each]
```

Ask: "Which significant changes do I apply? Enter numbers (e.g. `1, 3`, `1-4`, `all`, `all except 2`). The minor bundle is included unless you add `no minors`."

- Empty or `none` with minors excluded → stop without modifying the skill
- Selected change depends on an unselected one → say so and re-ask
- Echo the parsed selection before applying

## 5.3 Apply

Apply approved changes with Edit. For new reference extractions: Write the new `references/{descriptive-name}.md`, replace the inline block with a transition-marker Read directive.

Bump the audited skill's `metadata.version`: minor bump for significant changes, patch for a minors-only pass.

## 5.4 Verify

1. Re-read the modified files
2. Validate frontmatter (required fields, description pattern + budget)
3. Re-run the reference integrity check (all mentioned paths exist, no orphans)
4. `reads:`/`writes:` changed → re-run `python3 scripts/check-handoff.py`
5. Structural change to a `dev-*`/`game-*` pipeline skill → remind the user to check the counterpart skill (project CLAUDE.md § Rules for Changes)

```
REFINED: [skill-name]

Changes applied: [n] significant + [n] minor
- [change titles]

Version: [old] → [new]
Frontmatter: [valid | issues found]
References: [ok | missing/orphans]
Counterpart: [n/a | sync needed: [skill]]
```
