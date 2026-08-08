#!/usr/bin/env node
/**
 * Guard script: every skill instruction that EXECUTES a file under
 * `.claude/skills/…` or `.claude/scripts/…` must name a path that actually
 * resolves at runtime — `~/.claude/…`, `$HOME/.claude/…`, or a variable
 * holding an absolute root (`"$main_root/.claude/…"`).
 *
 * Those two directories only ever mean the global symlinked set. `.claude/
 * hooks/` is deliberately NOT covered: `core-setup` writes a project-local,
 * stack-specific `format-on-save.cjs` into the project itself, and a hook
 * command runs with the project root as cwd — relative is correct there.
 *
 * WHY THIS SCRIPT EXISTS
 * ----------------------
 * A bare `.claude/skills/…` is relative to the current working directory, and
 * nothing ever puts the global skill set there. `~/.claude/{skills,scripts}`
 * are whole-directory symlinks to this repo (project CLAUDE.md § Global vs
 * local); a project's own `.claude/` holds CLAUDE.md and settings, not skills.
 * So `bash .claude/skills/x/scripts/y.sh` fails with exit 127 in every
 * checkout, this repo included.
 *
 * It went unnoticed for months because the failure is soft: the executor sees
 * "No such file or directory", silently retries with the right path, and the
 * run completes. The cost is a wasted round-trip per invocation and an
 * instruction nobody trusts — not a visible break. Only a guard finds these.
 *
 * READ vs EXECUTE — deliberately only the second. The house lazy-loading
 * convention writes Read markers as
 *     > **Todo**: Read `.claude/skills/{skill}/references/{file}.md`
 * in ~40 skills. Those are prose addressed to the model, which resolves them
 * against the skill it is running; changing that convention is a separate
 * decision. This guard fires only on an interpreter invocation — `bash`,
 * `sh`, `python3`, `python`, `node` — where the shell, not the model, does
 * the resolving and a relative path is simply wrong.
 *
 * Run: node scripts/check-script-paths.js
 * Exit 0 = clean. Exit 1 = at least one unresolvable execution path.
 */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SKILLS = path.join(ROOT, "skills");

// An interpreter followed by a path into the global set. The optional
// quote/`$var` prefix is captured so the resolvability test below can see it.
const EXEC_RE =
  /\b(bash|sh|python3|python|node)\s+("?)([^\s"']*\.claude\/(?:skills|scripts)\/[A-Za-z0-9._@${}/-]+)/g;

// Resolvable: anchored at $HOME (~ or $HOME), at an absolute path, or at a
// variable that the surrounding snippet sets to an absolute root.
function resolvable(p) {
  return (
    p.startsWith("~/") ||
    p.startsWith("$HOME/") ||
    p.startsWith("${HOME}/") ||
    p.startsWith("/") ||
    /^\$\{?[A-Za-z_][A-Za-z0-9_]*\}?\//.test(p)
  );
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

const failures = [];
let execSites = 0;

for (const file of walk(SKILLS)) {
  const rel = path.relative(ROOT, file);
  const lines = fs.readFileSync(file, "utf8").split("\n");

  lines.forEach((line, i) => {
    for (const m of line.matchAll(EXEC_RE)) {
      const target = m[3];
      execSites++;
      if (resolvable(target)) continue;
      failures.push({
        rel,
        line: i + 1,
        target,
        text: line.trim().slice(0, 110),
      });
    }
  });
}

if (failures.length === 0) {
  console.log(
    `check-script-paths: OK — ${execSites} execution site(s), all resolvable.`,
  );
  process.exit(0);
}

console.error(
  `check-script-paths: ${failures.length} of ${execSites} execution site(s) name a path that cannot resolve:\n`,
);
for (const f of failures) {
  console.error(`  ${f.rel}:${f.line}`);
  console.error(`    ${f.text}`);
}
console.error(
  `\nAnchor the path: \`~/.claude/…\` for the global set, or "$var/.claude/…"`,
);
console.error(`where the snippet already sets $var to an absolute root.`);
process.exit(1);
