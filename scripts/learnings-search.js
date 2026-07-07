#!/usr/bin/env node
// Relevance search + scored loader over project memory
// (project-context.json#learnings[] + .project/archive/learnings-*.json).
//
// WHY THIS SCRIPT EXISTS: the old loader (shared/LEARNINGS-LOAD.md) selected
// learnings by pure recency — hard date-sorted slices (last 5 pitfalls, last 10
// component matches, last 15 patterns). An old-but-relevant entry (e.g. an auth
// pitfall) vanished the moment newer entries pushed it past the slice, and the
// consolidation archive was NEVER loaded. This script replaces recency-only
// selection with relevance SCORING (tag > feature > keyword, recency only as a
// sub-point tiebreak) and treats the archive as an on-demand tier reachable by
// relevance. Same in-process filtering discipline: only matched entries are
// printed, so context cost scales with what is shown, not what is stored.
//
// THE SWAP POINT: scoreEntry(entry, ctx) is the single relevance function. To
// move to an embedding backend later, replace its body — everything else
// (loading, scope filters, ranking, output) stays put.
//
// Usage:
//   node learnings-search.js <project-root> load        [--feature <kebab>] [--scopes a,b] [--pitfall-prefix true|false]
//   node learnings-search.js <project-root> search      [--query "..."] [--feature <kebab>] [--tags a,b] [--type <t>] [--archive] [--cap N] [--json]
//   node learnings-search.js <project-root> suggest-tags
//   node learnings-search.js --print-vocab
//
// - load:         emits the full "LEARNINGS CONTEXT" block for shared/LEARNINGS-LOAD.md
//                 (pitfall-prefix + component + architectural scopes). Verbatim, or nothing.
// - search:       free-text / filtered query for /project-memory + the dashboard. --json for machines.
// - suggest-tags: read-only tag suggestions (JSON) for untagged active entries — for /core-pull backfill.
// - --print-vocab: sorted controlled-vocabulary tag names, one per line (drift-test anchor).
//
// Exit 0 = ok (including "no matches" — silent, matching the old loader contract).
//   2 = usage error.  Reads only; never writes.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// ── Controlled tag vocabulary ────────────────────────────────────────────────
// Single source of truth for the TAG NAMES is LEARNING-EXTRACTION.md § Tag
// Vocabulary; a drift test (scripts/tests/run.sh) diffs that table against
// `--print-vocab`. Aliases live here only — they are matching hints, expanded
// through the same tokenizer as summaries/queries so normalized forms line up.
// Exported: learnings-write.js reuses this vocabulary for tag-union merging.
export const VOCAB = {
  auth: [
    "jwt",
    "oauth",
    "session",
    "cookie",
    "login",
    "logout",
    "signin",
    "signup",
    "token",
    "credential",
    "password",
  ],
  api: [
    "endpoint",
    "rest",
    "graphql",
    "route",
    "request",
    "response",
    "http",
    "fetch",
    "axios",
  ],
  db: [
    "postgres",
    "prisma",
    "sql",
    "migration",
    "orm",
    "query",
    "database",
    "sqlite",
    "mongo",
    "index",
  ],
  state: [
    "redux",
    "zustand",
    "store",
    "reducer",
    "atom",
    "reactive",
    "mutation",
  ],
  routing: [
    "router",
    "navigation",
    "redirect",
    "navigate",
    "route",
    "middleware",
    "guard",
  ],
  ui: [
    "component",
    "render",
    "button",
    "modal",
    "view",
    "widget",
    "dom",
    "accessibility",
  ],
  styling: [
    "css",
    "tailwind",
    "theme",
    "sass",
    "scss",
    "flex",
    "grid",
    "responsive",
    "layout",
  ],
  forms: ["form", "input", "field", "submit", "formik"],
  validation: ["validate", "zod", "yup", "constraint", "schema"],
  errors: [
    "error",
    "exception",
    "throw",
    "catch",
    "crash",
    "failure",
    "stacktrace",
  ],
  async: [
    "race",
    "promise",
    "await",
    "concurrency",
    "parallel",
    "defer",
    "queue",
    "worker",
  ],
  perf: [
    "performance",
    "optimize",
    "memo",
    "lazy",
    "bundle",
    "latency",
    "throughput",
    "profiling",
  ],
  security: [
    "xss",
    "csrf",
    "injection",
    "sanitize",
    "vulnerability",
    "exploit",
    "encrypt",
    "secret",
  ],
  testing: [
    "test",
    "jest",
    "vitest",
    "mock",
    "fixture",
    "coverage",
    "assertion",
    "stub",
  ],
  "build-tooling": [
    "webpack",
    "vite",
    "rollup",
    "esbuild",
    "babel",
    "tsconfig",
    "compile",
    "lint",
  ],
  deploy: [
    "docker",
    "kubernetes",
    "vercel",
    "netlify",
    "pipeline",
    "release",
    "staging",
  ],
  config: ["env", "environment", "setting", "dotenv", "variable", "flag"],
  caching: ["cache", "redis", "memoize", "invalidate", "ttl", "stale"],
  "data-model": [
    "entity",
    "model",
    "relation",
    "attribute",
    "domain",
    "aggregate",
  ],
  logging: [
    "log",
    "logger",
    "trace",
    "monitor",
    "telemetry",
    "metric",
    "observability",
  ],
  godot: ["engine", "autoload"],
  gdscript: ["gdextension", "onready"],
  scene: ["tscn", "node2d", "signal", "instance", "packedscene", "scenetree"],
  "game-loop": [
    "physics",
    "input",
    "animation",
    "delta",
    "process",
    "tick",
    "collision",
  ],
};

// ── Tokenizer (exact port of LEARNING-EXTRACTION.md § Dedup Tokenizer) ────────
// Exported: learnings-write.js imports these to run the same dedup algorithm
// rather than re-implementing it (single source of truth for tokenization).
export const STOPWORDS = new Set(
  (
    "de het een en of maar dus dat die deze dit met via voor bij naar van uit op " +
    "in te is zijn was waren wordt worden werd geworden niet geen ook al alle " +
    "alleen wel dan toen toch nog " +
    "the a an and or but so that this these those with for at by from into " +
    "to is are was were be been being have has had do does did will would could " +
    "should may might shall not no also all only then when though still just"
  ).split(/\s+/),
);

export function normalizeSuffix(t) {
  if (t.length <= 5) return t;
  if (t.endsWith("tion") || t.endsWith("sion")) return t.slice(0, -3);
  if (t.endsWith("ing")) return t.slice(0, -3);
  if (t.endsWith("ed")) return t.slice(0, -2);
  if (t.endsWith("s") && !t.endsWith("ss")) return t.slice(0, -1);
  if (t.endsWith("er") && t.length > 6) return t.slice(0, -2);
  return t;
}

export function tokenize(str) {
  const out = new Set();
  for (let tok of String(str || "")
    .toLowerCase()
    .replace(/[.,;:!?()[\]{}'"]/g, " ")
    .split(/\s+/)) {
    if (!tok || STOPWORDS.has(tok) || tok.length < 3) continue;
    out.add(normalizeSuffix(tok));
  }
  return out;
}

// ── Reverse index: normalized token → Set<tag> ───────────────────────────────
// Built from tag names (split on '-' so "build-tooling" also matches "build" /
// "tooling") plus their aliases, all run through tokenize() for form parity.
export const TOKEN_TO_TAGS = (() => {
  const m = new Map();
  const add = (token, tag) => {
    if (!token) return;
    if (!m.has(token)) m.set(token, new Set());
    m.get(token).add(tag);
  };
  for (const [tag, aliases] of Object.entries(VOCAB)) {
    for (const word of [...tag.split("-"), ...aliases]) {
      for (const tok of tokenize(word)) add(tok, tag);
    }
  }
  return m;
})();

// ── Context builder ──────────────────────────────────────────────────────────
// ctx.tokens: query + feature tokens. ctx.tags: explicit --tags plus tags
// implied by those tokens via the reverse index.
function buildCtx({ query = "", feature = "", tags = [] } = {}) {
  const tokens = new Set([
    ...tokenize(query),
    ...tokenize(feature.replace(/-/g, " ")),
  ]);
  const tagSet = new Set(tags.filter(Boolean));
  for (const tok of tokens) {
    const implied = TOKEN_TO_TAGS.get(tok);
    if (implied) for (const t of implied) tagSet.add(t);
  }
  return { query, feature: feature.toLowerCase(), tokens, tags: tagSet };
}

// ── THE SWAP POINT ───────────────────────────────────────────────────────────
// Relevance of one entry to a query context. Returns a base score (archive
// damping and the date-desc tiebreak are applied later, in rankEntries, never
// here). Replace this body with an embedding similarity to upgrade retrieval
// without touching callers.
function scoreEntry(entry, ctx) {
  let score = 0;
  const eTags = entry.tags || [];
  for (const t of eTags) if (ctx.tags.has(t)) score += 4.0; // tag intersection
  if (ctx.feature && entry.feature) {
    const ef = entry.feature.toLowerCase();
    if (ef && (ef.includes(ctx.feature) || ctx.feature.includes(ef)))
      score += 2.0; // feature match
  }
  let overlap = 0;
  const eTokens = tokenize(entry.summary || "");
  for (const tok of ctx.tokens) if (eTokens.has(tok)) overlap++;
  score += Math.min(overlap, 5) * 1.0; // keyword overlap, capped
  return score;
}

// ── Ranking ──────────────────────────────────────────────────────────────────
// Ranks by relevance (score = scoreEntry base), then breaks ties by date desc.
// Recency is deliberately NOT folded into the score: to preserve "relevance
// always dominates" it would have to stay below one keyword point, and any term
// that small orders equal-base entries identically to the explicit date-desc
// tiebreak below — i.e. it was a no-op. So the tiebreak carries recency, cleanly.
// Also applies the archive gate: archived entries are damped ×0.7 and surface
// only on a tag match or a strong textual score — never on recency alone.
function rankEntries(entries, ctx) {
  const scored = [];
  for (const e of entries) {
    let base = scoreEntry(e, ctx);
    const tagMatch = (e.tags || []).some((t) => ctx.tags.has(t));
    if (e._archived) {
      base *= 0.7;
      if (!(base >= 4 || tagMatch)) continue; // gate: never recency-surfaced
    }
    scored.push({ e, base, score: base });
  }
  scored.sort(
    (a, b) =>
      b.score - a.score || (b.e.date || "").localeCompare(a.e.date || ""),
  );
  return scored;
}

// ── Loading ──────────────────────────────────────────────────────────────────
function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function loadActive(root) {
  const ctx = readJson(join(root, ".project", "project-context.json"));
  return ctx && Array.isArray(ctx.learnings) ? ctx.learnings : [];
}

function loadArchive(root) {
  const dir = join(root, ".project", "archive");
  if (!existsSync(dir)) return [];
  const out = [];
  for (const f of readdirSync(dir)) {
    if (!/^learnings-.*\.json$/.test(f)) continue;
    const data = readJson(join(dir, f));
    const arr = data && Array.isArray(data.archived) ? data.archived : [];
    for (const e of arr) out.push({ ...e, _archived: true, _archiveFile: f });
  }
  return out;
}

// ── Scope profiles (1:1 with LEARNINGS-LOAD.md scopes) ───────────────────────
function scopeComponent(active, archive, ctx, cap = 10) {
  if (!ctx.feature && ctx.tokens.size === 0) return [];
  return rankEntries([...active, ...archive], ctx)
    .filter((s) => s.base > 0)
    .slice(0, cap);
}

function scopeArchitectural(active, ctx, cap = 15) {
  const pool = active.filter(
    (l) =>
      l.type === "pattern" &&
      ["synced", "extracted", "consolidated"].includes(l.source),
  );
  // Always surfaces top patterns; with query/feature context, relevant ones float
  // up (base score), otherwise recency ordering. Archive is excluded by design —
  // consolidation already writes the summarized successor into the active list.
  return rankEntries(pool, ctx).slice(0, cap);
}

function scopePitfall(active, archive, ctx, cap = 5) {
  const hasCtx = ctx.feature || ctx.tokens.size > 0;
  if (hasCtx) {
    const ranked = rankEntries(
      [...active, ...archive].filter((l) => l.type === "pitfall"),
      ctx,
    ).filter((s) => s.base > 0);
    if (ranked.length) return ranked.slice(0, cap);
  }
  // Fallback (no context, or no relevance hit): most-recent active pitfalls —
  // preserves the old pitfall-prefix behaviour exactly.
  return active
    .filter((l) => l.type === "pitfall")
    .map((e) => ({ e, base: 0, score: 0 }))
    .sort((a, b) => (b.e.date || "").localeCompare(a.e.date || ""))
    .slice(0, cap);
}

function scopeSearch(active, archive, ctx, type, cap = 12) {
  let pool = [...active, ...archive];
  if (type) pool = pool.filter((l) => l.type === type);
  const ranked = rankEntries(pool, ctx);
  if (ctx.tokens.size > 0 || ctx.tags.size > 0)
    return ranked.filter((s) => s.base > 0).slice(0, cap);
  return ranked.slice(0, cap); // no query → recency order
}

// ── Formatting ───────────────────────────────────────────────────────────────
function fmtLine(e) {
  const tags = (e.tags || []).length
    ? "  " + e.tags.map((t) => "#" + t).join(" ")
    : "";
  const arch = e._archived ? " (archived)" : "";
  return (
    "  [" +
    (e.date || "?") +
    "] " +
    (e.feature || e.type) +
    " — " +
    e.summary +
    tags +
    arch
  );
}

// ── Commands ─────────────────────────────────────────────────────────────────
function cmdLoad(root, flags) {
  const feature = flags.feature || "";
  const scopes = (flags.scopes || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const pitfallPrefix = flags["pitfall-prefix"] !== "false";
  const active = loadActive(root);
  if (!active.length && !existsSync(join(root, ".project", "archive"))) return;
  const archive = loadArchive(root);
  const ctx = buildCtx({ feature });
  const out = [];

  if (pitfallPrefix) {
    const p = scopePitfall(active, archive, ctx);
    if (p.length)
      out.push(
        "Project pitfalls (relevant / recent):",
        ...p.map((s) => fmtLine(s.e)),
        "",
      );
  }
  if (scopes.includes("component") && (feature || ctx.tokens.size)) {
    const c = scopeComponent(active, archive, ctx);
    if (c.length)
      out.push(
        "Component-scoped (" + feature + "):",
        ...c.map((s) => fmtLine(s.e)),
        "",
      );
  }
  if (scopes.includes("architectural")) {
    const a = scopeArchitectural(active, ctx);
    if (a.length)
      out.push(
        "Architectural patterns (project-wide):",
        ...a.map((s) => fmtLine(s.e)),
        "",
      );
  }
  if (out.length)
    console.log(["LEARNINGS CONTEXT", "", ...out].join("\n").trimEnd());
}

function cmdSearch(root, flags) {
  const ctx = buildCtx({
    query: flags.query || "",
    feature: flags.feature || "",
    tags: (flags.tags || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  });
  const active = loadActive(root);
  const cap = flags.cap ? parseInt(flags.cap, 10) : undefined; // undefined → per-scope default
  const scope = flags.scope || "search";
  // component + pitfall always consult the archive (relevance tier); search only with --archive.
  const archive =
    scope === "component" || scope === "pitfall" || flags.archive
      ? loadArchive(root)
      : [];
  let results;
  if (scope === "component")
    results = scopeComponent(active, archive, ctx, cap ?? 10);
  else if (scope === "architectural")
    results = scopeArchitectural(active, ctx, cap ?? 15);
  else if (scope === "pitfall")
    results = scopePitfall(active, archive, ctx, cap ?? 5);
  else results = scopeSearch(active, archive, ctx, flags.type || "", cap ?? 12);

  if (flags.json) {
    console.log(
      JSON.stringify(
        results.map((s) => ({
          date: s.e.date,
          feature: s.e.feature,
          type: s.e.type,
          source: s.e.source,
          author: s.e.author,
          summary: s.e.summary,
          tags: s.e.tags || [],
          archived: !!s.e._archived,
          score: Math.round(s.score * 100) / 100,
        })),
        null,
        2,
      ),
    );
    return;
  }
  if (results.length) console.log(results.map((s) => fmtLine(s.e)).join("\n"));
}

function cmdSuggestTags(root) {
  const active = loadActive(root);
  const out = [];
  active.forEach((e, index) => {
    if (Array.isArray(e.tags) && e.tags.length) return;
    const tokens = new Set([
      ...tokenize(e.summary || ""),
      ...tokenize((e.feature || "").replace(/-/g, " ")),
    ]);
    const suggested = new Set();
    for (const tok of tokens) {
      const tags = TOKEN_TO_TAGS.get(tok);
      if (tags) for (const t of tags) suggested.add(t);
    }
    if (suggested.size)
      out.push({
        index,
        date: e.date,
        feature: e.feature,
        summary: e.summary,
        suggested: [...suggested].slice(0, 3),
      });
  });
  console.log(JSON.stringify(out, null, 2));
}

function cmdPrintVocab() {
  console.log(Object.keys(VOCAB).sort().join("\n"));
}

// ── Arg parsing ──────────────────────────────────────────────────────────────
function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith("--")) {
      flags[key] = true;
    } else {
      flags[key] = next;
      i++;
    }
  }
  return flags;
}

// CLI entrypoint — guarded so learnings-write.js can import this module's
// exports (tokenize, VOCAB, ...) without triggering this script's own CLI.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const argv = process.argv.slice(2);
  if (argv.includes("--print-vocab")) {
    cmdPrintVocab();
    process.exit(0);
  }
  const root = argv[0];
  const cmd = argv[1] && !argv[1].startsWith("--") ? argv[1] : "search";
  if (!root || root.startsWith("--")) {
    console.error(
      "Usage: learnings-search.js <project-root> [load|search|suggest-tags] [flags]   (or --print-vocab)",
    );
    process.exit(2);
  }
  const flags = parseFlags(argv.slice(cmd === argv[1] ? 2 : 1));

  if (cmd === "load") cmdLoad(root, flags);
  else if (cmd === "suggest-tags") cmdSuggestTags(root);
  else cmdSearch(root, flags);
}
