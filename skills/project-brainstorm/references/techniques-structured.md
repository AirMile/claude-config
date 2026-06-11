# Brainstorm Techniques — Structured Frameworks

Detail file. Load only when a technique from this category is selected in PHASE 3.

### 5. SCAMPER Method

**When to use:** For systematic variation generation across multiple dimensions.

**Approach:**
Apply each letter systematically:

- **S**ubstitute: What can we replace?
- **C**ombine: What can we merge?
- **A**dapt: What can we adjust?
- **M**odify: What can we change (scale, shape, attribute)?
- **P**ut to other use: What else could this do?
- **E**liminate: What can we remove?
- **R**everse: What can we rearrange or flip?

**Output structure:**

- Variations per SCAMPER dimension
- Most promising variations highlighted
- Combinations of variations explored
- Unexpected opportunities identified

### 6. Six Thinking Hats

**When to use:** To explore the idea from multiple distinct perspectives systematically.

**Approach:**
Apply each "hat" perspective:

- **White Hat**: Facts and information (what do we know?)
- **Red Hat**: Emotions and intuition (what does gut say?)
- **Black Hat**: Caution and risks (what could go wrong?)
- **Yellow Hat**: Optimism and benefits (what's great about this?)
- **Green Hat**: Creativity and alternatives (what else is possible?)
- **Blue Hat**: Process and overview (how do we proceed?)

**Output structure:**

- Insights from each perspective
- Contradictions between perspectives
- Balanced view incorporating all hats
- Action items from Blue Hat

### 7. Mind Mapping

**When to use:** For visual exploration of connections and branches from the core idea.

**Approach:**

- Start with core idea in center
- Branch out major themes/aspects (3-5 branches)
- Sub-branch details, features, variations (2-4 per branch)
- Find connections between branches
- Identify gaps or unexplored areas
- Look for patterns and clusters

**Output: ASCII Tree Visualization**

Render the mind map as an ASCII tree using box-drawing characters. The tree makes relationships, hierarchy, and gaps immediately visible — far more effective than flat bullet lists.

**Rendering rules:**

- Use `───` for horizontal connections, `│` for vertical lines
- Use `├─` for middle branches, `└─` for last branch in a group
- Use `┌─` for the first branch when connecting upward to center
- Core idea centered, branches extend right
- Maximum 3 levels deep (core → branch → sub-branch → leaf)
- Mark unexplored areas with `(?)` suffix
- Mark cross-connections with `←→` annotations below the tree
- Keep branch labels short (2-4 words max)

**Template:**

```
                  ┌─ [Sub-branch] ─── [Leaf]
                  │                   └─ [Leaf]
  [Core Idea] ───┼─ [Branch 2] ───── [Sub-branch]
                  │                   └─ [Sub-branch] (?)
                  └─ [Branch 3] ───── [Sub-branch]
                                      └─ [Sub-branch]

  Connecties: [Branch 1:Sub-X] ←→ [Branch 3:Sub-Y]
  Gaps: [Branch 2] has little depth so far
```

**Example — game concept:**

```
                      ┌─ Co-op campaign
                      │  └─ Drop-in/drop-out
  Multiplayer ────────┤
                      └─ PvP arena
                         └─ Ranked seasons (?)

                      ┌─ Crafting ────── Resource gathering
                      │                  └─ Recipe discovery
  Core Mechanics ─────┤
                      ├─ Exploration ─── Procedural maps
                      │                  └─ Hidden lore
                      └─ Combat ──────── Combo system (?)

                      ┌─ Fantasy base
  Setting ────────────┤
                      └─ Sci-fi ruins ── Ancient tech
                                         └─ Magitech fusion

  Connecties: Crafting ←→ Ancient tech (magitech recipes)
              Exploration ←→ Lore (environmental storytelling)
  Gaps: PvP balance, Combat depth
```

**After presenting the tree:**

1. Walk through each branch briefly (1-2 sentences per branch)
2. Highlight the most interesting cross-connections
3. Ask the user which branches to explore deeper or expand
4. Use their response to grow the tree in the next iteration

**Iteration:** When the user wants to go deeper on a branch, redraw the tree with that branch expanded (more sub-branches/leaves) while keeping the rest compact.
