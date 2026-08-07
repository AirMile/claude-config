#!/usr/bin/env node
// Durable store for skill-feedback notes — the "remember it until someone
// audits it" half of `~/.claude/CLAUDE.md § Skill Feedback`. Notes are about
// SKILLS, not about a project, so the store is user-global
// (~/.claude/skill-feedback.json), never inside a project's .project/ tree
// and never committed.
//
// WHY THIS SCRIPT EXISTS: a friction point noticed during a skill run used to
// live only in that conversation. If the user did not run /core-audit right
// then, the observation was gone — and the same friction got re-noticed,
// re-reported, and never fixed. Persisting it turns a one-shot remark into
// evidence with a recurrence count, which is exactly the signal that decides
// whether a skill is worth auditing. The mechanical parts (dedup against
// what is already stored, id assignment, recurrence counting, pruning old
// resolved rows) are set/string arithmetic the model gets subtly wrong when
// it does them from prose; the note text itself stays authored judgment.
//
// Usage:
//   node ~/.claude/scripts/skill-feedback.js add --skill <name> --note "<text>" [--note "..."] [--source self|user]
//   node ~/.claude/scripts/skill-feedback.js list [--skill <name>] [--all]
//   node ~/.claude/scripts/skill-feedback.js resolve <id> [<id>...] [--reason "<text>"]
//
// - add:     dedups each --note against the OPEN notes of the same skill
//            (normalized-equal, then Jaccard >= 0.6). A duplicate bumps
//            count + last instead of adding a row. Repeatable --note stores a
//            whole 2-3 point batch in one call. --source defaults to "self"
//            (executor-observed); "user" marks a point the user raised.
//            Stdout: one `stored #<id> <skill> (new|seen Nx)` line per note.
// - list:    open notes, most-recurrent first, then most-recent. No matches →
//            no output, exit 0 (silent-skip contract: a caller can run this
//            unconditionally). --all includes resolved rows.
//            Stdout: `#<id>  <count>x  <last>  <skill>  <note>` per line.
// - resolve: marks ids resolved (what /core-audit does with the notes its
//            refactor actually addressed). Unknown id → stderr warning, not
//            fatal. Resolved rows are pruned automatically 180 days later.
//
// Store path: $CLAUDE_SKILL_FEEDBACK_FILE, else ~/.claude/skill-feedback.json.
//
// Exit 0 = ok (including "nothing to do"). 2 = usage. 5 = invalid JSON store.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const SOURCES = ["self", "user"];
const PRUNE_AFTER_DAYS = 180;

const args = process.argv.slice(2);
const cmd = args[0];
const COMMANDS = ["add", "list", "resolve"];

function usage() {
  console.error(
    "Usage: skill-feedback.js <add|list|resolve>\n" +
      '  add     --skill <name> --note "<text>" [--note "..."] [--source self|user]\n' +
      "  list    [--skill <name>] [--all]\n" +
      '  resolve <id> [<id>...] [--reason "<text>"]',
  );
  process.exit(2);
}

if (!cmd || !COMMANDS.includes(cmd)) usage();

// ── Arg parsing ──────────────────────────────────────────────────────────
const flags = { notes: [], ids: [] };
for (let i = 1; i < args.length; i++) {
  const a = args[i];
  if (a === "--skill") flags.skill = args[++i];
  else if (a === "--note") flags.notes.push(args[++i]);
  else if (a === "--source") flags.source = args[++i];
  else if (a === "--reason") flags.reason = args[++i];
  else if (a === "--all") flags.all = true;
  else if (a.startsWith("--")) usage();
  else flags.ids.push(a);
}

// ── Store ────────────────────────────────────────────────────────────────
const storePath =
  process.env.CLAUDE_SKILL_FEEDBACK_FILE ||
  join(homedir(), ".claude", "skill-feedback.json");

const today = new Date().toISOString().slice(0, 10);

function daysBetween(from, to) {
  return (Date.parse(to) - Date.parse(from)) / 86400000;
}

function readStore() {
  if (!existsSync(storePath)) return { schemaVersion: 1, nextId: 1, notes: [] };
  let data;
  try {
    data = JSON.parse(readFileSync(storePath, "utf8"));
  } catch (err) {
    console.error(
      `skill-feedback: invalid JSON in ${storePath}: ${err.message}`,
    );
    process.exit(5);
  }
  data.notes = Array.isArray(data.notes) ? data.notes : [];
  data.nextId = Number.isInteger(data.nextId)
    ? data.nextId
    : data.notes.length + 1;
  return data;
}

function writeStore(data) {
  // Resolved rows stop being evidence once they are old; dropping them here
  // keeps the file bounded without a separate prune command.
  data.notes = data.notes.filter(
    (n) =>
      n.status !== "resolved" ||
      daysBetween(n.resolved || n.last, today) < PRUNE_AFTER_DAYS,
  );
  mkdirSync(dirname(storePath), { recursive: true });
  const tmp = `${storePath}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", "utf8");
  renameSync(tmp, storePath);
}

// ── Dedup ────────────────────────────────────────────────────────────────
function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function tokenize(str) {
  return new Set(
    normalize(str)
      .split(" ")
      .filter((t) => t.length > 2),
  );
}

function jaccard(a, b) {
  let hit = 0;
  for (const t of a) if (b.has(t)) hit++;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : hit / union;
}

function findDuplicate(notes, skill, text) {
  const norm = normalize(text);
  const tokens = tokenize(text);
  const open = notes.filter((n) => n.skill === skill && n.status === "open");
  return (
    open.find((n) => normalize(n.note) === norm) ||
    open.find((n) => jaccard(tokens, tokenize(n.note)) >= 0.6) ||
    null
  );
}

// ── Commands ─────────────────────────────────────────────────────────────
function cmdAdd() {
  if (!flags.skill) usage();
  if (!flags.notes.length || flags.notes.some((n) => !n || !n.trim())) usage();
  const source = flags.source || "self";
  if (!SOURCES.includes(source)) {
    console.error(
      `skill-feedback: invalid --source "${source}" (expected ${SOURCES.join(", ")})`,
    );
    process.exit(2);
  }

  const data = readStore();
  const lines = [];
  for (const text of flags.notes) {
    const note = text.trim();
    const dupe = findDuplicate(data.notes, flags.skill, note);
    if (dupe) {
      dupe.count += 1;
      dupe.last = today;
      if (source === "user") dupe.source = "user"; // a user-raised repeat outranks a self-observed origin
      lines.push(`stored #${dupe.id} ${flags.skill} (seen ${dupe.count}x)`);
      continue;
    }
    const entry = {
      id: data.nextId++,
      skill: flags.skill,
      note,
      source,
      first: today,
      last: today,
      count: 1,
      status: "open",
    };
    data.notes.push(entry);
    lines.push(`stored #${entry.id} ${flags.skill} (new)`);
  }
  writeStore(data);
  console.log(lines.join("\n"));
}

function cmdList() {
  const data = readStore();
  let rows = data.notes.filter((n) => flags.all || n.status === "open");
  if (flags.skill) rows = rows.filter((n) => n.skill === flags.skill);
  if (!rows.length) process.exit(0);
  rows.sort(
    (a, b) =>
      b.count - a.count || (a.last < b.last ? 1 : a.last > b.last ? -1 : 0),
  );
  console.log(
    rows
      .map(
        (n) =>
          `#${n.id}  ${n.count}x  ${n.last}  ${n.skill}` +
          `${n.status === "resolved" ? "  [resolved]" : ""}  ${n.note}`,
      )
      .join("\n"),
  );
}

function cmdResolve() {
  const ids = flags.ids.map((x) => Number(x.replace(/^#/, "")));
  if (!ids.length || ids.some((n) => !Number.isInteger(n))) usage();

  const data = readStore();
  const done = [];
  for (const id of ids) {
    const entry = data.notes.find((n) => n.id === id);
    if (!entry) {
      console.error(`skill-feedback: warning: no note #${id} — ignored`);
      continue;
    }
    entry.status = "resolved";
    entry.resolved = today;
    if (flags.reason) entry.reason = flags.reason;
    done.push(id);
  }
  writeStore(data);
  console.log(
    `resolved: ${done.length ? done.map((i) => `#${i}`).join(" ") : "none"}`,
  );
}

if (cmd === "add") cmdAdd();
else if (cmd === "list") cmdList();
else cmdResolve();
