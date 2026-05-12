# Visual Verification

Shared screenshot-compare-fix loop pattern. Used by `frontend-convert` (PHASE 3) and `frontend-design` (PHASE 3.6). See `PLAYWRIGHT.md` for CLI details and error recovery.

---

## Verification Loop

```
1. playwright-cli goto [page URL]
2. playwright-cli run-code "async page => { await page.waitForTimeout(3000); }"
3. playwright-cli screenshot --filename=verify-round-[N].png
4. Read verify-round-[N].png
5. Compare against reference (source image, ASCII layout, or design spec)
6. Assess: acceptable | fixable | max rounds reached
7. If fixable + rounds remaining → edit code, go to 1
8. If acceptable OR max rounds → exit loop, report
```

**Always exit after max rounds** — report remaining discrepancies, never block.

---

## Round Management

| Policy   | Rounds | Use case                                     |
| -------- | ------ | -------------------------------------------- |
| Default  | 3      | Most verification (convert, compose layout)  |
| Cosmetic | 2      | Post-layout refinement (spacing, typography) |
| Quick    | 1      | Simple structural check                      |

**Per round:**

1. Take screenshot (reuse last if no edits since)
2. List discrepancies with `file:line` and suggested fix
3. Decide: stop (acceptable) or fix + iterate
4. Report round assessment

---

## Comparison Strategies

### Source Image vs Generated (convert-style)

Compare rendered page against original screenshot/design input.

Check: layout structure, spacing, color accuracy (1:1 mode: exact match; inspiration: theme tokens applied), typography, component rendering, missing elements.

Quality: **High** (ship) | **Medium** (minor issues, acceptable) | **Low** (structural problems, fix required).

### ASCII Layout vs Rendered (compose-style)

Compare rendered page against approved ASCII layout with px annotations.

Check: all sections present, correct order, proportions match px annotations, grid structure intact, no horizontal overflow.

Quality: **Match** (all sections verified) | **Issues** (auto-fixable) | **Structural** (needs user input).

---

## Code Quality Check (first round only)

Scan generated files once during the first verification round:

| Check                                       | Rule | Mode             |
| ------------------------------------------- | ---- | ---------------- |
| `<img>` without `alt`                       | R002 | Always           |
| `<input>` without `<label>` or `aria-label` | R004 | Always           |
| `<div onClick>` without `role="button"`     | R001 | Always           |
| Functions without type annotations          | T002 | Always           |
| `bg-[#hex]`, `text-[#hex]` arbitrary colors | H101 | Inspiration only |
| `p-[16px]`, `gap-[24px]` arbitrary spacing  | R103 | Inspiration only |

Report violations alongside visual discrepancies. Fix in the same round.

---

## Responsive Check (optional)

After main verification, if page is not desktop-only:

1. `playwright-cli resize 375 812` (mobile)
2. `playwright-cli screenshot --filename=verify-mobile.png` + `Read verify-mobile.png`
3. If broken: fix responsive issues, re-screenshot
4. `playwright-cli resize 1280 800` (restore desktop)

Skip for admin/internal tools or explicitly desktop-only pages.

---

## Error Handling

| Failure                | Action                                                                          |
| ---------------------- | ------------------------------------------------------------------------------- |
| CLI unavailable        | Skip visual verification, message: "Open de pagina handmatig om te verifiëren." |
| Dev server won't start | Offer to continue without visual check                                          |
| Navigation fails       | Retry once → skip verification → document reason                                |
| Screenshot fails       | Degrade to `playwright-cli snapshot` (accessibility tree only)                  |
| file:// blocked        | Start `python3 -m http.server [port]`, gebruik `http://localhost:[port]/...`    |
