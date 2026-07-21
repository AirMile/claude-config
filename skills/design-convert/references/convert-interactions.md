# Interaction Capture (`$INTERACTION_SPEC`)

Loaded from route-convert **PHASE 0.2** when interaction cues are present (see trigger recap below). Produces `$INTERACTION_SPEC` — a structured interaction table that is confirmed in PHASE 1, implemented in PHASE 2.2 (`convert-generate-template.md § Motion`), and positively verified in PHASE 3.2d. Without this file, motion handling falls back to the loose `$MOTION_INTENT` string + pack conventions (unchanged behavior for static converts).

**Row shape:**

| Field     | Values                                                                                                                                        |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `element` | section/component + selector hint (e.g. "Sector card (`.sector-grid > a`)"); sibling effects get their own row targeting the affected element |
| `trigger` | `hover` \| `press` \| `scroll-into-view` \| `focus` \| `leave`                                                                                |
| `effect`  | concrete deltas — transform (scale/translate), opacity, color/overlay, position — exact values when known                                     |
| `timing`  | duration · easing (keep authored `cubic-bezier(...)` verbatim) · delay/stagger                                                                |
| `source`  | `spec-text` \| `observed` \| `estimated`                                                                                                      |

**Trigger recap (when route-convert 0.2 loads this file):** `$INPUT_SOURCE = "figma-make"` · the user provided/pasted written interaction documentation · `$ANALYSIS` Motion intent found hover-variant frames or labeled animations · the user explicitly asks for interactions/animations to be converted.

---

## Step 1: Spec-text parsing (`source: spec-text`)

If written interaction documentation exists — a Figma Make chat spec, prototype annotations, a design-handoff doc, or text the user pastes:

1. Parse each statement into one or more rows. Keep exact values verbatim: scale factors, px offsets, durations, easing arrays (`[0.25, 0.46, 0.45, 0.94]` → `cubic-bezier(0.25, 0.46, 0.45, 0.94)`).
2. Group/sibling effects become separate rows: "hovered card scales to 1.04, the other 5 cards scale to 0.97" → two rows (hovered card · sibling cards), both `trigger: hover` on the same container.
3. Exit conditions are rows too: "on leave, everything back to scale(1)" → `trigger: leave`.
4. Ambiguous statements: keep the literal text in `effect` and mark the row `(?)` — it gets resolved in the Step 4 confirm.

For `$INPUT_SOURCE = "figma-make"` without spec text: the 0.1 detection row already asked for it once — do not re-ask here; proceed with Step 2 (the Make preview is live DOM, observation covers it).

## Step 2: Live observation (`source: observed`) — `url` / `figma-make` sources only

The source is real DOM — capture what interactions actually do. Follow `shared/PLAYWRIGHT.md § Use Cases: Interaction State Capture` (hover-delta sequence, animation inventory, scroll-triggered check). Claude-in-Chrome is **required** for `figma-make` (the preview needs the user's logged-in session — no substitute). For public URLs (no session dependency), `playwright-cli` is the default — scriptable, see `shared/BROWSER-VEHICLES.md`.

1. **Candidate discovery:** run the ready-made eval from `shared/PLAYWRIGHT.md § Candidate Discovery` (route-convert 0.2's interaction probe already ran it — reuse those results instead of re-running). Its candidate rows carry the selector hints; `count > 1` marks a repeated pattern — probe one representative and note "applies to all N instances" in the row. Cap the hover work at ~10 candidates.
2. **Per candidate:** hover-delta sequence → `effect` from the computed diff (transform as matrix — record the human-readable equivalent, e.g. `matrix(1.04, …)` → `scale(1.04)`), `timing` from the baseline `transition` value.
3. **Entrances:** animation inventory on fresh load + after scrolling each major section into view → `scroll-into-view` rows.

Rows produced here confirm/supplement Step 1 rows. **Precedence when sources disagree: `spec-text` > `observed` > `estimated`** — documented intent beats a possibly mid-transition observation; note the divergence in the table rather than silently dropping either.

## Step 3: Vision estimation (`source: estimated`) — static sources

No DOM available (file/chat-image, or design-tool canvas). Only when the source explicitly shows interaction evidence:

- Hover-variant frames: diff the variant against the default frame → effect description (direction and rough magnitude, no invented exact values).
- Motion arrows/paths/labels ("animated", "fades in"): describe the implied motion.

`estimated` rows never carry invented exact values — codegen maps them to pack conventions (see route-convert 0.6 motion policy), unlike `spec-text`/`observed` rows which are ground truth.

## Step 4: INTERACTIONS table + confirm

```
INTERACTIONS
════════════════════════════════════════════════════════════
#  Element                    Trigger           Effect                                        Timing                                   Source
1  Sector card                hover             scale(1.04) · img scale(1.08) · overlay ↑    300ms cubic-bezier(0.25,0.46,0.45,0.94)  spec-text
   expected: transform matrix(1.04, 0, 0, 1.04, 0, 0) · transition-duration 0.3s · timing-function cubic-bezier(0.25, 0.46, 0.45, 0.94)
2  Sibling sector cards       hover (same grid) scale(0.97)                                  same                                     spec-text
   expected: transform matrix(0.97, 0, 0, 0.97, 0, 0)
3  Cert badge                 hover             fade in                                      same                                     spec-text
   expected: opacity 1 (from 0)
4  Section grid               scroll-into-view  entrance fade+rise, stagger 60ms             500ms ease-out                           observed
   expected: getAnimations() non-empty after scroll-into-view · duration 500
…
────────────────────────────────────────────────────────────
Rows: [N] ([X] spec-text · [Y] observed · [Z] estimated)
════════════════════════════════════════════════════════════
```

**`expected:` line — fill it here, during capture.** Translate each authored value to the string the browser will report as computed style, so PHASE 3.2d becomes a plain string compare with no conversion reasoning at verification time: `scale(x)` → `matrix(x, 0, 0, x, 0, 0)` · `translateY(-2px)` → `matrix(1, 0, 0, 1, 0, -2)` · `300ms` → `0.3s` · ease array `[a, b, c, d]` → `cubic-bezier(a, b, c, d)` (spaces after commas — that is how `getComputedStyle` prints it). `estimated` rows get no `expected:` line (presence-check only). Combined transforms multiply into one matrix — when in doubt, note the individual parts and let 3.2d read the observed matrix as the reference on round 1.

Store as `$INTERACTION_SPEC` (including the `expected` values).

**Confirmation:** the table rides along with the mode file's PHASE 1 confirm (fidelity table / token mapping — the "Adjust" option covers interaction rows too) and is presented in that mode's `ExitPlanMode` plan output. Only when no mode PHASE 1 runs (patch fast-path) confirm standalone:

```yaml
header: "Interactions"
question: "Is this interaction spec correct?"
options:
  - label: "Yes, continue (Recommended)", description: "Implement these interactions in codegen and verify them in PHASE 3"
  - label: "Adjust", description: "I want to correct or drop specific rows"
multiSelect: false
```

**Downstream consumers:** route-convert 0.6 (motion policy — documented spec vs pack), `convert-generate-template.md § Motion` (implementation patterns), `convert-verification-loop.md § 3.2d` (positive interaction check), `convert-completion.md` (choreography-slot persistence + devinfo count).
