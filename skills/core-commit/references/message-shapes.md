# Non-Conventional Message Shapes

Loaded only when § 1.5 detected `ticket-prefix`, `bracket`, or `freeform`. On `conventional` — and
on a detection that produced nothing — SKILL.md § 4's inline format already covers it; this file
never loads.

Only the **header's shape** changes. Everything else in § 4 still applies unchanged: the 72-char
header limit, the English rule, the no-emoji rule, and the body/footer conventions. The type and
scope rules apply only to `conventional` (and to the `conventional` fallback below) — on `bracket`
and `freeform` there is no type to validate.

## ticket-prefix

```
{ticketPrefix}-{number}: <description>
```

Take the number from the externalRef; failing that, from the branch name's `[A-Z]+-\d+` match.
Neither available → fall back to `conventional` and say so in the confirm step, so the user sees
the header is not the shape their repo uses.

## bracket

```
[{TAG}] <description>
```

Derive the tag from the changed area the same way a Conventional scope is derived, but take the
vocabulary from the tags already present in `git log` — do not invent one. A bracket repo tags per
area, so reusing one dominant tag for every commit is wrong; read enough of the log to see which
tags exist before picking.

## freeform

An imperative one-line subject, no type/scope grammar. The header limit and the English rule still
hold.

## externalRef affix

A detected `externalRef` (§ 1.5 step 3) adds its own affix on top of whichever shape was chosen
here — `(#{id})` as a suffix for GitHub, `{id}: ` as a prefix for Jira/Linear. On `ticket-prefix`
the id is usually already in the header; do not add it twice.
