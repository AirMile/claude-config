---
name: core-explain
description: Use with /core-explain for a brief, opinionated explanation of a topic.
argument-hint: "[topic]"
user-invocable: true
metadata:
  author: claude-config
  version: 1.1.0
  category: core
---

# Explain

> **A copy of this file is uploaded to claude.ai** (Customize → Skills) so the skill also works in Cowork and chat. That copy does not update itself. After editing this file: bump `metadata.version`, run `bash scripts/export-skill.sh core-explain`, and re-upload `dist/core-explain.zip`. The version is visible in Customize → Skills, so a stale upload is checkable by eye.

Explain one topic briefly, in the user's language and at their explanation level, ending on a stated opinion.

**Trigger**: `/core-explain [topic]` — user-invoked only.

## Why this skill exists

A plain "explain X briefly" prompt already inherits tone from `CLAUDE.md` (direct, opinionated, target language). This skill earns its slash command through exactly three additions:

1. A hard length ceiling that a bare prompt does not enforce.
2. A bounded, explicit relaxation of `~/.claude/CLAUDE.md § Factual Accuracy` — without it every short explanation costs a lookup round.
3. A bounded relaxation of the "unclear instruction → ask" default — without it every fuzzy topic costs a second turn.

Remove any one of the three and the skill is redundant. Do not grow it past those three: no phases, no agents, no state, no reference files.

**Host caveat**: additions 2 and 3 relax rules that exist in Claude Code (`~/.claude/CLAUDE.md`) but not on hosts without a global instruction file — there they are inert, and what carries the skill is the length ceiling plus the form rules in § 5. Both relaxations are therefore written conditionally below. Do not "simplify" them into unconditional statements.

**No PHASE structure and no ASCII report by design** — this is a conversational output skill, the same exemption the thinking skills carry. Precedent: `skills/content-rewrite/SKILL.md`. Do not "fix" this in an audit.

## 1. Parse Input

- `/core-explain [topic]` → explain that topic.
- Empty argument → ask what to explain. This is the only blocking question in the skill.

## 2. Load Runtime Settings

Two settings, each resolved by the same ladder — first source that answers wins. **Never hardcode a level or a language in this file**; that is what makes the skill portable across hosts, and `skills/shared/EXPLANATION.md` forbids it outright for the Claude Code case.

1. A reachable `CLAUDE.md` — project first, then `~/.claude/CLAUDE.md`. In a sandbox the real home may be mounted elsewhere; `$HOME/mnt/.claude/CLAUDE.md` is worth one best-effort read. Never block on it.
2. The user's personal instructions for this host.
3. The default below.

| Setting               | Read                                                       | Default if absent                   |
| --------------------- | ---------------------------------------------------------- | ----------------------------------- |
| **Explanation Level** | `Explanation Level:` (Beginner/Novice/Intermediate/Expert) | `Intermediate`                      |
| **Language**          | `Language:`                                                | the language the user is writing in |

The level sets jargon handling, analogies, and detail — in Claude Code the full table lives in `skills/shared/EXPLANATION.md`; without it, the short form is: Beginner defines every term and always uses analogies, Novice defines framework-specific terms and uses analogies where they help, Intermediate assumes standard programming knowledge, Expert stays compact and assumes full familiarity.

Every template string in this file is authored in English and translated at output time. Code identifiers, file paths, and CLI flags are never translated.

## 3. Ambiguity Check

If the topic has more than one plausible reading, pick the most likely one and name it in a single opening clause — then continue in the same response.

Ask a clarifying question **only** when two readings would produce materially different explanations (different domain, different mechanism), not merely different emphasis.

Rationale: where a global "unclear instruction → ask, don't guess" default exists, this deliberately overrides it for this skill only. A misread explanation costs one re-ask; asking by default costs a second turn on every invocation, which defeats "brief".

## 4. Fact Trip-Wire

> Look up the source **before** answering only when the explanation would state a specific number, version, price, date, or the existence/status of a named product feature. Otherwise answer from knowledge and mark uncertainty explicitly in the sentence itself.

**Precedence**: where a global factual-accuracy rule exists — in Claude Code, `~/.claude/CLAUDE.md § Factual Accuracy` — the sentence above takes precedence over it within this skill. Without stating that, the global rule wins and the relaxation has no effect. Where no such rule exists, the sentence stands on its own.

When the trip-wire fires, route by subject — this part is not relaxed:

| Subject                                  | Source                                                            |
| ---------------------------------------- | ----------------------------------------------------------------- |
| Claude/Anthropic models, pricing, API    | the `claude-api` skill (Claude Code); otherwise the official page |
| Library, framework, SDK, CLI             | context7 MCP (Claude Code); otherwise the official docs           |
| Product specs, prices, feature existence | the official page — name page and section                         |

A looked-up fact carries its source inline, as precisely as possible. The source reference does not count against the word budget.

**No lookup available**: if the host offers no way to check (no `claude-api`, no context7, no web access), say so in the sentence that would have carried the fact and mark the claim unverified — in the shape of "I cannot check this here; from memory it is roughly X", rendered in the output language. Never fall back to stating it confidently from memory: that is the exact failure the trip-wire exists to prevent, and an unavailable tool is not permission to guess.

## 5. Form Rules

Free form — no headings, no template. Four rules hold the shape:

1. **No preamble.** The first sentence IS the core claim or definition. Never open with "X is an interesting topic", "Let me explain", or a restatement of the question.
2. **Fixed order**: what it is → why it matters → one pitfall or nuance. Nothing else. No history section, no closing recap.
3. **Mandatory final line**: `Opinion: …` (translated per the language setting) — one pronounced position, one to two sentences. Not a summary, not a hedge. If there is genuinely nothing to have an opinion about, say what you would use instead of the thing.
4. **No bullets or headings** unless there are 3 or more genuinely parallel items. Prose by default.

**Budget**: ~250 words, hard ceiling 300, opinion line included. Rule 2 does the actual shaping; the budget alone is not steerable.

**Never**: emoji, filler openers, "in summary", or a trailing offer of more detail. The user asks for depth when they want it.

## 6. Follow-up

A follow-up in the same conversation ("deeper", "and how does X relate") is a normal answer, not a fresh skill run — the budget and form rules no longer apply to it.
