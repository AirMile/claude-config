#!/usr/bin/env node
// Append / dedup / consolidate project-context.json#learnings[] — the write
// side of the learnings library (shared/LEARNING-WRITE.md § Writer Append
// Protocol, § Consolidation, § Consolidation Gate). The read/scoring side lives
// in learnings-search.js (deliberately kept read-only there — see its header).
//
// WHY THIS SCRIPT EXISTS: every skill that appends a learning had to hand-run
// a two-stage dedup (exact tuple, then Jaccard >= 0.55 over a ported
// tokenizer) and, on the consolidation path, multi-step set arithmetic
// (age-out observations, group by feature+type, project the post-merge size,
// escalate the group-size threshold, archive originals) purely from prose.
// That is mechanical set/string arithmetic the model reliably gets subtly
// wrong (off-by-one group thresholds, forgetting the within-batch dedup pass,
// hand-computing a tag-frequency tie-break). This script owns all of that;
// the model still supplies the only genuinely semantic piece — the merged
// summary text for each consolidation group (LEARNING-WRITE.md's
// "preserve each distinct point, drop only true repetition" rule is authored
// judgment, not something to derive mechanically).
//
// Usage:
//   echo '{"entries":[...]}' | node scripts/learnings-write.js append <project-root>
//                              node scripts/learnings-write.js gate   <project-root>
//   echo '{"merges":[...]}'  | node scripts/learnings-write.js consolidate <project-root>
//   echo '{"patches":[...]}' | node scripts/learnings-write.js enrich <project-root> [--target active|archive:<file>]
//
// - append:      dedup (exact-tuple, then Jaccard >= 0.55 same-type) each
//                entries[] item against existing learnings[] AND earlier
//                survivors in the same batch; stamps "date"; appends
//                survivors. Exit 0 even when everything dedups (silent-skip
//                contract, matching learnings-search.js's read-side contract).
//                Stdout: { appended: N, skipped: [{summary, reason, matched}] }.
// - gate:        read-only. learnings.length <= 60 -> no output, exit 0. Else
//                prints a JSON consolidation plan (age-out list + per-group
//                merge scaffolds with summary left blank) — the model fills
//                in each scaffold's summary and calls consolidate.
// - consolidate: recomputes the plan itself (no state carried between calls),
//                matches merges[] by (feature, type), replaces each matched
//                group with the completed entry, archives group originals +
//                age-outs to .project/archive/learnings-{YYYY-MM}.json.
//                Unmatched merge, or a qualifying group with no merge, is a
//                warning (that group is left untouched) — never fatal. Empty
//                merges is valid: only the age-out pass runs.
// - enrich:      patches EXISTING entries in place (add/overwrite tags[],
//                paths[]; migrate a legacy {key|text|note}-shaped row to the
//                current {date,feature,type,source,summary} schema) — distinct
//                from append, which only ever adds new deduped entries.
//                Each patches[] item's "match" (key / textEquals / noteEquals
//                / feature+type+summaryEquals) resolves to exactly one target
//                entry; append's dedup does NOT run here (match IS the
//                uniqueness guarantee). --target selects "active" (default,
//                project-context.json#learnings[]) or "archive:<file>"
//                (.project/archive/<file>#archived[]). Idempotent: a patch
//                whose target already has the resulting date/feature/summary
//                (+ tags/paths, if the patch specifies them) is reported
//                "alreadyApplied" and skipped, even after the raw legacy
//                key/text/note fields a first run would have deleted.
//                Stdout: { patched, alreadyApplied, notFound: [...], ambiguous: [...] }.
//
// <project-root> is used as-is when given; when omitted, the main worktree
// root is resolved via `git worktree list --porcelain` (same as
// ship-checkpoint.js / completion-sync.js), so the script is also safe to
// call with cwd inside a linked worktree.
//
// Exit 0 = ok (including "nothing to do"). 2 = usage. 4 = project-context.json
//   not found. 5 = invalid JSON (stdin or existing file).
//   6 = schema-invalid entry/merge/patch — caller falls back to manual authoring.

import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { tokenize, VOCAB } from "./learnings-search.js";

const TYPES = ["pattern", "pitfall", "observation"];
const SOURCES = ["extracted", "inferred", "synced", "consolidated"];
const VOCAB_ORDER = Object.keys(VOCAB);

const rawArgs = process.argv.slice(2);
const cmd = rawArgs[0];
const COMMANDS = ["append", "gate", "consolidate", "enrich"];
if (!cmd || !COMMANDS.includes(cmd)) {
  console.error(
    "Usage: learnings-write.js <append|gate|consolidate|enrich> [project-root] [--target active|archive:<file>]\n" +
      "  append/consolidate/enrich read their JSON payload from stdin.\n" +
      "  project-root defaults to the resolved main worktree root.\n" +
      "  --target (enrich only) selects active learnings[] or a named archive file; default active.",
  );
  process.exit(2);
}

// Positional project-root + an optional --target flag (enrich only) can
// appear in either order; --target is pulled out wherever it is, the first
// remaining non-flag token is argRoot — append/gate/consolidate never pass
// --target, so their existing single-positional-arg behavior is unchanged.
let argRoot;
let target = "active";
for (let i = 1; i < rawArgs.length; i++) {
  if (rawArgs[i] === "--target") {
    target = rawArgs[++i];
    continue;
  }
  if (argRoot === undefined) argRoot = rawArgs[i];
}

function resolveRoot() {
  if (argRoot) return argRoot;
  try {
    const out = execFileSync("git", ["worktree", "list", "--porcelain"], {
      encoding: "utf8",
    });
    const first = out.split("\n")[0] || "";
    if (first.startsWith("worktree "))
      return first.slice("worktree ".length).trim();
  } catch {
    // fall through to usage error below
  }
  console.error(
    "learnings-write: no project-root given and could not resolve the main worktree root",
  );
  process.exit(2);
}

const root = resolveRoot();
const contextPath = join(root, ".project", "project-context.json");

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function fail6(msg) {
  console.error(`learnings-write: ${msg}`);
  process.exit(6);
}

function readJsonFile(path, label, { optional = false } = {}) {
  if (!existsSync(path)) {
    if (optional) return null;
    console.error(`learnings-write: ${label} not found: ${path}`);
    process.exit(4);
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    console.error(`learnings-write: invalid JSON in ${label}: ${err.message}`);
    process.exit(5);
  }
}

function atomicWrite(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(obj, null, 2) + "\n", "utf8");
  renameSync(tmp, path);
}

function parseStdinPayload() {
  let payload;
  try {
    payload = JSON.parse(readStdin());
  } catch (err) {
    console.error(`learnings-write: invalid JSON on stdin: ${err.message}`);
    process.exit(5);
  }
  if (
    payload === null ||
    typeof payload !== "object" ||
    Array.isArray(payload)
  ) {
    console.error("learnings-write: stdin payload must be a JSON object");
    process.exit(5);
  }
  return payload;
}

// ── Dedup Tokenizer parity — LEARNING-WRITE.md § Dedup Tokenizer ──────
// normalize() is the "lowercase + strip punctuation" used by the exact-tuple
// shortcut; tokenize() (imported from learnings-search.js) backs the Jaccard pass.
function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/[.,;:!?()[\]{}'"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function jaccard(aTokens, bTokens) {
  let intersection = 0;
  for (const t of aTokens) if (bTokens.has(t)) intersection++;
  const union = new Set([...aTokens, ...bTokens]).size;
  return union === 0 ? 0 : intersection / union;
}

// ── Consolidation planning — LEARNING-WRITE.md § Consolidation ────────
function shiftMonths(date, delta) {
  const d = new Date(date.getTime());
  d.setMonth(d.getMonth() + delta);
  return d.toISOString().slice(0, 10);
}

function computeGroups(entries, cutoff3, minSize) {
  const eligible = entries.filter((l) => l.date < cutoff3);
  const byKey = new Map();
  for (const l of eligible) {
    const key = `${l.feature}||${l.type}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(l);
  }
  const groups = [];
  for (const [key, groupEntries] of byKey) {
    if (groupEntries.length >= minSize) {
      const [feature, type] = key.split("||");
      groups.push({ feature, type, entries: groupEntries });
    }
  }
  return groups;
}

function buildMergedScaffold(group) {
  const newest = [...group.entries]
    .map((e) => e.date)
    .sort()
    .at(-1);
  const authors = new Set(group.entries.map((e) => e.author ?? null));
  const author = authors.size === 1 ? [...authors][0] : null;

  const tagCounts = new Map();
  for (const e of group.entries) {
    for (const t of e.tags || []) tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
  }
  const vocabIndex = (t) => {
    const i = VOCAB_ORDER.indexOf(t);
    return i === -1 ? Infinity : i;
  };
  const sortedTags = [...tagCounts.entries()].sort(
    (a, b) => b[1] - a[1] || vocabIndex(a[0]) - vocabIndex(b[0]),
  );
  const tags = sortedTags.slice(0, 3).map(([t]) => t);

  const merged = {
    date: newest,
    feature: group.feature,
    type: group.type,
    source: "consolidated",
    author,
    summary: "",
  };
  if (tags.length) merged.tags = tags;

  // paths union, most-frequent first, capped at 5 (originals stay lossless in
  // the archive) — keeps the merged entry reachable by path-anchor scoring.
  const pathCounts = new Map();
  for (const e of group.entries) {
    for (const p of e.paths || [])
      pathCounts.set(p, (pathCounts.get(p) || 0) + 1);
  }
  const paths = [...pathCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([p]) => p);
  if (paths.length) merged.paths = paths;
  return merged;
}

function buildPlan(learnings) {
  const before = learnings.length;
  if (before <= 60)
    return { needsConsolidation: false, before, ageOut: [], groups: [] };

  const today = new Date();
  const cutoff12 = shiftMonths(today, -12);
  const cutoff3 = shiftMonths(today, -3);

  const ageOut = learnings.filter(
    (l) => l.type === "observation" && l.date < cutoff12,
  );
  const ageOutSet = new Set(ageOut);
  const remaining = learnings.filter((l) => !ageOutSet.has(l));

  let groups = computeGroups(remaining, cutoff3, 4);
  const mergedCount = (gs) =>
    gs.reduce((sum, g) => sum + (g.entries.length - 1), 0);
  if (remaining.length - mergedCount(groups) > 40) {
    groups = computeGroups(remaining, cutoff3, 3);
  }
  groups.sort(
    (a, b) =>
      a.feature.localeCompare(b.feature) || a.type.localeCompare(b.type),
  );
  const withMerged = groups.map((g) => ({
    ...g,
    merged: buildMergedScaffold(g),
  }));

  // Being over the threshold is an opportunity check, not a hard cap: loads are
  // relevance-scored (learnings-search.js), so active-list size doesn't drive
  // context cost. If nothing clusters and nothing ages out, there is genuinely
  // nothing to do — report a no-op rather than a plan with empty groups/ageOut.
  if (!ageOut.length && !withMerged.length)
    return { needsConsolidation: false, before, ageOut: [], groups: [] };

  return { needsConsolidation: true, before, ageOut, groups: withMerged };
}

// ── Commands ─────────────────────────────────────────────────────────────

function cmdAppend() {
  const payload = parseStdinPayload();
  if (!Array.isArray(payload.entries))
    fail6('stdin payload must be { "entries": [...] }');

  const ctx = readJsonFile(contextPath, "project-context.json");
  ctx.learnings = Array.isArray(ctx.learnings) ? ctx.learnings : [];

  for (const e of payload.entries) {
    if (!e || typeof e !== "object")
      fail6("each entries[] item must be an object");
    if (typeof e.feature !== "string" || !e.feature)
      fail6("entries[] item needs a non-empty string feature");
    if (!TYPES.includes(e.type))
      fail6(
        `entries[] item has an invalid type "${e.type}" (expected ${TYPES.join(", ")})`,
      );
    if (!SOURCES.includes(e.source))
      fail6(
        `entries[] item has an invalid source "${e.source}" (expected ${SOURCES.join(", ")})`,
      );
    if (typeof e.summary !== "string" || !e.summary.trim())
      fail6("entries[] item needs a non-empty string summary");
    if (e.tags !== undefined) {
      if (!Array.isArray(e.tags))
        fail6("entries[] item's tags must be an array of strings");
      for (const t of e.tags) {
        if (typeof t !== "string") fail6("each tag must be a string");
        if (!Object.prototype.hasOwnProperty.call(VOCAB, t)) {
          console.error(
            `learnings-write: warning: tag "${t}" is not in the controlled vocabulary (allowed as the one free tag)`,
          );
        }
      }
    }
    if (e.paths !== undefined) {
      if (!Array.isArray(e.paths) || e.paths.some((p) => typeof p !== "string"))
        fail6("entries[] item's paths must be an array of strings");
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const appended = [];
  const skipped = [];

  for (const raw of payload.entries) {
    const entry = {
      date: today,
      feature: raw.feature,
      type: raw.type,
      source: raw.source,
      summary: raw.summary,
    };
    if (raw.author !== undefined) entry.author = raw.author;
    if (Array.isArray(raw.tags) && raw.tags.length)
      entry.tags = raw.tags.slice(0, 3);
    if (Array.isArray(raw.paths) && raw.paths.length)
      entry.paths = raw.paths.slice(0, 5);

    const candidateNorm = normalize(entry.summary);
    const candidateAuthor = entry.author ?? null;
    const candidateTokens = tokenize(entry.summary);
    const pool = [...ctx.learnings, ...appended];

    let dupe = null;
    for (const existing of pool) {
      if (
        existing.type === entry.type &&
        normalize(existing.summary) === candidateNorm &&
        (existing.author ?? null) === candidateAuthor
      ) {
        dupe = { reason: "exact", matched: existing.summary };
        break;
      }
    }
    if (!dupe) {
      for (const existing of pool) {
        if (existing.type !== entry.type) continue;
        if (jaccard(candidateTokens, tokenize(existing.summary)) >= 0.55) {
          dupe = { reason: "jaccard", matched: existing.summary };
          break;
        }
      }
    }

    if (dupe) {
      skipped.push({
        summary: entry.summary,
        reason: dupe.reason,
        matched: dupe.matched,
      });
      continue;
    }
    ctx.learnings.push(entry);
    appended.push(entry);
  }

  if (appended.length) atomicWrite(contextPath, ctx);

  console.log(JSON.stringify({ appended: appended.length, skipped }, null, 2));
}

function cmdGate() {
  const ctx = readJsonFile(contextPath, "project-context.json");
  const learnings = Array.isArray(ctx.learnings) ? ctx.learnings : [];
  const plan = buildPlan(learnings);
  if (!plan.needsConsolidation) process.exit(0);

  console.log(
    JSON.stringify(
      {
        needsConsolidation: true,
        before: plan.before,
        ageOut: plan.ageOut.map((e) => e.summary),
        groups: plan.groups.map((g) => ({
          feature: g.feature,
          type: g.type,
          entries: g.entries,
          merged: g.merged,
        })),
      },
      null,
      2,
    ),
  );
}

function cmdConsolidate() {
  const payload = parseStdinPayload();
  if (!Array.isArray(payload.merges))
    fail6('stdin payload must be { "merges": [...] }');
  for (const m of payload.merges) {
    if (!m || typeof m !== "object")
      fail6("each merges[] item must be an object");
    if (typeof m.feature !== "string" || !m.feature)
      fail6("merges[] item needs a non-empty string feature");
    if (!TYPES.includes(m.type))
      fail6(
        `merges[] item has an invalid type "${m.type}" (expected ${TYPES.join(", ")})`,
      );
    if (typeof m.summary !== "string" || !m.summary.trim())
      fail6("merges[] item needs a non-empty string summary");
  }

  const ctx = readJsonFile(contextPath, "project-context.json");
  const learnings = Array.isArray(ctx.learnings) ? ctx.learnings : [];
  const before = learnings.length;
  const plan = buildPlan(learnings);

  if (!plan.needsConsolidation) {
    console.log(
      `Learnings consolidated: 0 merged, 0 archived (${before} → ${before})`,
    );
    return;
  }

  const groupMap = new Map(
    plan.groups.map((g) => [`${g.feature}||${g.type}`, g]),
  );
  const consumed = new Set();
  const matched = [];
  for (const m of payload.merges) {
    const key = `${m.feature}||${m.type}`;
    const group = groupMap.get(key);
    if (!group) {
      console.error(
        `learnings-write: warning: no qualifying group for merge (feature=${m.feature}, type=${m.type}) — ignored`,
      );
      continue;
    }
    if (consumed.has(key)) {
      console.error(
        `learnings-write: warning: duplicate merge for (feature=${m.feature}, type=${m.type}) — ignoring the extra`,
      );
      continue;
    }
    consumed.add(key);
    matched.push({ group, summary: m.summary });
  }
  for (const g of plan.groups) {
    const key = `${g.feature}||${g.type}`;
    if (!consumed.has(key)) {
      console.error(
        `learnings-write: warning: qualifying group (feature=${g.feature}, type=${g.type}) has no merge — left untouched`,
      );
    }
  }

  const ageOutSet = new Set(plan.ageOut);
  const mergedEntriesSet = new Set(matched.flatMap((m) => m.group.entries));
  const newLearnings = learnings.filter(
    (l) => !ageOutSet.has(l) && !mergedEntriesSet.has(l),
  );
  for (const m of matched)
    newLearnings.push({ ...m.group.merged, summary: m.summary });

  const archived = [...plan.ageOut, ...matched.flatMap((m) => m.group.entries)];

  if (archived.length || matched.length) {
    ctx.learnings = newLearnings;
    atomicWrite(contextPath, ctx);

    const monthKey = new Date().toISOString().slice(0, 7);
    const archivePath = join(
      root,
      ".project",
      "archive",
      `learnings-${monthKey}.json`,
    );
    const existingArchive = readJsonFile(archivePath, "archive file", {
      optional: true,
    });
    const archiveObj =
      existingArchive && Array.isArray(existingArchive.archived)
        ? existingArchive
        : { schemaVersion: 2, archived: [] };
    archiveObj.archived.push(...archived);
    atomicWrite(archivePath, archiveObj);
  }

  console.log(
    `Learnings consolidated: ${matched.length} merged, ${archived.length} archived (${before} → ${newLearnings.length})`,
  );
}

// ── Enrich — patch existing entries in place ───────────────────────────
// (§ header comment above has the full contract.) Not a dedup/insert path:
// every patch targets one already-resolved existing entry via "match".

function resolveTargetPath() {
  if (target === "active") return contextPath;
  const m = /^archive:(.+)$/.exec(target || "");
  if (!m)
    fail6(
      `invalid --target "${target}" (expected "active" or "archive:<file>")`,
    );
  return join(root, ".project", "archive", m[1]);
}

// Raw-field match tiers, tried in order — never positional/index matching
// (learnings[] has no stable id, and consolidate already reorders/removes
// rows, so an index computed earlier would silently drift).
function matchCandidates(m, arr) {
  if (m.key !== undefined) return arr.filter((e) => e.key === m.key);
  if (m.textEquals !== undefined)
    return arr.filter((e) => e.text === m.textEquals);
  if (m.noteEquals !== undefined)
    return arr.filter((e) => e.note === m.noteEquals);
  if (
    m.feature !== undefined &&
    m.type !== undefined &&
    m.summaryEquals !== undefined
  ) {
    const wantNorm = normalize(m.summaryEquals);
    return arr.filter(
      (e) =>
        e.feature === m.feature &&
        e.type === m.type &&
        normalize(e.summary || "") === wantNorm,
    );
  }
  fail6(
    'each patches[] item needs a "match" with key, textEquals, noteEquals, or feature+type+summaryEquals',
  );
}

// Does an entry already carry exactly the shape `patch` would produce?
// Compares the fields enrich actually touches, tags/paths order-insensitive.
function sameEnrichedShape(entry, next) {
  const norm = (x) => ({
    date: x.date,
    feature: x.feature,
    type: x.type,
    source: x.source,
    summary: x.summary,
    tags: x.tags ? [...x.tags].sort() : undefined,
    paths: x.paths ? [...x.paths].sort() : undefined,
  });
  return JSON.stringify(norm(entry)) === JSON.stringify(norm(next));
}

// Two phases: (1) raw-field tiers via `match` — this is the normal path,
// including a REPEAT run of a tags/paths-only patch (its `match` still
// resolves via feature+type+summaryEquals, since those never change).
// (2) only when phase 1 finds NOTHING, and the patch carries its own
// feature+summary (true for a legacy migration, never for a tags/paths-only
// patch), fall back to identity matching — this is what catches a REPEAT run
// of a legacy migration, whose first run already deleted the raw
// key/text/note field phase 1 would otherwise match on. `type` narrows the
// fallback when the patch specifies it, but is not required — a legacy
// entry's `type` is often already correct pre-migration and a patch may
// reasonably omit it. This fallback never fires for ordinary patches, so it
// can't accidentally match an unrelated entry via tags/paths alone.
function resolvePatch(patch, arr) {
  const candidates = matchCandidates(patch.match, arr);

  if (candidates.length === 0) {
    if (patch.feature !== undefined && patch.summary !== undefined) {
      const wantNorm = normalize(patch.summary);
      const revived = arr.filter(
        (e) =>
          e.feature === patch.feature &&
          (patch.type === undefined || e.type === patch.type) &&
          normalize(e.summary || "") === wantNorm,
      );
      if (
        revived.length === 1 &&
        sameEnrichedShape(revived[0], applyPatch(revived[0], patch))
      )
        return { status: "alreadyApplied" };
    }
    return { status: "notFound" };
  }
  if (candidates.length > 1)
    return { status: "ambiguous", count: candidates.length };

  const entry = candidates[0];
  const next = applyPatch(entry, patch);
  if (sameEnrichedShape(entry, next)) return { status: "alreadyApplied" };
  return { status: "matched", entry, next };
}

function applyPatch(entry, patch) {
  const next = { ...entry };
  delete next.key;
  delete next.text;
  delete next.note;
  if (patch.date !== undefined) next.date = patch.date;
  if (patch.feature !== undefined) next.feature = patch.feature;
  if (patch.type !== undefined) next.type = patch.type;
  if (patch.source !== undefined) next.source = patch.source;
  if (patch.summary !== undefined) next.summary = patch.summary;
  if (patch.tags !== undefined) {
    if (patch.tags.length) next.tags = patch.tags.slice(0, 3);
    else delete next.tags;
  }
  if (patch.paths !== undefined) {
    if (patch.paths.length) next.paths = patch.paths.slice(0, 5);
    else delete next.paths;
  }
  return next;
}

function validateEnrichedEntry(entry, index) {
  if (typeof entry.date !== "string" || !entry.date)
    fail6(`patches[${index}] result needs a non-empty string date`);
  if (typeof entry.feature !== "string" || !entry.feature)
    fail6(`patches[${index}] result needs a non-empty string feature`);
  if (!TYPES.includes(entry.type))
    fail6(
      `patches[${index}] result has an invalid type "${entry.type}" (expected ${TYPES.join(", ")})`,
    );
  if (!SOURCES.includes(entry.source))
    fail6(
      `patches[${index}] result has an invalid source "${entry.source}" (expected ${SOURCES.join(", ")})`,
    );
  if (typeof entry.summary !== "string" || !entry.summary.trim())
    fail6(`patches[${index}] result needs a non-empty string summary`);
  if (entry.tags !== undefined) {
    for (const t of entry.tags) {
      if (!Object.prototype.hasOwnProperty.call(VOCAB, t)) {
        console.error(
          `learnings-write: warning: tag "${t}" is not in the controlled vocabulary (allowed as the one free tag)`,
        );
      }
    }
  }
  if (entry.paths !== undefined && !Array.isArray(entry.paths))
    fail6(`patches[${index}] result's paths must be an array of strings`);
}

function cmdEnrich() {
  const payload = parseStdinPayload();
  if (!Array.isArray(payload.patches))
    fail6('stdin payload must be { "patches": [...] }');

  const targetPath = resolveTargetPath();
  const label = target === "active" ? "project-context.json" : "archive file";
  const data = readJsonFile(targetPath, label);
  const field = target === "active" ? "learnings" : "archived";
  const arr = data[field];
  if (!Array.isArray(arr))
    fail6(`${label} at ${targetPath} has no ${field}[] array to patch`);

  // Validate every patch's shape up front — fail before resolving/writing
  // anything, so a batch never partially applies.
  payload.patches.forEach((patch, i) => {
    if (!patch || typeof patch !== "object")
      fail6(`patches[${i}] must be an object`);
    if (!patch.match || typeof patch.match !== "object")
      fail6(`patches[${i}] needs a "match" object`);
    if (patch.tags !== undefined && !Array.isArray(patch.tags))
      fail6(`patches[${i}]'s tags must be an array of strings`);
    if (patch.paths !== undefined && !Array.isArray(patch.paths))
      fail6(`patches[${i}]'s paths must be an array of strings`);
  });

  const alreadyApplied = [];
  const notFound = [];
  const ambiguous = [];
  const replacements = new Map(); // original entry object -> patched entry object
  let patchedCount = 0;

  for (const patch of payload.patches) {
    const result = resolvePatch(patch, arr);
    if (result.status === "alreadyApplied") {
      alreadyApplied.push(patch.match);
      continue;
    }
    if (result.status === "notFound") {
      notFound.push({ match: patch.match });
      continue;
    }
    if (result.status === "ambiguous") {
      ambiguous.push({ match: patch.match, count: result.count });
      continue;
    }
    validateEnrichedEntry(result.next, patchedCount);
    replacements.set(result.entry, result.next);
    patchedCount++;
  }

  if (replacements.size) {
    data[field] = arr.map((e) => replacements.get(e) || e);
    atomicWrite(targetPath, data);
  }

  console.log(
    JSON.stringify(
      {
        patched: patchedCount,
        alreadyApplied: alreadyApplied.length,
        notFound,
        ambiguous,
      },
      null,
      2,
    ),
  );
}

if (cmd === "append") cmdAppend();
else if (cmd === "gate") cmdGate();
else if (cmd === "consolidate") cmdConsolidate();
else if (cmd === "enrich") cmdEnrich();
