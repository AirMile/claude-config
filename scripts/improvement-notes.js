#!/usr/bin/env node
// Triage for dev-ship's auto-verify improvement notes — the countable half of
// `dev-ship/references/orchestration.md § 3`'s offload flush.
//
// WHY THIS SCRIPT EXISTS: an adversarial verify agent produces findings in
// proportion to how hard it looks, not how bad the code is, so the stream has
// no natural bottom. Left unrouted it fills the board with near-identical
// low-value cards and drowns the user's own captured ideas. The judgment calls
// (is this note real, does an existing card already cover it, does it exceed
// the tweak size gate) stay with the model. Everything countable lives here:
// sorting, capping, per-class recurrence with decay, the card floor, the
// promote/escalate decision, and the withheld audit trail. Those are set and
// date arithmetic a model gets subtly wrong from prose, and getting them wrong
// silently suppresses real findings.
//
// SAFETY CONTRACT (shared/BACKLOG.md § Card provenance's sibling principle):
// nothing is ever suppressed invisibly. A note that does not become a card is
// still written to .project/withheld-notes.json with the reason. A recurring
// class never writes a learning on its own — it writes a PROPOSAL a human
// confirms later. Both are plain JSON with an obvious inverse operation.
//
// Usage:
//   node ~/.claude/scripts/improvement-notes.js triage <project-root> --feature <name>   # notes on stdin
//   node ~/.claude/scripts/improvement-notes.js pending <project-root>
//   node ~/.claude/scripts/improvement-notes.js promote-confirm <project-root> --class <c>
//   node ~/.claude/scripts/improvement-notes.js promote-reject  <project-root> --class <c>
//   node ~/.claude/scripts/improvement-notes.js classes <project-root>
//
// triage never fails a green ship: malformed note data is normalized, never
// thrown on. Exit 0 = ok. 2 = usage. 5 = unreadable/invalid project-context.json.

"use strict";

const {
  existsSync,
  readFileSync,
  writeFileSync,
  renameSync,
  mkdirSync,
} = require("fs");
const { dirname, join } = require("path");

// ── Vocabulary ───────────────────────────────────────────────────────────
// severity mirrors dev-security's scanner enum minus "critical": a critical
// observation is a failure (failedAt / a manual item), never a non-blocking note.
const SEVERITY_RANK = { high: 3, medium: 2, low: 1 };

// Closed taxonomy. Class identity must be a `===` comparison: token similarity
// provably fails at "same class, different site", which is the whole problem
// this counter exists to see. A free-text label has the same failure one level up.
const CLASSES = [
  "test-coverage-gap",
  "error-handling",
  "input-validation",
  "resource-lifecycle",
  "concurrency",
  "duplication",
  "naming-and-docs",
  "dead-code",
  "ui-polish",
  "config-drift",
  "other",
];

// Fixed class → learning tag, so tagging is deterministic rather than judged.
// Classes with no honest match in LEARNING-WRITE.md's controlled vocabulary get
// no tag — that file says omit rather than force.
const CLASS_TAGS = {
  "test-coverage-gap": "testing",
  "error-handling": "errors",
  "input-validation": "validation",
  "resource-lifecycle": "perf",
  concurrency: "async",
  "ui-polish": "ui",
  "config-drift": "config",
};

const CAP = 3; // notes kept per run, after sorting by severity
const PROMOTE_AT = 3; // class occurrences before a learning is proposed
const ESCALATE_EVERY = 3; // further occurrences after promotion before a tooling card
const DECAY_DAYS = 180; // two findings this far apart are not a pattern
const EXEMPLAR_CAP = 3;
const WITHHELD_CAP = 200;

// ── IO ───────────────────────────────────────────────────────────────────
function readJson(path, label, fallback) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    console.error(
      `improvement-notes: invalid JSON in ${label}: ${err.message}`,
    );
    process.exit(5);
  }
}

function atomicWrite(path, obj) {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  writeFileSync(tmp, JSON.stringify(obj, null, 2) + "\n", "utf8");
  renameSync(tmp, path);
}

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a, b) {
  const ms = Date.parse(b) - Date.parse(a);
  return Number.isFinite(ms) ? Math.floor(ms / 86400000) : 0;
}

// ── Normalization (back-compat) ──────────────────────────────────────────
// A resumed Workflow replays cached results, so a run can still hand us the
// pre-change shape: bare strings. Legacy notes become `medium`/`other` —
// `medium` preserves today's behavior (the note still becomes a card
// candidate, nothing silently vanishes) while `other` keeps unclassified data
// out of the promotion counter, where it would be meaningless.
function normalizeNote(raw) {
  let n;
  let legacy = false;
  if (typeof raw === "string") {
    legacy = true;
    n = { note: raw };
  } else if (raw && typeof raw === "object") {
    n = { ...raw };
  } else {
    legacy = true;
    n = { note: String(raw ?? "") };
  }
  n.note = String(n.note ?? "").trim();
  if (!SEVERITY_RANK[n.severity]) {
    if (n.severity !== undefined) legacy = true;
    n.severity = "medium";
  }
  if (!CLASSES.includes(n.class)) {
    if (n.class !== undefined) legacy = true;
    n.class = "other";
  }
  n.paths = Array.isArray(n.paths) ? n.paths.filter(Boolean).slice(0, 2) : [];
  n.dependsOn = n.dependsOn || null;
  return { note: n, legacy };
}

// ── Counter ──────────────────────────────────────────────────────────────
function findClassRow(rows, cls) {
  return rows.find((r) => r.class === cls) || null;
}

function bumpClass(rows, cls, note, feature, day) {
  let row = findClassRow(rows, cls);
  if (!row) {
    row = {
      class: cls,
      count: 0,
      first: day,
      last: day,
      exemplars: [],
      promotionPending: null,
      promotedAt: null,
      promotedCount: 0,
      resets: 0,
    };
    rows.push(row);
  }
  // Decay: a class whose last sighting is ancient is not a live pattern.
  if (row.last && daysBetween(row.last, day) > DECAY_DAYS) {
    row.count = 0;
    row.resets = (row.resets || 0) + 1;
    row.first = day;
  }
  row.count = (row.count || 0) + 1;
  row.last = day;
  row.exemplars = row.exemplars || [];
  row.exemplars.push({ note: note.note, feature, paths: note.paths });
  if (row.exemplars.length > EXEMPLAR_CAP) row.exemplars.shift();
  return row;
}

function proposalFor(row) {
  const shortest = row.exemplars
    .map((e) => e.note)
    .sort((a, b) => a.length - b.length)[0];
  const tag = CLASS_TAGS[row.class];
  const words = row.class.replace(/-/g, " ");
  // The summary is written from the exemplars, never from the class name —
  // a mis-assigned class would otherwise produce a confident, wrong rule.
  const summary =
    `Recurring (${row.count}x): ${words}. Concretely: ${shortest}. ` +
    `Handle during build, not at verify.`;
  const paths = [...new Set(row.exemplars.flatMap((e) => e.paths || []))].slice(
    0,
    3,
  );
  return {
    class: row.class,
    count: row.count,
    summary: summary.slice(0, 200),
    tags: tag ? [tag] : [],
    paths,
    exemplars: row.exemplars.map((e) => e.note),
    proposedAt: null, // stamped by the caller at write time
  };
}

// ── Commands ─────────────────────────────────────────────────────────────
function ctxPath(root) {
  return join(root, ".project", "project-context.json");
}
function withheldPath(root) {
  return join(root, ".project", "withheld-notes.json");
}

function loadRows(root) {
  const ctx = readJson(ctxPath(root), "project-context.json", null);
  const rows =
    ctx && Array.isArray(ctx.improvementClasses) ? ctx.improvementClasses : [];
  return { ctx: ctx || {}, rows };
}

function cmdTriage(root, feature) {
  const day = today();
  const raw = readStdin().trim();
  let incoming = [];
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      incoming = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // An advisory channel must never fail a green ship. Unparsable stdin is
      // reported and treated as "no notes", not thrown.
      console.error(
        "improvement-notes: unparsable stdin, treating as no notes",
      );
      incoming = [];
    }
  }

  const received = incoming.length;
  let legacyCount = 0;
  const normalized = incoming
    .map(normalizeNote)
    .map(({ note, legacy }) => {
      if (legacy) legacyCount++;
      return note;
    })
    .filter((n) => n.note.length > 0);

  // Sort BEFORE the cap, or the cap keeps the first N instead of the best N —
  // a race would be dropped with the same probability as a docstring nit.
  normalized.sort(
    (a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity],
  );
  const emitted = normalized.slice(0, CAP);
  const dropped = normalized.length - emitted.length;

  const { ctx, rows } = loadRows(root);
  const cardCandidates = [];
  const belowFloor = [];
  const promote = [];
  const escalate = [];

  for (const n of emitted) {
    // Every surviving note bumps the counter, including `low`: a low-severity
    // class that keeps recurring is exactly the case a standing rule fixes.
    const row = bumpClass(rows, n.class, n, feature, day);

    const promotable =
      row.class !== "other" && !row.promotedAt && !row.promotionPending;
    if (promotable && row.count >= PROMOTE_AT) {
      const p = proposalFor(row);
      p.proposedAt = day;
      row.promotionPending = p;
      promote.push(p);
    }
    if (
      row.promotedAt &&
      row.class !== "other" &&
      row.count >= (row.promotedCount || 0) + ESCALATE_EVERY
    ) {
      escalate.push({ class: row.class, count: row.count });
      row.promotedCount = row.count;
    }

    // Card floor. `high` always cards — promotion is about the CLASS, carding
    // is about THIS instance, and dropping a real concurrency bug because it
    // happened to be the third of its kind is the failure a naive cap causes.
    if (n.severity === "low") {
      belowFloor.push({ ...n, reason: "low" });
    } else if (n.severity === "medium" && row.promotedAt) {
      belowFloor.push({ ...n, reason: "class already promoted" });
    } else {
      cardCandidates.push(n);
    }
  }

  ctx.improvementClasses = rows;
  atomicWrite(ctxPath(root), ctx);

  // Audit trail: everything withheld, plus what the cap dropped.
  if (belowFloor.length || dropped > 0) {
    const store = readJson(withheldPath(root), "withheld-notes.json", {
      schemaVersion: 1,
      notes: [],
    });
    if (!Array.isArray(store.notes)) store.notes = [];
    for (const n of belowFloor) {
      store.notes.push({
        date: day,
        feature,
        note: n.note,
        severity: n.severity,
        class: n.class,
        paths: n.paths,
        dependsOn: n.dependsOn,
        reason: n.reason,
      });
    }
    for (const n of normalized.slice(CAP)) {
      store.notes.push({
        date: day,
        feature,
        note: n.note,
        severity: n.severity,
        class: n.class,
        paths: n.paths,
        dependsOn: n.dependsOn,
        reason: "over per-run cap",
      });
    }
    if (store.notes.length > WITHHELD_CAP) {
      store.notes = store.notes.slice(-WITHHELD_CAP);
    }
    atomicWrite(withheldPath(root), store);
  }

  const legacySuffix = legacyCount ? `, ${legacyCount} legacy-shape` : "";
  const capSuffix = dropped ? `, ${dropped} over cap` : "";
  const line =
    `Notes: ${received} received → ${emitted.length} after cap ` +
    `(${belowFloor.length} withheld + ${cardCandidates.length} card candidates` +
    `${capSuffix}${legacySuffix}); ` +
    `classes proposed: ${promote.length}, escalated: ${escalate.length}`;

  process.stdout.write(
    JSON.stringify(
      { line, cardCandidates, belowFloor, promote, escalate },
      null,
      2,
    ) + "\n",
  );
}

function cmdPending(root) {
  const { rows } = loadRows(root);
  const pending = rows
    .filter((r) => r.promotionPending)
    .map((r) => r.promotionPending);
  process.stdout.write(JSON.stringify({ pending }, null, 2) + "\n");
}

function cmdPromote(root, cls, confirm) {
  const { ctx, rows } = loadRows(root);
  const row = findClassRow(rows, cls);
  if (!row || !row.promotionPending) {
    console.error(`improvement-notes: no pending proposal for class "${cls}"`);
    process.exit(0);
  }
  const proposal = row.promotionPending;
  row.promotionPending = null;
  if (confirm) {
    row.promotedAt = today();
    row.promotedCount = row.count;
  }
  ctx.improvementClasses = rows;
  atomicWrite(ctxPath(root), ctx);
  process.stdout.write(
    JSON.stringify({ class: cls, confirmed: !!confirm, proposal }, null, 2) +
      "\n",
  );
}

function cmdClasses(root) {
  const { rows } = loadRows(root);
  process.stdout.write(
    JSON.stringify({ improvementClasses: rows }, null, 2) + "\n",
  );
}

// ── Entry ────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const cmd = argv[0];
const root = argv[1];

function flag(name) {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : null;
}

if (!cmd || !root) {
  console.error(
    "Usage: improvement-notes.js <triage|pending|promote-confirm|promote-reject|classes> <project-root> [--feature <name>] [--class <c>]",
  );
  process.exit(2);
}
if (!existsSync(root)) {
  console.error(`improvement-notes: no such directory: ${root}`);
  process.exit(2);
}

switch (cmd) {
  case "triage":
    cmdTriage(root, flag("feature") || "unknown");
    break;
  case "pending":
    cmdPending(root);
    break;
  case "promote-confirm":
    cmdPromote(root, flag("class"), true);
    break;
  case "promote-reject":
    cmdPromote(root, flag("class"), false);
    break;
  case "classes":
    cmdClasses(root);
    break;
  default:
    console.error(`improvement-notes: unknown command "${cmd}"`);
    process.exit(2);
}
