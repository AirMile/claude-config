# Fix round (dev-inspect)

Loaded when screenshot-verify failed **twice** for the same ref — the first inline fix round did
not land. Stop editing on instinct; this flow is evidence-first, then one researched attempt, then
an honest report. Never loop beyond it.

## 1. Diagnose against the usual suspects

Check the failure evidence (screenshot, computed style, console) against the causes that most
often defeat a pinpoint edit:

- **Wrong element edited** — the ref resolved to a lookalike: re-check with the deterministic
  DOM selector (`[data-inspector-relative-path][data-inspector-line]`) and compare its `outerHTML`
  against the edited source.
- **Class emitted but not applied** — Tailwind v4: a custom token utility only exists when the
  `@theme` variable uses a recognized namespace (`--color-*`, `--text-*`, `--spacing-*`); a wrong
  namespace is silently ignored. Also: a competing utility later in the class list, or a variant
  stacking mistake, wins.
- **Specificity/override** — a `dark:` mode rule, a parent's descendant selector, or an inline
  style overrides the change. `getComputedStyle` tells you which value won; DevTools-style
  reasoning (which rule, which source) beats adding `!important`.
- **Flex/grid minimum size** — a size/truncation edit that "does nothing" is usually flex's
  `min-width: auto` on the item — fix with `min-w-0`, not width hacks.
- **Motion inheritance** — an overriding `transition` prop replaces the inherited default
  entirely (merge via the `default` key instead); a local `animate` severs parent variant
  propagation (stagger/delayChildren stop); `AnimatePresence` exits silently break on index keys,
  fragment wrappers, or a conditionally-mounted `AnimatePresence` itself.
- **Stale build** — HMR missed the change: hard-reload once before concluding anything.

**Not a technical miss** — the screenshot/computed style show the change *did* land as specified,
but the rejection was a vague aesthetic call ("not nice", no specifics) rather than a pointed
correction: skip § 2's technical researcher and go straight to § 2b.

## 2. Research round (one agent)

When § 1 does not produce a confident diagnosis (and it is a technical miss), spawn **one**
researcher (Agent tool, `subagent_type: general-purpose`, `model: opus`) instead of a third blind
attempt:

- Prompt: the change request, the ref, the edited `file:line` diff, the failure evidence
  (what the screenshot/computed style showed vs expected), and the theme digest excerpt that
  applies. Pass paths, not file contents.
- Ask for: root cause + a concrete implementation brief (which file/lines, which classes/props,
  why this beats the failed attempts).

Apply the brief as the **final** attempt, re-verify per PHASE 3.

## 2b. Second-opinion round (subjective rejection)

When the same ref/change is rejected twice with no reproducible technical cause, a third inline
guess is anchoring, not diagnosis. Spawn one fresh (non-fork) agent per `~/.claude/CLAUDE.md
§ Model Tiering` ("Opus for an anchoring gap"): give it the screenshot path, the current code, and
the rejected attempts with the user's verbatim feedback — no prior framing, so it forms an
independent view. Present its recommendation via AskUserQuestion before applying — this replaces
one fix-round attempt, it does not add to it.

## 3. Close honestly

Still failing → report exactly that: what was tried (attempt 1, 2, researched attempt), the
evidence per attempt, and the researcher's diagnosis. Offer the escalation options from
`references/escalate.md` (tier-3 signals: a prior fix attempt failed — TWEAK-DISCIPLINE size-gate
criterion 6 applies). Leave the working tree in the best known state and say which state that is.
