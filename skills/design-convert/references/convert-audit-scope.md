# Convert Audit Scope

Loaded from `route-convert.md` PHASE 0.4 **after** its inline availability guard has already established that the audit option is on the table. Governs whether the audit option is the recommended default, and what an accepted audit reconciles. The guard itself lives inline in the route file — it is three lines, and reading a whole reference to learn that the option does not apply is a read that pays for nothing.

## Recommended marker (auto-nudge)

Show `(Recommended)` after the audit option instead of "Full page" when `$INPUT_SOURCE ∈ {figma-mcp, figma-rest}` AND `$ANALYSIS` Type = `Full page` AND either signal below fires. Otherwise keep `(Recommended)` on "Full page".

- **Phrase signal (weaker):** the conversation implies an already-built page needing reconciliation (phrases like "already built", "existing page", "does it match", "check against the design", "reconcile"; NL: "bestaande pagina", "al gedaan", "klopt het", "controleer", "tweaks").
- **Backlog-status signal (stronger, prefer this when available):** a page name can already be derived from context (a `$CONVERT_TARGET` set via the backlog-transition lookup in `SKILL.md` PHASE 0.3 Step 3, or a source frame/name that matches an existing `backlog.json` feature by name) AND that feature's `status` is `DONE` or `stage` is `"built"`. This is an objective fact, not a phrasing guess — trust it over the phrase signal when both are checkable, and don't skip it just because the phrase signal didn't fire.

## On "Audit existing page vs design"

Set `$SCOPE = "audit"`, then ask one follow-up before continuing:

```yaml
header: "Audit scope"
question: "What should this audit reconcile?"
options:
  - label: "Style + content (Recommended)", description: "Colors, spacing, radii, typography, text, and images — everything convert-audit.md can compare"
  - label: "Content & images only", description: "Text and images only — leave color, spacing, and typography exactly as they are today"
multiSelect: false
```

Store as `$AUDIT_PROPERTY_SCOPE` (`everything` | `content`). No third "structure only" choice here — `convert-audit.md` Step C's escalation check already detects and handles structural mismatches (missing/extra/reordered sections) automatically regardless of this setting; a separate user-selectable mode would just create two competing mechanisms for the same case. `$AUDIT_PROPERTY_SCOPE` governs Steps B, C, and 3.2c in `convert-audit.md` and `convert-verification-loop.md` — see those files for the conditional behavior.

Then continue normally through PHASE 0.5, 0.5b, and 0.6 (the audit needs the backlog match, worktree, and the light component scan to map Figma sections to code) — then PHASE 1 dispatches to the audit procedure instead of a mode file. When `$TARGET_PAGE_CONFIRMED = "other:{route}"` (0.25): the audit target is `{route}`, not `app/page.tsx` — carry `{route}` into 0.5's page-file lookup and into `convert-audit.md` Step A.1 in place of the default homepage assumption.
