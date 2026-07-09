## Next-Step Clipboard Offer

**When:** A pipeline skill has a completion report AND a `Next steps:` / `Next:` block with ≥1 ranked command.

**How:** Immediately after the textual `Next steps:` block, call `AskUserQuestion` with a **binary Ja/Nee question** for the single most logical next command. The textual block stays — it is the silent record; the question is the interactive layer on top.

**Template (exact — do not rephrase):**

```yaml
AskUserQuestion:
  questions:
    - question: "Volgende stap: /{cmd} {feature} — naar klembord kopiëren?"
      header: "Volgende stap"
      multiSelect: false
      options:
        - label: "Ja"
          description: "Kopieer `/{cmd} {feature}` naar het klembord"
        - label: "Nee"
          description: "Niets kopiëren — skill afsluiten"
```

**On answer:**

- **"Nee" chosen** → do nothing, end the skill cleanly.
- **"Ja" chosen** → copy the resolved command string (with `{feature}` / `{next-feature}` filled in with the real name) to the OS clipboard via `skills/shared/CLIPBOARD.md` **Pattern 2** (platform-detected: `pbcopy` on macOS, `Set-Clipboard` on Windows, temp-file fallback on Linux). Confirm with: `Copied to clipboard ({N} chars).`

**Rules:**

- `multiSelect: false` — always.
- **Exactly 2 options** — `"Ja"` and `"Nee"`. Never add extra command rows, team-outsource alternatives, or any other option.
- **Use the question verbatim** — do NOT rephrase to "Wil je verder?", "Wil je bouwen?", "Direct uitvoeren?", or any run-now framing. The question is a clipboard offer, not an execution prompt.
- **`{cmd}` = the single most logical next pipeline step** for this skill's result. Alternatives belong only in the printable `Next steps:` text block above — never in this modal.
- **Modal copies only** — never offer to run the command, start a new chat, or take any other action.
- **Resolve names before presenting the question (important):**
  - `{feature}` → the name of the task the skill just worked on (already in scope from the skill's backlog read).
  - `{next-feature}` / `{next-page}` → look up the first matching `TODO` task in `.project/backlog.json` (`data.features[]`):
    - dev loop-back: first `status === "TODO" && type === "FEATURE"` (respecting `dependencies[]` where the skill already does so).
    - design loop-back: first `status === "TODO" && type === "PAGE"`.
    - If no matching task exists: use the current `{feature}` as fallback for the command, or omit the whole offer if that is also unavailable.
  - The **copied string** is the resolved command (e.g. `/dev-ship mijn-feature`), so it is runnable immediately.
    This is especially valuable for worktree-gated steps (e.g. dev-ship's park/resume handoff to a
    NEW chat) where copy-paste is the only way to continue.
- For **conditional next steps** (e.g. dev-ship's verify phase: refactor vs. define-next): pick the single most relevant branch given the current result and fill in the real name — do not list multiple commands in the modal.
- Header and question text: use the runtime language from `CLAUDE.md § User Preferences → Language:` (NL default: keep as-is above).
- This pattern does NOT replace the textual `Next steps:` block — place the question after it.

**Transition marker (for lazy-loading in skill files):**

Add this after the existing `Next steps:` block in the skill's completion output:

```
> **Todo**: Apply the Next-Step Clipboard Offer (binary Ja/Nee) —
> read '.claude/skills/shared/NEXT-STEP-OFFER.md'.
> Recommended command: /{cmd} {feature} → {why}.
```
